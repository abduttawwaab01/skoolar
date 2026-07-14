import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authenticateRequest } from '@/lib/auth-middleware';
import { notifyUsersByRole, notifyClassStudents } from '@/lib/notifications';

function isVisible(ann: { targetRoles: string | null; targetClasses: string | null }, userRole: string, userClassIds: string[]): boolean {
  if (ann.targetRoles) {
    try { const r: string[] = JSON.parse(ann.targetRoles); if (!r.includes(userRole)) return false; } catch { return false; }
  }
  if (ann.targetClasses) {
    try {
      const c: string[] = JSON.parse(ann.targetClasses);
      if (c.length > 0 && userClassIds.length > 0 && !userClassIds.some(id => c.includes(id))) return false;
    } catch { return false; }
  }
  return true;
}

// GET /api/announcements - List announcements with role/class-based read-side filtering
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const querySchoolId = searchParams.get('schoolId') || '';
    const type = searchParams.get('type') || '';
    const priority = searchParams.get('priority') || '';
    const isPublished = searchParams.get('isPublished');
    const search = searchParams.get('search') || '';

    // SECURITY: Auth token schoolId wins. Query param is only honored for SUPER_ADMIN.
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId
      ? querySchoolId
      : (auth.schoolId || '');
    if (!targetSchoolId && auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    // Look up user's classIds for read-side filtering
    let userClassIds: string[] = [];
    if (auth.role === 'STUDENT' && auth.userId) {
      const student = await db.student.findUnique({ where: { userId: auth.userId }, select: { classId: true } });
      if (student?.classId) userClassIds.push(student.classId);
    } else if (auth.role === 'PARENT' && auth.userId) {
      const parent = await db.parent.findUnique({
        where: { userId: auth.userId },
        select: { parentStudents: { select: { student: { select: { classId: true } } } } },
      });
      if (parent) userClassIds = parent.parentStudents.map(sp => sp.student.classId).filter(Boolean) as string[];
    }

    const isAdmin = auth.role === 'SUPER_ADMIN' || auth.role === 'SCHOOL_ADMIN' || auth.role === 'DIRECTOR';

    const where: Record<string, unknown> = {};
    if (targetSchoolId) where.schoolId = targetSchoolId;
    if (type) where.type = type;
    if (priority) where.priority = priority;
    if (isPublished !== null && isPublished !== undefined && isPublished !== '') {
      where.isPublished = isPublished === 'true';
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
      ];
    }

    // Over-fetch for post-filtering (admins skip filtering so no over-fetch needed)
    const fetchLimit = isAdmin ? limit : limit * 3;
    const skip = isAdmin ? (page - 1) * limit : 0;

    const [rawData, rawTotal] = await Promise.all([
      db.announcement.findMany({
        where,
        skip,
        take: fetchLimit,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true, schoolId: true, title: true, content: true, type: true,
          targetRoles: true, targetClasses: true, priority: true, isPublished: true,
          publishedAt: true, expiresAt: true, createdBy: true, createdAt: true, updatedAt: true,
          school: { select: { id: true, name: true } },
        },
      }),
      db.announcement.count({ where }),
    ]);

    // Post-filter for non-admins based on targeting
    const data = isAdmin
      ? rawData
      : rawData.filter(a => isVisible(a, auth.role || '', userClassIds));

    const total = isAdmin ? rawTotal : rawTotal;

    // Paginate filtered results
    const start = isAdmin ? 0 : (page - 1) * limit;
    const paged = data.slice(start, start + limit);

    return NextResponse.json({
      data: paged,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/announcements - Create announcement
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const body = await request.json();

    const { schoolId, title, content, type, targetRoles, targetClasses, priority, isPublished, expiresAt, createdBy } = body;

    if (!schoolId || !title || !content) {
      return NextResponse.json(
        { error: 'schoolId, title, and content are required' },
        { status: 400 }
      );
    }

    // SECURITY: Verify user belongs to the school they're trying to create announcement for
    // Super admins can create for any school, school admins can only create for their own school
    if (authResult.role !== 'SUPER_ADMIN' && authResult.schoolId !== schoolId) {
      return NextResponse.json(
        { error: 'You can only create announcements for your own school' },
        { status: 403 }
      );
    }

    const announcement = await db.announcement.create({
      data: {
        schoolId,
        title,
        content,
        type: type || 'general',
        targetRoles: targetRoles ? (Array.isArray(targetRoles) ? JSON.stringify(targetRoles) : targetRoles) : null,
        targetClasses: targetClasses ? (Array.isArray(targetClasses) ? JSON.stringify(targetClasses) : targetClasses) : null,
        priority: priority || 'normal',
        isPublished: isPublished || false,
        publishedAt: isPublished ? new Date() : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: createdBy || null,
      },
    });

    // Send notifications to target audience
    if (announcement.isPublished) {
      const parsedTargetRoles: string[] | null = targetRoles
        ? (typeof targetRoles === 'string' ? JSON.parse(targetRoles) : targetRoles)
        : null;
      const parsedTargetClasses: string[] | null = targetClasses
        ? (typeof targetClasses === 'string' ? JSON.parse(targetClasses) : targetClasses)
        : null;

      if (parsedTargetRoles && parsedTargetRoles.length > 0) {
        if (parsedTargetClasses && parsedTargetClasses.length > 0) {
          // Specific roles + specific classes: notify each class's students + role-wide users
          for (const classId of parsedTargetClasses) {
            await notifyClassStudents(classId, schoolId, title, content.substring(0, 200), {
              type: 'info',
              category: 'announcement',
              actionUrl: `/dashboard?view=announcements`,
              includeParents: parsedTargetRoles.includes('PARENT'),
            });
          }
          const roleOnlyTargets = parsedTargetRoles.filter(r => r !== 'STUDENT' && r !== 'PARENT');
          if (roleOnlyTargets.length > 0) {
            await notifyUsersByRole(schoolId, roleOnlyTargets, title, content.substring(0, 200), {
              type: 'info',
              category: 'announcement',
              actionUrl: `/dashboard?view=announcements`,
            });
          }
        } else {
          await notifyUsersByRole(schoolId, parsedTargetRoles, title, content.substring(0, 200), {
            type: 'info',
            category: 'announcement',
            actionUrl: `/dashboard?view=announcements`,
          });
        }
      } else if (parsedTargetClasses && parsedTargetClasses.length > 0) {
        for (const classId of parsedTargetClasses) {
          await notifyClassStudents(classId, schoolId, title, content.substring(0, 200), {
            type: 'info',
            category: 'announcement',
            actionUrl: `/dashboard?view=announcements`,
          });
        }
      } else {
        // No specific target — notify all school users via the SCHOOL_ADMIN role umbrella
        await notifyUsersByRole(schoolId, ['TEACHER', 'STUDENT', 'PARENT', 'DIRECTOR', 'ADMIN', 'ACCOUNTANT'], title, content.substring(0, 200), {
          type: 'info',
          category: 'announcement',
          actionUrl: `/dashboard?view=announcements`,
        });
      }
    }

    return NextResponse.json({ data: announcement, message: 'Announcement created successfully' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/announcements - Update announcement
export async function PUT(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const body = await request.json();
    const { id, schoolId, ...data } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // SECURITY: Verify the announcement belongs to user's school
    const existingAnnouncement = await db.announcement.findUnique({
      where: { id },
      select: { schoolId: true },
    });

    if (!existingAnnouncement) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    }

    // Super admins can edit any school's announcements, school admins only their own
    if (authResult.role !== 'SUPER_ADMIN' && authResult.schoolId !== existingAnnouncement.schoolId) {
      return NextResponse.json(
        { error: 'You can only edit announcements from your own school' },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.targetRoles !== undefined) updateData.targetRoles = typeof data.targetRoles === 'string' ? data.targetRoles : JSON.stringify(data.targetRoles);
    if (data.targetClasses !== undefined) updateData.targetClasses = typeof data.targetClasses === 'string' ? data.targetClasses : JSON.stringify(data.targetClasses);
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.isPublished !== undefined) {
      updateData.isPublished = data.isPublished;
      updateData.publishedAt = data.isPublished ? new Date() : null;
    }
    if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;

    const announcement = await db.announcement.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ data: announcement, message: 'Announcement updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/announcements - Delete announcement
export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // SECURITY: Verify the announcement belongs to user's school
    const existingAnnouncement = await db.announcement.findUnique({
      where: { id },
      select: { schoolId: true },
    });

    if (!existingAnnouncement) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    }

    // Super admins can delete any school's announcements, school admins only their own
    if (authResult.role !== 'SUPER_ADMIN' && authResult.schoolId !== existingAnnouncement.schoolId) {
      return NextResponse.json(
        { error: 'You can only delete announcements from your own school' },
        { status: 403 }
      );
    }

    await db.announcement.delete({ where: { id } });
    return NextResponse.json({ message: 'Announcement deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
