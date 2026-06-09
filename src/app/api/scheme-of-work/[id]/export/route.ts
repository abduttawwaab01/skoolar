import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const scheme = await db.schemeOfWork.findFirst({
      where: { id, deletedAt: null },
      include: {
        school: { select: { name: true, logo: true, motto: true, address: true, primaryColor: true, secondaryColor: true } },
        class: { select: { name: true, section: true } },
        subject: { select: { name: true, code: true } },
        term: { select: { name: true, order: true, startDate: true, endDate: true } },
        academicYear: { select: { name: true } },
        entries: { orderBy: { weekNumber: 'asc' } },
      },
    });

    if (!scheme) {
      return NextResponse.json({ error: 'Scheme of work not found' }, { status: 404 });
    }

    const primaryColor = scheme.school.primaryColor || '#059669';

    const statusBadge = (status: string) => {
      const colors: Record<string, string> = {
        pending: '#F59E0B',
        in_progress: '#3B82F6',
        completed: '#10B981',
      };
      return `<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;color:white;background:${colors[status] || '#6B7280'}">${status.replace('_', ' ')}</span>`;
    };

    const rowsHtml = scheme.entries.map((entry) => `
      <tr>
        <td style="padding:8px 10px;border:1px solid #ddd;text-align:center;font-weight:600;color:#333">Week ${entry.weekNumber}</td>
        <td style="padding:8px 10px;border:1px solid #ddd">
          <div style="font-weight:600;color:#333">${escapeHtml(entry.topic || '-')}</div>
          ${entry.subTopic ? `<div style="font-size:12px;color:#666;margin-top:2px">${escapeHtml(entry.subTopic)}</div>` : ''}
        </td>
        <td style="padding:8px 10px;border:1px solid #ddd;font-size:13px;color:#555">${escapeHtml(entry.learningObjectives || '-')}</td>
        <td style="padding:8px 10px;border:1px solid #ddd;font-size:13px;color:#555">${escapeHtml(entry.teachingActivities || '-')}</td>
        <td style="padding:8px 10px;border:1px solid #ddd;font-size:13px;color:#555">${escapeHtml(entry.learningActivities || '-')}</td>
        <td style="padding:8px 10px;border:1px solid #ddd;font-size:13px;color:#555">${escapeHtml(entry.resources || '-')}</td>
        <td style="padding:8px 10px;border:1px solid #ddd;font-size:13px;color:#555">${escapeHtml(entry.assessmentMethod || '-')}</td>
        <td style="padding:8px 10px;border:1px solid #ddd;text-align:center">${statusBadge(entry.status)}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${scheme.subject.name} - Scheme of Work</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      padding: 2rem;
      line-height: 1.6;
      color: #333;
      font-size: 14px;
    }
    @media print {
      body { padding: 0.5in; }
      @page { margin: 0.5in; }
    }
    .header { text-align: center; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 3px solid ${primaryColor}; }
    .header h1 { color: ${primaryColor}; font-size: 1.8rem; margin-bottom: 0.25rem; }
    .header .motto { color: #888; font-style: italic; font-size: 0.9rem; }
    .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; margin-bottom: 2rem; }
    .meta-item { padding: 0.75rem; background: #f9fafb; border-radius: 8px; border-left: 4px solid ${primaryColor}; }
    .meta-item label { font-size: 0.75rem; color: #888; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
    .meta-item div { font-size: 0.95rem; font-weight: 500; color: #333; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 13px; }
    th { background: ${primaryColor}; color: white; padding: 10px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 8px 10px; border: 1px solid #e5e7eb; vertical-align: top; }
    tr:nth-child(even) { background: #f9fafb; }
    .footer { text-align: center; margin-top: 2rem; padding-top: 1rem; border-top: 2px solid #e5e7eb; font-size: 0.8rem; color: #999; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-30deg); opacity: 0.03; font-size: 6rem; font-weight: 900; color: ${primaryColor}; white-space: nowrap; pointer-events: none; z-index: -1; }
  </style>
</head>
<body>
    <div class="watermark">${escapeHtml(scheme.school.name)}</div>

  <div class="header">
    ${scheme.school.logo ? `<img src="${escapeHtml(scheme.school.logo)}" alt="School Logo" style="height:60px;margin-bottom:0.75rem" />` : ''}
    <h1>${escapeHtml(scheme.school.name)}</h1>
    ${scheme.school.motto ? `<p class="motto">${escapeHtml(scheme.school.motto)}</p>` : ''}
    ${scheme.school.address ? `<p style="color:#888;font-size:0.85rem;margin-top:0.25rem">${escapeHtml(scheme.school.address)}</p>` : ''}
    <h2 style="color:#333;margin-top:1rem;font-size:1.3rem">Scheme of Work</h2>
  </div>

  <div class="meta-grid">
    <div class="meta-item"><label>Subject</label><div>${escapeHtml(scheme.subject.name)}${scheme.subject.code ? ` (${escapeHtml(scheme.subject.code)})` : ''}</div></div>
    <div class="meta-item"><label>Class</label><div>${escapeHtml(scheme.class.name)}${scheme.class.section ? ` - ${escapeHtml(scheme.class.section)}` : ''}</div></div>
    <div class="meta-item"><label>Term</label><div>${escapeHtml(scheme.term.name)}</div></div>
    <div class="meta-item"><label>Academic Year</label><div>${escapeHtml(scheme.academicYear.name)}</div></div>
    <div class="meta-item"><label>Duration</label><div>${new Date(scheme.term.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} - ${new Date(scheme.term.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div></div>
    <div class="meta-item"><label>Total Weeks</label><div>${scheme.entries.length}</div></div>
  </div>

  ${scheme.description ? `<div style="margin-bottom:1.5rem;padding:1rem;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0"><strong style="color:#15803d">Description:</strong> ${escapeHtml(scheme.description)}</div>` : ''}

  <table>
    <thead>
      <tr>
        <th style="width:70px">Week</th>
        <th style="min-width:180px">Topic / Sub-Topic</th>
        <th style="min-width:160px">Learning Objectives</th>
        <th style="min-width:160px">Teaching Activities</th>
        <th style="min-width:160px">Learning Activities</th>
        <th style="min-width:140px">Resources</th>
        <th style="min-width:140px">Assessment</th>
        <th style="width:90px">Status</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="footer">
    <p>Generated by Skoolar on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
    <p style="margin-top:0.25rem">${escapeHtml(scheme.school.name)} — ${escapeHtml(scheme.school.motto || 'Excellence in Education')}</p>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="scheme-of-work-${scheme.subject.name.toLowerCase().replace(/\s+/g, '-')}-${scheme.term.name.toLowerCase().replace(/\s+/g, '-')}.html"`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
