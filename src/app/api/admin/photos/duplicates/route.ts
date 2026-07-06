import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/admin/photos/duplicates?action=report&schoolId=... -> report duplicates
// POST /api/admin/photos/duplicates?action=clean&schoolId=... -> best-effort clean (nullify duplicates)
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (!['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(auth.role || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const schoolId = searchParams.get('schoolId') || (auth.role === 'SUPER_ADMIN' ? undefined : auth.schoolId);
  if (!schoolId) return NextResponse.json({ error: 'schoolId required' }, { status: 400 });

  // Find duplicated photo URLs among students
  const duplicates = await db.$queryRawUnsafe(`
    SELECT photo, COUNT(*) as cnt
    FROM "Student"
    WHERE "photo" IS NOT NULL AND "photo" <> '' AND "schoolId" = $1
    GROUP BY photo
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
  `, schoolId);

  const result: any[] = [];
  for (const row of duplicates as any[]) {
    const photo = row.photo as string;
    const students = await db.student.findMany({ where: { photo, schoolId }, include: { user: { select: { id: true, avatar: true, name: true } } } });
    result.push({ photo, count: students.length, students: students.map(s => ({ id: s.id, admissionNo: s.admissionNo, userId: s.userId, userName: s.user?.name, userAvatar: s.user?.avatar })) });
  }

  return NextResponse.json({ data: result });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (!['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(auth.role || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const schoolId = searchParams.get('schoolId') || (auth.role === 'SUPER_ADMIN' ? undefined : auth.schoolId);
  const force = searchParams.get('force') === '1' || searchParams.get('force') === 'true';
  if (!schoolId) return NextResponse.json({ error: 'schoolId required' }, { status: 400 });

  // Find duplicates
  const duplicates = await db.$queryRawUnsafe(`
    SELECT photo, COUNT(*) as cnt
    FROM "Student"
    WHERE "photo" IS NOT NULL AND "photo" <> '' AND "schoolId" = $1
    GROUP BY photo
    HAVING COUNT(*) > 1
  `, schoolId);

  const report: any[] = [];
  for (const row of duplicates as any[]) {
    const photo = row.photo as string;
    const students = await db.student.findMany({ where: { photo, schoolId }, include: { user: { select: { id: true, avatar: true, name: true } } } });

    // Heuristic: if exactly one student's user.avatar === photo, preserve that one and null others
    const keepCandidates = students.filter(s => s.user?.avatar === photo);
    if (keepCandidates.length === 1) {
      const keepId = keepCandidates[0].id;
      const toNull = students.filter(s => s.id !== keepId).map(s => s.id);
      report.push({ photo, keep: keepId, nullified: toNull });
      if (force) {
        await db.student.updateMany({ where: { id: { in: toNull } }, data: { photo: null } });
      }
    } else {
      // Ambiguous: don't change unless forced. If forced, nullify all but the student whose user.avatar matches (if any), otherwise nullify none.
      if (force) {
        let toNull: string[] = [];
        if (keepCandidates.length >= 1) {
          const keepId = keepCandidates[0].id;
          toNull = students.filter(s => s.id !== keepId).map(s => s.id);
          await db.student.updateMany({ where: { id: { in: toNull } }, data: { photo: null } });
          report.push({ photo, keep: keepId, nullified: toNull, note: 'forced, kept first matching avatar' });
        } else {
          // No matching user avatars — skip
          report.push({ photo, keep: null, nullified: [], note: 'ambiguous, no action taken' });
        }
      } else {
        report.push({ photo, keep: null, nullified: [], note: 'ambiguous' });
      }
    }
  }

  return NextResponse.json({ data: report });
}
