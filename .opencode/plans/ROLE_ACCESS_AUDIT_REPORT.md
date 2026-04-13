# Skoolar Platform - Role-Based Access Control Audit Report

## Overview
This report documents the role-based access control (RBAC) implementation across the Skoolar platform API endpoints. The analysis covers authentication mechanisms, authorization patterns, and role-based restrictions implemented in the codebase.

## Authentication System
- **Provider**: NextAuth.js with CredentialsProvider
- **Token Structure**: JWT containing user ID, role, schoolId, schoolName, and avatar
- **Session Duration**: 90 days with refresh every 24 hours
- **Security Features**: 
  - Rate limiting for login attempts (5 attempts/minute)
  - Email verification requirement for SCHOOL_ADMIN
  - Password hashing with bcrypt
  - School context validation for non-SUPER_ADMIN users

## Authorization Middleware
- `requireAuth()`: Validates JWT and returns 401 if unauthenticated
- `requireRole()`: Checks user role against allowed roles and returns 403 if insufficient
- School context validation: Users can only access data from their own school (except SUPER_ADMIN)

## Role-Based Access Matrix

### STUDENTS Module
| Endpoint | Method | Required Roles | Notes |
|----------|--------|----------------|-------|
| `/api/students` | GET | All authenticated roles | School-scoped results |
| `/api/students` | POST | SCHOOL_ADMIN, TEACHER, SUPER_ADMIN | Creates student + User record |
| `/api/students/[id]` | GET | All authenticated roles | Individual student lookup |
| `/api/students/[id]` | PUT/PATCH | SCHOOL_ADMIN, TEACHER, SUPER_ADMIN | Update student |
| `/api/students/[id]` | DELETE | SCHOOL_ADMIN, SUPER_ADMIN | Soft delete student |

### TEACHERS Module
| Endpoint | Method | Required Roles | Notes |
|----------|--------|----------------|-------|
| `/api/teachers` | GET | All authenticated roles | School-scoped results |
| `/api/teachers` | POST | SCHOOL_ADMIN, SUPER_ADMIN | Creates teacher + User record |
| `/api/teachers/[id]` | GET | All authenticated roles | Individual teacher lookup |
| `/api/teachers/[id]` | PUT/PATCH | SCHOOL_ADMIN, SUPER_ADMIN | Update teacher |
| `/api/teachers/[id]` | DELETE | SCHOOL_ADMIN, SUPER_ADMIN | Soft delete teacher |

### CLASSES Module
| Endpoint | Method | Required Roles | Notes |
|----------|--------|----------------|-------|
| `/api/classes` | GET | All authenticated roles | School-scoped results |
| `/api/classes` | POST | SCHOOL_ADMIN, SUPER_ADMIN | Create class |
| `/api/classes/[id]` | GET | All authenticated roles | Individual class lookup |
| `/api/classes/[id]` | PUT/PATCH | SCHOOL_ADMIN, SUPER_ADMIN | Update class |
| `/api/classes/[id]` | DELETE | SCHOOL_ADMIN, SUPER_ADMIN | Delete class |

### EXAMS Module
| Endpoint | Method | Required Roles | Notes |
|----------|--------|----------------|-------|
| `/api/exams` | GET | All authenticated roles | School-scoped results |
| `/api/exams` | POST | SCHOOL_ADMIN, TEACHER, SUPER_ADMIN | Create exam |
| `/api/exams/[id]` | GET | All authenticated roles | Individual exam lookup |
| `/api/exams/[id]` | PUT/PATCH | SCHOOL_ADMIN, TEACHER, SUPER_ADMIN | Update exam |
| `/api/exams/[id]` | DELETE | SCHOOL_ADMIN, SUPER_ADMIN | Delete exam |

### ATTENDANCE Module
| Endpoint | Method | Required Roles | Notes |
|----------|--------|----------------|-------|
| `/api/attendance` | GET | All authenticated roles | School-scoped results |
| `/api/attendance` | POST | SCHOOL_ADMIN, TEACHER, SUPER_ADMIN | Bulk attendance marking |

### PARENTS Module
| Endpoint | Method | Required Roles | Notes |
|----------|--------|----------------|-------|
| `/api/parents` | GET | All authenticated roles | School-scoped results |
| `/api/parents` | POST | SCHOOL_ADMIN, TEACHER, SUPER_ADMIN | Create parent + User record |
| `/api/parent-students` | GET | All authenticated roles | Get parent-student relationships |

### REPORT CARDS Module
| Endpoint | Method | Required Roles | Notes |
|----------|--------|----------------|-------|
| `/api/report-cards` | GET | All authenticated roles | School-scoped results |
| `/api/report-cards` | POST | SCHOOL_ADMIN, TEACHER, SUPER_ADMIN | Generate report card |
| `/api/report-cards/[id]` | GET | All authenticated roles | Individual report card |
| `/api/report-cards/[id]` | PUT/PATCH | SCHOOL_ADMIN, TEACHER, SUPER_ADMIN | Update report card |
| `/api/report-cards/generate` | POST | SCHOOL_ADMIN, TEACHER, SUPER_ADMIN | Generate report card |

