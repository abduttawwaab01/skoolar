'use client';

import { useState } from 'react';
import Link from 'next/link';
import { School, ArrowLeft, Mail, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return toast.error('Email is required');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSent(true);
      if (json.resetUrl) setResetUrl(json.resetUrl);
      toast.success(json.message);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send reset email';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-4">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="size-4 mr-1" />
              Back to Login
            </Button>
          </Link>
        </div>

        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <School className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Skoolar</span>
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Reset your password</h1>
          <p className="text-gray-600 mt-1 text-sm">Enter your email and we'll send you a reset link</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-emerald-600" />
              Forgot Password
            </CardTitle>
            <CardDescription>We'll send a password reset link to your email</CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-emerald-800">Reset link sent!</p>
                    <p className="text-xs text-emerald-600">Check your email for the password reset link.</p>
                  </div>
                </div>
                {resetUrl && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <p className="text-xs font-medium text-amber-800">Development mode — reset link:</p>
                    </div>
                    <a href={resetUrl} className="text-xs text-emerald-600 underline break-all">{resetUrl}</a>
                  </div>
                )}
                <Button onClick={() => { setSent(false); setResetUrl(null); }} variant="outline" className="w-full">
                  Try another email
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Email address</label>
                  <Input
                    type="email"
                    placeholder="admin@skoolar.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
