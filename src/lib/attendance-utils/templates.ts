import { type AttendanceConfig, DEFAULT_ATTENDANCE_CONFIG } from './types';

const clone = (partial: Partial<AttendanceConfig>): AttendanceConfig => ({
  ...DEFAULT_ATTENDANCE_CONFIG,
  ...partial,
});

export const TEMPLATE_PRESETS: Record<string, AttendanceConfig> = {
  'standard-register': clone({
    templateId: 'standard-register',
    sheetTitle: 'Class Attendance Register',
    orientation: 'landscape',
    paperSize: 'a4',
    showSummary: true,
    showBehaviourNotes: false,
  }),

  'weekly-sheet': clone({
    templateId: 'weekly-sheet',
    sheetTitle: 'Weekly Attendance Sheet',
    orientation: 'landscape',
    paperSize: 'a4',
    showSummary: true,
    showBehaviourNotes: false,
  }),

  'term-overview': clone({
    templateId: 'term-overview',
    sheetTitle: 'Term Attendance Overview',
    orientation: 'landscape',
    paperSize: 'a4',
    showSummary: true,
    showBehaviourNotes: false,
  }),

  'behaviour-notes': clone({
    templateId: 'behaviour-notes',
    sheetTitle: 'Attendance & Behaviour Notes',
    orientation: 'landscape',
    paperSize: 'a4',
    showSummary: true,
    showBehaviourNotes: true,
  }),
};
