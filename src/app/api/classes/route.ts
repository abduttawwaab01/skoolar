import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

const CACHE_CONTROL = 'public, s-maxage=30, stale-while-revalidate=60';

// GET /api/classes - List classes with student count
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const schoolId = searchParams.get('schoolId') || '';
    const grade = searchParams.get('grade') || '';
    const search = searchParams.get('search') || '';

    const where: Record<string, unknown> = {};
    where.deletedAt = null;

    // School context validation
    const userSchoolId = auth.schoolId;
    if (userSchoolId) {
      where.schoolId = userSchoolId;
    } else if (schoolId) {
      where.schoolId = schoolId;
    }

    if (grade) where.grade = grade;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { section: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      db.class.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ grade: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          schoolId: true,
          name: true,
          section: true,
          grade: true,
          capacity: true,
          classTeacherId: true,
          createdAt: true,
          updatedAt: true,
          school: {
            select: { id: true, name: true },
          },
          classTeacher: {
            select: {
              id: true,
              user: { select: { name: true, email: true } },
            },
          },
          _count: {
            select: {
              students: {
                where: { deletedAt: null, isActive: true },
              },
              subjects: true,
              exams: true,
            },
          },
        },
      }),
      db.class.count({ where }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
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

// POST /api/classes - Create class
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();

    const { schoolId, name, section, grade, capacity, classTeacherId } = body;

    // School context: use auth's schoolId if user is not SUPER_ADMIN
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && schoolId ? schoolId : (auth.schoolId || schoolId);
    if (!targetSchoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    // Check for unique constraint
    const existing = await db.class.findFirst({
      where: { schoolId: targetSchoolId, name, section: section || null },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'A class with this name and section already exists in this school' },
        { status: 409 }
      );
    }

    // Verify classTeacher exists if provided
    if (classTeacherId) {
      const teacher = await db.teacher.findUnique({ where: { id: classTeacherId } });
      if (!teacher || teacher.schoolId !== targetSchoolId) {
        return NextResponse.json({ error: 'Class teacher not found' }, { status: 404 });
      }
    }

    const classData = await db.class.create({
      data: {
        schoolId: targetSchoolId,
        name,
        section: section || null,
        grade: grade || null,
        capacity: capacity || 40,
        classTeacherId: classTeacherId || null,
      },
    });

    return NextResponse.json({ data: classData, message: 'Class created successfully' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
