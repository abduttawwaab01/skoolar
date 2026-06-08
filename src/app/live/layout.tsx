'use client';

import { SessionProvider } from 'next-auth/react';

export const dynamic = 'force-dynamic';

export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
