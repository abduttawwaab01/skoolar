import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/lessons/[id]/quizzes - List quizzes for a lesson
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const lesson = await db.videoLesson.findUnique({
      where: { id },
      select: { id: true, title: true },
    });

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    const quizzes = await db.lessonQuiz.findMany({
      where: { lessonId: id },
      include: {
        questions: { orderBy: { order: 'asc' } },
        _count: { select: { attempts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      data: quizzes,
      total: quizzes.length,
      lesson: { id: lesson.id, title: lesson.title },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/lessons/[id]/quizzes - Create or update a quiz for a lesson
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, quizId, title, description, timeLimit, passingScore, showResults, isPublished, questions } = body as {
      action?: string;
      quizId?: string;
      title: string;
      description?: string | null;
      timeLimit?: number | null;
      passingScore?: number;
      showResults?: boolean;
      isPublished?: boolean;
      questions?: {
        id?: string;
        type: string;
        questionText: string;
        options?: string | null;
        correctAnswer?: string | null;
        marks?: number;
        order?: number;
      }[];
    };

    if (!title) {
      return NextResponse.json({ error: 'Quiz title is required' }, { status: 400 });
    }

    const lesson = await db.videoLesson.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    if (action === 'update' && quizId) {
      const existing = await db.lessonQuiz.findUnique({ where: { id: quizId } });
      if (!existing) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

      await db.lessonQuizQuestion.deleteMany({ where: { quizId } });

      const quiz = await db.lessonQuiz.update({
        where: { id: quizId },
        data: {
          title,
          description: description || null,
          timeLimit: timeLimit || null,
          passingScore: passingScore || 60,
          showResults: showResults !== undefined ? showResults : true,
          isPublished: isPublished !== undefined ? isPublished : true,
          questions: {
            create: (questions || []).map((q, index) => ({
              type: q.type || 'MCQ',
              questionText: q.questionText,
              options: q.options || null,
              correctAnswer: q.correctAnswer || null,
              marks: q.marks || 1,
              order: q.order ?? index,
            })),
          },
        },
        include: { questions: { orderBy: { order: 'asc' } } },
      });

      return NextResponse.json({ data: quiz, message: 'Quiz updated successfully' });
    }

    const quiz = await db.lessonQuiz.create({
      data: {
        lessonId: id,
        title,
        description: description || null,
        timeLimit: timeLimit || null,
        passingScore: passingScore || 60,
        showResults: showResults !== undefined ? showResults : true,
        isPublished: isPublished !== undefined ? isPublished : true,
        questions: {
          create: (questions || []).map((q, index) => ({
            type: q.type || 'MCQ',
            questionText: q.questionText,
            options: q.options || null,
            correctAnswer: q.correctAnswer || null,
            marks: q.marks || 1,
            order: q.order ?? index,
          })),
        },
      },
      include: {
        questions: { orderBy: { order: 'asc' } },
      },
    });

    return NextResponse.json(
      { data: quiz, message: 'Quiz created successfully' },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/lessons/[id]/quizzes - Delete a quiz
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { quizId } = body;

    if (!quizId) {
      return NextResponse.json({ error: 'quizId is required' }, { status: 400 });
    }

    await db.lessonQuiz.delete({ where: { id: quizId, lessonId: id } });

    return NextResponse.json({ message: 'Quiz deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
