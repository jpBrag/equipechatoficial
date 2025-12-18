import { MessageUpsertType, proto, WASocket } from "@whiskeysockets/baileys";
import {
  convertTextToSpeechAndSaveToFile,
  getBodyMessage,
  keepOnlySpecifiedChars,
  transferQueue,
  verifyMediaMessage,
  verifyMessage,
} from "../WbotServices/wbotMessageListener";
import { isNil } from "lodash";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { GoogleGenerativeAI, Part, Content } from "@google/generative-ai";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import TicketTraking from "../../models/TicketTraking";
import { FlowBuilderModel } from "../../models/FlowBuilder";
import { IConnections, INodes } from "../WebhookService/DispatchWebHookService";
import logger from "../../utils/logger";
import { getWbot } from "../../libs/wbot";

type Session = WASocket & {
  id?: number;
};

interface ImessageUpsert {
  messages: proto.IWebMessageInfo[];
  type: MessageUpsertType;
}

interface IOpenAi {
  name: string;
  prompt: string;
  voice: string;
  voiceKey: string;
  voiceRegion: string;
  maxTokens: number;
  temperature: number;
  apiKey: string;
  queueId: number;
  maxMessages: number;
  model: string;
  openAiApiKey?: string;
  
  // ✅ NOVOS CAMPOS para controle de fluxo
  flowMode?: "permanent" | "temporary";
  maxInteractions?: number;
  continueKeywords?: string[];
  completionTimeout?: number;
  objective?: string;
  autoCompleteOnObjective?: boolean;
}

interface SessionOpenAi extends OpenAI {
  id?: number;
}

interface SessionGemini extends GoogleGenerativeAI {
  id?: number;
}

const sessionsOpenAi: SessionOpenAi[] = [];
const sessionsGemini: SessionGemini[] = [];

const deleteFileSync = (path: string): void => {
  try {
    fs.unlinkSync(path);
  } catch (error) {
    console.error("Erro ao deletar o arquivo:", error);
  }
};

const sanitizeName = (name: string): string => {
  let sanitized = name.split(" ")[0];
  sanitized = sanitized.replace(/[^a-zA-Z0-9]/g, "");
  return sanitized.substring(0, 60);
};

// ✅ Função para detectar solicitação de transferência para atendente
const detectTransferRequest = (message: string): boolean => {
  const transferKeywords = [
    'falar com atendente',
    'quero um atendente', 
    'atendente humano',
    'pessoa real',
    'sair do bot',
    'parar bot',
    'atendimento humano',
    'falar com alguém',
    'não estou conseguindo',
    'isso não funciona',
    'não entendi',
    'preciso de ajuda real',
    'quero falar com uma pessoa',
    'me transfere',
    'atendente por favor'
  ];

  const lowerMessage = message.toLowerCase();
  return transferKeywords.some(keyword => lowerMessage.includes(keyword));
};

// ✅ Função para detectar solicitação de continuação do fluxo
const detectFlowContinuation = (message: string, continueKeywords: string[]): boolean => {
  if (!continueKeywords || continueKeywords.length === 0) {
    return false;
  }
  
  const lowerMessage = message.toLowerCase().trim();
  return continueKeywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()));
};

// ✅ Função para detectar se o objetivo foi completado (usando IA)
const checkObjectiveCompletion = async (
  objective: string,
  conversation: Message[],
  openai: SessionOpenAi
): Promise<boolean> => {
  if (!objective || !openai) return false;

  try {
    // Preparar histórico da conversa para análise
    const conversationText = conversation
      .slice(-5) // Últimas 5 mensagens
      .map(msg => `${msg.fromMe ? 'Bot' : 'User'}: ${msg.body}`)
      .join('\n');

    const analysisPrompt = `
Objetivo: ${objective}

Conversa:
${conversationText}

Pergunta: O objetivo foi completado com sucesso? Responda apenas "SIM" ou "NÃO".
`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: analysisPrompt }],
      max_tokens: 10,
      temperature: 0
    });

    const result = response.choices[0]?.message?.content?.trim().toUpperCase();
    return result === "SIM";
    
  } catch (error) {
    logger.error("[OPENAI SERVICE] Erro ao verificar completude do objetivo:", error);
    return false;
  }
};

