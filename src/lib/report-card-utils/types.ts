export interface ScoreTypeInfo {
  id: string;
  name: string;
  maxMarks: number;
  weight: number;
  position: number;
}

export interface SubjectResult {
  subjectId: string;
  subjectName: string;
  caScore: number;
  examScore: number;
  total: number;
  percentage: number;
  grade: string;
  remark: string;
  scoresByType?: Record<string, { raw: number; max: number; normalized: number }>;
}

export interface DomainData {
  cognitive: Record<string, string | null>;
  psychomotor: Record<string, string | null>;
  affective: Record<string, string | null>;
  classTeacherComment?: string | null;
  classTeacherName?: string | null;
  principalComment?: string | null;
  principalName?: string | null;
}

export interface BehaviorTrait {
  label: string;
  rating: number;
}

export interface ReportCardData {
  student: {
    name: string;
    admissionNo: string;
    gender?: string | null;
    dateOfBirth?: string | null;
    bloodGroup?: string | null;
    photoBase64?: string | null;
    parents?: string | null;
    age?: string | null;
  };
  school: {
    name: string;
    logoBase64?: string | null;
    address?: string | null;
    motto?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    primaryColor?: string;
    secondaryColor?: string;
  };
  settings: {
    principalName?: string | null;
    nextTermBegins?: string | null;
    academicSession?: string | null;
  };
  term: { name: string; order: number };
  cls: { name: string; section?: string | null };
  subjectResults: SubjectResult[];
  attendance: { daysPresent: number; daysAbsent: number; percentage: number; totalDays: number };
  domainGrade: DomainData;
  totals: {
    grandTotal: number;
    averageScore: number;
    totalStudents: number;
    classRank?: number;
    overallGrade: string;
    overallRemark: string;
  };
  teacherComment?: string | null;
  principalComment?: string | null;
  reportCardId?: string;
  watermarkText?: string | null;
  showChart?: boolean;
  showDomains?: boolean;
  showAttendance?: boolean;
  showLegend?: boolean;
  scoreTypes?: ScoreTypeInfo[];
  radarData?: { subject: string; score: number }[];
  trendData?: { term: string; average: number }[];
  behaviorData?: BehaviorTrait[];
  house?: string | null;
}

export type Orientation = 'portrait' | 'landscape';

export interface A4Dimensions {
  widthMm: number;
  heightMm: number;
}
