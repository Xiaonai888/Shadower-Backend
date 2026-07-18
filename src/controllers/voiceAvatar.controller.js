import { randomUUID } from "node:crypto";
import {
  createR2UploadUrl,
  deleteR2Object,
  getR2ObjectMetadata
} from "../services/r2.service.js";
import {
  clearVoiceCharacterAvatar,
  getVoiceCharacter,
  setVoiceCharacterAvatar
} from "../services/voiceCharacters.service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Map([
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"]
]);

function sendError(res, error, fallbackMessage) {
  console.error("Voice avatar request failed", {
    name: error?.name,
    statusCode: error?.statusCode,
    message: error?.message
  });

  return res.status(error?.statusCode || 500).json({
    ok: false,
    message: error?.publicMessage || fallbackMessage
  });
}

function normalizeMimeType(value) {
  return typeof value === "string"
    ? value.split(";", 1)[0].trim().toLowerCase()
    : "";
}

function validCharacterId(value) {
  return typeof value === "string" && UUID_PATTERN.test(value.trim());
}

function validStorageKey(characterId, storageKey) {
  return (
    typeof storageKey === "string" &&
    storageKey.startsWith(`voice-avatars/${characterId}/`) &&
    !storageKey.includes("..")
  );
}

export async function requestVoiceAvatarUpload(req, res) {
  const { id } = req.params;
  const body = req.body ?? {};

  if (!validCharacterId(id)) {
    return res.status(400).json({ ok: false, message: "Invalid character ID." });
  }

  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  const mimeType = normalizeMimeType(body.mimeType);
  const fileSizeBytes = Number(body.fileSizeBytes);

  if (!fileName || fileName.length > 255) {
    return res.status(400).json({
      ok: false,
      message: "Profile image filename must contain 1 to 255 characters."
    });
  }

  if (!IMAGE_EXTENSIONS.has(mimeType)) {
    return res.status(400).json({
      ok: false,
      message: "Use a JPG, PNG, or WEBP profile image."
    });
  }

  if (
    !Number.isInteger(fileSizeBytes) ||
    fileSizeBytes < 1 ||
    fileSizeBytes > MAX_AVATAR_BYTES
  ) {
    return res.status(400).json({
      ok: false,
      message: "Profile image must be between 1 byte and 5 MB."
    });
  }

  try {
    await getVoiceCharacter(id);
    const storageKey = `voice-avatars/${id}/${randomUUID()}.${IMAGE_EXTENSIONS.get(mimeType)}`;
    const upload = await createR2UploadUrl({ storageKey, mimeType });

    return res.status(201).json({
      ok: true,
      avatar: { storageKey, mimeType, fileSizeBytes },
      upload
    });
  } catch (error) {
    return sendError(res, error, "Unable to prepare this profile image upload.");
  }
}

export async function completeVoiceAvatarUpload(req, res) {
  const { id } = req.params;
  const body = req.body ?? {};

  if (!validCharacterId(id)) {
    return res.status(400).json({ ok: false, message: "Invalid character ID." });
  }

  const storageKey =
    typeof body.storageKey === "string" ? body.storageKey.trim() : "";
  const mimeType = normalizeMimeType(body.mimeType);
  const fileSizeBytes = Number(body.fileSizeBytes);

  if (
    !validStorageKey(id, storageKey) ||
    !IMAGE_EXTENSIONS.has(mimeType) ||
    !Number.isInteger(fileSizeBytes) ||
    fileSizeBytes < 1 ||
    fileSizeBytes > MAX_AVATAR_BYTES
  ) {
    return res.status(400).json({
      ok: false,
      message: "Profile image upload details are invalid."
    });
  }

  let saved = false;

  try {
    const object = await getR2ObjectMetadata(storageKey);
    const uploadedBytes = Number(object.ContentLength);
    const uploadedType = normalizeMimeType(object.ContentType);

    if (uploadedBytes !== fileSizeBytes) {
      await deleteR2Object(storageKey);
      return res.status(400).json({
        ok: false,
        message: "Uploaded profile image size did not match the selected file."
      });
    }

    if (uploadedType && uploadedType !== mimeType) {
      await deleteR2Object(storageKey);
      return res.status(400).json({
        ok: false,
        message: "Uploaded profile image type did not match the selected file."
      });
    }

    const result = await setVoiceCharacterAvatar(id, {
      storageKey,
      mimeType,
      fileSizeBytes
    });
    saved = true;

    if (
      result.previousStorageKey &&
      result.previousStorageKey !== storageKey
    ) {
      deleteR2Object(result.previousStorageKey).catch(() => {});
    }

    return res.status(200).json({
      ok: true,
      character: result.character
    });
  } catch (error) {
    if (!saved && validStorageKey(id, storageKey)) {
      deleteR2Object(storageKey).catch(() => {});
    }

    return sendError(res, error, "Unable to save this profile image.");
  }
}

export async function deleteVoiceAvatar(req, res) {
  const { id } = req.params;

  if (!validCharacterId(id)) {
    return res.status(400).json({ ok: false, message: "Invalid character ID." });
  }

  try {
    const result = await clearVoiceCharacterAvatar(id);

    if (result.previousStorageKey) {
      deleteR2Object(result.previousStorageKey).catch(() => {});
    }

    return res.status(200).json({
      ok: true,
      character: result.character
    });
  } catch (error) {
    return sendError(res, error, "Unable to remove this profile image.");
  }
}
