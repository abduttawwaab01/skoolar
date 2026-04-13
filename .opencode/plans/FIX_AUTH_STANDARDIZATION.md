# Fix Plan: Standardize Authorization with requireRole() Middleware

## Problem
The codebase uses inconsistent inline role checking patterns like:
```typescript
if (!['SCHOOL_ADMIN', 'TEACHER', 'SUPER_ADMIN'].includes(auth.role || '')) {
  return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
}
```

This approach:
1. Creates code duplication
2. Increases risk of inconsistent error messages/status codes
3. Makes centralized authorization logic changes difficult
4. Violates DRY principles

## Solution
Replace all inline role checks with the existing `requireRole()` middleware from `src/lib/auth-middleware.ts`.

## Implementation Steps

### 1. Update Import Statements
Add `requireRole` to imports in files that currently use `requireAuth`:
```typescript
// Change from:
import { requireAuth } from '@/lib/auth-middleware';
// To:
import { requireAuth, requireRole } from '@/lib/auth-middleware';
```

### 2. Replace Inline Checks with requireRole()
Transform patterns like:
```typescript
const auth = await requireAuth(request);
if (auth instanceof NextResponse) return auth;

// Only SCHOOL_ADMIN, TEACHER, and SUPER_ADMIN can create students
if (!['SCHOOL_ADMIN', 'TEACHER', 'SUPER_ADMIN'].includes(auth.role || '')) {
  return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
}
```

To:
```typescript
const auth = await requireRole(request, ['SCHOOL_ADMIN', 'TEACHER', 'SUPER_ADMIN']);
if (auth instanceof NextResponse) return auth;
```

### 3. Handle Special Cases
Some endpoints may need custom logic after authorization - these should still call requireRole() first:
```typescript
// Example: POST /api/students
export async function POST(request: NextRequest) {
  try {
    // Authorize first
    const auth = await requireRole(request, ['SCHOOL_ADMIN', 'TEACHER', 'SUPER_ADMIN']);
    if (auth instanceof NextResponse) return auth;
    
    // Then proceed with business logic
    const body = await request.json();
    // ... rest of the function
  }
  // ... error handling
}
```

### 4. Files to Modify
Based on grep results, these files contain inline role checks that need standardization:

1. `src/app/api/students/route.ts` (line 131)
2. `src/app/api/teachers/route.ts` (line 122) 
3. `src/app/api/classes/route.ts` (line 102)
4. `src/app/api/exams/route.ts` (line 112)
5. `src/app/api/report-cards/route.ts` (line 99)
6. `src/app/api/parents/route.ts` (line 88)
7. `src/app/api/payments/route.ts` (line 119)
8. `src/app/api/subjects/route.ts` (line 87)
9. `src/app/api/entrance-exams/[id]/route.ts` (lines 47, 88)
10. `src/app/api/entrance-exams/[id]/questions/route.ts` (line 10)
11. `src/app/api/entrance-exams/route.ts` (line 71)
12. `src/app/api/attendance/route.ts` (line 97)

### 5. Benefits
- Consistent error handling (always 403 with "Insufficient permissions")
- Reduced code duplication
- Easier maintenance (change authorization logic in one place)
- Better adherence to existing code patterns
- Leverages existing, tested middleware

### 6. Testing Considerations
- Verify all existing functionality remains unchanged
- Test that unauthorized users still receive 403 responses
- Test that authorized users can still access endpoints
- Ensure school context validation still works after authorization

### 7. Estimated Effort
- Approximately 2-4 hours for a developer familiar with the codebase
- Low risk since we're replacing equivalent functionality
- No changes to business logic, only authorization mechanism