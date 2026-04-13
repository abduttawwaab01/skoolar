import { db } from './db';

interface AuditLogData {
  schoolId: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Creates an audit log entry.
 * This is designed to be fire-and-forget in most cases, but returns the promise
 * if you need to await it.
 */
export async function createAuditLogEntry(data: AuditLogData) {
  try {
    // Ensure details is a string if it's an object
    const details = typeof data.details === 'object' 
      ? JSON.stringify(data.details) 
      : data.details;

    return await db.auditLog.create({
      data: {
        schoolId: data.schoolId,
        userId: data.userId || null,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId || null,
        details: details || null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
      },
    });
  } catch (error) {
    // We log to console but don't throw to avoid breaking the main request flow
    console.error('[Audit Logger] Failed to create audit log entry:', error);
    return null;
  }
}
