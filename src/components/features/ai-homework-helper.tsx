'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Brain, Sparkles, BookOpen, Lightbulb, Send, Copy, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';

// ── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  actions?: AiAction[];
}

interface AiAction {
  label: string;
  icon: React.ReactNode;
  prompt: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const subjects = [
  'Mathematics',
  'English Language',
  'Basic Science',
  'Social Studies',
  'Computer Studies',
  'Physics',
  'Chemistry',
  'Biology',
  'Geography',
  'History',
];

const topicsBySubject: Record<string, string[]> = {
  Mathematics: ['Algebra', 'Geometry', 'Trigonometry', 'Statistics', 'Calculus', 'Number Theory', 'Quadratic Equations'],
  'English Language': ['Grammar', 'Comprehension', 'Essay Writing', 'Literature', 'Vocabulary', 'Summary Writing'],
  'Basic Science': ['Matter', 'Energy', 'Living Things', 'Environment', 'Force & Motion', 'Simple Machines'],
  'Social Studies': ['Government', 'Culture', 'Citizenship', 'Economics', 'History', 'Human Rights'],
  'Computer Studies': ['Programming', 'Hardware', 'Software', 'Networking', 'Database', 'Algorithms'],
  Physics: ['Mechanics', 'Waves', 'Electricity', 'Magnetism', 'Thermodynamics', 'Optics'],
  Chemistry: ['Elements', 'Compounds', 'Reactions', 'Acids & Bases', 'Organic Chemistry', 'Periodic Table'],
  Biology: ['Cells', 'Genetics', 'Ecology', 'Human Body', 'Plants', 'Evolution'],
  Geography: ['Maps', 'Climate', 'Population', 'Landforms', 'Resources', 'Rivers'],
  History: ['Ancient Civilizations', 'Colonialism', 'Independence', 'World Wars', 'Nigerian History', 'Global Events'],
};

const difficulties = ['Easy', 'Medium', 'Hard'];

const starterPrompts: Record<string, string[]> = {
  Mathematics: [
    'Explain quadratic equations with examples',
    'How do I solve simultaneous equations?',
    'Explain the Pythagorean theorem',
    'What is the difference between mean, median, and mode?',
  ],
  'English Language': [
    'Explain the rules for subject-verb agreement',
    'How do I write a good essay introduction?',
    'What are the types of figurative language?',
    'How do I summarize a passage effectively?',
  ],
  'Basic Science': [
    'Explain the states of matter with examples',
    'What is photosynthesis and why is it important?',
    'How do simple machines make work easier?',
    'Explain the water cycle step by step',
  ],
  'Social Studies': [
    'What are the functions of government?',
    'Explain the concept of human rights',
    'What is democracy and how does it work?',
    'Describe the branches of government',
  ],
  'Computer Studies': [
    'Explain what an algorithm is with examples',
    'What is the difference between RAM and ROM?',
    'How does the internet work?',
    'Explain binary number system',
  ],
};

const subjectColorMap: Record<string, { bg: string; text: string; border: string }> = {
  Mathematics: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  'English Language': { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
  'Basic Science': { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
  'Social Studies': { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
  'Computer Studies': { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-200' },
  Physics: { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200' },
  Chemistry: { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-200' },
  Biology: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  Geography: { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-200' },
  History: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
};

const HOMEWORK_SYSTEM_PROMPT = `You are Skoolar AI, a helpful homework assistant for students. You provide step-by-step explanations that help students learn and understand, not just give answers.

Guidelines:
- Always explain concepts clearly and use examples
- Break down complex problems into manageable steps
- Use encouraging and supportive language
- When appropriate, suggest follow-up questions or practice problems
- Format responses with **bold** headers, bullet points, and numbered lists for readability
- Keep responses focused and concise but thorough
- Adapt explanations to the student's subject and difficulty level
- Never just give the final answer without showing the working/reasoning`;

function getSubjectContext(subject: string, topic: string, difficulty: string): string {
  if (subject) return `Subject: ${subject}${topic ? `, Topic: ${topic}` : ''}, Difficulty: ${difficulty}`;
  return '';
}

// ── Typing Indicator Component ───────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500">
      <div className="flex items-center gap-1">
        <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
        <span className="ml-1">AI is thinking</span>
      </div>
      <span className="inline-flex gap-0.5">
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
      </span>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function AIHomeworkHelper() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('Medium');
  const [isThinking, setIsThinking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sessionCount, setSessionCount] = useState(0);
  const currentRole = useAppStore((s) => s.currentRole);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentTopics = topicsBySubject[selectedSubject] || [];
  const colors = subjectColorMap[selectedSubject] || { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' };

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const copyToClipboard = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = inputMessage.trim();
    if (!trimmed || isThinking) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsThinking(true);

    try {
      const subjectContext = getSubjectContext(selectedSubject, selectedTopic, selectedDifficulty);
      const conversationMessages = [
        ...messages.filter(m => m.id !== 'welcome'),
        userMsg,
      ].map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversationMessages,
          role: currentRole || 'STUDENT',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `Request failed with status ${response.status}`);
      }

      const data = await response.json();
      const aiContent = data.message?.content || "I'm sorry, I couldn't generate a response. Please try again.";

      const actions: AiAction[] = [
        { label: 'Explain Answer', icon: <BookOpen className="h-3.5 w-3.5" />, prompt: 'Explain this answer in more detail' },
        { label: 'Show Steps', icon: <Sparkles className="h-3.5 w-3.5" />, prompt: 'Show me step-by-step' },
        { label: 'Study Tips', icon: <Lightbulb className="h-3.5 w-3.5" />, prompt: 'How should I study this topic?' },
      ];

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: aiContent,
        timestamp: new Date(),
        actions,
      };
      setMessages(prev => [...prev, aiMsg]);
      setSessionCount(prev => prev + 1);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Something went wrong';
      toast.error(errorMsg);
      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: "I'm sorry, I encountered an error. Please check your connection and try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } finally {
      setIsThinking(false);
    }
  }, [inputMessage, isThinking, selectedSubject, selectedTopic, selectedDifficulty, messages, currentRole]);

  const handleActionClick = useCallback((action: AiAction) => {
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: action.prompt,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);

    // Reuse handleSend logic via setInputMessage and triggering send
    setInputMessage(action.prompt);
    // Use setTimeout to allow state to update, then send
    setTimeout(() => {
      setInputMessage('');
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.content === action.prompt) {
          // Process the action prompt via AI
          fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: prev.filter(m => m.role !== 'system').map(m => ({
                role: m.role as 'user' | 'assistant', content: m.content,
              })),
              role: currentRole || 'STUDENT',
            }),
          })
            .then(res => {
              if (!res.ok) throw new Error('Request failed');
              return res.json();
            })
            .then(data => {
              const actions: AiAction[] = [
                { label: 'Explain Answer', icon: <BookOpen className="h-3.5 w-3.5" />, prompt: 'Explain this answer in more detail' },
                { label: 'Show Steps', icon: <Sparkles className="h-3.5 w-3.5" />, prompt: 'Show me step-by-step' },
                { label: 'Study Tips', icon: <Lightbulb className="h-3.5 w-3.5" />, prompt: 'How should I study this topic?' },
              ];
              const aiMsg: Message = {
                id: `ai-${Date.now()}`,
                role: 'assistant',
                content: data.message?.content || "I couldn't generate a response.",
                timestamp: new Date(),
                actions,
              };
              setMessages(prev => [...prev, aiMsg]);
              setSessionCount(prev => prev + 1);
            })
            .catch(() => {
              toast.error('Failed to get AI response');
            })
            .finally(() => {
              setIsThinking(false);
            });
          return prev;
        }
        return prev;
      });
    }, 100);
  }, [currentRole]);

  const handleStarterPrompt = useCallback((prompt: string) => {
    setInputMessage(prompt);
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setInputMessage('');
    setSelectedSubject('');
    setSelectedTopic('');
    setSessionCount(0);
    toast.success('New chat started');
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-100">
            <Brain className="h-6 w-6 text-violet-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">AI Homework Helper</h2>
            <p className="text-sm text-gray-500">Get step-by-step help with your homework questions</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-violet-500" />
            {sessionCount} questions answered
          </Badge>
          <Button variant="outline" size="sm" onClick={handleNewChat} className="gap-2">
            <Sparkles className="h-4 w-4" />
            New Chat
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar — Configuration & Starter Prompts */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-violet-500" />
                Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Subject</label>
                <Select value={selectedSubject} onValueChange={(v) => { setSelectedSubject(v); setSelectedTopic(''); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Topic</label>
                <Select value={selectedTopic} onValueChange={setSelectedTopic} disabled={!selectedSubject}>
                  <SelectTrigger>
                    <SelectValue placeholder={selectedSubject ? 'Select topic' : 'Pick a subject first'} />
                  </SelectTrigger>
                  <SelectContent>
                    {currentTopics.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Difficulty</label>
                <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {difficulties.map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Starter Prompts */}
          {selectedSubject && starterPrompts[selectedSubject] && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  Quick Prompts
                </CardTitle>
                <CardDescription>Click a prompt to get started</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {starterPrompts[selectedSubject].map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleStarterPrompt(prompt)}
                    className="w-full text-left text-xs px-3 py-2 rounded-lg border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-colors text-gray-700 leading-relaxed"
                  >
                    {prompt}
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Tips Card */}
          <Card className="bg-gradient-to-br from-violet-50 to-purple-50 border-violet-100">
            <CardContent className="pt-5">
              <div className="flex items-start gap-2.5">
                <Lightbulb className="h-5 w-5 text-violet-600 mt-0.5 shrink-0" />
                <div className="text-xs text-violet-800 space-y-1.5">
                  <p className="font-semibold">How to use this tool</p>
                  <ul className="list-disc list-inside space-y-1 text-violet-700">
                    <li>Paste your homework question</li>
                    <li>Select the subject and topic</li>
                    <li>Use action buttons for deeper help</li>
                    <li>Ask follow-up questions anytime</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chat Area */}
        <div className="lg:col-span-3">
          <Card className="flex flex-col" style={{ height: '680px' }}>
            {/* Chat Header */}
            <div className="px-6 py-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedSubject ? (
                  <Badge className={`${colors.bg} ${colors.text} border ${colors.border}`}>
                    {selectedSubject}
                  </Badge>
                ) : null}
                {selectedTopic ? (
                  <Badge variant="secondary">{selectedTopic}</Badge>
                ) : null}
                <Badge variant="outline">{selectedDifficulty}</Badge>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Brain className="h-3.5 w-3.5" />
                AI-Powered
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-6 py-4">
              {messages.length === 0 && !isThinking ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-16">
                  <div className="p-4 rounded-full bg-violet-100 mb-4">
                    <Brain className="h-10 w-10 text-violet-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Ask me anything!</h3>
                  <p className="text-sm text-gray-500 max-w-md mb-6">
                    Paste your homework question below and I&apos;ll help you understand it step by step. 
                    Choose a subject on the left for more targeted help.
                  </p>
                  <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
                    {['Solve a math problem step by step', 'Explain a science concept', 'Help me with essay writing', 'Give me practice problems'].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => { setInputMessage(suggestion); textareaRef.current?.focus(); }}
                        className="text-xs px-4 py-3 rounded-lg border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-colors text-gray-600"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-2' : 'order-1'}`}>
                        {/* Role Label */}
                        <div className={`text-[11px] mb-1 ${msg.role === 'user' ? 'text-right text-gray-400' : 'text-gray-400'}`}>
                          {msg.role === 'user' ? 'You' : (
                            <span className="flex items-center gap-1">
                              <Brain className="h-3 w-3 text-violet-500" />
                              AI Tutor
                            </span>
                          )}
                        </div>

                        {/* Message Bubble */}
                        <div
                          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                            msg.role === 'user'
                              ? 'bg-violet-600 text-white'
                              : 'bg-gray-50 text-gray-800 border border-gray-200'
                          }`}
                        >
                          {/* Render content with simple markdown-like formatting */}
                          {msg.content.split('\n').map((line, i) => {
                            const trimmed = line.trim();
                            if (!trimmed) return <br key={i} />;
                            if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                              return <p key={i} className="font-bold mt-2 mb-1">{trimmed.slice(2, -2)}</p>;
                            }
                            if (trimmed.startsWith('- ')) {
                              return (
                                <div key={i} className="flex gap-2 ml-2">
                                  <span className="text-violet-400 mt-0.5 shrink-0">•</span>
                                  <span>{trimmed.slice(2)}</span>
                                </div>
                              );
                            }
                            if (/^\d+\.\s/.test(trimmed)) {
                              return (
                                <div key={i} className="flex gap-2 ml-2">
                                  <span className="font-medium text-violet-600 shrink-0">{trimmed.match(/^(\d+\.)/)?.[1]}</span>
                                  <span>{trimmed.replace(/^\d+\.\s/, '')}</span>
                                </div>
                              );
                            }
                            return <p key={i} className="mb-0.5">{trimmed}</p>;
                          })}
                        </div>

                        {/* Actions */}
                        {msg.role === 'assistant' && msg.actions && msg.actions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {msg.actions.map((action, i) => (
                              <Button
                                key={i}
                                variant="outline"
                                size="sm"
                                className="text-xs h-7 gap-1.5 border-gray-200 hover:border-violet-300 hover:text-violet-700"
                                onClick={() => handleActionClick(action)}
                                disabled={isThinking}
                              >
                                {action.icon}
                                {action.label}
                              </Button>
                            ))}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7 gap-1.5 text-gray-400 hover:text-gray-600"
                              onClick={() => copyToClipboard(msg.content, msg.id)}
                            >
                              {copiedId === msg.id ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                              {copiedId === msg.id ? 'Copied' : 'Copy'}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Typing Indicator */}
                  {isThinking && <TypingIndicator />}

                  <div ref={chatEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input Area */}
            <div className="px-4 py-3 border-t bg-white">
              <div className="flex items-end gap-2">
                <Textarea
                  ref={textareaRef}
                  placeholder="Type your homework question here..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={2}
                  className="resize-none flex-1 min-h-[44px] max-h-[120px]"
                  disabled={isThinking}
                />
                <Button
                  onClick={handleSend}
                  disabled={!inputMessage.trim() || isThinking}
                  size="icon"
                  className="h-10 w-10 rounded-lg bg-violet-600 hover:bg-violet-700 shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5 text-center">
                AI responses are for learning purposes. Always verify with your teacher.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
