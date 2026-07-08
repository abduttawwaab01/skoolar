export type ReportCardTemplateId = 'classic' | 'modern' | 'vibrant' | 'executive' | 'compact';

export interface ScoreTypeConfig {
  id: string;
  label: string;
  maxScore: number;
  includeInTotal: boolean;
}

export interface SubjectScoreData {
  subjectName: string;
  scores: Record<string, number | undefined>;
}

export interface StudentEntry {
  id: string;
  name: string;
  admissionNo: string;
  photoDataUrl: string;
  scores: Record<string, Record<string, number | undefined>>;
}

export interface ReportCardPrintConfig {
  templateId: ReportCardTemplateId;
  schoolName: string;
  schoolAddress: string;
  schoolMotto: string;
  schoolLogoDataUrl: string;
  className: string;
  termLabel: string;
  sessionLabel: string;
  subjects: string[];
  scoreTypes: ScoreTypeConfig[];
  students: StudentEntry[];
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontSize: number;
  showChart: boolean;
  showRadar: boolean;
  showPosition: boolean;
  showLogo: boolean;
  showStudentPhoto: boolean;
  showTeacherComment: boolean;
  showPrincipalComment: boolean;
  showSignature: boolean;
  teacherComment: string;
  principalComment: string;
  nextTermBegins: string;
  watermarkText: string;
}

export interface ReportCardTemplateMeta {
  id: ReportCardTemplateId;
  name: string;
  description: string;
  bestFor: string;
  tags: string[];
}

export interface GradeBoundary {
  grade: string;
  min: number;
  max: number;
  remark: string;
  color: string;
  bgColor: string;
}

export interface CalculatedSubject {
  name: string;
  total: number;
  maxPossible: number;
  percentage: number;
  grade: string;
  remark: string;
  scores: Record<string, number | undefined>;
}

export interface CalculatedStudent {
  id: string;
  name: string;
  admissionNo: string;
  photoDataUrl: string;
  subjects: CalculatedSubject[];
  grandTotal: number;
  maxGrandTotal: number;
  averagePercentage: number;
  overallGrade: string;
  overallRemark: string;
  position: number;
  totalStudents: number;
}

export const TEMPLATE_META: Record<ReportCardTemplateId, ReportCardTemplateMeta> = {
  classic: {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional Nigerian report card with navy header, table layout, and formal styling',
    bestFor: 'All grade levels, standard school reporting',
    tags: ['traditional', 'formal', 'table', 'navy'],
  },
  modern: {
    id: 'modern',
    name: 'Modern',
    description: 'Clean card-based design with teal accents, rounded corners, and minimal borders',
    bestFor: 'Forward-thinking schools, modern presentation',
    tags: ['clean', 'card', 'minimal', 'teal'],
  },
  vibrant: {
    id: 'vibrant',
    name: 'Vibrant',
    description: 'Colorful warm design with orange accents, large fonts, and star ratings',
    bestFor: 'Primary and nursery schools, younger students',
    tags: ['colorful', 'warm', 'playful', 'primary'],
  },
  executive: {
    id: 'executive',
    name: 'Executive',
    description: 'Professional dark gold design with formal borders, seals, and elegant typography',
    bestFor: 'Secondary schools, senior students, formal occasions',
    tags: ['professional', 'formal', 'dark', 'gold', 'elegant'],
  },
  compact: {
    id: 'compact',
    name: 'Compact',
    description: 'Space-efficient design with auto-scaling, two-column subjects for many subjects',
    bestFor: 'Schools with 10+ subjects, large classes, busy layouts',
    tags: ['compact', 'efficient', 'space-saving', 'blue'],
  },
};

export const GRADE_BOUNDARIES: GradeBoundary[] = [
  { grade: 'A', min: 70, max: 100, remark: 'Excellent', color: '#059669', bgColor: '#ecfdf5' },
  { grade: 'B', min: 60, max: 69, remark: 'Very Good', color: '#0284c7', bgColor: '#eff6ff' },
  { grade: 'C', min: 50, max: 59, remark: 'Good', color: '#d97706', bgColor: '#fffbeb' },
  { grade: 'D', min: 45, max: 49, remark: 'Fair', color: '#ea580c', bgColor: '#fff7ed' },
  { grade: 'E', min: 40, max: 44, remark: 'Poor', color: '#dc2626', bgColor: '#fef2f2' },
  { grade: 'F', min: 0, max: 39, remark: 'Fail', color: '#991b1b', bgColor: '#fef2f2' },
];

export const TERM_1_SCORE_TYPES: ScoreTypeConfig[] = [
  { id: 'ca1', label: 'CA1', maxScore: 10, includeInTotal: true },
  { id: 'ca2', label: 'CA2', maxScore: 10, includeInTotal: true },
  { id: 'ca3', label: 'CA3', maxScore: 10, includeInTotal: true },
  { id: 'exam', label: 'Exam', maxScore: 70, includeInTotal: true },
];

export const TERM_2_SCORE_TYPES: ScoreTypeConfig[] = [
  { id: 'ca1', label: 'CA1', maxScore: 10, includeInTotal: true },
  { id: 'ca2', label: 'CA2', maxScore: 10, includeInTotal: true },
  { id: 'ca3', label: 'CA3', maxScore: 10, includeInTotal: true },
  { id: 'exam', label: 'Exam', maxScore: 70, includeInTotal: true },
];

export const TERM_3_SCORE_TYPES: ScoreTypeConfig[] = [
  { id: 'ca1', label: 'CA1', maxScore: 10, includeInTotal: true },
  { id: 'ca2', label: 'CA2', maxScore: 10, includeInTotal: true },
  { id: 'ca3', label: 'CA3', maxScore: 10, includeInTotal: true },
  { id: 'exam', label: 'Exam', maxScore: 70, includeInTotal: true },
  { id: 'firstTerm', label: '1st Term', maxScore: 100, includeInTotal: true },
  { id: 'secondTerm', label: '2nd Term', maxScore: 100, includeInTotal: true },
];

export const DEFAULT_REPORT_CARD_PRINT_CONFIG: ReportCardPrintConfig = {
  templateId: 'classic',
  schoolName: '',
  schoolAddress: '',
  schoolMotto: '',
  schoolLogoDataUrl: '',
  className: '',
  termLabel: '1st Term',
  sessionLabel: '2025/2026',
  subjects: [],
  scoreTypes: [...TERM_1_SCORE_TYPES],
  students: [],
  primaryColor: '#1e40af',
  secondaryColor: '#3b82f6',
  backgroundColor: '#ffffff',
  textColor: '#1e293b',
  fontSize: 8,
  showChart: true,
  showRadar: true,
  showPosition: true,
  showLogo: true,
  showStudentPhoto: true,
  showTeacherComment: true,
  showPrincipalComment: true,
  showSignature: true,
  teacherComment: '',
  principalComment: '',
  nextTermBegins: '',
  watermarkText: '',
};

export const A4_MM = { width: 210, height: 297 };
export const A4_USABLE_WIDTH = 190;
export const A4_USABLE_HEIGHT = 277;

export const FONT_SIZE_MIN = 6;
export const FONT_SIZE_MAX = 12;
export const FONT_SIZE_DEFAULT = 8;
