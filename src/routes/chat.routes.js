import { Router } from "express";
import {
  getChatModels,
  sendChatMessage
} from "../controllers/chat.controller.js";

const router = Router();

router.get("/models", getChatModels);
router.post("/", sendChatMessage);

export default router;
