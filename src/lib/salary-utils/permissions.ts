const ADMIN_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN'];
const ALL_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT', 'TEACHER', 'DIRECTOR'];

export function canViewSalaryConfig(role: string | undefined): boolean {
  return !!role && ALL_ROLES.includes(role);
}

export function canManageSalaryConfig(role: string | undefined): boolean {
  return !!role && ADMIN_ROLES.includes(role);
}

export function canViewAllConfigs(role: string | undefined): boolean {
  return !!role && ADMIN_ROLES.includes(role);
}

export function canViewOwnConfig(role: string | undefined): boolean {
  return !!role && ['TEACHER', 'ACCOUNTANT', 'DIRECTOR'].includes(role);
}

export function canCreatePayroll(role: string | undefined): boolean {
  return !!role && ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT'].includes(role);
}

export function canApprovePayroll(role: string | undefined): boolean {
  return !!role && ADMIN_ROLES.includes(role);
}

export function canMarkPayrollPaid(role: string | undefined): boolean {
  return !!role && ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT'].includes(role);
}

export function canViewPayrolls(role: string | undefined): boolean {
  return !!role && ALL_ROLES.includes(role);
}

export function canViewAllPayslips(role: string | undefined): boolean {
  return !!role && ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT'].includes(role);
}

export function canViewOwnPayslips(role: string | undefined): boolean {
  return !!role && ['TEACHER', 'DIRECTOR'].includes(role);
}

export function canRequestAdvance(role: string | undefined): boolean {
  return !!role && ['TEACHER', 'DIRECTOR', 'ACCOUNTANT', 'LIBRARIAN'].includes(role);
}

export function canApproveAdvance(role: string | undefined): boolean {
  return !!role && ADMIN_ROLES.includes(role);
}

export function canViewAdvances(role: string | undefined): boolean {
  return !!role && ALL_ROLES.includes(role);
}

export function canViewSalaryReports(role: string | undefined): boolean {
  return !!role && ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT'].includes(role);
}
