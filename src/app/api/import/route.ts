import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { db } from '@/lib/db';
import { parse } from 'csv-parse';
import { Readable } from 'stream';
import { handleSilentError } from '@/lib/error-handler';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    if (!['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(auth.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string | null;
    const bodySchoolId = formData.get('schoolId') as string | null;
    // Auth-first: SUPER_ADMIN may use body schoolId; others must use their own
    const schoolId = auth.role === 'SUPER_ADMIN' && bodySchoolId
      ? bodySchoolId
      : (auth.schoolId || '');
    const columnMappingStr = formData.get('columnMapping') as string | null;

    if (!file || !type || !schoolId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const csvText = await file.text();
    const columns = JSON.parse(columnMappingStr || '{}');

    const records: Record<string, string>[] = [];
    await new Promise<void>((resolve, reject) => {
      const readable = Readable.from(csvText);
      readable
        .pipe(parse({ columns: true, trim: true }))
        .on('data', (row) => {
          const mapped: Record<string, string> = {};
          Object.entries(columns).forEach(([csvCol, dbCol]) => {
            if (dbCol) mapped[dbCol as string] = row[csvCol] || '';
          });
          records.push(mapped);
        })
        .on('end', () => resolve())
        .on('error', reject);
    });

    let successCount = 0;
    let failedCount = 0;

    if (type === 'Students') {
      for (const row of records) {
        try {
          const name = row.firstName && row.lastName
            ? `${row.firstName} ${row.lastName}`.trim()
            : row.firstName || row.name || 'Student';
          const email = row.email || `${name.toLowerCase().replace(/\s+/g, '.')}.${Date.now()}@school.local`;
          const password = row.password || 'skoolar123';
          const admissionNo = row.admissionNo || `BULK-${Date.now()}-${successCount}`;

          const existingUser = await db.user.findUnique({ where: { email } });
          if (existingUser) { failedCount++; continue; }

          const existingAdm = await db.student.findFirst({
            where: { schoolId, admissionNo, deletedAt: null },
          });
          if (existingAdm) { failedCount++; continue; }

          const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
          const user = await db.user.create({
            data: {
              name,
              email,
              password: hashedPassword,
              role: 'STUDENT',
              schoolId,
              isActive: true,
              emailVerified: new Date(),
            },
          });
          await db.student.create({
            data: {
              schoolId,
              userId: user.id,
              admissionNo,
              dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth) : undefined,
              gender: row.gender || null,
              address: row.address || null,
              bloodGroup: row.bloodGroup || null,
              isActive: true,
            },
          });
          successCount++;
        } catch {
          failedCount++;
        }
      }
    } else if (type === 'Teachers') {
      for (const row of records) {
        try {
          const name = row.firstName && row.lastName
            ? `${row.firstName} ${row.lastName}`.trim()
            : row.firstName || row.name || 'Teacher';
          const email = row.email || `${name.toLowerCase().replace(/\s+/g, '.')}.${Date.now()}@school.local`;
          const password = row.password || 'skoolar123';
          const employeeNo = row.employeeNo || `TCH-${Date.now()}-${successCount}`;

          const existingUser = await db.user.findUnique({ where: { email } });
          if (existingUser) { failedCount++; continue; }

          const existingEmp = await db.teacher.findFirst({
            where: { schoolId, employeeNo, deletedAt: null },
          });
          if (existingEmp) { failedCount++; continue; }

          const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
          const user = await db.user.create({
            data: {
              name,
              email,
              password: hashedPassword,
              role: 'TEACHER',
              schoolId,
              isActive: true,
              emailVerified: new Date(),
            },
          });
          await db.teacher.create({
            data: {
              schoolId,
              userId: user.id,
              employeeNo,
              specialization: row.specialization || null,
              qualification: row.qualification || null,
            },
          });
          successCount++;
        } catch {
          failedCount++;
        }
      }
    } else if (type === 'Attendance') {
      for (const row of records) {
        try {
          const student = await db.student.findFirst({
            where: { admissionNo: row.admissionNo, schoolId },
          });
          if (!student) { failedCount++; continue; }

          await db.attendance.create({
            data: {
              schoolId,
              termId: row.termId || '',
              studentId: student.id,
              classId: row.classId || '',
              date: new Date(row.date || Date.now()),
              status: row.status || 'present',
              markedBy: auth.userId || auth.id || '',
              remarks: row.remarks || null,
            },
          });
          successCount++;
        } catch {
          failedCount++;
        }
      }
    } else if (type === 'Exam Scores') {
      for (const row of records) {
        try {
          await db.examScore.create({
            data: {
              examId: row.examId || '',
              studentId: row.studentId || '',
              score: parseFloat(row.score) || 0,
              grade: row.grade || null,
              remarks: row.remarks || null,
            },
          });
          successCount++;
        } catch {
          failedCount++;
        }
      }
    } else if (type === 'Fees') {
      for (const row of records) {
        try {
          await db.payment.create({
            data: {
              schoolId,
              studentId: row.studentId || '',
              amount: parseFloat(row.amount) || 0,
              method: row.method || 'cash',
              status: row.status || 'unverified',
              receiptNo: row.receiptNo || `RCP-${Date.now()}-${successCount}`,
            },
          });
          successCount++;
        } catch {
          failedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      successCount,
      failedCount,
      message: `Imported ${successCount} records. ${failedCount} failed.`,
    });

  } catch (error: unknown) {
    handleSilentError(error);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
