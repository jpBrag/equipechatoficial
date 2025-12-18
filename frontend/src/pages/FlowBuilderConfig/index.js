import React, {
  useState,
  useEffect,
  useReducer,
  useContext,
  useCallback
} from "react";
import { SiOpenai } from "react-icons/si";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";

import api from "../../services/api";

import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import MainContainer from "../../components/MainContainer";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import {
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Stack,
  Typography
} from "@mui/material";
import HttpIcon from "@mui/icons-material/Http";
import { useParams } from "react-router-dom/cjs/react-router-dom.min";
import { CircularProgress } from "@material-ui/core";
import messageNode from "./nodes/messageNode.js";

import "reactflow/dist/style.css";

import DataObjectIcon from "@mui/icons-material/DataObject";
import QuestionAnswerIcon from "@mui/icons-material/QuestionAnswer";
import CompareArrows from "@mui/icons-material/CompareArrows";

import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  onElementsRemove,
  useReactFlow
} from "react-flow-renderer";
import startNode from "./nodes/startNode";
import openaiNode from "./nodes/openaiNode";
import conditionNode from "./nodes/conditionNode";
import menuNode from "./nodes/menuNode";
import intervalNode from "./nodes/intervalNode";
import imgNode from "./nodes/imgNode";
import randomizerNode from "./nodes/randomizerNode";
import videoNode from "./nodes/videoNode";
import switchFlowNode from "./nodes/switchFlowNode";
import attendantNode from "./nodes/attendantNode";

import {
  AccessTime,
  CallSplit,
  DynamicFeed,
  Image,
  ImportExport,
  LibraryBooks,
  Message,
  MicNone,
  RocketLaunch,
  Videocam,
  Tag,
  Queue,
  Person
} from "@mui/icons-material";
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import RemoveEdge from "./nodes/removeEdge";

import FlowBuilderAddImgModal from "../../components/FlowBuilderAddImgModal";
import FlowBuilderTicketModal from "../../components/FlowBuilderAddTicketModal";
import FlowBuilderAddAudioModal from "../../components/FlowBuilderAddAudioModal";
import FlowBuilderAddTagModal from "../../components/FlowBuilderAddTagModal";
import FlowBuilderRandomizerModal from "../../components/FlowBuilderRandomizerModal";
import FlowBuilderAddVideoModal from "../../components/FlowBuilderAddVideoModal";
import FlowBuilderSingleBlockModal from "../../components/FlowBuilderSingleBlockModal";
import FlowBuilderAddTextModal from "../../components/FlowBuilderAddTextModal";
import FlowBuilderIntervalModal from "../../components/FlowBuilderIntervalModal";
import FlowBuilderConditionModal from "../../components/FlowBuilderConditionModal";
import FlowBuilderMenuModal from "../../components/FlowBuilderMenuModal";
import FlowBuilderAddSwitchFlowModal from "../../components/FlowBuilderAddSwitchFlowModal";
import FlowBuilderAddAttendantModal from "../../components/FlowBuilderAddAttendantModal";
import FlowBuilderInputModal from "../../components/FlowBuilderInputModal";
import FlowBuilderConditionCompareModal from "../../components/FlowBuilderConditionCompareModal";
import FlowBuilderRemoveTagModal from "../../components/FlowBuilderRemoveTagModal";
import FlowBuilderOpenAIModal from "../../components/FlowBuilderAddOpenAIModal";
import audioNode from "./nodes/audioNode";
import { useNodeStorage } from "../../stores/useNodeStorage";
import singleBlockNode from "./nodes/singleBlockNode";
import { colorPrimary } from "../../styles/styles";
import ticketNode from "./nodes/ticketNode";
import tagNode from "./nodes/tagNode";
import conditionCompareNode from "./nodes/conditionCompareNode";
import HttpRequestNode from "./nodes/httpRequestNode";
import removeTagNode from "./nodes/removeTagNode";
import VariableNode, {
  getFlowVariable,
  setFlowVariable,
} from "./nodes/variableNode";
import inputNode from "./nodes/inputNode";

import { ConfirmationNumber } from "@material-ui/icons";

