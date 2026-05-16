'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, MessageCircle } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';

interface MessageUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUser: {
    id: string;
    name: string;
    role: string;
    avatar?: string | null;
  } | null;
}

const ROLE_COLORS: Record<string, string> = {
  TEACHER: 'bg-blue-100 text-blue-700',
  STUDENT: 'bg-emerald-100 text-emerald-700',
  PARENT: 'bg-purple-100 text-purple-700',
  SCHOOL_ADMIN: 'bg-amber-100 text-amber-700',
  SUPER_ADMIN: 'bg-red-100 text-red-700',
};

export function MessageUserDialog({ open, onOpenChange, targetUser }: MessageUserDialogProps) {
  const { currentUser, selectedSchoolId, setCurrentView } = useAppStore();
  const [message, setMessage] = React.useState('');
  const [sending, setSending] = React.useState(false);

  const schoolId = selectedSchoolId || currentUser.schoolId;

  const handleSendMessage = async () => {
    if (!targetUser || !message.trim() || sending) return;

    setSending(true);
    try {
      // 1. Create or find conversation
      const convRes = await fetch('/api/messaging?action=create-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId,
          participantIds: [currentUser.id, targetUser.id],
          type: 'direct',
        }),
      });

      const convJson = await convRes.json();
      if (!convRes.ok || !convJson.success) throw new Error(convJson.message || 'Failed to start conversation');

      const conversationId = convJson.data.id;

      // 2. Send the message
      const msgRes = await fetch('/api/messaging?action=send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          senderId: currentUser.id,
          schoolId,
          content: message.trim(),
        }),
      });

      if (!msgRes.ok) throw new Error('Failed to send message');

      toast.success(`Message sent to ${targetUser.name}`);
      setMessage('');
      onOpenChange(false);

      // Optional: Navigate to messages view
      // setCurrentView('messaging-center');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="size-5 text-emerald-600" />
            Send Message
          </DialogTitle>
          <DialogDescription>
            Start a direct conversation with this user.
          </DialogDescription>
        </DialogHeader>

        {targetUser && (
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 my-2">
            <Avatar className="size-10">
              <AvatarFallback className="bg-emerald-100 text-emerald-700 font-bold">
                {targetUser.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{targetUser.name}</p>
              <Badge variant="secondary" className={`text-[10px] uppercase px-1.5 py-0 ${ROLE_COLORS[targetUser.role] || ''}`}>
                {targetUser.role.replace('_', ' ')}
              </Badge>
            </div>
          </div>
        )}

        <div className="space-y-2 py-2">
          <Textarea
            placeholder="Type your message here..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[120px] resize-none"
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSendMessage}
            disabled={!message.trim() || sending}
            className="bg-emerald-600 hover:bg-emerald-700 gap-2"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Send Message
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
