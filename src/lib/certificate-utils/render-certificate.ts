import {
  type CertificateRenderData,
  type CertificateDesignState,
  type Orientation,
  A4_DIMENSIONS,
  FOIL_STYLES,
  getGenderPronouns,
} from './types';
import { generateBorder } from './decorative-borders';
import { generatePattern } from './patterns';
import { getFoilCSS, getFontImport } from './export';

function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function resolveTemplateVars(text: string, data: CertificateRenderData): string {
  const pronouns = getGenderPronouns(data.studentName ? '' : undefined);
  let resolved = text
    .replace(/\{\{studentName\}\}/g, esc(data.studentName))
    .replace(/\{\{schoolName\}\}/g, esc(data.schoolName))
    .replace(/\{\{className\}\}/g, esc(data.className))
    .replace(/\{\{admissionNo\}\}/g, esc(data.admissionNo))
    .replace(/\{\{session\}\}/g, esc(data.academicSession))
    .replace(/\{\{term\}\}/g, esc(data.termName))
    .replace(/\{\{grade\}\}/g, esc(data.grade))
    .replace(/\{\{date\}\}/g, esc(data.issueDate))
    .replace(/\{\{principalName\}\}/g, esc(data.principalName || 'Principal'))
    .replace(/\{\{attendance\}\}/g, esc(data.attendance))
    .replace(/\{\{certificateNumber\}\}/g, esc(data.certificateNumber))
    .replace(/\{\{verificationCode\}\}/g, esc(data.verificationCode))
    .replace(/\{\{he\/she\}\}/g, pronouns.subject)
    .replace(/\{\{his\/her\}\}/g, pronouns.possessive)
    .replace(/\{\{him\/her\}\}/g, pronouns.object)
    .replace(/\{\{subject\}\}/g, pronouns.subject)
    .replace(/\{\{possessive\}\}/g, pronouns.possessive)
    .replace(/\{\{object\}\}/g, pronouns.object);
  return resolved;
}

function getFontSizeCss(size: string): string {
  const sizes: Record<string, string> = {
    sm: '11px', md: '14px', lg: '18px', xl: '24px', '2xl': '32px', '3xl': '44px',
  };
  return sizes[size] || '14px';
}

function getTitleFontSizeCss(size: string): string {
  const sizes: Record<string, string> = {
    sm: '18px', md: '24px', lg: '32px', xl: '42px', '2xl': '52px', '3xl': '64px',
  };
  return sizes[size] || '42px';
}

