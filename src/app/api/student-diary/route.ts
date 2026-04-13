import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, authenticateRequest, getSchoolId } from '@/lib/auth-middleware';

// GET /api/student-diary - List diary entries with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId') || '';
    const month = searchParams.get('month') || ''; // YYYY-MM format
    const search = searchParams.get('search') || '';

    // Auth is optional for GET — use schoolId from query or auth token
    const auth = await authenticateRequest(request);
    const schoolId = getSchoolId(request, auth);

    const where: Record<string, unknown> = {};

    if (schoolId) {
      where.schoolId = schoolId;
    }
    if (studentId) {
      where.studentId = studentId;
    }
    if (month) {
      where.date = { startsWith: month };
    }
    if (search) {
      where.OR = [
        { highlight: { contains: search } },
        { learned: { contains: search } },
        { teacherFeedback: { contains: search } },
        { goalsTomorrow: { contains: search } },
      ];
    }

    const entries = await db.studentDiary.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    // Calculate stats
    const moodValues: Record<string, number> = { happy: 5, good: 4, okay: 3, bad: 2, terrible: 1 };
    const totalEntries = entries.length;
    const totalMood = entries.reduce((sum, e) => sum + (moodValues[e.mood] || 3), 0);
    const averageMood = totalEntries > 0 ? (totalMood / totalEntries).toFixed(1) : '0';

    // Calculate streaks
    const sortedByDate = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    let longestStreak = 0;
    let tempStreak = 1;

    for (let i = 0; i < sortedByDate.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        const prev = new Date(sortedByDate[i - 1].date);
        const curr = new Date(sortedByDate[i].date);
        const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays <= 1) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
      }
      if (tempStreak > longestStreak) longestStreak = tempStreak;
    }

    // Current streak (from most recent entry going back)
    let currentStreak = 0;
    const today = new Date();
    for (let i = 0; i < sortedByDate.length; i++) {
      const entryDate = new Date(sortedByDate[i].date);
      const diffDays = Math.floor((today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
      if (i === 0 && diffDays <= 1) {
        currentStreak = 1;
      } else if (currentStreak > 0 && i < sortedByDate.length) {
        const prev = new Date(sortedByDate[i - 1].date);
        const curr = new Date(sortedByDate[i].date);
        const gap = Math.floor((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
        if (gap <= 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // Mood history for the last 30 days
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    const last30Days = entries.filter(e => new Date(e.date) >= thirtyDaysAgo);

    return NextResponse.json({
      data: entries,
      total: totalEntries,
      stats: {
        totalEntries,
        currentStreak,
        longestStreak,
        averageMood: parseFloat(averageMood),
      },
      moodHistory: last30Days.map(e => ({
        date: e.date,
        mood: e.mood,
        moodValue: moodValues[e.mood],
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/student-diary - Create or upsert a diary entry
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { date, mood, highlight, learned, teacherFeedback, goalsTomorrow, studentId, schoolId } = body;

    if (!date || !mood) {
      return NextResponse.json(
        { error: 'Date and mood are required' },
        { status: 400 }
      );
    }

    const resolvedSchoolId = schoolId || authResult.schoolId;
    if (!resolvedSchoolId) {
      return NextResponse.json(
        { error: 'School ID is required' },
        { status: 400 }
      );
    }

    const resolvedStudentId = studentId || '';
    if (!resolvedStudentId) {
      return NextResponse.json(
        { error: 'Student ID is required' },
        { status: 400 }
      );
    }

    // Upsert: create or update existing entry for the same school + student + date
    const entry = await db.studentDiary.upsert({
      where: {
        schoolId_studentId_date: {
          schoolId: resolvedSchoolId,
          studentId: resolvedStudentId,
          date,
        },
      },
      update: {
        mood,
        ...(highlight !== undefined && { highlight }),
        ...(learned !== undefined && { learned }),
        ...(teacherFeedback !== undefined && { teacherFeedback }),
        ...(goalsTomorrow !== undefined && { goalsTomorrow }),
      },
      create: {
        schoolId: resolvedSchoolId,
        studentId: resolvedStudentId,
        date,
        mood,
        highlight: highlight || '',
        learned: learned || '',
        teacherFeedback: teacherFeedback || '',
        goalsTomorrow: goalsTomorrow || '',
      },
    });

    return NextResponse.json({ data: entry, message: 'Diary entry saved successfully' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/student-diary - Update a diary entry
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { id, mood, highlight, learned, teacherFeedback, goalsTomorrow } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Diary entry ID is required' },
        { status: 400 }
      );
    }

    // Check that the entry exists
    const existing = await db.studentDiary.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Diary entry not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (mood !== undefined) updateData.mood = mood;
    if (highlight !== undefined) updateData.highlight = highlight;
    if (learned !== undefined) updateData.learned = learned;
    if (teacherFeedback !== undefined) updateData.teacherFeedback = teacherFeedback;
    if (goalsTomorrow !== undefined) updateData.goalsTomorrow = goalsTomorrow;

    const entry = await db.studentDiary.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ data: entry, message: 'Diary entry updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/student-diary - Delete a diary entry
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Diary entry ID is required' },
        { status: 400 }
      );
    }

    // Check that the entry exists
    const existing = await db.studentDiary.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Diary entry not found' },
        { status: 404 }
      );
    }

    await db.studentDiary.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Diary entry deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
