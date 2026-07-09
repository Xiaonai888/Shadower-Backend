import { findFastAnswer } from "../data/fastAnswers.js";
import {
  createCloudflareReply,
  getCloudflareModels,
  isCloudflareAiConfigured
} from "./cloudflareAi.service.js";

export async function getChatModelCatalog() {
  const configured = isCloudflareAiConfigured();
  const models = getCloudflareModels();

  return {
    providers: [
      {
        id: "my-ai",
        label: "My AI",
        available: configured,
        status: configured
          ? "Connected to Cloudflare Workers AI"
          : "Cloudflare Workers AI is not configured in Render",
        models
      }
    ],
    intelligenceLevels: [
      {
        id: "instant",
        label: "Instant"
      },
      {
        id: "medium",
        label: "Medium"
      },
      {
        id: "high",
        label: "High"
      }
    ]
  };
}

export async function createChatReply({
  message,
  history,
  model,
  intelligence
}) {
  const fastAnswer = findFastAnswer(message);

  if (fastAnswer) {
    return {
      reply: fastAnswer.reply,
      model: "fast-answer",
      intelligence,
      source: fastAnswer.source,
      answerId: fastAnswer.answerId
    };
  }

  return createCloudflareReply({
    message,
    history,
    model,
    intelligence
  });
}
