import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/audit-logs - List audit logs with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const schoolId = searchParams.get('schoolId') || '';
    const userId = searchParams.get('userId') || '';
    const action = searchParams.get('action') || '';
    const entity = searchParams.get('entity') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const search = searchParams.get('search') || '';

    const where: Record<string, unknown> = {};

    if (schoolId) where.schoolId = schoolId;
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (entity) where.entity = entity;
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.createdAt = dateFilter;
    }
    if (search) {
      where.OR = [
        { action: { contains: search } },
        { entity: { contains: search } },
        { details: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          schoolId: true,
          userId: true,
          action: true,
          entity: true,
          entityId: true,
          details: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          school: {
            select: { id: true, name: true },
          },
        },
      }),
      db.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/audit-logs - Create audit log entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { schoolId, userId, action, entity, entityId, details, ipAddress, userAgent } = body;

    if (!schoolId || !action || !entity) {
      return NextResponse.json(
        { error: 'schoolId, action, and entity are required' },
        { status: 400 }
      );
    }

    const auditLog = await db.auditLog.create({
      data: {
        schoolId,
        userId: userId || null,
        action,
        entity,
        entityId: entityId || null,
        details: details || null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    return NextResponse.json({ data: auditLog, message: 'Audit log created successfully' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
