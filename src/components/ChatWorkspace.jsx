import { useEffect } from "react";
import Icon from "./Icon";
import MessageFeedback from "./MessageFeedback";
import { IntelligenceSelector } from "./ModelSelector";
import { greetingSuggestions } from "../data/uiData";

function WelcomeState({ isSending, onSendSuggestion }) {
  return (
    <div className="welcome-state">
      <div className="welcome-title">
        <h1>Welcome to Shadower</h1>
        <Icon name="sparkles" size={31} />
      </div>

      <p className="welcome-subtitle">
        Your private AI writing studio for <strong>Khmer & English</strong> novels.
      </p>

      <div className="feature-row">
        <article>
          <Icon name="pen" size={30} />
          <div>
            <strong>Write with freedom</strong>
            <p>AI that understands your story and style.</p>
          </div>
        </article>
        <article>
          <Icon name="shield" size={30} />
          <div>
            <strong>Your stories, private</strong>
            <p>Your creative space stays protected.</p>
          </div>
        </article>
        <article>
          <Icon name="book" size={30} />
          <div>
            <strong>From idea to masterpiece</strong>
            <p>Build, refine, and bring your stories to life.</p>
          </div>
        </article>
      </div>

      <div className="start-section">
        <span>Start a conversation</span>
        <div className="greeting-grid">
          {greetingSuggestions.map((item) => (
            <button
              disabled={isSending}
              key={item.title}
              onClick={() => onSendSuggestion(item.title)}
              type="button"
            >
              <span>
                <strong>{item.title}</strong>
                <small>{item.subtitle}</small>
              </span>
              <span className="wave">👋</span>
            </button>
          ))}
        </div>
      </div>

      <div className="disclaimer">
        <Icon name="shield" size={15} />
        <span>Shadower can make mistakes. Please review important information.</span>
      </div>
    </div>
  );
}

function MessageList({
  error,
  isSending,
  messages,
  messagesEndRef,
  onRetry
}) {
  return (
    <div className="conversation">
      {messages.map((message) => (
        <article className={`chat-message ${message.role}`} key={message.id}>
          <div className="message-avatar">
            {message.role === "assistant" ? (
              <Icon name="sparkles" size={17} />
            ) : (
              "S"
            )}
          </div>
          <div className="message-stack">
            <div className="message-meta">
              <strong>{message.role === "assistant" ? "Shadower" : "You"}</strong>
              <time>{message.time}</time>
            </div>
            <div className="message-bubble">
              <p>{message.text}</p>
              {message.role === "assistant" && (
                <div className="message-actions">
                  <MessageFeedback
                    answerText={message.text}
                    messageId={message.id}
                  />
                  <button aria-label="More actions" type="button">
                    <Icon name="more" size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </article>
      ))}

      {isSending && (
        <article className="chat-message assistant">
          <div className="message-avatar">
            <Icon name="sparkles" size={17} />
          </div>
          <div className="message-stack">
            <div className="message-meta">
              <strong>Shadower</strong>
              <span>Shadow is thinking</span>
            </div>
            <div className="message-bubble typing-bubble">
              <span />
              <span />
              <span />
            </div>
          </div>
        </article>
      )}

      {error && (
        <div className="chat-error">
          <div>
            <strong>Unable to reach Shadower Backend</strong>
            <p>{error}</p>
          </div>
          <button onClick={onRetry} type="button">
            Retry
          </button>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}

function Composer({
  input,
  inputRef,
  intelligence,
  intelligenceLevels,
  isSending,
  models,
  modelsLoading,
  myAIAvailable,
  onChange,
  onIntelligenceChange,
  onKeyDown,
  onModelSelect,
  onSubmit,
  selectedAvailable,
  selectedModel
}) {
  useEffect(() => {
    const textarea = inputRef.current;

    if (!textarea) return;

    textarea.style.height = "0px";

    const nextHeight = Math.min(textarea.scrollHeight, 180);

    textarea.style.height = `${Math.max(nextHeight, 24)}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > 180 ? "auto" : "hidden";
  }, [input, inputRef]);

  return (
    <form className="message-composer" onSubmit={onSubmit}>
      <textarea
        aria-label="Message Shadower"
        disabled={isSending}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder="Message Shadower..."
        ref={inputRef}
        rows="1"
        value={input}
      />

      <div className="composer-toolbar">
        <div className="send-area">
          <IntelligenceSelector
            available={myAIAvailable}
            disabled={isSending}
            intelligence={intelligence}
            levels={intelligenceLevels}
            loading={modelsLoading}
            models={models}
            onModelSelect={onModelSelect}
            onSelect={onIntelligenceChange}
            selectedModel={selectedModel}
          />
          <button
            aria-label="Send message"
            className="send-button"
            disabled={
              !input.trim() ||
              isSending ||
              !selectedModel ||
              !selectedAvailable
            }
            type="submit"
          >
            <Icon name="send" size={19} />
          </button>
        </div>
      </div>
    </form>
  );
}

function ChatWorkspace({
  error,
  input,
  inputRef,
  intelligence,
  intelligenceLevels,
  isSending,
  messages,
  messagesEndRef,
  models,
  modelsLoading,
  myAIAvailable,
  onChange,
  onIntelligenceChange,
  onKeyDown,
  onModelSelect,
  onRetry,
  onSendSuggestion,
  onSubmit,
  selectedAvailable,
  selectedModel
}) {
  return (
    <main className="chat-workspace">
      <div className={`chat-content ${messages.length ? "has-messages" : ""}`}>
        {messages.length === 0 ? (
          <WelcomeState
            isSending={isSending}
            onSendSuggestion={onSendSuggestion}
          />
        ) : (
          <MessageList
            error={error}
            isSending={isSending}
            messages={messages}
            messagesEndRef={messagesEndRef}
            onRetry={onRetry}
          />
        )}
      </div>

      <Composer
        input={input}
        inputRef={inputRef}
        intelligence={intelligence}
        intelligenceLevels={intelligenceLevels}
        isSending={isSending}
        models={models}
        modelsLoading={modelsLoading}
        myAIAvailable={myAIAvailable}
        onChange={onChange}
        onIntelligenceChange={onIntelligenceChange}
        onKeyDown={onKeyDown}
        onModelSelect={onModelSelect}
        onSubmit={onSubmit}
        selectedAvailable={selectedAvailable}
        selectedModel={selectedModel}
      />
    </main>
  );
}

export default ChatWorkspace;
