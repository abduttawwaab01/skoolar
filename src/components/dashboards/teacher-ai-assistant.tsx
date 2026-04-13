'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sparkles, Send, BookText, FileEdit, UserCheck, Bot, User, Trash2, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const TEACHER_SYSTEM_PROMPT = `You are Skoolar AI, a teaching assistant. Help teachers with:
- Lesson planning and curriculum development
- Creating quiz questions, worksheets, and assessments
- Writing student evaluations and report comments
- Classroom management strategies
- Differentiated instruction techniques
- Educational best practices

Provide practical, actionable advice that teachers can implement right away. Be concise but thorough.`;

const presetPrompts = [
  { label: 'Generate lesson plan', icon: BookText, prompt: 'Generate a detailed lesson plan for Mathematics on the topic of Simultaneous Equations for JSS 2A students.' },
  { label: 'Create quiz questions', icon: FileEdit, prompt: 'Create a 10-question multiple choice quiz on Algebra for JSS 1A students.' },
  { label: 'Write student evaluation', icon: UserCheck, prompt: 'Write a performance evaluation for a student who has shown improvement but needs help with problem-solving skills.' },
];

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: "Hello! I'm your AI teaching assistant. I can help you with:\n\n- **Lesson planning** — structured, curriculum-aligned plans\n- **Assessment creation** — quizzes, worksheets, exams\n- **Student evaluations** — performance comments and feedback\n- **Classroom strategies** — management and engagement tips\n\nHow can I help you today?",
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
};

export function TeacherAIAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentRole = useAppStore((s) => s.currentRole);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const sendMessage = useCallback(async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || isSending) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsSending(true);
    setIsTyping(true);

    try {
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
          role: currentRole || 'TEACHER',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `Request failed with status ${response.status}`);
      }

      const data = await response.json();

      const aiMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: data.message?.content || "I'm sorry, I couldn't generate a response. Please try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Something went wrong';
      toast.error(errorMsg);

      const errorMsgMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: "I'm sorry, I encountered an error while processing your request. Please check your connection and try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsgMsg]);
    } finally {
      setIsSending(false);
      setIsTyping(false);
    }
  }, [messages, isSending, currentRole]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleClearChat = () => {
    setMessages([WELCOME_MESSAGE]);
    toast.success('Chat history cleared');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Teaching Assistant</h1>
            <p className="text-muted-foreground">Powered by AI to help you teach better</p>
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

      {/* Preset Prompts */}
      <div className="flex flex-wrap gap-2">
        {presetPrompts.map((pp) => (
          <Button
            key={pp.label}
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => sendMessage(pp.prompt)}
            disabled={isSending}
          >
            <pp.icon className="size-4" />
            {pp.label}
          </Button>
        ))}
      </div>

      {/* Chat Interface */}
      <Card className="flex flex-col" style={{ height: 'calc(100vh - 320px)', minHeight: '400px' }}>
        <CardHeader className="pb-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="size-4 text-purple-600" />
              AI Assistant Chat
            </CardTitle>
            <div className="flex items-center gap-1.5">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-purple-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-purple-500" />
              </span>
              <Badge variant="outline" className="text-xs">Online</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full" ref={scrollRef}>
            <div className="p-4 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse items-end' : 'items-start'}`}>
                  <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${msg.role === 'user' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                    {msg.role === 'user' ? <User className="size-4" /> : <Bot className="size-4" />}
                  </div>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted rounded-tl-md'}`}>
                    <div className="text-sm whitespace-pre-line leading-relaxed">{msg.content}</div>
                    <p className={`text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{msg.timestamp}</p>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-3 items-end">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                    <Bot className="size-4" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="flex gap-1">
                        <span className="size-2 rounded-full bg-purple-500/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="size-2 rounded-full bg-purple-500/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="size-2 rounded-full bg-purple-500/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-[11px] text-gray-400 ml-1">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </CardContent>
        <div className="border-t p-4 shrink-0">
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <Textarea
              placeholder="Ask me anything about teaching..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 min-h-[44px] max-h-[120px] resize-none"
              rows={1}
              disabled={isSending}
            />
            <Button type="submit" size="icon" disabled={!input.trim() || isSending}>
              {isSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
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
