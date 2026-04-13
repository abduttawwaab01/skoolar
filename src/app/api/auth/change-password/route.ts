import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, currentPassword, newPassword } = body;

    if (!userId || !currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'User ID, current password, and new password are required.' },
        { status: 400 }
      );
    }

    // Users can only change their own password, unless SUPER_ADMIN
    if (auth.role !== 'SUPER_ADMIN' && auth.userId !== userId) {
      return NextResponse.json({ error: 'You can only change your own password.' }, { status: 403 });
    }

    // For non-SUPER_ADMIN, current password is required
    if (auth.role !== 'SUPER_ADMIN' && !currentPassword) {
      return NextResponse.json({ error: 'Current password is required.' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters.' },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || !user.password) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // Verify current password unless SUPER_ADMIN
    if (auth.role !== 'SUPER_ADMIN') {
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 });
      }
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await db.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    return NextResponse.json({ message: 'Password changed successfully.' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to change password.' }, { status: 500 });
  }
}
