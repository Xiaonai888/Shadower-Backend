import {
  createOllamaReply,
  getOllamaModels,
  isOllamaConfigured
} from "./ollama.service.js";

export async function getChatModelCatalog() {
  const configured = isOllamaConfigured();
  const ollamaModels = configured
    ? await getOllamaModels({ silent: true })
    : [];

  let status = "My AI model server is not configured yet";

  if (configured && ollamaModels.length > 0) {
    status = "Connected";
  } else if (configured) {
    status = "My AI model server is unreachable or has no installed models";
  }

  return {
    providers: [
      {
        id: "my-ai",
        label: "My AI",
        available: configured && ollamaModels.length > 0,
        status,
        models: ollamaModels
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
  model,
  intelligence
}) {
  return createOllamaReply({
    message,
    history,
    model,
    intelligence
  });
}
