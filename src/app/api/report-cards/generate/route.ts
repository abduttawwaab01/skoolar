import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// Grade calculation based on total percentage
function getGrade(total: number, maxPossible: number): { grade: string; remark: string } {
  const pct = maxPossible > 0 ? (total / maxPossible) * 100 : 0;
  if (pct >= 70) return { grade: 'A', remark: 'Excellent' };
  if (pct >= 60) return { grade: 'B', remark: 'Very Good' };
  if (pct >= 50) return { grade: 'C', remark: 'Good' };
  if (pct >= 40) return { grade: 'D', remark: 'Fair' };
  if (pct >= 30) return { grade: 'E', remark: 'Poor' };
  return { grade: 'F', remark: 'Fail' };
}

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// POST /api/report-cards/generate
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { schoolId, termId, classId, studentId, studentIds } = body;

    if (!schoolId || !termId || !classId) {
      return NextResponse.json(
        { error: 'schoolId, termId, and classId are required' },
        { status: 400 }
      );
    }

    // Fetch school, settings, term, class info
    const [school, settings, term, cls] = await Promise.all([
      db.school.findUnique({ where: { id: schoolId } }),
      db.schoolSettings.findUnique({ where: { schoolId } }),
      db.term.findUnique({
        where: { id: termId },
        include: { academicYear: { select: { name: true } } },
      }),
      db.class.findUnique({
        where: { id: classId },
        include: {
          classTeacher: {
            select: { id: true, user: { select: { name: true } } },
          },
        },
      }),
    ]);

    if (!school) return NextResponse.json({ error: 'School not found' }, { status: 404 });
    if (!term) return NextResponse.json({ error: 'Term not found' }, { status: 404 });
    if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 });

    // Fetch students in class
    let studentFilter: Record<string, unknown> = { classId, schoolId, deletedAt: null, isActive: true };
    if (studentId) {
      studentFilter = { ...studentFilter, id: studentId as string };
    } else if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
      studentFilter = { ...studentFilter, id: { in: studentIds as string[] } };
    }
    
    const students = await db.student.findMany({
      where: studentFilter,
      include: { user: { select: { name: true } } },
      orderBy: { admissionNo: 'asc' },
    });

    if (students.length === 0) {
      return NextResponse.json({ error: 'No students found in this class' }, { status: 404 });
    }

    // Fetch score types for this school (only those that are in report)
    const scoreTypes = await db.scoreType.findMany({
      where: { schoolId, isInReport: true, isActive: true },
      orderBy: { position: 'asc' },
    });

    // Build a map of scoreType id -> scoreType info for quick lookup
    const scoreTypeMap = new Map(scoreTypes.map(st => [st.id, st]));

    // Group score types by type category (ca vs exam) for backward compatibility
    const caTypes = scoreTypes.filter(st => st.type === 'ca' || st.type === 'midterm');
    const examTypes = scoreTypes.filter(st => st.type === 'exam' || st.type === 'final');

    // Determine score system
    const scoreSystem = settings?.scoreSystem || 'midterm_exam';

    // Fetch all exams for this class + term with scores
    const exams = await db.exam.findMany({
      where: { schoolId, termId, classId, deletedAt: null },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        scoreType: { select: { id: true, name: true, type: true, maxMarks: true, weight: true, isInReport: true, position: true } },
        scores: {
          include: {
            scoreType: { select: { id: true, name: true, type: true, maxMarks: true, weight: true, isInReport: true, position: true } },
          },
        },
      },
    });

    // Group exams by subject
    const examsBySubject = new Map<string, typeof exams>();
    for (const exam of exams) {
      const key = exam.subjectId;
      if (!examsBySubject.has(key)) {
        examsBySubject.set(key, []);
      }
      examsBySubject.get(key)!.push(exam);
    }

    // Get unique subjects with their exams
    const subjectsData = Array.from(examsBySubject.entries()).map(([subjectId, subjectExams]) => ({
      subjectId,
      subjectName: subjectExams[0].subject.name,
      subjectCode: subjectExams[0].subject.code,
      exams: subjectExams,
    })).sort((a, b) => a.subjectName.localeCompare(b.subjectName));

    // Check if 3rd term
    const isThirdTerm = term.name.toLowerCase().includes('3') || term.order === 3;

    // ── BATCH FETCH: Attendance, Teacher Comments, Domain Grades for ALL students ──
    // This eliminates N+1 queries (was 3-4 queries per student)
    const allStudentIds = students.map(s => s.id);

    const [allAttendance, allComments, allDomainGrades] = await Promise.all([
      db.attendance.findMany({
        where: { schoolId, termId, classId, studentId: { in: allStudentIds } },
      }),
      db.teacherComment.findMany({
        where: { schoolId, termId, studentId: { in: allStudentIds }, category: 'general' },
      }),
      isThirdTerm
        ? db.domainGrade.findMany({
            where: { schoolId, termId, studentId: { in: allStudentIds } },
          })
        : Promise.resolve([]),
    ]);

    // Build lookup maps for O(1) access
    const attendanceMap = new Map<string, { total: number; present: number }>();
    for (const att of allAttendance) {
      const key = att.studentId;
      if (!attendanceMap.has(key)) attendanceMap.set(key, { total: 0, present: 0 });
      const entry = attendanceMap.get(key)!;
      entry.total++;
      if (att.status === 'present') entry.present++;
    }

    const commentMap = new Map<string, string>();
    for (const c of allComments) {
      commentMap.set(c.studentId, c.comment);
    }
    const domainGradeMap = new Map<string, Record<string, unknown>>();
    for (const dg of allDomainGrades) {
      domainGradeMap.set(dg.studentId, dg as unknown as Record<string, unknown>);
    }

    // Generate report cards for each student
    const reportCards: Record<string, unknown>[] = [];
    const studentTotalScores: { studentId: string; totalScore: number }[] = [];

    for (const student of students) {
      // Calculate scores for each subject
      const subjectResults: Record<string, unknown>[] = [];
      let grandTotal = 0;
      let grandPossible = 0;

      for (const subject of subjectsData) {
        // Per-score-type accumulation
        const scoresByType: Record<string, { raw: number; max: number; normalized: number }> = {};
        for (const st of scoreTypes) {
          scoresByType[st.id] = { raw: 0, max: 0, normalized: 0 };
        }

        let caTotal = 0;
        let caMax = 0;
        let examTotal = 0;
        let examMax = 0;

        for (const exam of subject.exams) {
          // Skip exams whose scoreType is not in report
          if (exam.scoreType && !exam.scoreType.isInReport) continue;

          const examType = exam.scoreType?.type || exam.type;
          const maxMarks = exam.totalMarks || 100;
          const scoreTypeId = exam.scoreTypeId || exam.scoreType?.id || '';

          // Find student's score for this exam
          const studentScore = exam.scores.find(s => s.studentId === student.id);
          const score = studentScore ? studentScore.score : 0;

          // Accumulate per score type
          if (scoreTypeId && scoresByType[scoreTypeId]) {
            scoresByType[scoreTypeId].raw += score;
            scoresByType[scoreTypeId].max += maxMarks;
          }

          if (examType === 'midterm' || examType === 'ca') {
            caTotal += score;
            caMax += maxMarks;
          } else if (examType === 'exam' || examType === 'final') {
            examTotal += score;
            examMax += maxMarks;
          }
        }

        // Calculate total weight of all score types
        const totalWeight = scoreTypes.reduce((sum, st) => sum + st.weight, 0);

        // Normalize each score type to its weighted contribution toward 100
        let total = 0;
        if (totalWeight > 0) {
          for (const st of scoreTypes) {
            const stData = scoresByType[st.id];
            if (stData.max > 0) {
              stData.normalized = Math.round(((stData.raw / stData.max) * (st.weight / totalWeight) * 100) * 100) / 100;
            }
            total += stData.normalized;
          }
        }

        // Fallback: if no score types configured, use traditional CA/Exam split
        if (scoreTypes.length === 0) {
          let caScore = caMax > 0 ? (caTotal / caMax) * 40 : 0;
          let examScore = examMax > 0 ? (examTotal / examMax) * 60 : 0;
          total = caScore + examScore;
          if (caMax > 0 && caMax <= 40 && examMax > 0 && examMax <= 60) {
            caScore = caTotal;
            examScore = examTotal;
            total = caScore + examScore;
          }
        }

        // If both are 0 and no exams exist for this subject, skip
        if (caTotal === 0 && examTotal === 0 && subject.exams.length === 0) {
          // Also check if any scoreType has raw data
          const hasAnyScores = Object.values(scoresByType).some(s => s.raw > 0);
          if (!hasAnyScores) continue;
        }

        const maxPossible = 100;
        const { grade, remark } = getGrade(total, maxPossible);

        grandTotal += total;
        grandPossible += maxPossible;

        // Build scoresByType for response - only include score types that have max > 0
        const scoresByTypeResponse: Record<string, number> = {};
        for (const st of scoreTypes) {
          if (scoresByType[st.id].max > 0 || scoreTypes.length > 0) {
            scoresByTypeResponse[st.id] = scoresByType[st.id].normalized;
          }
        }

        subjectResults.push({
          subjectId: subject.subjectId,
          subjectName: subject.subjectName,
          subjectCode: subject.subjectCode,
          caScore: Math.round((scoreTypes.length > 0
            ? caTypes.reduce((s, st) => s + scoresByType[st.id].normalized, 0)
            : (caMax > 0 ? (caTotal / caMax) * 40 : 0)) * 100) / 100,
          examScore: Math.round((scoreTypes.length > 0
            ? examTypes.reduce((s, st) => s + scoresByType[st.id].normalized, 0)
            : (examMax > 0 ? (examTotal / examMax) * 60 : 0)) * 100) / 100,
          totalScore: Math.round(total * 100) / 100,
          maxPossible,
          grade,
          remark,
          scoresByType: scoresByTypeResponse,
          caRaw: caTotal,
          caRawMax: caMax,
          examRaw: examTotal,
          examRawMax: examMax,
        });
      }

      const numSubjects = subjectResults.length;
      const averageScore = numSubjects > 0 ? grandTotal / numSubjects : 0;
      const overallGrade = getGrade(averageScore, 100);

      studentTotalScores.push({
        studentId: student.id,
        totalScore: grandTotal,
      });

      // Use batched attendance data
      const attData = attendanceMap.get(student.id);
      const totalDays = attData?.total || 0;
      const presentDays = attData?.present || 0;
      const absentDays = totalDays - presentDays;
      const attendancePct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

      // Use batched teacher comment
      const teacherCommentText = commentMap.get(student.id) || null;

      // Use batched domain grade
      const domainGrade = isThirdTerm ? domainGradeMap.get(student.id) || null : null;

      // Upsert report card
      const reportCard = await db.reportCard.upsert({
        where: {
          schoolId_studentId_termId: {
            schoolId,
            studentId: student.id,
            termId,
          },
        },
        create: {
          schoolId,
          studentId: student.id,
          termId,
          classId,
          totalScore: grandTotal,
          averageScore: Math.round(averageScore * 100) / 100,
          grade: overallGrade.grade,
          teacherComment: teacherCommentText || null,
          principalComment: domainGrade && 'principalComment' in domainGrade ? (domainGrade as Record<string, unknown>).principalComment as string || null : null,
          attendanceSummary: JSON.stringify({
            totalDays,
            presentDays,
            absentDays,
            percentage: attendancePct,
          }),
          isPublished: false,
        },
        update: {
          totalScore: grandTotal,
          averageScore: Math.round(averageScore * 100) / 100,
          grade: overallGrade.grade,
          teacherComment: teacherCommentText || null,
          principalComment: domainGrade && 'principalComment' in domainGrade ? (domainGrade as Record<string, unknown>).principalComment as string || null : null,
          attendanceSummary: JSON.stringify({
            totalDays,
            presentDays,
            absentDays,
            percentage: attendancePct,
          }),
          classId,
        },
      });

      reportCards.push({
        ...reportCard,
        student: {
          id: student.id,
          name: student.user.name,
          admissionNo: student.admissionNo,
          gender: student.gender,
          dateOfBirth: student.dateOfBirth,
          bloodGroup: student.bloodGroup,
          photo: student.photo,
          classPosition: 0, // Will be calculated below
        },
        subjectResults,
        numSubjects,
        grandTotal,
        grandPossible,
        averageScore: Math.round(averageScore * 100) / 100,
        overallGrade,
        attendance: { totalDays, presentDays, absentDays, percentage: attendancePct },
        teacherComment: teacherCommentText || null,
        domainGrade: domainGrade ? {
          id: (domainGrade as Record<string, unknown>).id as string || null,
          cognitive: {
            reasoning: (domainGrade as Record<string, unknown>).cognitiveReasoning as string || null,
            memory: (domainGrade as Record<string, unknown>).cognitiveMemory as string || null,
            concentration: (domainGrade as Record<string, unknown>).cognitiveConcentration as string || null,
            problemSolving: (domainGrade as Record<string, unknown>).cognitiveProblemSolving as string || null,
            initiative: (domainGrade as Record<string, unknown>).cognitiveInitiative as string || null,
            average: (domainGrade as Record<string, unknown>).cognitiveAverage as string || null,
          },
          psychomotor: {
            handwriting: (domainGrade as Record<string, unknown>).psychomotorHandwriting as string || null,
            sports: (domainGrade as Record<string, unknown>).psychomotorSports as string || null,
            drawing: (domainGrade as Record<string, unknown>).psychomotorDrawing as string || null,
            practical: (domainGrade as Record<string, unknown>).psychomotorPractical as string || null,
            average: (domainGrade as Record<string, unknown>).psychomotorAverage as string || null,
          },
          affective: {
            punctuality: (domainGrade as Record<string, unknown>).affectivePunctuality as string || null,
            neatness: (domainGrade as Record<string, unknown>).affectiveNeatness as string || null,
            honesty: (domainGrade as Record<string, unknown>).affectiveHonesty as string || null,
            leadership: (domainGrade as Record<string, unknown>).affectiveLeadership as string || null,
            cooperation: (domainGrade as Record<string, unknown>).affectiveCooperation as string || null,
            attentiveness: (domainGrade as Record<string, unknown>).affectiveAttentiveness as string || null,
            obedience: (domainGrade as Record<string, unknown>).affectiveObedience as string || null,
            selfControl: (domainGrade as Record<string, unknown>).affectiveSelfControl as string || null,
            politeness: (domainGrade as Record<string, unknown>).affectivePoliteness as string || null,
            average: (domainGrade as Record<string, unknown>).affectiveAverage as string || null,
          },
          classTeacherComment: (domainGrade as Record<string, unknown>).classTeacherComment as string || null,
          classTeacherName: (domainGrade as Record<string, unknown>).classTeacherName as string || null,
          principalComment: (domainGrade as Record<string, unknown>).principalComment as string || null,
          principalName: (domainGrade as Record<string, unknown>).principalName as string || null,
        } : null,
        isThirdTerm,
      });
    }

    // Calculate class ranks based on total scores
    studentTotalScores.sort((a, b) => b.totalScore - a.totalScore);
    const totalStudents = studentTotalScores.length;

    const rankMap = new Map<string, { rank: number; ordinal: string; total: number }>();
    studentTotalScores.forEach((s, idx) => {
      rankMap.set(s.studentId, {
        rank: idx + 1,
        ordinal: getOrdinal(idx + 1),
        total: totalStudents,
      });
    });

    // Assign ranks to report cards
    for (const rc of reportCards as Record<string, unknown>[]) {
      const studentInfo = rc.student as Record<string, unknown>;
      const rank = rankMap.get(rc.studentId as string);
      if (rank) {
        studentInfo.classPosition = rank.ordinal;
        (rc as Record<string, unknown>).classRank = rank.rank;
        (rc as Record<string, unknown>).totalStudents = rank.total;
      }
    }

    // Update ranks in DB
    for (const [studentId, rankInfo] of rankMap) {
      await db.reportCard.updateMany({
        where: { schoolId, studentId, termId },
        data: { classRank: rankInfo.rank },
      });
    }

    return NextResponse.json({
      data: reportCards,
      meta: {
        school: {
          id: school.id,
          name: school.name,
          logo: school.logo,
          address: school.address,
          motto: school.motto,
          phone: school.phone,
          email: school.email,
          website: school.website,
          primaryColor: school.primaryColor,
          secondaryColor: school.secondaryColor,
        },
        settings: settings ? {
          scoreSystem: settings.scoreSystem,
          fontFamily: settings.fontFamily,
          theme: settings.theme,
          schoolMotto: settings.schoolMotto,
          schoolVision: settings.schoolVision,
          schoolMission: settings.schoolMission,
          principalName: settings.principalName,
          vicePrincipalName: settings.vicePrincipalName,
          nextTermBegins: settings.nextTermBegins,
          academicSession: settings.academicSession,
        } : null,
        term: {
          id: term.id,
          name: term.name,
          order: term.order,
          startDate: term.startDate,
          endDate: term.endDate,
          academicYear: term.academicYear?.name || '',
        },
        class: {
          id: cls.id,
          name: cls.name,
          section: cls.section,
          grade: cls.grade,
          classTeacher: cls.classTeacher?.user.name || null,
        },
        scoreTypes: scoreTypes.map(st => ({
          id: st.id,
          name: st.name,
          type: st.type,
          maxMarks: st.maxMarks,
          weight: st.weight,
          position: st.position,
        })),
        totalStudents,
        isThirdTerm,
        generatedAt: new Date().toISOString(),
      },
      message: `Successfully generated ${reportCards.length} report card(s)`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Report card generation error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/report-cards/generate - Check existing report cards or fetch single student report
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId') || '';
    const termId = searchParams.get('termId') || '';
    const classId = searchParams.get('classId') || '';
    const studentId = searchParams.get('studentId') || '';

    if (!schoolId || !termId) {
      return NextResponse.json(
        { error: 'schoolId and termId are required' },
        { status: 400 }
      );
    }

    // If studentId is provided, generate report card on-the-fly for that student
    if (studentId && classId) {
      // Reuse the POST logic internally
      const student = await db.student.findFirst({
        where: { id: studentId, classId, schoolId, deletedAt: null, isActive: true },
        include: { user: { select: { name: true } } },
      });

      if (!student) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      }

      // Fetch school, settings, term, class
      const [school, settings, term, cls] = await Promise.all([
        db.school.findUnique({ where: { id: schoolId } }),
        db.schoolSettings.findUnique({ where: { schoolId } }),
        db.term.findUnique({
          where: { id: termId },
          include: { academicYear: { select: { name: true } } },
        }),
        db.class.findUnique({
          where: { id: classId },
          include: {
            classTeacher: {
              select: { id: true, user: { select: { name: true } } },
            },
          },
        }),
      ]);

      if (!school) return NextResponse.json({ error: 'School not found' }, { status: 404 });
      if (!term) return NextResponse.json({ error: 'Term not found' }, { status: 404 });

      // Fetch score types
      const scoreTypes = await db.scoreType.findMany({
        where: { schoolId, isInReport: true, isActive: true },
        orderBy: { position: 'asc' },
      });

      const caTypes = scoreTypes.filter(st => st.type === 'ca' || st.type === 'midterm');
      const examTypes = scoreTypes.filter(st => st.type === 'exam' || st.type === 'final');

      // Fetch exams
      const exams = await db.exam.findMany({
        where: { schoolId, termId, classId, deletedAt: null },
        include: {
          subject: { select: { id: true, name: true, code: true } },
          scoreType: { select: { id: true, name: true, type: true, maxMarks: true, weight: true, isInReport: true, position: true } },
          scores: {
            include: {
              scoreType: { select: { id: true, name: true, type: true, maxMarks: true, weight: true, isInReport: true, position: true } },
            },
          },
        },
      });

      const examsBySubject = new Map<string, typeof exams>();
      for (const exam of exams) {
        const key = exam.subjectId;
        if (!examsBySubject.has(key)) examsBySubject.set(key, []);
        examsBySubject.get(key)!.push(exam);
      }

      const subjectsData = Array.from(examsBySubject.entries()).map(([subjectId, subjectExams]) => ({
        subjectId,
        subjectName: subjectExams[0].subject.name,
        subjectCode: subjectExams[0].subject.code,
        exams: subjectExams,
      })).sort((a, b) => a.subjectName.localeCompare(b.subjectName));

      const isThirdTerm = term.name.toLowerCase().includes('3') || term.order === 3;

      // Calculate scores
      const subjectResults: Record<string, unknown>[] = [];
      let grandTotal = 0;
      let grandPossible = 0;

      for (const subject of subjectsData) {
        const scoresByType: Record<string, { raw: number; max: number; normalized: number }> = {};
        for (const st of scoreTypes) {
          scoresByType[st.id] = { raw: 0, max: 0, normalized: 0 };
        }

        let caTotal = 0; let caMax = 0; let examTotal = 0; let examMax = 0;

        for (const exam of subject.exams) {
          if (exam.scoreType && !exam.scoreType.isInReport) continue;
          const examType = exam.scoreType?.type || exam.type;
          const maxMarks = exam.totalMarks || 100;
          const scoreTypeId = exam.scoreTypeId || exam.scoreType?.id || '';
          const studentScore = exam.scores.find(s => s.studentId === student.id);
          const score = studentScore ? studentScore.score : 0;

          if (scoreTypeId && scoresByType[scoreTypeId]) {
            scoresByType[scoreTypeId].raw += score;
            scoresByType[scoreTypeId].max += maxMarks;
          }

          if (examType === 'midterm' || examType === 'ca') { caTotal += score; caMax += maxMarks; }
          else if (examType === 'exam' || examType === 'final') { examTotal += score; examMax += maxMarks; }
        }

        const totalWeight = scoreTypes.reduce((sum, st) => sum + st.weight, 0);
        let total = 0;
        if (totalWeight > 0) {
          for (const st of scoreTypes) {
            const stData = scoresByType[st.id];
            if (stData.max > 0) stData.normalized = Math.round(((stData.raw / stData.max) * (st.weight / totalWeight) * 100) * 100) / 100;
            total += stData.normalized;
          }
        }

        if (scoreTypes.length === 0) {
          let caScore = caMax > 0 ? (caTotal / caMax) * 40 : 0;
          let examScore = examMax > 0 ? (examTotal / examMax) * 60 : 0;
          total = caScore + examScore;
          if (caMax > 0 && caMax <= 40 && examMax > 0 && examMax <= 60) {
            total = caTotal + examTotal;
          }
        }

        const hasAnyScores = Object.values(scoresByType).some(s => s.raw > 0);
        if (caTotal === 0 && examTotal === 0 && !hasAnyScores && subject.exams.length === 0) continue;

        const { grade, remark } = getGrade(total, 100);
        grandTotal += total;
        grandPossible += 100;

        const scoresByTypeResponse: Record<string, number> = {};
        for (const st of scoreTypes) {
          scoresByTypeResponse[st.id] = scoresByType[st.id].normalized;
        }

        subjectResults.push({
          subjectId: subject.subjectId,
          subjectName: subject.subjectName,
          subjectCode: subject.subjectCode,
          caScore: Math.round((scoreTypes.length > 0 ? caTypes.reduce((s, st) => s + scoresByType[st.id].normalized, 0) : (caMax > 0 ? (caTotal / caMax) * 40 : 0)) * 100) / 100,
          examScore: Math.round((scoreTypes.length > 0 ? examTypes.reduce((s, st) => s + scoresByType[st.id].normalized, 0) : (examMax > 0 ? (examTotal / examMax) * 60 : 0)) * 100) / 100,
          totalScore: Math.round(total * 100) / 100,
          maxPossible: 100,
          grade, remark,
          scoresByType: scoresByTypeResponse,
        });
      }

      const numSubjects = subjectResults.length;
      const averageScore = numSubjects > 0 ? grandTotal / numSubjects : 0;
      const overallGrade = getGrade(averageScore, 100);

      // Attendance
      const attendanceRecords = await db.attendance.findMany({
        where: { schoolId, termId, studentId: student.id, classId },
      });
      const totalDays = attendanceRecords.length;
      const presentDays = attendanceRecords.filter(a => a.status === 'present').length;
      const absentDays = totalDays - presentDays;
      const attendancePct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

      // Teacher comment
      const teacherComment = await db.teacherComment.findFirst({
        where: { schoolId, studentId: student.id, termId, category: 'general' },
      });

      // Domain grades
      let domainGrade: Record<string, unknown> | null = null;
      if (isThirdTerm) {
        const dg = await db.domainGrade.findUnique({
          where: { schoolId_studentId_termId: { schoolId, studentId: student.id, termId } },
        });
        if (dg) {
          domainGrade = {
            id: dg.id,
            cognitive: {
              reasoning: dg.cognitiveReasoning, memory: dg.cognitiveMemory,
              concentration: dg.cognitiveConcentration, problemSolving: dg.cognitiveProblemSolving,
              initiative: dg.cognitiveInitiative, average: dg.cognitiveAverage,
            },
            psychomotor: {
              handwriting: dg.psychomotorHandwriting, sports: dg.psychomotorSports,
              drawing: dg.psychomotorDrawing, practical: dg.psychomotorPractical,
              average: dg.psychomotorAverage,
            },
            affective: {
              punctuality: dg.affectivePunctuality, neatness: dg.affectiveNeatness,
              honesty: dg.affectiveHonesty, leadership: dg.affectiveLeadership,
              cooperation: dg.affectiveCooperation, attentiveness: dg.affectiveAttentiveness,
              obedience: dg.affectiveObedience, selfControl: dg.affectiveSelfControl,
              politeness: dg.affectivePoliteness, average: dg.affectiveAverage,
            },
            classTeacherComment: dg.classTeacherComment,
            classTeacherName: dg.classTeacherName,
            principalComment: dg.principalComment,
            principalName: dg.principalName,
          };
        }
      }

      // Check for existing report card
      const existingRC = await db.reportCard.findUnique({
        where: { schoolId_studentId_termId: { schoolId, studentId: student.id, termId } },
      });

      return NextResponse.json({
        data: [{
          id: existingRC?.id || '',
          schoolId, studentId: student.id, termId, classId,
          totalScore: grandTotal,
          averageScore: Math.round(averageScore * 100) / 100,
          grade: overallGrade.grade,
          classRank: existingRC?.classRank || null,
          totalStudents: null,
          teacherComment: existingRC?.teacherComment || teacherComment?.comment || null,
          principalComment: existingRC?.principalComment || domainGrade?.principalComment || null,
          isPublished: existingRC?.isPublished || false,
          publishedAt: existingRC?.publishedAt || null,
          createdAt: existingRC?.createdAt || new Date().toISOString(),
          student: {
            id: student.id, name: student.user.name, admissionNo: student.admissionNo,
            gender: student.gender, dateOfBirth: student.dateOfBirth,
            bloodGroup: student.bloodGroup, photo: student.photo, classPosition: '',
          },
          subjectResults, numSubjects, grandTotal, grandPossible,
          overallGrade,
          attendance: { totalDays, presentDays, absentDays, percentage: attendancePct },
          domainGrade,
          isThirdTerm,
        }],
        meta: {
          school: {
            id: school.id, name: school.name, logo: school.logo, address: school.address,
            motto: school.motto, phone: school.phone, email: school.email, website: school.website,
            primaryColor: school.primaryColor, secondaryColor: school.secondaryColor,
          },
          settings: settings ? {
            scoreSystem: settings.scoreSystem, schoolMotto: settings.schoolMotto,
            principalName: settings.principalName, vicePrincipalName: settings.vicePrincipalName,
            nextTermBegins: settings.nextTermBegins, academicSession: settings.academicSession,
          } : null,
          term: {
            id: term.id, name: term.name, order: term.order,
            startDate: term.startDate, endDate: term.endDate,
            academicYear: term.academicYear?.name || '',
          },
          class: {
            id: cls?.id || classId, name: cls?.name || '',
            section: cls?.section, grade: cls?.grade,
            classTeacher: cls?.classTeacher?.user.name || null,
          },
          scoreTypes: scoreTypes.map(st => ({
            id: st.id, name: st.name, type: st.type,
            maxMarks: st.maxMarks, weight: st.weight, position: st.position,
          })),
          totalStudents: 0, isThirdTerm,
          generatedAt: new Date().toISOString(),
        },
      });
    }

    // Original GET behavior: check existing report cards by class
    if (!classId) {
      return NextResponse.json({ error: 'classId is required when studentId is not provided' }, { status: 400 });
    }

    const existing = await db.reportCard.findMany({
      where: { schoolId, termId, classId },
      include: {
        student: {
          include: { user: { select: { name: true } } },
        },
      },
      orderBy: { classRank: 'asc' },
    });

    return NextResponse.json({
      data: existing,
      total: existing.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
