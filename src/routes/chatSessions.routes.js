import { Router } from "express";
import {
  createChatSession,
  deleteChatSession,
  getChatSessions,
  updateChatSession
} from "../controllers/chatSessions.controller.js";

const router = Router();

router.get("/", getChatSessions);
router.post("/", createChatSession);
router.patch("/:id", updateChatSession);
router.delete("/:id", deleteChatSession);

export default router;
