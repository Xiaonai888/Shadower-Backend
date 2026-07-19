import {
  createVoicePlayUrl
} from "../services/r2.service.js";
import {
  getVoiceSample,
  listVoiceSamples
} from "../services/voiceSamples.service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VOICE_ENGINE_URL =
  process.env.VOICE_ENGINE_URL?.trim() || "http://127.0.0.1:8100";
const MAX_TEXT_LENGTH = 250;
const ENGINE_TIMEOUT_MS = 10 * 60 * 1000;

function sendError(res, error, fallbackMessage) {
  console.error("Voice generation failed", {
    name: error?.name,
    statusCode: error?.statusCode,
    message: error?.message
  });

  return res.status(error?.statusCode || 500).json({
    ok: false,
    message: error?.publicMessage || error?.message || fallbackMessage
  });
}

function isValidUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value.trim());
}

async function selectReferenceSample(characterId, requestedSampleId) {
  if (requestedSampleId) {
    if (!isValidUuid(requestedSampleId)) {
      const error = new Error("Invalid voice sample ID.");
      error.statusCode = 400;
      throw error;
    }

    const sample = await getVoiceSample(characterId, requestedSampleId);

    if (sample.status !== "ready") {
      const error = new Error("The selected voice sample is not ready.");
      error.statusCode = 409;
      throw error;
    }

    return sample;
  }

  const samples = await listVoiceSamples(characterId, { limit: 200 });
  const sample =
    samples.find(
      (item) => item.status === "ready" && item.includeInTraining
    ) || samples.find((item) => item.status === "ready");

  if (!sample) {
    const error = new Error(
      "This character has no ready voice sample. Add a sample first."
    );
    error.statusCode = 409;
    throw error;
  }

  return getVoiceSample(characterId, sample.id);
}

async function fetchReferenceAudio(sample) {
  const signedUrl = await createVoicePlayUrl(sample.storageKey);
  const response = await fetch(signedUrl);

  if (!response.ok) {
    const error = new Error(
      `Unable to read the reference voice from Cloudflare R2 (${response.status}).`
    );
    error.statusCode = 502;
    throw error;
  }

  return response.arrayBuffer();
}

async function callKhmerEngine({ referenceAudio, sample, text }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ENGINE_TIMEOUT_MS);
  const form = new FormData();

  form.append("text", text);
  form.append(
    "reference_audio",
    new Blob([referenceAudio], {
      type: sample.mimeType || "audio/ogg"
    }),
    sample.originalName || "reference.ogg"
  );

  try {
    const response = await fetch(`${VOICE_ENGINE_URL}/generate`, {
      method: "POST",
      body: form,
      signal: controller.signal
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const error = new Error(
        data.detail || data.message || `Khmer voice engine failed (${response.status}).`
      );
      error.statusCode = response.status >= 400 && response.status < 500
        ? response.status
        : 502;
      throw error;
    }

    return response.arrayBuffer();
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error(
        "Khmer voice generation took too long. Please retry with shorter text."
      );
      timeoutError.statusCode = 504;
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getVoiceEngineHealth(req, res) {
  try {
    const response = await fetch(`${VOICE_ENGINE_URL}/health`);
    const data = await response.json().catch(() => ({}));

    return res.status(response.ok ? 200 : 503).json({
      ok: response.ok,
      engine: data
    });
  } catch (error) {
    return res.status(503).json({
      ok: false,
      message: "Khmer voice engine is not running."
    });
  }
}

export async function generateKhmerVoice(req, res) {
  const body = req.body ?? {};
  const characterId =
    typeof body.characterId === "string" ? body.characterId.trim() : "";
  const sampleId =
    typeof body.sampleId === "string" ? body.sampleId.trim() : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";

  if (!isValidUuid(characterId)) {
    return res.status(400).json({
      ok: false,
      message: "Invalid character ID."
    });
  }

  if (!text) {
    return res.status(400).json({
      ok: false,
      message: "Khmer text is required."
    });
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({
      ok: false,
      message: `For the first test, use no more than ${MAX_TEXT_LENGTH} characters.`
    });
  }

  try {
    const sample = await selectReferenceSample(characterId, sampleId);
    const referenceAudio = await fetchReferenceAudio(sample);
    const generatedAudio = await callKhmerEngine({
      referenceAudio,
      sample,
      text
    });

    res.setHeader("Content-Type", "audio/wav");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="shadower-khmer-voice.wav"'
    );
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Reference-Sample-Id", sample.id);

    return res.status(200).send(Buffer.from(generatedAudio));
  } catch (error) {
    return sendError(res, error, "Unable to generate Khmer voice.");
  }
}
