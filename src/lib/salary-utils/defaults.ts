export const DEFAULT_ALLOWANCE_LABELS: Record<string, string> = {
  housingAllowance: 'Housing',
  transportAllowance: 'Transport',
  medicalAllowance: 'Medical',
  bonus: 'Bonus',
};

export const SALARY_ROLES = ['TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'DIRECTOR', 'SCHOOL_ADMIN'] as const;
export type SalaryRole = (typeof SALARY_ROLES)[number];

export const ADVANCE_STATUS = ['PENDING', 'APPROVED', 'PAID', 'COMPLETED', 'REJECTED'] as const;
export type AdvanceStatus = (typeof ADVANCE_STATUS)[number];

export const STAFF_ROLE_LABELS: Record<string, string> = {
  TEACHER: 'Teacher',
  ACCOUNTANT: 'Accountant',
  LIBRARIAN: 'Librarian',
  DIRECTOR: 'Director',
  SCHOOL_ADMIN: 'School Admin',
};

export function getGrossPay(salary: { baseSalary: number; housingAllowance?: number; transportAllowance?: number; medicalAllowance?: number; bonus?: number; otherAllowances?: string | null }): number {
  let total = salary.baseSalary;
  total += (salary.housingAllowance || 0);
  total += (salary.transportAllowance || 0);
  total += (salary.medicalAllowance || 0);
  total += (salary.bonus || 0);
  if (salary.otherAllowances) {
    try {
      const extras = JSON.parse(salary.otherAllowances);
      if (typeof extras === 'object') {
        for (const val of Object.values(extras)) {
          total += Number(val) || 0;
        }
      }
    } catch { /* ignore */ }
  }
  return total;
}
