import OpenAI from "openai";
import { SHADOWER_INSTRUCTIONS } from "../config/shadowerPrompt.js";

const DEFAULT_MODELS = ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini"];
const INTELLIGENCE_TO_EFFORT = {
  instant: "low",
  medium: "medium",
  high: "high"
};

let openaiClient;

function createPublicError(statusCode, publicMessage) {
  const error = new Error(publicMessage);
  error.statusCode = statusCode;
  error.publicMessage = publicMessage;
  return error;
}

function formatModelLabel(model) {
  return model
    .split("-")
    .map((part) => {
      if (part.toLowerCase() === "gpt") return "GPT";
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ")
    .replace(/GPT (\d)/, "GPT-$1");
}

export function isOpenAIConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function getConfiguredOpenAIModels() {
  const configured = process.env.OPENAI_ALLOWED_MODELS
    ?.split(",")
    .map((model) => model.trim())
    .filter(Boolean);

  const models = configured?.length
    ? configured
    : [process.env.OPENAI_MODEL?.trim(), ...DEFAULT_MODELS].filter(Boolean);

  return [...new Set(models)].map((model) => ({
    id: model,
    label: formatModelLabel(model)
  }));
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw createPublicError(
      503,
      "OpenAI is not configured. Add OPENAI_API_KEY in Render."
    );
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey,
      timeout: 90000,
      maxRetries: 1
    });
  }

  return openaiClient;
}

function mapOpenAIError(error) {
  if (error?.status === 401) {
    return createPublicError(
      503,
      "The OpenAI API key is invalid. Check OPENAI_API_KEY in Render."
    );
  }

  if (error?.status === 429) {
    return createPublicError(
      429,
      "The OpenAI usage limit was reached. Check API billing or try later."
    );
  }

  if (
    error?.name === "APIConnectionTimeoutError" ||
    error?.code === "ETIMEDOUT"
  ) {
    return createPublicError(
      504,
      "OpenAI took too long to respond. Please try again."
    );
  }

  return createPublicError(
    502,
    "OpenAI could not generate a response. Please try again."
  );
}

export async function createOpenAIReply({
  message,
  history,
  model,
  intelligence
}) {
  const allowedModels = getConfiguredOpenAIModels().map((item) => item.id);

  if (!allowedModels.includes(model)) {
    throw createPublicError(400, "The selected OpenAI model is not allowed.");
  }

  try {
    const response = await getOpenAIClient().responses.create({
      model,
      reasoning: {
        effort: INTELLIGENCE_TO_EFFORT[intelligence] || "medium"
      },
      instructions: SHADOWER_INSTRUCTIONS,
      input: [
        ...history,
        {
          role: "user",
          content: message
        }
      ],
      max_output_tokens: 1800,
      store: false
    });

    const reply = response.output_text?.trim();

    if (!reply) {
      throw createPublicError(
        502,
        "OpenAI returned an empty response. Please try again."
      );
    }

    return {
      reply,
      provider: "openai",
      model,
      intelligence
    };
  } catch (error) {
    if (error?.publicMessage) {
      throw error;
    }

    throw mapOpenAIError(error);
  }
}
