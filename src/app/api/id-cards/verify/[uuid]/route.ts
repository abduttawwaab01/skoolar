import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const { uuid } = await params;

    if (!uuid) {
      return NextResponse.json({ error: 'UUID required' }, { status: 400 });
    }

    const card = await db.iDCard.findUnique({
      where: { uuid },
      include: {
        school: { select: { name: true } },
        design: { select: { name: true } },
      },
    });

    if (!card) {
      return NextResponse.json({
        valid: false,
        status: 'not_found',
        message: 'No ID card found with this identifier.',
      });
    }

    const now = new Date();
    let valid = card.status === 'active';
    let message = '';

    switch (card.status) {
      case 'active':
        if (card.expiryDate && new Date(card.expiryDate) < now) {
          valid = false;
          message = 'This ID card has expired.';
        } else {
          message = 'This ID card is valid and active.';
        }
        break;
      case 'suspended':
        valid = false;
        message = 'This ID card has been suspended and is no longer valid.';
        break;
      case 'replaced':
        valid = false;
        message = 'This ID card has been replaced by a newer version.';
        break;
      case 'expired':
        valid = false;
        message = 'This ID card has expired.';
        break;
      default:
        valid = false;
        message = 'Unknown card status.';
    }

    return NextResponse.json({
      valid,
      status: card.status,
      message,
      cardData: {
        uuid: card.uuid,
        fullName: card.fullName,
        displayId: card.displayId,
        personType: card.personType,
        schoolName: card.school?.name || 'Unknown School',
        designName: card.design?.name || 'Standard',
        issueDate: card.issueDate.toISOString().split('T')[0],
        expiryDate: card.expiryDate?.toISOString().split('T')[0] || null,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
