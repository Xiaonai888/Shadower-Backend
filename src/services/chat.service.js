import {
  createOllamaReply,
  getOllamaModels
} from "./ollama.service.js";

export async function getChatModelCatalog() {
  const ollamaModels = await getOllamaModels({ silent: true });

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
