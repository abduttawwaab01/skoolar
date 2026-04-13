/**
 * Client-side PDF Export Helper for Skoolar
 *
 * Uses the browser's print API to generate a PDF from formatted HTML.
 * Call `exportQuestionsPdf(exam, questions)` or `exportResultsPdf(exam, scores)` from client code.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PdfExamInfo {
  name: string;
  type?: string;
  totalMarks?: number;
  passingMarks?: number;
  subject?: string;
  class?: string;
  duration?: number | null;
  instructions?: string | null;
}

export interface PdfQuestion {
  type: string;
  questionText: string;
  options?: string | null;
  correctAnswer?: string | null;
  marks: number;
  explanation?: string | null;
  order: number;
}

export interface PdfScoreEntry {
  score: number;
  grade?: string | null;
  studentName?: string | null;
  admissionNo?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatQuestionType(type: string): string {
  const labels: Record<string, string> = {
    MCQ: 'Multiple Choice',
    MULTI_SELECT: 'Multiple Select',
    TRUE_FALSE: 'True / False',
    FILL_BLANK: 'Fill in the Blank',
    SHORT_ANSWER: 'Short Answer',
    ESSAY: 'Essay',
    MATCHING: 'Matching',
  };
  return labels[type] || type;
}

function parseOptions(options: string | null | undefined): string[] {
  if (!options) return [];
  try {
    const parsed = JSON.parse(options);
    if (Array.isArray(parsed)) {
      return parsed.map((opt: string, i: number) => `${String.fromCharCode(65 + i)}. ${opt}`);
    }
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.pairs)) {
      return parsed.pairs.map(
        (pair: { left: string; right: string }) => `${pair.left} &rarr; ${pair.right}`
      );
    }
    return [String(options)];
  } catch {
    return [options];
  }
}

function parseCorrectAnswer(correctAnswer: string | null | undefined): string {
  if (!correctAnswer) return 'N/A';
  try {
    const parsed = JSON.parse(correctAnswer);
    if (Array.isArray(parsed)) return parsed.join(', ');
    if (typeof parsed === 'object' && parsed !== null) return JSON.stringify(parsed);
    return String(parsed);
  } catch {
    return correctAnswer;
  }
}

function getGrade(score: number, total: number): string {
  const pct = (score / total) * 100;
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function sanitizeFilename(name: string): string {
  return (name || 'export')
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .replace(/\s+/g, '_')
    .toLowerCase()
    .substring(0, 60);
}

// ─── Questions PDF ───────────────────────────────────────────────────────────

export function exportQuestionsPdf(exam: PdfExamInfo, questions: PdfQuestion[]): void {
  const metaParts: string[] = [];
  if (exam.subject) metaParts.push(`<strong>Subject:</strong> ${escapeHtml(exam.subject)}`);
  if (exam.class) metaParts.push(`<strong>Class:</strong> ${escapeHtml(exam.class)}`);
  if (exam.type) metaParts.push(`<strong>Type:</strong> ${escapeHtml(exam.type)}`);
  if (exam.totalMarks) metaParts.push(`<strong>Total Marks:</strong> ${exam.totalMarks}`);
  if (exam.passingMarks) metaParts.push(`<strong>Passing Marks:</strong> ${exam.passingMarks}`);
  if (exam.duration) metaParts.push(`<strong>Duration:</strong> ${exam.duration} min`);
  metaParts.push(`<strong>Questions:</strong> ${questions.length}`);

  let questionsHtml = '';
  questions.forEach((q, i) => {
    const options = parseOptions(q.options);
    const optionsBlock =
      options.length > 0
        ? `<div style="margin-left:1.25rem;margin-top:0.3rem">${options.map((o) => `<div style="margin:0.15rem 0">${escapeHtml(o)}</div>`).join('')}</div>`
        : '';

    const explanationBlock = q.explanation
      ? `<div style="margin-left:1.25rem;margin-top:0.25rem;color:#666;font-style:italic"><strong>Explanation:</strong> ${escapeHtml(q.explanation)}</div>`
      : '';

    questionsHtml += `
      <div style="margin-bottom:1rem;${i < questions.length - 1 ? 'padding-bottom:0.75rem;border-bottom:1px solid #e0e0e0;' : ''}">
        <div style="display:flex;align-items:baseline;gap:0.5rem;flex-wrap:wrap">
          <span style="font-weight:700;color:#1B5E20;font-size:1rem">Question ${i + 1}</span>
          <span style="font-size:0.75rem;color:#888;font-weight:600">[${formatQuestionType(q.type)}]</span>
          <span style="font-size:0.75rem;color:#888;font-style:italic">(${q.marks} mark${q.marks !== 1 ? 's' : ''})</span>
        </div>
        <div style="margin-top:0.3rem;font-size:0.9rem">${escapeHtml(q.questionText)}</div>
        ${optionsBlock}
        <div style="margin-left:1.25rem;margin-top:0.3rem">
          <strong style="color:#2E7D32">Answer:</strong>
          <span style="color:#2E7D32">${escapeHtml(parseCorrectAnswer(q.correctAnswer))}</span>
        </div>
        ${explanationBlock}
      </div>
    `;
  });

  const html = buildHtmlPage(
    escapeHtml(exam.name || 'Exam'),
    `
      <div style="text-align:center;margin-bottom:0.25rem">
        <h1 style="color:#1B5E20;margin:0 0 0.5rem 0;font-size:1.5rem">${escapeHtml(exam.name || 'Exam')}</h1>
        <p style="color:#555;font-size:0.8rem">${metaParts.join(' &nbsp;|&nbsp; ')}</p>
      </div>
      ${exam.instructions ? `<div style="margin-bottom:1rem;padding:0.75rem;background:#f5f5f5;border-radius:6px;font-size:0.85rem"><strong>Instructions:</strong> ${escapeHtml(exam.instructions)}</div>` : ''}
      <hr style="border:none;border-top:2px solid #1B5E20;margin-bottom:1rem" />
      ${questionsHtml}
    `
  );

  openPrintWindow(html, `${sanitizeFilename(exam.name)}_questions.pdf`);
}

// ─── Results PDF ─────────────────────────────────────────────────────────────

export function exportResultsPdf(exam: PdfExamInfo, scores: PdfScoreEntry[]): void {
  const totalMarks = exam.totalMarks || 100;
  const passingMarks = exam.passingMarks || 50;

  const scoreValues = scores.map((s) => s.score);
  const avg = scoreValues.length > 0 ? Math.round((scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length) * 100) / 100 : 0;
  const highest = scoreValues.length > 0 ? Math.max(...scoreValues) : 0;
  const lowest = scoreValues.length > 0 ? Math.min(...scoreValues) : 0;
  const passed = scoreValues.filter((s) => s >= passingMarks).length;
  const passRate = scoreValues.length > 0 ? Math.round((passed / scoreValues.length) * 100) : 0;

  let rowsHtml = '';
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  sorted.forEach((entry, i) => {
    const name = entry.studentName || 'Unknown';
    const adm = entry.admissionNo || 'N/A';
    const grade = entry.grade || getGrade(entry.score, totalMarks);
    const isPassed = entry.score >= passingMarks;
    const statusColor = isPassed ? '#2E7D32' : '#C62828';
    const bgColor = i % 2 === 0 ? '#fff' : '#f9f9f9';
    rowsHtml += `
      <tr style="background:${bgColor}">
        <td style="padding:0.35rem 0.5rem;text-align:center;border:1px solid #ddd">${i + 1}</td>
        <td style="padding:0.35rem 0.5rem;border:1px solid #ddd">${escapeHtml(name)}</td>
        <td style="padding:0.35rem 0.5rem;color:#666;border:1px solid #ddd">${escapeHtml(adm)}</td>
        <td style="padding:0.35rem 0.5rem;text-align:center;border:1px solid #ddd">${entry.score} / ${totalMarks}</td>
        <td style="padding:0.35rem 0.5rem;text-align:center;font-weight:700;color:${statusColor};border:1px solid #ddd">${grade}</td>
        <td style="padding:0.35rem 0.5rem;text-align:center;font-weight:700;color:${statusColor};border:1px solid #ddd">${isPassed ? 'Passed' : 'Failed'}</td>
      </tr>
    `;
  });

  const html = buildHtmlPage(
    `Results - ${exam.name || 'Exam'}`,
    `
      <div style="text-align:center;margin-bottom:0.25rem">
        <h1 style="color:#1B5E20;margin:0 0 0.25rem 0;font-size:1.5rem">Exam Results Summary</h1>
        <h2 style="margin:0 0 0.5rem 0;font-size:1.1rem">${escapeHtml(exam.name || 'Exam')}</h2>
        <p style="color:#888;font-size:0.8rem">Generated on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>
      <hr style="border:none;border-top:2px solid #1B5E20;margin:1rem 0" />

      <h3 style="color:#1B5E20;margin-bottom:0.5rem">Statistics</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem;max-width:500px">
        <tr><td style="padding:0.35rem 0.5rem;background:#E8F5E9;font-weight:700;border:1px solid #ddd;width:50%">Average Score</td><td style="padding:0.35rem 0.5rem;border:1px solid #ddd">${avg} / ${totalMarks}</td></tr>
        <tr><td style="padding:0.35rem 0.5rem;background:#E8F5E9;font-weight:700;border:1px solid #ddd">Highest Score</td><td style="padding:0.35rem 0.5rem;border:1px solid #ddd">${highest} / ${totalMarks}</td></tr>
        <tr><td style="padding:0.35rem 0.5rem;background:#E8F5E9;font-weight:700;border:1px solid #ddd">Lowest Score</td><td style="padding:0.35rem 0.5rem;border:1px solid #ddd">${lowest} / ${totalMarks}</td></tr>
        <tr><td style="padding:0.35rem 0.5rem;background:#E8F5E9;font-weight:700;border:1px solid #ddd">Pass Rate</td><td style="padding:0.35rem 0.5rem;border:1px solid #ddd">${passRate}%</td></tr>
        <tr><td style="padding:0.35rem 0.5rem;background:#E8F5E9;font-weight:700;border:1px solid #ddd">Total Students</td><td style="padding:0.35rem 0.5rem;border:1px solid #ddd">${scores.length}</td></tr>
        <tr><td style="padding:0.35rem 0.5rem;background:#E8F5E9;font-weight:700;border:1px solid #ddd">Passed / Failed</td><td style="padding:0.35rem 0.5rem;border:1px solid #ddd">${passed} / ${scores.length - passed}</td></tr>
      </table>

      <h3 style="color:#1B5E20;margin-bottom:0.5rem">Individual Results</h3>
      <table style="width:100%;border-collapse:collapse;font-size:0.85rem">
        <thead>
          <tr style="background:#1B5E20;color:#fff">
            <th style="padding:0.4rem 0.5rem;text-align:center;border:1px solid #ddd;width:5%">#</th>
            <th style="padding:0.4rem 0.5rem;text-align:left;border:1px solid #ddd">Student Name</th>
            <th style="padding:0.4rem 0.5rem;text-align:left;border:1px solid #ddd;width:18%">Admission No</th>
            <th style="padding:0.4rem 0.5rem;text-align:center;border:1px solid #ddd;width:15%">Score</th>
            <th style="padding:0.4rem 0.5rem;text-align:center;border:1px solid #ddd;width:10%">Grade</th>
            <th style="padding:0.4rem 0.5rem;text-align:center;border:1px solid #ddd;width:12%">Status</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `
  );

  openPrintWindow(html, `${sanitizeFilename(exam.name)}_results.pdf`);
}

// ─── Core: Build HTML page & open print window ───────────────────────────────

function buildHtmlPage(title: string, bodyContent: string): string {
  const watermarkHtml = `
    <div style="position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;overflow:hidden;">
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);opacity:0.04;font-size:4rem;font-weight:900;color:#1B5E20;white-space:nowrap;letter-spacing:0.5rem;">SKOOLAR</div>
    </div>
    <div style="text-align:center;padding:0.5rem 0;border-top:1px solid #e0e0e0;margin-top:2rem;">
      <p style="font-size:8pt;color:#bbb;font-style:italic;">Powered by Skoolar || Odebunmi Tawwāb</p>
    </div>
  `;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      padding: 1.5rem;
      line-height: 1.5;
      color: #333;
      font-size: 14px;
    }
    @media print {
      body { padding: 0; }
      @page { margin: 1.5rem; }
    }
  </style>
</head>
<body>${bodyContent}${watermarkHtml}</body>
</html>`;
}

function openPrintWindow(html: string, suggestedFilename: string): void {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow popups to export as PDF.');
    return;
  }

  win.document.write(html);
  win.document.close();

  // Wait for content to render, then trigger print
  win.onload = () => {
    setTimeout(() => {
      win.print();
    }, 300);
  };
}
