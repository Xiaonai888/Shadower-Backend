import { getSupabaseAdmin } from "../config/supabase.js";

function createDatabaseError(error, publicMessage) {
  const databaseError = new Error(error?.message || publicMessage);
  databaseError.statusCode = 500;
  databaseError.publicMessage = publicMessage;
  return databaseError;
}

export async function listProjects({ limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("ai_projects")
    .select("*")
    .limit(safeLimit);

  if (error) {
    throw createDatabaseError(error, "Unable to load story projects.");
  }

  return data ?? [];
}
