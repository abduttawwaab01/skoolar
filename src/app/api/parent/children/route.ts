import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

const CACHE_CONTROL = 'public, s-maxage=15, stale-while-revalidate=30';

// GET /api/parent/children - Fetch children for the authenticated parent
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId') || '';

    // Find the parent record
    const parent = await db.parent.findUnique({
      where: { userId: auth.userId },
    });

    if (!parent) {
      return NextResponse.json({ data: [] }, {
        headers: { 'Cache-Control': CACHE_CONTROL },
      });
    }

    // Fetch children through StudentParent relation
    const studentParents = await db.studentParent.findMany({
      where: {
        parentId: parent.id,
        ...(schoolId ? { student: { schoolId } } : {}),
      },
      include: {
        student: {
          select: {
            id: true,
            schoolId: true,
            userId: true,
            admissionNo: true,
            classId: true,
            dateOfBirth: true,
            gender: true,
            address: true,
            bloodGroup: true,
            allergies: true,
            emergencyContact: true,
            photo: true,
            house: true,
            isPromoted: true,
            gpa: true,
            cumulativeGpa: true,
            rank: true,
            behaviorScore: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                phone: true,
              },
            },
            class: {
              select: {
                id: true,
                name: true,
                section: true,
                grade: true,
              },
            },
            school: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const children = studentParents.map(sp => sp.student);

    return NextResponse.json({
      data: children,
      total: children.length,
    }, {
      headers: {
        'Cache-Control': CACHE_CONTROL,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
