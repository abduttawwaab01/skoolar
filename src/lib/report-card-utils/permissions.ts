export type UserRole = 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT' | 'ACCOUNTANT' | 'LIBRARIAN' | 'DIRECTOR';

export type ReportCardPermission =
  | 'create:design'
  | 'edit:design'
  | 'delete:design'
  | 'view:design'
  | 'generate:card'
  | 'bulk:generate'
  | 'export:card'
  | 'bulk:export'
  | 'print:card'
  | 'view:own-report'
  | 'view:any-report'
  | 'approve:card'
  | 'submit:card'
  | 'publish:card'
  | 'bulk:publish'
  | 'deliver:whatsapp'
  | 'deliver:email'
  | 'bulk:deliver'
  | 'manage:domains'
  | 'manage:comments'
  | 'manage:grade-scales'
  | 'manage:promotion-rules'
  | 'view:analytics'
  | 'cross:school'
  | 'configure:settings';

const ROLE_PERMISSIONS: Record<UserRole, ReportCardPermission[]> = {
  SUPER_ADMIN: [
    'create:design', 'edit:design', 'delete:design', 'view:design',
    'generate:card', 'bulk:generate', 'export:card', 'bulk:export',
    'print:card', 'view:any-report',
    'approve:card', 'submit:card', 'publish:card', 'bulk:publish',
    'deliver:whatsapp', 'deliver:email', 'bulk:deliver',
    'manage:domains', 'manage:comments', 'manage:grade-scales',
    'manage:promotion-rules', 'view:analytics', 'cross:school',
    'configure:settings',
  ],
  SCHOOL_ADMIN: [
    'create:design', 'edit:design', 'delete:design', 'view:design',
    'generate:card', 'bulk:generate', 'export:card', 'bulk:export',
    'print:card', 'view:any-report',
    'approve:card', 'submit:card', 'publish:card', 'bulk:publish',
    'deliver:whatsapp', 'deliver:email', 'bulk:deliver',
    'manage:domains', 'manage:comments', 'manage:grade-scales',
    'manage:promotion-rules', 'view:analytics', 'configure:settings',
  ],
  DIRECTOR: [
    'view:design', 'view:any-report', 'export:card', 'print:card', 'view:analytics',
  ],
  TEACHER: [
    'generate:card', 'export:card', 'print:card',
    'submit:card', 'manage:domains', 'manage:comments', 'view:own-report',
  ],
  ACCOUNTANT: [],
  LIBRARIAN: [],
  STUDENT: ['view:own-report', 'export:card', 'print:card'],
  PARENT: ['view:own-report', 'export:card', 'print:card'],
};

export function hasPermission(role: UserRole, permission: ReportCardPermission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function canViewReport(role: UserRole, reportStudentId: string, currentUserId: string, currentUserStudentId?: string): boolean {
  if (role === 'SUPER_ADMIN' || role === 'SCHOOL_ADMIN' || role === 'DIRECTOR') return true;
  if (role === 'TEACHER') return true;
  if (role === 'STUDENT') return currentUserStudentId === reportStudentId;
  return false;
}

export function canManageDesign(role: UserRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'SCHOOL_ADMIN';
}

export function canBulkExport(role: UserRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'SCHOOL_ADMIN';
}

export function canApprove(role: UserRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'SCHOOL_ADMIN';
}

export function canPublish(role: UserRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'SCHOOL_ADMIN';
}
