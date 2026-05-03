import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_COOKIE_NAME = 'csrf-token';

/**
 * Generate a random CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Validate CSRF token from request
 * @param request - The incoming request
 * @param token - The CSRF token to validate
 * @returns true if token is valid, false otherwise
 */
export function validateCsrfToken(request: NextRequest, token: string): boolean {
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  
  if (!cookieToken || !token) {
    return false;
  }

  // Validate that tokens match
  return cookieToken === token;
}

/**
 * Require CSRF validation for mutating requests (POST, PUT, DELETE, PATCH)
 * @param request - The incoming request
 * @returns NextResponse if validation fails, null if validation passes
 */
export async function requireCsrfValidation(request: NextRequest): Promise<NextResponse | null> {
  const method = request.method.toUpperCase();
  
  // Only validate for mutating methods
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    return null;
  }

  const token = request.headers.get(CSRF_HEADER_NAME);
  
  if (!token || !validateCsrfToken(request, token)) {
    return NextResponse.json(
      { error: 'CSRF validation failed' },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Create CSRF cookie for setting in response
 */
export function createCsrfCookie(token: string): string {
  // Set httpOnly, secure, sameSite strict for production
  return `${CSRF_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}
