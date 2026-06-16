/**
 * Calculate net salary after deductions.
 * Returns { grossPay, totalDeductions, netPay, deductions[] }
 */
export function calculateSalary(params: {
  baseSalary: number;
  housingAllowance?: number;
  transportAllowance?: number;
  medicalAllowance?: number;
  bonus?: number;
  otherAllowances?: string | null;
  taxRate?: number;
  pensionRate?: number;
  advanceDeductions?: { amount: number }[];
}): {
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  deductions: { label: string; amount: number }[];
} {
  const housing = params.housingAllowance || 0;
  const transport = params.transportAllowance || 0;
  const medical = params.medicalAllowance || 0;
  const bonus = params.bonus || 0;

  let otherTotal = 0;
  if (params.otherAllowances) {
    try {
      const extras = JSON.parse(params.otherAllowances);
      if (typeof extras === 'object') {
        for (const val of Object.values(extras)) {
          otherTotal += Number(val) || 0;
        }
      }
    } catch { /* ignore */ }
  }

  const grossPay = params.baseSalary + housing + transport + medical + bonus + otherTotal;
  const deductions: { label: string; amount: number }[] = [];

  const taxRate = params.taxRate || 0;
  const pensionRate = params.pensionRate || 0;

  if (taxRate > 0) {
    const tax = Math.round(grossPay * (taxRate / 100));
    deductions.push({ label: 'PAYE Tax', amount: tax });
  }

  if (pensionRate > 0) {
    const pension = Math.round(grossPay * (pensionRate / 100));
    deductions.push({ label: 'Pension', amount: pension });
  }

  if (params.advanceDeductions?.length) {
    for (const adv of params.advanceDeductions) {
      deductions.push({ label: 'Salary Advance Repayment', amount: adv.amount });
    }
  }

  const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);
  const netPay = grossPay - totalDeductions;

  return { grossPay, totalDeductions, netPay, deductions };
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}
