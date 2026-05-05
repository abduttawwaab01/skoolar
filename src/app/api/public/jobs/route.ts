import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const type = searchParams.get('type');
    const department = searchParams.get('department');
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const now = new Date();

    const where: Record<string, unknown> = {
      isActive: true,
      deletedAt: null,
      OR: [
        { expiresAt: null },
        { expiresAt: { gte: now } },
      ],
    };

    if (schoolId) {
      where.schoolId = schoolId;
    }

    if (type) where.type = type;
    if (department) where.department = department;
    if (search) {
      where.OR = [
        ...(where.OR as Array<Record<string, unknown>>),
        { title: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [jobs, total] = await Promise.all([
      db.jobPosting.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          department: true,
          description: true,
          location: true,
          type: true,
          experience: true,
          salaryMin: true,
          salaryMax: true,
          salaryCurrency: true,
          isRemote: true,
          expiresAt: true,
          code: true,
          school: {
            select: {
              id: true,
              name: true,
              logo: true,
              primaryColor: true,
            },
          },
        },
      }),
      db.jobPosting.count({ where }),
    ]);

    return NextResponse.json({
      data: jobs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}