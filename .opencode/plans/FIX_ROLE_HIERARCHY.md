# Fix Plan: Implement Role Hierarchy (Role Inheritance)

## Problem
The current role system in Skoolar uses flat roles where each role has explicitly defined permissions. There's no mechanism for role inheritance, leading to:
1. Permission duplication: Same permissions assigned to multiple roles
2. Inconsistency risk: When a permission needs to be updated, it must be changed in multiple places
3. Maintenance overhead: Adding new permissions requires updating multiple role definitions
4. Logical gaps: Obvious relationships (like SCHOOL_ADMIN should inherit TEACHER capabilities) aren't enforced

## Solution Approach
Implement a role hierarchy system where higher-level roles inherit permissions from lower-level roles, reducing duplication while maintaining clear authority levels.

### Proposed Hierarchy
```
SUPER_ADMIN
    └── SCHOOL_ADMIN
        ├── TEACHER
        │    └── (Potential: SUB_TEACHER, TEACHER_ASSISTANT)
        ├── DIRECTOR
        │    └── (Academic leadership track)
        ├── ACCOUNTANT
        │    └── (Finance specialization)
        ├── LIBRARIAN
        │    └── (Library specialization)
        └── PARENT
             └── (Guardian specialization)
STUDENT
```

Note: STUDENT is separate as it represents a fundamentally different entity type (non-staff).

## Implementation Options

### Option 1: Explicit Role Inheritance in Authorization Logic
Modify the `requireRole()` function to check not just for exact role matches, but also for inherited roles.

#### Changes to `src/lib/auth-middleware.ts`:
```typescript
// Define role hierarchy
const ROLE_HIERARCHY: Record<string, string[]> = {
  'SUPER_ADMIN': ['SCHOOL_ADMIN', 'TEACHER', 'DIRECTOR', 'ACCOUNTANT', 'LIBRARIAN', 'PARENT'],
  'SCHOOL_ADMIN': ['TEACHER', 'DIRECTOR', 'ACCOUNTANT', 'LIBRARIAN', 'PARENT'],
  'TEACHER': [], // Leaf node in teaching track
  'DIRECTOR': [], // Leaf node in leadership track  
  'ACCOUNTANT': [],
  'LIBRARIAN': [],
  'PARENT': [],
  'STUDENT': []
};

// Helper function to check if user has required role (including inherited)
function hasRequiredRole(userRole: string | undefined, requiredRoles: string[]): boolean {
  if (!userRole) return false;
  
  // Direct match
  if (requiredRoles.includes(userRole)) return true;
  
  // Check inherited roles
  const inheritedRoles = ROLE_HIERARCHY[userRole] || [];
  return requiredRoles.some(role => inheritedRoles.includes(role));
}

// Updated requireRole function
export async function requireRole(request: NextRequest, roles: string | string[]): Promise<AuthResult & { authenticated: true } | NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  if (!hasRequiredRole(authResult.role, allowedRoles)) {
    // Log authorization failure (as per audit logging plan)
    await createAuditLogEntry({
      schoolId: authResult.schoolId || '',
      userId: authResult.userId,
      action: 'AUTHORIZATION_FAILURE',
      entity: 'API_ENDPOINT',
      entityId: '',
      details: JSON.stringify({
        requiredRoles: allowedRoles,
        userRole: authResult.role,
        endpoint: request.nextUrl.pathname,
        method: request.method,
        inheritanceChecked: true
      }),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || ''
    });
    
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  return authResult;
}
```

### Option 2: Role Groups with Explicit Assignment
Maintain flat roles but introduce role groups for organizational purposes, keeping authorization checks explicit but easier to manage.

#### Changes:
1. Add role group definitions
2. Update documentation to show logical groupings
3. Keep requireRole() as-is but improve role assignment consistency

### Option 3: Hybrid Approach (Recommended)
Combine explicit inheritance for clear hierarchical relationships with flat roles for specialized functions.

