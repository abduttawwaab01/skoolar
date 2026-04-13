# Fix Plan: Implement Audit Logging for Authorization Failures

## Problem
The Skoolar platform has an audit logging system in place, but authorization failures (403 responses) are not being logged to the audit system. This creates a security monitoring gap where unauthorized access attempts are not tracked.

Currently:
- Authentication failures (401) might be logged elsewhere
- Authorization failures (403) from inline role checks or `requireRole()` are not captured in the audit system
- No systematic logging of permission denials for security monitoring and forensics

## Solution
Enhance the authorization middleware and error handling to log all authorization failures to the audit log system. Additionally, log sensitive operations (data modification, deletion, etc.) for comprehensive security monitoring.

## Implementation Approach

### 1. Enhance Authorization Middleware
Modify `requireRole()` in `src/lib/auth-middleware.ts` to log authorization failures:

```typescript
import { createAuditLogEntry } from './audit-logger'; // New utility function

export async function requireRole(request: NextRequest, roles: string | string[]): Promise<AuthResult & { authenticated: true } | NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  if (!authResult.role || !allowedRoles.includes(authResult.role)) {
    // Log authorization failure
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
        method: request.method
      }),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || ''
    });
    
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  return authResult;
}
```

### 2. Create Audit Logger Utility
Create a new utility function `src/lib/audit-logger.ts`:

```typescript
import { db } from './db';

export async function createAuditLogEntry(data: {
  schoolId: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  try {
    await db.auditLog.create({
      data: {
        schoolId: data.schoolId,
        userId: data.userId,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        details: data.details,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      }
    });
  } catch (error) {
    // Don't let audit logging failures break the main request
    console.error('Failed to create audit log entry:', error);
  }
}
```

### 3. Log Sensitive Operations
Enhanced audit logging for key operations:

#### A. Data Modification Endpoints (POST, PUT, PATCH, DELETE)
Add audit logging to all mutating operations:

```typescript
// Example in students route POST
export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole(request, ['SCHOOL_ADMIN', 'TEACHER', 'SUPER_ADMIN']);
    if (auth instanceof NextResponse) return auth;
    
    // ... existing logic ...
    
    // After successful creation
    await createAuditLogEntry({
      schoolId: auth.schoolId || '',
      userId: auth.userId,
      action: 'STUDENT_CREATE',
      entity: 'STUDENT',
      entityId: result.student.id,
      details: JSON.stringify({
        admissionNo: result.student.admissionNo,
        userId: result.user.id
      }),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || ''
    });
    
    return NextResponse.json(
      { data: { ...result.student, user: result.user }, message: 'Student created successfully' },
      { status: 201 }
    );
  } catch (error: unknown) {
    // ... existing error handling ...
  }
}
```

#### B. Bulk/Sensitive Operations
Special attention to operations like:
- Bulk attendance marking
- Report card generation
- Payment processing
- User role changes
- Data exports

### 4. Files to Modify

#### Core Changes:
1. `src/lib/auth-middleware.ts` - Enhance `requireRole()` to log failures
2. Create `src/lib/audit-logger.ts` - New utility function

#### Endpoint Enhancements (examples):
1. `src/app/api/students/route.ts` - Add audit logging to POST/PUT/DELETE
2. `src/app/api/teachers/route.ts` - Add audit logging to POST/PUT/DELETE
3. `src/app/api/classes/route.ts` - Add audit logging to POST (and future DELETE)
4. `src/app/api/exams/route.ts` - Add audit logging to POST (and future DELETE)
5. `src/app/api/report-cards/route.ts` - Add audit logging to POST (and future DELETE)
6. `src/app/api/parents/route.ts` - Add audit logging to POST (and future DELETE)
7. `src/app/api/payments/route.ts` - Add audit logging to POST
8. `src/app/api/subjects/route.ts` - Add audit logging to POST (and future DELETE)
9. `src/app/api/library/books/route.ts` - Add audit logging to POST (and future DELETE)

### 5. Audit Log Entry Design
Standardized fields for authorization failure logs:
- `action`: 'AUTHORIZATION_FAILURE'
- `entity`: 'API_ENDPOINT' or specific entity type
- `details`: JSON containing:
  - requiredRoles: Array<string>
  - userRole: string | null
  - endpoint: string (request path)
  - method: string (HTTP method)
  - timestamp: ISO string (automatically added by createdAt)
  - schoolId: string
  - userId: string | null

For successful operations:
- `action`: '{ENTITY}_{OPERATION}' (e.g., 'STUDENT_CREATE', 'EXAM_UPDATE')
- `entity`: Entity name (STUDENT, TEACHER, EXAM, etc.)
- `entityId`: ID of the affected record
- `details`: Relevant contextual information

### 6. Benefits
- Security monitoring: Track unauthorized access attempts
- Forensics: Investigate security incidents
- Compliance: Meet audit trail requirements
- Operational visibility: Track legitimate administrative actions
- Early warning: Detect probing or brute-force attempts

### 7. Performance Considerations
- Audit logging is fire-and-forget (doesn't block response)
- Error handling prevents logging failures from affecting main operations
- Database writes are asynchronous
- Consider indexing strategy on auditLogs table (already has good indexes)

### 8. Testing Strategy
- Verify authorization failures create audit log entries
- Verify successful operations create appropriate audit logs
- Ensure logging doesn't break existing functionality
- Test edge cases (missing schoolId, userId, etc.)
- Verify performance impact is negligible

### 9. Estimated Effort
- Core middleware enhancement: 1-2 hours
- Audit logger utility: 30 minutes
- Endpoint enhancements: 4-6 hours (9 endpoints × 30-45 minutes each)
- Total: 6-9 hours
- Risk: Low (additive changes, error handling prevents breakage)

## Advanced Enhancements (Future Considerations)
1. Real-time alerts for repeated authorization failures from same IP
2. Integration with SIEM systems
3. Audit log retention policies
4. Digital signatures for audit log integrity
5. Export capabilities for compliance reporting