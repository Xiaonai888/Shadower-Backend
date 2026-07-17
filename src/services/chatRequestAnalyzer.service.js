import {
  detectChatIntent,
  getIntentInstruction
} from "./chatIntent.service.js";

const API_ROOT = "https://api.cloudflare.com/client/v4";
const DEFAULT_ANALYSIS_MODEL =
  process.env.CLOUDFLARE_ANALYSIS_MODEL?.trim() ||
  "@cf/qwen/qwen3-30b-a3b-fp8";
const ANALYSIS_TIMEOUT_MS = 60000;
const HISTORY_LIMIT = 10;
const HISTORY_MESSAGE_LIMIT = 1400;

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

const ALLOWED_REQUEST_KINDS = new Set([
  "question",
  "writing",
  "editing",
  "summary",
  "translation",
  "planning",
  "continuation",
  "continuity_check"
]);

const ALLOWED_LENGTHS = new Set([
  "short",
  "medium",
  "long",
  "unspecified"
]);

const ALLOWED_AMBIGUITY = new Set([
  "none",
  "minor",
  "major"
]);

const SIMPLE_MESSAGES = new Set([
  "hi",
  "hello",
  "hey",
  "សួស្តី",
  "ជំរាបសួរ"
]);

function getCredentials() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();

  if (!accountId || !apiToken) {
    throw new Error("Cloudflare Workers AI is not configured.");
  }

  return {
    accountId,
    apiToken
  };
}

function normalizeString(value, maxLength = 1000) {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

function normalizeStringList(value, limit = 12, itemLength = 500) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .filter((item) => typeof item === "string" && item.trim())
        .map((item) => item.trim().slice(0, itemLength))
    )
  ].slice(0, limit);
}

function normalizeBoolean(value) {
  return value === true;
}

function normalizeConfidence(value, fallback = 0.5) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(Math.max(number, 0), 1);
}

function detectLanguage(message) {
  const hasKhmer = /[\u1780-\u17ff]/u.test(message);
  const hasLatin = /[A-Za-z]/.test(message);

  if (hasKhmer && hasLatin) return "mixed";
  if (hasKhmer) return "km";
  if (hasLatin) return "en";
  return "other";
}

function inferRequestKind(intent) {
  const mapping = {
    write_story: "writing",
    continue_story: "continuation",
    rewrite: "editing",
    summarize: "summary",
    translate: "translation",
    create_character: "planning",
    create_outline: "planning",
    check_continuity: "continuity_check",
    question_about_story: "question",
    normal_chat: "question"
  };

  return mapping[intent] || "question";
}

function createFallbackAnalysis(message, source = "rules") {
  const intent = detectChatIntent(message);
  const storyIntents = new Set([
    "write_story",
    "continue_story",
    "create_character",
    "create_outline",
    "check_continuity",
    "question_about_story"
  ]);

  return {
    intent,
    requestKind: inferRequestKind(intent),
    language: detectLanguage(message),
    userGoal: normalizeString(message, 600),
    needsStoryContext: storyIntents.has(intent),
    needsCreativeWriting: new Set([
      "write_story",
      "continue_story",
      "create_character",
      "create_outline"
    ]).has(intent),
    needsFactualPrecision: new Set([
      "question_about_story",
      "check_continuity",
      "summarize",
      "translate"
    ]).has(intent),
    requestedLength: "unspecified",
    constraints: [],
    mustPreserve: [],
    answerPlan: [getIntentInstruction(intent)],
    ambiguity: intent === "normal_chat" ? "minor" : "none",
    confidence: intent === "normal_chat" ? 0.45 : 0.7,
    source
  };
}

function shouldUseModelAnalyzer(message, fallbackIntent, history) {
  const normalized = message.trim().toLowerCase();

  if (SIMPLE_MESSAGES.has(normalized)) {
    return false;
  }

  if (fallbackIntent === "normal_chat") {
    return true;
  }

  if (
    [
      "write_story",
      "continue_story",
      "create_character",
      "create_outline",
      "check_continuity",
      "question_about_story"
    ].includes(fallbackIntent)
  ) {
    return true;
  }

  if (history.length && message.trim().length < 80) {
    return true;
  }

  return message.length > 500;
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter(
      (item) =>
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string" &&
        item.content.trim()
    )
    .slice(-HISTORY_LIMIT)
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, HISTORY_MESSAGE_LIMIT)
    }));
}

function extractJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start < 0 || end <= start) {
    throw new Error("Request analyzer did not return JSON.");
  }

  return JSON.parse(text.slice(start, end + 1));
}

function extractText(payload) {
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

function normalizeAnalysis(value, fallback) {
  const intent = ALLOWED_INTENTS.has(value?.intent)
    ? value.intent
    : fallback.intent;

  const requestKind = ALLOWED_REQUEST_KINDS.has(value?.requestKind)
    ? value.requestKind
    : inferRequestKind(intent);

  const requestedLength = ALLOWED_LENGTHS.has(value?.requestedLength)
    ? value.requestedLength
    : "unspecified";

  const ambiguity = ALLOWED_AMBIGUITY.has(value?.ambiguity)
    ? value.ambiguity
    : "minor";

  return {
    intent,
    requestKind,
    language: normalizeString(value?.language, 20) || fallback.language,
    userGoal:
      normalizeString(value?.userGoal, 1000) ||
      fallback.userGoal,
    needsStoryContext: normalizeBoolean(value?.needsStoryContext),
    needsCreativeWriting: normalizeBoolean(value?.needsCreativeWriting),
    needsFactualPrecision: normalizeBoolean(value?.needsFactualPrecision),
    requestedLength,
    constraints: normalizeStringList(value?.constraints),
    mustPreserve: normalizeStringList(value?.mustPreserve),
    answerPlan: normalizeStringList(value?.answerPlan, 8, 700),
    ambiguity,
    confidence: normalizeConfidence(value?.confidence, fallback.confidence),
    source: "model"
  };
}

export async function analyzeChatRequest({
  message,
  history = []
}) {
  const cleanMessage =
    typeof message === "string" ? message.trim() : "";
  const cleanHistory = normalizeHistory(history);
  const fallback = createFallbackAnalysis(cleanMessage);

  if (!cleanMessage) {
    return fallback;
  }

  if (!shouldUseModelAnalyzer(cleanMessage, fallback.intent, cleanHistory)) {
    return fallback;
  }

  try {
    const { accountId, apiToken } = getCredentials();
    const endpoint =
      `${API_ROOT}/accounts/${accountId}/ai/run/${DEFAULT_ANALYSIS_MODEL}`;
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      ANALYSIS_TIMEOUT_MS
    );

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json"
        },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: [
                "Analyze the user's latest request for a private writing assistant.",
                "Do not answer the request.",
                "Use recent conversation only to understand references such as Next, continue, this scene, this character, or fix it.",
                "Choose exactly one primary intent from:",
                "normal_chat, write_story, continue_story, rewrite, summarize, translate, create_character, create_outline, check_continuity, question_about_story.",
                "Return one valid JSON object only, without markdown.",
                "Use this exact shape:",
                '{"intent":"string","requestKind":"question|writing|editing|summary|translation|planning|continuation|continuity_check","language":"km|en|mixed|other","userGoal":"short precise goal","needsStoryContext":true,"needsCreativeWriting":false,"needsFactualPrecision":true,"requestedLength":"short|medium|long|unspecified","constraints":["string"],"mustPreserve":["string"],"answerPlan":["string"],"ambiguity":"none|minor|major","confidence":0.0}',
                "Extract explicit constraints such as point of view, characters, episode, tone, length, protected facts, formatting, and what must not change.",
                "For story continuation, identify that the answer must continue from the latest established ending rather than restart or summarize.",
                "For story questions, distinguish analysis from creative writing.",
                "Never invent story facts that are absent from the supplied request and recent context."
              ].join(" ")
            },
            {
              role: "user",
              content: JSON.stringify({
                recentHistory: cleanHistory,
                latestMessage: cleanMessage
              })
            }
          ],
          stream: false,
          max_tokens: 700,
          temperature: 0.08,
          top_p: 0.72,
          repetition_penalty: 1.03
        })
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload?.success === false) {
        return {
          ...fallback,
          source: "rules_after_model_error"
        };
      }

      const text = extractText(payload);

      if (!text) {
        return {
          ...fallback,
          source: "rules_after_empty_model"
        };
      }

      return normalizeAnalysis(extractJsonObject(text), fallback);
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error("Request analysis failed", {
      name: error?.name,
      message: error?.message
    });

    return {
      ...fallback,
      source: "rules_after_exception"
    };
  }
}
