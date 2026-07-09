import {
  createChatReply,
  getChatModelCatalog
} from "../services/chat.service.js";

const MAX_HISTORY_MESSAGES = 20;
const MAX_HISTORY_CHARACTERS = 30000;
const MAX_MESSAGE_CHARACTERS = 12000;
const MAX_MODEL_CHARACTERS = 160;
const ALLOWED_ROLES = new Set(["user", "assistant"]);
const ALLOWED_PROVIDERS = new Set(["my-ai", "openai"]);
const ALLOWED_INTELLIGENCE = new Set(["instant", "medium", "high"]);

function normalizeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  const normalized = [];
  let totalCharacters = 0;

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index];

    if (
      !item ||
      !ALLOWED_ROLES.has(item.role) ||
      typeof item.text !== "string"
    ) {
      continue;
    }

    const text = item.text.trim().slice(0, MAX_MESSAGE_CHARACTERS);

    if (!text) {
      continue;
    }

    if (totalCharacters + text.length > MAX_HISTORY_CHARACTERS) {
      break;
    }

    normalized.unshift({
      role: item.role,
      content: text
    });

    totalCharacters += text.length;

    if (normalized.length >= MAX_HISTORY_MESSAGES) {
      break;
    }
  }

  return normalized;
}

export async function getChatModels(req, res) {
  try {
    const catalog = await getChatModelCatalog();

    return res.status(200).json({
      ok: true,
      ...catalog
    });
  } catch (error) {
    console.error("Model catalog failed", {
      name: error?.name,
      message: error?.message
    });

    return res.status(500).json({
      ok: false,
      message: "Unable to load AI providers and models."
    });
  }
}

export async function sendChatMessage(req, res) {
  const {
    message,
    history,
    provider = "my-ai",
    model,
    intelligence = "high"
  } = req.body ?? {};

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({
      ok: false,
      message: "Message is required"
    });
  }

  const cleanMessage = message.trim();

  if (cleanMessage.length > MAX_MESSAGE_CHARACTERS) {
    return res.status(400).json({
      ok: false,
      message: "Message must not exceed 12,000 characters"
    });
  }

  if (!ALLOWED_PROVIDERS.has(provider)) {
    return res.status(400).json({
      ok: false,
      message: "Invalid AI provider"
    });
  }

  if (
    typeof model !== "string" ||
    !model.trim() ||
    model.trim().length > MAX_MODEL_CHARACTERS
  ) {
    return res.status(400).json({
      ok: false,
      message: "A valid AI model is required"
    });
  }

  if (!ALLOWED_INTELLIGENCE.has(intelligence)) {
    return res.status(400).json({
      ok: false,
      message: "Invalid intelligence level"
    });
  }

  try {
    const result = await createChatReply({
      message: cleanMessage,
      history: normalizeHistory(history),
      provider,
      model: model.trim(),
      intelligence
    });

    return res.status(200).json({
      ok: true,
      reply: result.reply,
      provider: result.provider,
      model: result.model,
      intelligence: result.intelligence
    });
  } catch (error) {
    console.error("Chat generation failed", {
      name: error?.name,
      status: error?.status,
      statusCode: error?.statusCode,
      code: error?.code,
      message: error?.message,
      provider,
      model
    });

    return res.status(error?.statusCode || 500).json({
      ok: false,
      message:
        error?.publicMessage ||
        "Shadower AI is temporarily unavailable. Please try again."
    });
  }
}
