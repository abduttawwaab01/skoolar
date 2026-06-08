'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Video, Mic, MicOff, VideoOff, Copy, Users, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LiveClassLobby() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();

  const [liveClass, setLiveClass] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [displayName, setDisplayName] = useState(session?.user?.name || '');
  const [micEnabled, setMicEnabled] = useState(false);
  const [camEnabled, setCamEnabled] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [guestId, setGuestId] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const gid = localStorage.getItem('live-guest-id');
    if (gid) setGuestId(gid);

    fetch(`/api/live-classes/${params.id}`)
      .then(r => r.json())
      .then(json => {
        if (!json.data) throw new Error('Not found');
        setLiveClass(json.data);
        if (!session?.user?.name) setDisplayName('');
      })
      .catch(() => {
        toast.error('Live class not found');
        router.push('/live');
      })
      .finally(() => setLoading(false));
  }, [params.id, session, router]);

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices().then(d => {
      setDevices(d.filter(d => d.kind === 'videoinput'));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (camEnabled) {
      navigator.mediaDevices.getUserMedia({
        video: selectedDevice ? { deviceId: { exact: selectedDevice } } : true,
        audio: micEnabled,
      }).then(stream => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      }).catch(() => {
        setCamEnabled(false);
        toast.error('Could not access camera');
      });
    } else {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, [camEnabled, micEnabled, selectedDevice]);

  const handleJoin = async () => {
    if (!displayName.trim() && !session?.user) {
      toast.error('Please enter your name');
      return;
    }

    setJoining(true);
    try {
      const name = displayName || session?.user?.name || 'Guest';

      let gid = guestId;
      if (!gid && !session?.user) {
        const res = await fetch('/api/live-classes/guest-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        const json = await res.json();
        gid = json.data.guestId;
        setGuestId(gid);
        if (gid) localStorage.setItem('live-guest-id', gid);
      }

      const joinRes = await fetch(`/api/live-classes/${params.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, guestId: gid }),
      });

      if (!joinRes.ok) {
        const err = await joinRes.json();
        throw new Error(err.error || 'Failed to join');
      }

      streamRef.current?.getTracks().forEach(t => t.stop());
      router.push(`/live/class/${params.id}?name=${encodeURIComponent(name)}&guestId=${gid || ''}&mic=${micEnabled}&cam=${camEnabled}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to join');
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (!liveClass) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-4xl">
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="bg-white/5 border-slate-700/50 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-white">{liveClass.title}</CardTitle>
              <div className="flex items-center gap-4 text-sm text-slate-400">
                <span className="flex items-center gap-1"><Users className="size-3" /> {liveClass._count?.participants || 0} joined</span>
                <span className="flex items-center gap-1"><Video className="size-3" /> {liveClass.type}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Your Name</Label>
                <Input
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Enter your name"
                  className="bg-white/5 border-slate-600 text-white placeholder:text-slate-500"
                  disabled={!!session?.user}
                />
              </div>

              {liveClass.description && (
                <div className="text-sm text-slate-400 bg-white/5 rounded-lg p-3">
                  {liveClass.description}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-slate-700/50 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-white text-sm font-medium">Preview & Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative aspect-video bg-black/50 rounded-lg overflow-hidden">
                {camEnabled ? (
                  <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                    <VideoOff className="size-12" />
                  </div>
                )}
              </div>

              {devices.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-slate-300">Camera</Label>
                    <Select value={selectedDevice || 'default'} onValueChange={v => setSelectedDevice(v === 'default' ? '' : v)}>
                      <SelectTrigger className="bg-white/5 border-slate-600 text-white">
                        <SelectValue placeholder="Default camera" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default</SelectItem>
                      {devices.map(d => (
                        <SelectItem key={d.deviceId} value={d.deviceId}>
                          {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className={`rounded-full ${micEnabled ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-red-500/20 border-red-500 text-red-400'}`}
                    onClick={() => setMicEnabled(!micEnabled)}
                  >
                    {micEnabled ? <Mic className="size-4" /> : <MicOff className="size-4" />}
                  </Button>
                  <span className="text-xs text-slate-400">Mic</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className={`rounded-full ${camEnabled ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-red-500/20 border-red-500 text-red-400'}`}
                    onClick={() => setCamEnabled(!camEnabled)}
                  >
                    {camEnabled ? <Video className="size-4" /> : <VideoOff className="size-4" />}
                  </Button>
                  <span className="text-xs text-slate-400">Camera</span>
                </div>
              </div>

              <Button
                onClick={handleJoin}
                disabled={joining || (!displayName.trim() && !session?.user)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-base"
              >
                {joining ? <><Loader2 className="size-4 mr-2 animate-spin" /> Joining...</> : 'Join Now'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
  );
}
