import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole, type AuthResult } from '@/lib/auth-middleware';
import { getValidationErrors } from '@/lib/validators';
import { z } from 'zod';
import { db } from '@/lib/db';

// ===== ERROR RESPONSE HELPERS =====

export function errorResponse(message: string, status: number = 400, errors?: Record<string, string[]>) {
  return NextResponse.json(
    {
      error: message,
      ...(errors && { details: errors }),
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

export function successResponse<T>(data: T, message?: string, status: number = 200) {
  return NextResponse.json(
    {
      data,
      ...(message && { message }),
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

// ===== VALIDATION HELPERS =====

export function validateSchema<T>(
  schema: z.ZodType<T, T>,
  data: unknown
): { valid: true; data: T } | { valid: false; error: NextResponse } {
  try {
    const parsed = schema.parse(data);
    return { valid: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        error: errorResponse('Validation failed', 400, getValidationErrors(error)),
      };
    }
    return {
      valid: false,
      error: errorResponse('Invalid request data', 400),
    };
  }
}

// ===== AUTHORIZATION HELPERS =====

export async function requireAuthAndRole(
  request: NextRequest,
  allowedRoles: string[]
): Promise<{ valid: true; auth: AuthResult & { authenticated: true } } | { valid: false; error: NextResponse }> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return { valid: false, error: auth };
  }

  if (!allowedRoles.includes(auth.role || '')) {
    return {
      valid: false,
      error: errorResponse(`This action requires one of these roles: ${allowedRoles.join(', ')}`, 403),
    };
  }

  return { valid: true, auth: auth as AuthResult & { authenticated: true } };
}

export async function validateParentChild(parentId: string, studentId: string): Promise<boolean> {
  const relationship = await db.studentParent.findUnique({
    where: {
      studentId_parentId: {
        studentId,
        parentId,
      },
    },
  });

  return !!relationship;
}

export async function validateTeacherClass(teacherId: string, classId: string): Promise<boolean> {
  const cls = await db.class.findUnique({
    where: { id: classId },
    select: { classTeacherId: true },
  });

  return cls?.classTeacherId === teacherId;
}

export async function validateTeacherStudent(teacherId: string, studentId: string): Promise<boolean> {
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { classId: true },
  });

  if (!student?.classId) return false;

  return validateTeacherClass(teacherId, student.classId);
}

export async function validateSchoolAccess(userId: string, schoolId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { schoolId: true },
  });

  return user?.schoolId === schoolId;
}

// ===== SANITIZATION HELPERS =====

export function sanitizeString(input: string, maxLength: number = 10000): string {
  return input
    .substring(0, maxLength)
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim();
}

export function sanitizeHtml(input: string): string {
  // Basic XSS prevention - server-side safe
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ===== RATE LIMITING HELPERS =====

const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000 // 1 minute
): boolean {
  const now = Date.now();
  const record = requestCounts.get(identifier);

  if (!record || now > record.resetTime) {
    requestCounts.set(identifier, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

export function getRateLimitError() {
  return errorResponse('Too many requests, please try again later', 429);
}

// ===== QUERY VALIDATION HELPERS =====

export function getPaginationParams(searchParams: URLSearchParams): { page: number; limit: number } {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(250, Math.max(1, parseInt(searchParams.get('limit') || '50')));
  return { page, limit };
}

export function getDateRangeParams(
  searchParams: URLSearchParams
): { dateFrom: Date | null; dateTo: Date | null } {
  const dateFromStr = searchParams.get('dateFrom');
  const dateToStr = searchParams.get('dateTo');

  let dateFrom: Date | null = null;
  let dateTo: Date | null = null;

  if (dateFromStr) {
    const date = new Date(dateFromStr);
    if (!isNaN(date.getTime())) dateFrom = date;
  }

  if (dateToStr) {
    const date = new Date(dateToStr);
    if (!isNaN(date.getTime())) dateTo = date;
  }

  return { dateFrom, dateTo };
}

// ===== CONTEXT BINDING HELPERS =====

export interface ApiContext {
  auth: AuthResult & { authenticated: true };
  request: NextRequest;
  schoolId: string;
  userId: string;
}

export async function buildApiContext(
  request: NextRequest,
  requiredRoles?: string[]
): Promise<{ valid: true; context: ApiContext } | { valid: false; error: NextResponse }> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return { valid: false, error: authResult };
  }

  if (requiredRoles && !requiredRoles.includes(authResult.role || '')) {
    return {
      valid: false,
      error: errorResponse(`Requires one of: ${requiredRoles.join(', ')}`, 403),
    };
  }

  return {
    valid: true,
    context: {
      auth: authResult as AuthResult & { authenticated: true },
      request,
      schoolId: authResult.schoolId || '',
      userId: authResult.userId || '',
    },
  };
}

// ===== EXCEPTION HANDLING =====

export async function apiHandler<T>(
  handler: (context: ApiContext) => Promise<T>,
  request: NextRequest,
  requiredRoles?: string[]
): Promise<NextResponse> {
  try {
    const contextResult = await buildApiContext(request, requiredRoles);

    if (!contextResult.valid) {
      return contextResult.error;
    }

    const result = await handler(contextResult.context);
    return successResponse(result);
  } catch (error) {
    console.error('[API Error]', error);

    if (error instanceof Error) {
      return errorResponse(error.message, 500);
    }

    return errorResponse('An unexpected error occurred', 500);
  }
}
