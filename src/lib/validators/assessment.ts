import { z } from 'zod';

export const StudentAssessmentCreateSchema = z.object({
  schoolId: z.string().min(1),
  termId: z.string().optional().nullable(),
  academicYearId: z.string().optional().nullable(),
  name: z.string().min(3).max(255),
  description: z.string().max(5000).optional().nullable(),
  type: z.enum(['comprehensive', 'subject_knowledge', 'cognitive', 'learning_style', 'affective', 'psychomotor', 'skills_21st']).optional().default('comprehensive'),
  targetScope: z.enum(['all_students', 'specific_classes', 'specific_students']).optional().default('all_students'),
  targetClassIds: z.string().optional().nullable(),
  targetStudentIds: z.string().optional().nullable(),
  maxDuration: z.number().int().min(1).max(480).optional().nullable(),
  instructions: z.string().max(10000).optional().nullable(),
  passingThreshold: z.number().min(0).max(100).optional().nullable(),
  isAdaptive: z.boolean().optional().default(false),
  totalMarks: z.number().int().min(1).max(10000).optional().default(100),
  metadata: z.string().optional().nullable(),
});

export const StudentAssessmentUpdateSchema = StudentAssessmentCreateSchema.partial().omit({ schoolId: true });

export const StudentSectionCreateSchema = z.object({
  assessmentId: z.string().min(1),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional().nullable(),
  domain: z.enum(['cognitive', 'subject_knowledge', 'learning_style', 'affective', 'psychomotor', 'skills_21st']),
  order: z.number().int().min(0),
  timeLimit: z.number().int().min(1).optional().nullable(),
  weight: z.number().min(0).max(10).optional().default(1.0),
});

export const StudentSectionUpdateSchema = StudentSectionCreateSchema.partial().omit({ assessmentId: true });

