import { API_BASE_URL } from "../config/api";

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 65000);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Request failed");
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Shadower took too long to respond");
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function checkBackendHealth() {
  return request("/health");
}

export function sendChatMessage(message, history = []) {
  return request("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message,
      history
    })
  });
}
