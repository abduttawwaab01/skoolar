import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { requireAuth } from '@/lib/auth-middleware';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const reportCard = await db.reportCard.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            user: { select: { name: true } },
            class: { select: { name: true } },
            studentParents: {
              include: {
                parent: {
                  include: { user: { select: { name: true, email: true } } },
                },
              },
            },
          },
        },
        term: { include: { academicYear: { select: { name: true } } } },
        school: { select: { name: true } },
      },
    });

    if (!reportCard) {
      return NextResponse.json({ error: 'Report card not found' }, { status: 404 });
    }

    // School isolation
    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && reportCard.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const studentName = reportCard.student?.user?.name || 'Student';
    const schoolName = reportCard.school?.name || 'School';
    const termName = reportCard.term?.name || '';
    const sessionName = reportCard.term?.academicYear?.name || '';
    const className = reportCard.student?.class?.name || '';
    const gpa = reportCard.gpa?.toFixed(2) || 'N/A';
    const average = reportCard.averageScore?.toFixed(1) || 'N/A';
    const grade = reportCard.grade || 'N/A';

    // Get parent emails
    const parentEmails = reportCard.student?.studentParents
      ?.map(sp => sp.parent?.user?.email)
      .filter(Boolean) as string[] | undefined;

    if (!parentEmails || parentEmails.length === 0) {
      return NextResponse.json({ error: 'No parent email found for this student' }, { status: 404 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'http://localhost:3000';
    const viewUrl = `${baseUrl}/dashboard?view=parent-portal&reportCard=${id}`;

    const subject = `Report Card - ${studentName} - ${termName} ${sessionName}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8" /></head>
      <body style="font-family:Arial,sans-serif;padding:20px;max-width:600px;margin:0 auto">
        <div style="background:#059669;padding:24px;text-align:center;border-radius:8px 8px 0 0">
          <h1 style="color:white;margin:0;font-size:22px">${schoolName}</h1>
        </div>
        <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
          <p style="font-size:16px;color:#333">Dear Parent/Guardian,</p>
          <p style="font-size:14px;color:#555;line-height:1.6">
            The report card for <strong>${studentName}</strong> (${className}) for the
            <strong>${termName} - ${sessionName}</strong> is now available.
          </p>

          <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:20px 0">
            <table style="width:100%;font-size:14px">
              <tr><td style="padding:4px 0;color:#666">Average Score</td><td style="padding:4px 0;font-weight:bold">${average}%</td></tr>
              <tr><td style="padding:4px 0;color:#666">Grade</td><td style="padding:4px 0;font-weight:bold">${grade}</td></tr>
              <tr><td style="padding:4px 0;color:#666">GPA</td><td style="padding:4px 0;font-weight:bold">${gpa}</td></tr>
              <tr><td style="padding:4px 0;color:#666">Term</td><td style="padding:4px 0;font-weight:bold">${termName}</td></tr>
              <tr><td style="padding:4px 0;color:#666">Session</td><td style="padding:4px 0;font-weight:bold">${sessionName}</td></tr>
            </table>
          </div>

          <div style="text-align:center;margin:24px 0">
            <a href="${viewUrl}" style="display:inline-block;background:#059669;color:white;padding:14px 36px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:600">
              View Report Card
            </a>
          </div>

          <p style="font-size:13px;color:#888;line-height:1.5">
            You can also download the PDF report card by clicking the button above and using the download option.
          </p>

          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
          <p style="font-size:12px;color:#aaa;text-align:center">
            This report card was sent via Skoolar Education Management Platform on behalf of ${schoolName}.
          </p>
        </div>
      </body>
      </html>
    `;

    const results = await Promise.allSettled(
      parentEmails.map(email =>
        sendEmail({ to: email, subject, html })
      )
    );

    const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || !r.value.success).length;

    return NextResponse.json({
      message: `Report card sent to ${succeeded} parent(s)${failed > 0 ? ` (${failed} failed)` : ''}`,
      sent: succeeded,
      failed,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
