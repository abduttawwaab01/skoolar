import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

function escapeCSV(value: string | number | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSV(headers: string[], rows: (string | null)[][]): string {
  const headerRow = headers.map(escapeCSV).join(',');
  const dataRows = rows.map(row => row.map(escapeCSV).join(',')).join('\n');
  return `${headerRow}\n${dataRows}`;
}

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request });
    if (!token || !token.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId') || '';
    const termId = searchParams.get('termId') || '';
    const academicYearId = searchParams.get('academicYearId') || '';
    const dataType = searchParams.get('type') || 'all'; // students, teachers, attendance, exams, homework, payments, all
    const format = searchParams.get('format') || 'csv';

    if (!schoolId) {
      return NextResponse.json({ error: 'schoolId is required' }, { status: 400 });
    }

    // Build term filter
    const termFilter: Record<string, unknown> = {};
    if (termId) termFilter.id = termId;
    if (academicYearId) termFilter.academicYearId = academicYearId;

    let csvContent = '';
    let filename = `skoolar-export-${new Date().toISOString().split('T')[0]}`;

    switch (dataType) {
      case 'students': {
        const students = await db.student.findMany({
          where: { schoolId, ...(termId ? { class: { exams: { some: { termId } } } } : {}) },
          include: { user: { select: { name: true, email: true, phone: true } }, class: { select: { name: true, section: true } } },
          orderBy: { admissionNo: 'asc' },
        });
        const headers = ['Admission No', 'Name', 'Email', 'Phone', 'Class', 'Section', 'Gender', 'Date of Birth', 'GPA', 'Rank', 'Active'];
        const rows = students.map(s => [
          s.admissionNo, s.user.name, s.user.email, s.user.phone,
          s.class?.name || '', s.class?.section || '', s.gender || '',
          s.dateOfBirth ? s.dateOfBirth.toISOString().split('T')[0] : '',
          s.gpa.toString(), s.rank?.toString() || '', s.isActive ? 'Yes' : 'No',
        ]);
        csvContent = toCSV(headers, rows);
        filename += '-students';
        break;
      }

      case 'teachers': {
        const teachers = await db.teacher.findMany({
          where: { schoolId },
          include: { user: { select: { name: true, email: true, phone: true } } },
          orderBy: { employeeNo: 'asc' },
        });
        const headers = ['Employee No', 'Name', 'Email', 'Phone', 'Specialization', 'Qualification', 'Date of Joining', 'Active'];
        const rows = teachers.map(t => [
          t.employeeNo, t.user.name, t.user.email, t.user.phone,
          t.specialization || '', t.qualification || '',
          t.dateOfJoining ? t.dateOfJoining.toISOString().split('T')[0] : '',
          t.isActive ? 'Yes' : 'No',
        ]);
        csvContent = toCSV(headers, rows);
        filename += '-teachers';
        break;
      }

      case 'attendance': {
        const attendance = await db.attendance.findMany({
          where: { schoolId, ...(termId ? { termId } : {}) },
          include: {
            student: {
              include: {
                user: { select: { name: true } },
              },
            },
          },
          orderBy: { date: 'desc' },
          take: 10000,
        });

        // Batch fetch classes for all students
        const studentIds = attendance.map(a => a.studentId);
        const studentsWithClass = await db.student.findMany({
          where: { id: { in: studentIds } },
          include: { class: { select: { name: true } } },
        });
        const classMap = new Map(studentsWithClass.map(s => [s.id, s.class?.name || '']));

        const headers = ['Date', 'Student Name', 'Admission No', 'Class', 'Status', 'Method', 'Remarks'];
        const rows = attendance.map(a => [
          a.date.toISOString().split('T')[0],
          a.student?.user?.name || '',
          a.student?.admissionNo || '',
          classMap.get(a.studentId) || '',
          a.status,
          a.method,
          a.remarks || '',
        ]);
        csvContent = toCSV(headers, rows);
        filename += '-attendance';
        break;
      }

      case 'exams': {
        const exams = await db.exam.findMany({
          where: { schoolId, ...(termId ? { termId } : {}) },
          include: {
            term: { select: { name: true } },
            subject: { select: { name: true } },
            class: { select: { name: true } },
            scores: true,
          },
          orderBy: { date: 'desc' },
        });
        const headers = ['Exam Name', 'Type', 'Subject', 'Class', 'Term', 'Date', 'Total Marks', 'Passing Marks', 'Published'];
        const rows = exams.map(e => [
          e.name, e.type, e.subject.name, e.class.name, e.term.name,
          e.date ? e.date.toISOString().split('T')[0] : '',
          e.totalMarks.toString(), e.passingMarks.toString(), e.isPublished ? 'Yes' : 'No',
        ]);
        csvContent = toCSV(headers, rows);
        filename += '-exams';
        break;
      }

      case 'exam_results': {
        const scores = await db.examScore.findMany({
          where: { exam: { schoolId, ...(termId ? { termId } : {}) } },
          include: {
            exam: { include: { term: { select: { name: true } }, subject: { select: { name: true } }, class: { select: { name: true } } } },
            student: { include: { user: { select: { name: true } } } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10000,
        });
        const headers = ['Student Name', 'Admission No', 'Class', 'Subject', 'Exam', 'Term', 'Score', 'Grade', 'Remarks'];
        const rows = scores.map(s => [
          s.student.user.name, s.student.admissionNo, s.exam.class.name,
          s.exam.subject.name, s.exam.name, s.exam.term.name,
          s.score.toString(), s.grade || '', s.remarks || '',
        ]);
        csvContent = toCSV(headers, rows);
        filename += '-exam-results';
        break;
      }

      case 'homework': {
        const homeworks = await db.homework.findMany({
          where: { schoolId },
          include: {
            subject: { select: { name: true } },
            class: { select: { name: true } },
            submissions: { include: { student: { include: { user: { select: { name: true } } } } } },
          },
          orderBy: { dueDate: 'desc' },
        });
        const headers = ['Title', 'Subject', 'Class', 'Due Date', 'Total Marks', 'Status', 'Submissions', 'Content Type'];
        const rows = homeworks.map(h => [
          h.title, h.subject?.name || '', h.class?.name || '',
          h.dueDate.toISOString().split('T')[0], h.totalMarks.toString(),
          h.status, h.submissions.length.toString(), (h as Record<string, unknown>).contentType as string || 'text',
        ]);
        csvContent = toCSV(headers, rows);
        filename += '-homework';
        break;
      }

      case 'payments': {
        const payments = await db.payment.findMany({
          where: { schoolId },
          include: { student: { include: { user: { select: { name: true } } } } },
          orderBy: { createdAt: 'desc' },
          take: 10000,
        });
        const headers = ['Reference', 'Student Name', 'Admission No', 'Amount', 'Method', 'Status', 'Term', 'Paid By', 'Date'];
        const rows = payments.map(p => [
          p.reference || '', p.student.user.name, p.student.admissionNo,
          p.amount.toString(), p.method, p.status, p.termId || '',
          p.paidBy || '', p.createdAt.toISOString().split('T')[0],
        ]);
        csvContent = toCSV(headers, rows);
        filename += '-payments';
        break;
      }

      case 'all': {
        // Export summary of all data types
        const [studentCount, teacherCount, parentCount, examCount, attendanceCount, paymentCount, homeworkCount] = await Promise.all([
          db.student.count({ where: { schoolId } }),
          db.teacher.count({ where: { schoolId } }),
          db.parent.count({ where: { schoolId } }),
          db.exam.count({ where: { schoolId } }),
          db.attendance.count({ where: { schoolId, ...(termId ? { termId } : {}) } }),
          db.payment.count({ where: { schoolId } }),
          db.homework.count({ where: { schoolId } }),
        ]);

        const school = await db.school.findUnique({ where: { id: schoolId } });
        const term = termId ? await db.term.findUnique({ where: { id: termId } }) : null;
        const academicYear = academicYearId ? await db.academicYear.findUnique({ where: { id: academicYearId } }) : null;

        const headers = ['Metric', 'Count', 'Period'];
        const period = term ? term.name : academicYear ? academicYear.name : 'All Time';
        const rows = [
          ['School', school?.name || '', period],
          ['Total Students', studentCount.toString(), period],
          ['Total Teachers', teacherCount.toString(), period],
          ['Total Parents', parentCount.toString(), period],
          ['Total Exams', examCount.toString(), period],
          ['Attendance Records', attendanceCount.toString(), period],
          ['Total Payments', paymentCount.toString(), period],
          ['Homework Assignments', homeworkCount.toString(), period],
        ];
        csvContent = toCSV(headers, rows);
        filename += '-summary';
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown data type: ${dataType}` }, { status: 400 });
    }

    if (format === 'csv') {
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}.csv"`,
        },
      });
    }

    return NextResponse.json({ content: csvContent, filename });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
