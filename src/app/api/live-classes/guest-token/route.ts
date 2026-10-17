import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const name = (body.name || 'Guest').trim().slice(0, 50);

  // Create a persistent GuestUser so that any LiveClass created with this id
  // satisfies the LiveClass.guestUserId foreign key.
  const guest = await db.guestUser.create({
    data: {
      id: uuidv4(),
      email: null,
      name: name || 'Guest',
    },
  });

  return NextResponse.json({
    data: {
      guestId: guest.id,
      name: guest.name,
      createdAt: guest.createdAt.toISOString(),
    },
  });
}
