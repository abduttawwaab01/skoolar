'use client';

import { jsPDF } from 'jspdf';
import { type QuestionData } from '@/components/features/exam-question-editor';
import { toast } from 'sonner';

export interface ExportExamInfo {
  id: string;
  name: string;
  type: string;
  subject: string;
  class: string;
  totalMarks: number;
  date: string | null;
  duration: number | null;
  instructions?: string;
}

export async function printExam(exam: ExportExamInfo, schoolId: string): Promise<void> {
  try {
    const [examRes, schoolRes] = await Promise.all([
      fetch(`/api/exams/${exam.id}/questions?includeAnswers=true`),
      fetch(`/api/schools/${schoolId}`),
    ]);
    const examJson = await examRes.json();
    const schoolJson = await schoolRes.json();
    const questions: QuestionData[] = (examJson.data || []);
    const school = schoolJson.data || schoolJson;
    if (questions.length === 0) { toast.error('No questions to print'); return; }
    const sortedQ = [...questions].sort((a, b) => (a.order || 0) - (b.order || 0));
    const typeLabel = exam.type.charAt(0).toUpperCase() + exam.type.slice(1);
    const qHtml = sortedQ.map((q, i) => {
      const typeLabelMap: Record<string, string> = { 'MCQ': 'Multiple Choice', 'MULTI_SELECT': 'Multi-Select', 'TRUE_FALSE': 'True/False', 'FILL_BLANK': 'Fill in the Blank', 'SHORT_ANSWER': 'Short Answer', 'ESSAY': 'Essay', 'MATCHING': 'Matching' };
      let optionsHtml = '';
      if (q.type === 'MCQ' || q.type === 'MULTI_SELECT') {
        optionsHtml = '<div style="margin-top:6px">' + (q.options || []).map((opt, oi) =>
          `<div class="q-opt"><span class="q-opt-circle">${String.fromCharCode(65 + oi)}</span>${opt}</div>`
        ).join('') + '</div>';
      } else if (q.type === 'TRUE_FALSE') {
        optionsHtml = '<div style="margin-top:6px"><div class="q-opt"><span class="q-opt-circle" style="border-radius:50%"></span>True</div><div class="q-opt"><span class="q-opt-circle" style="border-radius:50%"></span>False</div></div>';
      } else if (q.type === 'FILL_BLANK') {
        optionsHtml = '<div style="margin-top:6px"><div class="answer-line"></div></div>';
      } else if (q.type === 'SHORT_ANSWER' || q.type === 'ESSAY') {
        optionsHtml = '<div style="margin-top:6px">' + Array.from({ length: q.type === 'ESSAY' ? 6 : 3 }, () => '<div class="answer-line" style="height:26px"></div>').join('') + '</div>';
      }
      const marksLabel = q.marks > 1 ? `${q.marks} marks` : `${q.marks} mark`;
      return `<tr><td style="text-align:center"><span class="q-num">${i + 1}.</span></td><td><div class="q-text">${q.questionText}</div><div class="q-meta">[${typeLabelMap[q.type] || q.type} - ${marksLabel}]</div>${optionsHtml}</td><td style="text-align:center;font-weight:600">${q.marks}</td></tr>`;
    }).join('');
    const win = window.open('', '_blank');
    if (!win) { toast.error('Popup blocked. Please allow popups.'); return; }
    const logoHtml = school.logo ? `<img src="${school.logo}" style="height:50px;width:auto;margin-right:12px" />` : '';
    win.document.write(`<!DOCTYPE html><html><head><title>${exam.name}</title><style>
      @page { size: A4; margin: 15mm 18mm }
      body { font-family: 'Times New Roman', Times, serif; color: #222; padding: 0; margin: 0; line-height: 1.5 }
      table { width: 100%; border-collapse: collapse }
      .header { text-align: center; margin-bottom: 18px; border-bottom: 3px solid #1B5E20; padding-bottom: 12px; background: linear-gradient(to bottom, #f9fff9, #fff) }
      .header h1 { font-size: 20px; margin: 6px 0; text-transform: uppercase; letter-spacing: 1.5px; color: #1B5E20 }
      .header h2 { font-size: 15px; margin: 4px 0; font-weight: 600; color: #333 }
      .header p { font-size: 11px; margin: 2px 0; color: #555 }
      .exam-info { margin-bottom: 14px; font-size: 11px; width: auto }
      .exam-info td { padding: 3px 14px; border: 1px solid #e0e0e0 }
      .exam-info tr:first-child td { background: #f5f9f5; font-weight: 500 }
      .instructions { margin-bottom: 14px; padding: 10px 14px; border-left: 4px solid #1B5E20; background: #f9fff9; font-size: 12px; border-radius: 0 6px 6px 0 }
      .instructions h3 { margin: 0 0 4px 0; font-size: 13px; color: #1B5E20 }
      .footer { margin-top: 30px; padding-top: 10px; border-top: 2px solid #1B5E20; font-size: 10px; color: #888; text-align: center }
      th { background: #1B5E20; color: #fff; font-size: 11px; padding: 8px 6px; text-align: left }
      th:first-child { text-align: center; width: 40px }
      th:last-child { text-align: center; width: 50px }
      td { padding: 8px 6px; border-bottom: 1px solid #e8e8e8; font-size: 12px; vertical-align: top }
      .q-num { font-weight: 700; color: #1B5E20; font-size: 13px }
      .q-text { font-size: 12px; margin-bottom: 6px }
      .q-meta { font-size: 10px; color: #888; font-style: italic; margin-bottom: 6px }
      .q-opt { padding: 3px 0; font-size: 11px; color: #444 }
      .q-opt-circle { display: inline-block; width: 16px; height: 16px; border: 1.5px solid #666; border-radius: 50%; text-align: center; line-height: 16px; margin-right: 6px; font-size: 10px; color: #666 }
      .answer-line { border-bottom: 1px solid #ccc; height: 22px; margin-bottom: 4px; width: 70% }
      .total-row { margin-top: 16px; padding: 8px 12px; background: #f5f9f5; border-top: 2px solid #1B5E20; text-align: right; font-weight: 700; font-size: 12px }
      .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 80px; color: rgba(27, 94, 32, 0.03); font-weight: bold; pointer-events: none; z-index: -1; white-space: nowrap }
      @media print { .no-print { display: none } }
    </style></head><body>
      <div class="watermark">SKOOLAR</div>
      <div class="header">
        <div style="display:flex;align-items:center;justify-content:center;gap:12px">${logoHtml}<div><h1>${school.name || 'School'}</h1>${school.address ? `<p>${school.address}</p>` : ''}${school.motto ? `<p><em>${school.motto}</em></p>` : ''}</div></div>
        <h2>${exam.name}</h2>
        <p>${typeLabel} | ${exam.subject} | ${exam.class}</p>
      </div>
      <table class="exam-info"><tr><td><strong>Date:</strong> ${exam.date ? new Date(exam.date).toLocaleDateString() : '________'}</td><td><strong>Duration:</strong> ${exam.duration ? exam.duration + ' mins' : '________'}</td><td><strong>Total Marks:</strong> ${exam.totalMarks}</td></tr></table>
      ${exam.instructions ? `<div class="instructions"><h3>Instructions</h3><p style="font-size:12px;margin:0">${exam.instructions}</p></div>` : ''}
      <table><thead><tr style="border-bottom:2px solid #333"><th style="width:40px;padding:8px 6px;font-size:12px;text-align:center">No.</th><th style="padding:8px 6px;font-size:12px;text-align:left">Question</th><th style="width:50px;padding:8px 6px;font-size:12px;text-align:center">Marks</th></tr></thead><tbody>${qHtml}</tbody></table>
      <div class="total-row"><strong>Total Marks:</strong> ${sortedQ.reduce((sum, q) => sum + (q.marks || 0), 0)}</div>
      <div class="footer"><p>SKOOLAR • SCHOOL MANAGEMENT</p></div>
      <div class="no-print" style="text-align:center;margin-top:20px"><button onclick="window.print()" style="padding:8px 24px;font-size:14px;cursor:pointer">Print</button> <button onclick="window.close()" style="padding:8px 24px;font-size:14px;cursor:pointer">Close</button></div>
    </body></html>`);
    win.document.close();
  } catch (err) {
    toast.error('Failed to generate exam paper');
  }
}

