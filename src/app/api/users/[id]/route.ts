import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAuth } from '@/lib/auth-middleware';
import { deleteFile as r2Delete, getPublicUrl } from '@/lib/r2-storage';
import { deleteFile as cloudinaryDelete, isStorageConfigured as cloudinaryConfigured } from '@/lib/cloudinary-storage';

// GET /api/users/[id] - Get single user with role profile
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    // School isolation - non-superadmins can only view users in their school
    const targetUser = await db.user.findUnique({
      where: { id },
      select: { id: true, schoolId: true, role: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && targetUser.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Sensitive fields only for authorized roles
    const adminRoles = ['TEACHER', 'DIRECTOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN'];
    const isAdmin = adminRoles.includes(auth.role || '');
    const isOwnProfile = auth.userId === id;

    const selectFields: Record<string, unknown> = {
      id: true,
      email: true,
      name: true,
      avatar: true,
      phone: true,
      role: true,
      schoolId: true,
      isActive: true,
      lastLogin: true,
      createdAt: true,
      updatedAt: true,
      school: {
        select: { id: true, name: true, slug: true, logo: true },
      },
    };

    // Only include sensitive PII for admins or own profile
    if (isAdmin || isOwnProfile) {
      selectFields.passportNumber = true;
      selectFields.dateOfBirth = true;
      selectFields.gender = true;
      selectFields.address = true;
      selectFields.nationality = true;
      selectFields.emergencyContact = true;
      selectFields.emergencyPhone = true;
      selectFields.bloodGroup = true;
      selectFields.maritalStatus = true;
      selectFields.nextOfKin = true;
      selectFields.nextOfKinPhone = true;
    }

    // Role profiles only for admins or own profile
    if (isAdmin || isOwnProfile) {
      selectFields.studentProfile = {
        select: {
          id: true,
          admissionNo: true,
          classId: true,
          gpa: true,
          cumulativeGpa: true,
          rank: true,
          behaviorScore: true,
          isActive: true,
          class: { select: { id: true, name: true, section: true, grade: true } },
        },
      };
      selectFields.teacherProfile = {
        select: {
          id: true,
          employeeNo: true,
          specialization: true,
          qualification: true,
          gender: true,
          salary: !isOwnProfile || isAdmin,
          isActive: true,
          dateOfJoining: true,
          classes: { select: { id: true, name: true, section: true, grade: true } },
          classSubjects: {
            include: {
              subject: { select: { id: true, name: true, code: true } },
              class: { select: { id: true, name: true } },
            },
          },
        },
      };
      selectFields.parentProfile = {
        select: {
          id: true,
          occupation: true,
          phone: true,
          address: true,
          parentStudents: {
            include: {
              student: {
                select: {
                  id: true,
                  admissionNo: true,
                  user: { select: { name: true } },
                },
              },
            },
          },
        },
      };
      selectFields.accountantProfile = { select: { id: true, employeeNo: true } };
      selectFields.librarianProfile = { select: { id: true, employeeNo: true } };
      selectFields.directorProfile = { select: { id: true, employeeNo: true } };
    }

    const user = await db.user.findUnique({
      where: { id },
      select: selectFields as Record<string, unknown>,
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ data: user });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/users/[id] - Update user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const currentUser = authResult;

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (existing.deletedAt) {
      return NextResponse.json({ error: 'Cannot update a deleted user' }, { status: 410 });
    }

     // School isolation - non-superadmins can only edit users in their school
     if (currentUser.role !== 'SUPER_ADMIN') {
       if (!currentUser.schoolId) {
         return NextResponse.json({ error: 'School ID not found in session' }, { status: 400 });
       }
       if (existing.schoolId !== currentUser.schoolId) {
         return NextResponse.json({ error: 'You can only edit users in your school' }, { status: 403 });
       }
     }
     
     // Prevent Parent and Student roles from editing profiles (including their own)
     if (currentUser.role === 'PARENT' || currentUser.role === 'STUDENT') {
       return NextResponse.json({ error: 'Parent and Student portal users cannot edit profiles' }, { status: 403 });
     }

     const { name, email, phone, avatar, role, schoolId, isActive, password, passportNumber, dateOfBirth, gender, address, nationality, emergencyContact, emergencyPhone, bloodGroup, maritalStatus, nextOfKin, nextOfKinPhone } = body;

    // Role change validation - School Admins cannot grant SUPER_ADMIN or SCHOOL_ADMIN
    if (role !== undefined && role !== existing.role) {
      if (currentUser.role === 'SCHOOL_ADMIN') {
        if (role === 'SUPER_ADMIN' || role === 'SCHOOL_ADMIN') {
          return NextResponse.json(
            { error: 'School Admins cannot grant Super Admin or School Admin roles' },
            { status: 403 }
          );
        }
      }
    }

     const updateData: Record<string, unknown> = {};
     if (name !== undefined) updateData.name = name;
     if (phone !== undefined) updateData.phone = phone;
     if (avatar !== undefined) updateData.avatar = avatar;
     if (role !== undefined) updateData.role = role;
     if (schoolId !== undefined) updateData.schoolId = schoolId;
     if (isActive !== undefined) updateData.isActive = isActive;
     if (passportNumber !== undefined) updateData.passportNumber = passportNumber;
     if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
     if (gender !== undefined) updateData.gender = gender;
     if (address !== undefined) updateData.address = address;
     if (nationality !== undefined) updateData.nationality = nationality;
     if (emergencyContact !== undefined) updateData.emergencyContact = emergencyContact;
     if (emergencyPhone !== undefined) updateData.emergencyPhone = emergencyPhone;
     if (bloodGroup !== undefined) updateData.bloodGroup = bloodGroup;
     if (maritalStatus !== undefined) updateData.maritalStatus = maritalStatus;
     if (nextOfKin !== undefined) updateData.nextOfKin = nextOfKin;
     if (nextOfKinPhone !== undefined) updateData.nextOfKinPhone = nextOfKinPhone;

    // Handle email update with uniqueness check
    if (email && email !== existing.email) {
      const emailExists = await db.user.findUnique({ where: { email: email.toLowerCase() } });
      if (emailExists) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
      }
      updateData.email = email.toLowerCase();
    }

     // Handle password update - only allow if user is editing someone else or is admin
     if (password) {
       // Prevent non-admin users from changing their own password via profile edit
       if (currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'SCHOOL_ADMIN' && id === currentUser.id) {
         return NextResponse.json({ error: 'Password changes must be done through the password change endpoint' }, { status: 403 });
       }
       updateData.password = await bcrypt.hash(password, 10);
     }

      // Delete old avatar from storage if replacing with a new one
      // Supports both legacy Cloudinary URLs and new R2/CDN URLs
      if (avatar !== undefined && existing.avatar && avatar !== existing.avatar && typeof existing.avatar === 'string') {
        try {
          const oldUrl: string = existing.avatar;
          if (oldUrl.includes('cloudinary.com')) {
            if (cloudinaryConfigured()) {
              const parsed = new URL(oldUrl);
              const pathParts = parsed.pathname.split('/');
              const uploadIdx = pathParts.indexOf('upload');
              if (uploadIdx !== -1 && pathParts[uploadIdx + 1]?.startsWith('v')) {
                const pubId = pathParts.slice(uploadIdx + 2).join('/').replace(/\.[^.]+$/, '');
                if (pubId) await cloudinaryDelete(pubId, { resourceType: 'image' });
              }
            }
          } else {
            const cdnUrl = new URL(getPublicUrl(''));
            const cdnBase = cdnUrl.origin;
            if (oldUrl.startsWith(cdnBase)) {
              const key = oldUrl.replace(cdnBase + '/', '');
              if (key) await r2Delete(key);
            }
          }
        } catch {
          // Non-critical; proceed with update
        }
      }

     const user = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        phone: true,
        role: true,
        schoolId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        school: { select: { id: true, name: true } },
      },
    });

    // Sync avatar to student photo if user is a student
    if (avatar !== undefined && existing.role === 'STUDENT') {
      try {
        // `student.userId` is unique in the schema; use update for clarity and safety
        await db.student.update({
          where: { userId: id },
          data: { photo: avatar },
        });
      } catch (err) {
        // Student profile may not exist or update failed; log for investigation
        console.warn('users/[id] avatar sync to student.photo failed:', err);
      }
    }

    return NextResponse.json({ data: user, message: 'User updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/users/[id] - Soft delete user (set deletedAt)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const currentUser = authResult;

  try {
    const { id } = await params;

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (existing.deletedAt) {
      return NextResponse.json({ error: 'User already deleted' }, { status: 410 });
    }

    // School isolation - non-superadmins can only delete users in their school
    if (currentUser.role !== 'SUPER_ADMIN') {
      if (!currentUser.schoolId) {
        return NextResponse.json({ error: 'School ID not found in session' }, { status: 400 });
      }
      if (existing.schoolId !== currentUser.schoolId) {
        return NextResponse.json({ error: 'You can only delete users in your school' }, { status: 403 });
      }
    }

    // Free up email for reuse, then soft-delete user
    const deletedEmail = `deleted_${id}_${existing.email}`;
    await db.user.update({
      where: { id },
      data: {
        email: deletedEmail,
        deletedAt: new Date(),
        isActive: false,
      },
    });

    // Also soft delete the role-specific profile if it exists
    const profileTables = [
      { find: () => db.student.findFirst({ where: { userId: id } }), update: (profileId: string) => db.student.update({ where: { id: profileId }, data: { deletedAt: new Date(), isActive: false } }) },
      { find: () => db.teacher.findFirst({ where: { userId: id } }), update: (profileId: string) => db.teacher.update({ where: { id: profileId }, data: { deletedAt: new Date() } }) },
      { find: () => db.parent.findFirst({ where: { userId: id } }), update: (profileId: string) => db.parent.update({ where: { id: profileId }, data: { deletedAt: new Date() } }) },
      { find: () => db.accountant.findFirst({ where: { userId: id } }), update: (profileId: string) => db.accountant.update({ where: { id: profileId }, data: { deletedAt: new Date() } }) },
      { find: () => db.librarian.findFirst({ where: { userId: id } }), update: (profileId: string) => db.librarian.update({ where: { id: profileId }, data: { deletedAt: new Date() } }) },
      { find: () => db.director.findFirst({ where: { userId: id } }), update: (profileId: string) => db.director.update({ where: { id: profileId }, data: { deletedAt: new Date() } }) },
    ];

    for (const table of profileTables) {
      try {
        const profile = await table.find();
        if (profile) {
          await table.update(profile.id);
        }
      } catch {
        // Profile may not exist, continue
      }
    }

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