### PAYMENTS Module
| Endpoint | Method | Required Roles | Notes |
|----------|--------|----------------|-------|
| `/api/payments` | GET | SCHOOL_ADMIN, ACCOUNTANT, SUPER_ADMIN | List payments with filtering |
| `/api/payments` | POST | SCHOOL_ADMIN, ACCOUNTANT, SUPER_ADMIN | Record payment |
| `/api/payments/verify` | POST | SCHOOL_ADMIN, ACCOUNTANT, SUPER_ADMIN | Verify payment |
| `/api/payments/subscribe` | POST | All authenticated roles | Subscribe to payment plan |
| `/api/payments/manual` | POST | SCHOOL_ADMIN, ACCOUNTANT, SUPER_ADMIN | Manual payment entry |
| `/api/payments/credit` | POST | SCHOOL_ADMIN, ACCOUNTANT, SUPER_ADMIN | Credit payment |
| `/api/payments/webhook` | POST | (Public) | Payment gateway webhook |

### LIBRARY Module
| Endpoint | Method | Required Roles | Notes |
|----------|--------|----------------|-------|
| `/api/library/books` | GET | All authenticated roles | School-scoped book listing |
| `/api/library/books` | POST | SCHOOL_ADMIN, LIBRARIAN, SUPER_ADMIN | Add new book |
| `/api/library/borrow` | POST | STUDENT, TEACHER, SCHOOL_ADMIN, SUPER_ADMIN | Borrow/return books |

### ID CARDS Module
| Endpoint | Method | Required Roles | Notes |
|----------|--------|----------------|-------|
| `/api/id-cards` | GET | All authenticated roles | List available cards (student/staff) |
| `/api/id-cards/generate` | POST | All authenticated roles | Generate single ID card image |
| `/api/id-cards/export` | POST | Role-based: SUPER_ADMIN (any school), SCHOOL_ADMIN/TEACHER (own school only), TEACHER (student cards only) | Batch export ID cards |

### FEES Module
| Endpoint | Method | Required Roles | Notes |
|----------|--------|----------------|-------|
| `/api/fee-structure` | GET | All authenticated roles | List fee structures |
| `/api/fee-structure` | POST | SCHOOL_ADMIN, SUPER_ADMIN | Create fee structure |

### MESSAGING Module
| Endpoint | Method | Required Roles | Notes |
|----------|--------|----------------|-------|
| `/api/messaging` | GET | All authenticated roles | Conversations, messages, user search |
| `/api/messaging` | POST | All authenticated roles | Create conversation, send message, mark read |

## Security Observations

### Strengths
1. **Consistent School Context Validation**: Almost all endpoints validate school context, preventing cross-school data access
2. **Role-Based Middleware**: Centralized authorization logic reduces implementation errors
3. **Authentication Requirements**: All data-modifying endpoints require authentication
4. **SUPER_ADMIN Privileges**: Properly implemented cross-school access for SUPER_ADMIN
5. **Input Validation**: Most endpoints validate required fields and data integrity

### Areas for Improvement
1. **Inconsistent Role Checking**: Some endpoints use inline role checks instead of `requireRole()` middleware
2. **Missing DELETE Endpoints**: Several modules lack DELETE endpoints where soft deletes might be appropriate
3. **Limited Granularity**: Some roles have broader access than might be necessary (e.g., TEACHER can create students)
4. **Lack of Audit Logging**: No systematic logging of permission denials for security monitoring
5. **Role Hierarchy Not Explicit**: No clear role hierarchy documented in code

## Recommendations for Production Readiness

### Immediate Actions
1. **Standardize Authorization**: Replace inline role checks with `requireRole()` middleware consistently
2. **Add Missing ENDPOINTS**: Implement DELETE endpoints with proper role restrictions where appropriate
3. **Implement Audit Logging**: Log all authorization failures and sensitive operations
4. **Enhance Role Definitions**: Document and enforce least-privilege access for each role

### Medium-term Improvements
1. **Role Hierarchy Implementation**: Consider implementing explicit role inheritance (e.g., SCHOOL_ADMIN inherits TEACHER permissions)
2. **Resource-Level Permissions**: Implement more granular permissions beyond just roles (e.g., teacher can only modify their own classes)
3. **Regular Security Reviews**: Schedule periodic RBAC audits as the system evolves
4. **Permission Caching**: Consider caching permission checks for performance optimization

## Conclusion
The Skoolar platform implements a solid foundation for role-based access control with proper school context validation and consistent authentication. The role restrictions are generally well-implemented, though there are opportunities to standardize authorization patterns and enhance granularity. With the recommended improvements, the system would be well-suited for production deployment.

**Audit Completed**: April 13, 2026
**Auditor**: Opencode Assistant