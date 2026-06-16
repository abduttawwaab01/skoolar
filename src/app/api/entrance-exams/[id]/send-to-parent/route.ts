import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { requireAuth } from '@/lib/auth-middleware';
import { generateWhatsAppUrl, formatPhoneForWhatsApp } from '@/lib/whatsapp';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;

    const exam = await db.entranceExam.findUnique({
      where: { id },
      include: {
        school: { select: { name: true } },
        attempts: { orderBy: { submittedAt: 'desc' } },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: 'Entrance exam not found' }, { status: 404 });
    }

    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && exam.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'http://localhost:3000';
    const schoolName = exam.school?.name || 'School';
    let totalSent = 0;
    let totalFailed = 0;
    const allWhatsAppUrls: { name: string; phone: string; url: string }[] = [];

    for (const attempt of exam.attempts) {
      const applicantName = attempt.applicantName;
      const viewUrl = `${baseUrl}/entrance?code=${exam.code}&attemptId=${attempt.id}`;
      const score = attempt.finalScore !== null ? `${attempt.finalScore}/${exam.totalMarks}` : 'Not graded';
      const status = attempt.status;

      // Send to applicant's email if available
      if (attempt.applicantEmail) {
        const subject = `Entrance Exam Result - ${exam.title}`;
        const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;padding:20px;max-width:600px;margin:0 auto">
<div style="background:#059669;padding:24px;text-align:center;border-radius:8px 8px 0 0">
<h1 style="color:white;margin:0;font-size:22px">${schoolName}</h1></div>
<div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
<p style="font-size:16px;color:#333">Dear ${applicantName},</p>
<p style="font-size:14px;color:#555;line-height:1.6">
Your entrance exam result for <strong>${exam.title}</strong> is available.</p>
<div style="background:#f9fafb;border-radius:8px;padding:16px;margin:20px 0;text-align:center">
<p style="font-size:24px;font-weight:bold;color:#059669;margin:0">${score}</p>
<p style="font-size:14px;color:#666;margin:4px 0 0">Status: <strong>${status}</strong></p></div>
<div style="text-align:center;margin:24px 0">
<a href="${viewUrl}" style="display:inline-block;background:#059669;color:white;padding:14px 36px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:600">View Result</a></div>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
<p style="font-size:12px;color:#aaa;text-align:center">Sent via Skoolar on behalf of ${schoolName}.</p>
</div></body></html>`;

        const result = await sendEmail({ to: attempt.applicantEmail, subject, html });
        if (result.success) totalSent++;
        else totalFailed++;
      }

      // Generate WhatsApp link for applicant's phone
      if (attempt.applicantPhone) {
        const formattedPhone = formatPhoneForWhatsApp(attempt.applicantPhone);
        if (formattedPhone) {
          const msg = `Dear ${applicantName}, your entrance exam result for "${exam.title}" is ready. Score: ${score}, Status: ${status}. View: ${viewUrl}`;
          const url = generateWhatsAppUrl(formattedPhone, msg);
          allWhatsAppUrls.push({ name: applicantName, phone: formattedPhone, url });
        }
      }
    }

    return NextResponse.json({
      message: `Entrance exam results sent to ${totalSent} applicant(s)${totalFailed > 0 ? ` (${totalFailed} failed)` : ''}`,
      email: { sent: totalSent, failed: totalFailed },
      whatsappUrls: allWhatsAppUrls,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
