export type AttendanceTemplateId =
  | 'standard-register'
  | 'weekly-sheet'
  | 'term-overview'
  | 'behaviour-notes';

export interface AttendanceStudent {
  id: string;
  name: string;
  admissionNo?: string;
}

export interface AttendanceConfig {
  templateId: AttendanceTemplateId;
  sheetTitle: string;
  className: string;
  term: string;
  session: string;
  students: AttendanceStudent[];
  startDate: string;
  endDate: string;
  showSummary: boolean;
  showBehaviourNotes: boolean;
  showNameField: boolean;
  showDateField: boolean;
  showTitleField: boolean;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontSize: number;
  orientation: 'portrait' | 'landscape';
  paperSize: 'a4' | 'letter';
}

export interface AttendanceTemplateMeta {
  id: AttendanceTemplateId;
  name: string;
  description: string;
  bestFor: string;
  tags: string[];
}

export const TEMPLATE_META: Record<AttendanceTemplateId, AttendanceTemplateMeta> = {
  'standard-register': {
    id: 'standard-register',
    name: 'Standard Register',
    description: 'Full term register with all dates across multiple pages, one week per section',
    bestFor: 'Daily attendance tracking for the entire term',
    tags: ['attendance', 'register', 'term', 'teacher'],
  },
  'weekly-sheet': {
    id: 'weekly-sheet',
    name: 'Weekly Sheet',
    description: 'Single week attendance sheet with larger cells and more space',
    bestFor: 'Weekly attendance reporting and substitute teachers',
    tags: ['attendance', 'weekly', 'sheet', 'teacher'],
  },
  'term-overview': {
    id: 'term-overview',
    name: 'Term Overview',
    description: 'Compact monthly calendar grid showing attendance counts per day',
    bestFor: 'Summary view of attendance patterns across the term',
    tags: ['attendance', 'overview', 'summary', 'admin'],
  },
  'behaviour-notes': {
    id: 'behaviour-notes',
    name: 'Behaviour Notes',
    description: 'Standard register with an extra notes column for behaviour or comments',
    bestFor: 'Combined attendance and behaviour tracking',
    tags: ['attendance', 'behaviour', 'notes', 'teacher'],
  },
};

export const DEFAULT_ATTENDANCE_CONFIG: AttendanceConfig = {
  templateId: 'standard-register',
  sheetTitle: 'Class Attendance Register',
  className: '',
  term: '1st Term',
  session: '2025/2026',
  students: [],
  startDate: new Date(new Date().getFullYear(), 0, 8).toISOString().split('T')[0],
  endDate: new Date(new Date().getFullYear(), 3, 11).toISOString().split('T')[0],
  showSummary: true,
  showBehaviourNotes: false,
  showNameField: false,
  showDateField: false,
  showTitleField: true,
  primaryColor: '#1e40af',
  backgroundColor: '#ffffff',
  textColor: '#1e293b',
  fontSize: 10,
  orientation: 'landscape',
  paperSize: 'a4',
};

export const ATTENDANCE_CODES = ['P', 'A', 'L', 'E'] as const;
export type AttendanceCode = typeof ATTENDANCE_CODES[number];

export const ATTENDANCE_CODE_LABELS: Record<AttendanceCode, string> = {
  P: 'Present',
  A: 'Absent',
  L: 'Late',
  E: 'Excused',
};
