import { Router } from "express";
import { sendChatMessage } from "../controllers/chat.controller.js";

const router = Router();

router.post("/", sendChatMessage);

export default router;
