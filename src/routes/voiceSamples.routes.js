import { Router } from "express";
import {
  completeVoiceUpload,
  deleteVoiceSample,
  getVoicePlayUrl,
  getVoiceSamples,
  requestVoiceUpload,
  updateVoiceSample
} from "../controllers/voiceSamples.controller.js";

const router = Router({ mergeParams: true });

router.get("/", getVoiceSamples);
router.post("/upload-url", requestVoiceUpload);
router.post("/:sampleId/complete", completeVoiceUpload);
router.get("/:sampleId/play-url", getVoicePlayUrl);
router.patch("/:sampleId", updateVoiceSample);
router.delete("/:sampleId", deleteVoiceSample);

export default router;
