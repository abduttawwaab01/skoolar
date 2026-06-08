import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const name = (body.name || 'Guest').trim().slice(0, 50);

  const guestId = uuidv4();

  return NextResponse.json({
    data: {
      guestId,
      name,
      createdAt: new Date().toISOString(),
    },
  });
}
