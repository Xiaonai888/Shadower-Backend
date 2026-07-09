import {
  createOpenAIReply,
  getConfiguredOpenAIModels,
  isOpenAIConfigured
} from "./openai.service.js";
import {
  createOllamaReply,
  getOllamaModels
} from "./ollama.service.js";

function createPublicError(statusCode, publicMessage) {
  const error = new Error(publicMessage);
  error.statusCode = statusCode;
  error.publicMessage = publicMessage;
  return error;
}

export async function getChatModelCatalog() {
  const ollamaModels = await getOllamaModels({ silent: true });
  const openAIModels = getConfiguredOpenAIModels();

  return {
    providers: [
      {
        id: "my-ai",
        label: "My AI",
        available: ollamaModels.length > 0,
        status:
          ollamaModels.length > 0
            ? "Connected"
            : "Ollama is not connected or has no installed models",
        models: ollamaModels
      },
      {
        id: "openai",
        label: "OpenAI",
        available: isOpenAIConfigured(),
        status: isOpenAIConfigured()
          ? "Connected"
          : "OPENAI_API_KEY is missing",
        models: openAIModels
      }
    ],
    intelligenceLevels: [
      {
        id: "instant",
        label: "Instant"
      },
      {
        id: "medium",
        label: "Medium"
      },
      {
        id: "high",
        label: "High"
      }
    ]
  };
}

export async function createChatReply({
  message,
  history,
  provider,
  model,
  intelligence
}) {
  if (provider === "my-ai") {
    return createOllamaReply({
      message,
      history,
      model,
      intelligence
    });
  }

  if (provider === "openai") {
    return createOpenAIReply({
      message,
      history,
      model,
      intelligence
    });
  }

  throw createPublicError(400, "The selected AI provider is not supported.");
}
