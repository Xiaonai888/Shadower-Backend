import { getSupabaseAdmin } from "../config/supabase.js";

const FEEDBACK_SELECT = [
  "id",
  "chat_id",
  "message_id",
  "prompt_message_id",
  "rating",
  "error_type",
  "correction_text",
  "accepted_answer",
  "prompt_snapshot",
  "answer_snapshot",
  "task_type",
  "model_version",
  "intelligence",
  "metadata",
  "created_at",
  "updated_at"
].join(", ");

function createDatabaseError(error, publicMessage, statusCode = 500) {
  const databaseError = new Error(error?.message || publicMessage);
  databaseError.statusCode = statusCode;
  databaseError.publicMessage = publicMessage;
  return databaseError;
}

async function getAssistantMessage({ chatId, messageId }) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("ai_messages")
    .select(
      "id, chat_id, role, content, model, intelligence, metadata, created_at"
    )
    .eq("id", messageId)
    .eq("chat_id", chatId)
    .maybeSingle();

  if (error) {
    throw createDatabaseError(
      error,
      "Unable to verify the selected answer."
    );
  }

  if (!data) {
    throw createDatabaseError(
      null,
      "The selected assistant answer was not found.",
      404
    );
  }

  if (data.role !== "assistant") {
    throw createDatabaseError(
      null,
      "Feedback can only be attached to an assistant answer.",
      400
    );
  }

  return data;
}

async function getPreviousUserMessage({ chatId, createdAt }) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("ai_messages")
    .select("id, content")
    .eq("chat_id", chatId)
    .eq("role", "user")
    .lte("created_at", createdAt)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw createDatabaseError(
      error,
      "Unable to link feedback to the original question."
    );
  }

  return data ?? null;
}

export async function saveMessageFeedback({
  chatId,
  messageId,
  rating,
  errorType = null,
  correctionText = null,
  acceptedAnswer = null,
  taskType = null,
  modelVersion = null,
  metadata = {}
}) {
  const assistantMessage = await getAssistantMessage({
    chatId,
    messageId
  });
  const promptMessage = await getPreviousUserMessage({
    chatId,
    createdAt: assistantMessage.created_at
  });
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const row = {
    chat_id: chatId,
    message_id: messageId,
    prompt_message_id: promptMessage?.id ?? null,
    rating,
    error_type: errorType,
    correction_text: correctionText,
    accepted_answer: acceptedAnswer,
    prompt_snapshot: promptMessage?.content ?? null,
    answer_snapshot: assistantMessage.content,
    task_type:
      taskType ||
      assistantMessage.metadata?.requestKind ||
      assistantMessage.metadata?.intent ||
      null,
    model_version: modelVersion || assistantMessage.model || null,
    intelligence: assistantMessage.intelligence || null,
    metadata,
    updated_at: now
  };

  const { data, error } = await supabase
    .from("ai_message_feedback")
    .upsert(row, {
      onConflict: "message_id"
    })
    .select(FEEDBACK_SELECT)
    .single();

  if (error) {
    throw createDatabaseError(error, "Unable to save this feedback.");
  }

  return data;
}

export async function getMessageFeedback(messageId) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("ai_message_feedback")
    .select(FEEDBACK_SELECT)
    .eq("message_id", messageId)
    .maybeSingle();

  if (error) {
    throw createDatabaseError(error, "Unable to load this feedback.");
  }

  return data ?? null;
}

export async function updateMessageFeedback(feedbackId, changes) {
  const supabase = getSupabaseAdmin();
  const row = {
    ...changes,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("ai_message_feedback")
    .update(row)
    .eq("id", feedbackId)
    .select(FEEDBACK_SELECT)
    .maybeSingle();

  if (error) {
    throw createDatabaseError(error, "Unable to update this feedback.");
  }

  if (!data) {
    throw createDatabaseError(null, "Feedback was not found.", 404);
  }

  return data;
}