// ✅ Função para retornar ao fluxo
const returnToFlow = async (ticket: Ticket, reason: string): Promise<void> => {
  try {
    // Garantir que dataWebhook seja um objeto e tenha flowContinuation
    const flowContinuation = (ticket.dataWebhook && typeof ticket.dataWebhook === "object" && "flowContinuation" in ticket.dataWebhook)
      ? (ticket.dataWebhook as any).flowContinuation
      : undefined;

    if (!flowContinuation || !flowContinuation.nextNodeId) {
      logger.warn(`[FLOW CONTINUATION] Informações de continuação não encontradas - ticket ${ticket.id}`);
      // Se não tem informações de continuação, desabilitar modo OpenAI
      await ticket.update({
        useIntegration: false,
        isBot: false,
        dataWebhook: null
      });
      return;
    }

    logger.info(`[FLOW CONTINUATION] Retornando ao fluxo - ticket ${ticket.id}, razão: ${reason}`);

    // ✅ Enviar mensagem de transição
    const transitionMessages = {
      user_requested: "Perfeito! Vou prosseguir com o atendimento.",
      max_interactions: "Obrigado pelas informações! Vou continuar com o próximo passo.",
      timeout: "Vou prosseguir com o atendimento.",
      objective_completed: "Ótimo! Completamos essa etapa. Vamos continuar!"
    };

    const transitionMessage = transitionMessages[reason] || "Continuando...";
    
    // Enviar mensagem de transição
    const wbot = getWbot(ticket.whatsappId);
    const sentMessage = await wbot.sendMessage(`${ticket.contact.number}@s.whatsapp.net`, {
      text: transitionMessage
    });
    await verifyMessage(sentMessage!, ticket, ticket.contact);

    // ✅ Restaurar estado do fluxo
    await ticket.update({
      useIntegration: false,
      isBot: false,
      dataWebhook: flowContinuation.originalDataWebhook
    });

    // ✅ Continuar fluxo no próximo nó
    if (flowContinuation.nextNodeId) {
      logger.info(`[FLOW CONTINUATION] Continuando fluxo no nó ${flowContinuation.nextNodeId} - ticket ${ticket.id}`);
      
      // Importar ActionsWebhookService dinamicamente para evitar dependência circular
      const { ActionsWebhookService } = await import("../WebhookService/ActionsWebhookService");
      
      // Buscar informações do fluxo
      const flow = await FlowBuilderModel.findOne({
        where: { id: ticket.flowStopped }
      });
      
      if (flow) {
        const nodes: INodes[] = flow.flow["nodes"];
        const connections: IConnections[] = flow.flow["connections"];
        
        await ActionsWebhookService(
          ticket.whatsappId,
          parseInt(ticket.flowStopped),
          ticket.companyId,
          nodes,
          connections,
          flowContinuation.nextNodeId,
          flowContinuation.originalDataWebhook,
          "",
          ticket.hashFlowId || "",
          null,
          ticket.id,
          {
            number: ticket.contact.number,
            name: ticket.contact.name,
            email: ticket.contact.email || ""
          }
        );
      }
    }

  } catch (error) {
    logger.error(`[FLOW CONTINUATION] Erro ao retornar ao fluxo:`, error);
    
    // Em caso de erro, desabilitar modo OpenAI
    await ticket.update({
      useIntegration: false,
      isBot: false,
      dataWebhook: null
    });
  }
};

// Prepares the AI messages from past messages
const prepareMessagesAI = (pastMessages: Message[], isGeminiModel: boolean, promptSystem: string): any[] => {
  const messagesAI: any[] = [];

  // For OpenAI, include the system prompt as a 'system' role
  // For Gemini, we pass the system prompt separately, so we don't add it here.
  if (!isGeminiModel) {
    messagesAI.push({ role: "system", content: promptSystem });
  }

  // Map past messages to AI message format
  for (const message of pastMessages) {
    // We only consider text messages for the history
    if (message.mediaType === "conversation" || message.mediaType === "extendedTextMessage") {
      if (message.fromMe) {
        // Messages from the bot are 'assistant' (or 'model' for Gemini)
        messagesAI.push({ role: "assistant", content: message.body });
      } else {
        // Messages from the user are 'user'
        messagesAI.push({ role: "user", content: message.body });
      }
    }
  }

  return messagesAI;
};

