import { API_BASE_URL } from "../config/api";

const REQUEST_TIMEOUT_MS = 30000;

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Unable to save feedback");
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Feedback request took too long");
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function saveMessageFeedback(payload) {
  return request("/api/feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}
