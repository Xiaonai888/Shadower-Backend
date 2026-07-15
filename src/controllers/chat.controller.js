import {
  createChatReply,
  getChatModelCatalog
} from "../services/chat.service.js";
import { addChatMessages } from "../services/chatMessages.service.js";
import { buildSmartChatContext } from "../services/chatContext.service.js";
import { refreshChatMemory } from "../services/chatMemory.service.js";
import { updateChatSession } from "../services/chatSessions.service.js";


const MAX_HISTORY_MESSAGES = 20;
const MAX_HISTORY_CHARACTERS = 30000;
const MAX_MESSAGE_CHARACTERS = 12000;
const MAX_MODEL_CHARACTERS = 160;
const ALLOWED_ROLES = new Set(["user", "assistant"]);
const ALLOWED_INTELLIGENCE = new Set(["instant", "medium", "high"]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function createAutoTitle(message) {
  const firstLine = message.split(/\r?\n/)[0]?.trim() || "New Chat";
  return firstLine.length > 60 ? `${firstLine.slice(0, 57)}...` : firstLine;
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
      message: "Unable to load My AI models."
    });
  }
}

export async function sendChatMessage(req, res) {
  const {
    chatId = null,
    message,
    history,
    model,
    intelligence = "high"
  } = req.body ?? {};

  if (chatId !== null && chatId !== undefined && !UUID_PATTERN.test(chatId)) {
    return res.status(400).json({
      ok: false,
      message: "Invalid chat ID"
    });
  }

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

  if (
    typeof model !== "string" ||
    !model.trim() ||
    model.trim().length > MAX_MODEL_CHARACTERS
  ) {
    return res.status(400).json({
      ok: false,
      message: "A valid My AI model is required"
    });
  }

  if (!ALLOWED_INTELLIGENCE.has(intelligence)) {
    return res.status(400).json({
      ok: false,
      message: "Invalid intelligence level"
    });
  }

   try {
    const context = await buildSmartChatContext({
      chatId,
      message: cleanMessage,
      clientHistory: normalizeHistory(history)
    });

    const result = await createChatReply({
      message: cleanMessage,
      history: context.history,
      model: model.trim(),
      intelligence,
      systemContext: context.systemContext
    });


    if (chatId) {
      await addChatMessages({
        chatId,
        messages: [
          {
            role: "user",
            content: cleanMessage
          },
          {
            role: "assistant",
            content: result.reply,
            model: result.model,
            intelligence: result.intelligence,
            metadata: {
              provider: "my-ai",
              source: result.source ?? null,
              answerId: result.answerId ?? null,
              intent: context.intent
            }
          }
        ]
      });

       if (context.history.length === 0) {
        await updateChatSession({
          chatId,
          title: createAutoTitle(cleanMessage)
        });
      }

    return res.status(200).json({
      ok: true,
      reply: result.reply,
      provider: "my-ai",
      model: result.model,
      intent: context.intent,
      intelligence: result.intelligence,
      chatId
    });
  } catch (error) {
    console.error("Chat generation failed", {
      name: error?.name,
      statusCode: error?.statusCode,
      code: error?.code,
      message: error?.message,
      model
    });

    return res.status(error?.statusCode || 500).json({
      ok: false,
      message:
        error?.publicMessage ||
        "Shadower My AI is temporarily unavailable. Please try again."
    });
  }
}

 setImmediate(() => {
        refreshChatMemory(chatId).catch((memoryError) => {
          console.error("Chat memory refresh failed", {
            chatId,
            name: memoryError?.name,
            message: memoryError?.message
          });
        });
      });
