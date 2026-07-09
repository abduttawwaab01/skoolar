import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

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
    const auth = authResult as { role?: string; schoolId?: string };

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const querySchoolId = searchParams.get('schoolId') || '';
    // Auth-first: SUPER_ADMIN may use query schoolId; others must use their own
    const schoolId = auth.role === 'SUPER_ADMIN' && querySchoolId
      ? querySchoolId
      : (auth.schoolId || '');

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
        include: {
          _count: {
            select: {
              attempts: true,
              questions: true,
            }
          },
          class: {
            select: { id: true, name: true }
          }
        }
      }),
      db.entranceExam.count({ where }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
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
  const auth = authResult as { id: string; schoolId?: string; role?: string };

  if (!['SCHOOL_ADMIN', 'DIRECTOR', 'SUPER_ADMIN'].includes(auth.role || '')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  if (action === 'approve-registration') {
    return approveRegistration(request);
  }
  if (action === 'reject-registration') {
    return rejectRegistration(request);
  }
  if (action === 'defer-registration') {
    return deferRegistration(request);
  }
  if (action === 'admit-candidate') {
    return admitCandidate(request);
  }
  if (action === 'accept-deferred-offer') {
    return acceptDeferredOffer(request);
  }
  if (action === 'decline-deferred-offer') {
    return declineDeferredOffer(request);
  }
  if (action === 'bulk-register') {
    return bulkRegister(request);
  }
  if (action === 'update-attempt') {
    return updateAttempt(request);
  }
  if (action === 'delete-attempt') {
    return deleteAttempt(request);
  }

  try {
    const body = await request.json();
    const {
      title, description, type, totalMarks, passingMarks, duration, instructions,
      allowCalculator, calculatorMode, shuffleQuestions, shuffleOptions, classId
    } = body;
    
    let { schoolId: bodySchoolId } = body;
    // Auth-first: SUPER_ADMIN may use body schoolId; others must use their own
    const schoolId = auth.role === 'SUPER_ADMIN' && bodySchoolId
      ? bodySchoolId
      : (auth.schoolId || '');

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
      data: {
        schoolId,
        title,
        description: description || null,
        code,
        type: type || 'assessment',
        totalMarks: totalMarks || 100,
        passingMarks: passingMarks || 50,
        duration: duration || null,
        instructions: instructions || null,
        allowCalculator: allowCalculator !== undefined ? allowCalculator : true,
        calculatorMode: calculatorMode || 'basic',
        shuffleQuestions: shuffleQuestions || false,
        shuffleOptions: shuffleOptions || false,
        classId: classId || null,
        isActive: true,
      },
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
    const auth = authResult as { role?: string; schoolId?: string };

    const { searchParams } = new URL(request.url);
    const querySchoolId = searchParams.get('schoolId') || '';
    // Auth-first: SUPER_ADMIN may use query schoolId; others must use their own
    const schoolId = auth.role === 'SUPER_ADMIN' && querySchoolId
      ? querySchoolId
      : (auth.schoolId || '');
    const status = searchParams.get('status') || '';
    const examId = searchParams.get('examId') || '';

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 });
    }
    
    const where: Record<string, unknown> = {};
    
    if (status) {
      where.registrationStatus = status;
    }
    
    if (examId) {
      where.entranceExamId = examId;
    } else {
      where.exam = { schoolId };
    }
    
    const registrations = await db.entranceExamAttempt.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        exam: { select: { id: true, title: true, code: true, schoolId: true } },
      },
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
      include: {
        exam: { select: { id: true, title: true, code: true, totalMarks: true, passingMarks: true, duration: true } },
      },
    });
    
    if (!attempt) {
      return NextResponse.json({ data: null, message: 'No registration found' });
    }
    
    return NextResponse.json({ data: attempt });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function getPendingCount(request: NextRequest, authResult: unknown) {
  try {
    if (authResult instanceof NextResponse) return authResult;
    const auth = authResult as { role?: string; schoolId?: string };

    const { searchParams } = new URL(request.url);
    const querySchoolId = searchParams.get('schoolId') || '';
    // Auth-first: SUPER_ADMIN may use query schoolId; others must use their own
    const schoolId = auth.role === 'SUPER_ADMIN' && querySchoolId
      ? querySchoolId
      : (auth.schoolId || '');
    
    const count = await db.entranceExamAttempt.count({
      where: {
        registrationStatus: 'pending',
        exam: { schoolId },
      },
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
    
    const orConditions: Record<string, string>[] = [];
    if (applicantEmail) orConditions.push({ applicantEmail });
    if (applicantPhone) orConditions.push({ applicantPhone });
    if (userId) orConditions.push({ userId });
    
    if (orConditions.length > 0) {
      const existing = await db.entranceExamAttempt.findFirst({
        where: { entranceExamId: examId, OR: orConditions },
      });
      if (existing) {
        return NextResponse.json({ error: 'You have already registered for this exam' }, { status: 400 });
      }
    }
    
    const attempt = await db.entranceExamAttempt.create({
      data: {
        entranceExamId: examId,
        applicantName,
        applicantEmail: applicantEmail || null,
        applicantPhone: applicantPhone || null,
        applicantAddress: applicantAddress || null,
        appliedClass: appliedClass || null,
        userId: userId || null,
        registrationStatus: 'registered',
        status: 'in_progress',
      },
    });
    
    return NextResponse.json({ 
      data: attempt, 
      message: 'Registration successful. You can now proceed to take the exam.' 
    }, { status: 201 });
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
      data: {
        registrationStatus: 'approved',
        adminNotes: `Registration approved on ${new Date().toISOString()}`,
      },
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
      data: {
        registrationStatus: 'rejected',
        canRetry,
        adminNotes: reason ? `Rejected: ${reason}` : 'Registration rejected',
      },
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
      data: {
        registrationStatus: 'deferred',
        deferredClass,
        adminNotes: reason ? `Deferred to ${deferredClass}: ${reason}` : `Deferred to ${deferredClass}`,
        admissionOfferSentAt: new Date(),
      },
    });
    
    return NextResponse.json({ 
      data: attempt, 
      message: `Candidate has been deferred to ${deferredClass}. They will need to accept or decline this offer.` 
    });
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
    
    // 1. Fetch attempt data with school context
    const attempt = await db.entranceExamAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          select: { schoolId: true, title: true }
        }
      }
    });

    if (!attempt) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    }

    if (attempt.registrationStatus === 'admitted') {
      return NextResponse.json({ error: 'Candidate already admitted' }, { status: 400 });
    }

    if (!attempt.applicantEmail) {
      return NextResponse.json({ error: 'Applicant email is required for account creation' }, { status: 400 });
    }

    // 2. Find target class record in this school
    const targetClass = await db.class.findFirst({
      where: {
        schoolId: attempt.exam.schoolId,
        name: admittedClass,
        deletedAt: null
      }
    });

    // 3. Automation: Create User & Student record in a transaction
    const defaultPassword = 'Welcome@Skoolar123';
    const hashedPassword = await bcrypt.hash(defaultPassword, SALT_ROUNDS);

    // Generate a unique-ish admission number
    const admissionNo = `ADM-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const result = await db.$transaction(async (tx) => {
      // Check if user already exists
      const existingUser = await tx.user.findUnique({
        where: { email: attempt.applicantEmail!.toLowerCase() }
      });

      if (existingUser) {
        throw new Error(`A user with email ${attempt.applicantEmail} already exists.`);
      }

      // Create User
      const user = await tx.user.create({
        data: {
          email: attempt.applicantEmail!.toLowerCase(),
          password: hashedPassword,
          name: attempt.applicantName,
          role: 'STUDENT',
          schoolId: attempt.exam.schoolId,
          phone: attempt.applicantPhone,
          isActive: true,
          emailVerified: new Date(),
        }
      });

      // Create Student profile
      const student = await tx.student.create({
        data: {
          schoolId: attempt.exam.schoolId,
          userId: user.id,
          admissionNo,
          classId: targetClass?.id || null,
          isActive: true,
        }
      });

      // Update Entrance Exam Attempt to link user and mark as admitted
      const updatedAttempt = await tx.entranceExamAttempt.update({
        where: { id: attemptId },
        data: {
          registrationStatus: 'admitted',
          appliedClass: admittedClass,
          admittedAt: new Date(),
          userId: user.id,
          adminNotes: (attempt.adminNotes || '') + ` | Automatically admitted to ${admittedClass} and account created on ${new Date().toISOString()}`,
        },
      });

      return { user, student, updatedAttempt };
    });
    
    return NextResponse.json({ 
      data: result.updatedAttempt,
      message: `Candidate admitted successfully. Student account created for ${attempt.applicantEmail} (Default Pass: ${defaultPassword}).`
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Admit Candidate Error]', message);
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
      data: {
        registrationStatus: 'admitted',
        admittedAt: new Date(),
        appliedClass: attempt.deferredClass,
        deferredOfferAccepted: true,
      },
    });
    
    return NextResponse.json({ 
      data: updated, 
      message: `You have accepted the offer to join ${attempt.deferredClass}. Your account has been updated.` 
    });
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
      data: {
        deferredOfferAccepted: false,
        canRetry: true,
        adminNotes: (attempt.adminNotes || '') + ' | Candidate declined offer on ' + new Date().toISOString(),
      },
    });
    
    return NextResponse.json({ 
      data: updated, 
      message: 'You have declined the offer. You can reapply during the next admission cycle.' 
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function bulkRegister(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    
    const body = await request.json();
    const { examId, candidates, autoApprove = true } = body;
    
    if (!examId || !candidates || !Array.isArray(candidates)) {
      return NextResponse.json({ error: 'Exam ID and candidates list are required' }, { status: 400 });
    }
    
    const exam = await db.entranceExam.findUnique({ where: { id: examId } });
    if (!exam) return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    
    const results = await db.$transaction(async (tx) => {
      const created: any[] = [];
      const skipped: any[] = [];
      
      for (const cand of candidates) {
        if (!cand.applicantName) {
          skipped.push({ ...cand, error: 'Name is required' });
          continue;
        }
        
        if (cand.applicantEmail || cand.applicantPhone) {
          const existing = await tx.entranceExamAttempt.findFirst({
            where: {
              entranceExamId: examId,
              OR: [
                ...(cand.applicantEmail ? [{ applicantEmail: cand.applicantEmail }] : []),
                ...(cand.applicantPhone ? [{ applicantPhone: cand.applicantPhone }] : []),
              ],
            },
          });
          
          if (existing) {
            skipped.push({ ...cand, error: 'Already registered' });
            continue;
          }
        }
        
        const attempt = await tx.entranceExamAttempt.create({
          data: {
            entranceExamId: examId,
            applicantName: cand.applicantName,
            applicantEmail: cand.applicantEmail || null,
            applicantPhone: cand.applicantPhone || null,
            appliedClass: cand.appliedClass || null,
            registrationStatus: autoApprove ? 'approved' : 'pending',
            status: 'pending',
          },
        });
        created.push(attempt);
      }
      
      return { created, skipped };
    });
    
    return NextResponse.json({ 
      data: results, 
      message: `Successfully registered ${results.created.length} candidates. ${results.skipped.length} skipped.` 
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function updateAttempt(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['SCHOOL_ADMIN', 'DIRECTOR', 'SUPER_ADMIN'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { attemptId, applicantName, applicantEmail, applicantPhone, applicantAddress, appliedClass } = body;

    if (!attemptId) {
      return NextResponse.json({ error: 'Attempt ID required' }, { status: 400 });
    }

    const existing = await db.entranceExamAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: { select: { schoolId: true } } }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    }
    if (auth.role !== 'SUPER_ADMIN' && existing.exam.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updated = await db.entranceExamAttempt.update({
      where: { id: attemptId },
      data: {
        ...(applicantName !== undefined && { applicantName }),
        ...(applicantEmail !== undefined && { applicantEmail }),
        ...(applicantPhone !== undefined && { applicantPhone }),
        ...(applicantAddress !== undefined && { applicantAddress }),
        ...(appliedClass !== undefined && { appliedClass }),
      },
    });

    return NextResponse.json({ data: updated, message: 'Applicant updated' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function deleteAttempt(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['SCHOOL_ADMIN', 'DIRECTOR', 'SUPER_ADMIN'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { attemptId } = body;

    if (!attemptId) {
      return NextResponse.json({ error: 'Attempt ID required' }, { status: 400 });
    }

    const existing = await db.entranceExamAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: { select: { schoolId: true } } }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    }
    if (auth.role !== 'SUPER_ADMIN' && existing.exam.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.entranceExamAttempt.delete({ where: { id: attemptId } });

    return NextResponse.json({ message: 'Applicant deleted' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}