import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth-middleware';

function generateAISuggestion(
  score: number,
  maxScore: number,
  applicantName: string,
  jobTitle: string,
  yearsExperience?: number
): string {
  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const expText = yearsExperience ? ` with ${yearsExperience} years of experience` : '';
  
  if (percentage >= 85) {
    return `Highly Recommended. ${applicantName} scored ${percentage.toFixed(1)}%${expText} for ${jobTitle}. Strong candidate with excellent qualifications.`;
  } else if (percentage >= 70) {
    return `Recommended. ${applicantName} scored ${percentage.toFixed(1)}%${expText} for ${jobTitle}. Good fit for the position.`;
  } else if (percentage >= 50) {
    return `Borderline. ${applicantName} scored ${percentage.toFixed(1)}%${expText} for ${jobTitle}. Consider for further evaluation.`;
  } else {
    return `Not Recommended. ${applicantName} scored ${percentage.toFixed(1)}%${expText} for ${jobTitle}. Does not meet minimum requirements.`;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id: jobPostingId } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const jobPosting = await db.jobPosting.findUnique({
      where: { id: jobPostingId, deletedAt: null },
    });

    if (!jobPosting) {
      return NextResponse.json({ error: 'Job posting not found' }, { status: 404 });
    }

    if (auth.role !== 'SUPER_ADMIN' && jobPosting.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const where: Record<string, unknown> = { jobPostingId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { applicantName: { contains: search, mode: 'insensitive' } },
        { applicantEmail: { contains: search, mode: 'insensitive' } },
        { applicantPhone: { contains: search } },
      ];
    }

    const [applications, total] = await Promise.all([
      db.jobApplication.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.jobApplication.count({ where }),
    ]);

    return NextResponse.json({
      data: applications,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireRole(request, ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR']);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id: jobPostingId } = await params;
    const body = await request.json();

    const { applicationId, status, interviewScore, finalScore, notes, interviewDate, interviewNotes, offeredSalary } = body as {
      applicationId: string;
      status?: string;
      interviewScore?: number;
      finalScore?: number;
      notes?: string;
      interviewDate?: string;
      interviewNotes?: string;
      offeredSalary?: number;
    };

    if (!applicationId) {
      return NextResponse.json({ error: 'applicationId is required' }, { status: 400 });
    }

    const application = await db.jobApplication.findFirst({
      where: { id: applicationId, jobPostingId },
      include: { jobPosting: true },
    });

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const allowedStatuses = [
      'pending', 'reviewed', 'interview_scheduled', 'interviewed',
      'offered', 'hired', 'rejected', 'withdrawn'
    ];

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (status) {
      if (!allowedStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.status = status;
      if (status === 'rejected') updateData.rejectedAt = new Date();
      if (status === 'hired') {
        updateData.hiredAt = new Date();
        updateData.finalScore = finalScore || interviewScore || application.finalScore;
      }
    }

    if (interviewScore !== undefined) {
      updateData.interviewScore = interviewScore;
      if (application.finalScore === null || application.finalScore === undefined) {
        updateData.finalScore = interviewScore;
      }
    }

    if (finalScore !== undefined) {
      updateData.finalScore = finalScore;
    }

    if (notes !== undefined) updateData.notes = notes;
    if (interviewDate) updateData.interviewDate = new Date(interviewDate);
    if (interviewNotes !== undefined) updateData.interviewNotes = interviewNotes;
    if (offeredSalary !== undefined) updateData.offeredSalary = offeredSalary;

    if (status || interviewScore) {
      const aiSuggestion = generateAISuggestion(
        (finalScore || interviewScore || application.finalScore || 0),
        100,
        application.applicantName,
        application.jobPosting.title,
        application.yearsExperience || undefined
      );
      updateData.aiSuggestion = aiSuggestion;
    }

    const updated = await db.jobApplication.update({
      where: { id: applicationId },
      data: updateData,
    });

    if (status) {
      await db.notification.createMany({
        data: [{
          userId: application.applicantEmail,
          type: 'application_update',
          title: `Job Application Update - ${application.jobPosting.title}`,
          message: `Your application status has been updated to: ${status.replace('_', ' ')}`,
          schoolId: application.jobPosting.schoolId,
        }],
      });
    }

    return NextResponse.json({ data: updated, message: 'Application updated' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}