const useStyles = makeStyles(theme => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    position: "relative",
    backgroundColor: "#F8F9FA",
    overflowY: "scroll",
    ...theme.scrollbarStyles
  },
  speeddial: {
    backgroundColor: "red"
  }
}));

function geraStringAleatoria(tamanho) {
  var stringAleatoria = "";
  var caracteres =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 0; i < tamanho; i++) {
    stringAleatoria += caracteres.charAt(
      Math.floor(Math.random() * caracteres.length)
    );
  }
  return stringAleatoria;
}

const nodeTypes = {
  message: messageNode,
  start: startNode,
  condition: conditionNode,
  menu: menuNode,
  interval: intervalNode,
  img: imgNode,
  audio: audioNode,
  randomizer: randomizerNode,
  video: videoNode,
  singleBlock: singleBlockNode,
  ticket: ticketNode,
  tag: tagNode,
  removeTag: removeTagNode,
  switchFlow: switchFlowNode,
  attendant: attendantNode,
  httpRequest: HttpRequestNode,
  variable: VariableNode,
  openai: openaiNode,
  input: inputNode,
  conditionCompare: conditionCompareNode,
};

const edgeTypes = {
  buttonedge: RemoveEdge
};

const initialNodes = [
  {
    id: "1",
    position: { x: 250, y: 100 },
    data: { label: "Inicio do fluxo" },
    type: "start"
  }
];

const initialEdges = [];

