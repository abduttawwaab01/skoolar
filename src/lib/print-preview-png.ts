import type puppeteer from 'puppeteer';
import type { ReportCardPdfInput } from './report-card-pdf';

const hasArabic = (text: string): boolean => /[\u0600-\u06FF]/.test(text);

function esc(s: unknown): string {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function fmtDate(dateStr?: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return 'N/A'; }
}

function termLabel(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('first') || lower.includes('1st')) return 'First';
  if (lower.includes('second') || lower.includes('2nd')) return 'Second';
  if (lower.includes('third') || lower.includes('3rd')) return 'Third';
  return name;
}

function gradeBg(grade: string): string {
  const colors: Record<string, string> = {
    A1: '#0b5e42', A: '#059669', B2: '#059669', B3: '#3b82f6',
    C4: '#f59e0b', C5: '#ea580c', C6: '#d97706',
    D7: '#ef4444', E8: '#dc2626', F9: '#991b1b',
  };
  const c = colors[grade] || '#6b7280';
  return `background:${c}1a;color:${c}`;
}

function gradeColor(grade: string): string {
  const colors: Record<string, string> = {
    A1: '#0b5e42', A: '#059669', B2: '#059669', B3: '#3b82f6',
    C4: '#f59e0b', C5: '#ea580c', C6: '#d97706',
    D7: '#ef4444', E8: '#dc2626', F9: '#991b1b',
  };
  return colors[grade] || '#6b7280';
}

function ratingBadge(val: string): string {
  const m: Record<string, string> = {
    '5': 'background:#d1fae5;color:#065f46;border:1px solid #a7f3d0',
    '4': 'background:#dbeafe;color:#1e40af;border:1px solid #bfdbfe',
    '3': 'background:#fef3c7;color:#92400e;border:1px solid #fde68a',
    '2': 'background:#ffedd5;color:#9a3412;border:1px solid #fed7aa',
    '1': 'background:#fee2e2;color:#991b1b;border:1px solid #fecaca',
  };
  return m[val] || 'background:#f3f4f6;color:#374151';
}

function ratingLabel(val?: string): string {
  const m: Record<string, string> = { '5': 'Exc', '4': 'V.Gd', '3': 'Gd', '2': 'Fair', '1': 'Poor' };
  return val ? m[val] || val : '';
}

