import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || '';

    if (action === 'registrations') {
      return getRegistrations(request, authResult);
    }
    if (action === 'my-registration') {
      return getMyRegistration(request, authResult);
    }
    if (action === 'pending-count') {
      return getPendingCount(request, authResult);
    }

    if (authResult instanceof NextResponse) return authResult;
    const auth = authResult;

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const schoolId = searchParams.get('schoolId') || auth.schoolId;

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 });
    }

    const where = { schoolId, deletedAt: null };

    const [data, total] = await Promise.all([
      db.entranceExam.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { attempts: true, questions: true } } }
      }),
      db.entranceExam.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || '';

  if (action === 'register') {
    return registerForExam(request);
  }

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const auth = authResult;

  if (!['SCHOOL_ADMIN', 'DIRECTOR', 'SUPER_ADMIN'].includes(auth.role || '')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  if (action === 'approve-registration') return approveRegistration(request);
  if (action === 'reject-registration') return rejectRegistration(request);
  if (action === 'defer-registration') return deferRegistration(request);
  if (action === 'admit-candidate') return admitCandidate(request);
  if (action === 'accept-deferred-offer') return acceptDeferredOffer(request);
  if (action === 'decline-deferred-offer') return declineDeferredOffer(request);

  try {
    const body = await request.json();
    const { title, description, type, totalMarks, passingMarks, duration, instructions, allowCalculator, calculatorMode, shuffleQuestions, shuffleOptions } = body;
    let { schoolId } = body;
    schoolId = schoolId || auth.schoolId;

    if (!title || !schoolId) {
      return NextResponse.json({ error: 'Title and School ID are required' }, { status: 400 });
    }

    let isUnique = false;
    let code = '';
    while (!isUnique) {
      code = generateCode();
      const existing = await db.entranceExam.findUnique({ where: { code } });
      if (!existing) isUnique = true;
    }

    const exam = await db.entranceExam.create({
      data: { schoolId, title, description: description || null, code, type: type || 'assessment', totalMarks: totalMarks || 100, passingMarks: passingMarks || 50, duration: duration || null, instructions: instructions || null, allowCalculator: allowCalculator !== undefined ? allowCalculator : true, calculatorMode: calculatorMode || 'basic', shuffleQuestions: shuffleQuestions || false, shuffleOptions: shuffleOptions || false, isActive: true },
    });

    return NextResponse.json({ data: exam, message: 'Entrance exam created' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function getRegistrations(request: NextRequest, authResult: unknown) {
  try {
    if (authResult instanceof NextResponse) return authResult;
    const auth = authResult as { schoolId?: string };
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId') || auth.schoolId;
    const status = searchParams.get('status') || '';
    const examId = searchParams.get('examId') || '';

    if (!schoolId) return NextResponse.json({ error: 'School ID required' }, { status: 400 });

    const where: Record<string, unknown> = {};
    if (status) where.registrationStatus = status;
    if (examId) where.entranceExamId = examId;
    else where.exam = { schoolId };

    const registrations = await db.entranceExamAttempt.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { exam: { select: { id: true, title: true, code: true, schoolId: true } } },
    });

    return NextResponse.json({ data: registrations });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function getMyRegistration(request: NextRequest, authResult: unknown) {
  try {
    if (authResult instanceof NextResponse) return authResult;
    const auth = authResult as { id: string };
    const userId = auth.id;

    const attempt = await db.entranceExamAttempt.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { exam: { select: { id: true, title: true, code: true, totalMarks: true, passingMarks: true, duration: true } } },
    });

    if (!attempt) return NextResponse.json({ data: null, message: 'No registration found' });
    return NextResponse.json({ data: attempt });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function getPendingCount(request: NextRequest, authResult: unknown) {
  try {
    if (authResult instanceof NextResponse) return authResult;
    const auth = authResult as { schoolId?: string };
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId') || auth.schoolId;

    const count = await db.entranceExamAttempt.count({
      where: { registrationStatus: 'pending', exam: { schoolId } },
    });

    return NextResponse.json({ data: { count } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function registerForExam(request: NextRequest) {
  try {
    const body = await request.json();
    const { examId, applicantName, applicantEmail, applicantPhone, applicantAddress, appliedClass, userId } = body;

    if (!examId || !applicantName) {
      return NextResponse.json({ error: 'Exam ID and name are required' }, { status: 400 });
    }

    const exam = await db.entranceExam.findUnique({ where: { id: examId } });
    if (!exam || !exam.isActive) {
      return NextResponse.json({ error: 'Exam not found or not active' }, { status: 404 });
    }

    const existing = await db.entranceExamAttempt.findFirst({
      where: {
        entranceExamId: examId,
        OR: [
          { applicantEmail: applicantEmail || undefined },
          { applicantPhone: applicantPhone || undefined },
          ...(userId ? [{ userId }] : []),
        ].filter(x => Object.values(x).some(Boolean)),
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'You have already registered for this exam' }, { status: 400 });
    }

    const attempt = await db.entranceExamAttempt.create({
      data: { entranceExamId: examId, applicantName, applicantEmail: applicantEmail || null, applicantPhone: applicantPhone || null, applicantAddress: applicantAddress || null, appliedClass: appliedClass || null, userId: userId || null, registrationStatus: 'pending', status: 'pending' },
    });

    return NextResponse.json({ data: attempt, message: 'Registration submitted successfully. You will be notified once your registration is reviewed.' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function approveRegistration(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { attemptId } = body;

    if (!attemptId) {
      return NextResponse.json({ error: 'Attempt ID required' }, { status: 400 });
    }

    const attempt = await db.entranceExamAttempt.update({
      where: { id: attemptId },
      data: { registrationStatus: 'approved', adminNotes: `Registration approved on ${new Date().toISOString()}` },
    });

    return NextResponse.json({ data: attempt, message: 'Registration approved. Candidate can now take the exam.' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function rejectRegistration(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { attemptId, reason, canRetry = true } = body;

    if (!attemptId) {
      return NextResponse.json({ error: 'Attempt ID required' }, { status: 400 });
    }

    const attempt = await db.entranceExamAttempt.update({
      where: { id: attemptId },
      data: { registrationStatus: 'rejected', canRetry, adminNotes: reason ? `Rejected: ${reason}` : 'Registration rejected' },
    });

    return NextResponse.json({ data: attempt, message: 'Registration rejected. Candidate has been notified.' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function deferRegistration(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { attemptId, deferredClass, reason } = body;

    if (!attemptId || !deferredClass) {
      return NextResponse.json({ error: 'Attempt ID and deferred class are required' }, { status: 400 });
    }

    const attempt = await db.entranceExamAttempt.update({
      where: { id: attemptId },
      data: { registrationStatus: 'deferred', deferredClass, adminNotes: reason ? `Deferred to ${deferredClass}: ${reason}` : `Deferred to ${deferredClass}`, admissionOfferSentAt: new Date() },
    });

    return NextResponse.json({ data: attempt, message: `Candidate has been deferred to ${deferredClass}. They will need to accept or decline this offer.` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function admitCandidate(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { attemptId, admittedClass } = body;

    if (!attemptId || !admittedClass) {
      return NextResponse.json({ error: 'Attempt ID and admitted class are required' }, { status: 400 });
    }

    const attempt = await db.entranceExamAttempt.update({
      where: { id: attemptId },
      data: { registrationStatus: 'admitted', appliedClass: admittedClass, admittedAt: new Date(), adminNotes: `Admitted to ${admittedClass} on ${new Date().toISOString()}` },
    });

    return NextResponse.json({ data: attempt, message: `Candidate has been admitted to ${admittedClass}. They can now access the student portal.` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function acceptDeferredOffer(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const userId = auth.id;

    const attempt = await db.entranceExamAttempt.findFirst({
      where: { userId, registrationStatus: 'deferred' },
    });

    if (!attempt) {
      return NextResponse.json({ error: 'No pending deferred offer found' }, { status: 404 });
    }

    const updated = await db.entranceExamAttempt.update({
      where: { id: attempt.id },
      data: { registrationStatus: 'admitted', admittedAt: new Date(), appliedClass: attempt.deferredClass, deferredOfferAccepted: true },
    });

    return NextResponse.json({ data: updated, message: `You have accepted the offer to join ${attempt.deferredClass}. Your account has been updated.` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function declineDeferredOffer(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const userId = auth.id;

    const attempt = await db.entranceExamAttempt.findFirst({
      where: { userId, registrationStatus: 'deferred' },
    });

    if (!attempt) {
      return NextResponse.json({ error: 'No pending deferred offer found' }, { status: 404 });
    }

    const updated = await db.entranceExamAttempt.update({
      where: { id: attempt.id },
      data: { deferredOfferAccepted: false, canRetry: true, adminNotes: (attempt.adminNotes || '') + ' | Candidate declined offer on ' + new Date().toISOString() },
    });

    return NextResponse.json({ data: updated, message: 'You have declined the offer. You can reapply during the next admission cycle.' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}