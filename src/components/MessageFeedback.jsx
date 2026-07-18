import { useState } from "react";
import { getChatMessages } from "../services/chatApi";
import { saveMessageFeedback } from "../services/feedbackApi";

const CURRENT_CHAT_ID_KEY = "shadower-current-chat-id";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ERROR_OPTIONS = [
  ["missed_user_intent", "Did not understand my request"],
  ["wrong_topic", "Answered the wrong topic"],
  ["factual_error", "Information was incorrect"],
  ["incomplete", "Answer was incomplete"],
  ["continuity_error", "Story continuity was wrong"],
  ["ignored_instruction", "Ignored my instruction"],
  ["too_short", "Answer was too short"],
  ["unnatural_language", "Language felt unnatural"],
  ["other", "Other problem"]
];

function getCurrentChatId() {
  try {
    return window.localStorage.getItem(CURRENT_CHAT_ID_KEY) || "";
  } catch {
    return "";
  }
}

async function resolveAssistantMessageId({
  answerText,
  chatId,
  messageId
}) {
  if (UUID_PATTERN.test(messageId || "")) {
    return messageId;
  }

  const data = await getChatMessages(chatId, 500);
  const matches = (data.messages || []).filter(
    (item) =>
      item.role === "assistant" &&
      typeof item.content === "string" &&
      item.content.trim() === answerText.trim()
  );

  return matches.at(-1)?.id || "";
}

function MessageFeedback({ answerText, messageId }) {
  const [accepted, setAccepted] = useState(true);
  const [correctionText, setCorrectionText] = useState("");
  const [error, setError] = useState("");
  const [errorType, setErrorType] = useState("missed_user_intent");
  const [panelOpen, setPanelOpen] = useState(false);
  const [rating, setRating] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const submitFeedback = async (nextRating) => {
    const chatId = getCurrentChatId();

    if (!UUID_PATTERN.test(chatId)) {
      setError("Open a saved chat before sending feedback.");
      return;
    }

    setSaving(true);
    setError("");
    setStatus("");

    try {
      const resolvedMessageId = await resolveAssistantMessageId({
        answerText,
        chatId,
        messageId
      });

      if (!UUID_PATTERN.test(resolvedMessageId)) {
        throw new Error(
          "This answer has not been saved to the chat yet. Reopen the chat and try again."
        );
      }

      await saveMessageFeedback({
        chatId,
        messageId: resolvedMessageId,
        rating: nextRating,
        errorType: nextRating === "bad" ? errorType : null,
        correctionText:
          nextRating === "bad" && correctionText.trim()
            ? correctionText.trim()
            : null,
        acceptedAnswer:
          nextRating === "bad" &&
          accepted &&
          correctionText.trim()
            ? correctionText.trim()
            : null,
        metadata: {
          source: "shadower-web-feedback"
        }
      });

      setRating(nextRating);
      setPanelOpen(false);
      setStatus(
        nextRating === "good"
          ? "Marked as helpful."
          : "Correction saved for Shadower."
      );
    } catch (requestError) {
      setError(requestError.message || "Unable to save this feedback.");
    } finally {
      setSaving(false);
    }
  };

  const openCorrection = () => {
    setError("");
    setStatus("");
    setPanelOpen(true);
  };

  return (
    <div className="feedback-control">
      <div className="feedback-buttons">
        <button
          aria-label="Good answer"
          className={`feedback-button ${rating === "good" ? "active good" : ""}`}
          disabled={saving}
          onClick={() => submitFeedback("good")}
          title="Good answer"
          type="button"
        >
          <span aria-hidden="true">👍</span>
        </button>
        <button
          aria-label="Wrong answer"
          className={`feedback-button ${rating === "bad" ? "active bad" : ""}`}
          disabled={saving}
          onClick={openCorrection}
          title="Wrong answer"
          type="button"
        >
          <span aria-hidden="true">👎</span>
        </button>
      </div>

      {panelOpen ? (
        <form
          className="feedback-panel"
          onSubmit={(event) => {
            event.preventDefault();
            submitFeedback("bad");
          }}
        >
          <div className="feedback-panel-head">
            <div>
              <strong>Help Shadower learn</strong>
              <span>What was wrong with this answer?</span>
            </div>
            <button
              aria-label="Close feedback"
              disabled={saving}
              onClick={() => setPanelOpen(false)}
              type="button"
            >
              ×
            </button>
          </div>

          <label className="feedback-field">
            <span>Problem</span>
            <select
              disabled={saving}
              onChange={(event) => setErrorType(event.target.value)}
              value={errorType}
            >
              {ERROR_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="feedback-field">
            <span>Your correction</span>
            <textarea
              disabled={saving}
              maxLength={20000}
              onChange={(event) => setCorrectionText(event.target.value)}
              placeholder="Write what Shadower should have answered or what it must remember..."
              rows="4"
              value={correctionText}
            />
          </label>

          <label className="feedback-accepted">
            <input
              checked={accepted}
              disabled={saving || !correctionText.trim()}
              onChange={(event) => setAccepted(event.target.checked)}
              type="checkbox"
            />
            <span>Use my correction as the accepted answer</span>
          </label>

          {error ? <p className="feedback-error">{error}</p> : null}

          <div className="feedback-panel-actions">
            <button
              className="feedback-cancel"
              disabled={saving}
              onClick={() => setPanelOpen(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="feedback-save"
              disabled={saving}
              type="submit"
            >
              {saving ? "Saving..." : "Save feedback"}
            </button>
          </div>
        </form>
      ) : null}

      {!panelOpen && status ? (
        <span className="feedback-status">{status}</span>
      ) : null}

      {!panelOpen && error ? (
        <span className="feedback-inline-error">{error}</span>
      ) : null}
    </div>
  );
}

export default MessageFeedback;
