import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

function generateJobCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const schoolId = searchParams.get('schoolId') || auth.schoolId;
    const isActive = searchParams.get('isActive');
    const type = searchParams.get('type');
    const department = searchParams.get('department');
    const search = searchParams.get('search') || '';

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 });
    }

    const where: Record<string, unknown> = {
      schoolId,
      deletedAt: null,
    };

    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }
    if (type) where.type = type;
    if (department) where.department = department;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      db.jobPosting.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { applications: true },
          },
        },
      }),
      db.jobPosting.count({ where }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
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

    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const {
      title,
      department,
      description,
      requirements,
      responsibilities,
      qualifications,
      location,
      type,
      experience,
      salaryMin,
      salaryMax,
      salaryCurrency,
      isRemote,
      expiresAt,
      applicationUrl,
    } = body;

    let { schoolId } = body;
    schoolId = schoolId || auth.schoolId;

    if (!title || !schoolId || !description) {
      return NextResponse.json(
        { error: 'Title, school ID, and description are required' },
        { status: 400 }
      );
    }

    let isUnique = false;
    let code = '';
    while (!isUnique) {
      code = generateJobCode();
      const existing = await db.jobPosting.findUnique({ where: { code } });
      if (!existing) isUnique = true;
    }

    const jobPosting = await db.jobPosting.create({
      data: {
        schoolId,
        title,
        department: department || null,
        description,
        requirements: requirements || null,
        responsibilities: responsibilities || null,
        qualifications: qualifications || null,
        location: location || null,
        type: type || 'full_time',
        experience: experience || null,
        salaryMin: salaryMin || null,
        salaryMax: salaryMax || null,
        salaryCurrency: salaryCurrency || null,
        isRemote: isRemote !== undefined ? isRemote : false,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        applicationUrl: applicationUrl || null,
        code,
        isActive: true,
      },
    });

    return NextResponse.json(
      { data: jobPosting, message: 'Job posting created' },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}