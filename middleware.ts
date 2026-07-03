import { NextResponse, NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

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
  '/api/public/entrance-exams',
  '/api/entrance-exams',
  '/api/schools',
  '/api/subscription',
  '/live',
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
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  // Not authenticated - redirect to login
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const userRole = (token.role as string)?.toUpperCase();
  const isExpired = token.subscriptionExpired as boolean;
  const roleDisabled = token.roleDisabled as boolean;

  // ── Subscription expiry enforcement ──
  if (isExpired && userRole !== 'SUPER_ADMIN') {
    if (userRole === 'SCHOOL_ADMIN') {
      // School admin: allow only /dashboard (redirects to subscription tab)
      if (pathname.startsWith('/dashboard') || pathname.startsWith('/api/subscription')) {
        return NextResponse.next();
      }
      // Redirect everything else to dashboard
      const dashUrl = new URL('/dashboard', request.url);
      return NextResponse.redirect(dashUrl);
    }
    // Non-admin users: redirect to login with expired message
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('expired', 'true');
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Disabled role enforcement ──
  // If the user's role is disabled globally or per-school, block all dashboard/api access
  if (roleDisabled && userRole !== 'SUPER_ADMIN') {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('disabled', 'true');
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Protect /dashboard route - check that user has a valid role
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    if (!VALID_ROLES.includes(userRole)) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Add auth headers for API routes
  if (pathname.startsWith('/api/')) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', token.id as string);
    requestHeaders.set('x-user-role', userRole);
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
    '/dashboard',
    '/dashboard/:path*',
    '/api/:path*',
  ],
};
