import { z, ZodError } from 'zod';

// ===== HOMEWORK VALIDATORS =====
export const HomeworkCreateSchema = z.object({
  schoolId: z.string().cuid().min(1, 'School ID required'),
  title: z.string().min(3, 'Title must be at least 3 characters').max(255, 'Title too long'),
  description: z.string().max(5000, 'Description too long').optional(),
  subjectId: z.string().cuid().optional().nullable(),
  classId: z.string().cuid().optional().nullable(),
  teacherId: z.string().cuid().optional().nullable(),
  dueDate: z.coerce.date().min(new Date(), 'Due date must be in the future'),
  totalMarks: z.number().int().min(1).max(1000, 'Total marks must be between 1-1000'),
  attachments: z.array(z.string().url()).optional(),
  contentType: z.enum(['text', 'audio', 'video', 'mixed']).optional(),
  audioUrl: z.string().url().optional().nullable(),
  videoUrl: z.string().url().optional().nullable(),
  questions: z.array(z.object({
    type: z.enum(['MCQ', 'ESSAY', 'SHORT_ANSWER']),
    questionText: z.string().min(5, 'Question must be at least 5 characters'),
    options: z.string().optional(),
    correctAnswer: z.string().optional(),
    marks: z.number().int().min(1).max(100),
    order: z.number().int().optional(),
  })).optional(),
});

export const HomeworkSubmissionSchema = z.object({
  homeworkId: z.string().cuid(),
  studentId: z.string().cuid(),
  content: z.string().max(10000, 'Content too long').optional(),
  attachments: z.array(z.string().url()).max(5, 'Maximum 5 files allowed').optional(),
  audioUrl: z.string().url().optional().nullable(),
  answers: z.record(z.string(), z.any()).optional(),
});

export const HomeworkGradeSchema = z.object({
  submissionId: z.string().cuid(),
  score: z.number().min(0, 'Score cannot be negative').max(10000, 'Score exceeds max'),
  grade: z.string().max(10, 'Grade too long').optional(),
  teacherComment: z.string().max(5000, 'Comment too long').optional(),
  status: z.enum(['submitted', 'graded', 'reviewing']).optional(),
});

export const HomeworkUpdateSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  description: z.string().max(5000).optional(),
  dueDate: z.coerce.date().optional(),
  totalMarks: z.number().int().min(1).max(1000).optional(),
  status: z.enum(['active', 'closed', 'archived']).optional(),
  subjectId: z.string().cuid().optional().nullable(),
  classId: z.string().cuid().optional().nullable(),
});

// ===== EXAM VALIDATORS =====
export const ExamCreateSchema = z.object({
  schoolId: z.string().cuid(),
  termId: z.string().cuid(),
  subjectId: z.string().cuid(),
  classId: z.string().cuid(),
  teacherId: z.string().cuid().optional(),
  name: z.string().min(3).max(255),
  type: z.enum(['assessment', 'quiz', 'midterm', 'final']).optional(),
  totalMarks: z.number().int().min(1).max(10000),
  passingMarks: z.number().int().min(0).max(10000),
  date: z.coerce.date().optional(),
  duration: z.number().int().min(5, 'Duration must be at least 5 minutes').max(480, 'Duration cannot exceed 8 hours').optional(),
  instructions: z.string().max(5000).optional(),
});

export const ExamSecuritySettingsSchema = z.object({
  blockCopyPaste: z.boolean().optional(),
  monitorTabSwitch: z.boolean().optional(),
  maxTabSwitches: z.number().int().min(0).optional(),
  monitorWebcam: z.boolean().optional(),
  randomizeQuestions: z.boolean().optional(),
  randomizeOptions: z.boolean().optional(),
  fullscreenMode: z.boolean().optional(),
  blockRightClick: z.boolean().optional(),
  blockKeyboardShortcuts: z.boolean().optional(),
  showResultAfterSubmit: z.boolean().optional(),
});

