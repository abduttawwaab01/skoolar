import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';

const JWT_SECRET = process.env.NEXTAUTH_SECRET;

async function handleSignout(request: NextRequest) {
  try {
    // Get the token from the request
    const token = await getToken({ req: request, secret: JWT_SECRET });
    
    // If user is logged in, update their session
    if (token?.id) {
      // Update user's logout time
      await db.user.update({
        where: { id: token.id as string },
        data: { 
          // You can add logout tracking here if needed
        },
      }).catch(() => {
        // Ignore errors - user might not exist
      });
    }

    // Get callback URL
    const { searchParams } = new URL(request.url);
    const callbackUrl = searchParams.get('callbackUrl') || '/login';
    
    // Redirect to callback URL
    const response = NextResponse.redirect(new URL(callbackUrl, request.url));
    
    // Clear the session cookie
    response.cookies.delete('next-auth.session-token');
    response.cookies.delete('__Secure-next-auth.session-token');
    
    return response;
  } catch (error) {
    console.error('Signout error:', error);
    // Redirect to login page even on error
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export async function GET(request: NextRequest) {
  return handleSignout(request);
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: JWT_SECRET });

    if (token?.id) {
      await db.user.update({
        where: { id: token.id as string },
        data: {},
      }).catch(() => {});
    }

    let callbackUrl = '/login';
    try {
      const formData = await request.formData();
      callbackUrl = formData.get('callbackUrl')?.toString() || '/login';
    } catch {
      const { searchParams } = new URL(request.url);
      callbackUrl = searchParams.get('callbackUrl') || '/login';
    }

    const response = NextResponse.json({ url: callbackUrl });
    response.cookies.delete('next-auth.session-token');
    response.cookies.delete('__Secure-next-auth.session-token');

    return response;
  } catch (error) {
    console.error('Signout error:', error);
    return NextResponse.json({ url: '/login' });
  }
}
