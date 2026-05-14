function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

interface SchoolInfo {
  name: string;
  logo: string | null;
  motto: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  primaryColor: string;
  secondaryColor: string;
}

interface SchoolSettingsInfo {
  principalName: string | null;
  academicSession: string | null;
  nextTermBegins: string | null;
}

interface CandidateInfo {
  applicantName: string;
  applicantEmail: string | null;
  applicantPhone: string | null;
  appliedClass: string | null;
  finalScore: number | null;
  admittedAt: Date | null;
}

interface ApplicantInfo {
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string | null;
  jobTitle: string;
  department: string | null;
  hiredAt: Date | null;
  offeredSalary: number | null;
}

function generateReference(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'ADM-';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function buildLetterHtml(
  school: SchoolInfo,
  settings: SchoolSettingsInfo,
  title: string,
  date: Date,
  reference: string,
  recipientName: string,
  salutation: string,
  bodySections: string[],
  closingNote: string,
  includeEnrollment: boolean,
): string {
  const primaryColor = school.primaryColor || '#059669';
  const secondaryColor = school.secondaryColor || '#10B981';

  const enrollmentSection = includeEnrollment ? `
    <div style="margin-top:1.5rem;padding:1rem;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px">
      <h3 style="color:#15803d;font-size:1rem;margin-bottom:0.75rem;font-weight:700">Enrollment Confirmation</h3>
      <p style="font-size:0.9rem;color:#333;margin-bottom:0.5rem">To confirm your admission, please complete the following steps:</p>
      <ol style="margin-left:1.25rem;font-size:0.85rem;color:#555;line-height:1.8">
        <li>Sign and return the attached acceptance letter within <strong>14 days</strong> of the date of this letter.</li>
        <li>Submit all required documents (birth certificate, previous school reports, medical records).</li>
        <li>Pay the acceptance fee as outlined in the fee structure.</li>
        <li>Attend the orientation program scheduled for the start of the academic session.</li>
        <li>Complete the online registration form via the school portal.</li>
      </ol>
      <p style="font-size:0.85rem;color:#666;margin-top:0.5rem;font-style:italic">
        Failure to complete these steps within the stipulated time may result in the offer being withdrawn.
      </p>
    </div>
  ` : ''

  const salarySection = ''; // Salary not shown by default

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      padding: 2rem;
      line-height: 1.7;
      color: #333;
      font-size: 14px;
    }
    @media print {
      body { padding: 0.75in; }
      @page { margin: 0.75in; }
    }
    .letterhead {
      text-align: center;
      padding-bottom: 1.25rem;
      border-bottom: 3px double ${primaryColor};
      margin-bottom: 1.5rem;
    }
    .letterhead h1 {
      color: ${primaryColor};
      font-size: 1.6rem;
      margin: 0.5rem 0 0.25rem;
      font-weight: 700;
    }
    .letterhead .motto {
      color: #888;
      font-style: italic;
      font-size: 0.9rem;
    }
    .letterhead .contact {
      color: #999;
      font-size: 0.8rem;
      margin-top: 0.4rem;
    }
    .ref-line {
      font-size: 0.85rem;
      color: #666;
      margin-bottom: 0.75rem;
    }
    .date-line {
      text-align: right;
      font-size: 0.95rem;
      margin-bottom: 1.5rem;
      color: #555;
    }
    .salutation {
      font-size: 1rem;
      margin-bottom: 1rem;
      font-weight: 500;
    }
    .body-text {
      font-size: 0.95rem;
      line-height: 1.8;
      color: #444;
    }
    .body-text p {
      margin-bottom: 0.75rem;
    }
    .signature-area {
      margin-top: 2.5rem;
      padding-top: 1rem;
    }
    .signature-line {
      margin-top: 0.5rem;
      font-weight: 600;
      color: ${primaryColor};
    }
    .signature-title {
      font-size: 0.85rem;
      color: #888;
    }
    .footer-note {
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 0.8rem;
      color: #aaa;
      font-style: italic;
    }
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%,-50%) rotate(-30deg);
      opacity: 0.025;
      font-size: 6rem;
      font-weight: 900;
      color: ${primaryColor};
      white-space: nowrap;
      pointer-events: none;
      z-index: -1;
    }
  </style>
