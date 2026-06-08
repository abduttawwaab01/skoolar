import type puppeteer from 'puppeteer';
import type { ReportCardPdfInput, ReportCardSubjectResult } from './report-card-pdf';
import { ARABIC_FONT_BASE64, ARABIC_FONT_FAMILY } from '@/lib/id-card-utils/arabic-font-data';

const hasArabic = (text: string): boolean => /[\u0600-\u06FF]/.test(text);

function esc(s: unknown): string {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function fmtDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return '—'; }
}

function getTermAbbr(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('first') || lower.includes('1st') || lower.includes('1')) return '1ST';
  if (lower.includes('second') || lower.includes('2nd') || lower.includes('2')) return '2ND';
  if (lower.includes('third') || lower.includes('3rd') || lower.includes('3')) return '3RD';
  return name.toUpperCase();
}

function gradeBg(grade: string): string {
  switch (grade) {
    case 'A': case 'A+': return 'background:#d1fae5;color:#047857';
    case 'B': case 'B+': return 'background:#dbeafe;color:#1d4ed8';
    case 'C': return 'background:#fef3c7;color:#b45309';
    case 'D': return 'background:#ffedd5;color:#c2410c';
    case 'E': return 'background:#fee2e2;color:#b91c1c';
    case 'F': return 'background:#fecaca;color:#7f1d1d';
    default: return 'background:#f3f4f6;color:#374151';
  }
}

function ratingBadge(val: string): string {
  switch (val) {
    case '5': return 'background:#d1fae5;color:#065f46;border:1px solid #a7f3d0';
    case '4': return 'background:#dbeafe;color:#1e40af;border:1px solid #bfdbfe';
    case '3': return 'background:#fef3c7;color:#92400e;border:1px solid #fde68a';
    case '2': return 'background:#ffedd5;color:#9a3412;border:1px solid #fed7aa';
    case '1': return 'background:#fee2e2;color:#991b1b;border:1px solid #fecaca';
    default: return 'background:#f3f4f6;color:#374151;border:1px solid #e5e7eb';
  }
}

function ratingLabel(val?: string): string {
  const m: Record<string, string> = { '5': 'Excellent', '4': 'Very Good', '3': 'Good', '2': 'Fair', '1': 'Poor' };
  return val ? m[val] || '' : '';
}

const GRADING_KEY = [
  { grade: 'A', range: '70-100', remark: 'Excellent', bg: '#d1fae5', fg: '#065f46', border: '#a7f3d0' },
  { grade: 'B', range: '60-69', remark: 'Very Good', bg: '#dbeafe', fg: '#1e40af', border: '#bfdbfe' },
  { grade: 'C', range: '50-59', remark: 'Good', bg: '#fef3c7', fg: '#92400e', border: '#fde68a' },
  { grade: 'D', range: '40-49', remark: 'Fair', bg: '#ffedd5', fg: '#9a3412', border: '#fed7aa' },
  { grade: 'E', range: '30-39', remark: 'Poor', bg: '#fee2e2', fg: '#991b1b', border: '#fecaca' },
  { grade: 'F', range: '0-29', remark: 'Fail', bg: '#fecaca', fg: '#7f1d1d', border: '#fca5a5' },
];

