import { S3Client } from "@aws-sdk/client-s3";

let r2Client = null;

function getR2Credentials() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucketName = process.env.R2_BUCKET_NAME?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    const error = new Error("Cloudflare R2 is not configured.");
    error.statusCode = 503;
    error.publicMessage = "Cloudflare R2 is not configured in Render.";
    throw error;
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName };
}

export function getR2Client() {
  if (r2Client) return r2Client;

  const { accountId, accessKeyId, secretAccessKey } = getR2Credentials();
  r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED"
  });

  return r2Client;
}

export function getR2BucketName() {
  return getR2Credentials().bucketName;
}
