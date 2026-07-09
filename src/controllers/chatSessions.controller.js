import {
  createChatSession as createChatSessionRecord,
  listChatSessions
} from "../services/chatSessions.service.js";

const ALLOWED_INTELLIGENCE = new Set(["instant", "medium", "high"]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sendError(res, error, fallbackMessage) {
  console.error("Chat session request failed", {
    name: error?.name,
    statusCode: error?.statusCode,
    message: error?.message
  });

  return res.status(error?.statusCode || 500).json({
    ok: false,
    message: error?.publicMessage || fallbackMessage
  });
}

export async function getChatSessions(req, res) {
  try {
    const chats = await listChatSessions({
      limit: req.query?.limit
    });

    return res.status(200).json({
      ok: true,
      chats
    });
  } catch (error) {
    return sendError(res, error, "Unable to load chat sessions.");
  }
}

export async function createChatSession(req, res) {
  const {
    title,
    model,
    intelligence = "high",
    projectId = null
  } = req.body ?? {};

  if (title !== undefined && typeof title !== "string") {
    return res.status(400).json({
      ok: false,
      message: "Chat title must be text."
    });
  }

  if (
    model !== undefined &&
    (typeof model !== "string" || !model.trim() || model.trim().length > 160)
  ) {
    return res.status(400).json({
      ok: false,
      message: "A valid model is required."
    });
  }

  if (!ALLOWED_INTELLIGENCE.has(intelligence)) {
    return res.status(400).json({
      ok: false,
      message: "Invalid intelligence level."
    });
  }

  if (
    projectId !== null &&
    projectId !== undefined &&
    (typeof projectId !== "string" || !UUID_PATTERN.test(projectId.trim()))
  ) {
    return res.status(400).json({
      ok: false,
      message: "Invalid project ID."
    });
  }

  try {
    const chat = await createChatSessionRecord({
      title,
      model,
      intelligence,
      projectId
    });

    return res.status(201).json({
      ok: true,
      chat
    });
  } catch (error) {
    return sendError(res, error, "Unable to create a new chat.");
  }
}
