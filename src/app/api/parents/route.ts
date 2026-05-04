import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

 // GET /api/parents - List parents with filters
 export async function GET(request: NextRequest) {
   try {
     const auth = await requireAuth(request);
     if (auth instanceof NextResponse) return auth;

     const { searchParams } = new URL(request.url);
     const page = parseInt(searchParams.get('page') || '1');
     const limit = parseInt(searchParams.get('limit') || '50');
     const schoolId = searchParams.get('schoolId') || '';
     const search = searchParams.get('search') || '';

     const where: Record<string, unknown> = {};
     where.deletedAt = null;

     // School context validation - users can only access their own school unless SUPER_ADMIN
     if (auth.role === 'SUPER_ADMIN' && schoolId) {
       where.schoolId = schoolId;
     } else if (auth.schoolId) {
       where.schoolId = auth.schoolId;
     } else {
       return NextResponse.json({ error: 'No school associated with account' }, { status: 403 });
     }

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
          parentStudents: {
            include: {
              student: {
                select: {
                  id: true,
                  admissionNo: true,
                  user: {
                    select: { name: true },
                  },
                },
              },
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
   const auth = authResult; // auth contains { id, schoolId, role, ... }

   try {
     // Only SCHOOL_ADMIN, TEACHER, and SUPER_ADMIN can create parents
     if (!['SCHOOL_ADMIN', 'TEACHER', 'SUPER_ADMIN'].includes(auth.role || '')) {
       return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
     }

     const body = await request.json();

     const { schoolId, name, email, phone, occupation, address } = body;

     // School context: use auth's schoolId if user is not SUPER_ADMIN
     const targetSchoolId = auth.role === 'SUPER_ADMIN' && schoolId ? schoolId : (auth.schoolId || schoolId);
     if (!targetSchoolId) {
       return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
     }

     if (!name || !email) {
       return NextResponse.json(
         { error: 'Name and email are required' },
         { status: 400 }
       );
     }

     // Check if email already exists
     const existingUser = await db.user.findUnique({ where: { email: email.toLowerCase() } });
     if (existingUser) {
       return NextResponse.json(
         { error: 'A user with this email already exists' },
         { status: 409 }
       );
     }

     // Check plan limits - enforce max parents (if applicable)
     const school = await db.school.findUnique({
       where: { id: targetSchoolId },
       include: { subscriptionPlan: true },
     });

     if (school) {
       // Optionally check plan limits for parents
       // const maxParents = school.subscriptionPlan?.maxParents || school.maxParents || 100;
       // const currentParentCount = await db.parent.count({ where: { schoolId: targetSchoolId, deletedAt: null } });
       // if (currentParentCount >= maxParents) { ... }
     }

     // Create User record
     const user = await db.user.create({
       data: {
         name,
         email: email.toLowerCase(),
         role: 'parent',
         schoolId: targetSchoolId,
         phone: phone || null,
         isActive: true,
       },
     });

      // Create Parent record
      const parent = await db.parent.create({
        data: {
          schoolId: targetSchoolId,
          userId: user.id,
          occupation: occupation || null,
          phone: phone || null,
          address: address || null,
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
