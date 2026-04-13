import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// Valid question types
const VALID_QUESTION_TYPES = [
  'MCQ',
  'MULTI_SELECT',
  'TRUE_FALSE',
  'FILL_BLANK',
  'SHORT_ANSWER',
  'ESSAY',
  'MATCHING',
] as const;

// Types that require options
const TYPES_REQUIRING_OPTIONS = ['MCQ', 'MULTI_SELECT', 'TRUE_FALSE', 'MATCHING'] as const;

// ==============================
// GET /api/exams/[id]/questions
// ==============================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const includeAnswers = searchParams.get('includeAnswers') === 'true';

    // Verify exam exists
    const exam = await db.exam.findUnique({
      where: { id },
      select: { id: true, isPublished: true },
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    const questions = await db.examQuestion.findMany({
      where: { examId: id },
      orderBy: { order: 'asc' },
    });

    // Parse JSON fields and optionally exclude correctAnswer
    const processed = questions.map((q) => {
      const parsed: Record<string, unknown> = {
        id: q.id,
        examId: q.examId,
        type: q.type,
        questionText: q.questionText,
        marks: q.marks,
        explanation: q.explanation,
        mediaUrl: q.mediaUrl,
        order: q.order,
        createdAt: q.createdAt,
        updatedAt: q.updatedAt,
      };

      // Safely parse options
      if (q.options) {
        try {
          parsed.options = JSON.parse(q.options);
        } catch {
          parsed.options = q.options;
        }
      }

      // Only include correctAnswer if includeAnswers=true
      if (includeAnswers && q.correctAnswer) {
        try {
          parsed.correctAnswer = JSON.parse(q.correctAnswer);
        } catch {
          parsed.correctAnswer = q.correctAnswer;
        }
      }

      return parsed;
    });

    return NextResponse.json({
      data: processed,
      total: processed.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ==============================
// POST /api/exams/[id]/questions
// ==============================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const {
      type,
      questionText,
      options,
      correctAnswer,
      marks,
      explanation,
      mediaUrl,
      order,
    } = body as {
      type?: string;
      questionText?: string;
      options?: unknown;
      correctAnswer?: unknown;
      marks?: number;
      explanation?: string;
      mediaUrl?: string;
      order?: number;
    };

    // Validate required fields
    if (!type || !questionText) {
      return NextResponse.json(
        { error: 'type and questionText are required' },
        { status: 400 }
      );
    }

    // Validate question type
    if (!VALID_QUESTION_TYPES.includes(type as (typeof VALID_QUESTION_TYPES)[number])) {
      return NextResponse.json(
        { error: `Invalid question type. Must be one of: ${VALID_QUESTION_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate that MCQ, MULTI_SELECT, TRUE_FALSE, MATCHING have options
    if (TYPES_REQUIRING_OPTIONS.includes(type as (typeof TYPES_REQUIRING_OPTIONS)[number])) {
      if (!options) {
        return NextResponse.json(
          { error: `Question type "${type}" requires options` },
          { status: 400 }
        );
      }

      // Validate options is an array (for MCQ/MULTI_SELECT/TRUE_FALSE)
      if (type !== 'MATCHING' && !Array.isArray(options)) {
        return NextResponse.json(
          { error: `Options must be an array for type "${type}"` },
          { status: 400 }
        );
      }

      // Validate MATCHING options format { pairs: [{left, right}] }
      if (type === 'MATCHING') {
        try {
          const parsed = typeof options === 'string' ? JSON.parse(options) : options;
          if (
            !parsed ||
            typeof parsed !== 'object' ||
            !Array.isArray(parsed.pairs) ||
            parsed.pairs.length === 0
          ) {
            return NextResponse.json(
              { error: 'MATCHING type requires options with format: { pairs: [{left, right}] }' },
              { status: 400 }
            );
          }
        } catch {
          return NextResponse.json(
            { error: 'Invalid MATCHING options format. Expected: { pairs: [{left, right}] }' },
            { status: 400 }
          );
        }
      }
    }

    // Validate correctAnswer format based on type
    if (correctAnswer !== undefined && correctAnswer !== null) {
      if (type === 'MCQ') {
        // MCQ correctAnswer should be a string (index, letter, or option text)
        if (typeof correctAnswer !== 'string') {
          return NextResponse.json(
            { error: 'MCQ correctAnswer must be a string (option index, letter, or text)' },
            { status: 400 }
          );
        }
      } else if (type === 'MULTI_SELECT') {
        // MULTI_SELECT correctAnswer should be an array
        if (!Array.isArray(correctAnswer)) {
          return NextResponse.json(
            { error: 'MULTI_SELECT correctAnswer must be an array' },
            { status: 400 }
          );
        }
      } else if (type === 'TRUE_FALSE') {
        // TRUE_FALSE correctAnswer should be "true" or "false"
        if (correctAnswer !== 'true' && correctAnswer !== 'false') {
          return NextResponse.json(
            { error: 'TRUE_FALSE correctAnswer must be "true" or "false"' },
            { status: 400 }
          );
        }
      } else if (type === 'FILL_BLANK') {
        // FILL_BLANK correctAnswer should be an array of acceptable answers
        if (!Array.isArray(correctAnswer)) {
          return NextResponse.json(
            { error: 'FILL_BLANK correctAnswer must be an array of acceptable answers' },
            { status: 400 }
          );
        }
      }
    }

    // Verify exam exists
    const exam = await db.exam.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    // Auto-set order if not provided
    let questionOrder = order;
    if (questionOrder === undefined || questionOrder === null) {
      const maxOrder = await db.examQuestion.findFirst({
        where: { examId: id },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      questionOrder = (maxOrder?.order ?? -1) + 1;
    }

    // Create the question
    const question = await db.examQuestion.create({
      data: {
        examId: id,
        type,
        questionText,
        options: options ? JSON.stringify(options) : null,
        correctAnswer: correctAnswer !== undefined && correctAnswer !== null
          ? JSON.stringify(correctAnswer)
          : null,
        marks: marks ?? 1,
        explanation: explanation || null,
        mediaUrl: mediaUrl || null,
        order: questionOrder,
      },
    });

    // Return the created question with parsed JSON fields
    const response: Record<string, unknown> = {
      ...question,
    };

    if (question.options) {
      try {
        response.options = JSON.parse(question.options);
      } catch {
        response.options = question.options;
      }
    }

    if (question.correctAnswer) {
      try {
        response.correctAnswer = JSON.parse(question.correctAnswer);
      } catch {
        response.correctAnswer = question.correctAnswer;
      }
    }

    return NextResponse.json({ data: response }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ==============================
// PUT /api/exams/[id]/questions - Bulk update questions
// ==============================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { questions } = body as { questions?: unknown[] };

    if (!questions || !Array.isArray(questions)) {
      return NextResponse.json(
        { error: 'questions array is required' },
        { status: 400 }
      );
    }

    // Verify exam exists
    const exam = await db.exam.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    const updated: unknown[] = [];
    const errors: { id: string; error: string }[] = [];

    for (const q of questions) {
      const questionData = q as {
        id?: string;
        questionText?: string;
        options?: unknown;
        correctAnswer?: unknown;
        marks?: number;
        explanation?: string;
        order?: number;
      };

      if (!questionData.id) {
        errors.push({ id: 'unknown', error: 'Missing question id' });
        continue;
      }

      // Verify question belongs to this exam
      const existing = await db.examQuestion.findFirst({
        where: { id: questionData.id, examId: id },
      });

      if (!existing) {
        errors.push({ id: questionData.id, error: 'Question not found or does not belong to this exam' });
        continue;
      }

      // Validate question type if updating
      if (questionData.questionText !== undefined && !questionData.questionText) {
        errors.push({ id: questionData.id, error: 'questionText cannot be empty' });
        continue;
      }

      try {
        const updateData: Record<string, unknown> = {};

        if (questionData.questionText !== undefined) {
          updateData.questionText = questionData.questionText;
        }
        if (questionData.marks !== undefined) {
          updateData.marks = questionData.marks;
        }
        if (questionData.explanation !== undefined) {
          updateData.explanation = questionData.explanation;
        }
        if (questionData.order !== undefined) {
          updateData.order = questionData.order;
        }
        if (questionData.options !== undefined) {
          updateData.options = questionData.options !== null
            ? JSON.stringify(questionData.options)
            : null;
        }
        if (questionData.correctAnswer !== undefined) {
          updateData.correctAnswer = questionData.correctAnswer !== null
            ? JSON.stringify(questionData.correctAnswer)
            : null;
        }

        const result = await db.examQuestion.update({
          where: { id: questionData.id },
          data: updateData,
        });

        // Parse JSON fields for response
        const parsed: Record<string, unknown> = { ...result };
        if (result.options) {
          try { parsed.options = JSON.parse(result.options); } catch { parsed.options = result.options; }
        }
        if (result.correctAnswer) {
          try { parsed.correctAnswer = JSON.parse(result.correctAnswer); } catch { parsed.correctAnswer = result.correctAnswer; }
        }

        updated.push(parsed);
      } catch (updateError) {
        const errMsg = updateError instanceof Error ? updateError.message : 'Failed to update question';
        errors.push({ id: questionData.id, error: errMsg });
      }
    }

    return NextResponse.json({
      data: updated,
      errors: errors.length > 0 ? errors : undefined,
      updatedCount: updated.length,
      errorCount: errors.length,
      message: `${updated.length} question(s) updated successfully`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ==============================
// DELETE /api/exams/[id]/questions - Delete a question
// ==============================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { questionId } = body as { questionId?: string };

    if (!questionId) {
      return NextResponse.json(
        { error: 'questionId is required' },
        { status: 400 }
      );
    }

    // Verify exam exists
    const exam = await db.exam.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    // Verify question belongs to this exam
    const question = await db.examQuestion.findFirst({
      where: { id: questionId, examId: id },
    });

    if (!question) {
      return NextResponse.json(
        { error: 'Question not found or does not belong to this exam' },
        { status: 404 }
      );
    }

    // Delete the question (cascade will handle related data)
    await db.examQuestion.delete({
      where: { id: questionId },
    });

    return NextResponse.json({
      message: 'Question deleted successfully',
      deletedQuestionId: questionId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