// Processes the AI response (text or audio)
const processResponse = async (
  responseText: string,
  wbot: Session,
  msg: proto.IWebMessageInfo,
  ticket: Ticket,
  contact: Contact,
  openAiSettings: IOpenAi,
  ticketTraking: TicketTraking
): Promise<void> => {
  let response = responseText;

  // ✅ NOVO: Verificar se o usuário pediu para falar com atendente ANTES de processar resposta da IA
  const userMessage = getBodyMessage(msg) || "";
  const userRequestedTransfer = detectTransferRequest(userMessage);

  if (userRequestedTransfer) {
    logger.info(`[OPENAI SERVICE] Usuário solicitou transferência para atendente - ticket ${ticket.id}`);
    
    // Desabilitar modo OpenAI
    await ticket.update({
      useIntegration: false,
      isBot: false,
      dataWebhook: null,
      status: "pending" // Colocar ticket em fila para atendente
    });

    // Enviar mensagem de transferência
    const transferMessage = "Entendi que você gostaria de falar com um atendente humano. Estou transferindo você agora. Aguarde um momento!";
    
    const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
      text: `\u200e ${transferMessage}`,
    });
    
    await verifyMessage(sentMessage!, ticket, contact);

    // Se há uma fila configurada, transferir para ela
    if (openAiSettings.queueId && openAiSettings.queueId > 0) {
      await transferQueue(openAiSettings.queueId, ticket, contact);
    }

    logger.info(`[OPENAI SERVICE] Ticket ${ticket.id} transferido para atendimento humano`);
    return;
  }

  // Check for transfer action trigger from AI response
  if (response?.toLowerCase().includes("ação: transferir para o setor de atendimento")) {
    logger.info(`[OPENAI SERVICE] IA solicitou transferência para atendente - ticket ${ticket.id}`);
    
    // Desabilitar modo OpenAI
    await ticket.update({
      useIntegration: false,
      isBot: false,
      dataWebhook: null,
      status: "pending"
    });

    if (openAiSettings.queueId && openAiSettings.queueId > 0) {
      await transferQueue(openAiSettings.queueId, ticket, contact);
    }
    
    response = response.replace(/ação: transferir para o setor de atendimento/i, "").trim();
    
    logger.info(`[OPENAI SERVICE] Ticket ${ticket.id} transferido por solicitação da IA`);
  }

  // If after removing the action, the response is empty, do nothing further.
  if (!response && !userRequestedTransfer) {
    return;
  }

  const publicFolder: string = path.resolve(__dirname, "..", "..", "..", "public", `company${ticket.companyId}`);

  // Send response based on preferred format (text or voice)
  if (openAiSettings.voice === "texto") {
    const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
      text: `\u200e ${response}`,
    });
    await verifyMessage(sentMessage!, ticket, contact);
  } else {
    const fileNameWithOutExtension = `${ticket.id}_${Date.now()}`;
    try {
      await convertTextToSpeechAndSaveToFile(
        keepOnlySpecifiedChars(response),
        `${publicFolder}/${fileNameWithOutExtension}`,
        openAiSettings.voiceKey,
        openAiSettings.voiceRegion,
        openAiSettings.voice,
        "mp3"
      );
      const sendMessage = await wbot.sendMessage(msg.key.remoteJid!, {
        audio: { url: `${publicFolder}/${fileNameWithOutExtension}.mp3` },
        mimetype: "audio/mpeg",
        ptt: true,
      });
      await verifyMediaMessage(sendMessage!, ticket, contact, ticketTraking, false, false, wbot);
      deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.mp3`);
      deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.wav`);
    } catch (error) {
      console.error(`Erro para responder com audio: ${error}`);
      // Fallback to text response
      const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
        text: `\u200e ${response}`,
      });
      await verifyMessage(sentMessage!, ticket, contact);
    }
  }
};

// Handles OpenAI request
const handleOpenAIRequest = async (openai: SessionOpenAi, messagesAI: any[], openAiSettings: IOpenAi): Promise<string> => {
  try {
    const chat = await openai.chat.completions.create({
      model: openAiSettings.model,
      messages: messagesAI as any,
      max_tokens: openAiSettings.maxTokens,
      temperature: openAiSettings.temperature,
    });
    return chat.choices[0].message?.content || "";
  } catch (error) {
    console.error("OpenAI request error:", error);
    throw error;
  }
};