</head>
<body>
    <div class="watermark">Skoolar</div>

  <div class="letterhead">
    ${school.logo ? `<img src="${escapeHtml(school.logo)}" alt="School Logo" style="height:70px;margin-bottom:0.5rem" />` : ''}
    <h1>${escapeHtml(school.name)}</h1>
    ${school.motto ? `<p class="motto">${escapeHtml(school.motto)}</p>` : ''}
    <p class="contact">
      ${school.address ? escapeHtml(school.address) : ''}
      ${school.phone ? ` | ${escapeHtml(school.phone)}` : ''}
      ${school.email ? ` | ${escapeHtml(school.email)}` : ''}
    </p>
  </div>

  <div class="ref-line">Ref: ${reference}</div>
  <div class="date-line">Date: ${formatDate(date)}</div>

  <div class="salutation">${escapeHtml(salutation)},</div>

  <div class="body-text">
    ${bodySections.map(s => `<p>${s}</p>`).join('')}
  </div>

  ${enrollmentSection}

  <div class="body-text" style="margin-top:1rem">
    <p>${closingNote}</p>
  </div>

  <div class="signature-area">
    <div style="border-top:1px solid ${primaryColor};width:250px;margin-bottom:0.5rem"></div>
    <div class="signature-line">${settings.principalName ? escapeHtml(settings.principalName) : 'Principal'}</div>
    <div class="signature-title">Principal, ${escapeHtml(school.name)}</div>
  </div>

  ${settings.academicSession ? `<div style="margin-top:1rem;font-size:0.85rem;color:#888;text-align:center">Academic Session: ${escapeHtml(settings.academicSession)}</div>` : ''}

  <div class="footer-note">
    This letter was generated by Skoolar on ${formatDate(new Date())}. Reference: ${reference}
    <p style="margin-top:0.5rem;font-size:0.75rem;color:#ccc;font-style:italic">Skoolar - Odebunmi Tawwāb</p>
  </div>
</body>
</html>`;
}

export function generateStudentAdmissionLetter(
  school: SchoolInfo,
  settings: SchoolSettingsInfo,
  candidate: CandidateInfo,
  customTheme?: { primaryColor?: string; secondaryColor?: string },
): string {
  const mergedSchool = {
    ...school,
    ...(customTheme?.primaryColor && { primaryColor: customTheme.primaryColor }),
    ...(customTheme?.secondaryColor && { secondaryColor: customTheme.secondaryColor }),
  };

  const reference = generateReference();
  const now = new Date();
  const appliedClass = candidate.appliedClass || 'the designated class';
  const scoreInfo = candidate.finalScore != null
    ? ` based on your performance in the entrance examination (Score: ${candidate.finalScore}%)`
    : '';
  const sessionStr = settings.academicSession ? ` for the ${settings.academicSession} academic session` : '';

  const bodySections = [
    `We are pleased to inform you that after a careful review of your application${scoreInfo}, you have been offered provisional admission into <strong>${escapeHtml(mergedSchool.name)}</strong>${sessionStr}.`,
    `You have been admitted into <strong>${escapeHtml(appliedClass)}</strong>. Your admission is subject to the successful completion of the enrollment procedures outlined below.`,
    `The management and staff of ${escapeHtml(mergedSchool.name)} warmly welcome you and look forward to having you as part of our academic community. We are committed to providing you with a supportive and enriching educational experience.`,
  ];

  if (settings.nextTermBegins) {
    bodySections.push(`The next term begins on <strong>${escapeHtml(settings.nextTermBegins)}</strong>. Please ensure you complete all enrollment formalities before this date.`);
  }

  return buildLetterHtml(
    mergedSchool,
    settings,
    'Admission Offer Letter',
    now,
    reference,
    candidate.applicantName,
    `Dear ${candidate.applicantName}`,
    bodySections,
    'We look forward to welcoming you to our school community. Congratulations on your admission!',
    true,
  );
}

export function generateStaffOfferLetter(
  school: SchoolInfo,
  settings: SchoolSettingsInfo,
  applicant: ApplicantInfo,
  showSalary: boolean,
  customTheme?: { primaryColor?: string; secondaryColor?: string },
): string {
  const mergedSchool = {
    ...school,
    ...(customTheme?.primaryColor && { primaryColor: customTheme.primaryColor }),
    ...(customTheme?.secondaryColor && { secondaryColor: customTheme.secondaryColor }),
  };

  const reference = generateReference().replace('ADM', 'OFL');
  const now = new Date();
  const departmentStr = applicant.department ? ` in the ${escapeHtml(applicant.department)} Department` : '';
  const sessionStr = settings.academicSession ? ` for the ${settings.academicSession} academic session` : '';

  const bodySections = [
    `We are delighted to offer you the position of <strong>${escapeHtml(applicant.jobTitle)}</strong>${departmentStr} at <strong>${escapeHtml(mergedSchool.name)}</strong>${sessionStr}.`,
    `After a thorough review of your application and interview performance, we were impressed with your qualifications and believe you will be a valuable addition to our team.`,
    `Your appointment will commence on a date to be mutually agreed upon. Please find below the key terms of your offer:`,
  ];

  if (showSalary && applicant.offeredSalary != null) {
    bodySections.push(
      `The remuneration package for this position includes a salary of <strong>₦${applicant.offeredSalary.toLocaleString()}</strong> per annum, subject to applicable deductions and statutory contributions.`,
    );
  }

  if (settings.nextTermBegins) {
    bodySections.push(`We would appreciate it if you could confirm your acceptance of this offer and your availability to resume duties before <strong>${escapeHtml(settings.nextTermBegins)}</strong>.`);
  }

  return buildLetterHtml(
    mergedSchool,
    settings,
    'Offer of Employment',
    now,
    reference,
    applicant.applicantName,
    `Dear ${applicant.applicantName}`,
    bodySections,
    'We look forward to a mutually beneficial working relationship. Welcome to the team!',
    false,
  );
}

export function openPrintWindow(html: string): void {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow popups to print the letter.');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    setTimeout(() => {
      win.print();
    }, 400);
  };
}
