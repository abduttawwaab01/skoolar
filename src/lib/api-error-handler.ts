import { NextResponse } from 'next/server';

/**
 * Standardized API error response format
 */
export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
  timestamp?: string;
}

/**
 * Send a standardized error response
 * @param message - Error message
 * @param status - HTTP status code (default: 500)
 * @param code - Error code for client-side handling
 * @param details - Additional error details
 */
export function errorResponse(
  message: string,
  status: number = 500,
  code?: string,
  details?: unknown
): NextResponse<ApiError> {
  const error: ApiError = {
    error: message,
    ...(code ? { code } : {}),
    ...(details ? { details } : {}),
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(error, { status });
}

/**
 * Handle and standardize thrown errors
 * @param error - The error to handle
 * @param defaultStatus - Default HTTP status (default: 500)
 * @param defaultMessage - Default error message
 */
export function handleApiError(
  error: unknown,
  defaultStatus: number = 500,
  defaultMessage: string = 'An unexpected error occurred'
): NextResponse<ApiError> {
  if (error instanceof Error) {
    // Check for specific error patterns
    if (error.message.includes('not found')) {
      return errorResponse('Resource not found', 404, 'NOT_FOUND', error.message);
    }
    if (error.message.includes('unauthorized')) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED', error.message);
    }
    if (error.message.includes('forbidden')) {
      return errorResponse('Forbidden', 403, 'FORBIDDEN', error.message);
    }
    if (error.message.includes('invalid')) {
      return errorResponse('Invalid request', 400, 'INVALID_REQUEST', error.message);
    }

    // Generic error
    return errorResponse(error.message, defaultStatus, undefined, { originalError: error.message });
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    return errorResponse((error as any).message, defaultStatus, undefined, error);
  }

  return errorResponse(defaultMessage, defaultStatus);
}

/**
 * Success response helper (for consistency)
 */
export function successResponse<T>(
  data: T,
  status: number = 200,
  message?: string
): NextResponse<{ data: T; message?: string }> {
  const response: { data: T; message?: string } = {
    data,
    ...(message ? { message } : {}),
  };

  return NextResponse.json(response, { status });
}
