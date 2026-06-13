import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';
import { renderIDCard } from '@/lib/id-card-utils/render-card';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/id-cards - List available cards for user
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'student'; // 'student' or 'staff'
    const querySchoolId = searchParams.get('schoolId') || '';

    // SECURITY: Auth token schoolId wins. Query param is only honored for SUPER_ADMIN.
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId
      ? querySchoolId
      : (auth.schoolId || '');
    if (!targetSchoolId && auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const action = searchParams.get('action') || '';
    if (action === 'templates') {
      const templates = await db.iDCardTemplate.findMany({
        where: { schoolId: targetSchoolId },
        orderBy: { name: 'asc' },
      });
      return NextResponse.json({ data: templates });
    }

    // Pagination params
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      schoolId: targetSchoolId,
      deletedAt: null,
    };

    if (type === 'student') {
      const [students, total] = await Promise.all([
        db.student.findMany({
          where,
          include: {
            user: { select: { name: true, email: true } },
            class: { select: { name: true, section: true } },
          },
          orderBy: { admissionNo: 'asc' },
          skip,
          take: limit,
        }),
        db.student.count({ where }),
      ]);
      return NextResponse.json({ data: students, type: 'student', total, page, limit, totalPages: Math.ceil(total / limit) });
     } else {
       const [staff, total] = await Promise.all([
         db.user.findMany({
           where: {
             schoolId: targetSchoolId,
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
           skip,
           take: limit,
         }),
         db.user.count({
           where: {
             schoolId: targetSchoolId,
             deletedAt: null,
             role: { notIn: ['STUDENT', 'PARENT'] },
           },
         }),
       ]);

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

       return NextResponse.json({ data: staffWithIds, type: 'staff', total, page, limit, totalPages: Math.ceil(total / limit) });
      }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/id-cards - Generate single ID card image
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { action, schoolId: bodySchoolId } = body;

    // SECURITY: Auth token schoolId wins. Body is only honored for SUPER_ADMIN.
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && bodySchoolId
      ? bodySchoolId
      : (auth.schoolId || '');

    if (!targetSchoolId && auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    if (action === 'save-template') {
      const {
        name = 'Standard',
        primaryColor = '#059669',
        secondaryColor = '#FFFFFF',
        textColor = '#000000',
        showBarcode = true,
        showQRCode = true,
        showPhoto = true,
        backText = '',
        width = 85.6,
        height = 53.98,
        frontLayout = 'modern',
        backLayout = 'standard',
      } = body;

      let template;
      if (body.id) {
        template = await db.iDCardTemplate.update({
          where: { id: body.id },
          data: {
            name, primaryColor, secondaryColor, textColor,
            showBarcode, showQRCode, showPhoto, backText,
            width, height, frontLayout, backLayout
          }
        });
      } else {
        template = await db.iDCardTemplate.create({
          data: {
            schoolId: targetSchoolId,
            name, primaryColor, secondaryColor, textColor,
            showBarcode, showQRCode, showPhoto, backText,
            width, height, frontLayout, backLayout
          }
        });
      }
      return NextResponse.json({ success: true, data: template });
    }

    const {
      type, // 'student' or 'staff'
      personId,
      colors = {},
      backText = '',
      showPhoto = true,
      showQR = true,
      orientation = 'portrait',
      isBack = false
    } = body;

    // Input validation
    if (!type || !['student', 'staff'].includes(type)) {
      return NextResponse.json({ error: 'Invalid or missing type (must be "student" or "staff")' }, { status: 400 });
    }
    if (!personId || typeof personId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid personId' }, { status: 400 });
    }

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
        where: { id: targetSchoolId || person.schoolId },
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
    const cardBuffer = await renderIDCard(
      person,
      schoolColors,
      backText,
      showPhoto,
      showQR,
      orientation,
      photoUrl,
      person.role,
      isBack,
      // optional UI flags passed from client
      body.showBarcode !== false,
      !!body.showSignature,
      body.showLogo !== false,
      body.issueDate || null,
      body.expiryDate || null,
      body.watermarkText || null,
      body.signatureUrl || null
    );

    return NextResponse.json({ 
      success: true,
      data: cardBuffer.toString('base64'),
      contentType: 'image/png'
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
