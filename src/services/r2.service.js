import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2BucketName, getR2Client } from "../config/r2.js";

const UPLOAD_URL_SECONDS = 15 * 60;
const PLAY_URL_SECONDS = 60 * 60;
const AVATAR_URL_SECONDS = 6 * 60 * 60;

export async function createR2UploadUrl({ storageKey, mimeType }) {
  const command = new PutObjectCommand({
    Bucket: getR2BucketName(),
    Key: storageKey,
    ContentType: mimeType
  });

  const url = await getSignedUrl(getR2Client(), command, {
    expiresIn: UPLOAD_URL_SECONDS
  });

  return {
    url,
    method: "PUT",
    expiresIn: UPLOAD_URL_SECONDS,
    headers: { "Content-Type": mimeType }
  };
}

export async function getR2ObjectMetadata(storageKey) {
  return getR2Client().send(
    new HeadObjectCommand({
      Bucket: getR2BucketName(),
      Key: storageKey
    })
  );
}

export async function createR2ReadUrl(
  storageKey,
  expiresIn = AVATAR_URL_SECONDS
) {
  const command = new GetObjectCommand({
    Bucket: getR2BucketName(),
    Key: storageKey
  });

  return getSignedUrl(getR2Client(), command, { expiresIn });
}

export async function deleteR2Object(storageKey) {
  if (!storageKey) return;

  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: getR2BucketName(),
      Key: storageKey
    })
  );
}

export function createVoiceUploadUrl(options) {
  return createR2UploadUrl(options);
}

export function getVoiceObjectMetadata(storageKey) {
  return getR2ObjectMetadata(storageKey);
}

export function createVoicePlayUrl(storageKey) {
  return createR2ReadUrl(storageKey, PLAY_URL_SECONDS);
}

export function deleteVoiceObject(storageKey) {
  return deleteR2Object(storageKey);
}

export function cleanEtag(etag) {
  return typeof etag === "string" ? etag.replaceAll('"', "") : null;
}

export const voicePlayUrlSeconds = PLAY_URL_SECONDS;
export const avatarReadUrlSeconds = AVATAR_URL_SECONDS;
