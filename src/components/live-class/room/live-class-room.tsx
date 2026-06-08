'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  ControlBar,
  RoomAudioRenderer,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  MessageSquare, Users, Hand, LogOut,
  Copy, Send, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LiveClassRoomProps {
  room: string;
  token: string;
  liveClass: any;
  identity: string;
  displayName: string;
  isHost: boolean;
  guestId: string;
  micEnabled: boolean;
  camEnabled: boolean;
  onEnd: () => void;
}

export default function LiveClassRoom({
  room, token, liveClass, identity, displayName,
  isHost, guestId, micEnabled, camEnabled, onEnd,
}: LiveClassRoomProps) {
  const [sidebar, setSidebar] = useState<'chat' | 'participants' | null>('chat');
  const [handRaised, setHandRaised] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/live-classes/${liveClass.id}/chat`)
      .then(r => r.json())
      .then(json => setMessages(json.data || []))
      .catch(() => {});
  }, [liveClass.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    try {
      const res = await fetch(`/api/live-classes/${liveClass.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: chatInput,
          guestId: guestId || undefined,
          senderName: displayName,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setMessages(prev => [...prev, json.data]);
        setChatInput('');
      }
    } catch {}
  };

  const handleEndClass = async () => {
    try {
      await fetch(`/api/live-classes/${liveClass.id}/end`, { method: 'POST' });
      toast.success('Class ended');
      onEnd();
    } catch {
      toast.error('Failed to end class');
    }
  };

  const toggleHandRaise = () => {
    setHandRaised(!handRaised);
  };

  const copyInvite = () => {
    const url = `${window.location.origin}/live/class/${liveClass.id}/lobby`;
    const code = liveClass.joinCode;
    navigator.clipboard.writeText(`Join my live class: ${liveClass.title}\nCode: ${code}\nLink: ${url}`);
    toast.success('Invite link copied!');
  };

  return (
    <div className="h-screen w-screen bg-slate-900 flex overflow-hidden">
      {/* Main Video Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="h-12 bg-slate-800/50 backdrop-blur border-b border-slate-700/50 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-white font-medium truncate text-sm">{liveClass.title}</span>
            <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-[10px]">
              {liveClass.type}
            </Badge>
            <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-[10px]">
              {liveClass.joinCode}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={copyInvite}
              className="text-slate-400 hover:text-white text-xs h-8">
              <Copy className="size-3.5 mr-1" /> Invite
            </Button>
            {isHost && (
              <Button variant="destructive" size="sm" onClick={handleEndClass}
                className="text-xs h-8">
                <LogOut className="size-3.5 mr-1" /> End
              </Button>
            )}
          </div>
        </div>

        {/* Video Grid */}
        <div className="flex-1 relative">
          <LiveKitRoom
            serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880'}
            token={token}
            connect={true}
            onConnected={() => setIsConnected(true)}
            onDisconnected={() => setIsConnected(false)}
            style={{ height: '100%', width: '100%' }}
          >
            <RoomAudioRenderer />
            <VideoConference />
          </LiveKitRoom>
        </div>

        {/* Bottom Controls */}
        <div className="h-16 bg-slate-800/50 backdrop-blur border-t border-slate-700/50 flex items-center justify-center gap-3 px-4 shrink-0">
          <ControlBar
            controls={{
              microphone: true,
              camera: true,
              screenShare: true,
              leave: true,
            }}
          />

          <Separator orientation="vertical" className="h-8 bg-slate-700" />

          <Button
            variant={handRaised ? 'default' : 'ghost'}
            size="icon"
            onClick={toggleHandRaise}
            className={cn(
              'rounded-full size-10',
              handRaised
                ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                : 'text-slate-400 hover:text-white'
            )}
          >
            <Hand className="size-5" />
          </Button>

          <Separator orientation="vertical" className="h-8 bg-slate-700" />

          <Button
            variant={sidebar === 'chat' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setSidebar(sidebar === 'chat' ? null : 'chat')}
            className="rounded-full size-10 text-slate-400 hover:text-white"
          >
            <MessageSquare className="size-5" />
          </Button>

          <Button
            variant={sidebar === 'participants' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setSidebar(sidebar === 'participants' ? null : 'participants')}
            className="rounded-full size-10 text-slate-400 hover:text-white"
          >
            <Users className="size-5" />
          </Button>
        </div>
      </div>

      {/* Sidebar */}
      {sidebar && (
        <div className="w-80 bg-slate-800/80 backdrop-blur border-l border-slate-700/50 flex flex-col shrink-0">
          {/* Sidebar Header */}
          <div className="h-12 border-b border-slate-700/50 flex items-center justify-between px-4 shrink-0">
            <span className="text-white text-sm font-medium">
              {sidebar === 'chat' ? 'Chat' : 'Participants'}
            </span>
            <Button variant="ghost" size="icon" className="size-8 text-slate-400"
              onClick={() => setSidebar(null)}>
              <X className="size-4" />
            </Button>
          </div>

          {sidebar === 'chat' && (
            <>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {messages.length === 0 && (
                    <p className="text-slate-500 text-xs text-center py-8">
                      No messages yet. Start the conversation!
                    </p>
                  )}
                  {messages.map((msg: any) => (
                    <div key={msg.id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-emerald-400">
                          {msg.senderName}
                        </span>
                        <span className="text-[10px] text-slate-600">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300">{msg.message}</p>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>
              <div className="p-3 border-t border-slate-700/50 shrink-0">
                <div className="flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendChat()}
                    placeholder="Type a message..."
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 h-9 text-sm"
                  />
                  <Button size="icon" onClick={sendChat} className="size-9 shrink-0 bg-emerald-600 hover:bg-emerald-700">
                    <Send className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          )}

          {sidebar === 'participants' && (
            <ParticipantsList
              liveClassId={liveClass.id}
              isHost={isHost}
              hostId={liveClass.hostId}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ParticipantsList({
  liveClassId, isHost, hostId,
}: {
  liveClassId: string;
  isHost: boolean;
  hostId: string;
}) {
  const [participants, setParticipants] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/live-classes/${liveClassId}`)
      .then(r => r.json())
      .then(json => setParticipants(json.data?.participants || []))
      .catch(() => {});
  }, [liveClassId]);

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-2">
        {participants.map((p: any) => (
          <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700/30">
            <div className="size-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-white shrink-0">
              {p.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-white truncate">{p.name}</span>
                {p.role === 'host' && (
                  <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30 h-4">
                    Host
                  </Badge>
                )}
                {p.isHandRaised && (
                  <Hand className="size-3.5 text-yellow-400" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