export async function downloadDocx(exam: ExportExamInfo, schoolId: string): Promise<void> {
  try {
    const [questionsRes, schoolRes] = await Promise.all([
      fetch(`/api/exams/${exam.id}/questions?includeAnswers=true`),
      fetch(`/api/schools/${schoolId}`),
    ]);
    const questionsJson = await questionsRes.json();
    const schoolJson = await schoolRes.json();
    const questions: QuestionData[] = questionsJson.data || [];
    const school = schoolJson.data || schoolJson;

    if (questions.length === 0) {
      toast.error('No questions to export');
      return;
    }

    const sortedQ = [...questions].sort((a, b) => (a.order || 0) - (b.order || 0));
    const { generateQuestionsDocxBlob } = await import('@/lib/docx-export');

    const blob = await generateQuestionsDocxBlob(
      {
        id: exam.id,
        name: exam.name,
        type: exam.type,
        totalMarks: exam.totalMarks,
        subject: { name: exam.subject },
        class: { name: exam.class },
        duration: exam.duration,
        instructions: exam.instructions,
      },
      sortedQ.map(q => ({
        id: q.id || '',
        type: q.type,
        questionText: q.questionText,
        options: q.options ? JSON.stringify(q.options) : null,
        correctAnswer: q.correctAnswer != null ? String(q.correctAnswer) : null,
        marks: q.marks,
        explanation: q.explanation || null,
        order: q.order || 0,
      })),
      {
        name: school.name || 'School',
        logoBase64: school.logo || null,
        address: school.address || null,
        phone: school.phone || null,
        email: school.email || null,
        motto: school.motto || null,
        website: school.website || null,
        primaryColor: school.primaryColor || '#1B5E20',
      }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exam.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_questions.docx`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    toast.success('DOCX downloaded successfully');
  } catch (err) {
    console.error('DOCX generation failed:', err);
    toast.error(err instanceof Error ? err.message : 'Failed to generate DOCX');
  }
}

export async function generateExamPdf(exam: ExportExamInfo, schoolId: string): Promise<void> {
  try {
    const res = await fetch(`/api/exams/${exam.id}/questions?includeAnswers=true`);
    const json = await res.json();
    const questions: QuestionData[] = (json.data || []);
    if (questions.length === 0) { toast.error('No questions to export'); return; }
    const sortedQ = [...questions].sort((a, b) => (a.order || 0) - (b.order || 0));

    const schoolRes = await fetch(`/api/schools/${schoolId}`);
    const schoolJson = await schoolRes.json();
    const school = schoolJson.data || schoolJson;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210;
    const pageH = 297;
    const m = 18;
    const cw = pageW - 2 * m;
    let y = m;
    let pageNum = 1;

    const checkPage = (need: number): boolean => {
      if (y + need > pageH - 18) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(180);
        doc.text(`Page ${pageNum}`, pageW / 2, pageH - 10, { align: 'center' });
        doc.addPage();
        pageNum++;
        y = m + 5;
        return true;
      }
      return false;
    };

    const typeLabel = exam.type.charAt(0).toUpperCase() + exam.type.slice(1);
    const typeLabelMap: Record<string, string> = { 'MCQ': 'Multiple Choice', 'MULTI_SELECT': 'Multi-Select', 'TRUE_FALSE': 'True/False', 'FILL_BLANK': 'Fill in the Blank', 'SHORT_ANSWER': 'Short Answer', 'ESSAY': 'Essay', 'MATCHING': 'Matching' };

    doc.setFillColor(27, 94, 32);
    doc.rect(0, 0, pageW, 4, 'F');

    const schoolName = (school.name || 'School').toUpperCase();
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(27, 94, 32);
    const snLines = doc.splitTextToSize(schoolName, cw);
    doc.text(snLines, pageW / 2, y + 6, { align: 'center' });
    y += snLines.length * 7 + 10;

    const contactParts: string[] = [];
    if (school.address) contactParts.push(school.address);
    if (school.phone) contactParts.push(`Tel: ${school.phone}`);
    if (school.email) contactParts.push(school.email);
    if (contactParts.length > 0) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      const contactLine = doc.splitTextToSize(contactParts.join('  |  '), cw);
      doc.text(contactLine, pageW / 2, y, { align: 'center' });
      y += contactLine.length * 4 + 4;
    }
    if (school.motto) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(27, 94, 32);
      doc.text(`"${school.motto}"`, pageW / 2, y, { align: 'center' });
      y += 5;
    }

    doc.setDrawColor(27, 94, 32);
    doc.setLineWidth(0.6);
    doc.line(m, y, pageW - m, y);
    y += 6;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text(exam.name, pageW / 2, y, { align: 'center' });
    y += 7;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    doc.text(`${typeLabel}  |  ${exam.subject}  |  ${exam.class}`, pageW / 2, y, { align: 'center' });
    y += 6;

    doc.setFillColor(245, 249, 245);
    doc.setDrawColor(27, 94, 32);
    doc.roundedRect(m, y, cw, 8, 1.5, 1.5, 'FD');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60);
    const infoText = [
      `Date: ${exam.date ? new Date(exam.date).toLocaleDateString() : '________'}`,
      `Duration: ${exam.duration ? exam.duration + ' mins' : '________'}`,
      `Total: ${exam.totalMarks} marks`,
      `Questions: ${sortedQ.length}`,
    ].join('    |    ');
    doc.text(infoText, pageW / 2, y + 5.5, { align: 'center' });
    y += 13;

    if (exam.instructions) {
      doc.setDrawColor(200);
      doc.setFillColor(249, 252, 249);
      const instrLines = doc.splitTextToSize(exam.instructions, cw - 10);
      const instrH = Math.max(12, instrLines.length * 4 + 6);
      checkPage(instrH + 5);
      doc.roundedRect(m, y, cw, instrH, 1, 1, 'FD');
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(27, 94, 32);
      doc.text('INSTRUCTIONS', m + 4, y + 4);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(70);
      doc.text(instrLines, m + 4, y + 8.5);
      y += instrH + 5;
    }

    checkPage(10);
    const colNo = 10;
    const colMarks = 12;
    const colQ = cw - colNo - colMarks;
    doc.setFillColor(27, 94, 32);
    doc.rect(m, y, colNo, 7, 'F');
    doc.rect(m + colNo, y, colQ, 7, 'F');
    doc.rect(m + colNo + colQ, y, colMarks, 7, 'F');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255);
    doc.text('No.', m + colNo / 2, y + 4.8, { align: 'center' });
    doc.text('Question', m + colNo + colQ / 2, y + 4.8, { align: 'center' });
    doc.text('Mks', m + colNo + colQ + colMarks / 2, y + 4.8, { align: 'center' });
    y += 9;

    const LINE_HT = {
      '9pt': 4.2,
      '8.5pt': 4,
      '7pt': 3,
      '7.5pt': 3.2,
    };

    sortedQ.forEach((q, i) => {
      const marksLabel = q.marks > 1 ? `${q.marks} marks` : `${q.marks} mark`;
      const qLabel = `Q${i + 1}  [${typeLabelMap[q.type] || q.type}]  (${marksLabel})`;
      const qText = q.questionText || '';
      const optWidth = cw - colNo - 10;

      // Calculate option heights with text wrapping
      let optLines: string[][] = [];
      if (q.type === 'MCQ' || q.type === 'MULTI_SELECT') {
        optLines = (q.options || []).map((opt, oi) =>
          doc.splitTextToSize(`${String.fromCharCode(65 + oi)}. ${opt}`, optWidth)
        );
      }

      // Calculate per-line heights
      const numH = 5;
      const qTextLines = doc.splitTextToSize(qText, cw - colNo - 4);
      const qTextH = qTextLines.length * LINE_HT['9pt'] + 2;

      let optH = 0;
      if (q.type === 'MCQ' || q.type === 'MULTI_SELECT') {
        optH = optLines.reduce((s, lines) => s + lines.length * LINE_HT['8.5pt'], 0) + 2;
      } else if (q.type === 'TRUE_FALSE') {
        optH = 2 * LINE_HT['8.5pt'] + 2;
      } else if (q.type === 'FILL_BLANK') {
        optH = LINE_HT['9pt'] + 1;
      } else {
        optH = (q.type === 'ESSAY' ? 6 : 3) * LINE_HT['9pt'] + 2;
      }

      const hasAnswer = q.correctAnswer !== undefined && q.correctAnswer !== null && q.correctAnswer !== '';
      let answerH = 0;
      if (hasAnswer) {
        const aStr = typeof q.correctAnswer === 'string' ? q.correctAnswer :
          Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : JSON.stringify(q.correctAnswer);
        answerH = doc.splitTextToSize(`Answer: ${aStr}`, cw - colNo - 8).length * LINE_HT['8.5pt'] + 3;
      }

      let explH = 0;
      if (q.explanation) {
        explH = doc.splitTextToSize(`Explanation: ${q.explanation}`, cw - colNo - 8).length * LINE_HT['7.5pt'] + 3;
      }

      const bottomPad = 4;
      const totalQH = numH + qTextH + optH + answerH + explH + bottomPad + 2;

      // Check if this whole question fits; if not, new page
      checkPage(totalQH);

      // Row background
      if (i % 2 === 0) {
        doc.setFillColor(248, 250, 248);
        doc.rect(m, y - 1, cw, totalQH, 'F');
      }

      // Question number & type label
      let numY = y + 3;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(27, 94, 32);
      doc.text(String(i + 1), m + colNo / 2, numY, { align: 'center' });

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(27, 94, 32);
      doc.text(qLabel, m + colNo + 1, numY);

      let qy = y + 5;

      // Question text
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40);
      doc.text(qTextLines, m + colNo + 1, qy);
      qy += qTextLines.length * LINE_HT['9pt'] + 2;

      // Options / answer space
      if (q.type === 'MCQ' || q.type === 'MULTI_SELECT') {
        doc.setFontSize(8.5);
        doc.setTextColor(70);
        optLines.forEach((lines) => {
          doc.text(lines, m + colNo + 5, qy);
          qy += lines.length * LINE_HT['8.5pt'];
        });
        qy += 2;
      } else if (q.type === 'TRUE_FALSE') {
        doc.setFontSize(8.5);
        doc.setTextColor(70);
        doc.text('(  )  True', m + colNo + 5, qy); qy += LINE_HT['8.5pt'];
        doc.text('(  )  False', m + colNo + 5, qy); qy += LINE_HT['8.5pt'] + 2;
      } else if (q.type === 'FILL_BLANK') {
        doc.setDrawColor(180);
        doc.setLineWidth(0.3);
        doc.line(m + colNo + 5, qy + 1, m + cw - 3, qy + 1);
        qy += LINE_HT['9pt'] + 1;
      } else {
        doc.setDrawColor(210);
        doc.setLineWidth(0.2);
        for (let li = 0; li < (q.type === 'ESSAY' ? 6 : 3); li++) {
          doc.line(m + colNo + 5, qy + 1, m + cw - 3, qy + 1);
          qy += LINE_HT['9pt'];
        }
        qy += 2;
      }

      // Answer key
      if (hasAnswer) {
        if (checkPage(answerH + 2)) {
          qy = y + 3;
          numY = y + 3;
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(27, 94, 32);
          doc.text(String(i + 1), m + colNo / 2, numY, { align: 'center' });
          doc.setFontSize(7);
          doc.text(qLabel, m + colNo + 1, numY);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(40);
        }
        const aStr = typeof q.correctAnswer === 'string' ? q.correctAnswer :
          Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : JSON.stringify(q.correctAnswer);
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(46, 125, 50);
        const aLines = doc.splitTextToSize(`Answer: ${aStr}`, cw - colNo - 8);
        doc.text(aLines, m + colNo + 4, qy);
        qy += aLines.length * LINE_HT['8.5pt'] + 3;
      }

      // Explanation
      if (q.explanation) {
        if (checkPage(explH + 2)) {
          qy = y + 3;
        }
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100);
        const eLines = doc.splitTextToSize(`Explanation: ${q.explanation}`, cw - colNo - 8);
        doc.text(eLines, m + colNo + 4, qy);
        qy += eLines.length * LINE_HT['7.5pt'] + 3;
      }

      // Marks column
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50);
      doc.text(String(q.marks), m + colNo + colQ + colMarks / 2, numY, { align: 'center' });

      // Separator
      doc.setDrawColor(220);
      doc.setLineWidth(0.2);
      doc.line(m, qy, pageW - m, qy);

      y = qy + 3;
    });

    checkPage(10);
    doc.setDrawColor(27, 94, 32);
    doc.setLineWidth(0.6);
    doc.line(m, y, pageW - m, y);
    y += 5;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(27, 94, 32);
    const grandTotal = sortedQ.reduce((sum, q) => sum + (q.marks || 0), 0);
    doc.text(`Total Marks: ${grandTotal}`, pageW - m, y, { align: 'right' });

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(180);
    doc.text(`Page ${pageNum}`, pageW / 2, pageH - 10, { align: 'center' });
    doc.setFontSize(7);
    doc.setTextColor(190);
    doc.text('Generated by SKOOLAR School Management System', pageW / 2, pageH - 6, { align: 'center' });

    doc.save(`${exam.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_questions.pdf`);
    toast.success('PDF downloaded successfully');
  } catch (err) {
    toast.error('Failed to generate PDF');
  }
}
