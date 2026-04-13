'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Send,
  Bot,
  User,
  Sparkles,
  BookOpen,
  Calculator,
  FlaskConical,
  PenTool,
  Lightbulb,
  Trash2,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';

// --- Types ---
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const MAX_INPUT_LENGTH = 2000;

// --- Quick action prompts ---
const quickActions = [
  { label: 'Help me study', icon: BookOpen, prompt: 'I need help studying for my upcoming exams. Can you give me some effective study strategies and tips?' },
  { label: 'Explain a concept', icon: Lightbulb, prompt: 'Can you explain a concept to me? I want to understand it clearly with simple examples.' },
  { label: 'Math help', icon: Calculator, prompt: 'I need help with a math problem. Can you walk me through it step by step?' },
  { label: 'Science help', icon: FlaskConical, prompt: 'I have a question about science. Can you help me understand this topic better?' },
  { label: 'Essay tips', icon: PenTool, prompt: 'I need to write an essay. Can you give me tips on how to structure it and make it compelling?' },
  { label: 'Study tips', icon: Sparkles, prompt: 'What are the best study techniques to improve my grades and retain information longer?' },
];

// --- Markdown-like rendering ---
function renderMarkdown(text: string) {
  // Split by code blocks first (```)
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, idx) => {
    // Code block
    if (part.startsWith('```') && part.endsWith('```')) {
      const codeContent = part.slice(3, -3);
      const firstNewline = codeContent.indexOf('\n');
      const lang = firstNewline > 0 ? codeContent.slice(0, firstNewline).trim() : '';
      const code = firstNewline > 0 ? codeContent.slice(firstNewline + 1) : codeContent;

      return (
        <div key={idx} className="my-2 rounded-lg border bg-gray-950 overflow-hidden">
          {lang && (
            <div className="flex items-center gap-2 border-b border-gray-800 bg-gray-900 px-3 py-1.5">
              <span className="text-[11px] font-mono text-gray-400">{lang}</span>
            </div>
          )}
          <pre className="overflow-x-auto p-3 text-[13px] leading-relaxed text-gray-200 font-mono">
            <code>{code}</code>
          </pre>
        </div>
      );
    }

    // Regular text - process inline formatting
    const lines = part.split('\n');

    return lines.map((line, lineIdx) => {
      // Process inline bold (**text**)
      const processed = line.replace(
        /\*\*(.+?)\*\*/g,
        '<strong class="font-semibold">$1</strong>'
      );

      // Process inline code (`text`)
      const processedCode = processed.replace(
        /`([^`]+)`/g,
        '<code class="rounded bg-gray-100 px-1.5 py-0.5 text-[13px] font-mono text-emerald-700">$1</code>'
      );

      // Bullet points
      if (line.match(/^[\s]*[-*]\s/)) {
        return (
          <li
            key={`${idx}-${lineIdx}`}
            className="ml-4 list-disc text-[13px] leading-relaxed text-gray-700"
            dangerouslySetInnerHTML={{
              __html: processedCode.replace(/^[\s]*[-*]\s/, ''),
            }}
          />
        );
      }

      // Numbered list
      if (line.match(/^[\s]*\d+\.\s/)) {
        return (
          <li
            key={`${idx}-${lineIdx}`}
            className="ml-4 list-decimal text-[13px] leading-relaxed text-gray-700"
            dangerouslySetInnerHTML={{
              __html: processedCode.replace(/^[\s]*\d+\.\s/, ''),
            }}
          />
        );
      }

      // Empty line
      if (line.trim() === '') {
        return <div key={`${idx}-${lineIdx}`} className="h-2" />;
      }

      // Regular paragraph
      return (
        <p
          key={`${idx}-${lineIdx}`}
          className="text-[13px] leading-relaxed text-gray-700"
          dangerouslySetInnerHTML={{ __html: processedCode }}
        />
      );
    });
  });
}

// --- Typing Indicator ---
function TypingIndicator() {
  return (
    <div className="flex gap-3 items-end">
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="bg-emerald-100 text-emerald-600 text-xs">
          <Bot className="size-4" />
        </AvatarFallback>
      </Avatar>
      <div className="rounded-2xl rounded-bl-md bg-gray-100 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <div className="flex gap-1">
            <span
              className="size-2 rounded-full bg-emerald-500/60 animate-bounce"
              style={{ animationDelay: '0ms' }}
            />
            <span
              className="size-2 rounded-full bg-emerald-500/60 animate-bounce"
              style={{ animationDelay: '150ms' }}
            />
            <span
              className="size-2 rounded-full bg-emerald-500/60 animate-bounce"
              style={{ animationDelay: '300ms' }}
            />
          </div>
          <span className="text-[11px] text-gray-400 ml-1">Thinking...</span>
        </div>
      </div>
    </div>
  );
}

// --- Welcome Message ---
const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hi! I'm **Skoolar AI**, your study assistant. I'm here to help you learn, understand concepts, and ace your studies! \n\nYou can ask me about:\n- Homework questions\n- Study strategies\n- Math, Science, English, and more\n- Essay writing tips\n\nHow can I help you today?",
  timestamp: new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  }),
};

// --- Main Component ---
export function StudentAIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRole = useAppStore((s) => s.currentRole);

  // Smooth scroll to bottom on new messages or typing state change
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const maxHeight = 120;
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, maxHeight)}px`;
    }
  }, [input]);

  // Send message to AI
  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isSending) return;

      // Check max length
      if (trimmed.length > MAX_INPUT_LENGTH) {
        toast.error(`Message too long. Maximum ${MAX_INPUT_LENGTH} characters.`);
        return;
      }

      // Add user message
      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setIsSending(true);
      setIsTyping(true);

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

      try {
        // Build conversation history (exclude welcome message id for API)
        const conversationMessages = [
          ...messages.filter((m) => m.id !== 'welcome'),
          userMsg,
        ].map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: conversationMessages,
            role: currentRole,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(
            errorData?.error || `Request failed with status ${response.status}`
          );
        }

        const data = await response.json();

        const aiMsg: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: data.message?.content || "I'm sorry, I couldn't generate a response. Please try again.",
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };

        setMessages((prev) => [...prev, aiMsg]);
      } catch (error: unknown) {
        const errorMsg =
          error instanceof Error ? error.message : 'Something went wrong';
        toast.error(errorMsg);

        // Add error message in chat
        const errorMsg2: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content:
            "I'm sorry, I encountered an error while processing your request. Please check your connection and try again.",
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };
        setMessages((prev) => [...prev, errorMsg2]);
      } finally {
        setIsSending(false);
        setIsTyping(false);
      }
    },
    [messages, isSending, currentRole]
  );

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // Handle keyboard shortcut (Enter to send, Shift+Enter for new line)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Clear chat
  const handleClearChat = () => {
    setMessages([WELCOME_MESSAGE]);
    toast.success('Chat history cleared');
  };

  // Quick action click
  const handleQuickAction = (prompt: string) => {
    if (isSending) return;
    setInput(prompt);
    // Auto-send the quick action
    sendMessage(prompt);
  };

  const charCount = input.length;
  const isNearLimit = charCount > MAX_INPUT_LENGTH * 0.8;

  return (
    <div className="space-y-4 flex flex-col" style={{ height: 'calc(100vh - 160px)', minHeight: '500px' }}>
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Study Assistant</h1>
            <p className="text-sm text-muted-foreground">
              Your personal AI-powered study companion
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearChat}
          className="gap-2 text-muted-foreground hover:text-red-600"
        >
          <Trash2 className="size-3.5" />
          Clear Chat
        </Button>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex flex-wrap gap-2 shrink-0">
        {quickActions.map((action) => (
          <Button
            key={action.label}
            variant="outline"
            size="sm"
            className={cn(
              'gap-1.5 text-xs border-emerald-200 text-emerald-700 bg-emerald-50/50',
              'hover:bg-emerald-100 hover:text-emerald-800 hover:border-emerald-300',
              'transition-colors',
              isSending && 'opacity-50 cursor-not-allowed'
            )}
            onClick={() => handleQuickAction(action.prompt)}
            disabled={isSending}
          >
            <action.icon className="size-3.5" />
            {action.label}
          </Button>
        ))}
      </div>

      {/* Chat Card */}
      <Card className="flex-1 flex flex-col overflow-hidden border-emerald-200/50">
        <CardHeader className="pb-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bot className="size-4 text-emerald-600" />
              Chat with Skoolar AI
            </CardTitle>
            <div className="flex items-center gap-1.5">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[11px] text-muted-foreground">Online</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full" ref={scrollRef}>
            <div className="p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'flex gap-3',
                    msg.role === 'user' ? 'flex-row-reverse items-end' : 'items-start'
                  )}
                >
                  {/* Avatar */}
                  <Avatar className="size-8 shrink-0">
                    <AvatarFallback
                      className={cn(
                        'text-xs',
                        msg.role === 'user'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-emerald-100 text-emerald-600'
                      )}
                    >
                      {msg.role === 'user' ? (
                        <User className="size-4" />
                      ) : (
                        <Bot className="size-4" />
                      )}
                    </AvatarFallback>
                  </Avatar>

                  {/* Message Bubble */}
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-3',
                      msg.role === 'user'
                        ? 'bg-emerald-600 text-white rounded-br-md'
                        : 'bg-gray-100 text-gray-900 rounded-bl-md'
                    )}
                  >
                    <div className="space-y-0.5">
                      {msg.role === 'user' ? (
                        <p className="text-sm whitespace-pre-line leading-relaxed">
                          {msg.content}
                        </p>
                      ) : (
                        renderMarkdown(msg.content)
                      )}
                    </div>
                    <p
                      className={cn(
                        'text-[10px] mt-1.5',
                        msg.role === 'user'
                          ? 'text-emerald-200'
                          : 'text-gray-400'
                      )}
                    >
                      {msg.timestamp}
                    </p>
                  </div>
                </div>
              ))}

              {/* Typing Indicator */}
              {isTyping && <TypingIndicator />}

              {/* Scroll anchor */}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </CardContent>

        {/* Input Area */}
        <div className="border-t p-4 shrink-0 bg-white/80">
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                placeholder="Ask me anything about your studies..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSending}
                rows={1}
                className={cn(
                  'min-h-[44px] max-h-[120px] resize-none pr-12',
                  'text-sm leading-relaxed',
                  'focus-visible:ring-emerald-500 focus-visible:ring-offset-0',
                  'border-emerald-200',
                  isNearLimit && 'border-orange-300 focus-visible:ring-orange-500'
                )}
              />
              {/* Character counter */}
              <div
                className={cn(
                  'absolute bottom-1.5 right-2 text-[10px]',
                  isNearLimit ? 'text-orange-500' : 'text-gray-400'
                )}
              >
                {charCount > 0 && `${charCount}/${MAX_INPUT_LENGTH}`}
              </div>
            </div>
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isSending}
              className={cn(
                'size-11 shrink-0 rounded-xl',
                'bg-emerald-600 hover:bg-emerald-700',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                'transition-colors'
              )}
            >
              {isSending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </form>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Press <kbd className="rounded border bg-gray-100 px-1 py-0.5 text-[10px] font-mono">Enter</kbd> to send,{' '}
            <kbd className="rounded border bg-gray-100 px-1 py-0.5 text-[10px] font-mono">Shift+Enter</kbd> for new line
          </p>
        </div>
      </Card>
    </div>
  );
}
