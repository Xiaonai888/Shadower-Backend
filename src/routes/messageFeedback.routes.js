import { Router } from "express";
import {
  createMessageFeedback,
  getMessageFeedback,
  updateMessageFeedback
} from "../controllers/messageFeedback.controller.js";

const router = Router();

router.post("/", createMessageFeedback);
router.get("/message/:messageId", getMessageFeedback);
router.patch("/:id", updateMessageFeedback);

export default router;
