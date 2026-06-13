'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useAppStore } from '@/store/app-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Video, ArrowLeft, Clock, Zap, CreditCard, Mail } from 'lucide-react';
import { motion } from 'framer-motion';

export default function CreateLiveClassPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(false);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [guestCredits, setGuestCredits] = useState<number>(0);
  const [guestEmail, setGuestEmail] = useState('');
  const [guestEmailVerified, setGuestEmailVerified] = useState(false);
  const [useCredit, setUseCredit] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signingUp, setSigningUp] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'class',
    hostName: '',
    maxParticipants: 50,
    scheduledAt: '',
  });

  const isGuest = status === 'unauthenticated';

  useEffect(() => {
    const gid = localStorage.getItem('live-guest-id');
    if (gid) setGuestId(gid);
  }, []);

  useEffect(() => {
    if (guestId) {
      fetch(`/api/guest/credits?guestId=${guestId}`)
        .then(r => r.json())
        .then(j => {
          if (j.data) {
            setGuestCredits(j.data.credits || 0);
            setGuestEmail(j.data.email || '');
            setGuestEmailVerified(j.data.emailVerified || false);
          }
        })
        .catch(() => {});
    }
  }, [guestId]);

  const handleCreate = async () => {
    if (!form.title.trim()) {
      toast.error('Please enter a class title');
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        title: form.title,
        description: form.description || null,
        type: form.type,
        hostName: form.hostName.trim() || session?.user?.name || 'Guest',
        maxParticipants: form.maxParticipants,
        scheduledAt: form.scheduledAt || null,
      };

      if (isGuest && guestId) {
        body.guestUserId = guestId;
      }

      const res = await fetch('/api/live-classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create');
      }

      const json = await res.json();
      toast.success(isGuest && !useCredit ? 'Free class created! (5 min limit)' : 'Live class created!');
      router.push(`/live/class/${json.data.id}/lobby`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create live class');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!signupEmail.trim()) {
      toast.error('Email is required');
      return;
    }
    setSigningUp(true);
    try {
      const res = await fetch('/api/guest/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: signupEmail, name: signupName || undefined, guestId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to sign up');
      toast.success('Check your email for verification link');
      setSignupOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sign up');
    } finally {
      setSigningUp(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  const canUseCredit = isGuest && guestCredits >= 1 && guestEmailVerified;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Button variant="ghost" className="text-slate-400 hover:text-white mb-6" onClick={() => {
            if (status === 'authenticated') {
              useAppStore.getState().setCurrentView('live-classes');
              router.push('/dashboard');
            } else {
              router.push('/live');
            }
          }}>
            <ArrowLeft className="size-4 mr-2" /> Back
          </Button>

          <Card className="bg-white/5 border-slate-700/50 backdrop-blur-xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Video className="size-5 text-emerald-400" />
                </div>
                <div>
                  <CardTitle className="text-white text-xl">Create Live Class</CardTitle>
                  <CardDescription className="text-slate-400">
                    {isGuest ? 'Free 5-minute class — no account required' : 'Set up a new virtual classroom or meeting'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {isGuest && (
                <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <Clock className="size-4 text-amber-400" />
                      <span>Free: <strong>5 minutes</strong></span>
                    </div>
                    {canUseCredit && (
                      <div className="flex items-center gap-2 text-sm text-emerald-400">
                        <Zap className="size-4" />
                        <span>Credit: <strong>60 minutes</strong> ({guestCredits} left)</span>
                      </div>
                    )}
                  </div>
                  {canUseCredit && (
                    <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                      <input type="checkbox" checked={useCredit} onChange={e => setUseCredit(e.target.checked)} className="rounded" />
                      Use 1 credit for a 60-minute class
                    </label>
                  )}
                  {!guestEmailVerified && guestCredits > 0 && (
                    <p className="text-xs text-amber-400 flex items-center gap-1">
                      <Mail className="size-3" /> Verify your email to use credits
                    </p>
                  )}
                  {!guestId && (
                    <p className="text-xs text-slate-500">Create your class first, then sign up to buy credits for longer sessions.</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-slate-300">Title *</Label>
                <Input
                  placeholder="e.g. Mathematics 101 - Algebra"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="bg-white/5 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Your Name</Label>
                  <Input
                    placeholder="Enter your name"
                    value={form.hostName}
                    onChange={e => setForm(f => ({ ...f, hostName: e.target.value }))}
                    className="bg-white/5 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Type</Label>
                  <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                    <SelectTrigger className="bg-white/5 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="class">Class</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="interview">Interview</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Description</Label>
                <Textarea
                  placeholder="What is this class about?"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="bg-white/5 border-slate-600 text-white placeholder:text-slate-500 min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Max Participants</Label>
                  <Input
                    type="number"
                    min={2}
                    max={200}
                    value={form.maxParticipants}
                    onChange={e => setForm(f => ({ ...f, maxParticipants: parseInt(e.target.value) || 50 }))}
                    className="bg-white/5 border-slate-600 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Schedule (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={form.scheduledAt}
                    onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
                    className="bg-white/5 border-slate-600 text-white"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleCreate}
                  disabled={loading || !form.title.trim()}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-base"
                >
                  {loading ? <><Loader2 className="size-4 mr-2 animate-spin" /> Creating...</> : isGuest ? (useCredit ? 'Start 60-Min Class (1 Credit)' : 'Start Free 5-Min Class') : 'Create & Start Class'}
                </Button>

                {isGuest && !canUseCredit && (
                  <Button
                    variant="outline"
                    className="w-full border-slate-600 text-slate-300 hover:text-white"
                    onClick={() => setSignupOpen(true)}
                  >
                    <CreditCard className="size-4 mr-2" /> Sign Up & Buy Credits (₦500/class)
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Dialog open={signupOpen} onOpenChange={setSignupOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Get More Class Time</DialogTitle>
            <DialogDescription className="text-slate-400">
              Sign up to buy credits. ₦500 = 1 credit = 1 hour class.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-slate-300">Name (optional)</Label>
              <Input
                value={signupName}
                onChange={e => setSignupName(e.target.value)}
                placeholder="Your name"
                className="bg-white/5 border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Email *</Label>
              <Input
                type="email"
                value={signupEmail}
                onChange={e => setSignupEmail(e.target.value)}
                placeholder="you@example.com"
                className="bg-white/5 border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>
            <Button
              onClick={handleSignup}
              disabled={signingUp || !signupEmail.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {signingUp ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
              Send Verification Email
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
