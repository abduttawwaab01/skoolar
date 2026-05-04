import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';
import { renderIDCard } from '@/lib/id-card-utils/render-card';

// GET /api/id-cards - List available cards for user
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'student'; // 'student' or 'staff'
    const schoolId = token.role === 'SUPER_ADMIN' ? searchParams.get('schoolId') : token.schoolId;

    if (!schoolId && token.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 });
    }

    const where: Record<string, unknown> = {
      schoolId,
      deletedAt: null,
    };

    if (type === 'student') {
      const students = await db.student.findMany({
        where,
        include: {
          user: { select: { name: true, email: true } },
          class: { select: { name: true, section: true } },
        },
        orderBy: { admissionNo: 'asc' },
      });
      return NextResponse.json({ data: students, type: 'student' });
    } else {
      const staff = await db.teacher.findMany({
        where,
        include: {
          user: { select: { name: true, email: true } },
        },
        orderBy: { employeeNo: 'asc' },
      });
      return NextResponse.json({ data: staff, type: 'staff' });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/id-cards/generate - Generate single ID card image
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      type, // 'student' or 'staff'
      personId, 
      schoolId,
      colors = {}, 
      backText = '',
      showPhoto = true,
      showBarcode = true,
      showQR = true,
      orientation = 'portrait' 
    } = body;

    // Fetch person data
    let person: any = null;
    let photoUrl: string | null = null;

    if (type === 'student') {
      const student = await db.student.findUnique({
        where: { id: personId },
        include: {
          user: { select: { name: true } },
          class: { select: { name: true } },
        },
      });
      if (!student) throw new Error('Student not found');
      person = {
        ...student,
        displayId: student.admissionNo,
        class: student.class?.name || 'N/A',
        gender: student.gender,
        role: 'STUDENT',
      };
      photoUrl = student.photo;
    } else {
      const staff = await db.teacher.findUnique({
        where: { id: personId },
        include: {
          user: { select: { name: true } },
        },
      });
      if (!staff) throw new Error('Staff not found');
      person = {
        ...staff,
        displayId: staff.employeeNo,
        role: staff.qualification?.toUpperCase() || 'TEACHER',
        phone: staff.phone,
      };
      photoUrl = staff.photo;
    }

    // Get school settings for colors if not provided
    let schoolColors = colors;
    if (!colors.primary || !colors.secondary) {
      const school = await db.school.findUnique({
        where: { id: schoolId || person.schoolId },
        select: { primaryColor: true, secondaryColor: true, name: true },
      });
      if (school) {
        schoolColors = {
          primary: colors.primary || school.primaryColor || '#059669',
          secondary: colors.secondary || school.secondaryColor || '#FFFFFF',
        };
      }
    }

    // Generate card image using Sharp
    const cardBuffer = await renderIDCard(person, schoolColors, backText, showPhoto, showBarcode, showQR, orientation, photoUrl, person.role);

    return NextResponse.json({ 
      success: true,
      data: cardBuffer.toString('base64'),
      contentType: 'image/png'
    }, {
      headers: {
        'Content-Type': 'image/png',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
