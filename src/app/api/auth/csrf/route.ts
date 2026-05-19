import { NextRequest, NextResponse } from 'next/server';
import { generateCsrfToken, createCsrfCookie } from '@/lib/csrf-middleware';

export async function GET(_request: NextRequest) {
  const token = generateCsrfToken();
  const cookie = createCsrfCookie(token);

  return NextResponse.json({ token }, {
    headers: { 'Set-Cookie': cookie },
  });
}
