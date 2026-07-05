import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { authenticateRequest } from '@/lib/auth-middleware';
import { updateSchoolCache } from '@/lib/school-cache';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.authenticated || !auth.schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (auth.role !== 'SCHOOL_ADMIN' && auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const school = await db.school.findUnique({
      where: { id: auth.schoolId },
      select: { id: true, slug: true },
    });

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    const existingPage = await db.schoolPublicPage.findUnique({
      where: { schoolId: auth.schoolId },
    });

    if (!existingPage) {
      return NextResponse.json({ error: 'No public page data to publish' }, { status: 400 });
    }

    await db.schoolPublicPage.update({
      where: { schoolId: auth.schoolId },
      data: {
        isPublished: true,
        publishedAt: new Date(),
      },
    });

    await updateSchoolCache(auth.schoolId, school.slug);

    const body = await request.json().catch(() => ({}));
    const oldSlug: string | undefined = body.oldSlug;

    const slugsToRevalidate = [school.slug];
    if (oldSlug && oldSlug !== school.slug) {
      slugsToRevalidate.push(oldSlug);
    }

    const paths: string[] = [];
    for (const s of slugsToRevalidate) {
      paths.push(`/s/${s}`);
      paths.push(`/s/${s}/about`);
      paths.push(`/s/${s}/admissions`);
      paths.push(`/s/${s}/contact`);
    }

    for (const path of paths) {
      revalidatePath(path);
    }
    revalidateTag(`school-${school.slug}`, 'default');
    if (oldSlug && oldSlug !== school.slug) {
      revalidateTag(`school-${oldSlug}`, 'default');
    }

    return NextResponse.json({
      success: true,
      message: 'School website published successfully',
      paths,
    });
  } catch (error) {
    console.error('[PUBLISH_POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.authenticated || !auth.schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (auth.role !== 'SCHOOL_ADMIN' && auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const school = await db.school.findUnique({
      where: { id: auth.schoolId },
      select: { id: true, slug: true },
    });

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    await db.schoolPublicPage.update({
      where: { schoolId: auth.schoolId },
      data: { isPublished: false },
    });

    await updateSchoolCache(auth.schoolId, school.slug);

    return NextResponse.json({
      success: true,
      message: 'School website unpublished',
    });
  } catch (error) {
    console.error('[PUBLISH_DELETE]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
