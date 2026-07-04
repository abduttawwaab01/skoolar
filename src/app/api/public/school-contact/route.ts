import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { schoolId, name, email, phone, message } = await request.json();

    if (!schoolId || !name || !email || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const school = await db.school.findUnique({
      where: { id: schoolId },
      select: { id: true, name: true, email: true },
    });

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    const feedback = await db.feedback.create({
      data: {
        schoolId,
        category: 'general',
        title: `Contact from ${name}`,
        description: JSON.stringify({ name, email, phone, message }),
        status: 'new',
      },
    });

    return NextResponse.json({ success: true, id: feedback.id });
  } catch (error) {
    console.error('[SCHOOL_CONTACT_POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
