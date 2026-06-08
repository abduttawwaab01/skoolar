import { db } from '@/lib/db';
import { sendPushNotification } from '@/lib/push-notifications';
import type { PushSubscription } from '@/lib/push-notifications';

interface CreateNotificationInput {
  userId: string;
  schoolId?: string;
  title: string;
  message: string;
  type?: string;
  category?: string;
  actionUrl?: string;
}

async function getUserPushSubscriptions(
  userId: string
): Promise<PushSubscription[]> {
  try {
    const subs = await db.pushSubscription.findMany({
      where: { userId },
      select: { subscription: true },
    });
    return subs
      .map((s) => {
        try {
          return JSON.parse(s.subscription) as PushSubscription;
        } catch {
          return null;
        }
      })
      .filter((s): s is PushSubscription => s !== null);
  } catch {
    return [];
  }
}

export async function createNotification(input: CreateNotificationInput) {
  const notification = await db.notification.create({
    data: {
      userId: input.userId,
      schoolId: input.schoolId || null,
      title: input.title,
      message: input.message,
      type: input.type || 'info',
      category: input.category || 'general',
      actionUrl: input.actionUrl || null,
    },
  });

  try {
    const subs = await getUserPushSubscriptions(input.userId);
    for (const sub of subs) {
      sendPushNotification(sub, {
        title: input.title,
        body: input.message,
        icon: '/favicon.ico',
        badge: '/badge-icon.png',
        data: { url: input.actionUrl },
        tag: 'skoolar-notification',
      }).catch(() => {});
    }
  } catch {}
  return notification;
}

export async function createBatchNotifications(
  inputs: CreateNotificationInput[]
) {
  if (inputs.length === 0) return [];
  const notifications = await db.notification.createMany({
    data: inputs.map((i) => ({
      userId: i.userId,
      schoolId: i.schoolId || null,
      title: i.title,
      message: i.message,
      type: i.type || 'info',
      category: i.category || 'general',
      actionUrl: i.actionUrl || null,
    })),
  });
  for (const input of inputs) {
    try {
      const subs = await getUserPushSubscriptions(input.userId);
      for (const sub of subs) {
        sendPushNotification(sub, {
          title: input.title,
          body: input.message,
          icon: '/favicon.ico',
          badge: '/badge-icon.png',
          data: { url: input.actionUrl },
          tag: 'skoolar-notification',
        }).catch(() => {});
      }
    } catch {}
  }
  return notifications;
}

// Notify all users with a given role in a school
export async function notifyUsersByRole(
  schoolId: string,
  roles: string | string[],
  title: string,
  message: string,
  options?: { type?: string; category?: string; actionUrl?: string }
) {
  const roleArray = Array.isArray(roles) ? roles : [roles];
  const users = await db.user.findMany({
    where: { schoolId, role: { in: roleArray } },
    select: { id: true },
  });
  if (users.length === 0) return;
  await createBatchNotifications(
    users.map((u) => ({
      userId: u.id,
      schoolId,
      title,
      message,
      type: options?.type || 'info',
      category: options?.category || 'general',
      actionUrl: options?.actionUrl,
    }))
  );
}

// Notify parents of a student
export async function notifyStudentParents(
  studentId: string,
  title: string,
  message: string,
  options?: { type?: string; category?: string; actionUrl?: string; schoolId?: string }
) {
  const studentParents = await db.studentParent.findMany({
    where: { studentId },
    include: {
      parent: {
        include: {
          user: { select: { id: true } },
        },
      },
    },
  });
  const userIds = studentParents
    .map((sp) => sp.parent.user?.id)
    .filter((id): id is string => !!id);
  if (userIds.length === 0) return;
  await createBatchNotifications(
    userIds.map((uid) => ({
      userId: uid,
      schoolId: options?.schoolId,
      title,
      message,
      type: options?.type || 'info',
      category: options?.category || 'general',
      actionUrl: options?.actionUrl,
    }))
  );
}

// Notify students in a class (and optionally their parents)
export async function notifyClassStudents(
  classId: string,
  schoolId: string,
  title: string,
  message: string,
  options?: {
    type?: string;
    category?: string;
    actionUrl?: string;
    includeParents?: boolean;
  }
) {
  const students = await db.student.findMany({
    where: { classId, isActive: true, deletedAt: null },
    select: { id: true, userId: true },
  });
  if (students.length === 0) return;
  await createBatchNotifications(
    students.map((s) => ({
      userId: s.userId,
      schoolId,
      title,
      message,
      type: options?.type || 'info',
      category: options?.category || 'general',
      actionUrl: options?.actionUrl,
    }))
  );
  // Optionally notify parents too
  if (options?.includeParents) {
    const studentIds = students.map((s) => s.id);
    const studentParents = await db.studentParent.findMany({
      where: { studentId: { in: studentIds } },
      include: {
        parent: {
          include: {
            user: { select: { id: true } },
          },
        },
      },
    });
    const parentUserIds = [
      ...new Set(
        studentParents
          .map((sp) => sp.parent.user?.id)
          .filter((id): id is string => !!id)
      ),
    ];
    if (parentUserIds.length > 0) {
      await createBatchNotifications(
        parentUserIds.map((uid) => ({
          userId: uid,
          schoolId,
          title,
          message,
          type: options?.type || 'info',
          category: options?.category || 'general',
          actionUrl: options?.actionUrl,
        }))
      );
    }
  }
}

// Notify a student and their parents
export async function notifyStudentAndParents(
  studentId: string,
  schoolId: string,
  title: string,
  message: string,
  options?: { type?: string; category?: string; actionUrl?: string }
) {
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { userId: true },
  });
  if (!student) return;
  const inputs: CreateNotificationInput[] = [
    {
      userId: student.userId,
      schoolId,
      title,
      message,
      type: options?.type || 'info',
      category: options?.category || 'general',
      actionUrl: options?.actionUrl,
    },
  ];
  const studentParents = await db.studentParent.findMany({
    where: { studentId },
    include: {
      parent: {
        include: {
          user: { select: { id: true } },
        },
      },
    },
  });
  for (const sp of studentParents) {
    if (sp.parent.user?.id) {
      inputs.push({
        userId: sp.parent.user.id,
        schoolId,
        title,
        message,
        type: options?.type || 'info',
        category: options?.category || 'general',
        actionUrl: options?.actionUrl,
      });
    }
  }
  await createBatchNotifications(inputs);
}

// Notify admins / accountants in a school
export async function notifySchoolAdmins(
  schoolId: string,
  title: string,
  message: string,
  options?: { type?: string; category?: string; actionUrl?: string }
) {
  await notifyUsersByRole(schoolId, ['SCHOOL_ADMIN', 'ADMIN', 'ACCOUNTANT'], title, message, options);
}
