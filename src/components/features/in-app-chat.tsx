'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, Send, Paperclip, MessageSquare, Plus, Phone, MoreVertical, Check, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  isRead: boolean;
}

interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  avatar: string;
  role: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isOnline: boolean;
  messages: Message[];
}

function getInitials(name: string) {
  return name.split(' ').filter(w => w.length > 1).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function InAppChat() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = selectedSchoolId || currentUser.schoolId;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string>('');
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  const activeConversation = conversations.find(c => c.id === selectedConversation);

  const filteredConversations = searchQuery.trim()
    ? conversations.filter(c =>
        c.participantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.role.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  // Fetch conversations from API
  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      setConversations([]);
      return;
    }

    setLoading(true);
    fetch(`/api/communication?schoolId=${schoolId}`)
      .then(res => res.json())
      .then(json => {
        const data = json.data || [];
        const mapped: Conversation[] = data.map((conv: any) => ({
          id: conv.id,
          participantId: conv.participantIds?.[0] || '',
          participantName: conv.title || 'Unknown',
          avatar: getInitials(conv.title || 'U'),
          role: conv.role || 'User',
          lastMessage: conv.lastMessage || '',
          lastMessageTime: conv.lastMessageAt
            ? new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '',
          unreadCount: conv.unreadCount || 0,
          isOnline: false,
          messages: [],
        }));
        setConversations(mapped);
        if (mapped.length > 0 && !selectedConversation) {
          setSelectedConversation(mapped[0].id);
        }
      })
      .catch(() => {
        toast.error('Failed to load conversations');
        setConversations([]);
      })
      .finally(() => setLoading(false));
  }, [schoolId]);

  // Fetch messages when conversation is selected
  useEffect(() => {
    if (!selectedConversation) return;

    fetch(`/api/messages?conversationId=${selectedConversation}`)
      .then(res => res.json())
      .then(json => {
        const data = json.data || [];
        const transformed: Message[] = data.map((msg: any) => ({
          id: msg.id,
          senderId: msg.senderId,
          senderName: msg.sender?.name || 'Unknown',
          content: msg.content,
          timestamp: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isRead: msg.isRead,
        }));

        setConversations(prev =>
          prev.map(c =>
            c.id === selectedConversation
              ? { ...c, messages: transformed, unreadCount: 0 }
              : c
          )
        );
      })
      .catch(() => {
        toast.error('Failed to load messages');
      });
  }, [selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages]);

  useEffect(() => {
    messageInputRef.current?.focus();
  }, [selectedConversation]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      content: newMessage.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isRead: true,
    };

    setConversations(prev =>
      prev.map(c =>
        c.id === selectedConversation
          ? {
              ...c,
              messages: [...c.messages, optimisticMsg],
              lastMessage: newMessage.trim(),
              lastMessageTime: 'Just now',
            }
          : c
      )
    );
    setNewMessage('');

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConversation,
          content: newMessage.trim(),
          type: 'text',
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to send');
      }

      const json = await res.json();
      const savedMsg = json.data;
      setConversations(prev =>
        prev.map(c =>
          c.id === selectedConversation
            ? {
                ...c,
                messages: c.messages.map(m =>
                  m.id === optimisticMsg.id
                    ? {
                        ...m,
                        id: savedMsg.id,
                        isRead: savedMsg.isRead,
                      }
                    : m
                ),
              }
            : c
        )
      );

      // Refresh conversations list to update last message
      const refreshed = await fetch(`/api/communication?schoolId=${schoolId}`)
        .then(r => r.json())
        .then(j => j.data || []);
      setConversations(prev =>
        prev.map(c => {
          const updated = refreshed.find((rc: any) => rc.id === c.id);
          if (updated) {
            return {
              ...c,
              lastMessage: updated.lastMessage || c.lastMessage,
              lastMessageTime: updated.lastMessageAt
                ? new Date(updated.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : c.lastMessageTime,
            };
          }
          return c;
        })
      );
    } catch {
      toast.error('Failed to send message');
      setConversations(prev =>
        prev.map(c =>
          c.id === selectedConversation
            ? { ...c, messages: c.messages.filter(m => m.id !== optimisticMsg.id) }
            : c
        )
      );
    }
  };

  const handleNewConversation = () => {
    toast.info('Select a user from the school directory to start a new conversation');
  };

  const handleAttachment = () => {
    toast.info('File attachments coming soon');
  };

  const selectConversation = (id: string) => {
    setSelectedConversation(id);
    setConversations(prev =>
      prev.map(c => (c.id === id ? { ...c, unreadCount: 0 } : c))
    );
  };

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <MessageSquare className="h-6 w-6 text-blue-700" />
            </div>
            <div>
              <div className="h-6 w-32 bg-muted animate-pulse rounded" />
              <div className="h-4 w-24 bg-muted animate-pulse rounded mt-1" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-0 border rounded-lg overflow-hidden" style={{ height: 'calc(100vh - 220px)', minHeight: '500px' }}>
          <div className="border-r p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-10 w-10 bg-muted animate-pulse rounded-full" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100">
            <MessageSquare className="h-6 w-6 text-blue-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Messages</h2>
            <p className="text-sm text-gray-500">
              {totalUnread > 0 ? `${totalUnread} unread messages` : 'All caught up!'}
            </p>
          </div>
        </div>
        <Button onClick={handleNewConversation} className="gap-2">
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] lg:grid-cols-[360px_1fr]" style={{ height: 'calc(100vh - 220px)', minHeight: '500px' }}>
          {/* Conversation List */}
          <div className="border-r flex flex-col">
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2">
                {filteredConversations.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">No conversations found</p>
                )}
                {filteredConversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => selectConversation(conv.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left mb-1 ${
                      selectedConversation === conv.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className={selectedConversation === conv.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}>
                          {conv.avatar}
                        </AvatarFallback>
                      </Avatar>
                      {conv.isOnline && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">{conv.participantName}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">{conv.lastMessageTime}</span>
                      </div>
                      <p className="text-xs text-gray-400 truncate">{conv.role}</p>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-xs text-gray-500 truncate flex-1">{conv.lastMessage}</p>
                        {conv.unreadCount > 0 && (
                          <Badge className="bg-blue-500 text-white text-[10px] h-5 min-w-5 px-1.5 rounded-full flex-shrink-0 ml-2">
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Message Thread */}
          {activeConversation ? (
            <div className="flex flex-col">
              {/* Header */}
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-gray-100 text-gray-600">
                        {activeConversation.avatar}
                      </AvatarFallback>
                    </Avatar>
                    {activeConversation.isOnline && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{activeConversation.participantName}</p>
                    <p className="text-xs text-gray-400">{activeConversation.role}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {activeConversation.messages.map(msg => {
                    const isOwn = msg.senderId === currentUser.id;
                    return (
                      <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] ${isOwn ? 'order-2' : ''}`}>
                          <div
                            className={`px-4 py-2.5 rounded-2xl text-sm ${
                              isOwn
                                ? 'bg-emerald-500 text-white rounded-br-md'
                                : 'bg-gray-100 text-gray-800 rounded-bl-md'
                            }`}
                          >
                            {msg.content}
                          </div>
                          <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : ''}`}>
                            <span className="text-[10px] text-gray-400">{msg.timestamp}</span>
                            {isOwn && (
                              msg.isRead
                                ? <CheckCheck className="h-3 w-3 text-blue-400" />
                                : <Check className="h-3 w-3 text-gray-400" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="p-3 border-t">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0" onClick={handleAttachment}>
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Input
                    ref={messageInputRef}
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                    className="flex-1"
                  />
                  <Button onClick={handleSendMessage} disabled={!newMessage.trim()} size="icon" className="h-9 w-9 flex-shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-400">Select a conversation to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
