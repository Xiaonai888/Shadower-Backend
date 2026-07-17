import { getMyAiInstructions } from "../config/myAiRules.js";
import { detectChatIntent } from "./chatIntent.service.js";

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
const ALLOWED_INTENTS = new Set([
  "normal_chat",
  "write_story",
  "continue_story",
  "rewrite",
  "summarize",
  "translate",
  "create_character",
  "create_outline",
  "check_continuity",
  "question_about_story"
]);

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

function getSummaryGenerationSettings(intelligence) {
  if (intelligence === "instant") {
    return {
      max_tokens: 450,
      temperature: 0.2,
      top_p: 0.72
    };
  }

  if (intelligence === "medium") {
    return {
      max_tokens: 800,
      temperature: 0.25,
      top_p: 0.78
    };
  }

  return {
    max_tokens: 1200,
    temperature: 0.28,
    top_p: 0.82
  };
}

function getStoryGenerationSettings(intelligence) {
  if (intelligence === "instant") {
    return {
      max_tokens: 1800,
      temperature: 0.58,
      top_p: 0.88
    };
  }

  if (intelligence === "medium") {
    return {
      max_tokens: 3600,
      temperature: 0.64,
      top_p: 0.91
    };
  }

  return {
    max_tokens: 6000,
    temperature: 0.68,
    top_p: 0.93
  };
}

function getPrecisionGenerationSettings(intelligence) {
  if (intelligence === "instant") {
    return {
      max_tokens: 1000,
      temperature: 0.18,
      top_p: 0.72
    };
  }

  if (intelligence === "medium") {
    return {
      max_tokens: 2200,
      temperature: 0.24,
      top_p: 0.78
    };
  }

  return {
    max_tokens: 3800,
    temperature: 0.3,
    top_p: 0.82
  };
}

function getRewriteGenerationSettings(intelligence) {
  if (intelligence === "instant") {
    return {
      max_tokens: 1200,
      temperature: 0.38,
      top_p: 0.82
    };
  }

  if (intelligence === "medium") {
    return {
      max_tokens: 2800,
      temperature: 0.46,
      top_p: 0.86
    };
  }

  return {
    max_tokens: 5000,
    temperature: 0.52,
    top_p: 0.9
  };
}

function getTranslationGenerationSettings(intelligence) {
  if (intelligence === "instant") {
    return {
      max_tokens: 1200,
      temperature: 0.12,
      top_p: 0.68
    };
  }

  if (intelligence === "medium") {
    return {
      max_tokens: 2800,
      temperature: 0.16,
      top_p: 0.72
    };
  }

  return {
    max_tokens: 5000,
    temperature: 0.2,
    top_p: 0.76
  };
}

function getDefaultGenerationSettings(intelligence) {
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
      temperature: 0.58,
      top_p: 0.88
    };
  }

  return {
    max_tokens: 5000,
    temperature: 0.62,
    top_p: 0.9
  };
}

function getGenerationSettings(intelligence, intent) {
  if (intent === "summarize") {
    return getSummaryGenerationSettings(intelligence);
  }

  if (intent === "write_story" || intent === "continue_story") {
    return getStoryGenerationSettings(intelligence);
  }

  if (
    intent === "check_continuity" ||
    intent === "question_about_story"
  ) {
    return getPrecisionGenerationSettings(intelligence);
  }

  if (intent === "rewrite") {
    return getRewriteGenerationSettings(intelligence);
  }

  if (intent === "translate") {
    return getTranslationGenerationSettings(intelligence);
  }

  return getDefaultGenerationSettings(intelligence);
}

function getTaskInstruction(intent) {
  if (intent === "summarize") {
    return [
      "Task mode: Summary.",
      "Produce a selective condensed result instead of repeating or rewriting the source.",
      "Retain only high-value events, facts, decisions, causes, outcomes, and unresolved points.",
      "Target roughly 15 to 25 percent of the source length unless the user requests another size.",
      "Do not copy long passages or narrate every scene."
    ].join(" ");
  }

  if (intent === "write_story" || intent === "continue_story") {
    return [
      "Task mode: Fiction writing.",
      "Follow the supplied fiction execution plan and all must-not-change constraints.",
      "Write polished prose, not planning notes or a recap.",
      "For continuation, start immediately after the latest established ending without repeating prior material.",
      "Preserve point of view, character knowledge, timeline, location, physical state, accessibility, relationships, objects, and unresolved threads.",
      "Do not invent protected facts."
    ].join(" ");
  }

  if (intent === "check_continuity") {
    return [
      "Task mode: Continuity review.",
      "Diagnose contradictions and logic problems before suggesting changes.",
      "Separate confirmed evidence from inference.",
      "For every issue, state severity and the smallest safe correction.",
      "Do not rewrite unaffected material."
    ].join(" ");
  }

  if (intent === "question_about_story") {
    return [
      "Task mode: Story question.",
      "Answer from supplied story context only.",
      "Clearly separate confirmed canon, reasonable inference, and unknown information.",
      "Do not fill missing facts with invention."
    ].join(" ");
  }

  if (intent === "rewrite") {
    return [
      "Task mode: Rewrite.",
      "Change only the requested material and problem.",
      "Preserve names, meaning, chronology, point of view, characterization, and protected constraints.",
      "Do not replace unrelated content."
    ].join(" ");
  }

  if (intent === "translate") {
    return [
      "Task mode: Translation.",
      "Translate faithfully without adding new content.",
      "Preserve names, formatting, tone, chronology, and intentional ambiguity."
    ].join(" ");
  }

  return [
    "Task mode: General.",
    "Answer the newest request directly and completely.",
    "Do not substitute a related or easier task.",
    "State uncertainty when required information is missing."
  ].join(" ");
}

function getDepthInstruction(intelligence) {
  if (intelligence === "instant") {
    return [
      "Response depth: Instant.",
      "Answer directly and complete every essential part.",
      "Do not end mid-sentence or omit the main conclusion."
    ].join(" ");
  }

  if (intelligence === "medium") {
    return [
      "Response depth: Medium.",
      "Give a complete, well-explained answer with clear structure.",
      "For multi-part requests, complete every part before concluding."
    ].join(" ");
  }

  return [
    "Response depth: High.",
    "Give a thorough and fully developed answer.",
    "Cover every important part with enough detail and structure.",
    "For long-form writing, continue until the requested section reaches a natural and complete stopping point."
  ].join(" ");
}

function getResponseInstruction(intelligence, intent) {
  return `${getTaskInstruction(intent)} ${getDepthInstruction(intelligence)}`;
}

function getRepetitionPenalty(intent) {
  if (intent === "summarize") {
    return 1.08;
  }

  if (intent === "write_story" || intent === "continue_story") {
    return 1.04;
  }

  return 1.03;
}

function resolveIntent(intent, message) {
  return ALLOWED_INTENTS.has(intent)
    ? intent
    : detectChatIntent(message);
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
  intelligence = "high",
  intent = null
}) {
  if (!ALLOWED_MODELS.has(model)) {
    throw createPublicError(
      400,
      "The selected My AI model is not supported."
    );
  }

  const resolvedIntent = resolveIntent(intent, message);
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
            content: getResponseInstruction(
              intelligence,
              resolvedIntent
            )
          },
          ...history,
          {
            role: "user",
            content: message
          }
        ],
        stream: false,
        ...getGenerationSettings(intelligence, resolvedIntent),
        repetition_penalty: getRepetitionPenalty(resolvedIntent)
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
      intelligence,
      intent: resolvedIntent
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
