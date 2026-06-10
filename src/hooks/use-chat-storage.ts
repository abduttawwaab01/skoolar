interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  actions?: Array<{ label: string; prompt: string }>;
}

export function useChatStorage() {
  const saveChat = (subject: string, messages: ChatMessage[]) => {
    const key = `chat-history-${subject}`;
    localStorage.setItem(key, JSON.stringify(messages.slice(0, 50)));
  };

  const loadChat = (subject: string): ChatMessage[] => {
    const key = `chat-history-${subject}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  };

  const clearChat = (subject: string) => {
    const key = `chat-history-${subject}`;
    localStorage.removeItem(key);
  };

  return { saveChat, loadChat, clearChat };
}
