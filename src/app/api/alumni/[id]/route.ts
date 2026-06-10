import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const alumni = await db.alumni.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            admissionNo: true,
            photo: true,
            classId: true,
            gender: true,
            dateOfBirth: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                avatar: true,
              },
            },
          },
        },
        rsvps: {
          include: {
            event: { select: { id: true, title: true, eventDate: true } },
          },
        },
      },
    });

    if (!alumni) {
      return NextResponse.json({ error: 'Alumni not found' }, { status: 404 });
    }

    if (auth.role !== 'SUPER_ADMIN' && alumni.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({ data: alumni, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[API Alumni GET by ID]', error);
    return NextResponse.json({ error: 'Failed to fetch alumni' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const existing = await db.alumni.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Alumni not found' }, { status: 404 });
    }

    if (auth.role !== 'SUPER_ADMIN' && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { graduationYear, graduationTerm, finalClass, finalGpa, currentOccupation, employer, email, phone, address, city, country, linkedinUrl, facebookUrl, newsletterOptIn, notes, isActive } = body;

    const alumni = await db.alumni.update({
      where: { id },
      data: {
        ...(graduationYear !== undefined && { graduationYear }),
        ...(graduationTerm !== undefined && { graduationTerm }),
        ...(finalClass !== undefined && { finalClass }),
        ...(finalGpa !== undefined && { finalGpa }),
        ...(currentOccupation !== undefined && { currentOccupation }),
        ...(employer !== undefined && { employer }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(city !== undefined && { city }),
        ...(country !== undefined && { country }),
        ...(linkedinUrl !== undefined && { linkedinUrl }),
        ...(facebookUrl !== undefined && { facebookUrl }),
        ...(newsletterOptIn !== undefined && { newsletterOptIn }),
        ...(notes !== undefined && { notes }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        student: {
          select: {
            id: true,
            admissionNo: true,
            user: { select: { id: true, name: true, email: true, phone: true } },
          },
        },
      },
    });

    return NextResponse.json({ data: alumni, message: 'Alumni updated successfully', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[API Alumni PUT]', error);
    return NextResponse.json({ error: 'Failed to update alumni' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const existing = await db.alumni.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Alumni not found' }, { status: 404 });
    }

    if (auth.role !== 'SUPER_ADMIN' && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await db.alumni.delete({ where: { id } });

    return NextResponse.json({ message: 'Alumni deleted successfully', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[API Alumni DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete alumni' }, { status: 500 });
  }
}