function buildHtml(input: ReportCardPdfInput): string {
  const { student, school, settings, term, cls, subjectResults, attendance, domainGrade, totals } = input;
  const color = school.primaryColor || '#059669';
  const lightColor = `${color}80`;
  const extraLightColor = `${color}15`;
  const accentColor = '#f59e0b';
  const totalSubjects = subjectResults.length;
  const totalMarks = totals.grandTotal || subjectResults.reduce((s, r) => s + r.total, 0);
  const avgScore = totals.averageScore || (totalSubjects > 0 ? totalMarks / totalSubjects : 0);
  const overallGrade = totals.overallGrade || '—';
  const overallRemark = totals.overallRemark || '—';
  const totalObtainable = totals.totalObtainable || totalSubjects * 100;

  const teacherComment = input.teacherComment || input.domainGrade?.classTeacherComment || '—';
  const teacherName = input.domainGrade?.classTeacherName || cls.classTeacher || 'Form Master';
  const principalCommentText = input.principalComment || input.domainGrade?.principalComment || '—';
  const principalName = input.domainGrade?.principalName || settings?.principalName || 'Principal';

  const initials = student.name ? student.name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase() : '—';
  const classPosText = totals.classPositionText || (totals.classPosition ? `${totals.classPosition}${['th','st','nd','rd'][(totals.classPosition % 100) > 10 && (totals.classPosition % 100) < 14 ? 0 : [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20][totals.classPosition % 10] || 0]}` : '—');

  // Grade distribution
  const gradeDistribution: Record<string, number> = {};
  for (const sr of subjectResults) gradeDistribution[sr.grade] = (gradeDistribution[sr.grade] || 0) + 1;
  const gradeOrder = ['A1', 'A', 'B2', 'B3', 'C4', 'C5', 'C6', 'D7', 'E8', 'F9'];
  const maxCount = Math.max(...Object.values(gradeDistribution), 1);

  // Cognitive
  const cogKeys = domainGrade?.cognitive || {};
  const cItems = ['reasoning', 'memory', 'concentration', 'problemSolving', 'initiative'];
  const cLabels: Record<string, string> = {
    reasoning: 'Reasoning', memory: 'Memory', concentration: 'Concentration',
    problemSolving: 'Problem Solving', initiative: 'Initiative',
  };

  // Affective
  const affectiveKeys = domainGrade?.affective || {};
  const aItems = ['punctuality', 'neatness', 'honesty', 'leadership', 'cooperation', 'attentiveness', 'obedience', 'selfControl', 'politeness'];
  const aLabels: Record<string, string> = {
    punctuality: 'Punctuality', neatness: 'Neatness', honesty: 'Honesty',
    leadership: 'Leadership', cooperation: 'Cooperation', attentiveness: 'Attentiveness',
    obedience: 'Obedience', selfControl: 'Self Control', politeness: 'Politeness',
  };

  // Psychomotor
  const psyKeys = domainGrade?.psychomotor || {};
  const pItems = ['handwriting', 'sports', 'drawing', 'practical'];
  const pLabels: Record<string, string> = {
    handwriting: 'Handwriting', sports: 'Sports', drawing: 'Drawing', practical: 'Practical',
  };

  const genDate = new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
  const nextTermDate = settings?.nextTermBegins ? fmtDate(settings.nextTermBegins) : '';

  let subjectRows = '';
  for (let i = 0; i < subjectResults.length; i++) {
    const sr = subjectResults[i];
    const gBg = gradeBg(sr.grade);
    subjectRows += `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
      <td style="padding:2px 2px;text-align:center;color:#64748b;font-size:9px;border:1px solid #e2e8f0;word-break:break-word">${i + 1}</td>
      <td style="padding:2px 2px;font-weight:500;color:#111827;font-size:9px;border:1px solid #e2e8f0;word-break:break-word"${hasArabic(sr.subjectName)?' dir="rtl"':''}>${esc(sr.subjectName)}</td>
      <td style="padding:2px 2px;text-align:center;color:#475569;font-size:9px;border:1px solid #e2e8f0">${Math.round(sr.caScore)}</td>
      <td style="padding:2px 2px;text-align:center;color:#475569;font-size:9px;border:1px solid #e2e8f0">${Math.round(sr.examScore)}</td>
      <td style="padding:2px 2px;text-align:center;font-weight:700;color:#111827;font-size:9px;border:1px solid #e2e8f0">${Math.round(sr.total)}</td>
      <td style="padding:2px 2px;text-align:center;border:1px solid #e2e8f0;word-break:break-word"><span style="display:inline-block;padding:1px 3px;border-radius:3px;font-size:8px;font-weight:700;${gBg}">${esc(sr.grade)}</span></td>
      <td style="padding:2px 2px;text-align:center;color:#64748b;font-size:8px;border:1px solid #e2e8f0;word-break:break-word">${esc(sr.remark)}</td>
    </tr>`;
  }

  const headerCols = `<th style="padding:3px 4px;text-align:center;color:#fff;font-weight:600;font-size:9px;background:${color}">C.A.</th>
    <th style="padding:3px 4px;text-align:center;color:#fff;font-weight:600;font-size:9px;background:${color}">EXAM</th>`;

  const gradeCols = gradeOrder.filter(g => gradeDistribution[g] > 0).slice(0, 6);
  let gradeBars = '';
  for (const grade of gradeCols) {
    const count = gradeDistribution[grade] || 0;
    const pct = count / maxCount;
    const gc = gradeColor(grade);
    gradeBars += `<div style="display:flex;align-items:center;gap:3px;margin-bottom:2px">
      <span style="font-size:8px;font-weight:700;color:${gc};width:14px;text-align:right">${grade}</span>
      <div style="flex:1;height:8px;border-radius:3px;background:#f1f5f9;overflow:hidden">
        <div style="height:100%;width:${pct * 100}%;border-radius:3px;background:${gc};opacity:0.8"></div>
      </div>
      <span style="font-size:8px;font-weight:600;color:#475569;width:12px">${count}</span>
    </div>`;
  }

  let logoHtml = '';
  if (school.logoBase64) {
    logoHtml = `<img src="${esc(school.logoBase64)}" style="width:100%;height:100%;object-fit:contain" />`;
  } else {
    logoHtml = `<span style="font-size:16px;font-weight:700;color:${color}">${esc((school.name || 'S').charAt(0).toUpperCase())}</span>`;
  }

  let photoHtml = '';
  if (student.photoBase64) {
    photoHtml = `<img src="${esc(student.photoBase64)}" style="width:100%;height:100%;object-fit:cover" />`;
  } else {
    photoHtml = `<span style="font-size:11px;font-weight:700;color:${color}">${esc(initials)}</span>`;
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=794"/>
<title>Report Card — ${esc(student.name)}</title>
<style>
  @page { margin:0; size:A4; }
  body { margin:0; padding:0; font-family:Arial,Tahoma,sans-serif; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  * { box-sizing:border-box; }
</style>
</head>
<body>
<div class="print-container" style="width:210mm;min-height:297mm;background:#fff;display:flex;flex-direction:column">

  <!-- TOP GRADIENT BAR -->
  <div style="height:3px;flex-shrink:0;background:linear-gradient(90deg,${color},${lightColor})"></div>

  <div style="padding:6px 10px;display:flex;flex-direction:column;gap:2px;flex:1">

    <!-- HEADER -->
    <div style="display:flex;align-items:flex-start;gap:12px">
      <div style="display:flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:50%;background:${extraLightColor};border:1.5px solid ${lightColor};flex-shrink:0">
        <div style="width:44px;height:44px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden">
          ${logoHtml}
        </div>
      </div>
      <div style="flex:1;text-align:center">
        <h1 style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#111827;margin:0;word-wrap:break-word">${esc(school.name || '').toUpperCase()}</h1>
        ${school.motto ? `<p style="font-size:8px;font-style:italic;margin:1px 0 0;color:${color}">${esc(school.motto)}</p>` : ''}
        ${school.address ? `<p style="font-size:8px;color:#64748b;margin:1px 0 0">${esc(school.address)}</p>` : ''}
        ${school.phone || school.email ? `<p style="font-size:7px;color:#6b7280;margin:1px 0 0">${[school.phone, school.email].filter(Boolean).join(' | ')}</p>` : ''}
      </div>
    </div>

    <!-- TITLE -->
    <div style="text-align:center;padding:4px 0 2px">
      <span style="font-size:10px;font-weight:700;color:${color};letter-spacing:0.5px">${esc(termLabel(term.name))} Term Student's Report</span>
    </div>

    <!-- STUDENT INFO -->
    <div style="border:1px solid #e2e8f0;border-radius:6px;padding:4px 8px;position:relative;min-height:60px">
      <div style="position:absolute;top:0;left:0;right:0;height:8px;background:${color}08;border-radius:6px 6px 0 0"></div>
      <table style="width:100%;font-size:8px;margin-top:2px">
        <tr>
          <td style="padding:2px 4px;width:50%">
            <span style="color:#64748b">Name:</span>
            <span style="font-weight:600;color:#111827;word-wrap:break-word">${esc(student.name)}</span>
          </td>
          <td style="padding:2px 4px">
            <span style="color:#64748b">Session:</span>
            <span style="font-weight:600;color:#111827">${esc(settings?.academicSession || term.academicYear || '—')}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:2px 4px">
            <span style="color:#64748b">Class:</span>
            <span style="font-weight:600;color:#111827">${esc(cls.name || '—')}${cls.section ? ` (${esc(cls.section)})` : ''}</span>
          </td>
          <td style="padding:2px 4px">
            <span style="color:#64748b">Term:</span>
            <span style="font-weight:600;color:#111827">${esc(termLabel(term.name))}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:2px 4px">
            <span style="color:#64748b">Gender:</span>
            <span style="font-weight:600;color:#111827">${esc(student.gender || 'N/A')}</span>
          </td>
          <td style="padding:2px 4px">
            <span style="color:#64748b">D.O.B:</span>
            <span style="font-weight:600;color:#111827">${fmtDate(student.dateOfBirth)}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:2px 4px">
            <span style="color:#64748b">Admission No:</span>
            <span style="font-weight:600;color:#111827">${esc(student.admissionNo || '—')}</span>
          </td>
          <td style="padding:2px 4px">
            <span style="color:#64748b">Parent(s):</span>
            <span style="font-weight:600;color:#111827;word-wrap:break-word">${esc(student.parents || '—')}</span>
          </td>
        </tr>
      </table>
      <div style="position:absolute;right:3px;top:50%;transform:translateY(-50%);width:42px;height:42px;border-radius:50%;background:${extraLightColor};border:1px solid ${color};display:flex;align-items:center;justify-content:center;overflow:hidden">
        ${photoHtml}
      </div>
    </div>

    <!-- SCORE TABLE -->
    <div style="overflow-x:auto;margin-top:2px">
      <table style="width:100%;border-collapse:collapse;table-layout:fixed">
        <colgroup>
          <col style="width:5%"/>
          <col style="width:28%"/>
          <col style="width:13%"/>
          <col style="width:13%"/>
          <col style="width:13%"/>
          <col style="width:10%"/>
          <col style="width:18%"/>
        </colgroup>
        <thead>
          <tr>
            <th style="padding:3px 4px;text-align:center;color:#fff;font-weight:600;font-size:9px;background:${color}">S/N</th>
            <th style="padding:3px 4px;text-align:center;color:#fff;font-weight:600;font-size:9px;background:${color}">SUBJECT</th>
            ${headerCols}
            <th style="padding:3px 4px;text-align:center;color:#fff;font-weight:600;font-size:9px;background:${color}">TOTAL</th>
            <th style="padding:3px 4px;text-align:center;color:#fff;font-weight:600;font-size:9px;background:${color}">GRADE</th>
            <th style="padding:3px 4px;text-align:center;color:#fff;font-weight:600;font-size:9px;background:${color}">REMARK</th>
          </tr>
        </thead>
        <tbody>
          ${subjectRows}
        </tbody>
        <tfoot>
          <tr style="font-weight:600;background:${color}08">
            <td colspan="4" style="padding:3px 6px;text-align:right;color:#374151;font-size:9px;border:1px solid #e2e8f0;word-break:break-word">TOTAL / ${totalObtainable}</td>
            <td style="padding:3px 6px;text-align:center;font-weight:700;color:#111827;font-size:9px;border:1px solid #e2e8f0">${Math.round(totalMarks)}</td>
            <td style="padding:3px 6px;text-align:center;border:1px solid #e2e8f0"><span style="display:inline-block;padding:1px 6px;border-radius:4px;font-weight:700;font-size:8px;background:${color}20;color:${color}">${esc(overallGrade)}</span></td>
            <td style="padding:3px 6px;text-align:center;color:#64748b;font-size:8px;border:1px solid #e2e8f0">${esc(overallRemark)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- PERFORMANCE SUMMARY + GRADE ANALYSIS -->
    <div style="display:grid;grid-template-columns:2fr 3fr;gap:3px">
      <div style="border:1px solid #e2e8f0;border-radius:6px">
        <div style="background:${color}08;padding:3px 6px;border-radius:6px 6px 0 0">
          <span style="font-size:9px;font-weight:700;color:${color}">Performance Summary</span>
        </div>
        <div style="padding:3px 6px">
          ${[
            ['Total Marks Obtained', `${Math.round(totalMarks)}`],
            ['Total Marks Obtainable', `${totalObtainable}`],
            ['Average Score', `${avgScore.toFixed(2)}%`],
            ['Average Grade', overallGrade],
            ['Class Population', `${totals.totalStudents || '—'}`],
            ['Position', classPosText],
          ].map(([l, v], i) => `
            <div style="display:flex;justify-content:space-between;padding:1.5px 0;font-size:8px;${i > 0 ? 'border-top:0.5px solid #f1f5f9;' : ''}">
              <span style="color:#64748b">${l}</span>
              <span style="font-weight:${i === 2 || i === 3 || i === 5 ? '800' : '600'};color:${i === 2 || i === 3 || i === 5 ? color : '#1e293b'}">${v}</span>
            </div>
          `).join('')}
        </div>
      </div>
      <div style="border:1px solid #e2e8f0;border-radius:6px">
        <div style="background:${accentColor}08;padding:3px 6px;border-radius:6px 6px 0 0">
          <span style="font-size:9px;font-weight:700;color:${accentColor}">Grade Analysis</span>
        </div>
        <div style="padding:3px 6px">
          ${gradeBars || '<div style="font-size:8px;color:#94a3b8;text-align:center">No grade data</div>'}
        </div>
      </div>
    </div>

    <!-- COGNITIVE + AFFECTIVE + PSYCHOMOTOR -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:3px">
      <div style="border:1px solid #e2e8f0;border-radius:6px">
        <div style="background:${color}08;padding:3px 6px;border-radius:6px 6px 0 0">
          <span style="font-size:9px;font-weight:700;color:${color}">Cognitive Domain</span>
        </div>
        <div style="padding:2px 4px">
          ${cItems.map(k => {
            const val = cogKeys[k];
            const label = cLabels[k] || k;
            const badge = val
              ? `<span style="display:inline-block;padding:1px 4px;border-radius:3px;font-size:7px;font-weight:600;${ratingBadge(val)}">${esc(ratingLabel(val))} (${val})</span>`
              : '<span style="color:#cbd5e1;font-size:7px">—</span>';
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:1.5px 2px;font-size:7px;border-bottom:0.5px solid #f1f5f9">
              <span style="color:#475569">${label}</span>
              ${badge}
            </div>`;
          }).join('')}
        </div>
      </div>
      <div style="border:1px solid #e2e8f0;border-radius:6px">
        <div style="background:${color}08;padding:3px 6px;border-radius:6px 6px 0 0">
          <span style="font-size:9px;font-weight:700;color:${color}">Affective Domain</span>
        </div>
        <div style="padding:2px 4px">
          ${aItems.map(k => {
            const val = affectiveKeys[k];
            const label = aLabels[k] || k;
            const badge = val
              ? `<span style="display:inline-block;padding:1px 4px;border-radius:3px;font-size:7px;font-weight:600;${ratingBadge(val)}">${esc(ratingLabel(val))} (${val})</span>`
              : '<span style="color:#cbd5e1;font-size:7px">—</span>';
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:1.5px 2px;font-size:7px;border-bottom:0.5px solid #f1f5f9">
              <span style="color:#475569">${label}</span>
              ${badge}
            </div>`;
          }).join('')}
        </div>
      </div>
      <div style="border:1px solid #e2e8f0;border-radius:6px">
        <div style="background:${color}08;padding:3px 6px;border-radius:6px 6px 0 0">
          <span style="font-size:9px;font-weight:700;color:${color}">Psychomotor Skill</span>
        </div>
        <div style="padding:2px 4px">
          ${pItems.map(k => {
            const val = psyKeys[k];
            const label = pLabels[k] || k;
            const badge = val
              ? `<span style="display:inline-block;padding:1px 4px;border-radius:3px;font-size:7px;font-weight:600;${ratingBadge(val)}">${esc(ratingLabel(val))} (${val})</span>`
              : '<span style="color:#cbd5e1;font-size:7px">—</span>';
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:1.5px 2px;font-size:7px;border-bottom:0.5px solid #f1f5f9">
              <span style="color:#475569">${label}</span>
              ${badge}
            </div>`;
          }).join('')}
          <div style="padding:2px 2px 0;font-size:7px;font-weight:600;color:#1e293b;border-top:0.5px solid #e2e8f0;margin-top:2px">Key: 5=Exc 4=V.Gd 3=Gd 2=Fair 1=Poor</div>
        </div>
      </div>
    </div>

    <!-- ATTENDANCE + FORM MASTER'S REMARK -->
    <div style="display:grid;grid-template-columns:1fr 2fr;gap:3px">
      <div style="border:1px solid #e2e8f0;border-radius:6px">
        <div style="background:${color}08;padding:3px 6px;border-radius:6px 6px 0 0">
          <span style="font-size:9px;font-weight:700;color:${color}">Attendance</span>
        </div>
        <div style="padding:2px 6px">
          ${[
            ['Days Recorded', attendance.totalDays],
            ['Present', attendance.presentDays],
            ['Absent', attendance.absentDays],
            ['On Leave', attendance.onLeave ?? 0],
          ].map(([l, v]) => `
            <div style="display:flex;justify-content:space-between;padding:1.5px 0;font-size:8px">
              <span style="color:#64748b">${l}</span>
              <span style="font-weight:700;color:${color}">${v}</span>
            </div>
          `).join('')}
        </div>
      </div>
      <div style="border:1px solid #e2e8f0;border-radius:6px">
        <div style="background:${color}08;padding:3px 6px;border-radius:6px 6px 0 0">
          <span style="font-size:9px;font-weight:700;color:${color}">Form Master's Remark</span>
        </div>
        <div style="padding:3px 6px;font-size:8px;color:#475569;min-height:32px">
          ${esc(teacherComment).substring(0, 120)}
        </div>
        <div style="border-top:0.5px solid #e2e8f0;padding:2px 6px;margin-top:auto">
          <div style="border-top:1px dashed #cbd5e1;width:60%;margin:2px 0"></div>
          <span style="font-size:8px;font-weight:600;color:#1e293b">${esc(teacherName)}</span>
          <span style="font-size:7px;color:#94a3b8"> — Form Master</span>
        </div>
      </div>
    </div>

    <!-- PRINCIPAL'S REMARK -->
    <div style="border:1px solid #e2e8f0;border-radius:6px">
      <div style="background:${accentColor}08;padding:3px 6px;border-radius:6px 6px 0 0">
        <span style="font-size:9px;font-weight:700;color:${accentColor}">Principal's Remark</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;padding:3px 6px">
        <div style="font-size:8px;color:#475569;flex:1">${esc(principalCommentText).substring(0, 150)}</div>
        <div style="text-align:right;flex-shrink:0;margin-left:8px">
          <div style="border-top:1px dashed #cbd5e1;width:80px;margin:0 0 2px auto"></div>
          <div style="font-size:8px;font-weight:600;color:#1e293b">${esc(principalName)}</div>
          <div style="font-size:7px;color:#94a3b8">Principal</div>
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <div style="display:flex;justify-content:space-between;align-items:center;font-size:8px;color:#64748b;padding-top:4px;margin-top:auto;border-top:1px solid #e2e8f0">
      <span>Next Term: <span style="font-weight:600;color:${color}">${esc(nextTermDate)}</span></span>
      <span style="font-size:6px;color:#cbd5e1;letter-spacing:2px;font-weight:600">SKOOLAR · ACADEMIC MANAGEMENT SYSTEM</span>
      <span>Generated: ${esc(genDate)}</span>
    </div>

  </div>
</div>
</body>
</html>`;
}

export async function renderPrintPreviewPng(input: ReportCardPdfInput): Promise<Buffer> {
  const html = buildHtml(input);

  const { default: puppeteerReal } = await import('puppeteer');

  const browser = await puppeteerReal.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 });

    await page.setContent(html, { waitUntil: 'load', timeout: 60000 });

    await page.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 800));

    const box = await page.evaluate(() => {
      const el = document.querySelector('.print-container') as HTMLElement | null;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: Math.ceil(rect.width), height: Math.ceil(rect.height) };
    });

    if (!box) throw new Error('print-container not found');

    const png = await page.screenshot({
      clip: { x: box.x, y: box.y, width: box.width, height: box.height },
      type: 'png',
    });

    return Buffer.from(png);
  } finally {
    await browser.close();
  }
}
