export function generatePayrollNotifications(params: {
  type: 'payslip_available' | 'payroll_approved' | 'salary_paid' | 'advance_approved' | 'advance_rejected';
  userId: string;
  payrollTitle?: string;
  amount?: number;
}): { title: string; message: string; userId: string } {
  const { type, userId, payrollTitle, amount } = params;

  switch (type) {
    case 'payslip_available':
      return {
        userId,
        title: 'Payslip Available',
        message: `Your payslip for ${payrollTitle || 'this month'} is now available. Please review it in your dashboard.`,
      };
    case 'payroll_approved':
      return {
        userId,
        title: 'Payroll Approved',
        message: `The payroll for ${payrollTitle || 'this period'} has been approved.`,
      };
    case 'salary_paid':
      return {
        userId,
        title: 'Salary Paid',
        message: `Your salary of ${amount ? formatNaira(amount) : 'the agreed amount'} has been paid for ${payrollTitle || 'this month'}.`,
      };
    case 'advance_approved':
      return {
        userId,
        title: 'Salary Advance Approved',
        message: `Your salary advance request of ${amount ? formatNaira(amount) : ''} has been approved.`,
      };
    case 'advance_rejected':
      return {
        userId,
        title: 'Salary Advance Rejected',
        message: `Your salary advance request of ${amount ? formatNaira(amount) : ''} has been rejected.`,
      };
  }
}

function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString()}`;
}
