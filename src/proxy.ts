import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Public paths that don't require authentication
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/entrance',
  '/features',
  '/blog',
  '/pricing',
  '/stories',
  '/submit-story',
  '/privacy',
  '/cookies',
  '/learning-hub',
  '/api/auth/',
  '/api/public/',
  '/api/blog/',
  '/api/platform/',
  '/api/hub',
  '/api/plans',
  '/api/notices',
  '/api/schools',
  '/api/upload',
];

const isPublicPath = (pathname: string): boolean => {
  return PUBLIC_PATHS.some(publicPath => 
    pathname === publicPath || pathname.startsWith(publicPath)
  );
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files, images, etc.
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/images/') ||
    pathname.includes('favicon.ico') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({ 
    req: request, 
    secret: process.env.NEXTAUTH_SECRET 
  });

  if (!token) {
    // Return 401 for API routes
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Redirect to login page for page routes
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  
  // Inject user context into headers for server components/actions
  if (token) {
    response.headers.set('x-user-id', token.id as string);
    response.headers.set('x-user-role', token.role as string);
    response.headers.set('x-school-id', (token.schoolId || '') as string);
  }
  
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

