import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    const jobPosting = await db.jobPosting.findUnique({
      where: { code },
      include: {
        school: {
          select: {
            id: true,
            name: true,
            logo: true,
            email: true,
            phone: true,
            website: true,
            primaryColor: true,
          },
        },
      },
    });

    if (!jobPosting || jobPosting.deletedAt) {
      return NextResponse.json({ error: 'Job posting not found' }, { status: 404 });
    }

    if (!jobPosting.isActive) {
      return NextResponse.json({ error: 'This job posting is no longer active' }, { status: 400 });
    }

    const now = new Date();
    if (jobPosting.expiresAt && jobPosting.expiresAt < now) {
      return NextResponse.json({ error: 'This job posting has expired' }, { status: 400 });
    }

    const { schoolId, code: _, ...publicJob } = jobPosting as typeof jobPosting & { schoolId: string; code: string };
    
    return NextResponse.json({ data: publicJob });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}