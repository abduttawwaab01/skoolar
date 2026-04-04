import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/parents - List parents with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const schoolId = searchParams.get('schoolId') || '';
    const search = searchParams.get('search') || '';

    const where: Record<string, unknown> = {};
    where.deletedAt = null;

    if (schoolId) where.schoolId = schoolId;
    if (search) {
      where.OR = [
        { user: { name: { contains: search } } },
        { user: { email: { contains: search } } },
        { phone: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      db.parent.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          schoolId: true,
          userId: true,
          occupation: true,
          phone: true,
          address: true,
          childrenIds: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              avatar: true,
              isActive: true,
            },
          },
        },
      }),
      db.parent.count({ where }),
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

// POST /api/parents - Create parent + create User record
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const body = await request.json();

    const { schoolId, name, email, phone, occupation, address } = body;

    if (!schoolId || !name || !email) {
      return NextResponse.json(
        { error: 'schoolId, name, and email are required' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 }
      );
    }

    // Create User record
    const user = await db.user.create({
      data: {
        name,
        email,
        role: 'parent',
        schoolId,
        phone: phone || null,
        isActive: true,
      },
    });

    // Create Parent record
    const parent = await db.parent.create({
      data: {
        schoolId,
        userId: user.id,
        occupation: occupation || null,
        phone: phone || null,
        address: address || null,
        childrenIds: '',
      },
    });

    return NextResponse.json(
      { data: { ...parent, user }, message: 'Parent created successfully' },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
