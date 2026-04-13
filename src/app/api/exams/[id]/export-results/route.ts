import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { generateExamResultsDocx } from '@/lib/docx-export';

// GET /api/exams/[id]/export-results - Export exam scores/results as CSV or DOCX
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

    // Verify exam exists and get metadata
    const exam = await db.exam.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        type: true,
        totalMarks: true,
        passingMarks: true,
      },
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    // Fetch all scores with student info
    const scores = await db.examScore.findMany({
      where: { examId: id },
      include: {
        student: {
          select: {
            id: true,
            admissionNo: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { score: 'desc' },
    });

    if (scores.length === 0) {
      return NextResponse.json({ error: 'No scores found for this exam' }, { status: 404 });
    }

    // ── DOCX format ────────────────────────────────────────────────────────
    if (format === 'docx') {
      const buffer = await generateExamResultsDocx(exam, scores);

      const safeName = (exam.name || 'exam')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .toLowerCase()
        .substring(0, 50);
      const filename = `${safeName}_results.docx`;

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // ── CSV format (existing logic) ────────────────────────────────────────
    // CSV generation helper
    function escapeCsvField(value: string): string {
      if (!value) return '""';
      if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }

    // Helper to determine grade from percentage
    function getGrade(score: number, total: number): string {
      const percentage = (score / total) * 100;
      if (percentage >= 90) return 'A+';
      if (percentage >= 80) return 'A';
      if (percentage >= 70) return 'B';
      if (percentage >= 60) return 'C';
      if (percentage >= 50) return 'D';
      return 'F';
    }

    // Helper to determine status
    function getStatus(score: number, passing: number): string {
      return score >= passing ? 'Passed' : 'Failed';
    }

    // Build CSV
    const headers = ['Student Name', 'Admission No', 'Score', 'Grade', 'Status'];
    const rows: string[] = [];
    rows.push(headers.join(','));

    scores.forEach((scoreEntry) => {
      const studentName = scoreEntry.student?.user?.name || 'Unknown';
      const admissionNo = scoreEntry.student?.admissionNo || 'N/A';
      const score = scoreEntry.score;
      const grade = scoreEntry.grade || getGrade(score, exam.totalMarks);
      const status = getStatus(score, exam.passingMarks);

      const row = [
        escapeCsvField(studentName),
        escapeCsvField(admissionNo),
        escapeCsvField(String(score)),
        escapeCsvField(grade),
        escapeCsvField(status),
      ];

      rows.push(row.join(','));
    });

    // Add watermark footer rows
    rows.push('');
    rows.push('"Powered by Skoolar || Odebunmi Tawwāb"');
    rows.push(`"Generated on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}"`);

    const csvContent = rows.join('\n');

    // Create safe filename
    const safeName = (exam.name || 'exam')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase()
      .substring(0, 50);
    const filename = `${safeName}_results.csv`;

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
