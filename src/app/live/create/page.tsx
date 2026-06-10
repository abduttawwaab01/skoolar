'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useAppStore } from '@/store/app-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Video, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

export default function CreateLiveClassPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'class',
    hostName: '',
    maxParticipants: 50,
    scheduledAt: '',
  });

  const handleCreate = async () => {
    if (!form.title.trim()) {
      toast.error('Please enter a class title');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/live-classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          type: form.type,
          hostName: form.hostName.trim() || session?.user?.name || 'Guest',
          maxParticipants: form.maxParticipants,
          scheduledAt: form.scheduledAt || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create');
      }

      const json = await res.json();
      toast.success('Live class created!');
      router.push(`/live/class/${json.data.id}/lobby`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create live class');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-emerald-400" />
      </div>
    );
  }



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
                    Set up a new virtual classroom or meeting
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
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

              <Button
                onClick={handleCreate}
                disabled={loading || !form.title.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-base"
              >
                {loading ? <><Loader2 className="size-4 mr-2 animate-spin" /> Creating...</> : 'Create & Start Class'}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
