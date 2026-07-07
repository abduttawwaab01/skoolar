import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/subscription/check-trial?schoolId=xxx - Check trial status for a school
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');

    if (!schoolId) {
      return NextResponse.json({ error: 'schoolId is required' }, { status: 400 });
    }

    const school = await db.school.findUnique({
      where: { id: schoolId },
      select: { trialStartDate: true, trialEndDate: true },
    });

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    const now = new Date();
    let inTrial = false;
    let trialDaysRemaining = 0;

    if (school.trialStartDate && school.trialEndDate) {
      const trialEnd = new Date(school.trialEndDate);
      const buffer = 24 * 60 * 60 * 1000;

      if (trialEnd.getTime() + buffer > now.getTime()) {
        inTrial = true;
        trialDaysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        inTrial,
        trialDaysRemaining,
        trialStartDate: school.trialStartDate,
        trialEndDate: school.trialEndDate,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