function buildHtml(input: ReportCardPdfInput): string {
  const { student, school, settings, term, cls, subjectResults, scoreTypes, attendance, domainGrade, isThirdTerm, totals } = input;
  const color = school.primaryColor || '#059669';
  const secondaryColor = school.secondaryColor || '#0d9488';
  const lightColor = `${color}80`;
  const extraLightColor = `${color}15`;
  const accentColor = secondaryColor || '#0d9488';
  const totalSubjects = subjectResults.length;
  const maxPossible = totalSubjects * 100;
  const totalMarks = totals.grandTotal || subjectResults.reduce((s, r) => s + r.total, 0);
  const avgScore = totals.averageScore || (totalSubjects > 0 ? totalMarks / totalSubjects : 0);
  const overallGrade = totals.overallGrade || '—';
  const overallRemark = totals.overallRemark || '—';
  const classRank = totals.classRank;
  const totalStudentsVal = totals.totalStudents || 0;
  const hasDynamicColumns = scoreTypes.length > 0;
  const initials = student.name ? student.name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase() : '—';
  const positionText = classRank ? `#${classRank} of ${totalStudentsVal || '—'}` : '—';
  const termAbbr = getTermAbbr(term.name);

  const teacherComment = input.teacherComment || (domainGrade?.classTeacherComment) || 'No comment yet.';
  const teacherName = domainGrade?.classTeacherName || cls.classTeacher || 'Class Teacher';
  const principalCommentText = domainGrade?.principalComment || 'No comment yet.';
  const principalName = domainGrade?.principalName || settings?.principalName || 'Principal';
  const generatedDate = new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
  const nextTermDate = settings?.nextTermBegins ? fmtDate(settings.nextTermBegins) : '—';

  function row(i: number): string {
    return i % 2 === 0 ? 'background:#fff' : 'background:#f8fafc';
  }

  const numDynamicCols = hasDynamicColumns ? scoreTypes.length : 2;
  const totalTableCols = hasDynamicColumns ? 1 + 1 + numDynamicCols + 1 + 1 + 1 : 7;

  let subjectRows = '';
  if (subjectResults.length === 0) {
    subjectRows = `<tr><td colspan="${totalTableCols}" style="padding:12px;text-align:center;color:#9ca3af;font-size:11px;border:1px solid #e2e8f0">No scores available for this term</td></tr>`;
  } else {
    for (let i = 0; i < subjectResults.length; i++) {
      const sr = subjectResults[i];
      let scoreCells = '';
      if (hasDynamicColumns) {
        for (const st of scoreTypes) {
          const s = sr.scoresByType?.[st.id];
          const val = s != null ? Math.round(s.raw) : '—';
          scoreCells += `<td style="border:1px solid #e2e8f0;padding:3px 6px;text-align:center;color:#374151;font-size:11px">${esc(val)}</td>`;
        }
      } else {
        scoreCells += `<td style="border:1px solid #e2e8f0;padding:3px 6px;text-align:center;color:#374151;font-size:11px">${Math.round(sr.caScore)}</td>`;
        scoreCells += `<td style="border:1px solid #e2e8f0;padding:3px 6px;text-align:center;color:#374151;font-size:11px">${Math.round(sr.examScore)}</td>`;
      }
      const gBg = gradeBg(sr.grade);
      subjectRows += `<tr style="${row(i)}">
        <td style="border:1px solid #e2e8f0;padding:3px 6px;text-align:center;color:#64748b;font-size:10px">${i + 1}</td>
        <td style="border:1px solid #e2e8f0;padding:3px 6px;font-weight:500;color:#111827;font-size:11px"${hasArabic(sr.subjectName)?' dir="rtl"':''}>${esc(sr.subjectName)}</td>
        ${scoreCells}
        <td style="border:1px solid #e2e8f0;padding:3px 6px;text-align:center;font-weight:700;color:#111827;font-size:11px">${Math.round(sr.total)}</td>
        <td style="border:1px solid #e2e8f0;padding:3px 6px;text-align:center"><span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:9px;font-weight:700;${gBg}">${esc(sr.grade)}</span></td>
        <td style="border:1px solid #e2e8f0;padding:3px 6px;text-align:center;color:#64748b;font-size:10px">${esc(sr.remark)}</td>
      </tr>`;
    }
  }

  let tableFooter = '';
  if (subjectResults.length > 0) {
    tableFooter = `<tfoot><tr style="font-weight:600;${`background:${color}10`}">
      <td colspan="${1 + 1 + numDynamicCols}" style="border:1px solid #e2e8f0;padding:6px 8px;text-align:right;color:#374151;font-size:11px">TOTAL / ${maxPossible}</td>
      <td style="border:1px solid #e2e8f0;padding:6px 8px;text-align:center;font-weight:700;color:#111827">${totalMarks}</td>
      <td style="border:1px solid #e2e8f0;padding:6px 8px;text-align:center"><span style="display:inline-block;padding:2px 8px;border-radius:6px;font-weight:700;font-size:10px;${`background:${color}20;color:${color}`}">${esc(overallGrade)}</span></td>
      <td style="border:1px solid #e2e8f0;padding:6px 8px;text-align:center;color:#374151;font-size:11px">${esc(overallRemark)}</td>
    </tr></tfoot>`;
  }

  let headerCols = '';
  if (hasDynamicColumns) {
    for (const st of scoreTypes) {
      headerCols += `<th style="padding:4px 8px;text-align:center;color:#fff;font-weight:600;white-space:nowrap;background:${color}">${esc(st.name)} (${st.weight}%)</th>`;
    }
  } else {
    headerCols += `<th style="padding:4px 8px;text-align:center;color:#fff;font-weight:600;background:${color}">CA (40%)</th>`;
    headerCols += `<th style="padding:4px 8px;text-align:center;color:#fff;font-weight:600;background:${color}">EXAM (60%)</th>`;
  }

  let logoHtml = '';
  if (school.logoBase64) {
    logoHtml = `<img src="${esc(school.logoBase64)}" alt="${esc(school.name)}" style="width:100%;height:100%;object-fit:contain" />`;
  } else {
    logoHtml = `<span style="font-size:20px;font-weight:700;color:${color}">${esc((school.name || 'S').charAt(0).toUpperCase())}</span>`;
  }

  let photoImg = '';
  if (student.photoBase64) {
    photoImg = `<img src="${esc(student.photoBase64)}" alt="${esc(student.name)}" style="width:100%;height:100%;object-fit:cover" />`;
  } else {
    photoImg = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;background:${color}15;color:${color}">${esc(initials)}</div>`;
  }

  const domainSections = isThirdTerm && domainGrade ? buildDomainHtml(domainGrade, color) : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=794"/>
<title>Report Card — ${esc(student.name)}</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
  @page { margin:0; size:A4; }
  @font-face {
    font-family: '${ARABIC_FONT_FAMILY}';
    src: url(data:font/ttf;base64,${ARABIC_FONT_BASE64}) format('truetype');
    font-weight: normal;
    font-style: normal;
  }
  body { margin:0; padding:0; font-family:'${ARABIC_FONT_FAMILY}',Arial,Tahoma,sans-serif; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  * { box-sizing:border-box; }
</style>
</head>
<body>
<div class="print-container" style="width:210mm;min-height:297mm;background:#fff;display:flex;flex-direction:column;font-family:'${ARABIC_FONT_FAMILY}',Arial,Tahoma,sans-serif;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25)">

  <!-- TOP GRADIENT BAR -->
  <div style="height:3px;flex-shrink:0;background:linear-gradient(90deg,${color},${lightColor})"></div>

  <div style="padding:8px 16px 8px;display:flex;flex-direction:column;gap:3px;flex:1" id="report-card-content">

    <!-- HEADER: logo + school info -->
    <div style="display:flex;align-items:center;gap:16px">
      <div style="position:relative;flex-shrink:0;display:flex;align-items:center;justify-content:center;width:72px;height:72px">
        <div style="position:absolute;border-radius:50%;width:72px;height:72px;background:${extraLightColor};border:1.5px solid ${lightColor}"></div>
        <div style="position:absolute;border-radius:50%;background:#fff;width:64px;height:64px"></div>
        <div style="position:relative;z-index:10;border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;width:56px;height:56px">
          ${logoHtml}
        </div>
      </div>
      <div style="flex:1;min-width:0;text-align:center">
        <h1 style="font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#111827;line-height:1.2;margin:0">${esc((school.name || 'School Name').toUpperCase().slice(0, 55))}</h1>
        ${school.motto ? `<p style="font-size:10px;font-weight:600;font-style:italic;line-height:1.2;margin:2px 0 0 0;color:${color}">— ${esc(school.motto)} —</p>` : ''}
        ${school.address ? `<p style="font-size:10px;color:#64748b;line-height:1.2;margin:2px 0 0 0">${esc(school.address)}</p>` : ''}
        ${school.phone || school.email ? `<p style="font-size:9px;color:#6b7280;margin:1px 0 0 0">${[school.phone, school.email].filter(Boolean).join(' | ')}</p>` : ''}
      </div>
    </div>

    <!-- TERM PILL -->
    <div style="display:flex;justify-content:center">
      <div style="display:inline-flex;align-items:center;gap:6px;padding:6px 24px;border-radius:999px;font-size:13px;font-weight:700;color:#fff;letter-spacing:0.025em;background:${color};box-shadow:0 2px 8px ${color}40">
        ${esc(settings?.academicSession || term.academicYear || '—')} — ${esc(termAbbr)} TERM REPORT
      </div>
    </div>

    <!-- STUDENT INFORMATION -->
    <div>
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:6px">
        <svg class="size-4" style="color:${color};flex-shrink:0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <h2 style="font-size:13px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#111827;margin:0">Student Information</h2>
      </div>
      <div style="position:relative;border:1px solid #e2e8f0;border-radius:12px;background:#fff;padding:8px 10px">
        <div style="position:absolute;top:0;left:0;right:0;height:12px;border-radius:12px 12px 0 0;background:${color}08"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 8px;padding-right:80px;position:relative">
          ${field('Student Name', esc(student.name))}
          ${field('Gender / Blood', `${esc(student.gender || '—')}${student.bloodGroup ? ` / ${esc(student.bloodGroup)}` : ''}`)}
          ${field('Admission No', esc(student.admissionNo))}
          ${field('Class', `${esc(cls.name || '—')}${cls.section ? ` (${esc(cls.section)})` : ''}`)}
          ${field('Date of Birth', fmtDate(student.dateOfBirth))}
          ${field('Position', esc(positionText))}
          ${field('Term Period', `${fmtDate(term.startDate)} — ${fmtDate(term.endDate)}`)}
          ${field('Class Size', `${totalStudentsVal || '—'} Students`)}
        </div>
        <!-- Photo -->
        <div style="position:absolute;right:4px;top:0;bottom:0;display:flex;align-items:center">
          <div style="position:relative;display:flex;align-items:center;justify-content:center;width:68px;height:68px">
            <div style="position:absolute;border-radius:50%;width:68px;height:68px;background:${extraLightColor};border:1.5px solid ${color}"></div>
            <div style="position:absolute;border-radius:50%;background:#fff;width:60px;height:60px"></div>
            <div style="position:relative;z-index:10;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;width:52px;height:52px">
              ${photoImg}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- SCORE TABLE -->
    <div style="overflow-x:auto">
      <table style="width:100%;font-size:11px;border-collapse:collapse">
        <thead>
          <tr>
            <th style="padding:4px 8px;color:#fff;font-weight:600;width:24px;text-align:center;background:${color};border-radius:12px 0 0 0">S/N</th>
            <th style="padding:4px 8px;text-align:left;color:#fff;font-weight:600;background:${color}">SUBJECT</th>
            ${headerCols}
            <th style="padding:4px 8px;text-align:center;color:#fff;font-weight:600;width:40px;background:${color}">TOTAL</th>
            <th style="padding:4px 8px;text-align:center;color:#fff;font-weight:600;width:40px;background:${color}">GRADE</th>
            <th style="padding:4px 8px;text-align:center;color:#fff;font-weight:600;width:80px;background:${color};border-radius:0 12px 0 0">REMARK</th>
          </tr>
        </thead>
        <tbody>
          ${subjectRows}
        </tbody>
        ${tableFooter}
      </table>
    </div>

    <!-- 4-CARD STAT SUMMARY -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px">
      ${statCard('TOTAL SCORE', String(totalMarks), `out of ${maxPossible}`, color, color)}
      ${statCard('AVERAGE', `${avgScore.toFixed(1)}%`, `${totalSubjects} subjects`, color, '#3b82f6')}
      ${statCard('GRADE', overallGrade, overallRemark, color, secondaryColor || '#0d9488')}
      ${statCard('POSITION', String(classRank || '—'), `out of ${totalStudentsVal || '—'}`, color, '#8b5cf6')}
    </div>

    <!-- ATTENDANCE + GRADING SCALE -->
    <div style="display:grid;grid-template-columns:2fr 3fr;gap:4px">
      <!-- Attendance -->
      <div style="border:1px solid #e2e8f0;border-radius:12px;background:#fff">
        <div style="border-radius:12px 12px 0 0;padding:5px 8px 2px;background:${color}08">
          <div style="display:flex;align-items:center;gap:4px">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <h3 style="font-size:11px;font-weight:700;letter-spacing:0.05em;margin:0;color:${color}">ATTENDANCE</h3>
          </div>
          <div style="height:1.5px;border-radius:1px;margin-top:2px;background:${color}15"></div>
        </div>
        <div style="padding:4px 8px">
          ${attRow('Total School Days', String(attendance.totalDays || 0), '#475569')}
          ${attRow('Days Present', String(attendance.presentDays || 0), '#059669')}
          ${attRow('Days Absent', String(attendance.absentDays || 0), '#ef4444')}
          ${attRow('Attendance Rate', `${attendance.percentage || 0}%`, color)}
        </div>
      </div>
      <!-- Grading Scale -->
      <div style="border:1px solid #e2e8f0;border-radius:12px;background:#fff">
        <div style="border-radius:12px 12px 0 0;padding:5px 8px 2px;background:${accentColor}08">
          <div style="display:flex;align-items:center;gap:4px">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${accentColor}" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <h3 style="font-size:11px;font-weight:700;letter-spacing:0.05em;margin:0;color:${accentColor}">GRADING SCALE</h3>
          </div>
          <div style="height:1.5px;border-radius:1px;margin-top:2px;background:${accentColor}15"></div>
        </div>
        <div style="padding:3px 4px">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:2px">
            ${GRADING_KEY.map(g => `<div style="display:flex;align-items:center;gap:2px;padding:2px 4px;border-radius:8px;border:1px solid ${g.border};background:${g.bg}">
              <span style="font-size:12px;font-weight:700;color:${g.fg};width:14px;text-align:center;line-height:1">${g.grade}</span>
              <div style="flex:1;min-width:0">
                <p style="font-size:7px;font-weight:600;color:${g.fg};line-height:1.2;margin:0">${g.range}</p>
                <p style="font-size:6px;color:${g.fg};opacity:0.8;line-height:1.2;margin:0">${g.remark}</p>
              </div>
            </div>`).join('')}
          </div>
        </div>
      </div>
    </div>

    <!-- REMARKS & SIGNATURES -->
    <div>
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:6px">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <h2 style="font-size:13px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#111827;margin:0">Remarks &amp; Signatures</h2>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        ${remarksCard("TEACHER'S ASSESSMENT", teacherComment, teacherName, 'Class Teacher', color)}
        ${remarksCard("PRINCIPAL'S REMARKS", principalCommentText, principalName, 'Principal', color, accentColor)}
      </div>
    </div>

    ${domainSections}

    <!-- FOOTER -->
    <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#64748b;padding-top:6px;margin-top:auto;border-top:1px solid #e2e8f0">
      <span>Next Term Begins: <span style="font-weight:600;color:${color}">${esc(nextTermDate)}</span></span>
      <span style="font-size:7px;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;font-weight:600">SKOOLAR · ACADEMIC MANAGEMENT SYSTEM</span>
      <span>Generated: <span style="font-weight:500;color:#374151">${esc(generatedDate)}</span></span>
    </div>

  </div>
</div>
</body>
</html>`;
}

function field(label: string, value: string): string {
  return `<div>
    <div style="display:flex;align-items:center;gap:3px;font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
      ${label}
    </div>
    <div style="font-size:11px;font-weight:600;color:#111827;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${value}</div>
  </div>`;
}

function statCard(label: string, value: string, sub: string, color: string, cardColor: string): string {
  return `<div style="border:1px solid #e2e8f0;border-radius:12px;padding:8px 10px;background:#fff;display:flex;align-items:center;justify-content:center;gap:8px">
    <div style="flex-shrink:0;width:20px;height:20px;display:flex;align-items:center;justify-content:center">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${cardColor}" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
    </div>
    <div style="min-width:0;flex:1">
      <p style="font-size:9px;color:#6b7280;letter-spacing:0.05em;text-transform:uppercase;font-weight:600;line-height:1.2;margin:0">${label}</p>
      <p style="font-size:16px;font-weight:700;line-height:1.2;margin:0;color:${cardColor}">${value}</p>
      <p style="font-size:8px;color:#9ca3af;line-height:1.2;margin:0">${sub}</p>
    </div>
  </div>`;
}

function attRow(label: string, value: string, color: string): string {
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0">
    <span style="font-size:10px;color:#64748b">${label}</span>
    <span style="font-size:12px;font-weight:700;color:${color}">${value}</span>
  </div>`;
}

function remarksCard(title: string, comment: string, name: string, role: string, color: string, accentColor?: string): string {
  const ac = accentColor || color;
  return `<div style="border:1px solid #e2e8f0;border-radius:12px;background:#fff;display:flex;flex-direction:column">
    <div style="border-radius:12px 12px 0 0;padding:6px 12px 4px;background:${color}08">
      <div style="display:flex;align-items:center;gap:4px">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <span style="font-size:10px;font-weight:700;letter-spacing:0.025em;color:#111827">${title}</span>
      </div>
      <div style="height:1px;background:${color}15;margin-top:3px"></div>
    </div>
    <div style="padding:8px 12px;flex:1;display:flex;flex-direction:column;gap:2px">
      <p style="font-size:11px;color:#475569;line-height:1.4;margin:0;min-height:36px">${esc(comment)}</p>
      <div style="border-top:1px solid #e2e8f0;padding-top:4px;margin-top:auto">
        <p style="font-size:10px;font-weight:600;color:#111827;margin:0">${esc(name)}</p>
        <p style="font-size:8px;color:#6b7280;margin:0;text-transform:uppercase;letter-spacing:0.025em">${esc(role)}</p>
      </div>
    </div>
  </div>`;
}

function buildDomainHtml(dg: NonNullable<ReportCardPdfInput['domainGrade']>, color: string): string {
  const cog = dg.cognitive || {};
  const psy = dg.psychomotor || {};
  const aff = dg.affective || {};

  function domainTable(title: string, skills: { label: string; value?: string | null; isAverage?: boolean }[], color: string): string {
    return `<div style="border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc">
      <div style="border-radius:8px 8px 0 0;padding:5px 8px 3px;background:${color}08">
        <h5 style="font-size:9px;font-weight:700;text-align:center;text-transform:uppercase;letter-spacing:0.025em;margin:0;color:${color}">${title}</h5>
      </div>
      <div style="padding:4px 6px">${skills.map(s => {
        const isAvg = s.isAverage;
        const val = s.value;
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:2px 4px;font-size:9px;${isAvg ? 'font-weight:700;border-top:1px solid #e2e8f0;margin-top:2px;padding-top:3px;' : ''}${isAvg ? `color:${color}` : ''}">
          <span style="color:#374151">${esc(s.label)}</span>
          ${val ? `<span style="display:inline-block;padding:1px 4px;border-radius:4px;font-size:8px;font-weight:700;border:1px solid;white-space:nowrap;${ratingBadge(val)}">${esc(ratingLabel(val))} (${esc(val)})</span>` : '<span style="color:#d1d5db">—</span>'}
        </div>`;
      }).join('')}</div>
    </div>`;
  }

  return `<div>
    <div style="display:flex;align-items:center;gap:4px;margin-bottom:6px">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      <h2 style="font-size:13px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#111827;margin:0">Affective, Psychomotor &amp; Cognitive Domain</h2>
    </div>
    <div style="border:1px solid #e2e8f0;border-radius:12px;background:#fff;padding:4px 6px">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px">
        ${domainTable('COGNITIVE', [
          { label: 'Reasoning', value: cog.reasoning },
          { label: 'Memory', value: cog.memory },
          { label: 'Concentration', value: cog.concentration },
          { label: 'Problem Solving', value: cog.problemSolving },
          { label: 'Initiative', value: cog.initiative },
          { label: 'Average', value: cog.average, isAverage: true },
        ], color)}
        ${domainTable('PSYCHOMOTOR', [
          { label: 'Handwriting', value: psy.handwriting },
          { label: 'Sports', value: psy.sports },
          { label: 'Drawing', value: psy.drawing },
          { label: 'Practical', value: psy.practical },
          { label: 'Average', value: psy.average, isAverage: true },
        ], color)}
        ${domainTable('AFFECTIVE', [
          { label: 'Punctuality', value: aff.punctuality },
          { label: 'Neatness', value: aff.neatness },
          { label: 'Honesty', value: aff.honesty },
          { label: 'Leadership', value: aff.leadership },
          { label: 'Cooperation', value: aff.cooperation },
          { label: 'Attentiveness', value: aff.attentiveness },
          { label: 'Obedience', value: aff.obedience },
          { label: 'Self Control', value: aff.selfControl },
          { label: 'Politeness', value: aff.politeness },
          { label: 'Average', value: aff.average, isAverage: true },
        ], color)}
      </div>
    </div>
  </div>`;
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

    // Extra settle time for Tailwind CDN processing and font loading
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
