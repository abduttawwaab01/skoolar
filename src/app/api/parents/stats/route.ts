import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    // Find children linked to this parent ID
    // Note: parentIds is a string like "id1,id2" in some schemas, or linked via User/Profile
    // Based on previous audits, we use contains or findMany with parentIds string matching
    
    const childrenCount = await db.student.count({
      where: { 
        schoolId: auth.schoolId,
        parentIds: { contains: auth.userId },
        deletedAt: null
      }
    });

    const children = await db.student.findMany({
      where: { 
        schoolId: auth.schoolId,
        parentIds: { contains: auth.userId },
        deletedAt: null 
      },
      include: {
        user: { select: { name: true, avatar: true, email: true } },
        class: { select: { name: true, section: true } }
      }
    });

    if (children.length === 0) {
      return NextResponse.json({ data: [], message: 'No children linked to this account' });
    }

    // Consolidated data for each child
    const enrichedChildren = await Promise.all(children.map(async (child) => {
      const [attendanceRatio, pendingFees, recentBehavior] = await Promise.all([
        // Attendance
        db.attendance.aggregate({
          where: { studentId: child.id },
          _count: { studentId: true }
        }).then(async () => {
             const total = await db.attendance.count({ where: { studentId: child.id } });
             const present = await db.attendance.count({ where: { studentId: child.id, status: 'present' } });
             return total > 0 ? Math.round((present / total) * 100) : 0;
        }),
        // Payments (Pending)
        db.payment.aggregate({
          where: { 
            schoolId: child.schoolId,
            paidBy: child.id, // or linked via parent, but usually student-based billing
            status: 'pending' 
          },
          _sum: { amount: true }
        }),
        // Behavior
        db.behaviorLog.findMany({
          where: { studentId: child.id },
          orderBy: { createdAt: 'desc' },
          take: 3
        })
      ]);

      // Library Borrowing History (as requested by user)
      const libraryStats = await db.borrowRecord.findMany({
        where: { studentId: child.id, status: 'borrowed' },
        include: { book: { select: { title: true } } },
        take: 5
      });

      return {
        profile: {
          id: child.id,
          name: child.user.name,
          avatar: child.user.avatar,
          admissionNo: child.admissionNo,
          class: child.class?.name,
          section: child.class?.section,
          gpa: child.gpa,
          rank: child.rank
        },
        stats: {
          attendanceRate: attendanceRatio,
          pendingFees: pendingFees._sum.amount || 0,
          behaviorCount: recentBehavior.length,
          borrowedBooks: libraryStats.length
        },
        recentBehavior: recentBehavior.map(b => ({
          type: b.type,
          description: b.description,
          date: b.createdAt
        })),
        borrowedBooks: libraryStats.map(l => ({
          title: l.book?.title,
          dueDate: l.dueDate
        }))
      };
    }));

    return NextResponse.json({ data: enrichedChildren });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
