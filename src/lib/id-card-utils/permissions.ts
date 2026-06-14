export type UserRole =
  | 'SUPER_ADMIN'
  | 'SCHOOL_ADMIN'
  | 'TEACHER'
  | 'STUDENT'
  | 'PARENT'
  | 'ACCOUNTANT'
  | 'LIBRARIAN'
  | 'DIRECTOR';

export type Permission =
  | 'create:design'
  | 'edit:design'
  | 'delete:design'
  | 'view:design'
  | 'generate:card'
  | 'bulk:generate'
  | 'export:card'
  | 'bulk:export'
  | 'print:card'
  | 'view:own-card'
  | 'download:own-card'
  | 'print:own-card'
  | 'view:any-card'
  | 'manage:qr'
  | 'manage:scanner'
  | 'manage:attendance'
  | 'view:analytics'
  | 'manage:templates'
  | 'cross:school'
  | 'configure:settings';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: [
    'create:design',
    'edit:design',
    'delete:design',
    'view:design',
    'generate:card',
    'bulk:generate',
    'export:card',
    'bulk:export',
    'print:card',
    'view:any-card',
    'manage:qr',
    'manage:scanner',
    'manage:attendance',
    'view:analytics',
    'manage:templates',
    'cross:school',
    'configure:settings',
  ],
  SCHOOL_ADMIN: [
    'create:design',
    'edit:design',
    'delete:design',
    'view:design',
    'generate:card',
    'bulk:generate',
    'export:card',
    'bulk:export',
    'print:card',
    'view:any-card',
    'manage:qr',
    'manage:scanner',
    'manage:attendance',
    'view:analytics',
    'manage:templates',
    'configure:settings',
  ],
  DIRECTOR: [
    'view:design',
    'view:any-card',
    'export:card',
    'print:card',
    'view:analytics',
  ],
  TEACHER: [
    'view:own-card',
    'download:own-card',
    'print:own-card',
  ],
  ACCOUNTANT: [
    'view:own-card',
    'download:own-card',
    'print:own-card',
  ],
  LIBRARIAN: [
    'view:own-card',
    'download:own-card',
    'print:own-card',
  ],
  STUDENT: [],
  PARENT: [],
};

export function hasPermission(
  role: UserRole,
  permission: Permission
): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

export function canAccessCard(
  role: UserRole,
  cardPersonType: string,
  cardUserId: string | null,
  currentUserId: string
): boolean {
  if (role === 'SUPER_ADMIN' || role === 'SCHOOL_ADMIN') return true;
  if (role === 'DIRECTOR') return true;
  if (role === 'TEACHER' || role === 'ACCOUNTANT' || role === 'LIBRARIAN') {
    return cardUserId === currentUserId;
  }
  return false;
}

export function canManageDesign(role: UserRole): boolean {
  return (
    role === 'SUPER_ADMIN' ||
    role === 'SCHOOL_ADMIN'
  );
}

export function canBulkExport(role: UserRole): boolean {
  return (
    role === 'SUPER_ADMIN' ||
    role === 'SCHOOL_ADMIN'
  );
}
