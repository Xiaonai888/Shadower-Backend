import { getSupabaseAdmin } from "../config/supabase.js";

const DEFAULT_MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";
const ALLOWED_INTELLIGENCE = new Set(["instant", "medium", "high"]);

function createDatabaseError(error, publicMessage) {
  const databaseError = new Error(error?.message || publicMessage);
  databaseError.statusCode = 500;
  databaseError.publicMessage = publicMessage;
  return databaseError;
}

export async function listChatSessions({ limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("ai_chats")
    .select(
      "id, project_id, title, model, intelligence, is_pinned, is_archived, created_at, updated_at"
    )
    .is("owner_id", null)
    .is("deleted_at", null)
    .eq("is_archived", false)
    .order("is_pinned", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    throw createDatabaseError(error, "Unable to load chat sessions.");
  }

  return data ?? [];
}

export async function createChatSession({
  title = "New Chat",
  model = DEFAULT_MODEL,
  intelligence = "high",
  projectId = null
} = {}) {
  const cleanTitle =
    typeof title === "string" && title.trim()
      ? title.trim().slice(0, 160)
      : "New Chat";

  const cleanModel =
    typeof model === "string" && model.trim()
      ? model.trim().slice(0, 160)
      : DEFAULT_MODEL;

  const cleanIntelligence = ALLOWED_INTELLIGENCE.has(intelligence)
    ? intelligence
    : "high";

  const cleanProjectId =
    typeof projectId === "string" && projectId.trim()
      ? projectId.trim()
      : null;

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("ai_chats")
    .insert({
      owner_id: null,
      project_id: cleanProjectId,
      title: cleanTitle,
      model: cleanModel,
      intelligence: cleanIntelligence
    })
    .select(
      "id, project_id, title, model, intelligence, is_pinned, is_archived, created_at, updated_at"
    )
    .single();

  if (error) {
    throw createDatabaseError(error, "Unable to create a new chat.");
  }

  return data;
}
