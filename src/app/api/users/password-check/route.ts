import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

// POST /api/users/password-check - Admin can verify any user's password
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can check passwords
    const allowedRoles = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR'];
    if (!allowedRoles.includes(token.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, password, mode = 'verify' } = body;

    if (!userId || !password) {
      return NextResponse.json({ error: 'User ID and password are required' }, { status: 400 });
    }

    // Get user from database
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, password: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check password
    if (mode === 'verify') {
      if (!user.password) {
        return NextResponse.json({ 
          success: false, 
          valid: false,
          message: 'User has no password set (OAuth login)' 
        });
      }

      const isValid = await bcrypt.compare(password, user.password);
      
      return NextResponse.json({
        success: true,
        valid: isValid,
        message: isValid ? 'Password is correct' : 'Password is incorrect',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        }
      });
    }

    // Change password mode
    if (mode === 'change') {
      // Verify current admin password first
      if (!body.adminPassword) {
        return NextResponse.json({ error: 'Admin password required' }, { status: 400 });
      }

      // Get admin user
      const adminUser = await db.user.findUnique({
        where: { id: token.id },
        select: { password: true },
      });

      if (!adminUser?.password) {
        return NextResponse.json({ error: 'Admin has no password set' }, { status: 400 });
      }

      // Verify admin password
      const adminValid = await bcrypt.compare(body.adminPassword, adminUser.password);
      if (!adminValid) {
        return NextResponse.json({ error: 'Admin password is incorrect' }, { status: 403 });
      }

      // Check new password strength
      if (password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Update user password
      await db.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      // Log the password change
      await db.auditLog.create({
        data: {
          schoolId: token.schoolId || '',
          userId: token.id,
          action: 'PASSWORD_CHANGE',
          entity: 'USER',
          entityId: userId,
          details: `Password changed for user ${user.email}`,
          ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Password changed successfully',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        }
      });
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
