export interface DeliveryResult {
  success: boolean;
  method: 'whatsapp' | 'email';
  recipient: string;
  status: 'sent' | 'delivered' | 'failed';
  error?: string;
  metadata?: Record<string, unknown>;
}

export function getWhatsAppClickToChatUrl(phone: string, message: string): string {
  const cleaned = phone.replace(/[^0-9]/g, '');
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}

export function generateWhatsAppMessage(params: {
  studentName: string;
  termName: string;
  session: string;
  schoolName: string;
  averageScore?: number;
  grade?: string;
  downloadUrl?: string;
}): string {
  let msg = `Dear Parent, your child *${params.studentName}*'s *${params.termName} Term* Report Card for *${params.session}* is now available.`;
  if (params.averageScore !== undefined) {
    msg += `\n\n📊 Average Score: *${params.averageScore}%*`;
  }
  if (params.grade) {
    msg += `\n📈 Overall Grade: *${params.grade}*`;
  }
  msg += `\n\n🏫 ${params.schoolName}`;
  if (params.downloadUrl) {
    msg += `\n\n📥 Download: ${params.downloadUrl}`;
  }
  return msg;
}

export function generateEmailHtml(params: {
  studentName: string;
  termName: string;
  session: string;
  schoolName: string;
  schoolLogo?: string;
  averageScore?: number;
  grade?: string;
  classRank?: number;
  downloadUrl?: string;
  subjectResults?: { name: string; grade: string; score: number }[];
}): string {
  const subjectsHtml = params.subjectResults?.map(s =>
    `<tr><td style="padding:4px 8px;border-bottom:1px solid #e2e8f0">${s.name}</td>
<td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;text-align:center">${s.grade}</td>
<td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;text-align:center">${s.score}%</td></tr>`
  ).join('') || '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Inter,sans-serif;background:#f8fafc;margin:0;padding:20px">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
<div style="background:#059669;padding:20px;text-align:center">
${params.schoolLogo ? `<img src="${params.schoolLogo}" height="50" style="margin-bottom:8px"/>` : ''}
<h1 style="color:white;margin:0;font-size:18px">${params.schoolName}</h1>
</div>
<div style="padding:24px">
<h2 style="color:#1e293b;font-size:16px;margin:0 0 12px">Report Card Available</h2>
<p style="color:#475569;font-size:14px;line-height:1.6">
Dear Parent, your child <strong>${params.studentName}</strong>'s
<strong>${params.termName} Term</strong> Report Card for
<strong>${params.session}</strong> is now available.
</p>
${params.averageScore !== undefined ? `<p style="font-size:14px;color:#475569">📊 <strong>Average Score:</strong> ${params.averageScore}%</p>` : ''}
${params.grade ? `<p style="font-size:14px;color:#475569">📈 <strong>Overall Grade:</strong> ${params.grade}</p>` : ''}
${params.classRank ? `<p style="font-size:14px;color:#475569">🏆 <strong>Class Rank:</strong> ${params.classRank}</p>` : ''}
${subjectsHtml ? `<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px">
<thead><tr style="background:#f1f5f9"><th style="padding:6px 8px;text-align:left">Subject</th><th style="padding:6px 8px;text-align:center">Grade</th><th style="padding:6px 8px;text-align:center">Score</th></tr></thead>
<tbody>${subjectsHtml}</tbody></table>` : ''}
${params.downloadUrl ? `<a href="${params.downloadUrl}" style="display:inline-block;background:#059669;color:white;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;margin-top:8px">Download Report Card</a>` : ''}
<p style="color:#94a3b8;font-size:12px;margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0">
This is an automated message from Skoolar. Please do not reply to this email.
</p>
</div></div></body></html>`;
}
