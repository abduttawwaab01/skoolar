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

// Role-based route access
const ROUTE_ROLE_MAP: Record<string, string[]> = {
  '/dashboard/super-admin': ['SUPER_ADMIN'],
  '/dashboard/school-admin': ['SCHOOL_ADMIN', 'SUPER_ADMIN'],
  '/dashboard/teacher': ['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'],
  '/dashboard/student': ['STUDENT', 'SCHOOL_ADMIN', 'SUPER_ADMIN'],
  '/dashboard/parent': ['PARENT', 'SCHOOL_ADMIN', 'SUPER_ADMIN'],
  '/dashboard/accountant': ['ACCOUNTANT', 'SCHOOL_ADMIN', 'SUPER_ADMIN'],
  '/dashboard/librarian': ['LIBRARIAN', 'SCHOOL_ADMIN', 'SUPER_ADMIN'],
  '/dashboard/director': ['DIRECTOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN'],
};

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route));
}

function getRequiredRoles(pathname: string): string[] | null {
  for (const [route, roles] of Object.entries(ROUTE_ROLE_MAP)) {
    if (pathname.startsWith(route)) {
      return roles;
    }
  }
  return null;
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

  // Check role-based access for dashboard routes
  if (pathname.startsWith('/dashboard')) {
    const requiredRoles = getRequiredRoles(pathname);
    if (requiredRoles && !requiredRoles.includes(token.role as string)) {
      // Redirect to appropriate dashboard based on role
      const roleDashboardMap: Record<string, string> = {
        'SUPER_ADMIN': '/dashboard/super-admin',
        'SCHOOL_ADMIN': '/dashboard/school-admin',
        'TEACHER': '/dashboard/teacher',
        'STUDENT': '/dashboard/student',
        'PARENT': '/dashboard/parent',
        'ACCOUNTANT': '/dashboard/accountant',
        'LIBRARIAN': '/dashboard/librarian',
        'DIRECTOR': '/dashboard/director',
      };
      const correctDashboard = roleDashboardMap[token.role as string] || '/dashboard';
      return NextResponse.redirect(new URL(correctDashboard, request.url));
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
