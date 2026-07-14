import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { resolveImageBuffer } from '@/lib/report-card-pdf-data';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    if (!url) {
      return NextResponse.json({ error: 'url query parameter required' }, { status: 400 });
    }

    const decodedUrl = decodeURIComponent(url);
    const resolved = await resolveImageBuffer(decodedUrl, 'photo', request);
    if (!resolved) {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: 404 });
    }

    const dataUri = `data:${resolved.contentType};base64,${resolved.buffer.toString('base64')}`;
    return NextResponse.json(
      { dataUri, contentType: resolved.contentType, size: resolved.buffer.length },
      { headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' } }
    );
  } catch (error) {
    console.error('Image proxy error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
