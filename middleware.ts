import { NextResponse, NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || '';

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/pricing',
  '/blog',
  '/stories',
  '/submit-story',
  '/features',
  '/learning-hub',
  '/entrance',
  '/privacy',
  '/cookies',
  '/offline',
  '/api/auth',
  '/api/health',
  '/api/platform',
  '/api/plans',
  '/api/hub',
  '/api/public',
  '/_next',
  '/favicon.ico',
  '/manifest.json',
  '/sw.js',
  '/push-sw.js',
];

// Valid roles that can access the dashboard
const VALID_ROLES = [
  'SUPER_ADMIN',
  'SCHOOL_ADMIN',
  'TEACHER',
  'STUDENT',
  'PARENT',
  'ACCOUNTANT',
  'LIBRARIAN',
  'DIRECTOR',
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Check for authentication
  const token = await getToken({ req: request, secret: JWT_SECRET || undefined });

  // Not authenticated - redirect to login
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Protect /dashboard route - check that user has a valid role
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    const userRole = token.role as string;
    if (!VALID_ROLES.includes(userRole)) {
      // Invalid role - redirect to login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Add auth headers for API routes (optional - for server-side components)
  if (pathname.startsWith('/api/')) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', token.id as string);
    requestHeaders.set('x-user-role', token.role as string);
    requestHeaders.set('x-school-id', (token.schoolId as string) || '');

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|push-sw.js).*)',
  ],
};
