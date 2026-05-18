import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { getParentWhatsAppUrls } from '@/lib/whatsapp';

export interface ParentNotificationResult {
  email: { sent: number; failed: number; recipients: string[] };
  whatsapp: { name: string; phone: string; url: string }[];
}

interface ParentWithContacts {
  id: string;
  phone?: string | null;
  user: { name?: string | null; email?: string | null };
}

async function getStudentParents(studentId: string): Promise<ParentWithContacts[]> {
  const studentParents = await db.studentParent.findMany({
    where: { studentId },
    include: {
      parent: {
        include: {
          user: { select: { name: true, email: true } },
        },
      },
    },
  });
  return studentParents.map(sp => ({
    id: sp.parent.id,
    phone: sp.parent.phone,
    user: {
      name: sp.parent.user.name,
      email: sp.parent.user.email,
    },
  }));
}

function buildReportCardEmailHtml(opts: {
  schoolName: string;
  studentName: string;
  className: string;
  termName: string;
  sessionName: string;
  averageScore: string;
  grade: string;
  gpa: string;
  viewUrl: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8" /></head>
    <body style="font-family:Arial,sans-serif;padding:20px;max-width:600px;margin:0 auto">
      <div style="background:#059669;padding:24px;text-align:center;border-radius:8px 8px 0 0">
        <h1 style="color:white;margin:0;font-size:22px">${opts.schoolName}</h1>
      </div>
      <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <p style="font-size:16px;color:#333">Dear Parent/Guardian,</p>
        <p style="font-size:14px;color:#555;line-height:1.6">
          The report card for <strong>${opts.studentName}</strong> (${opts.className}) for the
          <strong>${opts.termName} - ${opts.sessionName}</strong> is now available.
        </p>
        <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:20px 0">
          <table style="width:100%;font-size:14px">
            <tr><td style="padding:4px 0;color:#666">Average Score</td><td style="padding:4px 0;font-weight:bold">${opts.averageScore}%</td></tr>
            <tr><td style="padding:4px 0;color:#666">Grade</td><td style="padding:4px 0;font-weight:bold">${opts.grade}</td></tr>
            <tr><td style="padding:4px 0;color:#666">GPA</td><td style="padding:4px 0;font-weight:bold">${opts.gpa}</td></tr>
            <tr><td style="padding:4px 0;color:#666">Term</td><td style="padding:4px 0;font-weight:bold">${opts.termName}</td></tr>
            <tr><td style="padding:4px 0;color:#666">Session</td><td style="padding:4px 0;font-weight:bold">${opts.sessionName}</td></tr>
          </table>
        </div>
        <div style="text-align:center;margin:24px 0">
          <a href="${opts.viewUrl}" style="display:inline-block;background:#059669;color:white;padding:14px 36px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:600">
            View Report Card
          </a>
        </div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
        <p style="font-size:12px;color:#aaa;text-align:center">
          This report card was sent via Skoolar Education Management Platform on behalf of ${opts.schoolName}.
        </p>
      </div>
    </body>
    </html>
  `;
}

function buildExamResultEmailHtml(opts: {
  schoolName: string;
  studentName: string;
  examName: string;
  score: number;
  totalMarks: number;
  grade: string;
  viewUrl: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8" /></head>
    <body style="font-family:Arial,sans-serif;padding:20px;max-width:600px;margin:0 auto">
      <div style="background:#059669;padding:24px;text-align:center;border-radius:8px 8px 0 0">
        <h1 style="color:white;margin:0;font-size:22px">${opts.schoolName}</h1>
      </div>
      <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <p style="font-size:16px;color:#333">Dear Parent/Guardian,</p>
        <p style="font-size:14px;color:#555;line-height:1.6">
          The result for <strong>${opts.examName}</strong> for <strong>${opts.studentName}</strong> is now available.
        </p>
        <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:20px 0;text-align:center">
          <p style="font-size:24px;font-weight:bold;color:#059669;margin:0">${opts.score} / ${opts.totalMarks}</p>
          <p style="font-size:14px;color:#666;margin:4px 0 0">Grade: <strong>${opts.grade}</strong></p>
        </div>
        <div style="text-align:center;margin:24px 0">
          <a href="${opts.viewUrl}" style="display:inline-block;background:#059669;color:white;padding:14px 36px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:600">
            View Result
          </a>
        </div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
        <p style="font-size:12px;color:#aaa;text-align:center">
          This result was sent via Skoolar on behalf of ${opts.schoolName}.
        </p>
      </div>
    </body>
    </html>
  `;
}

function buildWeeklyEvaluationEmailHtml(opts: {
  schoolName: string;
  studentName: string;
  className: string;
  viewUrl: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8" /></head>
    <body style="font-family:Arial,sans-serif;padding:20px;max-width:600px;margin:0 auto">
      <div style="background:#059669;padding:24px;text-align:center;border-radius:8px 8px 0 0">
        <h1 style="color:white;margin:0;font-size:22px">${opts.schoolName}</h1>
      </div>
      <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <p style="font-size:16px;color:#333">Dear Parent/Guardian,</p>
        <p style="font-size:14px;color:#555;line-height:1.6">
          A weekly evaluation for <strong>${opts.studentName}</strong> (${opts.className}) has been completed and is now available for review.
        </p>
        <div style="text-align:center;margin:24px 0">
          <a href="${opts.viewUrl}" style="display:inline-block;background:#059669;color:white;padding:14px 36px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:600">
            View Evaluation
          </a>
        </div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
        <p style="font-size:12px;color:#aaa;text-align:center">
          This evaluation was sent via Skoolar on behalf of ${opts.schoolName}.
        </p>
      </div>
    </body>
    </html>
  `;
}

function buildWhatsAppMessage(type: 'report-card' | 'exam-result' | 'weekly-evaluation', opts: Record<string, string>): string {
  switch (type) {
    case 'report-card':
      return `Dear Parent, the report card for ${opts.studentName} (${opts.termName}) is ready. Average: ${opts.averageScore}%, Grade: ${opts.grade}. View: ${opts.viewUrl}`;
    case 'exam-result':
      return `Dear Parent, ${opts.studentName}'s result for ${opts.examName} is ready. Score: ${opts.score}/${opts.totalMarks}, Grade: ${opts.grade}. View: ${opts.viewUrl}`;
    case 'weekly-evaluation':
      return `Dear Parent, the weekly evaluation for ${opts.studentName} is ready. View: ${opts.viewUrl}`;
    default:
      return `Dear Parent, a new update for ${opts.studentName} is available. View: ${opts.viewUrl}`;
  }
}

export async function sendReportCardToParents(
  reportCardId: string,
  baseUrl: string
): Promise<ParentNotificationResult> {
  const reportCard = await db.reportCard.findUnique({
    where: { id: reportCardId },
    include: {
      student: {
        include: {
          user: { select: { name: true } },
          class: { select: { name: true } },
        },
      },
      term: { include: { academicYear: { select: { name: true } } } },
      school: { select: { name: true } },
    },
  });

  if (!reportCard) {
    return { email: { sent: 0, failed: 0, recipients: [] }, whatsapp: [] };
  }

  const studentName = reportCard.student?.user?.name || 'Student';
  const schoolName = reportCard.school?.name || 'School';
  const termName = reportCard.term?.name || '';
  const sessionName = reportCard.term?.academicYear?.name || '';
  const className = reportCard.student?.class?.name || '';
  const gpa = reportCard.gpa?.toFixed(2) || 'N/A';
  const averageScore = reportCard.averageScore?.toFixed(1) || 'N/A';
  const grade = reportCard.grade || 'N/A';

  const viewUrl = `${baseUrl}/dashboard?view=parent-portal&reportCard=${reportCardId}`;

  const parents = await getStudentParents(reportCard.studentId);

  const parentEmails = parents
    .map(p => p.user.email)
    .filter((e): e is string => !!e);

  const emailSubject = `Report Card - ${studentName} - ${termName} ${sessionName}`;
  const emailHtml = buildReportCardEmailHtml({
    schoolName, studentName, className, termName, sessionName,
    averageScore, grade, gpa, viewUrl,
  });

  const emailResults = await Promise.allSettled(
    parentEmails.map(email => sendEmail({ to: email, subject: emailSubject, html: emailHtml }))
  );

  const succeeded = emailResults.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const failed = emailResults.filter(r => r.status === 'rejected' || !r.value.success).length;

  const whatsappMsg = buildWhatsAppMessage('report-card', {
    studentName, termName, averageScore, grade, viewUrl,
  });

  const whatsappUrls = getParentWhatsAppUrls(parents, whatsappMsg);

  return {
    email: { sent: succeeded, failed, recipients: parentEmails },
    whatsapp: whatsappUrls,
  };
}

export async function sendExamResultToParents(
  examId: string,
  studentId: string,
  baseUrl: string
): Promise<ParentNotificationResult> {
  const examScore = await db.examScore.findUnique({
    where: { examId_studentId: { examId, studentId } },
    include: {
      exam: {
        select: { name: true, totalMarks: true, schoolId: true },
      },
      student: {
        include: {
          user: { select: { name: true } },
          school: { select: { name: true } },
        },
      },
    },
  });

  if (!examScore) {
    return { email: { sent: 0, failed: 0, recipients: [] }, whatsapp: [] };
  }

  const studentName = examScore.student?.user?.name || 'Student';
  const schoolName = examScore.student?.school?.name || 'School';
  const examName = examScore.exam?.name || 'Exam';
  const totalMarks = examScore.exam?.totalMarks || 100;
  const score = examScore.score;
  const grade = examScore.grade || 'N/A';

  const viewUrl = `${baseUrl}/results?studentId=${studentId}&examId=${examId}`;

  const parents = await getStudentParents(studentId);

  const parentEmails = parents
    .map(p => p.user.email)
    .filter((e): e is string => !!e);

  const emailSubject = `Result - ${examName} - ${studentName}`;
  const emailHtml = buildExamResultEmailHtml({
    schoolName, studentName, examName, score, totalMarks, grade, viewUrl,
  });

  const emailResults = await Promise.allSettled(
    parentEmails.map(email => sendEmail({ to: email, subject: emailSubject, html: emailHtml }))
  );

  const succeeded = emailResults.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const failed = emailResults.filter(r => r.status === 'rejected' || !r.value.success).length;

  const whatsappMsg = buildWhatsAppMessage('exam-result', {
    studentName, examName, score: String(score), totalMarks: String(totalMarks), grade, viewUrl,
  });

  const whatsappUrls = getParentWhatsAppUrls(parents, whatsappMsg);

  return {
    email: { sent: succeeded, failed, recipients: parentEmails },
    whatsapp: whatsappUrls,
  };
}

export async function sendWeeklyEvaluationToParents(
  studentId: string,
  evaluationId: string,
  baseUrl: string
): Promise<ParentNotificationResult> {
  const evaluation = await db.weeklyEvaluation.findUnique({
    where: { id: evaluationId },
    include: {
      student: {
        include: {
          user: { select: { name: true } },
          class: { select: { name: true } },
          school: { select: { name: true } },
        },
      },
    },
  });

  if (!evaluation) {
    return { email: { sent: 0, failed: 0, recipients: [] }, whatsapp: [] };
  }

  const studentName = evaluation.student?.user?.name || 'Student';
  const schoolName = evaluation.student?.school?.name || 'School';
  const className = evaluation.student?.class?.name || '';

  const viewUrl = `${baseUrl}/dashboard?view=parent-portal&evaluation=${evaluationId}`;

  const parents = await getStudentParents(studentId);

  const parentEmails = parents
    .map(p => p.user.email)
    .filter((e): e is string => !!e);

  const emailSubject = `Weekly Evaluation - ${studentName}`;
  const emailHtml = buildWeeklyEvaluationEmailHtml({
    schoolName, studentName, className, viewUrl,
  });

  const emailResults = await Promise.allSettled(
    parentEmails.map(email => sendEmail({ to: email, subject: emailSubject, html: emailHtml }))
  );

  const succeeded = emailResults.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const failed = emailResults.filter(r => r.status === 'rejected' || !r.value.success).length;

  const whatsappMsg = buildWhatsAppMessage('weekly-evaluation', {
    studentName, viewUrl,
  });

  const whatsappUrls = getParentWhatsAppUrls(parents, whatsappMsg);

  return {
    email: { sent: succeeded, failed, recipients: parentEmails },
    whatsapp: whatsappUrls,
  };
}
