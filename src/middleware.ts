import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths that don't require authentication
  const publicPaths = [
    '/',
    '/login',
    '/register',
    '/entrance',
    '/features',
    '/api/auth/register',
    '/api/auth/seed',
    '/api/auth/signin',
    '/api/auth/signout',
    '/api/auth/callback',
    '/blog',
    '/pricing',
    '/stories',
    '/submit-story',
    '/privacy',
    '/cookies',
    '/learning-hub',
  ];

  // Public API prefixes (accessible without authentication)
  const publicApiPrefixes = [
    '/api/platform/',
    '/api/hub',
    '/api/plans',
    '/api/notices',
    '/api/schools',
    '/api/public/',
  ];

  // API auth routes (handled by NextAuth itself)
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  // Allow public API prefixes
  for (const prefix of publicApiPrefixes) {
    if (pathname.startsWith(prefix)) {
      return NextResponse.next();
    }
  }

  // Allow public paths (exact match or prefix)
  for (const pp of publicPaths) {
    if (pathname === pp || pathname.startsWith(pp + '/')) {
      return NextResponse.next();
    }
  }

  // Allow static files, images, etc.
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check for session token for all other routes
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    // Redirect to login page for page routes
    if (!pathname.startsWith('/api/')) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
    // Return 401 for API routes
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
