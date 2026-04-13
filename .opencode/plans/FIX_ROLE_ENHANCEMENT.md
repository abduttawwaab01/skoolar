# Fix Plan: Enhance Role Definitions with Least-Privilege Access

## Problem Analysis
The current role-based access control in Skoolar grants broad permissions that may exceed what's necessary for certain roles, violating the principle of least privilege. Key observations:

### Current Role Permissions (Overly Permissive Examples):
1. **TEACHER role** can:
   - Create students (POST /api/students) - Should this be limited?
   - Create parents (POST /api/parents) - Questionable need
   - Generate report cards (POST /api/report-cards) - May be appropriate
   - But cannot: Create fee structures, payment records (appropriately restricted)

2. **STUDENT role** has very limited access (appropriately restrictive)

3. **PARENT role** has very limited access (appropriately restrictive)

4. **ACCOUNTANT role** can only access payment/finance related endpoints (appropriately restrictive)

5. **LIBRARIAN role** can manage books and borrow records (appropriately restrictive)

### Specific Concerns:
- TEACHER creating students: Teachers typically shouldn't be able to create new student records in the system
- TEACHER creating parents: Similar concern - administrative function
- DIRECTOR role permissions unclear from code review (need to check)
- Some roles may have access to endpoints they don't actually need for their core functions

## Solution Approach
Implement least-privilege access by reviewing and tightening role permissions based on actual job responsibilities:

### 1. Role Responsibility Analysis
Define clear responsibilities for each role:

**SUPER_ADMIN**: Platform-wide administration, cross-school management
**SCHOOL_ADMIN**: Complete school management (academic, financial, administrative)
**TEACHER**: Classroom instruction, student assessment, class management
**STUDENT**: Access to own academic information, submit work, view resources
**PARENT**: Access to children's information, communicate with school, pay fees
**ACCOUNTANT**: Financial transactions, fee management, reporting
**LIBRARIAN**: Library resource management, circulation, catalog
**DIRECTOR**: Executive oversight, academic leadership, institutional management

### 2. Permission Tightening Recommendations

#### TEACHER Role - Restrict:
- REMOVE: Ability to create students (POST /api/students)
- REMOVE: Ability to create parents (POST /api/parents)
- KEEP: Ability to create exams (appropriate for assessment)
- KEEP: Ability to update student records they teach (with resource-level permissions)
- KEEP: Ability to generate report cards for their students
- ADD: Resource-level restrictions (teachers can only modify their own classes/students)

#### DIRECTOR Role - Define Clearly:
Based on navigation data, Director should have:
- Overview dashboard
- Analytics
- Student/Teacher overview
- Entrance exams
- Weekly evaluations
- Finance overview
- Staff attendance
- Academic performance
- Reports
- Feedback
- Calendar
- Notice board

Permissions should align with these functions - likely similar to SCHOOL_ADMIN but potentially without direct user creation/modification capabilities.

#### STUDENT/PARENT Roles - Verify Current Restrictions Are Appropriate:
These appear correctly restrictive but should be validated.

### 3. Implementation Strategy

#### Phase 1: Role Definition Documentation
Create a formal role-permission matrix document that clearly defines what each role should be able to do.

#### Phase 2: API Endpoint Review
For each endpoint, explicitly define which roles should have access based on job responsibilities.

#### Phase 3: Incremental Permission Adjustment
Start with the most obviously excessive permissions (TEACHER creating students/parents) and adjust gradually.

#### Phase 4: Resource-Level Implementation (see separate plan)
Implement resource-level permissions to further restrict what teachers can modify (only their own classes/students).

### 4. Specific Changes to Make

#### A. Modify TEACHER Permissions in Key Endpoints:

1. **Students Endpoint** (`src/app/api/students/route.ts`):
   ```diff
   - if (!['SCHOOL_ADMIN', 'TEACHER', 'SUPER_ADMIN'].includes(auth.role || '')) {
   + if (!['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(auth.role || '')) {
   ```

2. **Parents Endpoint** (`src/app/api/parents/route.ts`):
   ```diff
   - if (!['SCHOOL_ADMIN', 'TEACHER', 'SUPER_ADMIN'].includes(auth.role || '')) {
   + if (!['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(auth.role || '')) {
   ```

3. **Review other TEACHER permissions** to ensure they align with teaching responsibilities.

#### B. Define DIRECTOR Permissions Explicitly
Check if DIRECTOR role is properly implemented in all endpoints where it should have access.

#### C. Create Role Documentation
Create `ROLE_PERMISSIONS_MATRIX.md` that documents:
- Each role's responsibilities
- Which endpoints they can access
- Any resource-level restrictions
- Justification for each permission level

### 5. Benefits of Least-Privilege Approach
- Reduced attack surface: Compromised accounts have limited access
- Better compliance: Aligns with regulatory requirements (FERPA, GDPR, etc.)
- Clearer accountability: Actions can be traced to appropriate roles
- Reduced accidents: Users less likely to perform unintended actions
- Easier auditing: Permission boundaries are clear and justifiable

### 6. Risk Mitigation
- Backward compatibility: Some existing workflows might break
- Solution: Implement changes gradually with feature flags or communication
- Testing: Thoroughly test role-based access after changes
- Monitoring: Watch for legitimate access attempts that are now blocked

### 7. Estimated Effort
- Role analysis and documentation: 2-3 hours
- Permission adjustments: 2-4 hours (depending on number of changes)
- Testing and validation: 2-3 hours
- Total: 6-10 hours
- Risk: Medium (changes actual access permissions)

### 8. Success Criteria
- Teachers can no longer create student/parent records
- Each role has clearly defined, justified permissions
- No legitimate business functions are broken by the changes
- Documentation matches implementation