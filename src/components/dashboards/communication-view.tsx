'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Send, Mail, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
  isRead: boolean;
}

interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  messageCount: number;
  participantIds: string[];
}

function getInitials(name: string) {
  return name.split(' ').filter(w => w.length > 1).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export function CommunicationView() {
  const { selectedSchoolId, currentUser } = useAppStore();
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [selectedConversation, setSelectedConversation] = React.useState<Conversation | null>(null);
  const [replyText, setReplyText] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [newMsgOpen, setNewMsgOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [recipient, setRecipient] = React.useState('');
  const [subject, setSubject] = React.useState('');
  const [initialMessage, setInitialMessage] = React.useState('');

  // Fetch conversations
  React.useEffect(() => {
    if (!selectedSchoolId) {
      setLoading(false);
      setConversations([]);
      return;
    }

    setLoading(true);
    fetch(`/api/communication?schoolId=${selectedSchoolId}`)
      .then(res => res.json())
      .then(json => {
        const data = json.data || [];
        setConversations(data);
      })
      .catch(() => {
        toast.error('Failed to load conversations');
        setConversations([]);
      })
      .finally(() => setLoading(false));
  }, [selectedSchoolId]);

  // Fetch messages when a conversation is selected
  React.useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      return;
    }

    fetch(`/api/messages?conversationId=${selectedConversation.id}`)
      .then(res => res.json())
      .then(json => {
        const data = json.data || [];
        // Transform to include senderName
        const transformed = data.map((msg: any) => ({
          id: msg.id,
          senderId: msg.senderId,
          senderName: msg.sender.name,
          content: msg.content,
          createdAt: msg.createdAt,
          isRead: msg.isRead,
        }));
        setMessages(transformed);
      })
      .catch(() => {
        toast.error('Failed to load messages');
        setMessages([]);
      });
  }, [selectedConversation]);

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedConversation) return;

    setSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          content: replyText.trim(),
          type: 'text',
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to send message');
      }

      const newMessage = await res.json();
      setMessages(prev => [...prev, {
        id: newMessage.data.id,
        senderId: newMessage.data.senderId,
        senderName: currentUser.name,
        content: newMessage.data.content,
        createdAt: newMessage.data.createdAt,
        isRead: newMessage.data.isRead,
      }]);
      setReplyText('');
      toast.success('Message sent');

      // Refresh conversations to update last message
      const refreshed = await fetch(`/api/communication?schoolId=${selectedSchoolId}`)
        .then(r => r.json())
        .then(j => j.data || []);
      setConversations(refreshed);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleCreateConversation = async () => {
    if (!selectedSchoolId || !recipient || !subject.trim() || !initialMessage.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSending(true);
    try {
      // Create conversation
      const convRes = await fetch('/api/communication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: selectedSchoolId,
          participantIds: [recipient], // For now, single recipient; can expand to "all teachers" etc.
          title: subject.trim(),
          initialMessage: initialMessage.trim(),
        }),
      });

      if (!convRes.ok) {
        const error = await convRes.json();
        throw new Error(error.error || 'Failed to create conversation');
      }

      toast.success('Message sent successfully');
      setNewMsgOpen(false);
      setRecipient('');
      setSubject('');
      setInitialMessage('');

      // Refresh conversations
      const refreshed = await fetch(`/api/communication?schoolId=${selectedSchoolId}`)
        .then(r => r.json())
        .then(j => j.data || []);
      setConversations(refreshed);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const filteredConversations = conversations.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!selectedSchoolId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Mail className="size-12 opacity-30" />
        <p className="mt-3 text-sm">Select a school to view communication</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-6 w-24 mb-2" />
            <Skeleton className="h-4 w-36" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 lg:grid-cols-5 min-h-[500px]">
          <Skeleton className="lg:col-span-2 h-full" />
          <Skeleton className="lg:col-span-3 h-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Mail className="size-5" />
            Communication
          </h2>
          <p className="text-sm text-muted-foreground">
            {conversations.reduce((acc, c) => acc + c.unreadCount, 0)} unread messages
          </p>
        </div>
        <Dialog open={newMsgOpen} onOpenChange={setNewMsgOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" />
              New Message
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Message</DialogTitle>
              <DialogDescription>Send a message to a recipient.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Recipient User ID</Label>
                <Input
                  placeholder="Enter user ID"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                  Note: Currently requires user ID. Future: search users by name/role.
                </p>
              </div>
              <div className="grid gap-2">
                <Label>Subject</Label>
                <Input
                  placeholder="Message subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Message</Label>
                <Textarea
                  placeholder="Write your message..."
                  value={initialMessage}
                  onChange={(e) => setInitialMessage(e.target.value)}
                  rows={5}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewMsgOpen(false)}>Cancel</Button>
              <Button className="gap-2" onClick={handleCreateConversation} disabled={sending}>
                {sending && <Loader2 className="size-4 animate-spin" />}
                Send Message
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 lg:grid-cols-5 min-h-[500px]">
        <Card className="lg:col-span-2 p-0">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <ScrollArea className="h-[450px]">
            {filteredConversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  'p-3 cursor-pointer hover:bg-muted/50 border-b transition-colors',
                  selectedConversation?.id === conv.id && 'bg-muted',
                )}
                onClick={() => setSelectedConversation(conv)}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold bg-emerald-500'
                  )}>
                    {getInitials(conv.title)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn('text-sm truncate font-semibold', conv.unreadCount === 0 && 'font-normal')}>
                        {conv.title}
                      </span>
                    </div>
                    <p className="text-xs truncate mt-0.5 text-muted-foreground">
                      {conv.lastMessage}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(conv.lastMessageAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-2" />
                  )}
                </div>
              </div>
            ))}
          </ScrollArea>
        </Card>

        <Card className="lg:col-span-3 p-0">
          {selectedConversation ? (
            <div className="flex flex-col h-full">
              <div className="p-4 border-b">
                <div className="flex items-start gap-3">
                  <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-full text-white font-bold text-sm bg-emerald-500')}>
                    {getInitials(selectedConversation.title)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm">{selectedConversation.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {selectedConversation.messageCount} messages
                    </p>
                  </div>
                </div>
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className={cn('flex gap-3', msg.senderId === currentUser.id ? 'flex-row-reverse' : '')}>
                      <div className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold',
                        msg.senderId === currentUser.id ? 'bg-blue-500' : 'bg-emerald-500'
                      )}>
                        {getInitials(msg.senderName || 'User')}
                      </div>
                      <div className={cn(
                        'rounded-lg px-3 py-2 max-w-[70%]',
                        msg.senderId === currentUser.id ? 'bg-blue-50 ml-auto' : 'bg-muted'
                      )}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold">{msg.senderName}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-line">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="p-4 border-t">
                <div className="flex items-center gap-2">
                  <Textarea
                    placeholder="Type your reply..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="flex-1 min-h-[60px]"
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendReply();
                      }
                    }}
                  />
                  <Button size="icon" className="shrink-0 self-end" onClick={handleSendReply} disabled={sending || !replyText.trim()}>
                    {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground">
              <Mail className="size-10 opacity-40" />
              <p className="mt-2 text-sm">Select a conversation to read</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// Import Loader2 for loading states
import { Loader2 } from 'lucide-react';
function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse bg-muted rounded', className)} />;
}
