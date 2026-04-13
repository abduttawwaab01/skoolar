# Fix Plan: Add Missing DELETE Endpoints with Proper Role Restrictions

## Problem Analysis
Several modules in the Skoolar platform lack DELETE endpoints where soft deletes would be appropriate for data lifecycle management. Based on the code review:

Modules WITH DELETE endpoints (properly implemented):
- Students (`src/app/api/students/[id]/route.ts`) - Has DELETE with proper role checks
- Teachers (`src/app/api/teachers/[id]/route.ts`) - Has DELETE with proper role checks

Modules MISSING DELETE endpoints:
- Classes (`src/app/api/classes/route.ts`) - Only has GET/POST
- Exams (`src/app/api/exams/route.ts`) - Only has GET/POST
- Report Cards (`src/app/api/report-cards/route.ts`) - Only has GET/POST
- Parents (`src/app/api/parents/route.ts`) - Only has GET/POST
- Payments (`src/app/api/payments/route.ts`) - Only has GET/POST
- Subjects (`src/app/api/subjects/route.ts`) - Only has GET/POST
- Fee Structure (`src/app/api/fee-structure/route.ts`) - Only has GET/POST
- Library Books (`src/app/api/library/books/route.ts`) - Only has GET/POST

Note: Some entities like attendance records, payments, etc. might have legitimate reasons for not having DELETE endpoints (audit trails), but most should support soft deletes.

## Solution Approach
Implement DELETE endpoints following the established pattern from Students/Teachers modules:
1. Soft delete approach (mark as deleted rather than hard delete)
2. Proper role-based authorization using requireRole() middleware
3. School context validation
4. Consistent error handling and response formats
5. Cascade deletes where appropriate (e.g., delete related user records)

## Implementation Plan

### 1. Classes Module (`src/app/api/classes/[id]/route.ts`)
**Roles allowed**: SCHOOL_ADMIN, SUPER_ADMIN
**Logic**: 
- Soft delete class (set deletedAt)
- Optionally prevent deletion if class has active students
- Return appropriate success/error messages

### 2. Exams Module (`src/app/api/exams/[id]/route.ts`)
**Roles allowed**: SCHOOL_ADMIN, TEACHER, SUPER_ADMIN
**Logic**:
- Soft delete exam (set deletedAt)
- Prevent deletion if exam has active attempts/scores (or cascade delete scores)
- Return appropriate success/error messages

### 3. Report Cards Module (`src/app/api/report-cards/[id]/route.ts`)
**Roles allowed**: SCHOOL_ADMIN, TEACHER, SUPER_ADMIN
**Logic**:
- Soft delete report card (set deletedAt)
- Return appropriate success/error messages

### 4. Parents Module (`src/app/api/parents/[id]/route.ts`)
**Roles allowed**: SCHOOL_ADMIN, TEACHER, SUPER_ADMIN
**Logic**:
- Soft delete parent record (set deletedAt)
- Soft delete associated user record
- Return appropriate success/error messages

### 5. Payments Module (`src/app/api/payments/[id]/route.ts`)
**Roles allowed**: SCHOOL_ADMIN, ACCOUNTANT, SUPER_ADMIN
**Logic**:
- Typically payments should NOT be deleted for audit purposes
- Instead, consider implementing a "void" or "refund" endpoint
- If deletion is absolutely necessary: soft delete with strict restrictions
- Require SUPER_ADMIN role only for payment deletion

### 6. Subjects Module (`src/app/api/subjects/[id]/route.ts`)
**Roles allowed**: SCHOOL_ADMIN, SUPER_ADMIN
**Logic**:
- Soft delete subject (set deletedAt)
- Prevent deletion if subject is assigned to classes/teachers
- Return appropriate success/error messages

### 7. Fee Structure Module (`src/app/api/fee-structure/[id]/route.ts`)
**Roles allowed**: SCHOOL_ADMIN, SUPER_ADMIN
**Logic**:
- Soft delete fee structure (set deletedAt)
- Prevent deletion if fee structure has associated payments
- Return appropriate success/error messages

### 8. Library Books Module (`src/app/api/library/books/[id]/route.ts`)
**Roles allowed**: SCHOOL_ADMIN, LIBRARIAN, SUPER_ADMIN
**Logic**:
- Soft delete book (set deletedAt)
- Prevent deletion if book has active borrow records
- Return appropriate success/error messages

## Standard DELETE Endpoint Pattern
Following the pattern from students/teachers endpoints:

```typescript
// DELETE /api/classes/[id] - Soft delete class
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const targetSchoolId = auth.role === 'SUPER_ADMIN' ? 
      (await getSchoolIdFromRequest(request)) || auth.schoolId : 
      auth.schoolId;

    const existing = await db.class.findUnique({ 
      where: { id },
      // Additional validation: ensure belongs to user's school
    });

    if (!existing) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    if (existing.deletedAt) {
      return NextResponse.json({ error: 'Class already deleted' }, { status: 410 });
    }

    // Business logic validations (e.g., check for dependencies)
    // const studentCount = await db.student.count({ where: { classId: id, deletedAt: null } });
    // if (studentCount > 0) {
    //   return NextResponse.json({ error: 'Cannot delete class with active students' }, { status: 400 });
    // }

    // Perform soft delete
    await db.class.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    return NextResponse.json({ message: 'Class deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

## Benefits
1. Complete CRUD functionality for all major entities
2. Consistent API design across the platform
3. Proper data lifecycle management
4. Maintains audit trails through soft deletes
5. Role-based security ensures only authorized users can delete data

## Estimated Effort
- Approximately 8-12 hours for implementing all missing DELETE endpoints
- Moderate risk due to introducing new endpoints
- Should include appropriate validation checks to prevent accidental data loss