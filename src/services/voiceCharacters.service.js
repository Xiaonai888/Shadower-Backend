import { getSupabaseAdmin } from "../config/supabase.js";
import { createR2ReadUrl } from "./r2.service.js";

const CHARACTER_FIELDS = [
  "id",
  "name",
  "display_name",
  "language",
  "voice_role",
  "linked_story",
  "description",
  "avatar_url",
  "avatar_storage_key",
  "avatar_mime_type",
  "avatar_file_size_bytes",
  "avatar_updated_at",
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

async function getAvatarUrl(row) {
  if (!row?.avatar_storage_key) return row?.avatar_url || null;

  try {
    return await createR2ReadUrl(row.avatar_storage_key);
  } catch {
    return row.avatar_url || null;
  }
}

async function toVoiceCharacter(row) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    language: row.language,
    voiceRole: row.voice_role,
    linkedStory: row.linked_story,
    description: row.description,
    avatarUrl: await getAvatarUrl(row),
    hasAvatar: Boolean(row.avatar_storage_key || row.avatar_url),
    avatarMimeType: row.avatar_mime_type,
    avatarFileSizeBytes: Number(row.avatar_file_size_bytes) || 0,
    avatarUpdatedAt: row.avatar_updated_at,
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

  if (!data) throw createNotFoundError();
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

  return Promise.all((data ?? []).map(toVoiceCharacter));
}

export async function getVoiceCharacter(characterId) {
  return toVoiceCharacter(await selectCharacterById(characterId));
}

export async function getVoiceCharacterAvatarStorageKey(characterId) {
  const character = await selectCharacterById(characterId);
  return character.avatar_storage_key || null;
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

  if (changes.name !== undefined) updates.name = changes.name.trim();
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

  if (!data) throw createNotFoundError();
  return toVoiceCharacter(data);
}

export async function setVoiceCharacterAvatar(
  characterId,
  { storageKey, mimeType, fileSizeBytes }
) {
  const current = await selectCharacterById(characterId);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("voice_characters")
    .update({
      avatar_url: null,
      avatar_storage_key: storageKey,
      avatar_mime_type: mimeType,
      avatar_file_size_bytes: fileSizeBytes,
      avatar_updated_at: new Date().toISOString()
    })
    .eq("id", characterId)
    .is("owner_id", null)
    .is("deleted_at", null)
    .select(CHARACTER_FIELDS)
    .maybeSingle();

  if (error) {
    throw createDatabaseError(error, "Unable to save this profile image.");
  }

  if (!data) throw createNotFoundError();

  return {
    character: await toVoiceCharacter(data),
    previousStorageKey: current.avatar_storage_key || null
  };
}

export async function clearVoiceCharacterAvatar(characterId) {
  const current = await selectCharacterById(characterId);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("voice_characters")
    .update({
      avatar_url: null,
      avatar_storage_key: null,
      avatar_mime_type: null,
      avatar_file_size_bytes: null,
      avatar_updated_at: new Date().toISOString()
    })
    .eq("id", characterId)
    .is("owner_id", null)
    .is("deleted_at", null)
    .select(CHARACTER_FIELDS)
    .maybeSingle();

  if (error) {
    throw createDatabaseError(error, "Unable to remove this profile image.");
  }

  if (!data) throw createNotFoundError();

  return {
    character: await toVoiceCharacter(data),
    previousStorageKey: current.avatar_storage_key || null
  };
}

export async function deleteVoiceCharacter(characterId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("voice_characters")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", characterId)
    .is("owner_id", null)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    throw createDatabaseError(error, "Unable to delete this voice character.");
  }

  if (!data) throw createNotFoundError();
  return data.id;
}
