import { getSupabaseAdmin } from "../config/supabase.js";

const ALLOWED_ROLES = new Set(["user", "assistant", "system"]);

function createDatabaseError(error, publicMessage) {
  const databaseError = new Error(error?.message || publicMessage);
  databaseError.statusCode = 500;
  databaseError.publicMessage = publicMessage;
  return databaseError;
}

function getMessageSelectFields() {
  return [
    "id",
    "chat_id",
    "role",
    "content",
    "model",
    "intelligence",
    "metadata",
    "edited_at",
    "created_at"
  ].join(", ");
}

function normalizeMessage(message) {
  if (
    !message ||
    !ALLOWED_ROLES.has(message.role) ||
    typeof message.content !== "string" ||
    !message.content.trim()
  ) {
    return null;
  }

  return {
    role: message.role,
    content: message.content.trim(),
    model:
      typeof message.model === "string" && message.model.trim()
        ? message.model.trim()
        : null,
    intelligence:
      typeof message.intelligence === "string" && message.intelligence.trim()
        ? message.intelligence.trim()
        : null,
    metadata:
      message.metadata && typeof message.metadata === "object"
        ? message.metadata
        : {}
  };
}

export async function listChatMessages({ chatId, limit = 200 }) {
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("ai_messages")
    .select(getMessageSelectFields())
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .limit(safeLimit);

  if (error) {
    throw createDatabaseError(error, "Unable to load chat messages.");
  }

  return data ?? [];
}

export async function addChatMessages({ chatId, messages }) {
  const rows = Array.isArray(messages)
    ? messages.map(normalizeMessage).filter(Boolean)
    : [];

  if (!rows.length) {
    return [];
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("ai_messages")
    .insert(rows.map((message) => ({ ...message, chat_id: chatId })))
    .select(getMessageSelectFields());

  if (error) {
    throw createDatabaseError(error, "Unable to save chat messages.");
  }

  await supabase
    .from("ai_chats")
    .update({
      updated_at: new Date().toISOString()
    })
    .eq("id", chatId)
    .is("owner_id", null)
    .is("deleted_at", null);

  return data ?? [];
}
