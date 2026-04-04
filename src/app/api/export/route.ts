import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/export - List export history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const schoolId = searchParams.get('schoolId') || '';
    const type = searchParams.get('type') || '';
    const userId = searchParams.get('userId') || '';

    const where: Record<string, unknown> = {};

    if (schoolId) where.schoolId = schoolId;
    if (type) where.type = type;
    if (userId) where.userId = userId;

    const [data, total] = await Promise.all([
      db.exportLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          schoolId: true,
          userId: true,
          type: true,
          format: true,
          filename: true,
          fileSize: true,
          status: true,
          createdAt: true,
          school: {
            select: { id: true, name: true },
          },
        },
      }),
      db.exportLog.count({ where }),
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

// POST /api/export - Create export log entry and return data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { schoolId, userId, type, format } = body;

    if (!schoolId || !type) {
      return NextResponse.json(
        { error: 'schoolId and type are required' },
        { status: 400 }
      );
    }

    const exportFormat = format || 'json';

    let exportData: unknown = {};
    let filename = '';

    switch (type) {
      case 'report_cards': {
        const reportCards = await db.reportCard.findMany({
          where: { schoolId, deletedAt: null },
          include: {
            student: {
              select: {
                admissionNo: true,
                user: { select: { name: true, email: true } },
                class: { select: { name: true, section: true } },
              },
            },
            term: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
        });
        exportData = reportCards;
        filename = `report-cards-${new Date().toISOString().split('T')[0]}`;
        break;
      }

      case 'attendance': {
        const attendance = await db.attendance.findMany({
          where: { schoolId },
          include: {
            student: {
              select: {
                admissionNo: true,
                user: { select: { name: true } },
              },
            },
            term: { select: { name: true } },
          },
          orderBy: { date: 'desc' },
        });
        exportData = attendance;
        filename = `attendance-${new Date().toISOString().split('T')[0]}`;
        break;
      }

      case 'financial': {
        const payments = await db.payment.findMany({
          where: { schoolId, deletedAt: null },
          include: {
            student: {
              select: {
                admissionNo: true,
                user: { select: { name: true } },
              },
            },
            // feeStructure is not a relation on Payment (only feeStructureId scalar), omitted
          },
          orderBy: { createdAt: 'desc' },
        });

        const summary = await db.payment.aggregate({
          _sum: { amount: true },
          _count: true,
          where: { schoolId, status: 'verified' },
        });

        exportData = {
          summary: {
            totalVerified: summary._sum.amount || 0,
            transactionCount: summary._count,
          },
          payments,
        };
        filename = `financial-report-${new Date().toISOString().split('T')[0]}`;
        break;
      }

      case 'student_list': {
        const students = await db.student.findMany({
          where: { schoolId, deletedAt: null },
          select: {
            admissionNo: true,
            isActive: true,
            dateOfBirth: true,
            gender: true,
            gpa: true,
            class: { select: { name: true, section: true, grade: true } },
            user: { select: { name: true, email: true, phone: true } },
          },
          orderBy: { admissionNo: 'asc' },
        });
        exportData = students;
        filename = `student-list-${new Date().toISOString().split('T')[0]}`;
        break;
      }

      default:
        return NextResponse.json(
          { error: 'Invalid export type. Use: report_cards, attendance, financial, student_list' },
          { status: 400 }
        );
    }

    // Create export log
    const exportLog = await db.exportLog.create({
      data: {
        schoolId,
        userId: userId || null,
        type,
        format: exportFormat,
        filename: `${filename}.${exportFormat}`,
        fileSize: JSON.stringify(exportData).length,
        status: 'success',
      },
    });

    // Add watermark metadata to all exports
    const brandedExportData: Record<string, unknown> = {
      _watermark: 'Powered by Skoolar || Odebunmi Tawwāb',
      _generatedAt: new Date().toISOString(),
    };
    if (typeof exportData === 'object' && exportData !== null) {
      Object.assign(brandedExportData, exportData);
    }

    return NextResponse.json({
      data: {
        exportLog,
        exportData: brandedExportData,
      },
      message: `Export created successfully: ${filename}.${exportFormat}`,
    }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
