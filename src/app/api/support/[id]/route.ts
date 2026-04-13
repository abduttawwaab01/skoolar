import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/support/[id] - Get single support ticket
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const ticket = await db.supportTicket.findUnique({
      where: { id },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Support ticket not found' }, { status: 404 });
    }

    return NextResponse.json({ data: ticket });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/support/[id] - Update support ticket (add response, change status, rate)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.supportTicket.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Support ticket not found' }, { status: 404 });
    }

    const { response, status, assignedTo, rating } = body;

    const validStatuses = ['open', 'in_progress', 'waiting_response', 'resolved', 'closed'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (response !== undefined) updateData.response = response;
    if (status !== undefined) updateData.status = status;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (rating !== undefined) updateData.rating = rating;

    // Auto-set resolvedAt when status changes to resolved or closed
    if ((status === 'resolved' || status === 'closed') && !existing.resolvedAt) {
      updateData.resolvedAt = new Date();
    }

    const ticket = await db.supportTicket.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ data: ticket, message: 'Support ticket updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/support/[id] - Delete support ticket
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.supportTicket.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Support ticket not found' }, { status: 404 });
    }

    await db.supportTicket.delete({ where: { id } });

    return NextResponse.json({ message: 'Support ticket deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
