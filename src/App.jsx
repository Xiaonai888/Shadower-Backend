import { useEffect, useRef, useState } from "react";
import ChatWorkspace from "./components/ChatWorkspace";
import ComingSoon from "./components/ComingSoon";
import RightPanel from "./components/RightPanel";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import { topTabs } from "./data/uiData";
import { checkBackendHealth, sendChatMessage } from "./services/chatApi";

const CHAT_STORAGE_KEY = "shadower-current-chat";
const MAX_STORED_MESSAGES = 50;

function getStoredTheme() {
  try {
    return localStorage.getItem("shadower-theme") || "light";
  } catch {
    return "light";
  }
}

function getStoredMessages() {
  try {
    const stored = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || "[]");

    if (!Array.isArray(stored)) {
      return [];
    }

    return stored
      .filter(
        (item) =>
          item &&
          (item.role === "user" || item.role === "assistant") &&
          typeof item.text === "string" &&
          item.text.trim()
      )
      .slice(-MAX_STORED_MESSAGES)
      .map((item, index) => ({
        id:
          typeof item.id === "string"
            ? item.id
            : `${item.role}-stored-${index}`,
        role: item.role,
        text: item.text,
        time: typeof item.time === "string" ? item.time : ""
      }));
  } catch {
    return [];
  }
}

function formatTime() {
  return new Intl.DateTimeFormat([], {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date());
}

function createMessage(role, text) {
  const uniqueId =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    id: `${role}-${uniqueId}`,
    role,
    text,
    time: formatTime()
  };
}

function toApiHistory(messages) {
  return messages
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.text === "string" &&
        message.text.trim()
    )
    .map((message) => ({
      role: message.role,
      text: message.text
    }));
}

function App() {
  const [activeView, setActiveView] = useState("chat");
  const [backendStatus, setBackendStatus] = useState("checking");
  const [error, setError] = useState("");
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState(getStoredMessages);
  const [theme, setTheme] = useState(getStoredTheme);
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const refreshBackendStatus = async () => {
    setBackendStatus("checking");

    try {
      await checkBackendHealth();
      setBackendStatus("online");
    } catch {
      setBackendStatus("offline");
    }
  };

  useEffect(() => {
    refreshBackendStatus();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    try {
      localStorage.setItem("shadower-theme", theme);
    } catch {
      return;
    }
  }, [theme]);

  useEffect(() => {
    try {
      if (messages.length) {
        localStorage.setItem(
          CHAT_STORAGE_KEY,
          JSON.stringify(messages.slice(-MAX_STORED_MESSAGES))
        );
      } else {
        localStorage.removeItem(CHAT_STORAGE_KEY);
      }
    } catch {
      return;
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const startNewChat = () => {
    setActiveView("chat");
    setMessages([]);
    setInput("");
    setError("");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const changeView = (viewId) => {
    setActiveView(viewId);
  };

  const submitMessage = async (
    rawMessage,
    { history = messages, appendUser = true } = {}
  ) => {
    const text = rawMessage.trim();

    if (!text || isSending) return;

    setActiveView("chat");
    setInput("");
    setError("");
    setIsSending(true);

    if (appendUser) {
      setMessages((current) => [
        ...current,
        createMessage("user", text)
      ]);
    }

    try {
      const data = await sendChatMessage(text, toApiHistory(history));

      setMessages((current) => [
        ...current,
        createMessage(
          "assistant",
          data.reply || "Shadower did not return a reply."
        )
      ]);

      setBackendStatus("online");
    } catch (requestError) {
      setError(
        requestError.message || "Unable to connect to Shadower Backend"
      );
      setBackendStatus("offline");
    } finally {
      setIsSending(false);
    }
  };

  const retryLastMessage = () => {
    let lastUserIndex = -1;

    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "user") {
        lastUserIndex = index;
        break;
      }
    }

    if (lastUserIndex < 0) {
      return;
    }

    const message = messages[lastUserIndex];
    const history = messages.slice(0, lastUserIndex);

    setMessages(messages.slice(0, lastUserIndex + 1));
    submitMessage(message.text, {
      history,
      appendUser: false
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    submitMessage(input);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitMessage(input);
    }
  };

  const handlePrompt = (prompt) => {
    setActiveView("chat");
    setInput(prompt);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const selectedTab = topTabs.find((item) => item.id === activeView);

  return (
    <div className="app-shell">
      <Sidebar
        activeView={activeView}
        onNewChat={startNewChat}
        onViewChange={changeView}
      />

      <section className="main-shell">
        <Topbar
          activeView={activeView}
          backendStatus={backendStatus}
          onRefreshBackend={refreshBackendStatus}
          onThemeChange={setTheme}
          onViewChange={changeView}
          theme={theme}
        />

        <div
          className={`workspace-grid ${
            activeView !== "chat" ? "single-column" : ""
          }`}
        >
          {activeView === "chat" ? (
            <>
              <ChatWorkspace
                error={error}
                input={input}
                inputRef={inputRef}
                isSending={isSending}
                messages={messages}
                messagesEndRef={messagesEndRef}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                onRetry={retryLastMessage}
                onSendSuggestion={submitMessage}
                onSubmit={handleSubmit}
              />
              <RightPanel onPrompt={handlePrompt} />
            </>
          ) : (
            <ComingSoon
              icon={selectedTab?.icon || "sparkles"}
              title={selectedTab?.label || "Coming soon"}
            />
          )}
        </div>
      </section>
    </div>
  );
}

export default App;
