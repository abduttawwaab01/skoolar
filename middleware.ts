import { NextResponse, NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getSubdomain } from '@/lib/subdomain';

const PUBLIC_ROUTES = [
  '/login', '/register', '/forgot-password', '/reset-password',
  '/pricing', '/blog', '/stories', '/submit-story', '/features',
  '/learning-hub', '/entrance', '/privacy', '/cookies', '/offline', '/careers', '/live',
  '/api/auth', '/api/health', '/api/platform', '/api/plans', '/api/hub',
  '/api/public', '/api/public/entrance-exams', '/api/entrance-exams',
  '/api/schools', '/api/trusted-schools',
  '/_next', '/favicon.ico', '/manifest.json', '/sw.js', '/push-sw.js', '/s',
];

const VALID_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'ACCOUNTANT', 'LIBRARIAN', 'DIRECTOR'];

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
  // Rewrite subdomain requests to /s/{slug}/... except for API routes,
  // static assets, dashboard, and other root-level paths
  if (subdomain && !pathname.startsWith('/s/') && !pathname.startsWith('/_next/')) {
    const isExcluded = pathname.startsWith('/api/') ||
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/favicon') ||
      pathname.startsWith('/icon-') ||
      pathname.startsWith('/manifest') ||
      pathname === '/sw.js' ||
      pathname === '/push-sw.js' ||
      pathname === '/robots.txt' ||
      pathname === '/sitemap.xml';
    if (!isExcluded) {
      const url = request.nextUrl.clone();
      url.pathname = `/s/${subdomain}${pathname === '/' ? '' : pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  if (pathname === '/' || pathname.startsWith('/s/')) {
    return NextResponse.next();
  }

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const userRole = (token.role as string)?.toUpperCase();
  const isExpired = token.subscriptionExpired as boolean;
  const roleDisabled = token.roleDisabled as boolean;

  if (isExpired && userRole !== 'SUPER_ADMIN') {
    if (pathname.startsWith('/api/')) {
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
    if (userRole === 'SCHOOL_ADMIN') {
      if (pathname.startsWith('/dashboard') || pathname.startsWith('/api/subscription') || pathname.startsWith('/api/payments')) {
        return NextResponse.next();
      }
      const dashUrl = new URL('/dashboard', request.url);
      return NextResponse.redirect(dashUrl);
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('expired', 'true');
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (roleDisabled && userRole !== 'SUPER_ADMIN') {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('disabled', 'true');
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    if (!VALID_ROLES.includes(userRole)) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname.startsWith('/api/')) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', token.id as string);
    requestHeaders.set('x-user-role', userRole);
    requestHeaders.set('x-school-id', (token.schoolId as string) || '');

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard', '/dashboard/:path*',
    '/api/:path*', '/s/:path*',
    '/((?!_next|_static|_vercel|favicon.ico|manifest.json|sw.js|push-sw.js).*)',
  ],
};
