import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-middleware';

// GET /api/schools - List all schools with pagination, search, and filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const plan = searchParams.get('plan') || '';
    const region = searchParams.get('region') || '';
    const isActive = searchParams.get('isActive');

    const where: Record<string, unknown> = {};

    // Soft delete filter
    where.deletedAt = null;

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { slug: { contains: search } },
      ];
    }
    if (plan) {
      where.plan = plan;
    }
    if (region) {
      where.region = region;
    }
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    const [data, total] = await Promise.all([
      db.school.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          address: true,
          motto: true,
          phone: true,
          email: true,
          website: true,
          primaryColor: true,
          secondaryColor: true,
          region: true,
          plan: true,
          planId: true,
          isActive: true,
          maxStudents: true,
          maxTeachers: true,
          foundedDate: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              students: true,
              teachers: true,
              classes: true,
            },
          },
        },
      }),
      db.school.count({ where }),
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

// POST /api/schools - Create a new school
export async function POST(request: NextRequest) {
  try {
    const authResponse = await requireRole(request, ['SUPER_ADMIN']);
    if (authResponse instanceof NextResponse) return authResponse;
    
    const body = await request.json();

    const { name, slug, email, plan, region, phone, address, motto, website, maxStudents, maxTeachers, primaryColor, secondaryColor, foundedDate } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'School name and slug are required' },
        { status: 400 }
      );
    }

    // Check if slug already exists
    const existing = await db.school.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { error: 'A school with this slug already exists' },
        { status: 409 }
      );
    }

    // Check if email already exists
    if (email) {
      const existingEmail = await db.school.findFirst({ where: { email } });
      if (existingEmail) {
        return NextResponse.json(
          { error: 'A school with this email already exists' },
          { status: 409 }
        );
      }
    }

    const school = await db.school.create({
      data: {
        name,
        slug,
        email: email || null,
        phone: phone || null,
        address: address || null,
        motto: motto || null,
        website: website || null,
        plan: plan || 'basic',
        region: region || null,
        maxStudents: maxStudents || 500,
        maxTeachers: maxTeachers || 50,
        primaryColor: primaryColor || '#059669',
        secondaryColor: secondaryColor || '#10B981',
        foundedDate: foundedDate ? new Date(foundedDate) : null,
      },
    });

    return NextResponse.json(school, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
