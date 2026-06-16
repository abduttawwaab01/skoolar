import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { getSchoolId } from '@/lib/auth-middleware';
import { canViewAllPayslips, canViewOwnPayslips } from '@/lib/salary-utils/permissions';
import { errorResponse, successResponse } from '@/lib/api-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const payslip = await db.payslip.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        payroll: { select: { id: true, title: true, month: true, year: true, status: true } },
        school: { select: { name: true } },
      },
    });

    if (!payslip) {
      return errorResponse('Payslip not found', 404);
    }

    const canViewAll = canViewAllPayslips(auth.role);
    const canViewOwn = canViewOwnPayslips(auth.role);
    const isOwn = payslip.userId === auth.userId;

    if (!canViewAll && !(canViewOwn && isOwn)) {
      return errorResponse('Insufficient permissions', 403);
    }

    if (!canViewAll) {
      const schoolId = getSchoolId(request, auth);
      if (schoolId && payslip.schoolId !== schoolId) {
        return errorResponse('Access denied', 403);
      }
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format');

    if (format === 'pdf') {
      const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const page = pdfDoc.addPage([612, 792]);
      const { width } = page.getSize();
      let y = 750;

      const drawText = (text: string, x: number, size: number, opts?: { bold?: boolean; color?: number[] }) => {
        page.drawText(text, { x, y: y - size, size, font: opts?.bold ? bold : font, color: rgb(opts?.color?.[0] ?? 0, opts?.color?.[1] ?? 0, opts?.color?.[2] ?? 0) });
      };
      const line = () => { page.drawLine({ start: { x: 50, y }, end: { x: 562, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) }); y -= 16; };

      const schoolName = payslip.school?.name || 'School';
      drawText(schoolName, 50, 20, { bold: true, color: [0.02, 0.42, 0.33] }); y -= 22;
      drawText('PAYSLIP', 50, 16, { bold: true, color: [0.3, 0.3, 0.3] }); y -= 22;
      drawText(`Pay Period: ${payslip.payroll?.month || ''} ${payslip.payroll?.year || ''}`, 50, 10, { color: [0.4, 0.4, 0.4] });
      drawText(`Status: ${payslip.paymentStatus}`, 420, 10, { color: [0.4, 0.4, 0.4] });
      y -= 30;
      line();
      y -= 8;

      drawText('Employee Details', 50, 14, { bold: true }); y -= 20;
      drawText(`Name: ${payslip.user?.name || 'N/A'}`, 50, 11); y -= 16;
      drawText(`Role: ${payslip.user?.role || 'N/A'}`, 50, 11); y -= 16;
      drawText(`Email: ${payslip.user?.email || 'N/A'}`, 50, 11); y -= 30;
      line();
      y -= 8;

      drawText('Earnings', 50, 14, { bold: true }); y -= 20;
      const earnings = [
        ['Base Salary', payslip.baseSalary],
        ['Housing Allowance', payslip.housingAllowance],
        ['Transport Allowance', payslip.transportAllowance],
        ['Medical Allowance', payslip.medicalAllowance],
        ['Bonus', payslip.bonus],
      ];
      if (payslip.otherAllowances) {
        try { const oa = JSON.parse(payslip.otherAllowances); if (Array.isArray(oa)) oa.forEach((a: any) => earnings.push([a.label || 'Other', a.amount || 0])); } catch {}
      }
      for (const [label, amount] of earnings) {
        drawText(String(label), 50, 11); drawText(`${Number(amount).toLocaleString()}`, 480, 11); y -= 16;
      }
      y -= 4;
      drawText('Gross Pay', 50, 12, { bold: true }); drawText(`${payslip.grossPay.toLocaleString()}`, 480, 12, { bold: true }); y -= 30;
      line();
      y -= 8;

      drawText('Deductions', 50, 14, { bold: true }); y -= 20;
      if (payslip.deductions) {
        try { const de = JSON.parse(payslip.deductions); if (Array.isArray(de)) de.forEach((d: any) => { drawText(String(d.label || 'Deduction'), 50, 11); drawText(`${Number(d.amount).toLocaleString()}`, 480, 11); y -= 16; }); } catch {}
      }
      drawText(`Total Deductions`, 50, 11); drawText(`${payslip.totalDeductions.toLocaleString()}`, 480, 11); y -= 30;
      line();
      y -= 8;

      drawText('Net Pay', 50, 16, { bold: true, color: [0.02, 0.42, 0.33] }); drawText(`${payslip.netPay.toLocaleString()}`, 460, 16, { bold: true, color: [0.02, 0.42, 0.33] }); y -= 30;

      if (payslip.notes) { drawText(`Notes: ${payslip.notes}`, 50, 10, { color: [0.4, 0.4, 0.4] }); }

      drawText(`Generated on ${new Date().toLocaleDateString()}`, 50, 9, { color: [0.6, 0.6, 0.6] });

      const pdfBytes = Buffer.from(await pdfDoc.save());
      return new NextResponse(pdfBytes, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="payslip-${payslip.id}.pdf"`,
        },
      });
    }

    return successResponse(payslip);
  } catch (error: any) {
    console.error('[GET /api/salary/payslips/:id]', error);
    return errorResponse(error.message, 500);
  }
}