// Handles Gemini request
const handleGeminiRequest = async (
  gemini: SessionGemini,
  messagesAI: any[],
  openAiSettings: IOpenAi,
  newMessage: string,
  promptSystem: string
): Promise<string> => {
  try {
    const model = gemini.getGenerativeModel({
      model: openAiSettings.model,
      systemInstruction: promptSystem,
    });

    // Converte o histórico para o formato do Gemini
    const geminiHistory: Content[] = messagesAI.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(newMessage);
    return result.response.text();
  } catch (error) {
    console.error("Gemini request error:", error);
    throw error;
  }
};

// Main function to handle AI interactions
export const handleOpenAi = async (
  openAiSettings: IOpenAi,
  msg: proto.IWebMessageInfo,
  wbot: Session,
  ticket: Ticket,
  contact: Contact,
  mediaSent?: Message | undefined,
  ticketTraking?: TicketTraking
): Promise<void> => {
  try {
    if (!openAiSettings) {
      logger.error("[OPENAI SERVICE] Configurações do OpenAI não fornecidas");
      return;
    }

    if (contact.disableBot) {
      logger.info("[OPENAI SERVICE] Bot desabilitado para este contato");
      return;
    }

    // ✅ VERIFICAR MODO TEMPORÁRIO E CONTINUAÇÃO DE FLUXO
    const isTemporaryMode = openAiSettings.flowMode === "temporary";
    const flowContinuation = (ticket.dataWebhook && typeof ticket.dataWebhook === "object" && "flowContinuation" in ticket.dataWebhook)
      ? (ticket.dataWebhook as any).flowContinuation
      : undefined;

    // ✅ VERIFICAÇÕES PARA VOLTAR AO FLUXO (apenas no modo temporário)
    if (isTemporaryMode && flowContinuation) {
      const bodyMessage = getBodyMessage(msg) || "";
      
      // 🔍 1. Verificar palavras-chave de continuação
      if (detectFlowContinuation(bodyMessage, openAiSettings.continueKeywords || [])) {
        logger.info(`[OPENAI SERVICE] Usuário solicitou continuação do fluxo - ticket ${ticket.id}`);
        return await returnToFlow(ticket, "user_requested");
      }

      // 🔍 2. Verificar limite de interações
      if (openAiSettings.maxInteractions && flowContinuation.interactionCount >= openAiSettings.maxInteractions) {
        logger.info(`[OPENAI SERVICE] Limite de interações atingido - ticket ${ticket.id}`);
        return await returnToFlow(ticket, "max_interactions");
      }

      // 🔍 3. Verificar timeout
      if (openAiSettings.completionTimeout) {
        const startTime = new Date(flowContinuation.startTime);
        const now = new Date();
        const minutesElapsed = (now.getTime() - startTime.getTime()) / (1000 * 60);
        
        if (minutesElapsed >= openAiSettings.completionTimeout) {
          logger.info(`[OPENAI SERVICE] Timeout atingido - ticket ${ticket.id}`);
          return await returnToFlow(ticket, "timeout");
        }
      }

      // ✅ Incrementar contador de interações
      await ticket.update({
        dataWebhook: {
          ...ticket.dataWebhook,
          flowContinuation: {
            ...flowContinuation,
            interactionCount: flowContinuation.interactionCount + 1
          }
        }
      });
    }

    // ✅ Validação mais robusta da estrutura da mensagem
    let bodyMessage = "";
    
    try {
      if (msg && msg.message) {
        bodyMessage = getBodyMessage(msg) || "";
      } else if (msg && msg.key) {
        // Se não tem message mas tem key, buscar do banco
        const messageFromDB = await Message.findOne({
          where: { wid: msg.key.id },
          order: [['createdAt', 'DESC']]
        });
        
        if (messageFromDB) {
          bodyMessage = messageFromDB.body || "";
          logger.info(`[OPENAI SERVICE] Usando mensagem do banco: "${bodyMessage}"`);
        }
      }
    } catch (error) {
      logger.warn("[OPENAI SERVICE] Erro ao extrair bodyMessage, tentando buscar última mensagem:", error);
      
      // FALLBACK: Se não conseguir extrair da msg, buscar a última mensagem do usuário
      const lastMessage = await Message.findOne({
        where: {
          ticketId: ticket.id,
          fromMe: false
        },
        order: [['createdAt', 'DESC']]
      });
      
      if (lastMessage) {
        bodyMessage = lastMessage.body || "";
        logger.info(`[OPENAI SERVICE] Usando última mensagem como fallback: "${bodyMessage}"`);
      }
    }

    // Se ainda não tem bodyMessage e não é áudio, não processar
    if (!bodyMessage && !msg.message?.audioMessage) {
      logger.warn("[OPENAI SERVICE] Nenhum conteúdo de texto ou áudio encontrado");
      return;
    }

    if (!openAiSettings.model) {
      logger.error("[OPENAI SERVICE] Modelo não definido nas configurações");
      return;
    }

    // Verificar messageStubType apenas se existir
    if (msg.messageStubType) {
      logger.info("[OPENAI SERVICE] Ignorando evento de grupo (messageStubType)");
      return;
    }

    const publicFolder: string = path.resolve(__dirname, "..", "..", "..", "public", `company${ticket.companyId}`);

    // Definição de modelos
    const isOpenAIModel = openAiSettings.model.startsWith('gpt-');
    const isGeminiModel = openAiSettings.model.startsWith('gemini-');

    if (!isOpenAIModel && !isGeminiModel) {
      logger.error(`[OPENAI SERVICE] Modelo não suportado: ${openAiSettings.model}`);
      await wbot.sendMessage(msg.key.remoteJid!, { 
        text: "Desculpe, o modelo de IA configurado não é suportado." 
      });
      return;
    }

    let openai: SessionOpenAi | null = null;
    let gemini: SessionGemini | null = null;

    // Inicializar provedor de IA
    if (isOpenAIModel) {
      const openAiIndex = sessionsOpenAi.findIndex(s => s.id === ticket.id);
      if (openAiIndex === -1) {
        const key = openAiSettings.openAiApiKey || openAiSettings.apiKey;
        openai = new OpenAI({ apiKey: key }) as SessionOpenAi;
        openai.id = ticket.id;
        sessionsOpenAi.push(openai);
      } else {
        openai = sessionsOpenAi[openAiIndex];
      }
    } else if (isGeminiModel) {
      const geminiIndex = sessionsGemini.findIndex(s => s.id === ticket.id);
      if (geminiIndex === -1) {
        gemini = new GoogleGenerativeAI(openAiSettings.apiKey) as SessionGemini;
        gemini.id = ticket.id;
        sessionsGemini.push(gemini);
      } else {
        gemini = sessionsGemini[geminiIndex];
      }
    }

    // Buscar mensagens passadas para contexto
    const messages = await Message.findAll({
      where: { ticketId: ticket.id },
      order: [["createdAt", "ASC"]],
      limit: openAiSettings.maxMessages > 0 ? openAiSettings.maxMessages : undefined
    });

    // Formatar prompt do sistema
    const clientName = sanitizeName(contact.name || "Amigo(a)");
    const promptSystem = `Instruções do Sistema:
    - Use o nome ${clientName} nas respostas para que o cliente se sinta mais próximo e acolhido.
    - Certifique-se de que a resposta tenha até ${openAiSettings.maxTokens} tokens e termine de forma completa, sem cortes.
    - Sempre que possível, inclua o nome do cliente para tornar o atendimento mais pessoal e gentil.
    - Se for preciso transferir para outro setor, comece a resposta com 'Ação: Transferir para o setor de atendimento'.
    
    Prompt Específico:
    ${openAiSettings.prompt}
    
    Siga essas instruções com cuidado para garantir um atendimento claro e amigável em todas as respostas.`;

    // Processar mensagem de texto
    if (bodyMessage) {
      const messagesAI = prepareMessagesAI(messages, isGeminiModel, promptSystem);

      try {
        let responseText: string | null = null;

        if (isOpenAIModel && openai) {
          messagesAI.push({ role: "user", content: bodyMessage });
          responseText = await handleOpenAIRequest(openai, messagesAI, openAiSettings);
        } else if (isGeminiModel && gemini) {
          responseText = await handleGeminiRequest(gemini, messagesAI, openAiSettings, bodyMessage, promptSystem);
        }

        if (!responseText) {
          logger.error("[OPENAI SERVICE] Nenhuma resposta do provedor de IA");
          return;
        }

        await processResponse(responseText, wbot, msg, ticket, contact, openAiSettings, ticketTraking);
        
        logger.info(`[OPENAI SERVICE] Resposta processada com sucesso para ticket ${ticket.id}`);

        // ✅ APÓS RESPOSTA: Verificar se deve continuar fluxo por objetivo completado
        if (isTemporaryMode && openAiSettings.autoCompleteOnObjective && openAiSettings.objective && openai) {
          // Buscar histórico recente para análise
          const recentMessages = await Message.findAll({
            where: { ticketId: ticket.id },
            order: [["createdAt", "DESC"]],
            limit: 10
          });

          // Verificar se objetivo foi completado
          const objectiveCompleted = await checkObjectiveCompletion(
            openAiSettings.objective,
            recentMessages,
            openai
          );

          if (objectiveCompleted) {
            logger.info(`[OPENAI SERVICE] Objetivo completado automaticamente - ticket ${ticket.id}`);
            return await returnToFlow(ticket, "objective_completed");
          }
        }

      } catch (error: any) {
        logger.error("[OPENAI SERVICE] Falha na requisição para IA:", error);
        
        const errorMessage = "Desculpe, estou com dificuldades técnicas para processar sua solicitação no momento. Por favor, tente novamente mais tarde.";
        
        const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
          text: errorMessage
        });
        
        await verifyMessage(sentMessage!, ticket, contact);
      }
    }
    // Processar áudio
    else if (msg.message?.audioMessage && mediaSent) {
      if (!openai) {
        logger.error("[OPENAI SERVICE] Sessão OpenAI necessária para transcrição mas não inicializada");
        await wbot.sendMessage(msg.key.remoteJid!, { 
          text: "Desculpe, a transcrição de áudio não está configurada corretamente." 
        });
        return;
      }

      try {
        const mediaUrl = mediaSent.mediaUrl!.split("/").pop();
        const audioFilePath = `${publicFolder}/${mediaUrl}`;

        if (!fs.existsSync(audioFilePath)) {
          logger.error(`[OPENAI SERVICE] Arquivo de áudio não encontrado: ${audioFilePath}`);
          await wbot.sendMessage(msg.key.remoteJid!, { 
            text: "Desculpe, não foi possível processar seu áudio. Por favor, tente novamente." 
          });
          return;
        }

        const file = fs.createReadStream(audioFilePath);
        const transcriptionResult = await openai.audio.transcriptions.create({
          model: "whisper-1",
          file: file,
        });

        const transcription = transcriptionResult.text;

        if (!transcription) {
          logger.warn("[OPENAI SERVICE] Transcrição vazia recebida");
          await wbot.sendMessage(msg.key.remoteJid!, { 
            text: "Desculpe, não consegui entender o áudio. Tente novamente ou envie uma mensagem de texto." 
          });
          return;
        }

        // Enviar transcrição para o usuário
        const sentTranscriptMessage = await wbot.sendMessage(msg.key.remoteJid!, {
          text: `🎤 *Sua mensagem de voz:* ${transcription}`,
        });
        await verifyMessage(sentTranscriptMessage!, ticket, contact);

        // Obter resposta da IA para a transcrição
        const messagesAI = prepareMessagesAI(messages, isGeminiModel, promptSystem);
        let responseText: string | null = null;
        
        if (isOpenAIModel) {
          messagesAI.push({ role: "user", content: transcription });
          responseText = await handleOpenAIRequest(openai, messagesAI, openAiSettings);
        } else if (isGeminiModel && gemini) {
          responseText = await handleGeminiRequest(gemini, messagesAI, openAiSettings, transcription, promptSystem);
        }
        
        if (responseText) {
          await processResponse(responseText, wbot, msg, ticket, contact, openAiSettings, ticketTraking);
        }

      } catch (error: any) {
        logger.error("[OPENAI SERVICE] Erro no processamento de áudio:", error);
        const errorMessage = error?.response?.error?.message || error.message || "Erro desconhecido";
        const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
          text: `Desculpe, houve um erro ao processar seu áudio: ${errorMessage}`,
        });
        await verifyMessage(sentMessage!, ticket, contact);
      }
    }

  } catch (error) {
    logger.error("[OPENAI SERVICE] Erro geral no serviço:", error);
    
    try {
      const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
        text: "Desculpe, ocorreu um erro interno. Por favor, tente novamente mais tarde.",
      });
      await verifyMessage(sentMessage!, ticket, contact);
    } catch (sendError) {
      logger.error("[OPENAI SERVICE] Erro ao enviar mensagem de erro:", sendError);
    }
  }
};

export default handleOpenAi;