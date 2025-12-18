import React, { useState, useEffect, memo } from "react";
import { Handle, Position } from "react-flow-renderer";
import { 
  CircularProgress,
  Stack, 
  Typography, 
  Box,
  IconButton,
  Divider
} from "@mui/material";
import { 
  CompareArrows,
  ContentCopy as ContentCopyIcon,
  DeleteOutline as DeleteOutlineIcon
} from "@mui/icons-material";

import { useNodeStorage } from "../../../stores/useNodeStorage";


const processVariableValue = (text) => {
  if (!text) return "";
  
  if (text.includes("${")) {
    const regex = /\${([^}]+)}/g;
    let match;
    let processedText = text;
    
    while ((match = regex.exec(text)) !== null) {
      const variableName = match[1];
      const variableValue = window.getFlowVariable 
        ? window.getFlowVariable(variableName) 
        : null;
      
      if (variableValue !== null && variableValue !== undefined) {
        processedText = processedText.replace(
          match[0],
          variableValue.toString()
        );
      }
    }
    
    return processedText;
  }
  
  return text;
};

const TruncatedValue = ({ value, maxLength = 15 }) => {
  if (!value) return <Typography variant="body2">-</Typography>;
  
  const displayValue = value.toString();
  const truncated = displayValue.length > maxLength;
  
  return (
    <Typography
      variant="body2"
      sx={{ fontWeight: 500 }}
      title={truncated ? displayValue : ""}
    >
      {truncated ? `${displayValue.substring(0, maxLength)}...` : displayValue}
    </Typography>
  );
};

const getOperatorText = (operator) => {
  const operators = {
    contains: "Contém",
    equals: "Igual a",
    notEquals: "Diferente de", 
    greaterThan: "Maior que",
    lessThan: "Menor que",
    greaterOrEqual: "Maior ou igual a",
    lessOrEqual: "Menor ou igual a",
    startsWith: "Começa com",
    endsWith: "Termina com",
    isEmpty: "Está vazio",
    isNotEmpty: "Não está vazio"
  };
  
  return operators[operator] || operator;
};

const compareValues = (value1, value2, operator) => {
  if (!value1 && operator !== "isEmpty" && operator !== "isNotEmpty") {
    value1 = "";
  }
  
  if (!value2 && operator !== "isEmpty" && operator !== "isNotEmpty") {
    value2 = "";
  }
  
  const strValue1 = String(value1);
  const strValue2 = String(value2);
  
  const numValue1 = parseFloat(value1);
  const numValue2 = parseFloat(value2);
  
  switch (operator) {
    case "contains":
      return strValue1.includes(strValue2);
    case "equals":
      return strValue1 === strValue2;
    case "notEquals":
      return strValue1 !== strValue2;
    case "greaterThan":
      return !isNaN(numValue1) && !isNaN(numValue2) && numValue1 > numValue2;
    case "lessThan":
      return !isNaN(numValue1) && !isNaN(numValue2) && numValue1 < numValue2;
    case "greaterOrEqual":
      return !isNaN(numValue1) && !isNaN(numValue2) && numValue1 >= numValue2;
    case "lessOrEqual":
      return !isNaN(numValue1) && !isNaN(numValue2) && numValue1 <= numValue2;
    case "startsWith":
      return strValue1.startsWith(strValue2);
    case "endsWith":
      return strValue1.endsWith(strValue2);
    case "isEmpty":
      return !strValue1 || strValue1.trim() === "";
    case "isNotEmpty":
      return strValue1 && strValue1.trim() !== "";
    default:
      return false;
  }
};

