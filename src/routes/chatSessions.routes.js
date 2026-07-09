import { Router } from "express";
import {
  createChatSession,
  getChatSessions
} from "../controllers/chatSessions.controller.js";

const router = Router();

router.get("/", getChatSessions);
router.post("/", createChatSession);

export default router;
