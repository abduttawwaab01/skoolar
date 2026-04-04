import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

const SALT_ROUNDS = 10;
const GOOGLE_SHEET_URL = process.env.GOOGLE_SHEET_URL || '';

async function submitToGoogleSheet(data: Record<string, string>) {
  if (!GOOGLE_SHEET_URL) return;
  try {
    await fetch(GOOGLE_SHEET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch {
    // Silently fail - don't block registration
    console.error('Failed to submit to Google Sheet');
  }
}

async function createSchoolStructure(schoolId: string) {
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  const academicYearName = `${currentYear}/${nextYear}`;

  // Get the free plan
  const freePlan = await db.subscriptionPlan.findUnique({
    where: { name: 'free' },
  });

  if (freePlan) {
    await db.school.update({
      where: { id: schoolId },
      data: { planId: freePlan.id },
    });

    // Create a PlatformPayment record for the free plan (1 year)
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    await db.platformPayment.create({
      data: {
        schoolId,
        planId: freePlan.id,
        reference: `free-${schoolId}`,
        amount: 0,
        currency: 'NGN',
        status: 'active',
        startDate: new Date(),
        endDate: oneYearFromNow,
      },
    });
  }

  // Create default school settings
  await db.schoolSettings.create({
    data: {
      schoolId,
      scoreSystem: 'midterm_exam',
      fontFamily: 'Inter',
      theme: 'default',
      academicSession: `${currentYear}/${nextYear}`,
    },
  });

  // Create default score types
  await Promise.all([
    db.scoreType.create({
      data: {
        schoolId,
        name: 'Daily Test',
        type: 'daily',
        maxMarks: 10,
        weight: 0.5,
        position: 0,
        isInReport: false,
      },
    }),
    db.scoreType.create({
      data: {
        schoolId,
        name: 'Weekly Test',
        type: 'weekly',
        maxMarks: 20,
        weight: 1,
        position: 1,
        isInReport: false,
      },
    }),
    db.scoreType.create({
      data: {
        schoolId,
        name: 'Mid-Term CA',
        type: 'midterm',
        maxMarks: 40,
        weight: 2,
        position: 2,
        isInReport: true,
      },
    }),
    db.scoreType.create({
      data: {
        schoolId,
        name: 'Exam',
        type: 'exam',
        maxMarks: 60,
        weight: 3,
        position: 3,
        isInReport: true,
      },
    }),
  ]);

  const academicYear = await db.academicYear.create({
    data: {
      schoolId,
      name: academicYearName,
      startDate: new Date(currentYear, 8, 1),
      endDate: new Date(nextYear, 6, 31),
      isCurrent: true,
      isLocked: false,
    },
  });

  await Promise.all([
    db.term.create({
      data: {
        academicYearId: academicYear.id,
        schoolId,
        name: 'First Term',
        order: 1,
        startDate: new Date(currentYear, 8, 1),
        endDate: new Date(currentYear, 11, 19),
        isCurrent: false,
        isLocked: false,
      },
    }),
    db.term.create({
      data: {
        academicYearId: academicYear.id,
        schoolId,
        name: 'Second Term',
        order: 2,
        startDate: new Date(nextYear, 0, 7),
        endDate: new Date(nextYear, 2, 28),
        isCurrent: true,
        isLocked: false,
      },
    }),
    db.term.create({
      data: {
        academicYearId: academicYear.id,
        schoolId,
        name: 'Third Term',
        order: 3,
        startDate: new Date(nextYear, 3, 21),
        endDate: new Date(nextYear, 6, 31),
        isCurrent: false,
        isLocked: false,
      },
    }),
  ]);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, registrationCode, schoolName } = body;

    // Validation - registration code is now OPTIONAL
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required.' },
        { status: 400 }
      );
    }

    if (!schoolName?.trim()) {
      return NextResponse.json(
        { error: 'School name is required.' },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters.' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 }
      );
    }

    // Variables to track school creation
    let schoolId: string;
    let schoolJustCreated = false;
    let planName = 'free';

    // Check if registration code was provided
    if (registrationCode && registrationCode.trim()) {
      // Find registration code
      const regCode = await db.registrationCode.findUnique({
        where: { code: registrationCode },
        include: { school: true },
      });

      if (!regCode) {
        return NextResponse.json(
          { error: 'Invalid registration code.' },
          { status: 400 }
        );
      }

      // Check if code has expired
      if (regCode.expiresAt && regCode.expiresAt < new Date()) {
        return NextResponse.json(
          { error: 'This registration code has expired.' },
          { status: 400 }
        );
      }

      // Check usage limits
      if (regCode.usedCount >= regCode.maxUses) {
        return NextResponse.json(
          { error: 'This registration code has reached its maximum number of uses.' },
          { status: 400 }
        );
      }

      planName = regCode.plan || 'basic';

      if (regCode.schoolId) {
        // Code is already linked to a school
        schoolId = regCode.schoolId;
      } else {
        // Create a new school from the registration code
        const finalSchoolName = schoolName?.trim() || `School (${regCode.code})`;
        const slug = `school-${finalSchoolName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

        // Check slug uniqueness
        let uniqueSlug = slug;
        let slugExists = await db.school.findUnique({ where: { slug: uniqueSlug } });
        let counter = 1;
        while (slugExists) {
          uniqueSlug = `${slug}-${counter}`;
          slugExists = await db.school.findUnique({ where: { slug: uniqueSlug } });
          counter++;
        }

        const school = await db.school.create({
          data: {
            name: finalSchoolName,
            slug: uniqueSlug,
            plan: planName,
            region: regCode.region || null,
            isActive: true,
          },
        });

        // Link the school to the registration code
        await db.registrationCode.update({
          where: { id: regCode.id },
          data: { schoolId: school.id },
        });

        schoolId = school.id;
        schoolJustCreated = true;
      }

      // Increment code usage
      const newUsedCount = regCode.usedCount + 1;
      await db.registrationCode.update({
        where: { id: regCode.id },
        data: {
          usedCount: newUsedCount,
          isUsed: newUsedCount >= regCode.maxUses,
        },
      });
    } else {
      // No registration code - create FREE school
      const slug = `school-${schoolName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

      // Check slug uniqueness
      let uniqueSlug = slug;
      let slugExists = await db.school.findUnique({ where: { slug: uniqueSlug } });
      let counter = 1;
      while (slugExists) {
        uniqueSlug = `${slug}-${counter}`;
        slugExists = await db.school.findUnique({ where: { slug: uniqueSlug } });
        counter++;
      }

      const school = await db.school.create({
        data: {
          name: schoolName.trim(),
          slug: uniqueSlug,
          plan: 'free',
          region: null,
          isActive: true,
          maxStudents: 30,
          maxTeachers: 3,
        },
      });

      schoolId = school.id;
      schoolJustCreated = true;
      planName = 'free';
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user as SCHOOL_ADMIN
    const user = await db.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        role: 'SCHOOL_ADMIN',
        schoolId,
        isActive: true,
      },
    });

    // Create academic structure if school was just created
    if (schoolJustCreated) {
      await createSchoolStructure(schoolId);
    }

    const planLabel = planName === 'free' ? 'Free Plan' : `${planName.charAt(0).toUpperCase() + planName.slice(1)} Plan`;

    // Submit to Google Sheets
    await submitToGoogleSheet({
      timestamp: new Date().toISOString(),
      name,
      email: email.toLowerCase(),
      schoolName: schoolName.trim(),
      plan: planName,
      registrationCode: registrationCode || 'Free',
    });

    return NextResponse.json(
      {
        message: registrationCode 
          ? `Account created successfully with ${planLabel}. You can now sign in.` 
          : 'Account created successfully with Free Plan. You can now sign in.',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          schoolId: user.schoolId,
        },
        plan: planName,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'An error occurred during registration.' },
      { status: 500 }
    );
  }
}