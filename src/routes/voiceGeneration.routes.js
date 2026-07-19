import { Router } from "express";
import {
  generateKhmerVoice,
  getVoiceEngineHealth
} from "../controllers/voiceGeneration.controller.js";

const router = Router();

router.get("/health", getVoiceEngineHealth);
router.post("/", generateKhmerVoice);

export default router;
