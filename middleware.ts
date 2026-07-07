import { NextResponse, NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getSubdomain } from '@/lib/subdomain';

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
  '/careers',
  '/live',
  '/api/auth',
  '/api/health',
  '/api/platform',
  '/api/plans',
  '/api/hub',
  '/api/public',
  '/api/public/entrance-exams',
  '/api/entrance-exams',
  '/api/schools',
  '/api/trusted-schools',
  '/api/subscription',
  '/api/payments',
  '/_next',
  '/favicon.ico',
  '/manifest.json',
  '/sw.js',
  '/push-sw.js',
  '/s',
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

function getOriginalHostname(request: NextRequest): string {
  return request.headers.get('host') || request.headers.get('x-forwarded-host') || request.nextUrl.hostname || '';
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = getOriginalHostname(request);
  const subdomain = getSubdomain(hostname);

  // ── Subdomain-based school routing ──
  // If visiting a school subdomain (e.g. greensville.skoolar.org), rewrite to /s/[slug]
  if (subdomain && !pathname.startsWith('/s/') && !pathname.startsWith('/_next/')) {
    const url = request.nextUrl.clone();
    const schoolPath = `/s/${subdomain}${pathname === '/' ? '' : pathname}`;
    url.pathname = schoolPath;
    return NextResponse.rewrite(url);
  }

  // Always allow root (homepage) and /s/* school public pages
  if (pathname === '/' || pathname.startsWith('/s/')) {
    return NextResponse.next();
  }

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Check for authentication
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  // Not authenticated - redirect to login for pages, return JSON for API routes
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const userRole = (token.role as string)?.toUpperCase();
  const isExpired = token.subscriptionExpired as boolean;
  const roleDisabled = token.roleDisabled as boolean;

  // ── Subscription expiry enforcement ──
  if (isExpired && userRole !== 'SUPER_ADMIN') {
    if (pathname.startsWith('/api/')) {
      // API calls: return proper 403 JSON instead of redirecting
      if (userRole === 'SCHOOL_ADMIN' && (pathname.startsWith('/api/subscription') || pathname.startsWith('/api/payments'))) {
        return NextResponse.next();
      }
      return NextResponse.json(
        { error: userRole === 'SCHOOL_ADMIN'
            ? 'Your school subscription has expired. Please renew to continue.'
            : 'Your school subscription has expired. Please contact your school administrator.' },
        { status: 403 }
      );
    }
    // Page routes
    if (userRole === 'SCHOOL_ADMIN') {
      const dashUrl = new URL('/dashboard', request.url);
      return NextResponse.redirect(dashUrl);
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('expired', 'true');
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Disabled role enforcement ──
  if (roleDisabled && userRole !== 'SUPER_ADMIN') {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('disabled', 'true');
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Protect /dashboard route
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
    '/s/:path*',
    '/((?!_next|_static|_vercel|favicon.ico|manifest.json|sw.js|push-sw.js).*)',
  ],
};
