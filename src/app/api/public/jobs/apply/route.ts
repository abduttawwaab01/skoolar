import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory rate limiting
const applyRateCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = applyRateCounts.get(ip);
  if (!record || now > record.resetAt) {
    applyRateCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }
  record.count++;
  return record.count > RATE_LIMIT_MAX;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
    }

    const body = await request.json();
    const {
      jobPostingId,
      applicantName,
      applicantEmail,
      applicantPhone,
      applicantAddress,
      resumeUrl,
      coverLetter,
      linkedinUrl,
      portfolioUrl,
      yearsExperience,
    } = body;

    if (!jobPostingId || !applicantName || !applicantEmail) {
      return NextResponse.json(
        { error: 'Job posting ID, name, and email are required' },
        { status: 400 }
      );
    }

    const jobPosting = await db.jobPosting.findUnique({
      where: { id: jobPostingId, deletedAt: null },
      include: {
        school: true,
        _count: { select: { applications: true } },
      },
    });

    if (!jobPosting || !jobPosting.isActive) {
      return NextResponse.json(
        { error: 'Job posting not found or inactive' },
        { status: 404 }
      );
    }

    const now = new Date();
    if (jobPosting.expiresAt && jobPosting.expiresAt < now) {
      return NextResponse.json(
        { error: 'This job posting has expired' },
        { status: 400 }
      );
    }

    const existingApplication = await db.jobApplication.findFirst({
      where: { jobPostingId, applicantEmail },
    });

    if (existingApplication) {
      return NextResponse.json(
        { error: 'You have already applied for this position' },
        { status: 409 }
      );
    }

    const application = await db.jobApplication.create({
      data: {
        jobPostingId,
        applicantName,
        applicantEmail,
        applicantPhone: applicantPhone || null,
        applicantAddress: applicantAddress || null,
        resumeUrl: resumeUrl || null,
        coverLetter: coverLetter || null,
        linkedinUrl: linkedinUrl || null,
        portfolioUrl: portfolioUrl || null,
        yearsExperience: yearsExperience || null,
        status: 'pending',
      },
    });

    const admins = await db.user.findMany({
      where: {
        schoolId: jobPosting.schoolId,
        role: { in: ['SCHOOL_ADMIN', 'DIRECTOR'] },
        isActive: true,
      },
    });

    if (admins.length > 0) {
      await db.notification.createMany({
        data: admins.map(admin => ({
          userId: admin.id,
          type: 'new_application',
          title: `New Job Application - ${jobPosting.title}`,
          message: `${applicantName} has applied for ${jobPosting.title}`,
          schoolId: jobPosting.schoolId,
        })),
      });
    }

    return NextResponse.json(
      {
        data: application,
        message: 'Application submitted successfully',
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}