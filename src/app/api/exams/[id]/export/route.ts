import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { generateQuestionsDocx } from '@/lib/docx-export';

// GET /api/exams/[id]/export - Export exam questions as CSV or DOCX
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';

    if (!['csv', 'docx'].includes(format)) {
      return NextResponse.json(
        { error: 'Unsupported format. Use ?format=csv or ?format=docx' },
        { status: 400 }
      );
    }

    // Verify exam exists
    const exam = await db.exam.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        type: true,
        totalMarks: true,
        passingMarks: true,
        duration: true,
        instructions: true,
        subject: { select: { name: true } },
        class: { select: { name: true } },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    // Fetch all questions with answers
    const questions = await db.examQuestion.findMany({
      where: { examId: id },
      orderBy: { order: 'asc' },
    });

    if (questions.length === 0) {
      return NextResponse.json({ error: 'No questions found for this exam' }, { status: 404 });
    }

    // ── DOCX format ────────────────────────────────────────────────────────
    if (format === 'docx') {
      const buffer = await generateQuestionsDocx(exam, questions);

      const safeName = (exam.name || 'exam')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .toLowerCase()
        .substring(0, 50);
      const filename = `${safeName}_questions.docx`;

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // ── CSV format (existing logic) ────────────────────────────────────────
    // CSV generation helper - escape fields containing commas, quotes, or newlines
    function escapeCsvField(value: string): string {
      if (!value) return '""';
      if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }

    // Build CSV header
    const headers = ['No.', 'Type', 'Question', 'Options', 'Correct Answer', 'Marks', 'Explanation'];

    // Build CSV rows
    const rows: string[] = [];
    rows.push(headers.join(','));

    questions.forEach((q, index) => {
      // Parse options
      let optionsStr = '';
      if (q.options) {
        try {
          const parsed = JSON.parse(q.options);
          if (Array.isArray(parsed)) {
            optionsStr = parsed.map((opt: string, i: number) => `${String.fromCharCode(65 + i)}. ${opt}`).join(' | ');
          } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.pairs)) {
            // MATCHING type
            optionsStr = parsed.pairs
              .map((pair: { left: string; right: string }) => `${pair.left} → ${pair.right}`)
              .join(' | ');
          } else {
            optionsStr = String(q.options);
          }
        } catch {
          optionsStr = q.options || '';
        }
      }

      // Parse correct answer
      let correctAnswerStr = '';
      if (q.correctAnswer) {
        try {
          const parsed = JSON.parse(q.correctAnswer);
          if (Array.isArray(parsed)) {
            correctAnswerStr = parsed.join(', ');
          } else if (typeof parsed === 'object' && parsed !== null) {
            correctAnswerStr = JSON.stringify(parsed);
          } else {
            correctAnswerStr = String(parsed);
          }
        } catch {
          correctAnswerStr = q.correctAnswer || '';
        }
      }

      // Clean question text (remove extra whitespace/newlines for CSV)
      const questionText = (q.questionText || '')
        .replace(/\r\n/g, ' ')
        .replace(/\n/g, ' ')
        .replace(/\r/g, ' ')
        .trim();

      const explanationText = (q.explanation || '')
        .replace(/\r\n/g, ' ')
        .replace(/\n/g, ' ')
        .replace(/\r/g, ' ')
        .trim();

      const row = [
        escapeCsvField(String(index + 1)),
        escapeCsvField(q.type),
        escapeCsvField(questionText),
        escapeCsvField(optionsStr),
        escapeCsvField(correctAnswerStr),
        escapeCsvField(String(q.marks)),
        escapeCsvField(explanationText),
      ];

      rows.push(row.join(','));
    });

    // Add watermark footer rows
    rows.push('');
    rows.push('"Powered by Skoolar || Odebunmi Tawwāb"');
    rows.push(`"Generated on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}"`);

    const csvContent = rows.join('\n');

    // Create exam name safe for filename
    const safeName = (exam.name || 'exam')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase()
      .substring(0, 50);
    const filename = `${safeName}_questions.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