const ConditionCompareNode = ({ data, selected, id }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [comparing, setComparing] = useState(false);
  
  const storageItems = useNodeStorage();
  useEffect(() => {
    const updateValues = () => {
      try {
        setLoading(true);

        const processedLeftValue = processVariableValue(data.leftValue);
  
        let processedRightValue = null; 
        if (data.operator !== "isEmpty" && data.operator !== "isNotEmpty") {
          processedRightValue = processVariableValue(data.rightValue);
        }
        
        const comparisonResult = compareValues(
          processedLeftValue,
          data.operator !== "isEmpty" && data.operator !== "isNotEmpty" ? processedRightValue : null,
          data.operator
        );
        
        setResult(comparisonResult);
        setComparing(true);
      } catch (error) {
        console.error("Erro ao processar comparação:", error);
        setResult(false);
      } finally {
        setLoading(false);
      }
    };
    
    updateValues();
    

    const intervalId = setInterval(updateValues, 2000);
    
    return () => clearInterval(intervalId);
  }, [data]);
  

  const isVariable = (value) => {
    return value && typeof value === "string" && value.includes("${");
  };
  

  const formatDisplayValue = (value) => {
    if (isVariable(value)) {
      const regex = /\${([^}]+)}/g;
      let match;
      let formattedValue = value;
      
      while ((match = regex.exec(value)) !== null) {
        const variableName = match[1];
        formattedValue = formattedValue.replace(
          match[0],
          `<span style="background-color: rgba(156, 39, 176, 0.1); padding: 2px 4px; border-radius: 4px; color: #9c27b0; font-weight: 500;">${variableName}</span>`
        );
      }
      
      return (
        <div dangerouslySetInnerHTML={{ __html: formattedValue }} />
      );
    }
    
    return <TruncatedValue value={value} />;
  };

  return (
    <Box
      sx={{
        backgroundColor: "#fff",
        borderRadius: 2,
        boxShadow: 2,
        p: 2,
        width: 280,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        position: "relative",
        border: "1px solid",
        borderColor: comparing
          ? result
            ? "rgba(76, 175, 80, 0.3)"
            : "rgba(239, 83, 80, 0.3)"
          : "rgba(104, 58, 200, 0.1)",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          left: -8,
          top: "50%",
          transform: "translateY(-50%)",
          background: "#555",
          width: 12,
          height: 12,
        }}
      />
      
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CompareArrows fontSize="small" sx={{ color: '#683AC8' }} />
          <Typography variant="subtitle1" fontWeight="bold">
            Comparação
          </Typography>
        </Box>
        
        <Box sx={{ display: "flex", gap: 1 }}>
          <IconButton
            size="small"
            onClick={() => {
              storageItems.setNodesStorage(id);
              storageItems.setAct("duplicate");
            }}
          >
            <ContentCopyIcon fontSize="small" />
          </IconButton>
          
          <IconButton
            size="small"
            onClick={() => {
              storageItems.setNodesStorage(id);
              storageItems.setAct("delete");
            }}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
      
      <Divider sx={{ my: 0.5 }} />
      
      <Box 
        sx={{ 
          p: 1.5, 
          borderRadius: 1,
          bgcolor: "background.default",
          border: "1px solid",
          borderColor: "divider"
        }}
      >
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Valor 1:
            </Typography>
            {formatDisplayValue(data.leftValue)}
          </Stack>
          
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Operador:
            </Typography>
            <Typography variant="body2" fontWeight={500}>
              {getOperatorText(data.operator)}
            </Typography>
          </Stack>
          
          {data.operator !== "isEmpty" && data.operator !== "isNotEmpty" && (
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="text.secondary">
                Valor 2:
              </Typography>
              {formatDisplayValue(data.rightValue)}
            </Stack>
          )}
        </Stack>
      </Box>
      
      {comparing && (
        <Box
          sx={{
            p: 0.8,
            borderRadius: 1,
            bgcolor: result ? "success.light" : "error.light",
            textAlign: "center",
          }}
        >
          <Typography
            variant="body2"
            sx={{ fontWeight: 500, color: "common.white" }}
          >
            {result ? "Condição Atendida" : "Condição Não Atendida"}
          </Typography>
        </Box>
      )}
      
      {loading && (
        <Stack alignItems="center" justifyContent="center">
          <CircularProgress size={20} />
        </Stack>
      )}
      
      <Handle
        type="source"
        id="true"
        position={Position.Right}
        style={{ 
          top: "30%", 
          right: -8,
          background: "#4caf50", 
          width: 12, 
          height: 12,
          cursor: 'pointer'
        }}
      />
      <Handle
        type="source"
        id="false"
        position={Position.Right}
        style={{ 
          top: "70%", 
          right: -8,
          background: "#ef5350", 
          width: 12, 
          height: 12,
          cursor: 'pointer'
        }}
      />
    </Box>
  );
};

export default memo(ConditionCompareNode);