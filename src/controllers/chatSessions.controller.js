import {
  createChatSession as createChatSessionRecord,
  deleteChatSession as deleteChatSessionRecord,
  listChatSessions,
  updateChatSession as updateChatSessionRecord
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

function isValidUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value.trim());
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

  if (
    title !== undefined &&
    (typeof title !== "string" ||
      !title.trim() ||
      title.trim().length > 160)
  ) {
    return res.status(400).json({
      ok: false,
      message: "Chat title must contain 1 to 160 characters."
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
    !isValidUuid(projectId)
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

export async function updateChatSession(req, res) {
  const { id } = req.params;
  const { title, projectId, isPinned, isArchived } = req.body ?? {};

  if (!isValidUuid(id)) {
    return res.status(400).json({
      ok: false,
      message: "Invalid chat ID."
    });
  }

  if (
    title !== undefined &&
    (typeof title !== "string" ||
      !title.trim() ||
      title.trim().length > 160)
  ) {
    return res.status(400).json({
      ok: false,
      message: "Chat title must contain 1 to 160 characters."
    });
  }

  if (
    projectId !== undefined &&
    projectId !== null &&
    !isValidUuid(projectId)
  ) {
    return res.status(400).json({
      ok: false,
      message: "Invalid project ID."
    });
  }

  if (isPinned !== undefined && typeof isPinned !== "boolean") {
    return res.status(400).json({
      ok: false,
      message: "isPinned must be true or false."
    });
  }

  if (isArchived !== undefined && typeof isArchived !== "boolean") {
    return res.status(400).json({
      ok: false,
      message: "isArchived must be true or false."
    });
  }

  if (
    title === undefined &&
    projectId === undefined &&
    isPinned === undefined &&
    isArchived === undefined
  ) {
    return res.status(400).json({
      ok: false,
      message: "No chat changes were provided."
    });
  }

  try {
    const chat = await updateChatSessionRecord({
      chatId: id,
      title,
      projectId,
      isPinned,
      isArchived
    });

    return res.status(200).json({
      ok: true,
      chat
    });
  } catch (error) {
    return sendError(res, error, "Unable to update this chat.");
  }
}

export async function deleteChatSession(req, res) {
  const { id } = req.params;

  if (!isValidUuid(id)) {
    return res.status(400).json({
      ok: false,
      message: "Invalid chat ID."
    });
  }

  try {
    const deletedChat = await deleteChatSessionRecord(id);

    return res.status(200).json({
      ok: true,
      deletedChatId: deletedChat.id
    });
  } catch (error) {
    return sendError(res, error, "Unable to delete this chat.");
  }
}
