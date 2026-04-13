import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/entrance-exams/[id] - Get full exam details including questions and attempts
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const exam = await db.entranceExam.findUnique({
      where: { id, deletedAt: null },
      include: {
        questions: {
          orderBy: { order: 'asc' }
        },
        attempts: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    // Validate school access
    if (auth.role !== 'SUPER_ADMIN' && exam.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ data: exam });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/entrance-exams/[id] - Update exam details
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['SCHOOL_ADMIN', 'DIRECTOR', 'SUPER_ADMIN'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await db.entranceExam.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }
    if (auth.role !== 'SUPER_ADMIN' && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updated = await db.entranceExam.update({
      where: { id },
      data: {
        title: body.title !== undefined ? body.title : undefined,
        description: body.description !== undefined ? body.description : undefined,
        isActive: body.isActive !== undefined ? body.isActive : undefined,
        duration: body.duration !== undefined ? body.duration : undefined,
        totalMarks: body.totalMarks !== undefined ? body.totalMarks : undefined,
        passingMarks: body.passingMarks !== undefined ? body.passingMarks : undefined,
        securitySettings: body.securitySettings !== undefined ? JSON.stringify(body.securitySettings) : undefined,
      }
    });

    return NextResponse.json({ data: updated, message: 'Exam updated' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/entrance-exams/[id] - Soft delete an exam
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['SCHOOL_ADMIN', 'DIRECTOR', 'SUPER_ADMIN'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    
    const existing = await db.entranceExam.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }
    if (auth.role !== 'SUPER_ADMIN' && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.entranceExam.update({
      where: { id },
      data: { 
        deletedAt: new Date(),
        isActive: false 
      }
    });

    return NextResponse.json({ message: 'Exam deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