export const ExamQuestionSchema = z.object({
  examId: z.string().cuid(),
  type: z.enum(['MCQ', 'MULTI_SELECT', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER', 'ESSAY', 'MATCHING']),
  questionText: z.string().min(5).max(5000),
  options: z.string().optional().nullable(),
  correctAnswer: z.string().optional().nullable(),
  marks: z.number().int().min(1).max(1000),
  explanation: z.string().max(5000).optional(),
  mediaUrl: z.string().url().optional(),
  order: z.number().int().optional(),
});

export const ExamAttemptSubmitSchema = z.object({
  examId: z.string().cuid(),
  studentId: z.string().cuid(),
  answers: z.record(z.string(), z.any()),
});

// ===== PAYMENT & FINANCE VALIDATORS =====
export const FeeStructureCreateSchema = z.object({
  schoolId: z.string().cuid(),
  name: z.string().min(3).max(255),
  amount: z.number().positive('Amount must be greater than 0').max(999999),
  frequency: z.enum(['monthly', 'termly', 'annual']).optional(),
  classIds: z.array(z.string().cuid()).optional(),
  isOptional: z.boolean().optional(),
  isLatePayment: z.boolean().optional(),
  lateFeeAmount: z.number().nonnegative().optional(),
  lateFeeAfter: z.number().int().min(1).optional(),
  academicYear: z.string().optional(),
  dueDate: z.coerce.date().optional(),
});

export const PaymentCreateSchema = z.object({
  schoolId: z.string().cuid(),
  studentId: z.string().cuid(),
  amount: z.number().positive('Amount must be greater than 0').max(999999),
  method: z.enum(['cash', 'card', 'bank_transfer', 'online']).optional(),
  reference: z.string().max(255).optional(),
  feeStructureId: z.string().cuid().optional(),
  termId: z.string().cuid().optional(),
});

// ===== ATTENDANCE VALIDATORS =====
export const AttendanceCreateSchema = z.object({
  schoolId: z.string().cuid(),
  classId: z.string().cuid(),
  studentId: z.string().cuid(),
  date: z.coerce.date(),
  status: z.enum(['present', 'absent', 'late', 'leave']),
  method: z.enum(['manual', 'qr', 'rfid']).optional(),
  remarks: z.string().max(500).optional(),
  markedBy: z.string().cuid().optional(),
});

// ===== RESULTS & GRADING VALIDATORS =====
export const ExamScoreCreateSchema = z.object({
  examId: z.string().cuid(),
  studentId: z.string().cuid(),
  score: z.number().min(0, 'Score cannot be negative'),
  grade: z.string().max(10).optional(),
  remarks: z.string().max(500).optional(),
});

// ===== STUDENT & CLASS VALIDATORS =====
export const StudentCreateSchema = z.object({
  schoolId: z.string().cuid(),
  userId: z.string().cuid(),
  admissionNo: z.string().min(1).max(50),
  classId: z.string().cuid().optional(),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  address: z.string().max(500).optional(),
  bloodGroup: z.string().max(10).optional(),
  allergies: z.string().max(500).optional(),
  emergencyContact: z.string().max(20).optional(),
});

// ===== PARENT-STUDENT VALIDATORS =====
export const ParentStudentLinkSchema = z.object({
  parentId: z.string().cuid(),
  studentId: z.string().cuid(),
});

// ===== TEACHER-CLASS ASSIGNMENT VALIDATORS =====
export const TeacherClassAssignmentSchema = z.object({
  classId: z.string().cuid(),
  teacherId: z.string().cuid(),
});

// ===== NOTIFICATION VALIDATORS =====
export const NotificationCreateSchema = z.object({
  userId: z.string().cuid(),
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(2000),
  type: z.enum(['info', 'warning', 'success', 'error']).optional(),
  category: z.enum(['general', 'academic', 'financial', 'attendance', 'assignment']).optional(),
  actionUrl: z.string().url().optional(),
  schoolId: z.string().cuid().optional(),
});

// Helper function to safely parse and validate data
export function validateData<T>(
  schema: z.ZodType<T, T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: ZodError } {
  try {
    const validData = schema.parse(data);
    return { success: true, data: validData };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, errors: error };
    }
    throw error;
  }
}

// Get formatted error messages
export function getValidationErrors(error: ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};
  error.issues.forEach((err) => {
    const path = err.path.join('.');
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(err.message);
  });
  return formatted;
}
