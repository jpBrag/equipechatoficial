export interface IOpenAi {
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
  flowMode?: "permanent" | "temporary"; // Modo permanente ou temporário
  maxInteractions?: number; // Máximo de interações antes de voltar ao fluxo
  continueKeywords?: string[]; // Palavras-chave para continuar fluxo
  completionTimeout?: number; // Timeout em minutos para voltar ao fluxo
  objective?: string; // Objetivo específico do OpenAI
  autoCompleteOnObjective?: boolean; // Se deve voltar ao fluxo automaticamente quando completar objetivo
}