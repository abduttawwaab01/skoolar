export function exportEntranceExamResultPdf(
  attempt: {
    applicantName: string;
    applicantEmail: string | null;
    applicantPhone: string | null;
    applicantAddress: string | null;
    registrationStatus: string;
    finalScore: number | null;
    totalMarks: number;
    passingMarks: number;
    aiSuggestions: string | null;
    answers: string | null;
    status: string;
    tabSwitchCount: number;
    timeTakenSeconds: number | null;
    submittedAt: string | null;
  },
  exam: {
    title: string;
    description: string | null;
    school: { name: string; logo: string | null; address?: string | null };
  },
  questions: Array<{
    id: string;
    questionText: string;
    type: string;
    marks: number;
    correctAnswer: string | string[] | null;
    explanation: string;
  }>,
) {
  const pct = attempt.finalScore !== null && attempt.totalMarks > 0
    ? Math.round((attempt.finalScore / attempt.totalMarks) * 100) : 0;
  const passed = attempt.finalScore !== null && attempt.finalScore >= attempt.passingMarks;

  let parsedAnswers: Record<string, any> = {};
  try { parsedAnswers = attempt.answers ? JSON.parse(attempt.answers) : {}; } catch {}

  const admissionLabel: Record<string, string> = {
    pending_review: 'Pending Review',
    admitted: 'Admitted',
    rejected: 'Not Admitted',
    deferred: 'Deferred',
    registered: 'Registered',
  };
  const admissionColor: Record<string, string> = {
    pending_review: '#f59e0b',
    admitted: '#10b981',
    rejected: '#ef4444',
    deferred: '#6366f1',
    registered: '#3b82f6',
  };

  const questionRows = questions.map((q, i) => {
    const studentAnswer = parsedAnswers[q.id] ?? parsedAnswers[String(i)] ?? parsedAnswers[i] ?? null;
    const isCorrect = q.correctAnswer ? (
      q.type === 'MCQ' || q.type === 'TRUE_FALSE'
        ? String(studentAnswer).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase()
        : q.type === 'MULTI_SELECT'
        ? (() => {
            try {
              const correctArr = typeof q.correctAnswer === 'string' ? JSON.parse(q.correctAnswer) : q.correctAnswer;
              const studentArr = Array.isArray(studentAnswer) ? studentAnswer : [studentAnswer];
              return Array.isArray(correctArr) && studentArr.length === correctArr.length &&
                studentArr.map((a: any) => String(a).trim().toLowerCase()).sort().join(',') ===
                correctArr.map((a: any) => String(a).trim().toLowerCase()).sort().join(',');
            } catch { return false; }
          })()
        : String(studentAnswer).trim().toLowerCase().includes(String(q.correctAnswer).trim().toLowerCase()) ||
          String(q.correctAnswer).trim().toLowerCase().includes(String(studentAnswer).trim().toLowerCase())
    ) : null;
    const displayAnswer = Array.isArray(studentAnswer) ? studentAnswer.join(', ') : studentAnswer || '-';
    const displayCorrect = Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : q.correctAnswer || '-';

    return `
      <tr>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;font-size:12px;text-align:center;background:${isCorrect === true ? '#ecfdf5' : isCorrect === false ? '#fef2f2' : '#f9fafb'}">
          ${i + 1}
        </td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;font-size:12px">
          <strong>${q.questionText}</strong>
          <br><span style="font-size:10px;color:#6b7280">${q.type} · ${q.marks} mark${q.marks !== 1 ? 's' : ''}</span>
        </td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;font-size:12px;text-align:center">${displayAnswer}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;font-size:12px;text-align:center">${isCorrect !== null ? displayCorrect : '-'}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;font-size:12px;text-align:center">
          ${isCorrect === true ? '✅' : isCorrect === false ? '❌' : '—'}
        </td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;font-size:12px;text-align:center">${q.marks}</td>
      </tr>
    `;
  }).join('');

  const correctCount = questions.filter((q, i) => {
    const studentAnswer = parsedAnswers[q.id] ?? parsedAnswers[String(i)] ?? parsedAnswers[i] ?? null;
    return q.correctAnswer && (
      q.type === 'MCQ' || q.type === 'TRUE_FALSE'
        ? String(studentAnswer).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase()
        : q.type === 'MULTI_SELECT'
        ? (() => {
            try {
              const correctArr = typeof q.correctAnswer === 'string' ? JSON.parse(q.correctAnswer) : q.correctAnswer;
              const studentArr = Array.isArray(studentAnswer) ? studentAnswer : [studentAnswer];
              return Array.isArray(correctArr) && studentArr.length === correctArr.length &&
                studentArr.map((a: any) => String(a).trim().toLowerCase()).sort().join(',') ===
                correctArr.map((a: any) => String(a).trim().toLowerCase()).sort().join(',');
            } catch { return false; }
          })()
        : String(studentAnswer).trim().toLowerCase().includes(String(q.correctAnswer).trim().toLowerCase()) ||
          String(q.correctAnswer).trim().toLowerCase().includes(String(studentAnswer).trim().toLowerCase())
    );
  }).length;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${exam.title} - Result</title>
  <style>
    @page { margin: 15mm; size: A4; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; padding: 0; }
    .header { display: flex; align-items: center; gap: 16px; padding-bottom: 20px; border-bottom: 3px solid #10b981; margin-bottom: 24px; }
    .header .logo { width: 60px; height: 60px; border-radius: 12px; object-fit: cover; }
    .header .info h1 { font-size: 20px; color: #065f46; margin-bottom: 2px; }
    .header .info p { font-size: 12px; color: #6b7280; }
    h2 { font-size: 16px; color: #1e293b; margin-bottom: 12px; }
    h3 { font-size: 14px; color: #374151; margin-bottom: 8px; }
    .section { margin-bottom: 24px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; background: #f9fafb; padding: 16px; border-radius: 8px; font-size: 13px; }
    .info-grid .label { color: #6b7280; }
    .info-grid .value { font-weight: 600; color: #1e293b; }
    .score-card { background: linear-gradient(135deg, #ecfdf5, #d1fae5); padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 20px; }
    .score-card .score { font-size: 36px; font-weight: 800; color: #065f46; }
    .score-card .score span { font-size: 18px; font-weight: 400; color: #6b7280; }
    .score-card .pct { font-size: 16px; color: #047857; margin-top: 4px; }
    .score-card .badge { display: inline-block; margin-top: 8px; padding: 4px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .badge-pass { background: #10b981; color: #fff; }
    .badge-fail { background: #ef4444; color: #fff; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #065f46; color: #fff; font-size: 11px; padding: 8px 10px; text-align: left; }
    td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
    .admission-status { padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 20px; }
    .admission-status h3 { font-size: 14px; margin-bottom: 8px; }
    .admission-status .status-badge { display: inline-block; padding: 8px 24px; border-radius: 24px; font-size: 18px; font-weight: 700; color: #fff; }
    .ai-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px; font-size: 12px; color: #1e40af; white-space: pre-wrap; }
    .footer { text-align: center; font-size: 10px; color: #9ca3af; margin-top: 30px; padding-top: 12px; border-top: 1px solid #e5e7eb; }
    .stats-row { display: flex; gap: 12px; margin-bottom: 16px; }
    .stat-box { flex: 1; background: #f9fafb; padding: 12px; border-radius: 8px; text-align: center; }
    .stat-box .stat-value { font-size: 18px; font-weight: 700; color: #065f46; }
    .stat-box .stat-label { font-size: 10px; color: #6b7280; margin-top: 2px; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .admission-status { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    ${exam.school.logo ? `<img src="${exam.school.logo}" alt="Logo" class="logo" />` : `<div style="width:60px;height:60px;border-radius:12px;background:#10b581;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:24px">${exam.school.name.charAt(0)}</div>`}
    <div class="info">
      <h1>${exam.school.name}</h1>
      <p>${exam.title}${exam.description ? ` — ${exam.description}` : ''}</p>
    </div>
  </div>

  <div class="section">
    <h2>Candidate Information</h2>
    <div class="info-grid">
      <div><span class="label">Name:</span> <span class="value">${attempt.applicantName}</span></div>
      <div><span class="label">Email:</span> <span class="value">${attempt.applicantEmail || '-'}</span></div>
      <div><span class="label">Phone:</span> <span class="value">${attempt.applicantPhone || '-'}</span></div>
      <div><span class="label">Submitted:</span> <span class="value">${attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleDateString() : '-'}</span></div>
    </div>
  </div>

  <div class="section">
    <h2>Performance Summary</h2>
    <div class="score-card">
      <div class="score">${attempt.finalScore ?? '-'} <span>/ ${attempt.totalMarks}</span></div>
      <div class="pct">${pct}%</div>
      <div class="badge ${passed ? 'badge-pass' : 'badge-fail'}">${passed ? 'PASSED' : 'FAILED'}</div>
    </div>
    <div class="stats-row">
      <div class="stat-box"><div class="stat-value">${correctCount} / ${questions.length}</div><div class="stat-label">Correct Answers</div></div>
      <div class="stat-box"><div class="stat-value">${questions.length - correctCount} / ${questions.length}</div><div class="stat-label">Wrong Answers</div></div>
      <div class="stat-box"><div class="stat-value">${attempt.tabSwitchCount || 0}</div><div class="stat-label">Tab Switches</div></div>
      <div class="stat-box"><div class="stat-value">${attempt.timeTakenSeconds ? Math.floor(attempt.timeTakenSeconds / 60) + 'm ' + (attempt.timeTakenSeconds % 60) + 's' : '-'}</div><div class="stat-label">Time Taken</div></div>
    </div>
  </div>

  <div class="section">
    <h2>Question-by-Question Analysis</h2>
    <table>
      <thead>
        <tr>
          <th style="text-align:center;width:30px">#</th>
          <th>Question</th>
          <th style="text-align:center">Your Answer</th>
          <th style="text-align:center">Correct Answer</th>
          <th style="text-align:center;width:40px">Result</th>
          <th style="text-align:center;width:50px">Marks</th>
        </tr>
      </thead>
      <tbody>
        ${questionRows}
      </tbody>
    </table>
  </div>

  ${attempt.aiSuggestions ? `
  <div class="section">
    <h2>AI & System Evaluation</h2>
    <div class="ai-box">${attempt.aiSuggestions}</div>
  </div>
  ` : ''}

  <div class="section">
    <h2>Admission Status</h2>
    <div class="admission-status" style="background:${attempt.registrationStatus === 'admitted' ? '#ecfdf5' : attempt.registrationStatus === 'rejected' ? '#fef2f2' : attempt.registrationStatus === 'deferred' ? '#eef2ff' : '#fffbeb'};border:2px solid ${admissionColor[attempt.registrationStatus] || '#d1d5db'}">
      <h3 style="color:${admissionColor[attempt.registrationStatus] || '#6b7280'}">${admissionLabel[attempt.registrationStatus] || attempt.registrationStatus}</h3>
      <div class="status-badge" style="background:${admissionColor[attempt.registrationStatus] || '#6b7280'}">
        ${attempt.registrationStatus === 'admitted' ? 'ADMITTED ✓' : attempt.registrationStatus === 'rejected' ? 'NOT ADMITTED' : attempt.registrationStatus === 'deferred' ? 'DEFERRED' : 'PENDING REVIEW'}
      </div>
      ${attempt.registrationStatus === 'admitted' ? '<p style="margin-top:12px;font-size:13px;color:#065f46">Congratulations! The candidate has been granted admission.</p>' : ''}
      ${attempt.registrationStatus === 'rejected' ? '<p style="margin-top:12px;font-size:13px;color:#991b1b">The application has not been approved at this time.</p>' : ''}
      ${attempt.registrationStatus === 'deferred' ? '<p style="margin-top:12px;font-size:13px;color:#4338ca">An alternative class placement has been offered.</p>' : ''}
      ${attempt.registrationStatus === 'pending_review' ? '<p style="margin-top:12px;font-size:13px;color:#92400e">The application is under review by the school administration.</p>' : ''}
    </div>
  </div>

  <div class="footer">
    Generated by Skoolar — ${new Date().toLocaleDateString()} &bull; This document is electronically generated.
  </div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  }
}
