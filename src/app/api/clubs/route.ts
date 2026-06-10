import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

const CACHE_CONTROL = 'public, s-maxage=30, stale-while-revalidate=60';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const querySchoolId = searchParams.get('schoolId') || '';
    const isActive = searchParams.get('isActive');

    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId
      ? querySchoolId
      : (auth.schoolId || '');
    if (!targetSchoolId && auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const where: Record<string, unknown> = {};
    where.deletedAt = null;
    if (targetSchoolId) where.schoolId = targetSchoolId;
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    const [data, total] = await Promise.all([
      db.club.findMany({
        where,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: {
              members: { where: { isActive: true } },
            },
          },
        },
      }),
      db.club.count({ where }),
    ]);

    const clubs = data.map((club) => ({
      id: club.id,
      schoolId: club.schoolId,
      name: club.name,
      description: club.description,
      mission: club.mission,
      patronName: club.patronName,
      patronId: club.patronId,
      meetingDay: club.meetingDay,
      meetingTime: club.meetingTime,
      meetingVenue: club.meetingVenue,
      membershipFee: club.membershipFee,
      isActive: club.isActive,
      logo: club.logo,
      socialLink: club.socialLink,
      createdAt: club.createdAt,
      updatedAt: club.updatedAt,
      memberCount: club._count.members,
    }));

    return NextResponse.json({ data: clubs, total }, {
      headers: { 'Cache-Control': CACHE_CONTROL },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { schoolId, name, description, mission, patronName, patronId, meetingDay, meetingTime, meetingVenue, membershipFee, logo, socialLink } = body;

    const targetSchoolId = auth.role === 'SUPER_ADMIN' && schoolId ? schoolId : (auth.schoolId || '');
    if (!targetSchoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const existing = await db.club.findFirst({
      where: { schoolId: targetSchoolId, name },
    });
    if (existing) {
      return NextResponse.json({ error: 'A club with this name already exists in this school' }, { status: 409 });
    }

    if (patronId) {
      const teacher = await db.teacher.findUnique({ where: { id: patronId } });
      if (!teacher || teacher.schoolId !== targetSchoolId) {
        return NextResponse.json({ error: 'Patron teacher not found' }, { status: 404 });
      }
    }

    const club = await db.club.create({
      data: {
        schoolId: targetSchoolId,
        name,
        description: description || null,
        mission: mission || null,
        patronName: patronName || null,
        patronId: patronId || null,
        meetingDay: meetingDay || 'Monday',
        meetingTime: meetingTime || '15:00',
        meetingVenue: meetingVenue || null,
        membershipFee: membershipFee ? parseFloat(membershipFee) : 0,
        logo: logo || null,
        socialLink: socialLink || null,
      },
    });

    return NextResponse.json({ data: club, message: 'Club created successfully' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
