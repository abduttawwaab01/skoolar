import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { validateParentChild } from '@/lib/api-helpers';

// GET /api/parent-students - Get parent-student relationships
// Query params: parentId (user ID), studentId
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get('parentId');
    const studentId = searchParams.get('studentId');

    if (parentId) {
      // ✅ FIXED: Validate parent can only access their own data
      if (auth.role === 'PARENT' && auth.userId !== parentId) {
        return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
      }

      // Get all students linked to this parent via StudentParent table
      const parent = await db.parent.findUnique({
        where: { userId: parentId },
      });
      if (!parent) {
        return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
      }

      const studentParents = await db.studentParent.findMany({
        where: { parentId: parent.id },
        include: {
          student: {
            include: {
              user: { select: { name: true, email: true, avatar: true } },
              class: { select: { name: true, section: true, grade: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      const students = studentParents.map(sp => sp.student);
      return NextResponse.json({ data: students });
    }

    if (studentId) {
      // ✅ FIXED: Validate parent can only view their children's data
      if (auth.role === 'PARENT') {
        if (!auth.userId) {
          return NextResponse.json({ error: 'User ID not found' }, { status: 400 });
        }
        const canAccess = await validateParentChild(auth.userId, studentId);
        if (!canAccess) {
          return NextResponse.json({ error: 'Unauthorized access to this student' }, { status: 403 });
        }
      }

      // Get all parents linked to this student via StudentParent table
      const student = await db.student.findUnique({
        where: { id: studentId },
      });
      if (!student) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      }

      const studentParents = await db.studentParent.findMany({
        where: { studentId: student.id },
        include: {
          parent: {
            include: {
              user: { select: { name: true, email: true, phone: true, avatar: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      const parents = studentParents.map(sp => sp.parent);
      return NextResponse.json({ data: parents });
    }

    return NextResponse.json({ error: 'Provide parentId or studentId' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/parent-students - Link a parent to a student (or multiple)
// Body: { parentId: string (user ID), studentIds: string[] } OR { studentId: string, parentIds: string[] }
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    // Only SCHOOL_ADMIN can create parent-student relationships
    if (!['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { parentId, studentIds, studentId, parentIds } = body;

    if (!parentId && !studentId) {
      return NextResponse.json({ error: 'Provide parentId or studentId' }, { status: 400 });
    }

    if (parentId && studentIds && Array.isArray(studentIds)) {
      // Link multiple students to a parent
      const parent = await db.parent.findUnique({ where: { userId: parentId } });
      if (!parent) {
        return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
      }

      // Create StudentParent records for each student
      let createdCount = 0;
      for (const sid of studentIds) {
        // Check if relationship already exists
        const existing = await db.studentParent.findUnique({
          where: {
            studentId_parentId: { studentId: sid, parentId: parent.id },
          },
        });

        if (!existing) {
          await db.studentParent.create({
            data: {
              studentId: sid,
              parentId: parent.id,
            },
          });
          createdCount++;
        }
      }

      return NextResponse.json({ success: true, message: `Linked ${createdCount} student(s) to parent` });
    }

    if (studentId && parentIds && Array.isArray(parentIds)) {
      // Link multiple parents to a student
      const student = await db.student.findUnique({ where: { id: studentId } });
      if (!student) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      }

      // Create StudentParent records for each parent
      let createdCount = 0;
      for (const pid of parentIds) {
        const parent = await db.parent.findUnique({ where: { userId: pid } });
        if (!parent) continue;

        // Check if relationship already exists
        const existing = await db.studentParent.findUnique({
          where: {
            studentId_parentId: { studentId: student.id, parentId: parent.id },
          },
        });

        if (!existing) {
          await db.studentParent.create({
            data: {
              studentId: student.id,
              parentId: parent.id,
            },
          });
          createdCount++;
        }
      }

      return NextResponse.json({ success: true, message: `Linked ${createdCount} parent(s) to student` });
    }

    return NextResponse.json({ error: 'Invalid request. Provide parentId + studentIds or studentId + parentIds' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/parent-students - Unlink a parent from a student
// Body: { parentId: string (user ID), studentId: string }
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    // Only SCHOOL_ADMIN can delete parent-student relationships
    if (!['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { parentId, studentId } = body;

    if (!parentId || !studentId) {
      return NextResponse.json({ error: 'Provide both parentId and studentId' }, { status: 400 });
    }

    // Find the parent by userId
    const parent = await db.parent.findUnique({ where: { userId: parentId } });
    if (!parent) {
      return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
    }

    // Delete the StudentParent record
    await db.studentParent.deleteMany({
      where: {
        studentId,
        parentId: parent.id,
      },
    });

    return NextResponse.json({ success: true, message: 'Parent and student unlinked' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
