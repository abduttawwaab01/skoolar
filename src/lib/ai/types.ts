export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionResult {
  success: boolean;
  content?: string;
  error?: string;
  modelUsed?: string;
  latencyMs?: number;
}

export interface AITimetableSlot {
  dayOfWeek: number;
  period: number;
  startTime: string;
  endTime: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  room: string;
}

export interface AISchemeOfWorkEntry {
  weekNumber: number;
  topic: string;
  subTopic: string;
  learningObjectives: string;
  teachingActivities: string;
  learningActivities: string;
  resources: string;
  assessmentMethod: string;
  duration: number;
}

export interface AILessonNote {
  title: string;
  subject: string;
  class: string;
  duration: string;
  learningObjectives: string[];
  materials: string[];
  lessonStructure: {
    starter: string;
    mainActivities: string[];
    plenary: string;
  };
  differentiation: string;
  homework: string;
  assessment: string;
}

export interface AIHomeworkAssignment {
  title: string;
  description: string;
  instructions: string[];
  dueDate: string;
  maxScore: number;
  attachments?: string[];
}

export interface AIReportCardComment {
  strengths: string[];
  areasForImprovement: string[];
  generalComment: string;
  nextSteps: string[];
}

export interface AIProfessionalDevelopmentPlan {
  shortTermGoals: { title: string; description: string; duration: string }[];
  longTermGoals: { title: string; description: string; duration: string }[];
  recommendedCourses: { title: string; provider: string; url: string; relevance: string }[];
  skillsToDevelop: string[];
}

export interface AIAnalyticsInsight {
  title: string;
  description: string;
  data: Record<string, unknown>;
  recommendation: string;
  priority: 'high' | 'medium' | 'low';
}

export interface AIFinancialForecast {
  projectedRevenue: number;
  projectedExpenses: number;
  netPosition: number;
  riskFactors: string[];
  recommendations: string[];
}

export interface AIStaffInsight {
  teacherName: string;
  overallRating: string;
  strengths: string[];
  areasForImprovement: string[];
  recommendation: string;
}

export interface AIParentMessage {
  subject: string;
  body: string;
  tone: string;
  keyPoints: string[];
}
