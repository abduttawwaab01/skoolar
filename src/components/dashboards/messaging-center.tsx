'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MessageCircle, Search, Plus, Send, Phone, Users, Check, CheckCheck,
  Clock, ArrowLeft, X, MoreVertical, UserPlus, ChevronRight,
  Paperclip, Image, Smile, Reply, Copy, Trash2, Info, CheckCircle2,
  Circle, User, UsersRound, Sparkles, AtSign
} from 'lucide-react';
import { handleError, handleSilentError } from '@/lib/error-handler';

// ==================== TYPES ====================
interface UserResult {
  id: string; name: string; avatar: string | null; role: string; meta: string | null;
  lastLogin?: string | null;
}

interface Conversation {
  id: string; type: string; title: string | null; participantIds: string;
  lastMessage: string | null; lastMessageAt: string | null;
  unreadCount: number; participants: UserResult[];
}

interface ChatMessage {
  id: string; conversationId: string; senderId: string; content: string; type: string;
  isRead: boolean; createdAt: string;
  sender: { name: string; avatar: string | null; role: string } | null;
}

interface ReplyTo {
  messageId: string; content: string; senderName: string;
}

interface MessageReaction {
  emoji: string; count: number; isMine: boolean;
}

// ==================== CONSTANTS ====================
const EMOJI_REACTIONS = ['❤️', '👍', '😂', '🎉', '🤔', '😮', '😢', '🔥'];

const ROLE_COLORS: Record<string, string> = {
  TEACHER: 'bg-blue-100 text-blue-700 border-blue-200',
  STUDENT: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  PARENT: 'bg-purple-100 text-purple-700 border-purple-200',
  SCHOOL_ADMIN: 'bg-amber-100 text-amber-700 border-amber-200',
  SUPER_ADMIN: 'bg-red-100 text-red-700 border-red-200',
  ACCOUNTANT: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  LIBRARIAN: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  DIRECTOR: 'bg-rose-100 text-rose-700 border-rose-200',
};

const ROLE_LABELS: Record<string, string> = {
  TEACHER: 'Teacher', STUDENT: 'Student', PARENT: 'Parent',
  SCHOOL_ADMIN: 'Admin', SUPER_ADMIN: 'Super Admin',
  ACCOUNTANT: 'Accountant', LIBRARIAN: 'Librarian', DIRECTOR: 'Director',
};

const ROLE_ICONS: Record<string, string> = {
  TEACHER: '📚', STUDENT: '🎓', PARENT: '👨‍👩‍👧‍👦',
  SCHOOL_ADMIN: '🏫', SUPER_ADMIN: '🛡️',
};

