import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/domain-grades - Fetch domain grades with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const studentId = searchParams.get('studentId');
    const termId = searchParams.get('termId');
    const classId = searchParams.get('classId');

    if (!schoolId) {
      return NextResponse.json({ error: 'schoolId is required' }, { status: 400 });
    }

    const where: Record<string, unknown> = { schoolId };
    if (studentId) where.studentId = studentId;
    if (termId) where.termId = termId;
    if (classId) where.classId = classId;

    const domainGrades = await db.domainGrade.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: domainGrades });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/domain-grades - Create a domain grade (upsert)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { schoolId, studentId, termId, classId } = body;

    if (!schoolId || !studentId || !termId) {
      return NextResponse.json(
        { error: 'schoolId, studentId, and termId are required' },
        { status: 400 }
      );
    }

    // Extract domain fields
    const {
      cognitiveReasoning, cognitiveMemory, cognitiveConcentration,
      cognitiveProblemSolving, cognitiveInitiative, cognitiveAverage,
      psychomotorHandwriting, psychomotorSports, psychomotorDrawing,
      psychomotorPractical, psychomotorAverage,
      affectivePunctuality, affectiveNeatness, affectiveHonesty,
      affectiveLeadership, affectiveCooperation, affectiveAttentiveness,
      affectiveObedience, affectiveSelfControl, affectivePoliteness, affectiveAverage,
      classTeacherComment, classTeacherName, classTeacherSignature,
      principalComment, principalName, principalSignature,
    } = body;

    // Upsert based on unique constraint [schoolId, studentId, termId]
    const domainGrade = await db.domainGrade.upsert({
      where: {
        schoolId_studentId_termId: { schoolId, studentId, termId },
      },
      create: {
        schoolId,
        studentId,
        termId,
        classId: classId || '',
        cognitiveReasoning, cognitiveMemory, cognitiveConcentration,
        cognitiveProblemSolving, cognitiveInitiative, cognitiveAverage,
        psychomotorHandwriting, psychomotorSports, psychomotorDrawing,
        psychomotorPractical, psychomotorAverage,
        affectivePunctuality, affectiveNeatness, affectiveHonesty,
        affectiveLeadership, affectiveCooperation, affectiveAttentiveness,
        affectiveObedience, affectiveSelfControl, affectivePoliteness, affectiveAverage,
        classTeacherComment, classTeacherName, classTeacherSignature,
        principalComment, principalName, principalSignature,
      },
      update: {
        ...(classId !== undefined && { classId }),
        ...(cognitiveReasoning !== undefined && { cognitiveReasoning }),
        ...(cognitiveMemory !== undefined && { cognitiveMemory }),
        ...(cognitiveConcentration !== undefined && { cognitiveConcentration }),
        ...(cognitiveProblemSolving !== undefined && { cognitiveProblemSolving }),
        ...(cognitiveInitiative !== undefined && { cognitiveInitiative }),
        ...(cognitiveAverage !== undefined && { cognitiveAverage }),
        ...(psychomotorHandwriting !== undefined && { psychomotorHandwriting }),
        ...(psychomotorSports !== undefined && { psychomotorSports }),
        ...(psychomotorDrawing !== undefined && { psychomotorDrawing }),
        ...(psychomotorPractical !== undefined && { psychomotorPractical }),
        ...(psychomotorAverage !== undefined && { psychomotorAverage }),
        ...(affectivePunctuality !== undefined && { affectivePunctuality }),
        ...(affectiveNeatness !== undefined && { affectiveNeatness }),
        ...(affectiveHonesty !== undefined && { affectiveHonesty }),
        ...(affectiveLeadership !== undefined && { affectiveLeadership }),
        ...(affectiveCooperation !== undefined && { affectiveCooperation }),
        ...(affectiveAttentiveness !== undefined && { affectiveAttentiveness }),
        ...(affectiveObedience !== undefined && { affectiveObedience }),
        ...(affectiveSelfControl !== undefined && { affectiveSelfControl }),
        ...(affectivePoliteness !== undefined && { affectivePoliteness }),
        ...(affectiveAverage !== undefined && { affectiveAverage }),
        ...(classTeacherComment !== undefined && { classTeacherComment }),
        ...(classTeacherName !== undefined && { classTeacherName }),
        ...(classTeacherSignature !== undefined && { classTeacherSignature }),
        ...(principalComment !== undefined && { principalComment }),
        ...(principalName !== undefined && { principalName }),
        ...(principalSignature !== undefined && { principalSignature }),
      },
    });

    return NextResponse.json({ data: domainGrade, message: 'Domain grade saved successfully' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/domain-grades - Update a domain grade
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const existing = await db.domainGrade.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Domain grade not found' }, { status: 404 });
    }

    const {
      classId,
      cognitiveReasoning, cognitiveMemory, cognitiveConcentration,
      cognitiveProblemSolving, cognitiveInitiative, cognitiveAverage,
      psychomotorHandwriting, psychomotorSports, psychomotorDrawing,
      psychomotorPractical, psychomotorAverage,
      affectivePunctuality, affectiveNeatness, affectiveHonesty,
      affectiveLeadership, affectiveCooperation, affectiveAttentiveness,
      affectiveObedience, affectiveSelfControl, affectivePoliteness, affectiveAverage,
      classTeacherComment, classTeacherName, classTeacherSignature,
      principalComment, principalName, principalSignature,
    } = body;

    const domainGrade = await db.domainGrade.update({
      where: { id },
      data: {
        ...(classId !== undefined && { classId }),
        ...(cognitiveReasoning !== undefined && { cognitiveReasoning }),
        ...(cognitiveMemory !== undefined && { cognitiveMemory }),
        ...(cognitiveConcentration !== undefined && { cognitiveConcentration }),
        ...(cognitiveProblemSolving !== undefined && { cognitiveProblemSolving }),
        ...(cognitiveInitiative !== undefined && { cognitiveInitiative }),
        ...(cognitiveAverage !== undefined && { cognitiveAverage }),
        ...(psychomotorHandwriting !== undefined && { psychomotorHandwriting }),
        ...(psychomotorSports !== undefined && { psychomotorSports }),
        ...(psychomotorDrawing !== undefined && { psychomotorDrawing }),
        ...(psychomotorPractical !== undefined && { psychomotorPractical }),
        ...(psychomotorAverage !== undefined && { psychomotorAverage }),
        ...(affectivePunctuality !== undefined && { affectivePunctuality }),
        ...(affectiveNeatness !== undefined && { affectiveNeatness }),
        ...(affectiveHonesty !== undefined && { affectiveHonesty }),
        ...(affectiveLeadership !== undefined && { affectiveLeadership }),
        ...(affectiveCooperation !== undefined && { affectiveCooperation }),
        ...(affectiveAttentiveness !== undefined && { affectiveAttentiveness }),
        ...(affectiveObedience !== undefined && { affectiveObedience }),
        ...(affectiveSelfControl !== undefined && { affectiveSelfControl }),
        ...(affectivePoliteness !== undefined && { affectivePoliteness }),
        ...(affectiveAverage !== undefined && { affectiveAverage }),
        ...(classTeacherComment !== undefined && { classTeacherComment }),
        ...(classTeacherName !== undefined && { classTeacherName }),
        ...(classTeacherSignature !== undefined && { classTeacherSignature }),
        ...(principalComment !== undefined && { principalComment }),
        ...(principalName !== undefined && { principalName }),
        ...(principalSignature !== undefined && { principalSignature }),
      },
    });

    return NextResponse.json({ data: domainGrade, message: 'Domain grade updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
