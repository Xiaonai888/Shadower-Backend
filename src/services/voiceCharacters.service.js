import { getSupabaseAdmin } from "../config/supabase.js";

const CHARACTER_FIELDS = [
  "id",
  "name",
  "display_name",
  "language",
  "voice_role",
  "linked_story",
  "description",
  "avatar_url",
  "status",
  "sample_count",
  "sample_duration_seconds",
  "created_at",
  "updated_at"
].join(", ");

function createDatabaseError(error, publicMessage) {
  const databaseError = new Error(error?.message || publicMessage);
  databaseError.statusCode = 500;
  databaseError.publicMessage = publicMessage;
  return databaseError;
}

function createNotFoundError() {
  const error = new Error("Voice character not found.");
  error.statusCode = 404;
  error.publicMessage = "Voice character not found.";
  return error;
}

function toVoiceCharacter(row) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    language: row.language,
    voiceRole: row.voice_role,
    linkedStory: row.linked_story,
    description: row.description,
    avatarUrl: row.avatar_url,
    status: row.status,
    sampleCount: row.sample_count,
    sampleDurationSeconds: row.sample_duration_seconds,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function optionalText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function selectCharacterById(characterId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("voice_characters")
    .select(CHARACTER_FIELDS)
    .eq("id", characterId)
    .is("owner_id", null)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw createDatabaseError(error, "Unable to load this voice character.");
  }

  if (!data) {
    throw createNotFoundError();
  }

  return data;
}

export async function listVoiceCharacters({ limit = 100 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("voice_characters")
    .select(CHARACTER_FIELDS)
    .is("owner_id", null)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    throw createDatabaseError(error, "Unable to load voice characters.");
  }

  return (data ?? []).map(toVoiceCharacter);
}

export async function getVoiceCharacter(characterId) {
  const character = await selectCharacterById(characterId);
  return toVoiceCharacter(character);
}

export async function createVoiceCharacter({
  name,
  displayName,
  language,
  voiceRole,
  linkedStory,
  description,
  avatarUrl
}) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("voice_characters")
    .insert({
      owner_id: null,
      name: name.trim(),
      display_name: optionalText(displayName),
      language: language.trim(),
      voice_role: voiceRole.trim(),
      linked_story: optionalText(linkedStory),
      description: optionalText(description),
      avatar_url: optionalText(avatarUrl),
      status: "no-samples"
    })
    .select(CHARACTER_FIELDS)
    .single();

  if (error) {
    throw createDatabaseError(error, "Unable to create this voice character.");
  }

  return toVoiceCharacter(data);
}

export async function updateVoiceCharacter(characterId, changes) {
  const updates = {};

  if (changes.name !== undefined) {
    updates.name = changes.name.trim();
  }

  if (changes.displayName !== undefined) {
    updates.display_name = optionalText(changes.displayName);
  }

  if (changes.language !== undefined) {
    updates.language = changes.language.trim();
  }

  if (changes.voiceRole !== undefined) {
    updates.voice_role = changes.voiceRole.trim();
  }

  if (changes.linkedStory !== undefined) {
    updates.linked_story = optionalText(changes.linkedStory);
  }

  if (changes.description !== undefined) {
    updates.description = optionalText(changes.description);
  }

  if (changes.avatarUrl !== undefined) {
    updates.avatar_url = optionalText(changes.avatarUrl);
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("voice_characters")
    .update(updates)
    .eq("id", characterId)
    .is("owner_id", null)
    .is("deleted_at", null)
    .select(CHARACTER_FIELDS)
    .maybeSingle();

  if (error) {
    throw createDatabaseError(error, "Unable to update this voice character.");
  }

  if (!data) {
    throw createNotFoundError();
  }

  return toVoiceCharacter(data);
}

export async function deleteVoiceCharacter(characterId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("voice_characters")
    .update({
      deleted_at: new Date().toISOString()
    })
    .eq("id", characterId)
    .is("owner_id", null)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    throw createDatabaseError(error, "Unable to delete this voice character.");
  }

  if (!data) {
    throw createNotFoundError();
  }

  return data.id;
}
