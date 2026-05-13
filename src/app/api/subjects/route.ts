import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

 // GET /api/subjects - List subjects
 export async function GET(request: NextRequest) {
   try {
     const auth = await requireAuth(request);
     if (auth instanceof NextResponse) return auth;

     const { searchParams } = new URL(request.url);
     const page = parseInt(searchParams.get('page') || '1');
     const limit = parseInt(searchParams.get('limit') || '20');
     const schoolId = searchParams.get('schoolId') || '';
     const type = searchParams.get('type') || '';
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

     if (type) where.type = type;
     if (search) {
       where.OR = [
         { name: { contains: search } },
         { code: { contains: search } },
       ];
     }

    const [data, total] = await Promise.all([
      db.subject.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          schoolId: true,
          name: true,
          code: true,
          type: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          school: {
            select: { id: true, name: true },
          },
          _count: {
            select: {
              classes: true,
              exams: true,
            },
          },
        },
      }),
      db.subject.count({ where }),
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

 // POST /api/subjects - Create subject
 export async function POST(request: NextRequest) {
   const authResult = await requireAuth(request);
   if (authResult instanceof NextResponse) return authResult;
   const auth = authResult;

   try {
     // Only SCHOOL_ADMIN and SUPER_ADMIN can create subjects
     if (!['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(auth.role || '')) {
       return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
     }

     const body = await request.json();

     const { schoolId, name, code, type, description } = body;

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
     const existing = await db.subject.findFirst({
       where: { schoolId: targetSchoolId, name },
     });
     if (existing) {
       return NextResponse.json(
         { error: 'A subject with this name already exists in this school' },
         { status: 409 }
       );
     }

     const subject = await db.subject.create({
       data: {
         schoolId: targetSchoolId,
         name,
         code: code || null,
         type: type || 'core',
         description: description || null,
       },
     });

return NextResponse.json({ data: subject, message: 'Subject created successfully' }, { status: 201 });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // PUT /api/subjects - Update subject
  export async function PUT(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const auth = authResult;

    try {
      if (!['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(auth.role || '')) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }

      const body = await request.json();
      const { id, name, code, type, description } = body;

      if (!id) {
        return NextResponse.json({ error: 'id is required' }, { status: 400 });
      }

      const existing = await db.subject.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
      }

      // School isolation
      if (auth.role !== 'SUPER_ADMIN' && auth.schoolId !== existing.schoolId) {
        return NextResponse.json({ error: 'You can only update subjects from your own school' }, { status: 403 });
      }

      // Check for duplicate name in same school
      if (name && name !== existing.name) {
        const duplicate = await db.subject.findFirst({
          where: { schoolId: existing.schoolId, name, id: { not: id } },
        });
        if (duplicate) {
          return NextResponse.json({ error: 'A subject with this name already exists in this school' }, { status: 409 });
        }
      }

      const subject = await db.subject.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(code !== undefined && { code }),
          ...(type && { type }),
          ...(description !== undefined && { description }),
        },
      });

      return NextResponse.json({ data: subject, message: 'Subject updated successfully' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // DELETE /api/subjects - Delete subject
  export async function DELETE(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const auth = authResult;

    try {
      if (!['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(auth.role || '')) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }

      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');

      if (!id) {
        return NextResponse.json({ error: 'id is required' }, { status: 400 });
      }

      const existing = await db.subject.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
      }

      // School isolation
      if (auth.role !== 'SUPER_ADMIN' && auth.schoolId !== existing.schoolId) {
        return NextResponse.json({ error: 'You can only delete subjects from your own school' }, { status: 403 });
      }

      // Soft delete
      await db.subject.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      return NextResponse.json({ message: 'Subject deleted successfully' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
