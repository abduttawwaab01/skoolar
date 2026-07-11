import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
    subjectId?: string | null;
    topic?: string | null;
  }>,
  subjects?: { id: string; name: string }[],
) {
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 15;
  let y = m;

  const addPage = () => { doc.addPage(); y = m; };
  const checkPage = (needed: number) => { if (y + needed > ph - m) addPage(); };
  const section = (title: string) => { checkPage(12); doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(5, 150, 105); doc.text(title, m, y); y += 7; doc.setDrawColor(5, 150, 105); doc.setLineWidth(0.5); doc.line(m, y, pw - m, y); y += 4; doc.setTextColor(0); };
  const text = (t: string, indent = 0, size = 9) => { doc.setFontSize(size); doc.setFont('helvetica', 'normal'); const lines = doc.splitTextToSize(t, pw - m * 2 - indent); lines.forEach(l => { checkPage(5); doc.text(l, m + indent, y); y += 4.5; }); };
  const boldText = (label: string, value: string, indent = 0) => { checkPage(5); doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.text(label, m + indent, y); const lw = doc.getTextWidth(label); doc.setFont('helvetica', 'normal'); doc.text(value, m + indent + lw + 1, y); y += 5; };

  const pct = attempt.finalScore !== null && attempt.totalMarks > 0 ? Math.round((attempt.finalScore / attempt.totalMarks) * 100) : 0;
  const passed = attempt.finalScore !== null && attempt.finalScore >= attempt.passingMarks;

  let parsedAnswers: Record<string, any> = {};
  try { parsedAnswers = attempt.answers ? JSON.parse(attempt.answers) : {}; } catch {}

  // ── Header ──
  doc.setFontSize(20); doc.setFont('helvetica', 'bold'); doc.setTextColor(5, 150, 105);
  doc.text(exam.school.name, pw / 2, y, { align: 'center' }); y += 8;
  doc.setFontSize(12); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
  doc.text(`${exam.title} — Result Report`, pw / 2, y, { align: 'center' }); y += 6;
  doc.setFontSize(8); doc.text(`Generated on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, pw / 2, y, { align: 'center' }); y += 10;
  doc.setTextColor(0);
  doc.setDrawColor(5, 150, 105); doc.setLineWidth(0.8); doc.line(m, y, pw - m, y); y += 6;

  // ── Candidate Information ──
  section('Candidate Information');
  const infoItems = [
    ['Name:', attempt.applicantName],
    ['Email:', attempt.applicantEmail || '-'],
    ['Phone:', attempt.applicantPhone || '-'],
    ['Address:', attempt.applicantAddress || '-'],
    ['Submitted:', attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleDateString() : '-'],
    ['Status:', attempt.status],
  ];
  infoItems.forEach(([l, v]) => boldText(l + ' ', v, 3));

  // ── Score Card ──
  section('Performance Summary');
  doc.setFillColor(236, 253, 245); doc.roundedRect(m, y, pw - m * 2, 30, 3, 3, 'F');
  doc.setFontSize(22); doc.setFont('helvetica', 'bold'); doc.setTextColor(5, 150, 105);
  doc.text(`${attempt.finalScore ?? '-'} / ${attempt.totalMarks}`, pw / 2, y + 12, { align: 'center' });
  doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(4, 120, 87);
  doc.text(`${pct}% · ${passed ? 'PASSED' : 'FAILED'}`, pw / 2, y + 20, { align: 'center' });
  y += 36;
  doc.setTextColor(0);

  // Stats row
  const correctCount = questions.filter((q, i) => {
    const studentAnswer = parsedAnswers[q.id] ?? parsedAnswers[String(i)] ?? parsedAnswers[i] ?? null;
    if (!q.correctAnswer) return false;
    if (q.type === 'MCQ' || q.type === 'TRUE_FALSE') return String(studentAnswer).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
    if (q.type === 'MULTI_SELECT') {
      try {
        const ca = typeof q.correctAnswer === 'string' ? JSON.parse(q.correctAnswer) : q.correctAnswer;
        const sa = Array.isArray(studentAnswer) ? studentAnswer : [studentAnswer];
        return Array.isArray(ca) && sa.length === ca.length && sa.map((a: any) => String(a).trim().toLowerCase()).sort().join(',') === ca.map((a: any) => String(a).trim().toLowerCase()).sort().join(',');
      } catch { return false; }
    }
    return String(studentAnswer).trim().toLowerCase().includes(String(q.correctAnswer).trim().toLowerCase()) || String(q.correctAnswer).trim().toLowerCase().includes(String(studentAnswer).trim().toLowerCase());
  }).length;

  const stats = [
    ['Correct', `${correctCount}/${questions.length}`],
    ['Wrong', `${questions.length - correctCount}/${questions.length}`],
    ['Tab Switches', String(attempt.tabSwitchCount || 0)],
    ['Time Taken', attempt.timeTakenSeconds ? `${Math.floor(attempt.timeTakenSeconds / 60)}m ${attempt.timeTakenSeconds % 60}s` : '-'],
  ];
  const sw = (pw - m * 2 - 9) / 4;
  stats.forEach(([l, v], i) => {
    const x = m + i * (sw + 3);
    doc.setFillColor(249, 250, 251); doc.roundedRect(x, y, sw, 18, 2, 2, 'F');
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(100); doc.text(l, x + sw / 2, y + 5, { align: 'center' });
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(5, 150, 105); doc.text(v, x + sw / 2, y + 14, { align: 'center' });
  });
  y += 24;
  doc.setTextColor(0);

  // ── Question-by-Question Analysis ──
  section('Question-by-Question Analysis');
  const qHead = ['#', 'Question', 'Your Answer', 'Correct', 'Result', 'Marks'];
  const qBody = questions.map((q, i) => {
    const sa = parsedAnswers[q.id] ?? parsedAnswers[String(i)] ?? parsedAnswers[i] ?? null;
    const isCorrect = (() => {
      if (!q.correctAnswer) return null;
      if (q.type === 'MCQ' || q.type === 'TRUE_FALSE') return String(sa).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
      if (q.type === 'MULTI_SELECT') {
        try {
          const ca = typeof q.correctAnswer === 'string' ? JSON.parse(q.correctAnswer) : q.correctAnswer;
          const sa2 = Array.isArray(sa) ? sa : [sa];
          return Array.isArray(ca) && sa2.length === ca.length && sa2.map((a: any) => String(a).trim().toLowerCase()).sort().join(',') === ca.map((a: any) => String(a).trim().toLowerCase()).sort().join(',');
        } catch { return false; }
      }
      return String(sa).trim().toLowerCase().includes(String(q.correctAnswer).trim().toLowerCase()) || String(q.correctAnswer).trim().toLowerCase().includes(String(sa).trim().toLowerCase());
    })();
    const da = Array.isArray(sa) ? sa.join(', ') : (sa ?? '-');
    const dc = Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : (q.correctAnswer || '-');
    return [String(i + 1), q.questionText.substring(0, 60), da, dc, isCorrect === true ? '✓' : isCorrect === false ? '✗' : '—', String(q.marks)];
  });
  autoTable(doc, {
    head: [qHead], body: qBody, startY: y, margin: { left: m, right: m },
    styles: { fontSize: 7, cellPadding: 1.5 }, headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 60 }, 2: { cellWidth: 35 }, 3: { cellWidth: 35 }, 4: { cellWidth: 12, halign: 'center' }, 5: { cellWidth: 12, halign: 'center' } },
    didDrawPage: (data: any) => { y = data.cursor.y + 6; },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Subject Breakdown ──
  const subMap = new Map<string, { name: string; total: number; earned: number; topics: Map<string, { total: number; earned: number }> }>();
  for (const q of questions) {
    const sid = q.subjectId || '__none__';
    if (sid === '__none__') continue;
    if (!subMap.has(sid)) { subMap.set(sid, { name: subjects?.find(s => s.id === sid)?.name || 'Unknown', total: 0, earned: 0, topics: new Map() }); }
    const sb = subMap.get(sid)!;
    sb.total += q.marks;
    const sa = parsedAnswers[q.id] ?? null;
    const isCorrect = q.correctAnswer ? (String(sa).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase() || (q.type === 'SHORT_ANSWER' && String(sa).trim().toLowerCase().includes(String(q.correctAnswer).trim().toLowerCase()))) : false;
    if (isCorrect) sb.earned += q.marks;
    const topic = q.topic?.trim();
    if (topic) {
      if (!sb.topics.has(topic)) sb.topics.set(topic, { total: 0, earned: 0 });
      const t = sb.topics.get(topic)!;
      t.total += q.marks;
      if (isCorrect) t.earned += q.marks;
    }
  }

  if (subMap.size > 0) {
    section('Subject Performance Breakdown');
    subMap.forEach((sb) => {
      checkPage(20);
      const sp = sb.total > 0 ? Math.round((sb.earned / sb.total) * 100) : 0;
      doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text(`${sb.name}: ${sp}% (${sb.earned}/${sb.total} marks)`, m + 3, y); y += 5;
      const barW = pw - m * 2 - 6;
      doc.setFillColor(229, 231, 235); doc.roundedRect(m + 3, y, barW, 4, 2, 2, 'F');
      doc.setFillColor(sp >= 80 ? 16 : sp >= 60 ? 59 : sp >= 40 ? 245 : 239, sp >= 80 ? 185 : sp >= 60 ? 130 : sp >= 40 ? 158 : 68, sp >= 80 ? 129 : sp >= 60 ? 246 : sp >= 40 ? 11 : 68);
      doc.roundedRect(m + 3, y, barW * (sp / 100), 4, 2, 2, 'F');
      y += 8;
      sb.topics.forEach((tb, topic) => {
        const tp = tb.total > 0 ? Math.round((tb.earned / tb.total) * 100) : 0;
        doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
        doc.text(`▪ ${topic}: ${tp}% (${tb.earned}/${tb.total} marks)`, m + 9, y); y += 4.5;
      });
      doc.setTextColor(0);
    });
    y += 3;
  }

  // ── AI & System Evaluation ──
  if (attempt.aiSuggestions) {
    section('AI & System Evaluation');
    doc.setFillColor(239, 246, 255); doc.setDrawColor(191, 219, 254);
    const aiLines = doc.splitTextToSize(attempt.aiSuggestions, pw - m * 2 - 8);
    const aiH = aiLines.length * 4.5 + 10;
    checkPage(aiH + 10);
    doc.roundedRect(m, y, pw - m * 2, aiH, 3, 3, 'FD');
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 64, 175);
    doc.text(aiLines, m + 4, y + 6);
    y += aiH + 6;
    doc.setTextColor(0);
  }

  // ── Admission Status ──
  section('Admission Status');
  const statusColors: Record<string, [number, number, number]> = {
    admitted: [5, 150, 105], rejected: [239, 68, 68], deferred: [99, 102, 241], pending_review: [245, 158, 11], registered: [59, 130, 246],
  };
  const statusLabels: Record<string, string> = {
    admitted: 'ADMITTED ✓', rejected: 'NOT ADMITTED', deferred: 'DEFERRED', pending_review: 'PENDING REVIEW', registered: 'REGISTERED',
  };
  const sc = statusColors[attempt.registrationStatus] || [107, 114, 128];
  const sl = statusLabels[attempt.registrationStatus] || attempt.registrationStatus;
  const statusTexts: Record<string, string> = {
    admitted: 'Congratulations! The candidate has been granted admission.',
    rejected: 'The application has not been approved at this time.',
    deferred: 'An alternative class placement has been offered.',
    pending_review: 'The application is under review by the school administration.',
    registered: 'The candidate has registered for the exam.',
  };
  doc.setFillColor(sc[0], sc[1], sc[2]); doc.roundedRect(m, y, pw - m * 2, 16, 3, 3, 'F');
  doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(255); doc.text(sl, pw / 2, y + 11, { align: 'center' });
  y += 22;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(sc[0], sc[1], sc[2]);
  doc.text(statusTexts[attempt.registrationStatus] || '', pw / 2, y, { align: 'center' });
  y += 10;
  doc.setTextColor(0);

  // ── Footer ──
  doc.setFontSize(7); doc.setTextColor(180);
  doc.text(`Skoolar — ${new Date().toLocaleDateString()} · This document is electronically generated.`, pw / 2, ph - 8, { align: 'center' });

  doc.save(`${attempt.applicantName.replace(/\s+/g, '_')}_${exam.title.replace(/\s+/g, '_')}_Result.pdf`);
}
