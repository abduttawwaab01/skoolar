import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// PUT /api/platform/story-submissions/[id] - Super Admin: approve/reject
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req: request });
    if (!token || token.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, rejectionReason, adminNotes } = body; // action: 'approve' or 'reject'

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ success: false, message: 'Action must be "approve" or "reject"' }, { status: 400 });
    }

    const submission = await db.storySubmission.findUnique({ where: { id } });
    if (!submission) {
      return NextResponse.json({ success: false, message: 'Submission not found' }, { status: 404 });
    }

    if (action === 'approve') {
      // Create a PlatformStory from the submission
      const story = await db.platformStory.create({
        data: {
          title: submission.title,
          content: submission.content,
          excerpt: submission.content.substring(0, 200) + '...',
          coverImage: submission.coverImage,
          level: submission.level,
          grade: submission.grade,
          category: submission.category,
          authorName: submission.authorName,
          submittedBy: submission.id,
          isPublished: true,
          publishedAt: new Date(),
          approvedBy: token.id as string,
          approvedAt: new Date(),
          createdBy: token.id as string,
        },
      });

      await db.storySubmission.update({
        where: { id },
        data: {
          status: 'approved',
          storyId: story.id,
          reviewedBy: token.id as string,
          reviewedAt: new Date(),
          adminNotes: adminNotes || null,
        },
      });

      return NextResponse.json({ success: true, data: { submission, story }, message: 'Story approved and published' });
    } else {
      await db.storySubmission.update({
        where: { id },
        data: {
          status: 'rejected',
          adminNotes: rejectionReason ? `Rejection reason: ${rejectionReason}` : (adminNotes || null),
          reviewedBy: token.id as string,
          reviewedAt: new Date(),
        },
      });

      return NextResponse.json({ success: true, message: 'Story submission rejected' });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
