import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { parse } from 'csv-parse';
import { Readable } from 'stream';
import { handleSilentError } from '@/lib/error-handler';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string | null;
    const schoolId = formData.get('schoolId') as string | null;
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
          await db.student.create({
            data: {
              schoolId,
              admissionNo: row.admissionNo || `BULK-${Date.now()}-${successCount}`,
              userId: '',
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
          await db.teacher.create({
            data: {
              schoolId,
              employeeNo: row.employeeNo || `TCH-${Date.now()}-${successCount}`,
              userId: '',
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
              markedBy: session.user?.id || '',
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
