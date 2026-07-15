import { createContext, useContext, useState } from "react";

// Holds the Enterprise Copilot's chat history and session id at a level
// above <Routes>, so navigating to another screen and back does not remount
// (and therefore does not reset) the conversation. This is in-memory only:
// it survives in-app navigation but still clears on a full page reload,
// same as every other piece of client-side React state in this app.
const ChatContext = createContext(null);

const INITIAL_MESSAGES = [
  {
    who: "agent",
    text: "Hello — I'm the Audree Enterprise Copilot. Ask your business question in plain language; I identify the intent and route it automatically. Try one of the quick questions below.",
  },
];

function makeSessionId() {
  return "session-" + Math.random().toString(36).slice(2);
}

export function ChatProvider({ children }) {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [sessionId] = useState(makeSessionId);

  function resetChat() {
    setMessages(INITIAL_MESSAGES);
  }

  return (
    <ChatContext.Provider value={{ messages, setMessages, sessionId, resetChat }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  return useContext(ChatContext);
}
