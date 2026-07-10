import { getSupabaseAdmin } from "../config/supabase.js";
import { createMemorySnapshot } from "./chatMemoryModel.service.js";

const INITIAL_MEMORY_MESSAGE_COUNT = 8;
const MEMORY_REFRESH_STEP = 12;
const MEMORY_TRANSCRIPT_LIMIT = 40;
const MEMORY_MESSAGE_CHARACTER_LIMIT = 1800;

function createDatabaseError(error, publicMessage) {
  const databaseError = new Error(error?.message || publicMessage);
  databaseError.statusCode = 500;
  databaseError.publicMessage = publicMessage;
  return databaseError;
}

export async function getChatMemory(chatId) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("ai_chat_memories")
    .select(
      [
        "chat_id",
        "summary",
        "important_facts",
        "user_preferences",
        "story_facts",
        "message_count",
        "last_message_id",
        "updated_at"
      ].join(", ")
    )
    .eq("chat_id", chatId)
    .maybeSingle();

  if (error) {
    throw createDatabaseError(error, "Unable to load chat memory.");
  }

  return data ?? null;
}

async function loadMemoryTranscript(chatId) {
  const supabase = getSupabaseAdmin();

  const [countResult, messagesResult] = await Promise.all([
    supabase
      .from("ai_messages")
      .select("id", { count: "exact", head: true })
      .eq("chat_id", chatId),
    supabase
      .from("ai_messages")
      .select("id, role, content, created_at")
      .eq("chat_id", chatId)
      .in("role", ["user", "assistant"])
      .order("created_at", { ascending: false })
      .limit(MEMORY_TRANSCRIPT_LIMIT)
  ]);

  if (countResult.error || messagesResult.error) {
    throw createDatabaseError(
      countResult.error || messagesResult.error,
      "Unable to prepare chat memory."
    );
  }

  const messages = (messagesResult.data ?? []).reverse();

  return {
    count: countResult.count ?? messages.length,
    lastMessageId: messages.at(-1)?.id ?? null,
    transcript: messages.map((message) => ({
      role: message.role,
      content:
        typeof message.content === "string"
          ? message.content
              .trim()
              .slice(0, MEMORY_MESSAGE_CHARACTER_LIMIT)
          : ""
    }))
  };
}

function shouldRefreshMemory(memory, messageCount) {
  if (messageCount < INITIAL_MEMORY_MESSAGE_COUNT) {
    return false;
  }

  if (!memory) {
    return true;
  }

  return messageCount - Number(memory.message_count || 0) >=
    MEMORY_REFRESH_STEP;
}

export async function refreshChatMemory(chatId) {
  const [memory, snapshot] = await Promise.all([
    getChatMemory(chatId),
    loadMemoryTranscript(chatId)
  ]);

  if (!shouldRefreshMemory(memory, snapshot.count)) {
    return {
      refreshed: false,
      memory
    };
  }

  const generated = await createMemorySnapshot({
    currentMemory: memory
      ? {
          summary: memory.summary,
          importantFacts: memory.important_facts,
          userPreferences: memory.user_preferences,
          storyFacts: memory.story_facts
        }
      : null,
    transcript: snapshot.transcript
  });

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("ai_chat_memories")
    .upsert(
      {
        chat_id: chatId,
        summary: generated.summary,
        important_facts: generated.importantFacts,
        user_preferences: generated.userPreferences,
        story_facts: generated.storyFacts,
        message_count: snapshot.count,
        last_message_id: snapshot.lastMessageId,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "chat_id"
      }
    )
    .select(
      [
        "chat_id",
        "summary",
        "important_facts",
        "user_preferences",
        "story_facts",
        "message_count",
        "last_message_id",
        "updated_at"
      ].join(", ")
    )
    .single();

  if (error) {
    throw createDatabaseError(error, "Unable to save chat memory.");
  }

  return {
    refreshed: true,
    memory: data
  };
}
