import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, requireAuth } from '@/lib/auth-middleware';

const GOOGLE_SHEET_URL = process.env.GOOGLE_SHEET_URL || '';

async function submitToGoogleSheet(data: Record<string, unknown>) {
  if (!GOOGLE_SHEET_URL) return;
  try {
    await fetch(GOOGLE_SHEET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch {
    console.error('Failed to submit to Google Sheet');
  }
}

async function setupSchoolStructure(schoolId: string) {
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  const academicYearName = `${currentYear}/${nextYear}`;

  const freePlan = await db.subscriptionPlan.findUnique({ where: { name: 'free' } });

  if (freePlan) {
    await db.school.update({ where: { id: schoolId }, data: { planId: freePlan.id } });
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    await db.platformPayment.create({
      data: { schoolId, planId: freePlan.id, reference: `free-${schoolId}`, amount: 0, currency: 'NGN', status: 'active', startDate: new Date(), endDate: oneYearFromNow },
    });
  }

  await db.schoolSettings.create({
    data: { schoolId, scoreSystem: 'midterm_exam', fontFamily: 'Inter', theme: 'default', academicSession: academicYearName },
  });

  await Promise.all([
    db.scoreType.create({ data: { schoolId, name: 'Daily Test', type: 'daily', maxMarks: 10, weight: 0.5, position: 0, isInReport: false } }),
    db.scoreType.create({ data: { schoolId, name: 'Weekly Test', type: 'weekly', maxMarks: 20, weight: 1, position: 1, isInReport: true } }),
    db.scoreType.create({ data: { schoolId, name: 'Mid Term Exam', type: 'exam', maxMarks: 100, weight: 3, position: 2, isInReport: true } }),
    db.scoreType.create({ data: { schoolId, name: 'Project Work', type: 'project', maxMarks: 10, weight: 1, position: 3, isInReport: true } }),
    db.scoreType.create({ data: { schoolId, name: 'Final Exam', type: 'exam', maxMarks: 100, weight: 4, position: 4, isInReport: true } }),
  ]);

  const academicYear = await db.academicYear.create({
    data: { schoolId, name: academicYearName, startDate: new Date(currentYear, 8, 1), endDate: new Date(nextYear, 6, 31), isCurrent: true, isLocked: false },
  });

  await Promise.all([
    db.term.create({ data: { academicYearId: academicYear.id, schoolId, name: 'First Term', order: 1, startDate: new Date(currentYear, 8, 1), endDate: new Date(currentYear, 11, 19), isCurrent: false, isLocked: false } }),
    db.term.create({ data: { academicYearId: academicYear.id, schoolId, name: 'Second Term', order: 2, startDate: new Date(nextYear, 0, 7), endDate: new Date(nextYear, 2, 28), isCurrent: true, isLocked: false } }),
    db.term.create({ data: { academicYearId: academicYear.id, schoolId, name: 'Third Term', order: 3, startDate: new Date(nextYear, 3, 21), endDate: new Date(nextYear, 6, 31), isCurrent: false, isLocked: false } }),
  ]);
}

// GET /api/schools - List all schools with pagination, search, and filters
// Also available via /api/public/schools for unauthenticated access
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isPublic = searchParams.get('public') === 'true';
    
    // For public access (login page), only return basic school info without auth
    if (isPublic) {
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '100');
      const search = searchParams.get('search') || '';
      const isActive = searchParams.get('isActive');

      const where: Record<string, unknown> = { deletedAt: null };
      if (isActive !== null && isActive !== undefined && isActive !== '') {
        where.isActive = isActive === 'true';
      } else {
        where.isActive = true;
      }
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        db.school.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { name: 'asc' },
          select: { id: true, name: true, slug: true, logo: true, isActive: true },
        }),
        db.school.count({ where }),
      ]);

      return NextResponse.json({
        data,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    }

    // Authenticated access - require SUPER_ADMIN
    const auth = await requireRole(request, ['SUPER_ADMIN']);
    if (auth instanceof NextResponse) return auth;

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
    const auth = await requireRole(request, ['SUPER_ADMIN']);
    if (auth instanceof NextResponse) return auth;

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

    // Auto-setup school structure (academic year, terms, settings)
    await setupSchoolStructure(school.id);

    // Submit to Google Sheet
    await submitToGoogleSheet({
      type: 'school',
      name: school.name,
      slug: school.slug,
      email: school.email,
      phone: school.phone,
      region: school.region,
      plan: school.plan,
    });

    return NextResponse.json(school, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
