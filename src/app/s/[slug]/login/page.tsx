'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'sonner';
import { Loader2 } from 'lucide-react';
import { LoginPage } from '@/components/auth/login-page';

interface SchoolOption {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
}

export default function SchoolLoginPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [school, setSchool] = useState<SchoolOption | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setError(true);
      return;
    }
    fetch(`/api/public/schools/${encodeURIComponent(slug)}`)
      .then((res) => {
        if (!res.ok) throw new Error('School not found');
        return res.json();
      })
      .then((json) => {
        if (json.data) {
          setSchool(json.data);
        } else {
          setError(true);
        }
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug]);

  return (
    <SessionProvider>
      {loading ? (
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="size-8 animate-spin text-emerald-600" />
        </div>
      ) : (
        <LoginPage initialSchool={error ? null : school} />
      )}
      <Toaster position="top-right" richColors closeButton />
    </SessionProvider>
  );
}
