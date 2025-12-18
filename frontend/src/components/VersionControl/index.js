// VersionControl.js
import React, { useState } from "react";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import UpdateIcon from "@material-ui/icons/Update";
import { makeStyles } from "@material-ui/core/styles";
import api from "../../services/api";

const packageVersion = require("../../../package.json").version;

const useStyles = makeStyles((theme) => ({
  pulse: {
    animation: "$pulse 2s infinite",
    color: theme.palette.error.main,
  },
  "@keyframes pulse": {
    "0%": {
      transform: "scale(1)",
      opacity: 1,
    },
    "50%": {
      transform: "scale(1.2)",
      opacity: 0.7,
    },
    "100%": {
      transform: "scale(1)",
      opacity: 1,
    },
  },
}));

const VersionControl = () => {
  const classes = useStyles();
  const [storedVersion] = useState(window.localStorage.getItem("version") || "0.0.0");

  const handleUpdateVersion = async () => {
    window.localStorage.setItem("version", packageVersion);

    // Mantive apenas para salvar no banco a versao atual
    const { data } = await api.post("/version", {
      version: packageVersion,
    });

    // Limpar o cache do navegador
    caches.keys().then(function (names) {
      for (let name of names) caches.delete(name);
    });

    // Atraso para garantir que o cache foi limpo
    setTimeout(() => {
      window.location.reload(true); // Recarregar a página
    }, 1000);
  };

  if (storedVersion !== packageVersion) {
    return (
      <Tooltip title="Nova versão disponível! Clique para atualizar" arrow>
        <IconButton color="inherit" onClick={handleUpdateVersion}>
          <UpdateIcon className={classes.pulse} />
        </IconButton>
      </Tooltip>
    );
  }

  return null;
};

export default VersionControl;