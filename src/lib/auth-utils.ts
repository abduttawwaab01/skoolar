import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * Get the current authenticated session on the server side.
 * Returns null if not authenticated.
 */
export async function getCurrentSession() {
  return getServerSession(authOptions);
}

/**
 * Get the current authenticated user from the database.
 * Returns null if not authenticated.
 */
export async function getCurrentUser() {
  const session = await getCurrentSession();
  if (!session?.user?.id) return null;

  return db.user.findUnique({
    where: { id: session.user.id },
    include: { school: true },
  });
}

/**
 * Check if the current user has the required role.
 * Returns true if the user has the role, false otherwise.
 */
export async function hasRole(requiredRoles: string | string[]): Promise<boolean> {
  const session = await getCurrentSession();
  if (!session?.user?.role) return false;

  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  return roles.includes(session.user.role);
}

/**
 * Require authentication - throws if not authenticated.
 * Use in server components and API routes.
 */
export async function requireAuth() {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    throw new Error('Authentication required');
  }
  return session;
}

/**
 * Require a specific role - throws if user doesn't have the role.
 */
export async function requireRole(requiredRoles: string | string[]) {
  const session = await requireAuth();
  const has = await hasRole(requiredRoles);
  if (!has) {
    throw new Error(`Required role: ${Array.isArray(requiredRoles) ? requiredRoles.join(', ') : requiredRoles}`);
  }
  return session;
}

/**
 * Get the school context for the current user.
 */
export async function getSchoolContext() {
  const session = await getCurrentSession();
  if (!session?.user?.schoolId) return null;

  return db.school.findUnique({
    where: { id: session.user.schoolId },
  });
}

/**
 * Role hierarchy for authorization checks.
 * Higher number = more permissions.
 */
const roleHierarchy: Record<string, number> = {
  STUDENT: 1,
  PARENT: 2,
  LIBRARIAN: 3,
  ACCOUNTANT: 3,
  TEACHER: 4,
  DIRECTOR: 5,
  SCHOOL_ADMIN: 6,
  SUPER_ADMIN: 7,
};

/**
 * Check if the current user's role is at or above the minimum required level.
 */
export async function hasMinRole(minRole: string): Promise<boolean> {
  const session = await getCurrentSession();
  if (!session?.user?.role) return false;

  const userLevel = roleHierarchy[session.user.role] ?? 0;
  const requiredLevel = roleHierarchy[minRole] ?? 0;
  return userLevel >= requiredLevel;
}
