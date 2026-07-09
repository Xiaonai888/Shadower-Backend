import { getMyAiInstructions } from "../config/myAiRules.js";

const API_ROOT = "https://api.cloudflare.com/client/v4";
const DEFAULT_MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";
const REQUEST_TIMEOUT_MS = 180000;

const MODEL_CATALOG = [
  {
    id: DEFAULT_MODEL,
    label: "Shadower Qwen 30B",
    detail: "Multilingual · Reasoning · Writing"
  }
];

const ALLOWED_MODELS = new Set(MODEL_CATALOG.map((model) => model.id));

function createPublicError(statusCode, publicMessage) {
  const error = new Error(publicMessage);
  error.statusCode = statusCode;
  error.publicMessage = publicMessage;
  return error;
}

function getCredentials() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();

  if (!accountId || !apiToken) {
    throw createPublicError(
      503,
      "Cloudflare Workers AI is not configured in Render."
    );
  }

  return {
    accountId,
    apiToken
  };
}

async function fetchWithTimeout(url, options, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function getGenerationSettings(intelligence) {
  if (intelligence === "instant") {
    return {
      max_tokens: 1000,
      temperature: 0.5,
      top_p: 0.85
    };
  }

  if (intelligence === "medium") {
    return {
      max_tokens: 2600,
      temperature: 0.62,
      top_p: 0.9
    };
  }

  return {
    max_tokens: 5000,
    temperature: 0.68,
    top_p: 0.92
  };
}

function getResponseDepthInstruction(intelligence) {
  if (intelligence === "instant") {
    return [
      "Response mode: Instant.",
      "Answer quickly and directly, but still complete every essential part.",
      "Do not end mid-sentence or omit the main conclusion."
    ].join(" ");
  }

  if (intelligence === "medium") {
    return [
      "Response mode: Medium.",
      "Give a complete, well-explained answer with useful context and clear structure.",
      "For multi-part questions, answer every part before concluding."
    ].join(" ");
  }

  return [
    "Response mode: High.",
    "Give a thorough and fully developed answer.",
    "Cover every important part of the request with enough explanation, examples, or sections when useful.",
    "Do not compress a complex request into a short paragraph.",
    "For long-form writing, continue until the requested section reaches a natural and complete stopping point."
  ].join(" ");
}

function getErrorMessage(payload, fallback) {
  const cloudflareError = Array.isArray(payload?.errors)
    ? payload.errors.find((item) => typeof item?.message === "string")?.message
    : "";

  return (
    cloudflareError ||
    payload?.error ||
    payload?.message ||
    fallback
  );
}

function extractReply(payload) {
  const result = payload?.result ?? payload;

  const candidates = [
    result?.response,
    result?.output_text,
    result?.choices?.[0]?.message?.content,
    result?.choices?.[0]?.text,
    payload?.response,
    payload?.choices?.[0]?.message?.content,
    payload?.choices?.[0]?.text,
    typeof result === "string" ? result : ""
  ];

  return candidates.find(
    (value) => typeof value === "string" && value.trim()
  )?.trim();
}

export function isCloudflareAiConfigured() {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID?.trim() &&
      process.env.CLOUDFLARE_API_TOKEN?.trim()
  );
}

export function getCloudflareModels() {
  return MODEL_CATALOG.map((model) => ({ ...model }));
}

export async function createCloudflareReply({
  message,
  history = [],
  model = DEFAULT_MODEL,
  intelligence = "high"
}) {
  if (!ALLOWED_MODELS.has(model)) {
    throw createPublicError(
      400,
      "The selected My AI model is not supported."
    );
  }

  const { accountId, apiToken } = getCredentials();
  const endpoint = `${API_ROOT}/accounts/${accountId}/ai/run/${model}`;

  try {
    const response = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: getMyAiInstructions()
          },
          {
            role: "system",
            content: getResponseDepthInstruction(intelligence)
          },
          ...history,
          {
            role: "user",
            content: message
          }
        ],
        stream: false,
        ...getGenerationSettings(intelligence),
        repetition_penalty: 1.03
      })
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload?.success === false) {
      const detail = getErrorMessage(
        payload,
        `Cloudflare Workers AI failed with status ${response.status}.`
      );

      if (response.status === 401 || response.status === 403) {
        throw createPublicError(
          503,
          "Cloudflare Workers AI credentials are invalid or lack permission."
        );
      }

      if (response.status === 429) {
        throw createPublicError(
          429,
          "Cloudflare Workers AI usage limit was reached. Try again later."
        );
      }

      console.error("Cloudflare Workers AI request failed", {
        status: response.status,
        detail
      });

      throw createPublicError(
        502,
        "Cloudflare Workers AI could not generate a response."
      );
    }

    const reply = extractReply(payload);

    if (!reply) {
      throw createPublicError(
        502,
        "My AI returned an empty response. Please try again."
      );
    }

    return {
      reply,
      provider: "my-ai",
      model,
      intelligence
    };
  } catch (error) {
    if (error?.publicMessage) {
      throw error;
    }

    if (error?.name === "AbortError") {
      throw createPublicError(
        504,
        "My AI took too long to respond. Try again or use a shorter request."
      );
    }

    console.error("Cloudflare Workers AI connection failed", {
      name: error?.name,
      message: error?.message
    });

    throw createPublicError(
      502,
      "Unable to connect to Cloudflare Workers AI."
    );
  }
}
