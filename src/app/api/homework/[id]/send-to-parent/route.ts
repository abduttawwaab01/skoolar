import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { requireAuth } from '@/lib/auth-middleware';
import { getParentWhatsAppUrls } from '@/lib/whatsapp';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;

    const homework = await db.homework.findUnique({
      where: { id },
      include: {
        subject: { select: { name: true } },
        school: { select: { name: true } },
        submissions: {
          include: {
            student: {
              include: {
                user: { select: { name: true } },
                studentParents: {
                  include: {
                    parent: {
                      include: { user: { select: { name: true, email: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!homework) {
      return NextResponse.json({ error: 'Homework not found' }, { status: 404 });
    }

    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && homework.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'http://localhost:3000';
    const schoolName = homework.school?.name || 'School';
    let totalSent = 0;
    let totalFailed = 0;
    const allWhatsAppUrls: { name: string; phone: string; url: string }[] = [];

    for (const submission of homework.submissions) {
      const studentName = submission.student?.user?.name || 'Student';
      const viewUrl = `${baseUrl}/dashboard?view=homework&id=${id}`;
      const score = submission.score !== null ? `${submission.score}` : 'Not graded';
      const grade = submission.grade || 'N/A';

      const parents = submission.student?.studentParents
        ?.map(sp => ({
          name: sp.parent?.user?.name || 'Parent',
          phone: sp.parent?.phone || null,
          user: { name: sp.parent?.user?.name, email: sp.parent?.user?.email },
        }))
        .filter(p => p.user?.email || p.phone) || [];

      const parentEmails = parents
        .map(p => p.user?.email)
        .filter((e): e is string => !!e);

      const subject = `Homework Result - ${homework.title} - ${studentName}`;
      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;padding:20px;max-width:600px;margin:0 auto">
<div style="background:#059669;padding:24px;text-align:center;border-radius:8px 8px 0 0">
<h1 style="color:white;margin:0;font-size:22px">${schoolName}</h1></div>
<div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
<p style="font-size:16px;color:#333">Dear Parent/Guardian,</p>
<p style="font-size:14px;color:#555;line-height:1.6">
The homework result for <strong>${studentName}</strong> — <strong>${homework.title}</strong>${homework.subject?.name ? ` (${homework.subject.name})` : ''} is available.</p>
<div style="background:#f9fafb;border-radius:8px;padding:16px;margin:20px 0;text-align:center">
<p style="font-size:24px;font-weight:bold;color:#059669;margin:0">${score}</p>
<p style="font-size:14px;color:#666;margin:4px 0 0">Grade: <strong>${grade}</strong></p></div>
<div style="text-align:center;margin:24px 0">
<a href="${viewUrl}" style="display:inline-block;background:#059669;color:white;padding:14px 36px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:600">View Details</a></div>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
<p style="font-size:12px;color:#aaa;text-align:center">Sent via Skoolar on behalf of ${schoolName}.</p>
</div></body></html>`;

      const emailResults = await Promise.allSettled(
        parentEmails.map(email => sendEmail({ to: email, subject, html }))
      );
      totalSent += emailResults.filter(r => r.status === 'fulfilled' && r.value.success).length;
      totalFailed += emailResults.filter(r => r.status === 'rejected' || !r.value.success).length;

      const whatsappMsg = `Dear Parent, ${studentName}'s homework result for "${homework.title}" is ready. Score: ${score}, Grade: ${grade}. View: ${viewUrl}`;
      const urls = getParentWhatsAppUrls(parents, whatsappMsg);
      allWhatsAppUrls.push(...urls);
    }

    return NextResponse.json({
      message: `Homework results sent to ${totalSent} parent(s)${totalFailed > 0 ? ` (${totalFailed} failed)` : ''}`,
      email: { sent: totalSent, failed: totalFailed },
      whatsappUrls: allWhatsAppUrls,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
