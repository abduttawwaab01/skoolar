import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authenticateRequest } from '@/lib/auth-middleware';

// GET /api/video-lessons - List video lessons with filters
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const querySchoolId = searchParams.get('schoolId') || '';
    const subjectId = searchParams.get('subjectId') || '';
    const classId = searchParams.get('classId') || '';
    const teacherId = searchParams.get('teacherId') || '';
    const uploadedBy = searchParams.get('uploadedBy') || '';
    const isFeatured = searchParams.get('isFeatured');
    const sortBy = searchParams.get('sortBy') || 'recent'; // recent, popular, title
    const search = searchParams.get('search') || '';

    // SECURITY: Auth token schoolId wins. Query param is only honored for SUPER_ADMIN.
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId
      ? querySchoolId
      : (auth.schoolId || '');
    if (!targetSchoolId && auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const where: Record<string, unknown> = { deletedAt: null, schoolId: targetSchoolId };

    if (subjectId) where.subjectId = subjectId;
    if (classId) where.classId = classId;
    if (teacherId) where.uploadedBy = teacherId;
    if (uploadedBy) where.uploadedBy = uploadedBy;

    // STUDENT role: only see published video lessons for their class (including school-wide videos)
    if (auth.role === 'STUDENT' && !classId) {
      where.isPublished = true;
      const student = await db.student.findUnique({
        where: { userId: auth.userId },
        select: { classId: true },
      });
      if (student?.classId) {
        where.OR = [
          { classId: student.classId },
          { classId: null },
        ];
      }
    }

    // TEACHER role: only see video lessons for their classes
    if (auth.role === 'TEACHER' && !teacherId && !uploadedBy) {
      const teacher = await db.teacher.findUnique({
        where: { userId: auth.userId },
        select: {
          id: true,
          classes: { select: { id: true } },
          classSubjects: { select: { classId: true } },
        },
      });
      if (teacher) {
        const teacherClassIds = new Set<string>();
        teacher.classes.forEach(c => teacherClassIds.add(c.id));
        teacher.classSubjects.forEach(cs => teacherClassIds.add(cs.classId));
        if (teacherClassIds.size > 0) {
          where.OR = [
            { uploadedBy: auth.userId },
            { uploadedBy: teacher.id },
            { classId: { in: Array.from(teacherClassIds) } },
            { classId: null },
          ];
        } else {
          where.uploadedBy = auth.userId;
        }
      }
    }
    if (isFeatured !== null && isFeatured !== undefined && isFeatured !== '') {
      where.isFeatured = isFeatured === 'true';
    }
    if (search) {
      const searchCond = [
        { title: { contains: search } },
        { description: { contains: search } },
        { tags: { contains: search } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchCond }];
        delete where.OR;
      } else {
        where.OR = searchCond;
      }
    }

    let orderBy: Record<string, string> = { createdAt: 'desc' };
    if (sortBy === 'popular') orderBy = { viewCount: 'desc' };
    if (sortBy === 'title') orderBy = { title: 'asc' };

    const [data, total] = await Promise.all([
      db.videoLesson.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
        select: {
          id: true,
          schoolId: true,
          title: true,
          description: true,
          subjectId: true,
          classId: true,
          contentType: true,
          videoUrl: true,
          audioUrl: true,
          imageUrl: true,
          thumbnailUrl: true,
          duration: true,
          tags: true,
          viewCount: true,
          isFeatured: true,
          isPublished: true,
          uploadedBy: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.videoLesson.count({ where }),
    ]);

    // Get unique subjectIds and classIds for stats
    const subjectIds = [...new Set(data.map((d) => d.subjectId).filter(Boolean))] as string[];
    const classIds = [...new Set(data.map((d) => d.classId).filter(Boolean))] as string[];
    const uploaderIds = [...new Set(data.map((d) => d.uploadedBy).filter(Boolean))] as string[];

    const [subjects, classes, uploaders] = await Promise.all([
      subjectIds.length > 0
        ? db.subject.findMany({
            where: { id: { in: subjectIds } },
            select: { id: true, name: true },
          })
        : [],
      classIds.length > 0
        ? db.class.findMany({
            where: { id: { in: classIds } },
            select: { id: true, name: true },
          })
        : [],
      uploaderIds.length > 0
        ? db.user.findMany({
            where: { id: { in: uploaderIds } },
            select: { id: true, name: true, avatar: true },
          })
        : [],
    ]);

    const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s.name]));
    const classMap = Object.fromEntries(classes.map((c) => [c.id, c.name]));
    const uploaderMap = Object.fromEntries(uploaders.map((u) => [u.id, { name: u.name, avatar: u.avatar }]));

    const enrichedData = data.map((lesson) => ({
      ...lesson,
      subjectName: lesson.subjectId ? subjectMap[lesson.subjectId] || null : null,
      className: lesson.classId ? classMap[lesson.classId] || null : null,
      uploaderName: lesson.uploadedBy ? uploaderMap[lesson.uploadedBy]?.name || null : null,
      uploaderAvatar: lesson.uploadedBy ? uploaderMap[lesson.uploadedBy]?.avatar || null : null,
      tagsArray: lesson.tags ? lesson.tags.split(',').map((t) => t.trim()) : [],
    }));

    // Overall stats for the school
    const stats = targetSchoolId
      ? {
          totalLessons: total,
          totalWatchTime: 0, // Would need a watch history table for this
          categories: await db.videoLesson.groupBy({
            by: ['subjectId'],
            where: { schoolId: targetSchoolId, deletedAt: null },
            _count: true,
          }).then((groups) => groups.length),
          thisWeek: await db.videoLesson.count({
            where: {
              schoolId: targetSchoolId,
              deletedAt: null,
              createdAt: {
                gte: new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000),
              },
            },
          }),
        }
      : null;

    return NextResponse.json({
      data: enrichedData,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      stats,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/video-lessons - Create new video lesson
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR', 'TEACHER'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();

    const {
      schoolId: rawSchoolId,
      title,
      description,
      subjectId,
      classId,
      contentType,
      content,
      videoUrl,
      audioUrl,
      imageUrl,
      thumbnailUrl,
      duration,
      tags,
      isFeatured,
      isPublished,
      uploadedBy,
    } = body;

    // SECURITY: Auth token schoolId wins. Body is only honored for SUPER_ADMIN.
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && rawSchoolId
      ? rawSchoolId
      : (auth.schoolId || '');

    if (!targetSchoolId || !title) {
      return NextResponse.json(
        { error: 'schoolId and title are required' },
        { status: 400 }
      );
    }

    // Check plan limits - enforce max video lessons
    const school = await db.school.findUnique({
      where: { id: targetSchoolId },
      include: { subscriptionPlan: true },
    });

    if (school) {
      const maxVideoLessons = school.subscriptionPlan?.maxVideoLessons || 100;
      // If maxVideoLessons is -1, it means unlimited
      if (maxVideoLessons !== -1) {
        const currentVideoCount = await db.videoLesson.count({
          where: { schoolId: targetSchoolId, deletedAt: null },
        });
        
        if (currentVideoCount >= maxVideoLessons) {
          return NextResponse.json(
            { error: `Your plan allows maximum ${maxVideoLessons} video lessons. Please upgrade your plan to add more.` },
            { status: 403 }
          );
        }
      }
    }

    // Validate that at least one content field is provided based on contentType
    const ct = contentType || 'video';
    if (ct === 'video' && !videoUrl) {
      return NextResponse.json({ error: 'videoUrl is required for video lessons' }, { status: 400 });
    }
    if (ct === 'audio' && !audioUrl) {
      return NextResponse.json({ error: 'audioUrl is required for audio lessons' }, { status: 400 });
    }
    if (ct === 'image' && !imageUrl) {
      return NextResponse.json({ error: 'imageUrl is required for image lessons' }, { status: 400 });
    }
    if (ct === 'text' && !content) {
      return NextResponse.json({ error: 'content is required for text lessons' }, { status: 400 });
    }

    const videoLesson = await db.videoLesson.create({
      data: {
        schoolId: targetSchoolId,
        title,
        description: description || null,
        subjectId: subjectId || null,
        classId: classId || null,
        contentType: ct,
        content: content || null,
        videoUrl: videoUrl || null,
        audioUrl: audioUrl || null,
        imageUrl: imageUrl || null,
        thumbnailUrl: thumbnailUrl || null,
        duration: duration || 0,
        tags: tags ? (Array.isArray(tags) ? tags.join(',') : tags) : null,
        isFeatured: isFeatured || false,
        isPublished: isPublished !== undefined ? isPublished : true,
        uploadedBy: uploadedBy || null,
      },
    });

    return NextResponse.json(
      { data: videoLesson, message: 'Video lesson created successfully' },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/video-lessons - Soft-delete a video lesson
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR', 'TEACHER'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const existing = await db.videoLesson.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Video lesson not found' }, { status: 404 });
    }

    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Teachers can only delete their own video lessons
    if (auth.role === 'TEACHER') {
      if (!existing.uploadedBy) {
        return NextResponse.json({ error: 'Cannot delete: uploader info missing' }, { status: 403 });
      }
      const teacher = await db.teacher.findUnique({
        where: { userId: auth.userId },
        select: { id: true },
      });
      const ownerIds: string[] = [auth.userId || '', teacher?.id || ''].filter(Boolean);
      if (!ownerIds.includes(existing.uploadedBy)) {
        return NextResponse.json({ error: 'You can only delete your own video lessons' }, { status: 403 });
      }
    }

    await db.videoLesson.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ message: 'Video lesson deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/video-lessons - Update video lesson (view count, details)
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();

    const { id, viewCount, ...updateData } = body;

    const isEditor = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR', 'TEACHER'].includes(auth.role || '');
    const hasUpdateFields = Object.keys(updateData).length > 0 || typeof viewCount === 'number';

    if (hasUpdateFields && !isEditor) {
      return NextResponse.json({ error: 'Insufficient permissions to update video lesson details' }, { status: 403 });
    }

    if (viewCount !== true && !isEditor) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    const existing = await db.videoLesson.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Video lesson not found' },
        { status: 404 }
      );
    }

    // Enforce school isolation
    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Teachers can only update their own video lessons
    if (auth.role === 'TEACHER') {
      if (!existing.uploadedBy) {
        return NextResponse.json({ error: 'Cannot update: uploader info missing' }, { status: 403 });
      }
      const teacher = await db.teacher.findUnique({
        where: { userId: auth.userId },
        select: { id: true },
      });
      const ownerIds: string[] = [auth.userId || '', teacher?.id || ''].filter(Boolean);
      if (!ownerIds.includes(existing.uploadedBy)) {
        return NextResponse.json({ error: 'You can only update your own video lessons' }, { status: 403 });
      }
    }

    const data: Record<string, unknown> = {};
    if (viewCount === true) {
      data.viewCount = existing.viewCount + 1;
    } else if (typeof viewCount === 'number') {
      data.viewCount = viewCount;
    }

    if (updateData.title !== undefined) data.title = updateData.title;
    if (updateData.description !== undefined) data.description = updateData.description;
    if (updateData.subjectId !== undefined) data.subjectId = updateData.subjectId || null;
    if (updateData.classId !== undefined) data.classId = updateData.classId || null;
    if (updateData.contentType !== undefined) data.contentType = updateData.contentType;
    if (updateData.content !== undefined) data.content = updateData.content;
    if (updateData.videoUrl !== undefined) data.videoUrl = updateData.videoUrl;
    if (updateData.audioUrl !== undefined) data.audioUrl = updateData.audioUrl;
    if (updateData.imageUrl !== undefined) data.imageUrl = updateData.imageUrl;
    if (updateData.thumbnailUrl !== undefined) data.thumbnailUrl = updateData.thumbnailUrl;
    if (updateData.duration !== undefined) data.duration = updateData.duration;
    if (updateData.tags !== undefined) {
      data.tags = Array.isArray(updateData.tags)
        ? updateData.tags.join(',')
        : updateData.tags;
    }
    if (updateData.isFeatured !== undefined) data.isFeatured = updateData.isFeatured;
    if (updateData.isPublished !== undefined) data.isPublished = updateData.isPublished;

    const videoLesson = await db.videoLesson.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      data: videoLesson,
      message: 'Video lesson updated successfully',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