export const FlowBuilderConfig = () => {
  const classes = useStyles();
  const history = useHistory();
  const { id } = useParams();

  const storageItems = useNodeStorage();

  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [dataNode, setDataNode] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [modalAddText, setModalAddText] = useState(null);
  const [modalAddInterval, setModalAddInterval] = useState(false);
  const [modalAddCondition, setModalAddCondition] = useState(null);
  const [modalAddMenu, setModalAddMenu] = useState(null);
  const [modalAddImg, setModalAddImg] = useState(null);
  const [modalAddAudio, setModalAddAudio] = useState(null);
  const [modalAddRandomizer, setModalAddRandomizer] = useState(null);
  const [modalAddVideo, setModalAddVideo] = useState(null);
  const [modalAddSingleBlock, setModalAddSingleBlock] = useState(null);
  const [modalAddTicket, setModalAddTicket] = useState(null);
  const [modalAddTag, setModalAddTag] = useState(null);
  const [modalAddSwitchFlow, setModalAddSwitchFlow] = useState(null);
  const [modalAddAttendant, setModalAddAttendant] = useState(null);
  const [modalAddOpenAI, setModalAddOpenAI] = useState(null);
  const [modalAddInput, setModalAddInput] = useState(null);
  const [modalAddConditionCompare, setModalAddConditionCompare] = useState(false);
  const [modalAddRemoveTag, setModalAddRemoveTag] = useState(null);
  const connectionLineStyle = { stroke: "#2b2b2b", strokeWidth: "6px" };

  // Inicializar sistema de variáveis globais
  useEffect(() => {
    // Garantir que o objeto de variáveis está disponível globalmente
    if (!window.flowVariables) {
      window.flowVariables = {};
      console.log("Sistema de variáveis globais inicializado");
    }

    // Expor métodos helpers no escopo global para serem usados por outros nós
    window.getFlowVariable = getFlowVariable;
    window.setFlowVariable = setFlowVariable;
  }, []);

  const addNode = (type, data) => {
    const posY = nodes[nodes.length - 1].position.y;
    const posX = nodes[nodes.length - 1].position.x + nodes[nodes.length - 1].width + 40;

    if (type === "start") {
      return setNodes(old => {
        return [
          ...old.filter(item => item.id !== "1"),
          {
            id: "1",
            position: { x: posX, y: posY },
            data: { label: "Inicio do fluxo" },
            type: "start"
          }
        ];
      });
    }
    if (type === "text") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { label: data.text },
            type: "message"
          }
        ];
      });
    }
    if (type === "interval") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { label: `Intervalo ${data.sec} seg.`, sec: data.sec },
            type: "interval"
          }
        ];
      });
    }
    if (type === "condition") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {
              key: data.key,
              condition: data.condition,
              value: data.value
            },
            type: "condition"
          }
        ];
      });
    }
    if (type === "menu") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {
              message: data.message,
              arrayOption: data.arrayOption
            },
            type: "menu"
          }
        ];
      });
    }
    if (type === "img") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { url: data.url },
            type: "img"
          }
        ];
      });
    }
    if (type === "audio") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { url: data.url, record: data.record },
            type: "audio"
          }
        ];
      });
    }
    if (type === "randomizer") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { percent: data.percent },
            type: "randomizer"
          }
        ];
      });
    }
    if (type === "video") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { url: data.url },
            type: "video"
          }
        ];
      });
    }
    if (type === "singleBlock") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "singleBlock"
          }
        ];
      });
    }
    if (type === "ticket") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "ticket"
          }
        ];
      });
    }

    if (type === "openai") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "openai",
          },
        ];
      });
    }

    if (type === "tag") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "tag"
          }
        ];
      });
    }
    if (type === "removeTag") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {
              tag: data?.tag || "",
              ...data,
            },
            type: "removeTag",
          },
        ];
      });
    }
    if (type === "switchFlow") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "switchFlow"
          }
        ];
      });
    }
    if (type === "attendant") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "attendant"
          }
        ]
      })
    }
    if (type === "httpRequest") {
      return setNodes((old) => [
        ...old,
        {
          id: geraStringAleatoria(30),
          position: { x: posX, y: posY },
          data: {
            url: "",
            method: data?.method || "POST", // Usa o método fornecido ou POST como padrão
            requestBody: data?.requestBody || "{}",
            headersString: data?.headersString || "",
            queryParams: data?.queryParams || [],
            saveVariables: data?.saveVariables || [],
            ...data, // Mantém outros dados fornecidos, mas garante que os padrões não sejam sobrescritos se não fornecidos
          },
          type: "httpRequest",
        },
      ]);
    }
    if (type === "variable") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {
              variableName: data?.variableName || "",
              variableValue: data?.variableValue || "",
              variableType: data?.variableType || "text",
              variableExpression: data?.variableExpression || "",
              isExpression: data?.isExpression || false,
              ...data,
            },
            type: "variable",
          },
        ];
      });
    }
    if (type === "input") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {
              question: data?.question || "",
              variableName: data?.variableName || "",
              ...data,
            },
            type: "input",
          },
        ];
      });
    }
    if (type === "conditionCompare") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {
              leftValue: data.leftValue || "",
              operator: data.operator || "equals",
              rightValue: data.rightValue || "",
            },
            type: "conditionCompare",
          },
        ];
      });
    }
  };

  const textAdd = data => {
    addNode("text", data);
  };

  const intervalAdd = data => {
    addNode("interval", data);
  };

  const conditionAdd = data => {
    addNode("condition", data);
  };

  const menuAdd = data => {
    addNode("menu", data);
  };

  const imgAdd = data => {
    addNode("img", data);
  };

  const audioAdd = data => {
    addNode("audio", data);
  };

  const randomizerAdd = data => {
    addNode("randomizer", data);
  };

  const videoAdd = data => {
    addNode("video", data);
  };

  const singleBlockAdd = data => {
    addNode("singleBlock", data);
  };

  const ticketAdd = data => {
    addNode("ticket", data)
  }

  const tagAdd = data => {
    addNode("tag", data)
  }

  const openaiAdd = (data) => {
    addNode("openai", data);
  };

  const removeTagAdd = (data) => {
    addNode("removeTag", data);
  };

  const switchFlowAdd = data => {
    addNode("switchFlow", data)
  }

  const attendantAdd = data => {
    addNode("attendant", data)
  }

  const variableAdd = (data) => {
    addNode("variable", data);
  };

  const inputAdd = (data) => {
    addNode("input", data);
  };

  const conditionCompareAdd = (data) => {
    addNode("conditionCompare", data);
  };

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const { data } = await api.get(`/flowbuilder/flow/${id}`);
          if (data.flow.flow !== null) {

            const preparedNodes = data.flow.flow.nodes.map((node) => {
              if (node.type === "httpRequest") {
                console.log(`[FlowBuilder] Processando nó HTTP Request: ${node.id}`);

                if (node.data.saveVariables && node.data.saveVariables.length > 0) {
                  console.log(
                    `[FlowBuilder] Nó ${node.id} tem ${node.data.saveVariables.length} variáveis configuradas`
                  );

                  if (
                    !node.data.responseVariables ||
                    !Array.isArray(node.data.responseVariables)
                  ) {
                    console.log(
                      `[FlowBuilder] Configurando responseVariables para nó ${node.id}`
                    );
                    node.data.responseVariables = node.data.saveVariables.map(
                      (item) => ({
                        path: item.path,
                        variableName: item.variable,
                      })
                    );
                  }
                } else {
                  node.data.saveVariables = node.data.saveVariables || [];
                  node.data.responseVariables = node.data.responseVariables || [];
                }

                console.log(`[FlowBuilder] Nó HTTP Request ${node.id} processado:`, {
                  url: node.data.url,
                  method: node.data.method,
                  saveVariables: node.data.saveVariables?.length || 0,
                  responseVariables: node.data.responseVariables?.length || 0,
                });
              }
              return node;
            });

            setNodes(preparedNodes);
            setEdges(data.flow.flow.connections);
          }
          setLoading(false);
        } catch (err) {
          toastError(err);
        }
      };
      fetchContacts();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [id]);

  useEffect(() => {
    if (storageItems.action === "delete") {
      setNodes(old => old.filter(item => item.id !== storageItems.node));
      setEdges(old => {
        const newData = old.filter(item => item.source !== storageItems.node);
        const newClearTarget = newData.filter(
          item => item.target !== storageItems.node
        );
        return newClearTarget;
      });
      storageItems.setNodesStorage("");
      storageItems.setAct("idle");
    }
    if (storageItems.action === "duplicate") {
      const nodeDuplicate = nodes.filter(
        item => item.id === storageItems.node
      )[0];
      const maioresX = nodes.map(node => node.position.x);
      const maiorX = Math.max(...maioresX);
      const finalY = nodes[nodes.length - 1].position.y;
      const nodeNew = {
        ...nodeDuplicate,
        id: geraStringAleatoria(30),
        position: {
          x: maiorX + 240,
          y: finalY
        },
        selected: false,
        style: { backgroundColor: "#555555", padding: 0, borderRadius: 8 }
      };
      setNodes(old => [...old, nodeNew]);
      storageItems.setNodesStorage("");
      storageItems.setAct("idle");
    }
  }, [storageItems.action]);

  const loadMore = () => {
    setPageNumber(prevState => prevState + 1);
  };

  const handleScroll = e => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    params => setEdges(eds => addEdge(params, eds)),
    [setEdges]
  );

  const saveFlow = async () => {
    try {
      console.log("[FlowBuilder] Preparando para salvar fluxo...");
      const processedNodes = nodes.map((node) => {
        if (node.type === "httpRequest") {
          console.log(`[FlowBuilder] Processando nó HTTP Request: ${node.id}`);
          if (node.data.saveVariables && node.data.saveVariables.length > 0) {
            console.log(
              `[FlowBuilder] Nó ${node.id} tem ${node.data.saveVariables.length} variáveis configuradas`
            );

            if (
              !node.data.responseVariables ||
              !Array.isArray(node.data.responseVariables)
            ) {
              console.log(
                `[FlowBuilder] Configurando responseVariables para nó ${node.id}`
              );
              node.data.responseVariables = node.data.saveVariables.map(
                (item) => ({
                  path: item.path,
                  variableName: item.variable,
                })
              );
            }
          } else {
            node.data.saveVariables = node.data.saveVariables || [];
            node.data.responseVariables = node.data.responseVariables || [];
          }

          console.log(`[FlowBuilder] Nó HTTP Request ${node.id} processado:`, {
            url: node.data.url,
            method: node.data.method,
            saveVariables: node.data.saveVariables?.length || 0,
            responseVariables: node.data.responseVariables?.length || 0,
          });
        }
        return node;
      });

      console.log("[FlowBuilder] Enviando fluxo para o servidor...");

      await api
        .post("/flowbuilder/flow", {
          idFlow: id,
          nodes: processedNodes,
          connections: edges,
        })
        .then((res) => {
          toast.success("Fluxo salvo com sucesso");
          setNodes(processedNodes);
        });
    } catch (error) {
      toast.error("Erro ao salvar o fluxo");
      console.error("Erro ao salvar o fluxo:", error);
    }
  };

  const doubleClick = (event, node) => {
    setDataNode(node);
    if (node.type === "message") {
      setModalAddText("edit");
    }
    if (node.type === "interval") {
      setModalAddInterval("edit");
    }
    if (node.type === "condition") {
      setModalAddCondition("edit");
    }
    if (node.type === "menu") {
      setModalAddMenu("edit");
    }
    if (node.type === "img") {
      setModalAddImg("edit");
    }
    if (node.type === "audio") {
      setModalAddAudio("edit");
    }
    if (node.type === "randomizer") {
      setModalAddRandomizer("edit");
    }
    if (node.type === "singleBlock") {
      setModalAddSingleBlock("edit");
    }
    if (node.type === "ticket") {
      setModalAddTicket("edit")
    }
    if (node.type === "tag") {
      setModalAddTag("edit")
    }
    if (node.type === "removeTag") {
      setModalAddRemoveTag("edit");
    }
    if (node.type === "switchFlow") {
      setModalAddSwitchFlow("edit")
    }
    if (node.type === "openai") {
      setModalAddOpenAI("edit");
    }
    if (node.type === "attendant") {
      setModalAddAttendant("edit")
    }
    if (node.type === "httpRequest") {
      if (node.data.saveVariables && node.data.saveVariables.length > 0) {
        if (
          !node.data.responseVariables ||
          !Array.isArray(node.data.responseVariables)
        ) {
          node.data.responseVariables = node.data.saveVariables.map((item) => ({
            path: item.path,
            variableName: item.variable,
          }));

          setNodes((old) =>
            old.map((itemNode) => {
              if (itemNode.id === node.id) {
                return node;
              }
              return itemNode;
            })
          );

          console.log("[FlowBuilder] Nó HTTP Request atualizado:", node.id);
        }
      }
    }
    if (node.type === "input") {
      setModalAddInput("edit");
    }
    if (node.type === "conditionCompare") {
      setModalAddConditionCompare("edit");
    }
  };

  const clickNode = (event, node) => {
    setNodes(old =>
      old.map(item => {
        if (item.id === node.id) {
          return {
            ...item,
            style: { backgroundColor: "#0000FF", padding: 1, borderRadius: 8 }
          };
        }
        return {
          ...item,
          style: { backgroundColor: "#13111C", padding: 0, borderRadius: 8 }
        };
      })
    );
  };
  const clickEdge = (event, node) => {
    setNodes(old =>
      old.map(item => {
        return {
          ...item,
          style: { backgroundColor: "#13111C", padding: 0, borderRadius: 8 }
        };
      })
    );
  };

  const updateNode = dataAlter => {
    setNodes(old =>
      old.map(itemNode => {
        if (itemNode.id === dataAlter.id) {
          return dataAlter;
        }
        return itemNode;
      })
    );
    setModalAddText(null);
    setModalAddInterval(null);
    setModalAddCondition(null);
    setModalAddMenu(null);
    setModalAddImg(null);
    setModalAddOpenAI(null);
    setModalAddAudio(null);
    setModalAddRandomizer(null);
    setModalAddVideo(null);
    setModalAddSingleBlock(null);
    setModalAddTicket(null);
    setModalAddRemoveTag(null);

    // setModalAddConditionCompare(null);
  };

  const actions = [
    {
      icon: <RocketLaunch sx={{ color: "#3ABA38" }} />,
      name: "Inicio",
      type: "start"
    },
    {
      icon: <LibraryBooks sx={{ color: "#EC5858" }} />,
      name: "Conteúdo",
      type: "content"
    },
    {
      icon: <DynamicFeed sx={{ color: "#683AC8" }} />,
      name: "Menu",
      type: "menu"
    },
    {
      icon: <CallSplit sx={{ color: "#1FBADC" }} />,
      name: "Randomizador",
      type: "random"
    },
    {
      icon: <AccessTime sx={{ color: "#F7953B" }} />,
      name: "Intervalo",
      type: "interval"
    },
    {
      icon: <Queue sx={{ color: "#A13DAB" }} />,
      name: "Filas",
      type: "ticket"
    },
    {
      icon: <Tag sx={{ color: "#123AF2" }} />,
      name: "Tags",
      type: "tag"
    },
    {
      icon: <Tag sx={{ color: "#dc3545" }} />,
      name: "Remover Tag",
      type: "removeTag"
    },
    {
      icon: <ArrowForwardIcon sx={{ color: "#F7953B" }} />,
      name: "TrocarFlow",
      type: "switchFlow",
    },
    {
      icon: <Person sx={{ color: "#F7953B" }} />,
      name: "Atendente",
      type: "attendant",
    },
    {
      icon: <HttpIcon />,
      name: "HTTP Request",
      type: "httpRequest",
    },
    {
      icon: <DataObjectIcon fontSize="small" sx={{ color: "#1976d2" }} />,
      name: "Variável",
      type: "variable",
    },
    {
      icon: <QuestionAnswerIcon fontSize="small" sx={{ color: "#9c27b0" }} />,
      name: "Input",
      type: "input",
    },
    {
      icon: <CompareArrows sx={{ color: "#9c27b0", }} />,
      name: "Comparação",
      type: "conditionCompare",
    },
    {
      icon: <SiOpenai sx={{ color: "#F7953B", }} />,
      name: "OpenAI",
      type: "openai",
    },
  ];

  const clickActions = type => {

    switch (type) {
      case "start":
        addNode("start");
        break;
      case "menu":
        setModalAddMenu("create");
        break;
      case "content":
        setModalAddSingleBlock("create");
        break;
      case "random":
        setModalAddRandomizer("create");
        break;
      case "interval":
        setModalAddInterval("create");
        break;
      case "ticket":
        setModalAddTicket("create")
        break;
        case "tag":
          setModalAddTag("create")
          break;
      case "removeTag":
        setModalAddRemoveTag("create")
        break;
      case "switchFlow":
        setModalAddSwitchFlow("create")
        break;
      case "attendant":
        setModalAddAttendant("create")
        break;
      case "httpRequest":
        addNode("httpRequest");
        break;
      case "variable":
        addNode("variable");
        break;
      case "input":
        setModalAddInput("create");
        break;
      case "openai":
        setModalAddOpenAI("create");
        break;
      case "conditionCompare":
        setModalAddConditionCompare("create");
        break;
      default:
    }
  };

  return (
    <Stack sx={{ height: "100vh" }}>
      <FlowBuilderAddTextModal
        open={modalAddText}
        onSave={textAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddText}
      />
      <FlowBuilderIntervalModal
        open={modalAddInterval}
        onSave={intervalAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddInterval}
      />
      <FlowBuilderConditionModal
        open={modalAddCondition}
        onSave={conditionAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddCondition}
      />
      <FlowBuilderMenuModal
        open={modalAddMenu}
        onSave={menuAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddMenu}
      />
      <FlowBuilderAddImgModal
        open={modalAddImg}
        onSave={imgAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddImg}
      />
      <FlowBuilderAddAudioModal
        open={modalAddAudio}
        onSave={audioAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddAudio}
      />
      <FlowBuilderRandomizerModal
        open={modalAddRandomizer}
        onSave={randomizerAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddRandomizer}
      />
      <FlowBuilderAddVideoModal
        open={modalAddVideo}
        onSave={videoAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddVideo}
      />
      <FlowBuilderSingleBlockModal
        open={modalAddSingleBlock}
        onSave={singleBlockAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddSingleBlock}
      />
      <FlowBuilderTicketModal
        open={modalAddTicket}
        onSave={ticketAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddTicket}
      />
      <FlowBuilderOpenAIModal
        open={modalAddOpenAI}
        onSave={openaiAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddOpenAI}
      />
      <FlowBuilderAddTagModal
        open={modalAddTag}
        onSave={tagAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddTag}
      />
      <FlowBuilderRemoveTagModal
        open={modalAddRemoveTag}
        onSave={removeTagAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={() => setModalAddRemoveTag(null)}
      />
      <FlowBuilderAddSwitchFlowModal
        open={modalAddSwitchFlow}
        onSave={switchFlowAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddSwitchFlow}
      />
      <FlowBuilderAddAttendantModal
        open={modalAddAttendant}
        onSave={attendantAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddAttendant}
      />
      <FlowBuilderInputModal
        open={modalAddInput}
        onSave={inputAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddInput}
      />
      <FlowBuilderConditionCompareModal
        open={modalAddConditionCompare}
        onSave={conditionCompareAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddConditionCompare}
      />
      <MainHeader>
        <Title>Desenhe seu fluxo</Title>
      </MainHeader>
      {!loading && (
        <Paper
          className={classes.mainPaper}
          variant="outlined"
          onScroll={handleScroll}
        >
          <Stack>
            <SpeedDial
              ariaLabel="SpeedDial basic example"
              sx={{
                position: "absolute",
                top: 16,
                left: 16,
                ".MuiSpeedDial-fab": {
                  backgroundColor: colorPrimary(),
                  '&:hover': {
                    backgroundColor: colorPrimary()
                  }
                }
              }}
              icon={<SpeedDialIcon />}
              direction={"down"}
            >
              {actions.map(action => (
                <SpeedDialAction
                  key={action.name}
                  icon={action.icon}
                  tooltipTitle={action.name}
                  tooltipOpen
                  tooltipPlacement={"right"}
                  onClick={() => clickActions(action.type)}
                />
              ))}
            </SpeedDial>
          </Stack>
          <Stack
            sx={{
              position: "absolute",
              justifyContent: "center",
              flexDirection: "row",
              width: "100%"
            }}
          >
            <Typography
              style={{ color: "#010101", textShadow: "#010101 1px 0 10px" }}
            >
              Não se esqueça de salvar seu fluxo!
            </Typography>
          </Stack>
          <Stack direction={"row"} justifyContent={"end"}>
            <Button
              sx={{ textTransform: "none" }}
              variant="contained"
              color="primary"
              onClick={() => saveFlow()}
            >
              Salvar
            </Button>
          </Stack>

          <Stack
            direction={"row"}
            style={{
              width: "100%",
              height: "90%",
              position: "relative",
              display: "flex"
            }}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              deleteKeyCode={["Backspace", "Delete"]}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDoubleClick={doubleClick}
              onNodeClick={clickNode}
              onEdgeClick={clickEdge}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              fitView
              connectionLineStyle={connectionLineStyle}
              style={{
                //backgroundImage: `url(${imgBackground})`,
                //backgroundSize: "cover"
                backgroundColor: "#F8F9FA"
              }}
              edgeTypes={edgeTypes}
              variant={"cross"}
              defaultEdgeOptions={{
                style: { color: "#ff0000", strokeWidth: "6px" },
                animated: false
              }}
            >
              <Controls />
              <MiniMap />
              <Background variant="dots" gap={12} size={-1} />
            </ReactFlow>

            <Stack
              style={{
                backgroundColor: "#FAFAFA",
                height: "20px",
                width: "58px",
                position: "absolute",
                bottom: 0,
                right: 0,
                zIndex: 1111
              }}
            />
            {/* <Stack
                style={{
                  backgroundColor: "#1B1B1B",
                  height: "70%",
                  width: "150px",
                  position: "absolute",
                  left: 0,
                  top: 0,
                  zIndex: 1111,
                  borderRadius: 3,
                  padding: 8
                }}
                spacing={1}
              >
                <Typography style={{ color: "#ffffff", textAlign: "center" }}>
                  Adicionar
                </Typography>
                <Button
                  onClick={() => addNode("start")}
                  variant="contained"
                  style={{
                    backgroundColor: "#3ABA38",
                    color: "#ffffff",
                    padding: 8,
                    "&:hover": {
                      backgroundColor: "#3e3b7f"
                    },
                    textTransform: "none"
                  }}
                >
                  <RocketLaunch
                    sx={{
                      width: "16px",
                      height: "16px",
                      marginRight: "4px"
                    }}
                  />
                  Inicio
                </Button>
                <Button
                  onClick={() => setModalAddText("create")}
                  variant="contained"
                  style={{
                    backgroundColor: "#6865A5",
                    color: "#ffffff",
                    padding: 8,
                    textTransform: "none"
                  }}
                >
                  <Message
                    sx={{
                      width: "16px",
                      height: "16px",
                      marginRight: "4px"
                    }}
                  />
                  Texto
                </Button>
                <Button
                  onClick={() => setModalAddInterval("create")}
                  variant="contained"
                  style={{
                    backgroundColor: "#F7953B",
                    color: "#ffffff",
                    padding: 8,
                    textTransform: "none"
                  }}
                >
                  <AccessTime
                    sx={{
                      width: "16px",
                      height: "16px",
                      marginRight: "4px"
                    }}
                  />
                  Intervalo
                </Button>
                <Button
                  onClick={() => setModalAddCondition("create")}
                  variant="contained"
                  disabled
                  style={{
                    backgroundColor: "#524d4d",
                    color: "#cccaed",
                    padding: 8,
                    textTransform: "none"
                  }}
                >
                  <ImportExport
                    sx={{
                      width: "16px",
                      height: "16px",
                      marginRight: "4px"
                    }}
                  />
                  Condição
                </Button>
                <Button
                  onClick={() => setModalAddMenu("create")}
                  variant="contained"
                  style={{
                    backgroundColor: "#683AC8",
                    color: "#ffffff",
                    padding: 8,
                    textTransform: "none"
                  }}
                >
                  <DynamicFeed
                    sx={{
                      width: "16px",
                      height: "16px",
                      marginRight: "4px"
                    }}
                  />
                  Menu
                </Button>
                <Button
                  onClick={() => setModalAddAudio("create")}
                  variant="contained"
                  style={{
                    backgroundColor: "#6865A5",
                    color: "#ffffff",
                    padding: 8,
                    textTransform: "none"
                  }}
                >
                  <MicNone
                    sx={{
                      width: "16px",
                      height: "16px",
                      marginRight: "4px"
                    }}
                  />
                  Audio
                </Button>
                <Button
                  onClick={() => setModalAddVideo("create")}
                  variant="contained"
                  style={{
                    backgroundColor: "#6865A5",
                    color: "#ffffff",
                    padding: 8,
                    textTransform: "none"
                  }}
                >
                  <Videocam
                    sx={{
                      width: "16px",
                      height: "16px",
                      marginRight: "4px"
                    }}
                  />
                  Video
                </Button>
                <Button
                  onClick={() => setModalAddImg("create")}
                  variant="contained"
                  style={{
                    backgroundColor: "#6865A5",
                    color: "#ffffff",
                    padding: 8,
                    textTransform: "none"
                  }}
                >
                  <Image
                    sx={{
                      width: "16px",
                      height: "16px",
                      marginRight: "4px"
                    }}
                  />
                  Imagem
                </Button>
                <Button
                  onClick={() => setModalAddRandomizer("create")}
                  variant="contained"
                  style={{
                    backgroundColor: "#1FBADC",
                    color: "#ffffff",
                    padding: 8,
                    textTransform: "none"
                  }}
                >
                  <CallSplit
                    sx={{
                      width: "16px",
                      height: "16px",
                      marginRight: "4px"
                    }}
                  />
                  Randomizador
                </Button>
                <Button
                  onClick={() => setModalAddSingleBlock("create")}
                  variant="contained"
                  style={{
                    backgroundColor: "#EC5858",
                    color: "#ffffff",
                    padding: 8,
                    textTransform: "none"
                  }}
                >
                  <LibraryBooks
                    sx={{
                      width: "16px",
                      height: "16px",
                      marginRight: "4px"
                    }}
                  />
                  Conteúdo
                </Button>
              </Stack> */}
          </Stack>
        </Paper>
      )}
      {loading && (
        <Stack justifyContent={"center"} alignItems={"center"} height={"70vh"}>
          <CircularProgress />
        </Stack>
      )}
    </Stack>
  );
};