import { Router } from "express";
import {
  createVoiceCharacter,
  deleteVoiceCharacter,
  getVoiceCharacter,
  getVoiceCharacters,
  updateVoiceCharacter
} from "../controllers/voiceCharacters.controller.js";
import {
  completeVoiceAvatarUpload,
  deleteVoiceAvatar,
  requestVoiceAvatarUpload
} from "../controllers/voiceAvatar.controller.js";
import voiceSamplesRoutes from "./voiceSamples.routes.js";

const router = Router();

router.get("/", getVoiceCharacters);
router.post("/", createVoiceCharacter);
router.post("/:id/avatar/upload-url", requestVoiceAvatarUpload);
router.post("/:id/avatar/complete", completeVoiceAvatarUpload);
router.delete("/:id/avatar", deleteVoiceAvatar);
router.use("/:characterId/samples", voiceSamplesRoutes);
router.get("/:id", getVoiceCharacter);
router.patch("/:id", updateVoiceCharacter);
router.delete("/:id", deleteVoiceCharacter);

export default router;
