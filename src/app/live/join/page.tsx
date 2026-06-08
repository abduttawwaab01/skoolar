'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, Link2, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

export default function JoinLiveClassPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      toast.error('Please enter a join code');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/live-classes/join-by-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Invalid code');
      }

      const json = await res.json();
      router.push(`/live/class/${json.data.id}/lobby`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to join');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Button variant="ghost" className="text-slate-400 hover:text-white mb-6" onClick={() => router.push('/live')}>
            <ArrowLeft className="size-4 mr-2" /> Back
          </Button>

          <Card className="bg-white/5 border-slate-700/50 backdrop-blur-xl">
            <CardHeader className="text-center">
              <div className="inline-flex mx-auto size-14 rounded-2xl bg-purple-500/20 items-center justify-center mb-4">
                <Link2 className="size-7 text-purple-400" />
              </div>
              <CardTitle className="text-white text-xl">Join Live Class</CardTitle>
              <CardDescription className="text-slate-400">
                Enter the 6-character code shared by the host
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Input
                  placeholder="Enter code (e.g. ABC123)"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                  maxLength={6}
                  className="bg-white/5 border-slate-600 text-white text-center text-2xl tracking-[0.5em] font-mono placeholder:text-sm placeholder:tracking-normal placeholder:text-slate-500 h-16"
                />
              </div>

              <Button
                onClick={handleJoin}
                disabled={loading || code.length < 4}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white h-12 text-base"
              >
                {loading ? <><Loader2 className="size-4 mr-2 animate-spin" /> Joining...</> : 'Join Class'}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
