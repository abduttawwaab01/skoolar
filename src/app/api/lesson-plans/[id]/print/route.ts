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

    const plan = await db.lessonPlan.findFirst({
      where: { id },
      include: {
        school: { select: { name: true, logo: true, motto: true, address: true, primaryColor: true, secondaryColor: true } },
        subject: { select: { name: true, code: true } },
        class: { select: { name: true, section: true } },
      },
    });

    if (!plan) {
      return NextResponse.json({ error: 'Lesson plan not found' }, { status: 404 });
    }

    const primaryColor = plan.school.primaryColor || '#059669';
    const content = plan.content || '';
    const objectives = plan.objectives || '';
    const activities = plan.activities || '';
    const resources = plan.resources || '';
    const hasQuiz = plan.quiz ? (() => { try { const q = JSON.parse(plan.quiz!); return Array.isArray(q) && q.length > 0; } catch { return false; } })() : false;

    function mdToHtml(text: string): string {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/### (.+)/g, '<h3>$1</h3>')
        .replace(/## (.+)/g, '<h2>$1</h2>')
        .replace(/# (.+)/g, '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/^- (.+)/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)/g, '<ul>$1</ul>')
        .replace(/<\/ul>\n<ul>/g, '\n')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br />');
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(plan.topic)} - Lesson Note</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      padding: 2rem;
      line-height: 1.8;
      color: #333;
      font-size: 14px;
    }
    @media print {
      body { padding: 0.5in; }
      @page { margin: 0.5in; }
    }
    .header {
      text-align: center; margin-bottom: 2rem; padding-bottom: 1.5rem;
      border-bottom: 3px solid ${primaryColor};
    }
    .header h1 { color: ${primaryColor}; font-size: 1.6rem; margin-bottom: 0.25rem; }
    .header .motto { color: #888; font-style: italic; font-size: 0.9rem; }
    .meta-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 0.75rem; margin-bottom: 1.5rem;
    }
    .meta-item {
      padding: 0.6rem 0.75rem; background: #f9fafb; border-radius: 6px;
      border-left: 4px solid ${primaryColor};
    }
    .meta-item label { font-size: 0.7rem; color: #888; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
    .meta-item div { font-size: 0.9rem; font-weight: 500; color: #333; margin-top: 2px; }
    .section {
      margin-bottom: 1.25rem; padding: 1rem; border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    .section h2 {
      font-size: 1rem; color: ${primaryColor}; margin-bottom: 0.75rem;
      padding-bottom: 0.4rem; border-bottom: 2px solid #e5e7eb;
    }
    .section p, .section li { font-size: 0.9rem; color: #444; }
    .section ul { padding-left: 1.5rem; }
    .section ul li { margin-bottom: 0.25rem; }
    .badge-quiz {
      display: inline-block; padding: 2px 10px; border-radius: 12px;
      font-size: 11px; font-weight: 600; color: white; background: ${primaryColor};
    }
    .footer {
      text-align: center; margin-top: 2rem; padding-top: 1rem;
      border-top: 2px solid #e5e7eb; font-size: 0.8rem; color: #999;
    }
    .watermark {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-30deg);
      opacity: 0.03; font-size: 6rem; font-weight: 900; color: ${primaryColor};
      white-space: nowrap; pointer-events: none; z-index: -1;
    }
  </style>
</head>
<body>
  <div class="watermark">${escapeHtml(plan.school.name)}</div>

  <div class="header">
    ${plan.school.logo ? `<img src="${escapeHtml(plan.school.logo)}" alt="School Logo" style="height:50px;margin-bottom:0.5rem" />` : ''}
    <h1>${escapeHtml(plan.school.name)}</h1>
    ${plan.school.motto ? `<p class="motto">${escapeHtml(plan.school.motto)}</p>` : ''}
    ${plan.school.address ? `<p style="color:#888;font-size:0.8rem;margin-top:0.25rem">${escapeHtml(plan.school.address)}</p>` : ''}
    <h2 style="color:#333;margin-top:0.75rem;font-size:1.1rem">Lesson Note</h2>
  </div>

  <div class="meta-grid">
    <div class="meta-item"><label>Subject</label><div>${escapeHtml(plan.subject?.name || 'N/A')}${plan.subject?.code ? ` (${escapeHtml(plan.subject.code)})` : ''}</div></div>
    <div class="meta-item"><label>Class</label><div>${escapeHtml(plan.class?.name || 'N/A')}${plan.class?.section ? ` - ${escapeHtml(plan.class.section)}` : ''}</div></div>
    <div class="meta-item"><label>Topic</label><div>${escapeHtml(plan.topic)}</div></div>
    ${hasQuiz ? `<div class="meta-item"><label>Quiz</label><div><span class="badge-quiz">Includes Quiz</span></div></div>` : ''}
  </div>

  <div class="section">
    <h2>Learning Objectives</h2>
    ${objectives ? `<p>${mdToHtml(objectives)}</p>` : '<p style="color:#999">No specific objectives listed.</p>'}
  </div>

  ${resources ? `
  <div class="section">
    <h2>Resources / Materials</h2>
    <p>${mdToHtml(resources)}</p>
  </div>
  ` : ''}

  <div class="section">
    <h2>Lesson Content</h2>
    ${content ? `<div>${mdToHtml(content)}</div>` : '<p style="color:#999">No content available.</p>'}
  </div>

  ${activities ? `
  <div class="section">
    <h2>Activities</h2>
    <p>${mdToHtml(activities)}</p>
  </div>
  ` : ''}

  <div class="footer">
    <p>Generated by Skoolar on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
    <p style="margin-top:0.25rem">${escapeHtml(plan.school.name)} — ${escapeHtml(plan.school.motto || 'Excellence in Education')}</p>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="lesson-note-${plan.topic.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}.html"`,
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