// ==================== HELPERS ====================
function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const daysAgo = Math.floor(diff / 86400000);
  if (daysAgo < 7) return `${daysAgo}d ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (msgDate.getTime() === today.getTime()) return 'Today';
  if (msgDate.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}

function isUserOnline(lastLogin: string | null | undefined): boolean {
  if (!lastLogin) return false;
  const loginDate = new Date(lastLogin);
  const diff = Date.now() - loginDate.getTime();
  return diff < 300000; // Online if last login was within 5 minutes
}

function isSameDay(d1: string, d2: string): boolean {
  const a = new Date(d1);
  const b = new Date(d2);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ==================== COMPONENT ====================
export function MessagingCenter() {
  const { currentUser, currentRole, selectedSchoolId } = useAppStore();
  const schoolId = selectedSchoolId || currentUser.schoolId;

  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [convSearchQuery, setConvSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<UserResult[]>([]);
  const [sending, setSending] = useState(false);
  const [showConvInfo, setShowConvInfo] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);
  const [reactionMsgId, setReactionMsgId] = useState<string | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, MessageReaction[]>>({});
  const [contextMenuMsg, setContextMenuMsg] = useState<ChatMessage | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [simulatedTyping, setSimulatedTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const reactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isAdmin = ['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(currentRole);

  // ==================== FETCH ====================
  const fetchConversations = useCallback(async () => {
    if (!schoolId || !currentUser.id) return;
    try {
      const res = await fetch(`/api/messaging?action=conversations&userId=${currentUser.id}&schoolId=${schoolId}`);
      const json = await res.json();
      if (json.success) setConversations(json.data || []);
    } catch (error: unknown) { handleSilentError(error); }
  }, [schoolId, currentUser.id]);

  const fetchMessages = useCallback(async (convId: string) => {
    setMessagesLoading(true);
    try {
      const res = await fetch(`/api/messaging?action=messages&conversationId=${convId}&limit=100`);
      const json = await res.json();
      if (json.success) {
        setMessages(json.data || []);
        fetch('/api/messaging?action=mark-read', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: convId, userId: currentUser.id }),
        }).catch(() => {});
        fetchConversations();
      }
    } catch (error: unknown) { handleSilentError(error); } finally { setMessagesLoading(false); }
  }, [currentUser.id, fetchConversations]);

  useEffect(() => {
    fetchConversations().then(() => setLoading(false));
  }, [fetchConversations]);

  useEffect(() => {
    if (!selectedConv) return;
    fetchMessages(selectedConv.id);
    
    // Poll every 10 seconds, but only when tab is visible
    pollRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchMessages(selectedConv.id);
      }
    }, 10000);
    
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedConv, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Simulate typing indicator
  useEffect(() => {
    if (!selectedConv) return;
    const others = selectedConv.participants.filter(p => p.id !== currentUser.id);
    if (others.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.senderId === currentUser.id) {
      const timer = setTimeout(() => setSimulatedTyping(true), 1500);
      const timer2 = setTimeout(() => setSimulatedTyping(false), 4000);
      return () => { clearTimeout(timer); clearTimeout(timer2); };
    }
  }, [messages, selectedConv, currentUser.id]);

  // ==================== SEARCH ====================
  const searchUsers = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/messaging?action=search-users&schoolId=${schoolId}&query=${query}`);
      const json = await res.json();
      if (json.success) setSearchResults((json.data || []).filter((u: UserResult) => u.id !== currentUser.id));
    } catch (error: unknown) { handleSilentError(error); } finally { setSearching(false); }
  };

  // ==================== CONVERSATION HELPERS ====================
  const getConversationName = (conv: Conversation): string => {
    if (conv.title) return conv.title;
    const others = conv.participants.filter(p => p.id !== currentUser.id);
    return others.map(p => p.name).join(', ') || 'Unknown';
  };

  const getConversationAvatar = (conv: Conversation): string => {
    if (conv.type === 'group') return '👥';
    const others = conv.participants.filter(p => p.id !== currentUser.id);
    return others.map(p => p.name).map(n => n.split(' ').map(w => w[0]).join('').slice(0, 2)).join(', ') || '?';
  };

  const selectConversation = (conv: Conversation) => {
    setSelectedConv(conv);
    setMobileShowChat(true);
    setReplyTo(null);
    setMessageReactions({});
  };

  const filteredConversations = useMemo(() => {
    if (!convSearchQuery.trim()) return conversations;
    const q = convSearchQuery.toLowerCase();
    return conversations.filter(conv => {
      const name = getConversationName(conv).toLowerCase();
      return name.includes(q);
    });
  }, [conversations, convSearchQuery]);

  // ==================== SEND / CREATE ====================
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConv || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/messaging?action=send-message', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConv.id, senderId: currentUser.id, schoolId,
          content: newMessage.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setMessages(prev => [...prev, json.data]);
        setNewMessage('');
        setReplyTo(null);
        fetchConversations();
      } else toast.error(json.message);
    } catch (error: unknown) { handleSilentError(error); toast.error('Failed to send'); } finally { setSending(false); }
  };

  const createConversation = async () => {
    if (selectedUsers.length === 0) return;
    try {
      const participantIds = [currentUser.id, ...selectedUsers.map(u => u.id)];
      const res = await fetch('/api/messaging?action=create-conversation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId, participantIds,
          type: selectedUsers.length === 1 ? 'direct' : 'group',
          title: selectedUsers.length > 1 ? `Group: ${selectedUsers.map(u => u.name.split(' ')[0]).join(', ')}` : undefined,
          createdBy: currentUser.id,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Conversation created');
        setNewConvOpen(false);
        setSelectedUsers([]);
        setSearchQuery('');
        setSearchResults([]);
        fetchConversations().then(() => {
          if (json.data?.id) selectConversation(json.data as unknown as Conversation);
        });
      } else toast.error(json.message);
    } catch (error: unknown) { handleSilentError(error); toast.error('Failed to create'); }
  };

  // ==================== MESSAGE ACTIONS ====================
  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content).then(() => toast.success('Copied to clipboard')).catch(() => toast.error('Failed to copy'));
    setContextMenuMsg(null);
  };

  const deleteMessage = (msgId: string) => {
    toast.info('Delete is handled server-side');
    setContextMenuMsg(null);
  };

  const addReaction = (msgId: string, emoji: string) => {
    setMessageReactions(prev => {
      const current = prev[msgId] || [];
      const existing = current.find(r => r.emoji === emoji);
      if (existing) {
        if (existing.isMine) {
          return { ...prev, [msgId]: current.filter(r => r.emoji !== emoji) };
        } else {
          return { ...prev, [msgId]: current.map(r => r.emoji === emoji ? { ...r, count: r.count + 1, isMine: true } : r) };
        }
      }
      return { ...prev, [msgId]: [...current, { emoji, count: 1, isMine: true }] };
    });
    setReactionMsgId(null);
  };

  const toggleReactionPicker = (msgId: string) => {
    setReactionMsgId(prev => prev === msgId ? null : msgId);
    if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
    reactionTimeoutRef.current = setTimeout(() => setReactionMsgId(null), 5000);
  };

  // ==================== RENDER: MESSAGE BUBBLE ====================
  const renderMessageBubble = (msg: ChatMessage, showDate: boolean, dateLabel: string) => {
    const isMine = msg.senderId === currentUser.id;
    const isLast = true;
    const reactions = messageReactions[msg.id] || [];

    return (
      <React.Fragment key={msg.id}>
        {showDate && (
          <div className="flex items-center gap-3 py-2">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground font-medium bg-muted px-3 py-1 rounded-full">{dateLabel}</span>
            <Separator className="flex-1" />
          </div>
        )}
        <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} group relative`}>
          <div className={`max-w-[75%] md:max-w-[65%] ${isMine ? 'order-2' : ''}`}>
            {!isMine && (
              <div className="flex items-center gap-2 mb-1 ml-1">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-xs bg-emerald-100 text-emerald-700">
                    {msg.sender?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium text-gray-600">{msg.sender?.name || 'Unknown'}</span>
                {msg.sender?.role && (
                  <Badge className={`text-xs px-1.5 py-0 border ${ROLE_COLORS[msg.sender.role] || 'bg-gray-100 text-gray-700'}`}>
                    {ROLE_ICONS[msg.sender.role] || ''} {ROLE_LABELS[msg.sender.role] || msg.sender.role}
                  </Badge>
                )}
              </div>
            )}

            {/* Reply quote */}
            {replyTo && replyTo.messageId === msg.id && null}

            <div className="relative">
              <div
                className={`rounded-2xl px-4 py-2.5 cursor-pointer transition-colors ${
                  isMine
                    ? 'bg-emerald-600 text-white rounded-br-md'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200/80 rounded-bl-md'
                }`}
                onClick={() => setContextMenuMsg(contextMenuMsg?.id === msg.id ? null : msg)}
              >
                <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
              </div>

              {/* Reaction picker */}
              {reactionMsgId === msg.id && (
                <div className={`absolute ${isMine ? '-left-2' : 'right-2'} -top-10 z-20 bg-white border rounded-xl shadow-lg p-1.5 flex gap-1 animate-in fade-in slide-in-from-bottom-2 duration-200`}>
                  {EMOJI_REACTIONS.map(emoji => (
                    <button
                      key={emoji}
                      className="hover:scale-125 transition-transform p-0.5"
                      onClick={(e) => { e.stopPropagation(); addReaction(msg.id, emoji); }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {/* Context menu */}
              {contextMenuMsg?.id === msg.id && (
                <div className={`absolute ${isMine ? 'right-0' : 'left-0'} top-full mt-1 z-20 bg-white border rounded-xl shadow-lg py-1 min-w-[140px] animate-in fade-in slide-in-from-top-1 duration-150`}>
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors" onClick={() => { setReplyTo({ messageId: msg.id, content: msg.content.slice(0, 80), senderName: msg.sender?.name || 'Unknown' }); setContextMenuMsg(null); }}>
                    <Reply className="h-3.5 w-3.5" /> Reply
                  </button>
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors" onClick={() => copyMessage(msg.content)}>
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </button>
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors" onClick={() => toggleReactionPicker(msg.id)}>
                    <Smile className="h-3.5 w-3.5" /> React
                  </button>
                  {isMine && (
                    <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors" onClick={() => deleteMessage(msg.id)}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Reactions */}
            {reactions.length > 0 && (
              <div className="flex flex-wrap gap-0.5 mt-0.5">
                {reactions.map(r => (
                  <button
                    key={r.emoji}
                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border ${
                      r.isMine ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-600'
                    }`}
                    onClick={() => addReaction(msg.id, r.emoji)}
                  >
                    {r.emoji} {r.count > 1 && <span className="text-[10px]">{r.count}</span>}
                  </button>
                ))}
              </div>
            )}

            {/* Timestamp & status */}
            <div className={`flex items-center gap-1.5 mt-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
              <span className="text-[10px] text-gray-400">{formatTime(msg.createdAt)}</span>
              {isMine && (
                <span className="text-emerald-400">
                  {msg.isRead ? <CheckCheck className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                </span>
              )}
            </div>
          </div>
        </div>
      </React.Fragment>
    );
  };

  // ==================== RENDER: EMPTY STATE ====================
  const renderEmptyState = () => (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="relative mx-auto w-32 h-32 mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-3xl rotate-6 opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-3xl -rotate-3 opacity-30" />
          <div className="relative w-full h-full bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-dashed border-emerald-200 rounded-3xl flex items-center justify-center">
            <MessageCircle className="h-12 w-12 text-emerald-400" />
          </div>
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">Start a Conversation</h3>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          Connect with teachers, students, and parents. Share ideas, discuss assignments, and stay informed about school activities.
        </p>
        <Dialog open={newConvOpen} onOpenChange={setNewConvOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4" /> New Conversation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Conversation</DialogTitle>
              <DialogDescription>Search and select people to start chatting with.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by name..." value={searchQuery} onChange={e => searchUsers(e.target.value)} className="pl-9" />
              </div>
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedUsers.map(u => (
                    <Badge key={u.id} variant="secondary" className="cursor-pointer gap-1 pr-1" onClick={() => setSelectedUsers(prev => prev.filter(su => su.id !== u.id))}>
                      {u.name} <X className="h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              )}
              <ScrollArea className="max-h-60">
                {searching && <Skeleton className="h-10 w-full" />}
                {!searching && searchResults.length === 0 && searchQuery.length >= 2 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
                )}
                {searchResults.map(u => (
                  <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => { if (!selectedUsers.find(su => su.id === u.id)) setSelectedUsers(prev => [...prev, u]); }}>
                    <div className="relative">
                      <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{u.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback></Avatar>
                      {isUserOnline(u.lastLogin) && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.name}</p>
                      <div className="flex items-center gap-1.5">
                        <Badge className={`text-xs px-1.5 py-0 border ${ROLE_COLORS[u.role] || ''}`}>{ROLE_LABELS[u.role] || u.role}</Badge>
                        {u.meta && <span className="text-[10px] text-gray-400">{u.meta}</span>}
                      </div>
                    </div>
                    {isUserOnline(u.lastLogin) && <span className="text-[10px] text-emerald-500 font-medium">Online</span>}
                  </div>
                ))}
              </ScrollArea>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setNewConvOpen(false); setSelectedUsers([]); setSearchQuery(''); setSearchResults([]); }}>Cancel</Button>
              <Button onClick={createConversation} disabled={selectedUsers.length === 0} className="gap-1 bg-emerald-600 hover:bg-emerald-700">
                <Send className="h-4 w-4" /> {selectedUsers.length > 1 ? `Start Group (${selectedUsers.length})` : 'Start Chat'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );

  // ==================== RENDER: CONVERSATION INFO PANEL ====================
  const renderConvInfo = () => {
    if (!selectedConv) return null;
    const isGroup = selectedConv.type === 'group';
    return (
      <div className="w-72 border-l bg-gray-50/50 flex-shrink-0 hidden lg:flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-sm">Conversation Info</h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowConvInfo(false)}><X className="h-4 w-4" /></Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            <div className="text-center">
              <Avatar className="h-16 w-16 mx-auto mb-2">
                <AvatarFallback className="text-lg bg-emerald-100 text-emerald-700">{getConversationAvatar(selectedConv)}</AvatarFallback>
              </Avatar>
              <p className="font-semibold text-sm">{getConversationName(selectedConv)}</p>
              {isGroup && <Badge className="mt-1 bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]"><UsersRound className="h-3 w-3 mr-1" /> Group</Badge>}
            </div>
            <Separator />
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Members ({selectedConv.participants.length})</p>
              <div className="space-y-2">
                {selectedConv.participants.map(p => (
                  <div key={p.id} className="flex items-center gap-2.5">
                    <div className="relative">
                      <Avatar className="h-8 w-8"><AvatarFallback className="text-[10px]">{p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback></Avatar>
                      {isUserOnline(p.lastLogin) && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{p.name}</p>
                      <div className="flex items-center gap-1">
                        <Badge className={`text-xs px-1 py-0 border ${ROLE_COLORS[p.role] || ''}`}>{ROLE_LABELS[p.role] || p.role}</Badge>
                        {p.id === currentUser.id && <span className="text-xs text-emerald-500">(You)</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {isGroup && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Actions</p>
                  <Button variant="outline" className="w-full gap-2 text-xs h-8" onClick={() => { setNewConvOpen(true); }}>
                    <UserPlus className="h-3.5 w-3.5" /> Add Member
                  </Button>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  };

  // ==================== RENDER: CHAT AREA ====================
  const renderChatArea = () => {
    if (!selectedConv) return renderEmptyState();

    const isGroup = selectedConv.type === 'group';

    return (
      <>
        {/* Chat Header */}
        <div className="px-4 py-3 border-b flex items-center gap-3 bg-white">
          <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={() => setMobileShowChat(false)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="relative">
            <Avatar className="h-9 w-9 cursor-pointer" onClick={() => setShowConvInfo(!showConvInfo)}>
              <AvatarFallback className={`text-xs ${isGroup ? 'bg-teal-100 text-teal-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {getConversationAvatar(selectedConv)}
              </AvatarFallback>
            </Avatar>
            {!isGroup && (() => {
              const other = selectedConv.participants.find(p => p.id !== currentUser.id);
              return isUserOnline(other?.lastLogin) ? (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white">
                  <span className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-75" />
                </span>
              ) : null;
            })()}
          </div>
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setShowConvInfo(!showConvInfo)}>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900 truncate">{getConversationName(selectedConv)}</p>
              {isGroup && (
                <Badge className="bg-teal-100 text-teal-700 border-teal-200 text-xs px-1.5">
                  <UsersRound className="h-2.5 w-2.5 mr-0.5" /> {selectedConv.participants.length}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {!isGroup && (() => {
                const other = selectedConv.participants.find(p => p.id !== currentUser.id);
                return other ? (
                  <>
                    <span className={`w-1.5 h-1.5 rounded-full ${isUserOnline(other.lastLogin) ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                    <p className="text-xs text-gray-500">
                      {isUserOnline(other.lastLogin) ? 'Online' : 'Offline'}
                    </p>
                    {other.role && <Badge className={`text-xs px-1 py-0 border ml-1 ${ROLE_COLORS[other.role] || ''}`}>{ROLE_LABELS[other.role]}</Badge>}
                  </>
                ) : null;
              })()}
              {isGroup && (
                <p className="text-xs text-gray-500">{selectedConv.participants.length} members</p>
              )}
              {simulatedTyping && (
                <span className="text-xs text-emerald-500 animate-pulse">typing...</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowConvInfo(!showConvInfo)}>
                    <Info className="h-4 w-4 text-gray-500" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Conversation details</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-red-600 gap-2"><Trash2 className="h-3.5 w-3.5" /> Delete Conversation</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          {messagesLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                  <Skeleton className={`h-12 ${i % 2 === 0 ? 'w-3/5' : 'w-2/5'} rounded-2xl`} />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-emerald-400" />
              </div>
              <p className="text-sm font-medium text-gray-700 mb-1">No messages yet</p>
              <p className="text-xs text-gray-400">Send the first message to start the conversation!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, i) => {
                let showDate = false;
                let dateLabel = '';
                if (i === 0) {
                  showDate = true;
                  dateLabel = getDateLabel(msg.createdAt);
                } else if (!isSameDay(messages[i - 1].createdAt, msg.createdAt)) {
                  showDate = true;
                  dateLabel = getDateLabel(msg.createdAt);
                }
                return renderMessageBubble(msg, showDate, dateLabel);
              })}
            </div>
          )}
          {simulatedTyping && (
            <div className="flex items-center gap-2 mt-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs bg-gray-200">
                  {(() => {
                    const other = selectedConv.participants.find(p => p.id !== currentUser.id);
                    return other?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?';
                  })()}
                </AvatarFallback>
              </Avatar>
              <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-2.5">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </ScrollArea>

        {/* Reply bar */}
        {replyTo && (
          <div className="px-4 py-2 bg-emerald-50 border-t flex items-center gap-2">
            <Reply className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-emerald-600 font-medium">{replyTo.senderName}</p>
              <p className="text-xs text-gray-500 truncate">{replyTo.content}{replyTo.content.length >= 80 ? '...' : ''}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => setReplyTo(null)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Message Input */}
        <div className="p-3 border-t bg-white">
          <div className="flex items-end gap-2">
            <div className="flex gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-gray-400 hover:text-emerald-600" onClick={() => toast.info('File attachments coming soon!')}>
                      <Paperclip className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Attach file</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-gray-400 hover:text-emerald-600" onClick={() => toast.info('Image upload coming soon!')}>
                      <Image className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Send image</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex-1 relative">
              <Textarea
                ref={inputRef}
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Type a message..."
                className="flex-1 min-h-[40px] max-h-32 resize-none rounded-xl pr-10 text-sm"
                rows={1}
              />
            </div>
            <Button onClick={sendMessage} disabled={!newMessage.trim() || sending} size="icon" className="h-9 w-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 flex-shrink-0">
              {sending ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1 text-center">
            Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs font-mono">Enter</kbd> to send, <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs font-mono">Shift+Enter</kbd> for new line
          </p>
        </div>
      </>
    );
  };

  // ==================== RENDER: CONV LIST ====================
  const renderConvList = () => (
    <Card className="w-full md:w-80 lg:w-96 flex-shrink-0 flex flex-col border-0 md:border md:rounded-xl overflow-hidden">
      <CardContent className="p-3 flex flex-col h-full gap-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-600" /> Messages
          </h2>
          <Dialog open={newConvOpen} onOpenChange={setNewConvOpen}>
            <DialogTrigger asChild>
              <Button size="icon" className="h-8 w-8 bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-emerald-600" /> New Conversation
                </DialogTitle>
                <DialogDescription>Search and select people to start chatting.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by name..." value={searchQuery} onChange={e => searchUsers(e.target.value)} className="pl-9" />
                </div>
                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedUsers.map(u => (
                      <Badge key={u.id} variant="secondary" className="cursor-pointer gap-1 pr-1" onClick={() => setSelectedUsers(prev => prev.filter(su => su.id !== u.id))}>
                        {u.name} <X className="h-3 w-3" />
                      </Badge>
                    ))}
                  </div>
                )}
                <ScrollArea className="max-h-60">
                  {searching && <Skeleton className="h-10 w-full" />}
                  {!searching && searchResults.length === 0 && searchQuery.length >= 2 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
                  )}
                  {searchResults.map(u => (
                    <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => { if (!selectedUsers.find(su => su.id === u.id)) setSelectedUsers(prev => [...prev, u]); }}>
                      <div className="relative">
                        <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{u.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback></Avatar>
                        {isUserOnline(u.lastLogin) && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.name}</p>
                        <div className="flex items-center gap-1.5">
                          <Badge className={`text-xs px-1.5 py-0 border ${ROLE_COLORS[u.role] || ''}`}>{ROLE_LABELS[u.role] || u.role}</Badge>
                          {u.meta && <span className="text-[10px] text-gray-400">{u.meta}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setNewConvOpen(false); setSelectedUsers([]); setSearchQuery(''); setSearchResults([]); }}>Cancel</Button>
                <Button onClick={createConversation} disabled={selectedUsers.length === 0} className="gap-1 bg-emerald-600 hover:bg-emerald-700">
                  <Send className="h-4 w-4" /> {selectedUsers.length > 1 ? `Start Group (${selectedUsers.length})` : 'Start Chat'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={convSearchQuery}
            onChange={e => setConvSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
          {convSearchQuery && (
            <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setConvSearchQuery('')}>
              <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        {/* List */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/5" />
                    <Skeleton className="h-3 w-4/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <MessageCircle className="h-7 w-7 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                {convSearchQuery ? 'No conversations found' : 'No conversations yet'}
              </p>
              <p className="text-xs text-gray-400">
                {convSearchQuery ? 'Try a different search term' : 'Start a new conversation to get going'}
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredConversations.map(conv => {
                const other = conv.participants.find(p => p.id !== currentUser.id);
                const isGroup = conv.type === 'group';
                const isUnread = conv.unreadCount > 0;
                const isSelected = selectedConv?.id === conv.id;

                return (
                  <div
                    key={conv.id}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-150 ${
                      isSelected
                        ? 'bg-emerald-50 border border-emerald-200 shadow-sm'
                        : 'hover:bg-gray-50 border border-transparent'
                    } ${isUnread ? '' : ''}`}
                    onClick={() => selectConversation(conv)}
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar className="h-11 w-11">
                        <AvatarFallback className={`text-xs ${isGroup ? 'bg-teal-100 text-teal-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {getConversationAvatar(conv)}
                        </AvatarFallback>
                      </Avatar>
                      {!isGroup && isUserOnline(other?.lastLogin) && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white">
                          <span className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-50" />
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className={`text-sm truncate ${isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                            {getConversationName(conv)}
                          </p>
                          {isGroup && (
                            <Badge className="bg-teal-100 text-teal-600 border-teal-200 text-xs px-1 py-0 flex-shrink-0">
                              <UsersRound className="h-2 w-2 mr-0.5" />{conv.participants.length}
                            </Badge>
                          )}
                          {!isGroup && other?.role && (
                            <Badge className={`text-xs px-1 py-0 border flex-shrink-0 ${ROLE_COLORS[other.role] || ''}`}>
                              {ROLE_ICONS[other.role] || ''}
                            </Badge>
                          )}
                        </div>
                        {conv.lastMessageAt && (
                          <span className={`text-[10px] flex-shrink-0 ${isUnread ? 'text-emerald-600 font-semibold' : 'text-gray-400'}`}>
                            {formatTime(conv.lastMessageAt)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-0.5 gap-2">
                        <p className={`text-xs truncate ${isUnread ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>
                          {conv.lastMessage || 'No messages yet'}
                        </p>
                        {isUnread && (
                          <Badge className="bg-emerald-600 text-white text-[10px] h-5 min-w-5 flex items-center justify-center px-1.5 rounded-full flex-shrink-0">
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );

  // ==================== MAIN RENDER ====================
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-[calc(100vh-8rem)] gap-0 md:gap-4">
        {/* Conversation List - always visible on desktop, toggleable on mobile */}
        <div className={`${mobileShowChat ? 'hidden md:flex' : 'flex'} w-full md:w-auto flex-shrink-0 flex-col`}>
          {renderConvList()}
        </div>

        {/* Chat Area - hidden on mobile until conversation selected */}
        <div className={`${!mobileShowChat ? 'hidden md:flex' : 'flex'} flex-1 flex-col md:flex rounded-xl border overflow-hidden bg-white`}>
          {renderChatArea()}
        </div>

        {/* Info Panel - desktop only */}
        {showConvInfo && selectedConv && (
          <div className="hidden lg:flex">
            {renderConvInfo()}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
