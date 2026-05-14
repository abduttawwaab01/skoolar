/**
 * Client-side PDF Export Helper for Skoolar
 *
 * Uses the browser's print API to generate a PDF from formatted HTML.
 * Call `exportQuestionsPdf(exam, questions)` or `exportResultsPdf(exam, scores)` from client code.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PdfSchoolInfo {
  name?: string;
  logo?: string | null;
}

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

export function exportQuestionsPdf(exam: PdfExamInfo, questions: PdfQuestion[], school?: PdfSchoolInfo): void {
  const metaParts: string[] = [];
  if (exam.subject) metaParts.push(`<strong>Subject:</strong> ${escapeHtml(exam.subject)}`);
  if (exam.class) metaParts.push(`<strong>Class:</strong> ${escapeHtml(exam.class)}`);
  if (exam.type) metaParts.push(`<strong>Type:</strong> ${escapeHtml(exam.type)}`);
  if (exam.totalMarks) metaParts.push(`<strong>Total Marks:</strong> ${exam.totalMarks}`);
  if (exam.passingMarks) metaParts.push(`<strong>Passing Marks:</strong> ${exam.passingMarks}`);
  if (exam.duration) metaParts.push(`<strong>Duration:</strong> ${exam.duration} min`);
  metaParts.push(`<strong>Questions:</strong> ${questions.length}`);

  const schoolName = school?.name || 'Skoolar';
  const schoolLogo = school?.logo;

  let questionsHtml = '';
  questions.forEach((q, i) => {
    const typeLabel = formatQuestionType(q.type);
    const typeColor = '#059669';
    const options = parseOptions(q.options);
    const optionsBlock =
      options.length > 0
        ? `<div style="margin:0.5rem 0 0 1.5rem;border-left:3px solid #e0e0e0;padding-left:0.75rem">${options.map((o) => `<div style="padding:0.15rem 0;font-size:0.9rem;color:#444">${escapeHtml(o)}</div>`).join('')}</div>`
        : '';

    const explanationBlock = q.explanation
      ? `<div style="margin:0.4rem 0 0 1.5rem;padding:0.4rem 0.6rem;background:#f9fafb;border-radius:4px;font-size:0.8rem;color:#666;font-style:italic"><strong>Explanation:</strong> ${escapeHtml(q.explanation)}</div>`
      : '';

    questionsHtml += `
      <div style="margin-bottom:1rem;border:1px solid #e5e7eb;border-radius:8px;padding:0.75rem 1rem;border-left:4px solid ${typeColor}">
        <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.35rem">
          <span style="font-weight:700;color:#059669;font-size:0.95rem">Q${i + 1}.</span>
          <span style="font-size:0.7rem;background:#e0f2f1;color:#059669;padding:0.1rem 0.5rem;border-radius:4px;font-weight:600">${typeLabel}</span>
          <span style="font-size:0.7rem;background:#f3f4f6;color:#6b7280;padding:0.1rem 0.5rem;border-radius:4px">${q.marks} mark${q.marks !== 1 ? 's' : ''}</span>
        </div>
        <div style="font-size:0.9rem;line-height:1.6;color:#333">${escapeHtml(q.questionText)}</div>
        ${optionsBlock}
        <div style="margin-top:0.4rem;padding:0.3rem 0.6rem;background:#f0fdf4;border-radius:4px;display:inline-block">
          <strong style="color:#059669;font-size:0.8rem">Answer:</strong>
          <span style="color:#059669;font-size:0.8rem;font-weight:600">${escapeHtml(parseCorrectAnswer(q.correctAnswer))}</span>
        </div>
        ${explanationBlock}
      </div>
    `;
  });

  const instructionsBlock = exam.instructions
    ? `<div style="margin-bottom:1rem;padding:0.75rem 1rem;background:#f9fafb;border-left:4px solid #059669;border-radius:6px;font-size:0.85rem"><strong style="color:#059669">Instructions:</strong><br/>${escapeHtml(exam.instructions)}</div>`
    : '';

  const headerBlock = schoolLogo
    ? `<div style="display:flex;align-items:center;justify-content:center;gap:0.75rem;margin-bottom:0.25rem">
        <img src="${escapeHtml(schoolLogo)}" style="height:40px;width:auto" alt="Logo" />
        <h1 style="color:#059669;margin:0;font-size:1.3rem">${escapeHtml(schoolName)}</h1>
       </div>`
    : `<h1 style="color:#059669;margin:0 0 0.25rem 0;font-size:1.3rem;text-align:center">${escapeHtml(schoolName)}</h1>`;

  const html = buildHtmlPage(
    escapeHtml(exam.name || 'Exam'),
    `
      ${headerBlock}
      <div style="text-align:center;margin-bottom:0.5rem">
        <h2 style="color:#1B5E20;margin:0 0 0.5rem 0;font-size:1.2rem">${escapeHtml(exam.name || 'Exam')} &mdash; Questions</h2>
        <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:0.3rem 1rem;font-size:0.8rem;color:#555;background:#f9fafb;padding:0.5rem 1rem;border-radius:8px;max-width:700px;margin:0 auto">${metaParts.join(' &middot; ')}</div>
      </div>
      ${instructionsBlock}
      <div style="height:2px;background:linear-gradient(90deg,#059669,#34d399);margin-bottom:1rem;border-radius:2px"></div>
      ${questionsHtml}
    `
  );

  openPrintWindow(html, `${sanitizeFilename(exam.name)}_questions.pdf`);
}

// ─── Results PDF ─────────────────────────────────────────────────────────────

export function exportResultsPdf(exam: PdfExamInfo, scores: PdfScoreEntry[], school?: PdfSchoolInfo): void {
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
    const statusColor = isPassed ? '#059669' : '#dc2626';
    const bgColor = i % 2 === 0 ? '#fff' : '#f9fafb';
    rowsHtml += `
      <tr style="background:${bgColor}">
        <td style="padding:0.4rem 0.5rem;text-align:center;border:1px solid #e5e7eb;color:#6b7280;font-size:0.8rem">${i + 1}</td>
        <td style="padding:0.4rem 0.5rem;border:1px solid #e5e7eb;font-size:0.85rem">${escapeHtml(name)}</td>
        <td style="padding:0.4rem 0.5rem;color:#6b7280;border:1px solid #e5e7eb;font-size:0.8rem">${escapeHtml(adm)}</td>
        <td style="padding:0.4rem 0.5rem;text-align:center;border:1px solid #e5e7eb;font-size:0.85rem;font-weight:600">${entry.score} / ${totalMarks}</td>
        <td style="padding:0.4rem 0.5rem;text-align:center;border:1px solid #e5e7eb;font-weight:700;color:${statusColor};font-size:0.85rem">${grade}</td>
        <td style="padding:0.4rem 0.5rem;text-align:center;border:1px solid #e5e7eb;font-weight:700;color:${statusColor};font-size:0.8rem">${isPassed ? 'Passed' : 'Failed'}</td>
      </tr>
    `;
  });

  const schoolName = school?.name || 'Skoolar';
  const schoolLogo = school?.logo;

  const headerBlock = schoolLogo
    ? `<div style="display:flex;align-items:center;justify-content:center;gap:0.75rem;margin-bottom:0.25rem">
        <img src="${escapeHtml(schoolLogo)}" style="height:40px;width:auto" alt="Logo" />
        <h1 style="color:#059669;margin:0;font-size:1.3rem">${escapeHtml(schoolName)}</h1>
       </div>`
    : `<h1 style="color:#059669;margin:0 0 0.25rem 0;font-size:1.3rem;text-align:center">${escapeHtml(schoolName)}</h1>`;

  const html = buildHtmlPage(
    `Results - ${exam.name || 'Exam'}`,
    `
      ${headerBlock}
      <div style="text-align:center;margin-bottom:0.5rem">
        <h2 style="color:#1B5E20;margin:0 0 0.25rem 0;font-size:1.2rem">Exam Results Summary</h2>
        <h3 style="margin:0 0 0.25rem 0;font-size:1rem;color:#555;font-weight:400">${escapeHtml(exam.name || 'Exam')}</h3>
        <p style="color:#9ca3af;font-size:0.75rem">Generated on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>
      <div style="height:2px;background:linear-gradient(90deg,#059669,#34d399);margin-bottom:1rem;border-radius:2px"></div>

      <h3 style="color:#059669;margin-bottom:0.75rem;font-size:1rem;border-bottom:2px solid #e5e7eb;padding-bottom:0.3rem">Statistics Overview</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:1.25rem;font-size:0.85rem">
        <tr>
          <td style="padding:0.5rem;background:#f0fdf4;font-weight:600;border:1px solid #e5e7eb;width:33%"><div style="color:#059669;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.5px">Average</div><div style="font-size:1.1rem;font-weight:700;color:#333">${avg} / ${totalMarks}</div></td>
          <td style="padding:0.5rem;background:#f0fdf4;font-weight:600;border:1px solid #e5e7eb;width:33%"><div style="color:#059669;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.5px">Highest</div><div style="font-size:1.1rem;font-weight:700;color:#333">${highest} / ${totalMarks}</div></td>
          <td style="padding:0.5rem;background:#f0fdf4;font-weight:600;border:1px solid #e5e7eb;width:33%"><div style="color:#059669;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.5px">Lowest</div><div style="font-size:1.1rem;font-weight:700;color:#333">${lowest} / ${totalMarks}</div></td>
        </tr>
        <tr>
          <td style="padding:0.5rem;background:#f0fdf4;font-weight:600;border:1px solid #e5e7eb"><div style="color:#059669;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.5px">Pass Rate</div><div style="font-size:1.1rem;font-weight:700;color:#333">${passRate}%</div></td>
          <td style="padding:0.5rem;background:#f0fdf4;font-weight:600;border:1px solid #e5e7eb"><div style="color:#059669;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.5px">Total Students</div><div style="font-size:1.1rem;font-weight:700;color:#333">${scores.length}</div></td>
          <td style="padding:0.5rem;background:#f0fdf4;font-weight:600;border:1px solid #e5e7eb"><div style="color:#059669;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.5px">Passed / Failed</div><div style="font-size:1.1rem;font-weight:700;color:#333">${passed} / ${scores.length - passed}</div></td>
        </tr>
      </table>

      <h3 style="color:#059669;margin-bottom:0.5rem;font-size:1rem;border-bottom:2px solid #e5e7eb;padding-bottom:0.3rem">Individual Results</h3>
      <table style="width:100%;border-collapse:collapse;font-size:0.85rem">
        <thead>
          <tr style="background:#059669;color:#fff">
            <th style="padding:0.45rem 0.5rem;text-align:center;border:1px solid #047857;width:5%">#</th>
            <th style="padding:0.45rem 0.5rem;text-align:left;border:1px solid #047857">Student Name</th>
            <th style="padding:0.45rem 0.5rem;text-align:left;border:1px solid #047857;width:18%">Admission No</th>
            <th style="padding:0.45rem 0.5rem;text-align:center;border:1px solid #047857;width:15%">Score</th>
            <th style="padding:0.45rem 0.5rem;text-align:center;border:1px solid #047857;width:10%">Grade</th>
            <th style="padding:0.45rem 0.5rem;text-align:center;border:1px solid #047857;width:12%">Status</th>
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
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);opacity:0.035;font-size:4.5rem;font-weight:900;color:#059669;white-space:nowrap;letter-spacing:0.3rem;">Skoolar</div>
    </div>
    <div style="text-align:center;padding:0.4rem 0;border-top:1px solid #e5e7eb;margin-top:1.5rem;">
      <p style="font-size:7pt;color:#bbb;font-style:italic;">Skoolar - Odebunmi Tawwāb</p>
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
      line-height: 1.6;
      color: #333;
      font-size: 14px;
    }
    @media print {
      body { padding: 0.5in; }
      @page { margin: 0.5in; }
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

  win.onload = () => {
    setTimeout(() => {
      win.print();
    }, 300);
  };
}
