import express from "express";

import * as N8nController from "../controllers/n8nController";

const n8nRoutes = express.Router();

n8nRoutes.post("/n8n/updateTicket", N8nController.updateTicket);


export default n8nRoutes;
