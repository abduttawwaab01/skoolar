import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Valid media types
const VALID_MEDIA_TYPES = ['text', 'image', 'video'] as const;
const VALID_OVERLAY_STYLES = ['modal', 'banner', 'fullscreen'] as const;
const VALID_POSITIONS = ['center', 'top', 'bottom'] as const;

// GET /api/platform/overlays - List active overlays for a user/school/role
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId') || '';
    const userId = searchParams.get('userId') || '';
    const role = searchParams.get('role') || '';
    const limit = parseInt(searchParams.get('limit') || '50');

    const now = new Date();

    // Base filter: active, started, not expired
    const where: Record<string, unknown> = {
      isActive: true,
      startsAt: { lte: now },
      OR: [
        { expiresAt: null },
        { expiresAt: { gte: now } },
      ],
    };

    // Fetch all matching active overlays, then filter in-memory for JSON array fields
    // because Prisma doesn't natively support JSON array contains queries
    const overlays = await db.schoolOverlay.findMany({
      where: {
        ...where,
      },
      orderBy: { priority: 'desc' },
      take: limit,
    });

    // Filter overlays based on targeting
    const filtered = overlays.filter((overlay) => {
      // Check school targeting
      if (schoolId && overlay.targetSchools) {
        try {
          const targetSchools: string[] = JSON.parse(overlay.targetSchools);
          if (targetSchools.length > 0 && !targetSchools.includes(schoolId)) {
            return false;
          }
        } catch {
          // Invalid JSON, skip this filter
        }
      }

      // Check role targeting
      if (role && overlay.targetRoles) {
        try {
          const targetRoles: string[] = JSON.parse(overlay.targetRoles);
          if (targetRoles.length > 0 && !targetRoles.includes(role)) {
            return false;
          }
        } catch {
          // Invalid JSON, skip this filter
        }
      }

      // Check user targeting
      if (userId && overlay.targetUsers) {
        try {
          const targetUsers: string[] = JSON.parse(overlay.targetUsers);
          if (targetUsers.length > 0 && !targetUsers.includes(userId)) {
            return false;
          }
        } catch {
          // Invalid JSON, skip this filter
        }
      }

      return true;
    });

    return NextResponse.json({
      success: true,
      data: filtered,
      total: filtered.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// POST /api/platform/overlays - Super Admin: create overlay
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request });
    if (!token || token.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, message: 'Unauthorized. SUPER_ADMIN role required.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      title,
      content,
      imageUrl,
      videoUrl,
      mediaType,
      overlayStyle,
      backgroundColor,
      textColor,
      position,
      dismissible,
      showOnce,
      linkUrl,
      linkText,
      isActive,
      startsAt,
      expiresAt,
      targetSchools,
      targetRoles,
      targetUsers,
      priority,
    } = body as {
      title?: string;
      content?: string;
      imageUrl?: string;
      videoUrl?: string;
      mediaType?: string;
      overlayStyle?: string;
      backgroundColor?: string;
      textColor?: string;
      position?: string;
      dismissible?: boolean;
      showOnce?: boolean;
      linkUrl?: string;
      linkText?: string;
      isActive?: boolean;
      startsAt?: string;
      expiresAt?: string;
      targetSchools?: string[];
      targetRoles?: string[];
      targetUsers?: string[];
      priority?: number;
    };

    // Validate mediaType
    if (mediaType && !VALID_MEDIA_TYPES.includes(mediaType as (typeof VALID_MEDIA_TYPES)[number])) {
      return NextResponse.json(
        { success: false, message: `Invalid mediaType. Must be one of: ${VALID_MEDIA_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate overlayStyle
    if (overlayStyle && !VALID_OVERLAY_STYLES.includes(overlayStyle as (typeof VALID_OVERLAY_STYLES)[number])) {
      return NextResponse.json(
        { success: false, message: `Invalid overlayStyle. Must be one of: ${VALID_OVERLAY_STYLES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate position
    if (position && !VALID_POSITIONS.includes(position as (typeof VALID_POSITIONS)[number])) {
      return NextResponse.json(
        { success: false, message: `Invalid position. Must be one of: ${VALID_POSITIONS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate target arrays
    if (targetSchools && !Array.isArray(targetSchools)) {
      return NextResponse.json({ success: false, message: 'targetSchools must be an array of school IDs' }, { status: 400 });
    }
    if (targetRoles && !Array.isArray(targetRoles)) {
      return NextResponse.json({ success: false, message: 'targetRoles must be an array of role strings' }, { status: 400 });
    }
    if (targetUsers && !Array.isArray(targetUsers)) {
      return NextResponse.json({ success: false, message: 'targetUsers must be an array of user IDs' }, { status: 400 });
    }

    const overlay = await db.schoolOverlay.create({
      data: {
        title: title || null,
        content: content || null,
        imageUrl: imageUrl || null,
        videoUrl: videoUrl || null,
        mediaType: mediaType || 'text',
        overlayStyle: overlayStyle || 'modal',
        backgroundColor: backgroundColor || 'rgba(0,0,0,0.8)',
        textColor: textColor || '#FFFFFF',
        position: position || 'center',
        dismissible: dismissible !== undefined ? dismissible : true,
        showOnce: showOnce !== undefined ? showOnce : false,
        linkUrl: linkUrl || null,
        linkText: linkText || null,
        isActive: isActive !== undefined ? isActive : true,
        startsAt: startsAt ? new Date(startsAt) : new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        targetSchools: targetSchools ? JSON.stringify(targetSchools) : null,
        targetRoles: targetRoles ? JSON.stringify(targetRoles) : null,
        targetUsers: targetUsers ? JSON.stringify(targetUsers) : null,
        priority: priority !== undefined ? priority : 0,
        createdBy: token.id as string,
      },
    });

    return NextResponse.json({
      success: true,
      data: overlay,
      message: 'Overlay created successfully',
    }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