const questionTypeEnum = z.enum(['MCQ', 'MULTI_SELECT', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER', 'ESSAY', 'LIKERT_SCALE', 'RANKING', 'SCENARIO', 'MATCHING', 'DRAG_DROP']);

export const StudentQuestionCreateSchema = z.object({
  sectionId: z.string().min(1),
  assessmentId: z.string().min(1),
  type: questionTypeEnum.optional().default('MCQ'),
  questionText: z.string().min(5).max(10000),
  options: z.string().optional().nullable(),
  correctAnswer: z.string().optional().nullable(),
  marks: z.number().int().min(1).max(1000).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional().default('intermediate'),
  skillTag: z.string().max(100).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  explanation: z.string().max(5000).optional().nullable(),
  mediaUrl: z.string().url().optional().nullable(),
  order: z.number().int().min(0).optional(),
  weight: z.number().min(0).max(10).optional().default(1.0),
  parentQuestionId: z.string().optional().nullable(),
});

export const StudentQuestionUpdateSchema = StudentQuestionCreateSchema.partial().omit({ sectionId: true, assessmentId: true });

export const StudentAttemptStartSchema = z.object({
  assessmentId: z.string().min(1),
  studentId: z.string().min(1),
});

export const StudentAttemptSubmitSchema = z.object({
  attemptId: z.string().min(1),
  answers: z.record(z.string(), z.any()),
  timeTakenSeconds: z.number().int().min(0).optional(),
  tabSwitchCount: z.number().int().min(0).optional().default(0),
  securityViolations: z.string().optional().nullable(),
});

export const StudentRecommendationCompleteSchema = z.object({
  recommendationId: z.string().min(1),
});

// Teacher Assessment
export const TeacherAssessmentCreateSchema = z.object({
  schoolId: z.string().min(1),
  termId: z.string().optional().nullable(),
  name: z.string().min(3).max(255),
  description: z.string().max(5000).optional().nullable(),
  type: z.enum(['comprehensive', 'leadership', 'pedagogical', 'classroom_mgmt', 'subject_expertise', 'prof_development', 'interpersonal']).optional().default('comprehensive'),
  targetTeacherIds: z.string().optional().nullable(),
  maxDuration: z.number().int().min(1).max(480).optional().nullable(),
  instructions: z.string().max(10000).optional().nullable(),
  totalMarks: z.number().int().min(1).max(10000).optional().default(100),
});

export const TeacherAssessmentUpdateSchema = TeacherAssessmentCreateSchema.partial().omit({ schoolId: true });

export const TeacherSectionCreateSchema = z.object({
  assessmentId: z.string().min(1),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional().nullable(),
  domain: z.enum(['leadership', 'pedagogy', 'classroom_mgmt', 'subject_expertise', 'prof_development', 'interpersonal']),
  order: z.number().int().min(0),
  timeLimit: z.number().int().min(1).optional().nullable(),
  weight: z.number().min(0).max(10).optional().default(1.0),
});

export const TeacherSectionUpdateSchema = TeacherSectionCreateSchema.partial().omit({ assessmentId: true });

export const TeacherQuestionCreateSchema = z.object({
  sectionId: z.string().min(1),
  assessmentId: z.string().min(1),
  type: z.enum(['MCQ', 'LIKERT_SCALE', 'SELF_REFLECTION', 'SCENARIO', 'OPEN_ENDED', 'RANKING', '360_PROMPT']).optional().default('MCQ'),
  questionText: z.string().min(5).max(10000),
  options: z.string().optional().nullable(),
  domain: z.string().min(1),
  competencyTag: z.string().max(100).optional().nullable(),
  marks: z.number().int().min(1).max(1000).optional(),
  weight: z.number().min(0).max(10).optional().default(1.0),
  respondentType: z.enum(['self', 'peer', 'student', 'admin', 'parent']).optional().default('self'),
  order: z.number().int().min(0).optional(),
});

export const TeacherQuestionUpdateSchema = TeacherQuestionCreateSchema.partial().omit({ sectionId: true, assessmentId: true });

export const TeacherAttemptStartSchema = z.object({
  assessmentId: z.string().min(1),
  teacherId: z.string().min(1),
});

export const TeacherAttemptSubmitSchema = z.object({
  attemptId: z.string().min(1),
  answers: z.record(z.string(), z.any()),
  timeTakenSeconds: z.number().int().min(0).optional(),
});

// 360 Feedback
export const FeedbackSubmitSchema = z.object({
  teacherId: z.string().min(1),
  assessmentId: z.string().optional().nullable(),
  respondentUserId: z.string().min(1),
  respondentRole: z.enum(['student', 'peer', 'admin', 'parent', 'self']),
  domain: z.string().min(1),
  competencyTag: z.string().optional().nullable(),
  ratings: z.string().optional().nullable(),
  comments: z.string().optional().nullable(),
  isAnonymous: z.boolean().optional().default(true),
});

export const FeedbackApproveSchema = z.object({
  id: z.string().min(1),
  approvalStatus: z.enum(['approved', 'rejected']),
});

// Observations
export const ObservationCreateSchema = z.object({
  teacherId: z.string().min(1),
  schoolId: z.string().min(1),
  date: z.coerce.date().optional(),
  lessonTopic: z.string().max(500).optional().nullable(),
  lessonDuration: z.number().int().min(1).optional().nullable(),
  ratings: z.string().optional().nullable(),
  overallScore: z.number().min(0).max(100).optional().nullable(),
  strengths: z.string().max(5000).optional().nullable(),
  areasForImprovement: z.string().max(5000).optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
  followUpAction: z.string().max(5000).optional().nullable(),
  nextObservationDate: z.coerce.date().optional().nullable(),
});

export const ObservationUpdateSchema = ObservationCreateSchema.partial();

// AI
export const AIGenerateQuestionsSchema = z.object({
  topics: z.array(z.string()).min(1).max(10),
  domain: z.string().min(1),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional().default('intermediate'),
  count: z.number().int().min(1).max(50).optional().default(10),
  questionTypes: z.array(questionTypeEnum).optional(),
  targetType: z.enum(['student', 'teacher']).optional().default('student'),
});

export const AIGradeSchema = z.object({
  questionText: z.string().min(1),
  rubric: z.string().optional().nullable(),
  studentAnswer: z.string().min(1),
  maxMarks: z.number().int().min(1).max(1000),
});

export const AIRecommendSchema = z.object({
  profileId: z.string().min(1),
  targetType: z.enum(['student', 'teacher']),
  domains: z.array(z.string()).optional(),
});

// Templates
export const TemplateCreateSchema = z.object({
  schoolId: z.string().optional().nullable(),
  name: z.string().min(3).max(255),
  description: z.string().max(5000).optional().nullable(),
  targetType: z.enum(['student', 'teacher']),
  isBuiltIn: z.boolean().optional().default(false),
  studentDomains: z.string().optional().nullable(),
  teacherDomains: z.string().optional().nullable(),
  configuration: z.string().optional().nullable(),
});

export const TemplateInstantiateSchema = z.object({
  templateId: z.string().min(1),
  schoolId: z.string().min(1),
  name: z.string().min(3).max(255).optional(),
  termId: z.string().optional().nullable(),
  targetScope: z.string().optional().nullable(),
  targetClassIds: z.string().optional().nullable(),
  targetStudentIds: z.string().optional().nullable(),
});

// AI Config
export const AIConfigUpdateSchema = z.object({
  aiEnabled: z.boolean().optional(),
  provider: z.enum(['auto', 'openrouter', 'fallback']).optional(),
  aiQuestionGen: z.boolean().optional(),
  aiGrading: z.boolean().optional(),
  aiRecommendations: z.boolean().optional(),
  aiProfileAnalysis: z.boolean().optional(),
  aiReportGen: z.boolean().optional(),
  aiModel: z.enum(['auto']).optional(),
  openrouterKey: z.string().optional().nullable(),
  primaryModel: z.string().optional(),
  fallbackModel1: z.string().optional(),
  fallbackModel2: z.string().optional(),
  fallbackModel3: z.string().optional(),
  maxRetries: z.number().min(0).max(10).optional(),
  requestTimeoutMs: z.number().min(1000).max(120000).optional(),
});

export type StudentAssessmentCreateInput = z.infer<typeof StudentAssessmentCreateSchema>;
export type StudentQuestionCreateInput = z.infer<typeof StudentQuestionCreateSchema>;
export type StudentAttemptSubmitInput = z.infer<typeof StudentAttemptSubmitSchema>;
export type TeacherAssessmentCreateInput = z.infer<typeof TeacherAssessmentCreateSchema>;
export type TeacherQuestionCreateInput = z.infer<typeof TeacherQuestionCreateSchema>;
export type FeedbackSubmitInput = z.infer<typeof FeedbackSubmitSchema>;
export type ObservationCreateInput = z.infer<typeof ObservationCreateSchema>;
export type AIGenerateQuestionsInput = z.infer<typeof AIGenerateQuestionsSchema>;
export type AIGradeInput = z.infer<typeof AIGradeSchema>;
