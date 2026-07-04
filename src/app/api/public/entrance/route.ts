import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/public/entrance?schoolId=xxx - Get active exam for a school
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');

    if (!schoolId) {
      return NextResponse.json({ error: 'schoolId query parameter is required' }, { status: 400 });
    }

    const exam = await db.entranceExam.findFirst({
      where: { schoolId, isActive: true, deletedAt: null },
      include: {
        school: {
          select: { id: true, name: true, logo: true, primaryColor: true, isActive: true },
        },
        questions: {
          orderBy: { order: 'asc' },
          select: { id: true, type: true, questionText: true, options: true, marks: true, mediaUrl: true, order: true },
        },
      },
    });

    if (!exam || !exam.school.isActive) {
      return NextResponse.json({ error: 'No active entrance exam found for this school' }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        type: exam.type,
        duration: exam.duration,
        instructions: exam.instructions,
        totalMarks: exam.totalMarks,
        school: exam.school,
        questions: exam.questions,
        securitySettings: exam.securitySettings ? JSON.parse(exam.securitySettings) : null,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/public/entrance - Validate code & get exam info
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, schoolId } = body;

    if (!code) {
      return NextResponse.json({ error: 'Entrance code is required' }, { status: 400 });
    }

     const exam = await db.entranceExam.findUnique({
       where: { code },
       include: {
         school: {
           select: {
             id: true,
             name: true,
             logo: true,
             primaryColor: true,
             isActive: true,
           }
         },
         questions: {
           orderBy: { order: 'asc' },
           select: {
             id: true,
             type: true,
             questionText: true,
             options: true,
             marks: true,
             mediaUrl: true,
             order: true,
             // DO NOT select correctAnswer or explanation here
           }
         }
       }
     });

     if (!exam || exam.deletedAt || !exam.isActive) {
       return NextResponse.json({ error: 'Invalid or inactive exam code' }, { status: 404 });
     }

     // Check if the associated school is active
     if (!exam.school.isActive) {
       return NextResponse.json({ error: 'The school associated with this exam is inactive' }, { status: 403 });
     }

     if (schoolId && exam.schoolId !== schoolId) {
       return NextResponse.json({ error: 'The provided code does not match the selected school' }, { status: 400 });
     }

    return NextResponse.json({
      data: {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        type: exam.type,
        duration: exam.duration,
        instructions: exam.instructions,
        totalMarks: exam.totalMarks,
        school: exam.school,
        questions: exam.questions,
        securitySettings: exam.securitySettings ? JSON.parse(exam.securitySettings) : null,
      }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
