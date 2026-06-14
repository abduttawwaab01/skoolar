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
  Copy, Send, X, Pen, Vote, Settings, DoorOpen,
  SmilePlus, ThumbsUp, Heart, Laugh, Star, ArrowLeft, EyeOff, Clock, Zap, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WhiteboardCanvas } from '@/components/live-class/whiteboard/whiteboard-canvas';
import { HostControls } from '@/components/live-class/host/host-controls';
import { Polls } from '@/components/live-class/controls/polls';
import { BreakoutRooms } from '@/components/live-class/breakout/breakout-rooms';
import { useLiveClassSocket } from '@/hooks/use-live-class';

const REACTIONS = [
  { emoji: '👍', icon: ThumbsUp, label: 'Like' },
  { emoji: '❤️', icon: Heart, label: 'Love' },
  { emoji: '😂', icon: Laugh, label: 'Laugh' },
  { emoji: '👏', icon: ThumbsUp, label: 'Clap' },
  { emoji: '⭐', icon: Star, label: 'Star' },
];

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
  const [sidebar, setSidebar] = useState<'chat' | 'participants' | 'polls' | 'whiteboard' | 'host-controls' | 'breakout' | null>('chat');
  const [handRaised, setHandRaised] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [showReactions, setShowReactions] = useState(false);
  const [toastReactions, setToastReactions] = useState<{ id: number; emoji: string; name: string }[]>([]);
  const [spotlightParticipant, setSpotlightParticipant] = useState<string | null>(null);
  const [hideFromEachOther, setHideFromEachOther] = useState(
    liveClass?.settings?.hideParticipantsFromEachOther ?? false
  );
  const maxDurationMin = liveClass?.settings?.maxDurationMinutes || 0;
  const startedAt = liveClass?.startedAt ? new Date(liveClass.startedAt).getTime() : Date.now();
  const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
  const initialRemaining = Math.max(maxDurationMin * 60 - elapsedSec, 0);
  const [timeRemaining, setTimeRemaining] = useState(initialRemaining);
  const [timeExpired, setTimeExpired] = useState(initialRemaining <= 0 && maxDurationMin > 0);
  const [extending, setExtending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const reactionIdRef = useRef(0);

  const socket = useLiveClassSocket(liveClass.id, isHost ? identity : undefined, guestId || undefined, displayName);
  const getSocketRef = useRef(socket.getSocket);
  getSocketRef.current = socket.getSocket;
  const socketOnRef = useRef(socket.on);
  socketOnRef.current = socket.on;
  const participantsHidden = hideFromEachOther && !isHost;

  const fetchChat = useCallback(async () => {
    try {
      const res = await fetch(`/api/live-classes/${liveClass.id}/chat`);
      const json = await res.json();
      if (json.data) setMessages(json.data);
    } catch {}
  }, [liveClass.id]);

  const fetchParticipants = useCallback(async () => {
    try {
      const res = await fetch(`/api/live-classes/${liveClass.id}`);
      const json = await res.json();
      if (json.data?.participants) setParticipants(json.data.participants);
    } catch {}
  }, [liveClass.id]);

  // Initial fetch only — rely on socket for real-time updates
  useEffect(() => {
    fetchChat();
  }, [fetchChat]);

  useEffect(() => {
    fetchParticipants();
  }, [fetchParticipants]);

  // Listen for real-time chat messages via socket
  useEffect(() => {
    const on = socketOnRef.current;
    const unsub = on('live-class:chat-message', (data: any) => {
      if (data.message && data.sender) {
        setMessages(prev => [...prev, {
          id: data.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          senderName: data.sender,
          message: data.message,
          createdAt: data.timestamp || new Date().toISOString(),
        }]);
      }
    });
    return () => unsub?.();
  }, []);

  // Listen for real-time participant updates via socket
  useEffect(() => {
    const on = socketOnRef.current;
    const unsub = on('live-class:participant-update', (data: any) => {
      if (data.participants) setParticipants(data.participants);
    });
    return () => unsub?.();
  }, []);

  // Listen for hand-raise events from other users
  useEffect(() => {
    const on = socketOnRef.current;
    const unsub = on('live-class:raise-hand', (data: { userId: string; isRaised: boolean }) => {
      setParticipants(prev => prev.map(p =>
        (p.id === data.userId) ? { ...p, isHandRaised: data.isRaised } : p
      ));
    });
    return () => unsub?.();
  }, []);

  // Listen for mute/video changes from other users
  useEffect(() => {
    const on = socketOnRef.current;
    const unsubMute = on('live-class:mute-changed', (data: { userId: string; isMuted: boolean }) => {
      setParticipants(prev => prev.map(p =>
        (p.id === data.userId) ? { ...p, isMuted: data.isMuted } : p
      ));
    });
    const unsubVideo = on('live-class:video-changed', (data: { userId: string; isOn: boolean }) => {
      setParticipants(prev => prev.map(p =>
        (p.id === data.userId) ? { ...p, isVideoOn: data.isOn } : p
      ));
    });
    return () => { unsubMute?.(); unsubVideo?.(); };
  }, []);

  // Listen for reactions from other users
  useEffect(() => {
    const on = socketOnRef.current;
    const unsub = on('live-class:reaction', (data: { userId: string; emoji: string }) => {
      const id = ++reactionIdRef.current;
      setToastReactions(prev => [...prev, { id, emoji: data.emoji, name: data.userId }]);
      setTimeout(() => setToastReactions(prev => prev.filter(r => r.id !== id)), 3000);
    });
    return () => unsub?.();
  }, []);

  // Fallback participant polling every 30s (in case socket misses updates)
  useEffect(() => {
    const interval = setInterval(fetchParticipants, 30000);
    return () => clearInterval(interval);
  }, [fetchParticipants]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const messageText = chatInput;
    setChatInput('');
    try {
      const res = await fetch(`/api/live-classes/${liveClass.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          guestId: guestId || undefined,
          senderName: displayName,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        // Optimistically add to local state and broadcast via socket
        setMessages(prev => [...prev, json.data]);
        socket.emit('live-class:chat', {
          classId: liveClass.id,
          message: messageText,
          sender: displayName,
        });
      }
    } catch {}
  };

  const sendReaction = (emoji: string) => {
    const id = ++reactionIdRef.current;
    setToastReactions(prev => [...prev, { id, emoji, name: displayName }]);
    setTimeout(() => setToastReactions(prev => prev.filter(r => r.id !== id)), 3000);
    socket.emit('live-class:reaction', {
      classId: liveClass.id,
      userId: identity,
      emoji,
    });
  };

  const handleEndClass = async () => {
    try {
      await fetch(`/api/live-classes/${liveClass.id}/end`, { method: 'POST' });
      socket.emit('live-class:class-ended', { classId: liveClass.id });
      toast.success('Class ended');
      onEnd();
    } catch {
      toast.error('Failed to end class');
    }
  };

  const toggleHandRaise = async () => {
    const next = !handRaised;
    setHandRaised(next);
    try {
      const payload: Record<string, unknown> = { isHandRaised: next };
      if (guestId) payload.guestId = guestId;
      else payload.userId = identity;
      const participantRes = await fetch(`/api/live-classes/${liveClass.id}/participants`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!participantRes.ok) setHandRaised(!next);
    } catch {
      setHandRaised(!next);
    }
  };

  const spotlightParticipantById = async (participantId: string | null) => {
    setSpotlightParticipant(participantId);
    toast.success(participantId ? 'Participant spotlighted' : 'Spotlight removed');
  };

  useEffect(() => {
    const on = socketOnRef.current;
    const unsub = on('live-class:visibility-changed', (data: { hidden: boolean }) => {
      setHideFromEachOther(data.hidden);
    });
    return () => unsub?.();
  }, []);

  useEffect(() => {
    const on = socketOnRef.current;
    const unsub = on('live-class:class-ended', () => {
      toast.success('Class has ended');
      setTimeout(() => onEnd(), 1500);
    });
    return () => unsub?.();
  }, [onEnd]);

  useEffect(() => {
    if (maxDurationMin <= 0 || isHost) return;
    if (timeExpired) return;
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          // Try to extend for paid guests; otherwise expire
          if (liveClass.guestUserId) {
            setExtending(true);
            fetch(`/api/live-classes/${liveClass.id}/extend`, { method: 'POST' })
              .then(r => r.json())
              .then(j => {
                setExtending(false);
                if (j.data?.extended) {
                  const addedSec = (j.data.addedMinutes || 60) * 60;
                  setTimeRemaining(addedSec);
                  setTimeExpired(false);
                  toast.success(`Extended by ${j.data.addedMinutes} minutes (${j.data.creditsRemaining} credits left)`);
                } else {
                  setTimeExpired(true);
                  setTimeRemaining(0);
                }
              })
              .catch(() => {
                setExtending(false);
                setTimeExpired(true);
                setTimeRemaining(0);
              });
          } else {
            setTimeExpired(true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [maxDurationMin, isHost, timeExpired, liveClass.id, liveClass.guestUserId]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const copyInvite = () => {
    const url = `${window.location.origin}/live/class/${liveClass.id}/lobby`;
    const code = liveClass.joinCode;
    navigator.clipboard.writeText(`Join my live class: ${liveClass.title}\nCode: ${code}\nLink: ${url}`);
    toast.success('Invite link copied!');
  };

  const sidebarIcon = (mode: typeof sidebar) => {
    if (mode === sidebar) return 'secondary';
    return 'ghost';
  };

  return (
    <div className="h-screen w-screen bg-slate-900 flex overflow-hidden">
      {/* Reactions Toast Layer */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toastReactions.map(r => (
          <div key={r.id} className="animate-bounce bg-slate-800/90 backdrop-blur rounded-full px-4 py-2 text-white text-sm shadow-lg flex items-center gap-2">
            <span className="text-xl">{r.emoji}</span>
            <span className="text-xs text-slate-300">{r.name}</span>
          </div>
        ))}
      </div>

      {/* Time Expired Overlay */}
      {timeExpired && (
        <div className="fixed inset-0 z-40 bg-slate-900/95 backdrop-blur flex items-center justify-center">
          <div className="text-center space-y-4 max-w-sm mx-auto px-6">
            <div className="size-16 mx-auto rounded-2xl bg-amber-500/20 flex items-center justify-center">
              <Clock className="size-8 text-amber-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">
              {liveClass.guestUserId ? 'Session Time Expired' : 'Free Session Ended'}
            </h2>
            <p className="text-slate-400 text-sm">
              {liveClass.guestUserId
                ? 'You have no credits remaining. Buy more credits to continue your class.'
                : 'Your 5-minute free session has ended. Sign up and buy credits for unlimited 60-minute classes.'
              }
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => {
                  if (liveClass.guestUserId) {
                    window.location.href = `/live/create?guestId=${encodeURIComponent(guestId)}&buy=1`;
                  } else {
                    window.location.href = `/live/create`;
                  }
                }}
              >
                <Zap className="size-4 mr-2" /> {liveClass.guestUserId ? 'Buy Credits — ₦500/hour' : 'Sign Up & Buy Credits'}
              </Button>
              <Button
                variant="outline"
                className="border-slate-600 text-slate-300"
                onClick={onEnd}
              >
                Leave Class
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Extending indicator */}
      {extending && (
        <div className="fixed inset-0 z-40 bg-slate-900/80 flex items-center justify-center">
          <div className="text-center text-white">
            <Loader2 className="size-8 animate-spin mx-auto mb-3 text-emerald-400" />
            <p className="text-sm text-slate-300">Extending session...</p>
          </div>
        </div>
      )}

      {/* Main Video Area */}
      <LiveKitRoom
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880'}
        token={token}
        connect={true}
        onConnected={() => setIsConnected(true)}
        onDisconnected={() => setIsConnected(false)}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}
      >
        {/* Top Bar */}
        <div className="h-12 bg-slate-800/50 backdrop-blur border-b border-slate-700/50 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" onClick={onEnd} className="text-slate-400 hover:text-white h-8 mr-1 shrink-0">
              <ArrowLeft className="size-4" />
            </Button>
            <span className="text-white font-medium truncate text-sm">{liveClass.title}</span>
            <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-[10px]">
              {liveClass.type}
            </Badge>
            <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-[10px]">
              {liveClass.joinCode}
            </Badge>
            {maxDurationMin > 0 && !isHost && (
              <Badge variant="outline" className={cn(
                'text-[10px]',
                timeRemaining <= 60 ? 'text-red-400 border-red-500/30 animate-pulse' : 'text-slate-400 border-slate-500/30'
              )}>
                <Clock className="size-3 mr-1" /> {formatTime(timeRemaining)}
              </Badge>
            )}
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

        {/* Video Grid / Whiteboard */}
        <div className="flex-1 relative">
          {sidebar === 'whiteboard' ? (
            <WhiteboardCanvas
              liveClassId={liveClass.id}
              isHost={isHost}
              socket={socket.getSocket()}
            />
          ) : participantsHidden ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-slate-500">
                <EyeOff className="size-16 mx-auto mb-4 text-slate-600" />
                <p className="text-sm font-medium">Members visibility is restricted</p>
                <p className="text-xs text-slate-600 mt-1">Only you can see yourself</p>
              </div>
            </div>
          ) : (
            <>
              <RoomAudioRenderer />
              <VideoConference />
            </>
          )}
        </div>

        {/* Bottom Controls */}
        <div className="h-16 bg-slate-800/50 backdrop-blur border-t border-slate-700/50 flex items-center justify-center gap-2 px-4 shrink-0">
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
            title="Raise hand"
          >
            <Hand className="size-5" />
          </Button>

          {/* Reactions Button */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowReactions(!showReactions)}
              className="rounded-full size-10 text-slate-400 hover:text-white"
              title="Reactions"
            >
              <SmilePlus className="size-5" />
            </Button>
            {showReactions && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 rounded-xl p-2 flex gap-1 shadow-xl z-50"
                onMouseLeave={() => setShowReactions(false)}>
                {REACTIONS.map(r => (
                  <button key={r.emoji}
                    onClick={() => { sendReaction(r.emoji); setShowReactions(false); }}
                    className="size-9 flex items-center justify-center rounded-lg hover:bg-slate-700 text-xl transition-colors"
                    title={r.label}>
                    {r.emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Separator orientation="vertical" className="h-8 bg-slate-700" />

          <Button
            variant={sidebarIcon('whiteboard')}
            size="icon"
            onClick={() => setSidebar(sidebar === 'whiteboard' ? 'chat' : 'whiteboard')}
            className="rounded-full size-10 text-slate-400 hover:text-white"
            title="Whiteboard"
          >
            <Pen className="size-5" />
          </Button>

          <Button
            variant={sidebarIcon('polls')}
            size="icon"
            onClick={() => setSidebar(sidebar === 'polls' ? 'chat' : 'polls')}
            className="rounded-full size-10 text-slate-400 hover:text-white"
            title="Polls"
          >
            <Vote className="size-5" />
          </Button>

          <Button
            variant={sidebarIcon('breakout')}
            size="icon"
            onClick={() => setSidebar(sidebar === 'breakout' ? 'chat' : 'breakout')}
            className="rounded-full size-10 text-slate-400 hover:text-white"
            title="Breakout Rooms"
          >
            <DoorOpen className="size-5" />
          </Button>

          <Separator orientation="vertical" className="h-8 bg-slate-700" />

          <Button
            variant={sidebarIcon('chat')}
            size="icon"
            onClick={() => setSidebar(sidebar === 'chat' ? null : 'chat')}
            className="rounded-full size-10 text-slate-400 hover:text-white"
          >
            <MessageSquare className="size-5" />
          </Button>

          <Button
            variant={sidebarIcon('participants')}
            size="icon"
            onClick={() => setSidebar(sidebar === 'participants' ? null : 'participants')}
            className="rounded-full size-10 text-slate-400 hover:text-white"
          >
            <Users className="size-5" />
          </Button>

          {isHost && (
            <>
              <Separator orientation="vertical" className="h-8 bg-slate-700" />
              <Button
                variant={sidebarIcon('host-controls')}
                size="icon"
                onClick={() => setSidebar(sidebar === 'host-controls' ? null : 'host-controls')}
                className="rounded-full size-10 text-slate-400 hover:text-white"
                title="Host Controls"
              >
                <Settings className="size-5" />
              </Button>
            </>
          )}
        </div>
      </LiveKitRoom>

      {/* Sidebar */}
      {sidebar && (
        <div className="w-80 bg-slate-800/80 backdrop-blur border-l border-slate-700/50 flex flex-col shrink-0">
          {/* Sidebar Header */}
          <div className="h-12 border-b border-slate-700/50 flex items-center justify-between px-4 shrink-0">
            <span className="text-white text-sm font-medium">
              {sidebar === 'chat' ? 'Chat' : sidebar === 'participants' ? 'Participants' : sidebar === 'polls' ? 'Polls' : sidebar === 'whiteboard' ? 'Whiteboard' : sidebar === 'breakout' ? 'Breakout Rooms' : 'Host Controls'}
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
              {participantsHidden ? (
                <div className="p-3 border-t border-slate-700/50 shrink-0">
                  <p className="text-xs text-slate-500 text-center">Chat is disabled while members are hidden</p>
                </div>
              ) : (
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
              )}
            </>
          )}

          {sidebar === 'participants' && (
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-2">
                {(participantsHidden
                  ? participants.filter((p: any) => {
                      const pId = p.userId || p.guestId || p.id;
                      const myId = identity || guestId;
                      return pId === myId;
                    })
                  : participants
                ).map((p: any) => (
                  <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700/30 group">
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
                        {p.isMuted && (
                          <span className="text-[10px] text-slate-500">(muted)</span>
                        )}
                      </div>
                    </div>
                    {isHost && p.role !== 'host' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-yellow-400"
                        onClick={() => spotlightParticipantById(spotlightParticipant === p.id ? null : p.id)}
                        title={spotlightParticipant === p.id ? 'Remove spotlight' : 'Spotlight'}
                      >
                        <Star className={cn('size-3', spotlightParticipant === p.id && 'fill-yellow-400 text-yellow-400')} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {sidebar === 'polls' && (
            <div className="flex-1 p-4 overflow-auto">
              <Polls
                liveClassId={liveClass.id}
                isHost={isHost}
                userId={identity}
                guestId={guestId || undefined}
              />
            </div>
          )}

          {sidebar === 'whiteboard' && (
            <div className="flex-1 p-4 overflow-auto">
              <p className="text-xs text-slate-500 text-center mb-3">
                Whiteboard is shown in the main area.
              </p>
            </div>
          )}

          {sidebar === 'breakout' && (
            <div className="flex-1 p-4 overflow-auto">
              <BreakoutRooms
                liveClassId={liveClass.id}
                isHost={isHost}
                participants={participants}
                socket={socket.getSocket()}
              />
            </div>
          )}

          {sidebar === 'host-controls' && isHost && (
            <div className="flex-1 p-4 overflow-auto">
              <HostControls
                liveClassId={liveClass.id}
                isRecording={liveClass.isRecording || false}
                onStartRecording={() => toast.success('Recording started')}
                onStopRecording={() => toast.success('Recording stopped')}
                onEndClass={handleEndClass}
                guestId={guestId || undefined}
                settings={liveClass.settings || {
                  allowChat: true,
                  allowScreenShare: true,
                  allowWhiteboard: true,
                  allowPolls: true,
                  muteOnJoin: false,
                }}
                onUpdateSettings={async (settings) => {
                  try {
                    await fetch(`/api/live-classes/${liveClass.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ settings, guestId: guestId || undefined }),
                    });
                    if ('hideParticipantsFromEachOther' in settings) {
                      const emitFn = socket.getSocket();
                      if (emitFn) {
                        emitFn.emit('live-class:visibility-changed', {
                          classId: liveClass.id,
                          hidden: settings.hideParticipantsFromEachOther,
                        });
                      }
                      setHideFromEachOther(settings.hideParticipantsFromEachOther);
                    }
                  } catch {
                    toast.error('Failed to update settings');
                  }
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
