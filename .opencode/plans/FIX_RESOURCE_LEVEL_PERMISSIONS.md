# Fix Plan: Implement Resource-Level Permissions

## Problem
The current role-based access control (RBAC) in Skoolar grants permissions based solely on user roles, without considering the specific resources (data instances) a user should be able to access. This leads to over-privileged access where users can potentially access or modify data they shouldn't be able to based on their relationship to that data.

### Examples of Missing Resource-Level Controls:
1. **Teachers** can potentially access/update ANY student's records in the school, not just students in their classes
2. **Teachers** can potentially access/update ANY class's information, not just classes they teach
3. **Students** should only access their own records (this appears to be implemented correctly)
4. **Parents** should only access their children's records (this appears to be implemented correctly)
5. **Staff** might access financial/payment data unrelated to their responsibilities

## Solution Approach
Implement resource-level permissions (also called instance-based or object-level security) where access decisions depend not only on the user's role but also on their relationship to the specific resource being accessed.

### Core Concepts:
- **Resource Owner**: The user or entity that "owns" or is primarily responsible for a resource
- **Resource Custodian**: Users who have responsibility for managing a resource (e.g., teacher for their class)
- **Access Relationships**: Define how users relate to resources (teaches, enrolled in, guardian of, etc.)

## Implementation Strategy

### 1. Identify Resources Needing Protection
From the code review, these resources need resource-level protection:

| Resource | Current Protection | Needed Resource-Level Protection |
|----------|-------------------|----------------------------------|
| Students | School context only | Teachers can only access students in their classes; Parents can only access their children |
| Classes | School context only | Teachers can only access classes they teach; Students can only access their enrolled class |
| Exams | School context only | Teachers can only access exams they created/for their classes |
| Report Cards | School context only | Teachers can only access report cards for their students; Students/Parents only their own |
| Attendance | School context only | Teachers can only mark attendance for their classes |
| Grades/Scores | School context only | Teachers can only enter grades for their students/classes |
| Library Records | School context only | Librarians can manage all; Students see only their borrowings |
| Payments | Role-based (FINANCE roles) | Accountants see all; Staff see only relevant department payments? |

### 2. Implementation Patterns

#### Pattern 1: Owner-Based Access
Resources have an explicit owner field (userId or similar) and users can only access resources they own.
- Applies to: User profiles, personal settings, personal documents
- Check: `resource.ownerId === user.userId`

#### Pattern 2: Relationship-Based Access
Access granted based on relationship records in the database.
- Applies to: 
  - Teacher-Student (via class enrollment)
  - Teacher-Class (via teaching assignments)
  - Parent-Student (via parentProfile -> studentProfile links)
  - Student-Class (via enrollment)
  - Student-Exams (via exam scores)
- Check: Existence of relationship record linking user to resource

#### Pattern 3: Custodian-Based Access
Certain roles have custodial responsibility for resources.
- Applies to:
  - Teachers as custodians of class resources
  - Librarians as custodians of library resources
  - Accountants as custodians of financial resources
- Check: User role + school context + possibly department/class association

### 3. Specific Implementation Approaches

#### A. Teacher Access to Students
Current: Teachers can access any student in the school via `/api/students` and `/api/students/[id]`
Required: Teachers should only access students enrolled in their classes

Implementation:
1. Modify GET `/api/students` to filter by classes taught by teacher
2. Modify GET `/api/students/[id]` to verify student is in teacher's class(es)
3. Similar filtering for POST/PUT/DELETE if those permissions are kept for teachers

```typescript
// In students GET list endpoint
// Instead of just school context, add:
const teacherClasses = await db.classSubject.findMany({
  where: { teacherId: auth.userId }, // Assuming we link teacher to user
  select: { classId: true }
});
const classIds = teacherClasses.map(cs => cs.classId);
where.classId = { in: classIds };

// In students GET single endpoint
const student = await db.student.findUnique({ where: { id } });
// Then check:
const isTeachingThisStudent = await db.classSubject.findFirst({
  where: { 
    teacherId: auth.userId,
    classId: student.classId
  }
});
if (!isTeachingThisStudent && !isStaffRole) { /* deny access */ }
```

#### B. Teacher Access to Classes
Current: Teachers can access any class in the school
Required: Teachers should only access classes they teach

Implementation:
1. Similar to above - filter class list by teaching assignments
2. Verify teacher teaches class before allowing access to class details

#### C. Parent Access to Children
Current: Appears to be implemented correctly (check parent-student relationships)
Verification needed: Ensure parents can only access their own children's records

#### D. Student Self-Service
Current: Appears implemented correctly - students access own records via auth context
Verification needed: Ensure students can't access other students' records even if they guess IDs

