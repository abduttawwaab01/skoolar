import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/parent-students - Get parent-student relationships
// Query params: parentId (user ID), studentId
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get('parentId');
    const studentId = searchParams.get('studentId');

    if (parentId) {
      // Get all students linked to this parent
      const parent = await db.parent.findUnique({
        where: { userId: parentId },
      });
      if (!parent) {
        return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
      }

      const studentIds = parent.childrenIds ? parent.childrenIds.split(',').filter(Boolean) : [];
      const students = await db.student.findMany({
        where: { id: { in: studentIds }, isActive: true },
        include: {
          user: { select: { name: true, email: true, avatar: true } },
          class: { select: { name: true, section: true, grade: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
      return NextResponse.json({ data: students });
    }

    if (studentId) {
      // Get all parents linked to this student
      const student = await db.student.findUnique({
        where: { id: studentId },
      });
      if (!student) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      }

      const parentIds = student.parentIds ? student.parentIds.split(',').filter(Boolean) : [];
      const parents = await db.parent.findMany({
        where: { userId: { in: parentIds } },
        include: {
          user: { select: { name: true, email: true, phone: true, avatar: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
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

      const existingIds = parent.childrenIds ? parent.childrenIds.split(',').filter(Boolean) : [];
      const newIds = [...new Set([...existingIds, ...studentIds])];

      await db.parent.update({
        where: { userId: parentId },
        data: { childrenIds: newIds.join(',') },
      });

      // Also update each student's parentIds
      for (const sid of studentIds) {
        const student = await db.student.findUnique({ where: { id: sid } });
        if (student) {
          const existingParentIds = student.parentIds ? student.parentIds.split(',').filter(Boolean) : [];
          if (!existingParentIds.includes(parentId)) {
            await db.student.update({
              where: { id: sid },
              data: { parentIds: [...existingParentIds, parentId].join(',') },
            });
          }
        }
      }

      return NextResponse.json({ success: true, message: `Linked ${studentIds.length} student(s) to parent` });
    }

    if (studentId && parentIds && Array.isArray(parentIds)) {
      // Link multiple parents to a student
      const student = await db.student.findUnique({ where: { id: studentId } });
      if (!student) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      }

      const existingIds = student.parentIds ? student.parentIds.split(',').filter(Boolean) : [];
      const newIds = [...new Set([...existingIds, ...parentIds])];

      await db.student.update({
        where: { id: studentId },
        data: { parentIds: newIds.join(',') },
      });

      // Also update each parent's childrenIds
      for (const pid of parentIds) {
        const parent = await db.parent.findUnique({ where: { userId: pid } });
        if (parent) {
          const existingChildrenIds = parent.childrenIds ? parent.childrenIds.split(',').filter(Boolean) : [];
          if (!existingChildrenIds.includes(studentId)) {
            await db.parent.update({
              where: { userId: pid },
              data: { childrenIds: [...existingChildrenIds, studentId].join(',') },
            });
          }
        }
      }

      return NextResponse.json({ success: true, message: `Linked ${parentIds.length} parent(s) to student` });
    }

    return NextResponse.json({ error: 'Invalid request. Provide parentId + studentIds or studentId + parentIds' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/parent-students - Unlink a parent from a student
// Body: { parentId: string, studentId: string }
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { parentId, studentId } = body;

    if (!parentId || !studentId) {
      return NextResponse.json({ error: 'Provide both parentId and studentId' }, { status: 400 });
    }

    // Remove studentId from parent's childrenIds
    const parent = await db.parent.findUnique({ where: { userId: parentId } });
    if (parent) {
      const existingChildrenIds = parent.childrenIds ? parent.childrenIds.split(',').filter(Boolean) : [];
      const updatedChildrenIds = existingChildrenIds.filter(id => id !== studentId);
      await db.parent.update({
        where: { userId: parentId },
        data: { childrenIds: updatedChildrenIds.join(',') },
      });
    }

    // Remove parentId from student's parentIds
    const student = await db.student.findUnique({ where: { id: studentId } });
    if (student) {
      const existingParentIds = student.parentIds ? student.parentIds.split(',').filter(Boolean) : [];
      const updatedParentIds = existingParentIds.filter(id => id !== parentId);
      await db.student.update({
        where: { id: studentId },
        data: { parentIds: updatedParentIds.join(',') },
      });
    }

    return NextResponse.json({ success: true, message: 'Parent and student unlinked' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
