import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { generateCsrfToken, createCsrfCookie } from '@/lib/csrf-middleware';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const token = generateCsrfToken();
  const cookie = createCsrfCookie(token);

  return NextResponse.json({ token }, {
    headers: { 'Set-Cookie': cookie },
  });
}