#### E. Exam Access Controls
Current: Teachers can create exams for any class
Required: Teachers should only create exams for classes they teach
Additionally: Teachers should only view/update/delete exams they created or for their classes

### 4. Technical Implementation Approaches

#### Approach 1: Service Layer Functions
Create authorization service functions that encapsulate resource-level checks:

```typescript
// src/lib/resource-auth.ts
export async function canAccessStudent(
  userId: string, 
  role: string, 
  schoolId: string, 
  studentId: string
): Promise<boolean> {
  // Admins can access any student in their school
  if (['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(role)) {
    const student = await db.student.findUnique({ where: { id: studentId } });
    return student?.schoolId === schoolId;
  }
  
  // Teachers can access students in their classes
  if (role === 'TEACHER') {
    const student = await db.student.findUnique({ where: { id: studentId } });
    if (!student || student.schoolId !== schoolId) return false;
    
    const teachesClass = await db.classSubject.findFirst({
      where: { 
        teacherId: userId, 
        classId: student.classId 
      }
    });
    return !!teachesClass;
  }
  
  // Parents can access their children
  if (role === 'PARENT') {
    const student = await db.student.findUnique({ 
      where: { id: studentId },
      include: { user: true }
    });
    if (!student || student.schoolId !== schoolId) return false;
    
    const parentLink = await db.parent.findFirst({
      where: { 
        userId, 
        studentId: student.id 
      }
    });
    return !!parentLink;
  }
  
  // Students can access own record
  if (role === 'STUDENT') {
    const student = await db.student.findUnique({ 
      where: { id: studentId },
      include: { user: true }
    });
    return student?.userId === userId;
  }
  
  return false;
}
```

Then use in endpoints:
```typescript
const canAccess = await canAccessStudent(
  auth.userId, 
  auth.role, 
  auth.schoolId, 
  studentId
);
if (!canAccess) {
  return NextResponse.json({ error: 'Access denied' }, { status: 403 });
}
```

#### Approach 2: Query-Level Filtering
Modify database queries to include relationship constraints directly in the WHERE clause.

More efficient but requires more complex query building.

#### Approach 3: Middleware Enhancement
Enhance the authorization middleware to optionally perform resource-level checks.

### 5. Files to Modify

1. **Create new service**: `src/lib/resource-auth.ts` - Resource-level authorization functions
2. **Modify student endpoints**: `src/app/api/students/route.ts` and `[id]/route.ts`
3. **Modify teacher endpoints**: `src/app/api/teachers/route.ts` and `[id]/route.ts`
4. **Modify class endpoints**: `src/app/api/classes/route.ts`
5. **Modify exam endpoints**: `src/app/api/exams/route.ts`
6. **Modify report card endpoints**: `src/app/api/report-cards/route.ts`
7. **Modify attendance endpoints**: `src/app/api/attendance/route.ts`
8. **Modify library endpoints**: `src/app/api/library/books/route.ts`
9. **Update auth middleware**: Potentially enhance `requireRole()` to accept resource parameters

### 6. Benefits
- Principle of least privilege: Users access only what they need
- Improved security: Reduces impact of compromised accounts
- Better compliance: Aligns with educational data protection regulations
- Reduced accidents: Less likely to accidentally modify wrong data
- Clear audit trails: Access is more meaningful and traceable

### 7. Risks and Challenges
- **Performance**: Additional database joins/queries for authorization
  - Mitigation: Proper indexing, caching frequent checks
- **Complexity**: More complex authorization logic
  - Mitigation: Centralize in service functions, good documentation
- **Backward Compatibility**: Might break existing workflows if permissions were too broad
  - Mitigation: Implement gradually, monitor access patterns, communicate changes
- **Consistency**: Ensuring all access points implement checks correctly
  - Mitigation: Centralize logic, create reusable functions, add tests

### 8. Implementation Priority
Start with highest risk/resources:
1. Teacher access to student records (high impact, clear relationships)
2. Teacher access to class records
3. Parent/student self-access verification
4. Exam access controls
5. Attendance controls
6. Library/resource controls

### 9. Estimated Effort
- Resource auth service: 3-4 hours
- Student endpoints: 2-3 hours
- Teacher endpoints: 2-3 hours  
- Class endpoints: 1-2 hours
- Exam endpoints: 2-3 hours
- Report card endpoints: 1-2 hours
- Attendance endpoints: 1-2 hours
- Library endpoints: 1-2 hours
- Testing and validation: 3-4 hours
- Total: 16-22 hours
- Risk: Medium-High (significant logic changes, but high security value)

### 10. Success Criteria
- Teachers can only access students in their classes
- Teachers can only access classes they teach
- Parents can only access their children's records
- Students can only access their own records
- Existing legitimate workflows continue to function
- Unauthorized access attempts are properly blocked and logged