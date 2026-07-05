import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return NextResponse.json({ available: false, error: 'Invalid slug format' });
    }

    const existing = await db.school.findUnique({ where: { slug } });
    const available = !existing || existing.id === auth.schoolId;

    return NextResponse.json({ available });
  } catch {
    return NextResponse.json({ available: false, error: 'Server error' }, { status: 500 });
  }
}
