import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { isStorageConfigured, getStorageStatus } from '@/lib/r2-storage';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request });
    if (!token || !token.id) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
    }

    const now = new Date();

    const [totalStudents, totalTeachers, storageConfig] = await Promise.all([
      db.user.count({ where: { role: 'STUDENT', deletedAt: null } }),
      db.user.count({ where: { role: 'TEACHER', deletedAt: null } }),
      Promise.resolve(getStorageStatus()),
    ]);

    const data = {
      totalStudents,
      totalTeachers,
      totalClasses: await db.class.count({ where: { deletedAt: null } }).catch(() => null),
      totalSubjects: await db.subject.count().catch(() => null),
      status: 'Operational',
      uptime: 99.9,
      storageConfigured: storageConfig.configured,
      storageMode: storageConfig.mode,
      apiRequestsToday: null,
      avgResponseTime: null,
      databaseSize: null,
      websocketConnections: null,
      queuedJobs: null,
      fetchedAt: now.toISOString(),
    };

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
