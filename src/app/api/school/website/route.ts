import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-middleware';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.authenticated || !auth.schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const school = await db.school.findUnique({
      where: { id: auth.schoolId },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        primaryColor: true,
        secondaryColor: true,
        motto: true,
        address: true,
        phone: true,
        email: true,
        website: true,
        foundedDate: true,
        schoolType: true,
        publicPage: true,
      },
    });

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    return NextResponse.json({ school });
  } catch (error) {
    console.error('[WEBSITE_GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.authenticated || !auth.schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (auth.role !== 'SCHOOL_ADMIN' && auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    const publicPageData: Record<string, any> = {};
    const allowedFields = [
      'heroTitle', 'heroSubtitle', 'heroImageUrl', 'heroVideoUrl',
      'aboutTitle', 'aboutContent', 'aboutImages',
      'admissionsTitle', 'admissionsContent',
      'contactEmail', 'contactPhone', 'contactAddress',
      'socialLinks',
      'metaTitle', 'metaDescription',
      'customCss', 'extraSections', 'featureCards', 'sectionVisibility', 'themePreset',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        publicPageData[field] = body[field];
      }
    }

    const schoolData: Record<string, any> = {};
    const schoolAllowedFields = ['name', 'logo', 'primaryColor', 'secondaryColor', 'motto', 'address', 'phone', 'email', 'website', 'foundedDate', 'schoolType', 'slug'];
    for (const field of schoolAllowedFields) {
      if (body[field] !== undefined) {
        schoolData[field] = body[field];
      }
    }

    if (schoolData.slug !== undefined) {
      const newSlug = schoolData.slug as string;
      if (!SLUG_REGEX.test(newSlug)) {
        return NextResponse.json({ error: 'Invalid slug format. Use lowercase letters, numbers, and hyphens only.' }, { status: 400 });
      }
      const existing = await db.school.findUnique({ where: { slug: newSlug } });
      if (existing && existing.id !== auth.schoolId) {
        return NextResponse.json({ error: 'This slug is already taken by another school.' }, { status: 409 });
      }
    }

    const result = await db.$transaction(async (tx) => {
      if (Object.keys(schoolData).length > 0) {
        await tx.school.update({
          where: { id: auth.schoolId! },
          data: schoolData,
        });
      }

      if (Object.keys(publicPageData).length > 0) {
        const existing = await tx.schoolPublicPage.findUnique({
          where: { schoolId: auth.schoolId! },
        });

        if (existing) {
          await tx.schoolPublicPage.update({
            where: { schoolId: auth.schoolId! },
            data: publicPageData,
          });
        } else {
          await tx.schoolPublicPage.create({
            data: {
              schoolId: auth.schoolId!,
              ...publicPageData,
            },
          });
        }
      }

      return tx.school.findUnique({
        where: { id: auth.schoolId! },
        select: { publicPage: true, slug: true },
      });
    });

    return NextResponse.json({ success: true, publicPage: result?.publicPage, slug: result?.slug });
  } catch (error) {
    console.error('[WEBSITE_PUT]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