export function renderCertificateHTML(data: CertificateRenderData): string {
  const { design, schoolName, schoolLogo } = data;
  const dims = A4_DIMENSIONS[design.orientation];
  const foilCSS = getFoilCSS(design.foilStyle);
  const foilGradient = FOIL_STYLES[design.foilStyle]?.css || '';
  const fontImport = getFontImport(design.fontFamily);

  const borderSvg = data.borderSvg || generateBorder(
    design.borderStyle, dims.width, dims.height,
    design.colors.border, design.borderWidth
  );

  const patternDef = data.patternSvg || (design.showBackgroundPattern && design.backgroundPattern !== 'none'
    ? generatePattern(design.backgroundPattern, design.colors.primary, 0.5)
    : '');

  const bgGradient = design.backgroundStyle === 'gradient'
    ? `linear-gradient(135deg, ${design.gradientStart || design.colors.bg} 0%, ${design.gradientEnd || design.colors.accent} 100%)`
    : design.colors.bg;

  const bodyFont = getFontSizeCss(design.bodyFontSize);
  const titleFont = getTitleFontSizeCss(design.titleFontSize);
  const headingFont = getFontSizeCss(design.headingFontSize);

  const resolvedTitle = resolveTemplateVars(design.certificateTitle, data);
  const resolvedPurpose = resolveTemplateVars(design.purposeText, data);
  const resolvedCompletion = resolveTemplateVars(design.completionText, data);
  const resolvedHonor = resolveTemplateVars(design.honorText, data);
  const resolvedMessage = resolveTemplateVars(design.customMessage, data);
  const resolvedWatermark = resolveTemplateVars(design.watermarkText, data);

  const mmToPx = (mm: number) => `${mm * 3.78}px`;

  const widthPx = dims.width * 3.78;
  const heightPx = dims.height * 3.78;
  const marginMm = 10;
  const contentWidth = dims.width - marginMm * 2;

  const subjectsHtml = data.subjects && data.subjects.length > 0
    ? `<table class="cert-subjects"><thead><tr><th>Subject</th><th>Score</th><th>Grade</th></tr></thead><tbody>
       ${data.subjects.map(s => `<tr><td>${esc(s.name)}</td><td>${esc(s.score)}</td><td>${esc(s.grade)}</td></tr>`).join('')}
       </tbody></table>`
    : '';

  const hasArt = design.showBorderArt && design.borderStyle !== 'none' && design.borderStyle !== 'solid';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
${fontImport}
.cert-page, .cert-page * { margin: 0; padding: 0; box-sizing: border-box; }
@page { size: ${design.orientation === 'portrait' ? 'A4' : 'A4 landscape'}; margin: 0; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }

.cert-page {
  width: ${widthPx}px;
  min-height: ${heightPx}px;
  position: relative;
  font-family: ${design.fontFamily}, serif;
  background: ${bgGradient};
  color: ${design.colors.text};
  font-size: ${bodyFont};
  line-height: 1.6;
  overflow: hidden;
  page-break-after: always;
}

.cert-inner {
  position: relative;
  z-index: 2;
  padding: ${marginMm * 3.78}px ${marginMm * 3.78}px;
  min-height: ${heightPx}px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.cert-bg-pattern {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  pointer-events: none;
  z-index: 0;
}

.cert-border-svg {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  pointer-events: none;
  z-index: 1;
}

.cert-watermark {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%) rotate(-30deg);
  font-size: 80px;
  font-weight: 900;
  color: ${design.colors.primary};
  opacity: 0.04;
  pointer-events: none;
  z-index: 0;
  white-space: nowrap;
  letter-spacing: 10px;
  font-family: ${design.fontFamily}, serif;
}

/* School Logo */
.cert-logo { margin-bottom: 8px; }
.cert-logo img { max-height: 56px; width: auto; object-fit: contain; }

/* School Name */
.cert-school-name {
  font-size: ${headingFont};
  font-weight: 700;
  color: ${design.colors.primary};
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 4px;
}

/* Decorative divider */
.cert-divider {
  width: ${contentWidth * 0.4}mm;
  height: 2px;
  background: ${foilCSS || design.colors.secondary};
  margin: 8px auto;
  border-radius: 1px;
}

.cert-divider-thin {
  width: ${contentWidth * 0.2}mm;
  height: 1px;
  background: ${design.colors.secondary};
  opacity: 0.4;
  margin: 6px auto;
}

/* Certificate Title */
.cert-title {
  font-size: ${titleFont};
  font-weight: 900;
  letter-spacing: 2px;
  margin: 6px 0;
  text-transform: uppercase;
}

.cert-title-foil {
  background: ${foilGradient || design.colors.secondary};
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Purpose text */
.cert-purpose {
  font-size: ${bodyFont};
  color: ${design.colors.textSecondary};
  margin: 4px 0;
  font-style: italic;
}

/* Student Name */
.cert-student-name {
  font-size: ${Math.round(parseInt(titleFont) * 0.7)}px;
  font-weight: 700;
  color: ${design.colors.primary};
  margin: 8px 0;
  letter-spacing: 1px;
}

.cert-student-name-foil {
  background: ${foilGradient || design.colors.primary};
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Completion text */
.cert-completion {
  font-size: ${bodyFont};
  color: ${design.colors.text};
  margin: 4px 0;
  max-width: ${contentWidth * 0.7}mm;
}

/* Honor text */
.cert-honor {
  font-size: ${headingFont};
  font-weight: 700;
  color: ${design.colors.secondary};
  margin: 6px 0;
  font-style: italic;
}

/* Student details */
.cert-details {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px 20px;
  margin: 8px 0;
  font-size: ${bodyFont};
  color: ${design.colors.textSecondary};
}
.cert-details span { display: inline-flex; align-items: center; gap: 4px; }

/* Student photo */
.cert-student-photo {
  margin: 10px 0;
}
.cert-student-photo img {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid ${design.colors.secondary};
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

/* Custom message */
.cert-message {
  font-size: ${bodyFont};
  font-style: italic;
  color: ${design.colors.textSecondary};
  max-width: ${contentWidth * 0.7}mm;
  margin: 8px auto;
  line-height: 1.8;
}

/* Subjects table */
.cert-subjects {
  width: ${contentWidth * 0.55}mm;
  border-collapse: collapse;
  margin: 10px auto;
  font-size: ${bodyFont};
}
.cert-subjects th {
  background: ${design.colors.primary};
  color: white;
  padding: 4px 10px;
  text-align: left;
  font-weight: 600;
  font-size: 12px;
}
.cert-subjects td {
  padding: 3px 10px;
  border-bottom: 1px solid ${design.colors.accent};
}
.cert-subjects tr:nth-child(even) td { background: rgba(0,0,0,0.02); }

/* Date */
.cert-date {
  font-size: ${bodyFont};
  color: ${design.colors.textSecondary};
  margin: 6px 0;
}

/* Signatures */
.cert-signatures {
  display: flex;
  justify-content: center;
  gap: 60px;
  margin: 20px 0 10px;
  width: ${contentWidth * 0.6}mm;
}
.cert-signature-item {
  text-align: center;
  min-width: 120px;
}
.cert-signature-line {
  width: 140px;
  height: 1px;
  background: ${design.colors.text};
  margin: 0 auto 4px;
}
.cert-signature-label {
  font-size: 11px;
  color: ${design.colors.textSecondary};
  font-weight: 600;
}

/* Seal */
.cert-seal {
  margin: 10px 0;
  opacity: 0.9;
}
.cert-seal svg { width: auto; height: 70px; }

/* QR Code */
.cert-qr {
  position: absolute;
  bottom: ${marginMm * 3}px;
  right: ${marginMm * 3}px;
  text-align: center;
  z-index: 3;
}
.cert-qr img { width: 55px; height: 55px; }
.cert-qr-label {
  font-size: 7px;
  color: ${design.colors.textSecondary};
  margin-top: 2px;
}

/* Footer info */
.cert-footer {
  position: absolute;
  bottom: ${marginMm * 1.5}px;
  left: 0;
  width: 100%;
  text-align: center;
  font-size: 8px;
  color: ${design.colors.textSecondary};
  opacity: 0.6;
  z-index: 3;
  padding: 0 ${marginMm * 3.78}px;
}

.cert-footer span { margin: 0 6px; }

/* Grade display */
.cert-grade-badge {
  display: inline-block;
  padding: 3px 16px;
  border-radius: 20px;
  background: ${foilCSS || design.colors.secondary};
  color: ${design.foilStyle !== 'none' ? '#fff' : '#fff'};
  font-weight: 700;
  font-size: ${headingFont};
  margin: 4px 0;
}

.cert-no-break { page-break-inside: avoid; }
</style>
</head>
<body>
<div class="cert-page">
  ${design.showBackgroundPattern && design.backgroundPattern !== 'none' && patternDef
    ? `<svg class="cert-bg-pattern" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">${patternDef}<rect width="100%" height="100%" fill="url(#cert-bg-pattern)" /></svg>`
    : ''}

  ${design.showBorderArt && design.borderStyle !== 'none'
    ? `<div class="cert-border-svg"><svg width="100%" height="100%" viewBox="0 0 ${dims.width * 3.78} ${dims.height * 3.78}" xmlns="http://www.w3.org/2000/svg">${borderSvg}</svg></div>`
    : ''}

  ${design.showWatermark && resolvedWatermark
    ? `<div class="cert-watermark">${esc(resolvedWatermark)}</div>`
    : ''}

  <div class="cert-inner">
    ${design.showSchoolLogo && schoolLogo
      ? `<div class="cert-logo"><img src="${esc(schoolLogo)}" alt="School Logo" /></div>`
      : ''}

    ${design.showSchoolName
      ? `<div class="cert-school-name">${esc(schoolName)}</div>`
      : ''}

    <div class="cert-divider"></div>

    ${design.showCertificateTitle
      ? `<div class="cert-title ${design.foilStyle !== 'none' ? 'cert-title-foil' : ''}" style="${design.foilStyle === 'none' ? `color: ${design.colors.primary}` : ''}">${esc(resolvedTitle)}</div>`
      : ''}

    <div class="cert-divider-thin"></div>

    ${design.showPurposeText && resolvedPurpose
      ? `<div class="cert-purpose">${esc(resolvedPurpose)}</div>`
      : ''}

    ${design.showStudentPhoto && data.studentPhoto
      ? `<div class="cert-student-photo"><img src="${esc(data.studentPhoto)}" alt="${esc(data.studentName)}" /></div>`
      : ''}

    ${design.showStudentName
      ? `<div class="cert-student-name ${design.foilStyle !== 'none' ? 'cert-student-name-foil' : ''}" style="${design.foilStyle === 'none' ? `color: ${design.colors.primary}` : ''}">${esc(data.studentName)}</div>`
      : ''}

    ${design.showCompletionText && resolvedCompletion
      ? `<div class="cert-completion">${esc(resolvedCompletion)}</div>`
      : ''}

    ${design.showHonorText && resolvedHonor
      ? `<div class="cert-honor">${esc(resolvedHonor)}</div>`
      : ''}

    ${design.showGrade && data.grade
      ? `<div class="cert-grade-badge">${esc(data.grade)}</div>`
      : ''}

    ${design.showStudentDetails
      ? `<div class="cert-details">
          ${data.className ? `<span>📚 ${esc(data.className)}</span>` : ''}
          ${data.admissionNo ? `<span>🎫 ${esc(data.admissionNo)}</span>` : ''}
          ${data.academicSession ? `<span>📅 ${esc(data.academicSession)}</span>` : ''}
          ${data.termName ? `<span>📖 ${esc(data.termName)}</span>` : ''}
          ${design.showAttendance && data.attendance ? `<span>✅ Attendance: ${esc(data.attendance)}</span>` : ''}
        </div>`
      : ''}

    ${design.showSubjects && subjectsHtml
      ? `<div class="cert-no-break">${subjectsHtml}</div>`
      : ''}

    ${design.showCustomMessage && resolvedMessage
      ? `<div class="cert-message">&ldquo;${esc(resolvedMessage)}&rdquo;</div>`
      : ''}

    ${design.showDate
      ? `<div class="cert-date">Issued: ${esc(data.issueDate)}</div>`
      : ''}

    <div class="cert-divider-thin"></div>

    ${(design.showLeftSignature || design.showRightSignature)
      ? `<div class="cert-signatures">
          ${design.showLeftSignature
            ? `<div class="cert-signature-item">
                <div class="cert-signature-line"></div>
                <div class="cert-signature-label">${esc(design.leftSignatureLabel)}</div>
               </div>`
            : ''}
          ${design.showRightSignature
            ? `<div class="cert-signature-item">
                <div class="cert-signature-line"></div>
                <div class="cert-signature-label">${esc(design.rightSignatureLabel)}</div>
               </div>`
            : ''}
        </div>`
      : ''}

    ${design.showSeal
      ? `<div class="cert-seal">
          <svg viewBox="0 0 100 100" width="80" height="80">
            <circle cx="50" cy="50" r="45" fill="none" stroke="${design.colors.secondary}" stroke-width="2" opacity="0.6" />
            <circle cx="50" cy="50" r="40" fill="none" stroke="${design.colors.secondary}" stroke-width="1.5" opacity="0.4" />
            <polygon points="50,15 60,35 82,35 65,50 72,72 50,60 28,72 35,50 18,35 40,35" fill="${design.colors.secondary}" opacity="0.3" />
            <text x="50" y="55" text-anchor="middle" font-size="8" fill="${design.colors.primary}" font-weight="bold">SEAL</text>
            <text x="50" y="65" text-anchor="middle" font-size="5" fill="${design.colors.textSecondary}">SCHOOL</text>
          </svg>
        </div>`
      : ''}
  </div>

  ${design.showQRCode && data.qrCodeDataUrl
    ? `<div class="cert-qr">
        <img src="${esc(data.qrCodeDataUrl)}" alt="Verification QR" />
        <div class="cert-qr-label">Verify</div>
       </div>`
    : ''}

  ${design.showFooter
    ? `<div class="cert-footer">
        ${design.showCertificateNumber ? `<span>No: ${esc(data.certificateNumber)}</span>` : ''}
        ${design.showVerificationCode ? `<span>Code: ${esc(data.verificationCode)}</span>` : ''}
        <span>&copy; ${esc(schoolName)} ${new Date().getFullYear()}</span>
       </div>`
    : ''}
</div>
</body>
</html>`;
}

export function buildCertificateRenderData(
  params: {
    studentName: string;
    studentPhoto?: string;
    className: string;
    admissionNo: string;
    academicSession: string;
    termName: string;
    grade: string;
    attendance: string;
    subjects: { name: string; score: string; grade: string }[];
    schoolName: string;
    schoolLogo?: string;
    schoolAddress: string;
    schoolMotto: string;
    principalName: string;
    design: CertificateDesignState;
    certificateNumber: string;
    verificationCode: string;
    issueDate: string;
    qrCodeDataUrl?: string;
  }
): CertificateRenderData {
  const dims = A4_DIMENSIONS[params.design.orientation];
  return {
    certificateNumber: params.certificateNumber,
    verificationCode: params.verificationCode,
    type: params.design.type,
    studentName: params.studentName,
    studentPhoto: params.studentPhoto,
    className: params.className,
    admissionNo: params.admissionNo,
    academicSession: params.academicSession,
    termName: params.termName,
    grade: params.grade,
    attendance: params.attendance,
    subjects: params.subjects,
    issueDate: params.issueDate,
    schoolName: params.schoolName,
    schoolLogo: params.schoolLogo,
    schoolAddress: params.schoolAddress,
    schoolMotto: params.schoolMotto,
    principalName: params.principalName,
    design: params.design,
    qrCodeDataUrl: params.qrCodeDataUrl,
    foilCss: getFoilCSS(params.design.foilStyle),
    borderSvg: generateBorder(
      params.design.borderStyle,
      dims.width,
      dims.height,
      params.design.colors.border,
      params.design.borderWidth
    ),
    patternSvg: params.design.showBackgroundPattern && params.design.backgroundPattern !== 'none'
      ? generatePattern(params.design.backgroundPattern, params.design.colors.primary, 0.5)
      : '',
    watermarkOpacity: 0.04,
  };
}
