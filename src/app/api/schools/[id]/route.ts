import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/schools/[id] - Get single school by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    // School isolation - users can only access their own school unless SUPER_ADMIN
    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && id !== auth.schoolId) {
      return NextResponse.json({ error: 'You can only access your own school' }, { status: 403 });
    }

    const school = await db.school.findUnique({
      where: { id },
      include: {
        subscriptionPlan: true,
        _count: {
          select: {
            students: true,
            teachers: true,
            classes: true,
            subjects: true,
            parents: true,
            academicYears: true,
            exams: true,
            announcements: true,
            feeStructures: true,
            payments: true,
            books: true,
            feedbacks: true,
          },
        },
      },
    });

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    if (school.deletedAt) {
      return NextResponse.json({ error: 'School has been deleted' }, { status: 410 });
    }

    return NextResponse.json({ data: school });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/schools/[id] - Update school
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    // Only SUPER_ADMIN can update any school; SCHOOL_ADMIN can update only their school
    if (auth.role === 'SCHOOL_ADMIN' && auth.schoolId !== (await params).id) {
      return NextResponse.json({ error: 'You can only update your own school' }, { status: 403 });
    }
    if (auth.role !== 'SUPER_ADMIN' && auth.role !== 'SCHOOL_ADMIN') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    // Check if school exists
    const existing = await db.school.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    if (existing.deletedAt) {
      return NextResponse.json({ error: 'Cannot update a deleted school' }, { status: 410 });
    }

    // Check slug uniqueness if being updated
    if (body.slug && body.slug !== existing.slug) {
      const slugExists = await db.school.findUnique({ where: { slug: body.slug } });
      if (slugExists) {
        return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });
      }
    }

    const { name, slug, email, phone, address, motto, website, plan, region, isActive, maxStudents, maxTeachers, liveClassMaxParticipants, liveClassMaxDuration, liveClassMaxConcurrent, liveClassMaxMeetingsPerMonth, primaryColor, secondaryColor, foundedDate, planId, logo, schoolType, duration, endDate: customEndDate } = body;

    const updateData: Record<string, unknown> = {
      ...(name && { name }),
      ...(slug && { slug }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(address !== undefined && { address }),
      ...(motto !== undefined && { motto }),
      ...(website !== undefined && { website }),
      ...(plan && { plan }),
      ...(region !== undefined && { region }),
      ...(isActive !== undefined && { isActive }),
      ...(maxStudents && { maxStudents }),
      ...(maxTeachers && { maxTeachers }),
      ...(liveClassMaxParticipants !== undefined && { liveClassMaxParticipants }),
      ...(liveClassMaxDuration !== undefined && { liveClassMaxDuration }),
      ...(liveClassMaxConcurrent !== undefined && { liveClassMaxConcurrent }),
      ...(liveClassMaxMeetingsPerMonth !== undefined && { liveClassMaxMeetingsPerMonth }),
      ...(primaryColor && { primaryColor }),
      ...(secondaryColor && { secondaryColor }),
      ...(foundedDate !== undefined && { foundedDate: foundedDate ? new Date(foundedDate) : null }),
      ...(logo !== undefined && { logo }),
      ...(schoolType !== undefined && { schoolType }),
    };

    // If planId is being changed, validate it and create a PlatformPayment record
    if (planId && planId !== existing.planId) {
      const targetPlan = await db.subscriptionPlan.findUnique({
        where: { id: planId },
      });
      if (!targetPlan) {
        return NextResponse.json({ error: 'Target subscription plan not found' }, { status: 400 });
      }

      updateData.planId = planId;
      updateData.plan = targetPlan.name;

      // Deactivate existing active payments for this school
      await db.platformPayment.updateMany({
        where: {
          schoolId: id,
          status: 'success',
        },
        data: { status: 'expired' },
      });

      // Calculate endDate from duration, customEndDate, or default to +1 year
      let calculatedEndDate: Date;
      const isFree = targetPlan.pricingType === 'free';
      const isCustom = targetPlan.pricingType === 'custom';

      if (isFree) {
        calculatedEndDate = new Date('2099-12-31');
      } else if (customEndDate) {
        calculatedEndDate = new Date(customEndDate);
      } else if (duration) {
        const durationMonthMap: Record<string, number> = { monthly: 1, term: 4, session: 10 };
        const months = durationMonthMap[duration] || 12;
        calculatedEndDate = new Date();
        calculatedEndDate.setMonth(calculatedEndDate.getMonth() + months);
      } else {
        calculatedEndDate = new Date();
        calculatedEndDate.setFullYear(calculatedEndDate.getFullYear() + 1);
      }

      await db.platformPayment.create({
        data: {
          schoolId: id,
          planId: targetPlan.id,
          reference: isFree ? `free-${id}-${Date.now()}` : `manual-upgrade-${id}-${Date.now()}`,
          amount: isFree ? 0 : (isCustom ? 0 : targetPlan.price),
          currency: 'NGN',
          status: 'success',
          startDate: new Date(),
          endDate: calculatedEndDate,
          duration: (duration && !isFree) ? duration : null,
          channel: isFree ? 'free' : (isCustom ? 'custom_quote' : 'manual_upgrade'),
        },
      });
    }

    const school = await db.school.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ data: school, message: 'School updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/schools/[id] - Hard delete school and ALL associated data
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    // Only SUPER_ADMIN can delete schools
    if (auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only Super Admins can delete schools' }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.school.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    if (existing.deletedAt) {
      return NextResponse.json({ error: 'School already deleted' }, { status: 410 });
    }

console.log(`Starting cascade delete for school: ${id}`);

    // Helper function to safely delete data
    const safeDelete = async (deleteFn: () => Promise<unknown>) => {
      try {
        await deleteFn();
      } catch (e) {
        console.log('Delete operation completed or skipped:', e instanceof Error ? e.message : 'unknown');
      }
    };

    // 1. Get all related IDs first
    const academicYears = await db.academicYear.findMany({
      where: { schoolId: id },
      select: { id: true }
    });
    const academicYearIds = academicYears.map(ay => ay.id);

    const users = await db.user.findMany({
      where: { schoolId: id },
      select: { id: true }
    });
    const userIds = users.map(u => u.id);

    // 2. Delete data in correct order (parent tables last)

    // Delete dependent on AcademicYear/Terms
    if (academicYearIds.length > 0) {
      await db.term.deleteMany({ where: { academicYearId: { in: academicYearIds } } });
    }
    await db.academicYear.deleteMany({ where: { schoolId: id } });

    // Delete dependent on Users
    if (userIds.length > 0) {
      await db.student.deleteMany({ where: { userId: { in: userIds } } });
      await db.teacher.deleteMany({ where: { userId: { in: userIds } } });
      await db.parent.deleteMany({ where: { userId: { in: userIds } } });
      await db.accountant.deleteMany({ where: { userId: { in: userIds } } });
      await db.librarian.deleteMany({ where: { userId: { in: userIds } } });
      await db.director.deleteMany({ where: { userId: { in: userIds } } });
      await db.notification.deleteMany({ where: { userId: { in: userIds } } });
      await db.userSession.deleteMany({ where: { userId: { in: userIds } } });
      await db.pushSubscription.deleteMany({ where: { userId: { in: userIds } } });
      await db.auditLog.deleteMany({ where: { userId: { in: userIds } } });
    }
    await db.user.deleteMany({ where: { schoolId: id } });

    // Delete domain grades
    await safeDelete(() => db.domainGrade.deleteMany({ where: { schoolId: id } }));

    // Delete other school-related data
    await safeDelete(() => db.class.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.subject.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.scoreType.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.feeStructure.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.payment.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.platformPayment.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.attendance.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.attendanceScanLog.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.announcement.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.schoolNotice.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.entranceExam.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.feedback.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.healthRecord.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.behaviorLog.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.achievement.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.reportCard.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => (db as any).reportCardTemplate.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.studentDiary.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.teacherTask.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.teacherComment.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.teacherPerformance.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.studentPerformanceSnapshot.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.leaderboard.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.performanceBadge.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.encouragementMessage.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.weeklyEvaluation.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.timetable.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.transportRoute.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.libraryBook.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.borrowRecord.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.jobPosting.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.schoolEvent.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.message.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.conversation.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.supportTicket.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.videoLesson.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.exam.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.homework.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.registrationCode.deleteMany({ where: { schoolId: id } }));
    await safeDelete(() => db.schoolSettings.deleteMany({ where: { schoolId: id } }));

    // 3. Finally delete the school
    await db.school.delete({
      where: { id },
    });

    console.log(`Successfully deleted school and all related data: ${id}`);

    return NextResponse.json({ message: 'School and all associated data permanently deleted successfully.' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('School deletion error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
