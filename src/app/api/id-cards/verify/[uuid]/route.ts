import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest, { params }: { params: Promise<{ uuid: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { uuid } = await params;

    const card = await db.iDCard.findUnique({
      where: { uuid },
      include: {
        school: { select: { id: true, name: true, logo: true } },
      },
    });

    if (!card) {
      return NextResponse.json({ error: 'Card not found', valid: false }, { status: 404 });
    }

    // Only allow users from the same school, or SUPER_ADMIN
    if (auth.role !== 'SUPER_ADMIN' && card.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const isValid = card.status === 'active' && card.isActive;
    const isExpired = card.expiryDate ? new Date(card.expiryDate) < new Date() : false;

    return NextResponse.json({
      valid: isValid && !isExpired,
      data: {
        id: card.id,
        uuid: card.uuid,
        fullName: card.fullName,
        displayId: card.displayId,
        personType: card.personType,
        status: card.status,
        isActive: card.isActive,
        isExpired,
        issueDate: card.issueDate,
        expiryDate: card.expiryDate,
        school: card.school,
      },
    });
  } catch (error) {
    console.error('GET /api/id-cards/verify error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
