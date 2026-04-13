import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Valid media types, overlay styles, positions
const VALID_MEDIA_TYPES = ['text', 'image', 'video'] as const;
const VALID_OVERLAY_STYLES = ['modal', 'banner', 'fullscreen'] as const;
const VALID_POSITIONS = ['center', 'top', 'bottom'] as const;

// GET /api/platform/overlays/[id] - Get single overlay
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const overlay = await db.schoolOverlay.findUnique({
      where: { id },
    });

    if (!overlay) {
      return NextResponse.json({ success: false, message: 'Overlay not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: overlay,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// PUT /api/platform/overlays/[id] - Update overlay (SUPER_ADMIN only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req: request });
    if (!token || token.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, message: 'Unauthorized. SUPER_ADMIN role required.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    // Verify overlay exists
    const existing = await db.schoolOverlay.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ success: false, message: 'Overlay not found' }, { status: 404 });
    }

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
      title?: string | null;
      content?: string | null;
      imageUrl?: string | null;
      videoUrl?: string | null;
      mediaType?: string;
      overlayStyle?: string;
      backgroundColor?: string;
      textColor?: string;
      position?: string;
      dismissible?: boolean;
      showOnce?: boolean;
      linkUrl?: string | null;
      linkText?: string | null;
      isActive?: boolean;
      startsAt?: string | null;
      expiresAt?: string | null;
      targetSchools?: string[] | null;
      targetRoles?: string[] | null;
      targetUsers?: string[] | null;
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

    // Validate target arrays if provided
    if (targetSchools !== undefined && targetSchools !== null && !Array.isArray(targetSchools)) {
      return NextResponse.json({ success: false, message: 'targetSchools must be an array of school IDs' }, { status: 400 });
    }
    if (targetRoles !== undefined && targetRoles !== null && !Array.isArray(targetRoles)) {
      return NextResponse.json({ success: false, message: 'targetRoles must be an array of role strings' }, { status: 400 });
    }
    if (targetUsers !== undefined && targetUsers !== null && !Array.isArray(targetUsers)) {
      return NextResponse.json({ success: false, message: 'targetUsers must be an array of user IDs' }, { status: 400 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl;
    if (mediaType !== undefined) updateData.mediaType = mediaType;
    if (overlayStyle !== undefined) updateData.overlayStyle = overlayStyle;
    if (backgroundColor !== undefined) updateData.backgroundColor = backgroundColor;
    if (textColor !== undefined) updateData.textColor = textColor;
    if (position !== undefined) updateData.position = position;
    if (dismissible !== undefined) updateData.dismissible = dismissible;
    if (showOnce !== undefined) updateData.showOnce = showOnce;
    if (linkUrl !== undefined) updateData.linkUrl = linkUrl;
    if (linkText !== undefined) updateData.linkText = linkText;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (priority !== undefined) updateData.priority = priority;

    if (startsAt !== undefined) {
      updateData.startsAt = startsAt ? new Date(startsAt) : new Date();
    }
    if (expiresAt !== undefined) {
      updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }

    // Store JSON arrays as strings
    if (targetSchools !== undefined) {
      updateData.targetSchools = targetSchools ? JSON.stringify(targetSchools) : null;
    }
    if (targetRoles !== undefined) {
      updateData.targetRoles = targetRoles ? JSON.stringify(targetRoles) : null;
    }
    if (targetUsers !== undefined) {
      updateData.targetUsers = targetUsers ? JSON.stringify(targetUsers) : null;
    }

    const overlay = await db.schoolOverlay.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: overlay,
      message: 'Overlay updated successfully',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// DELETE /api/platform/overlays/[id] - Delete overlay (SUPER_ADMIN only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req: request });
    if (!token || token.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, message: 'Unauthorized. SUPER_ADMIN role required.' }, { status: 403 });
    }

    const { id } = await params;

    // Verify overlay exists
    const existing = await db.schoolOverlay.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ success: false, message: 'Overlay not found' }, { status: 404 });
    }

    await db.schoolOverlay.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Overlay deleted successfully',
      deletedId: id,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
