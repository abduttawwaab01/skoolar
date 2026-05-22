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
       const staff = await db.user.findMany({
         where: {
           schoolId,
           deletedAt: null,
           role: { notIn: ['STUDENT', 'PARENT'] },
         },
         include: {
           teacherProfile: true,
           accountantProfile: true,
           librarianProfile: true,
           directorProfile: true,
         },
         orderBy: { name: 'asc' },
       });
       
       const staffWithIds = staff.map(u => {
         let employeeNo = `USR-${u.id.slice(0, 6)}`;
         if (u.teacherProfile?.employeeNo) employeeNo = u.teacherProfile.employeeNo;
         else if (u.accountantProfile?.employeeNo) employeeNo = u.accountantProfile.employeeNo;
         else if (u.librarianProfile?.employeeNo) employeeNo = u.librarianProfile.employeeNo;
         else if (u.directorProfile?.employeeNo) employeeNo = u.directorProfile.employeeNo;
         else if (u.role === 'SCHOOL_ADMIN') employeeNo = `ADMIN-${u.id.slice(0, 6)}`;
         
         return {
           id: u.id,
           userId: u.id,
           name: u.name,
           email: u.email,
           employeeNo,
           role: u.role,
           phone: u.phone,
           photo: u.avatar,
           schoolId: u.schoolId,
         };
       });
       
       return NextResponse.json({ data: staffWithIds, type: 'staff' });
     }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/id-cards - Generate single ID card image
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
      orientation = 'portrait',
      isBack = false 
    } = body;

    // Fetch person data
    let person: any = null;
    let photoUrl: string | null = null;

    if (type === 'student') {
      const student = await db.student.findUnique({
        where: { id: personId },
        include: {
          user: { select: { name: true, avatar: true } },
          class: { select: { name: true } },
        },
      });
      if (!student) throw new Error('Student not found');
      person = {
        ...student,
        name: student.user?.name || 'Unknown',
        displayId: student.admissionNo,
        class: student.class?.name || 'N/A',
        gender: student.gender,
        role: 'STUDENT',
      };
      photoUrl = student.photo || student.user?.avatar || null;
    } else {
      const user = await db.user.findUnique({
        where: { id: personId },
        include: {
          teacherProfile: true,
          accountantProfile: true,
          librarianProfile: true,
          directorProfile: true,
        },
      });
      
      if (!user) throw new Error('Staff not found');
      
       let employeeNo = `USR-${user.id.slice(0, 6)}`;
       const phone = user.phone || '';
       const userPhotoUrl = user.avatar;
       
       if (user.teacherProfile?.employeeNo) {
         employeeNo = user.teacherProfile.employeeNo;
       } else if (user.accountantProfile?.employeeNo) {
         employeeNo = user.accountantProfile.employeeNo;
       } else if (user.librarianProfile?.employeeNo) {
         employeeNo = user.librarianProfile.employeeNo;
       } else if (user.directorProfile?.employeeNo) {
         employeeNo = user.directorProfile.employeeNo;
       } else if (user.role === 'SCHOOL_ADMIN') {
        employeeNo = `ADMIN-${user.id.slice(0, 6)}`;
      }
      
       const staffProfileId = user.teacherProfile?.id || user.accountantProfile?.id || user.librarianProfile?.id || user.directorProfile?.id || user.id;

       person = {
        id: staffProfileId,
        userId: user.id,
        name: user.name,
        displayId: employeeNo,
        role: user.role,
        phone: phone,
        schoolId: user.schoolId,
      };
      photoUrl = userPhotoUrl;
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
    const cardBuffer = await renderIDCard(person, schoolColors, backText, showPhoto, showBarcode, showQR, orientation, photoUrl, person.role, isBack);

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