#### Recommended Hierarchy:
```
SUPER_ADMIN (inherits all)
    └── SCHOOL_ADMIN (inherits STAFF_BASE)
        ├── TEACHER_BASE (inherits STAFF_BASE) 
        │     ├── TEACHER
        │     └── SUBJECT_TEACHER (specialized)
        ├── DIRECTOR_BASE (inherits STAFF_BASE)
        │     └── DIRECTOR
        ├── ACCOUNTANT_BASE (inherits STAFF_BASE)
        │     └── ACCOUNTANT
        └── LIBRARIAN_BASE (inherits STAFF_BASE)
              └── LIBRARIAN
STAFF_BASE (common staff permissions)
    └── All staff roles inherit basic staff capabilities
STUDENT (separate entity type)
PARENT (separate entity type)
```

#### Implementation:
Modify role checking to understand this hierarchy while keeping database roles flat.

## Detailed Implementation Plan (Option 1 - Recommended)

### 1. Update Authorization Middleware
File: `src/lib/auth-middleware.ts`

Add role hierarchy definition and modify `requireRole()` to check inherited roles.

### 2. Update Role Definitions
Ensure database role values remain flat strings for simplicity, but authorization logic understands hierarchy.

### 3. Update Documentation
Update `src/store/app-store.ts` UserRole type comments to reflect hierarchy.
Update any role documentation.

### 4. Permission Mapping Review
Review all endpoints to ensure they align with the intended hierarchy:
- SUPER_ADMIN: All endpoints
- SCHOOL_ADMIN: All school-level endpoints (inherits from staff)
- TEACHER: Teaching-related endpoints
- DIRECTOR: Leadership/overview endpoints
- etc.

### 5. Benefits
- Eliminates permission duplication
- Automatic inheritance: When a permission is granted to a base role, all inheritors get it
- Clear authority levels: Easy to understand who can do what
- Reduced maintenance: Change permissions in one place
- Logical consistency: Matches organizational structure

### 6. Risks and Mitigations
**Risk**: Performance impact from hierarchy checking
**Mitigation**: Hierarchy is small and shallow; impact negligible. Can cache results if needed.

**Risk**: Incorrect inheritance assignments
**Mitigation**: Thoroughly test role permissions after implementation

**Risk**: Backward compatibility if role semantics change
**Mitigation**: Implement as additive change - existing role checks still work, just gain inheritance capability

### 7. Files to Modify
1. `src/lib/auth-middleware.ts` - Core hierarchy logic
2. `src/lib/audit-logger.ts` - Update to log inheritance checks (optional)
3. Documentation files - Update role descriptions

### 8. Testing Strategy
- Test that users can access endpoints according to their inherited roles
- Test that authorization failures are properly logged
- Test edge cases (null roles, undefined roles)
- Verify performance impact is minimal
- Test that explicit denials still work (if a role should NOT inherit despite hierarchy)

### 9. Estimated Effort
- Middleware modification: 2-3 hours
- Testing and validation: 2-3 hours
- Documentation updates: 1 hour
- Total: 5-7 hours
- Risk: Low to Medium (additive logic with proper testing)

## Alternative: Role Groups Approach
If inheritance proves complex, implement role groups:

1. Define role groups: STAFF, ACADEMIC, FINANCE, etc.
2. Update documentation to show which roles belong to which groups
3. Keep authorization explicit but use groups for organizational clarity
4. Less automatic inheritance but better role organization

## Recommendation
Go with Option 1 (explicit inheritance in authorization logic) as it provides the strongest benefits for reducing duplication and maintaining consistency while being reasonably straightforward to implement.

The key is to start with a simple, well-defined hierarchy and avoid over-engineering. Begin with SUPER_ADMIN inheriting everything, then SCHOOL_ADMIN inheriting staff roles, and evaluate whether deeper inheritance is needed.