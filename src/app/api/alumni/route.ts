import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const querySchoolId = searchParams.get('schoolId') || '';
    const graduationYear = searchParams.get('graduationYear') || '';
    const occupation = searchParams.get('occupation') || '';
    const search = searchParams.get('search') || '';

    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId
      ? querySchoolId
      : (auth.schoolId || '');

    if (!targetSchoolId && auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const where: Record<string, unknown> = {};
    where.schoolId = targetSchoolId;

    if (graduationYear) where.graduationYear = parseInt(graduationYear);
    if (occupation) where.currentOccupation = { contains: occupation, mode: 'insensitive' };

    if (search) {
      where.OR = [
        { student: { user: { name: { contains: search, mode: 'insensitive' } } } },
        { currentOccupation: { contains: search, mode: 'insensitive' } },
        { employer: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [alumni, total] = await Promise.all([
      db.alumni.findMany({
        where,
        skip,
        take: limit,
        orderBy: { graduationYear: 'desc' },
        include: {
          student: {
            select: {
              id: true,
              admissionNo: true,
              photo: true,
              user: { select: { id: true, name: true, email: true, phone: true, avatar: true } },
            },
          },
          rsvps: { select: { id: true, eventId: true, status: true } },
        },
      }),
      db.alumni.count({ where }),
    ]);

    return NextResponse.json({
      data: alumni,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API Alumni GET]', error);
    return NextResponse.json({ error: 'Failed to fetch alumni' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { studentId, graduationYear, graduationTerm, finalClass, finalGpa, currentOccupation, employer, email, phone, address, city, country, linkedinUrl, facebookUrl, newsletterOptIn, notes } = body;

    const targetSchoolId = auth.schoolId || '';
    if (!targetSchoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const student = await db.student.findUnique({
      where: { id: studentId },
      select: { id: true, schoolId: true },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    if (student.schoolId !== targetSchoolId && auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Student does not belong to this school' }, { status: 403 });
    }

    const existing = await db.alumni.findUnique({ where: { studentId } });
    if (existing) {
      return NextResponse.json({ error: 'Student is already an alumni' }, { status: 409 });
    }

    const alumni = await db.alumni.create({
      data: {
        schoolId: targetSchoolId,
        studentId,
        graduationYear: graduationYear || new Date().getFullYear(),
        graduationTerm,
        finalClass,
        finalGpa,
        currentOccupation,
        employer,
        email,
        phone,
        address,
        city,
        country,
        linkedinUrl,
        facebookUrl,
        newsletterOptIn: newsletterOptIn !== false,
        notes,
      },
      include: {
        student: {
          select: {
            id: true,
            admissionNo: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    return NextResponse.json({ data: alumni, message: 'Alumni created successfully', timestamp: new Date().toISOString() }, { status: 201 });
  } catch (error) {
    console.error('[API Alumni POST]', error);
    return NextResponse.json({ error: 'Failed to create alumni' }, { status: 500 });
  }
}
