'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, MailCheck, ShieldAlert, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const guestId = searchParams.get('guestId') || '';

  const invalid = !token || !guestId;

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    invalid ? 'error' : 'loading',
  );
  const [message, setMessage] = useState(
    invalid ? 'This verification link is invalid or incomplete.' : 'Verifying your email...',
  );

  useEffect(() => {
    if (invalid) return;

    fetch('/api/guest/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, guestId }),
    })
      .then(r => r.json().then(j => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (ok) {
          setStatus('success');
          setMessage(j.data?.message || 'Email verified successfully.');
        } else {
          setStatus('error');
          setMessage(j.error || 'Verification failed.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Something went wrong. Please try again.');
      });
  }, [token, guestId, invalid]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Button variant="ghost" className="text-slate-400 hover:text-white mb-6" onClick={() => window.history.back()}>
          <ArrowLeft className="size-4 mr-1" /> Back
        </Button>

        <Card className="bg-white/5 border-slate-700/50 backdrop-blur-xl">
          <CardHeader className="text-center">
            <div className={`inline-flex mx-auto size-14 rounded-2xl items-center justify-center mb-4 ${
              status === 'success' ? 'bg-emerald-500/20' : status === 'error' ? 'bg-red-500/20' : 'bg-purple-500/20'
            }`}>
              {status === 'loading' ? (
                <Loader2 className="size-7 text-purple-400 animate-spin" />
              ) : status === 'success' ? (
                <MailCheck className="size-7 text-emerald-400" />
              ) : (
                <ShieldAlert className="size-7 text-red-400" />
              )}
            </div>
            <CardTitle className="text-white text-xl">
              {status === 'success' ? 'Email Verified' : status === 'error' ? 'Verification Failed' : 'Verifying...'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-slate-400 text-sm">{message}</p>
            {status === 'success' && (
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => {
                  const params = guestId ? `?guestId=${encodeURIComponent(guestId)}` : '';
                  window.location.href = `/live/create${params}`;
                }}
              >
                Continue to Live Classes
              </Button>
            )}
            {status === 'error' && (
              <Button
                variant="outline"
                className="w-full border-slate-600 text-slate-300 hover:text-white"
                onClick={() => window.location.reload()}
              >
                Try Again
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-emerald-400" />
      </div>
    }>
      <VerifyEmailInner />
    </Suspense>
  );
}
