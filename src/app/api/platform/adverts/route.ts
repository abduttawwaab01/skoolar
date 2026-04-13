import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// GET /api/platform/adverts - Public: fetch active adverts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contentType = searchParams.get('contentType') || '';
    const position = searchParams.get('position');
    const userRole = searchParams.get('userRole') || '';
    const schoolId = searchParams.get('schoolId') || '';

    const now = new Date();
    const where: any = {
      isActive: true,
      startsAt: { lte: now },
    };

    if (contentType) where.contentType = contentType;
    if (position !== null && position !== undefined && position !== '') {
      where.position = parseInt(position);
    }

    // Filter by targetRoles if provided
    if (userRole) {
      where.OR = [
        { targetRoles: null },
        { targetRoles: '' },
        { targetRoles: { contains: `"${userRole}"` } },
      ];
    }

    // Filter by targetSchools if provided
    if (schoolId) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { targetSchools: null },
            { targetSchools: '' },
            { targetSchools: { contains: schoolId } },
          ],
        },
      ];
    }

    const adverts = await db.platformAdvert.findMany({
      where: {
        ...where,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: now } },
        ],
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ success: true, data: adverts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// POST /api/platform/adverts - Super Admin: create advert
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request });
    if (!token || token.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const {
      title, description, contentType, mediaUrl, mediaType, imageUrl,
      linkUrl, linkText, ctaType, htmlContent, buttonColor,
      targetRoles, targetSchools, position, autoSwipeMs, isActive, startsAt, expiresAt,
    } = body;

    if (!title) {
      return NextResponse.json({ success: false, message: 'Title is required' }, { status: 400 });
    }

    const advert = await db.platformAdvert.create({
      data: {
        title,
        description: description || null,
        contentType: contentType || 'text',
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
        imageUrl: imageUrl || null,
        linkUrl: linkUrl || null,
        linkText: linkText || null,
        ctaType: ctaType || 'link',
        htmlContent: htmlContent || null,
        buttonColor: buttonColor || '#059669',
        targetRoles: targetRoles ? JSON.stringify(targetRoles) : null,
        targetSchools: targetSchools ? JSON.stringify(targetSchools) : null,
        position: position !== undefined ? position : 0,
        autoSwipeMs: autoSwipeMs !== undefined ? autoSwipeMs : 5000,
        isActive: isActive !== undefined ? isActive : true,
        startsAt: startsAt ? new Date(startsAt) : new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: token.id as string,
      },
    });

    return NextResponse.json({ success: true, data: advert, message: 'Advert created' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
