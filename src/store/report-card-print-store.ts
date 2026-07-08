import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  type ReportCardPrintConfig,
  type StudentEntry,
  type ScoreTypeConfig,
  type DomainConfig,
  DEFAULT_REPORT_CARD_PRINT_CONFIG,
  TERM_1_SCORE_TYPES,
} from '@/lib/report-card-print-utils/types';

let idCounter = 1;
const genId = () => `st_${idCounter++}_${Date.now()}`;

interface ReportCardPrintStore {
  config: ReportCardPrintConfig;
  savedConfigs: ReportCardPrintConfig[];
  activeTab: string;
  currentStudentIndex: number;
  setConfig: (partial: Partial<ReportCardPrintConfig>) => void;
  setScoreTypes: (types: ScoreTypeConfig[]) => void;
  setSubjects: (subjects: string[]) => void;
  setActiveTab: (tab: string) => void;
  setCurrentStudentIndex: (idx: number) => void;
  resetConfig: () => void;
  addStudent: (name: string, admissionNo?: string) => void;
  addStudentsBulk: (names: string[]) => void;
  removeStudent: (id: string) => void;
  clearStudents: () => void;
  updateStudentScore: (studentId: string, subjectName: string, scoreTypeId: string, value: number | undefined) => void;
  setStudentPhoto: (studentId: string, dataUrl: string) => void;
  setStudentComment: (studentId: string, field: 'teacherComment' | 'principalComment', value: string) => void;
  updateStudentDomainScore: (studentId: string, domainId: string, traitId: string, value: number | undefined) => void;
  setStudentAttendance: (studentId: string, field: 'present' | 'absent' | 'total', value: number) => void;
  setSchoolLogo: (dataUrl: string) => void;
  addDomain: (name: string) => void;
  removeDomain: (id: string) => void;
  updateDomain: (id: string, partial: Partial<DomainConfig>) => void;
  saveConfig: (name: string) => void;
  loadConfig: (cfg: ReportCardPrintConfig) => void;
  deleteSavedConfig: (name: string) => void;
}

export const useReportCardPrintStore = create<ReportCardPrintStore>()(
  persist(
    (set) => ({
      config: { ...DEFAULT_REPORT_CARD_PRINT_CONFIG, scoreTypes: TERM_1_SCORE_TYPES.map(t => ({ ...t })) },
      savedConfigs: [],
      activeTab: 'configurator',
      currentStudentIndex: 0,

      setConfig: (partial) =>
        set((s) => {
          const updated = { ...s.config, ...partial };
          return { config: updated };
        }),

      setScoreTypes: (types) =>
        set((s) => ({ config: { ...s.config, scoreTypes: types } })),

      setSubjects: (subjects) =>
        set((s) => ({ config: { ...s.config, subjects } })),

      setActiveTab: (tab) => set({ activeTab: tab }),
      setCurrentStudentIndex: (idx) => set({ currentStudentIndex: idx }),

      resetConfig: () =>
        set({
          config: { ...DEFAULT_REPORT_CARD_PRINT_CONFIG, scoreTypes: TERM_1_SCORE_TYPES.map(t => ({ ...t })) },
          currentStudentIndex: 0,
        }),

      addStudent: (name, admissionNo) =>
        set((s) => {
          const newStudent: StudentEntry = {
            id: genId(),
            name,
            admissionNo: admissionNo || '',
            photoDataUrl: '',
            teacherComment: '',
            principalComment: '',
            scores: {},
            domainScores: {},
            attendance: { present: 0, absent: 0, total: 0 },
          };
          return { config: { ...s.config, students: [...s.config.students, newStudent] } };
        }),

      addStudentsBulk: (names) =>
        set((s) => {
          const existing = new Set(s.config.students.map((st) => st.name.toLowerCase().trim()));
          const newStudents: StudentEntry[] = [];
          for (const name of names) {
            const trimmed = name.trim();
            if (trimmed && !existing.has(trimmed.toLowerCase())) {
              newStudents.push({
                id: genId(),
                name: trimmed,
                admissionNo: '',
                photoDataUrl: '',
                teacherComment: '',
                principalComment: '',
                scores: {},
                domainScores: {},
                attendance: { present: 0, absent: 0, total: 0 },
              });
              existing.add(trimmed.toLowerCase());
            }
          }
          if (newStudents.length === 0) return s;
          return { config: { ...s.config, students: [...s.config.students, ...newStudents] } };
        }),

      removeStudent: (id) =>
        set((s) => {
          const students = s.config.students.filter((st) => st.id !== id);
          return {
            config: { ...s.config, students },
            currentStudentIndex: Math.min(s.currentStudentIndex, Math.max(0, students.length - 1)),
          };
        }),

      clearStudents: () =>
        set((s) => ({
          config: { ...s.config, students: [] },
          currentStudentIndex: 0,
        })),

      updateStudentScore: (studentId, subjectName, scoreTypeId, value) =>
        set((s) => {
          const students = s.config.students.map((st) => {
            if (st.id !== studentId) return st;
            const subjectScores = { ...(st.scores[subjectName] || {}) };
            subjectScores[scoreTypeId] = value;
            return { ...st, scores: { ...st.scores, [subjectName]: subjectScores } };
          });
          return { config: { ...s.config, students } };
        }),

      setStudentPhoto: (studentId, dataUrl) =>
        set((s) => ({
          config: {
            ...s.config,
            students: s.config.students.map((st) =>
              st.id === studentId ? { ...st, photoDataUrl: dataUrl } : st
            ),
          },
        })),

      setStudentComment: (studentId, field, value) =>
        set((s) => ({
          config: {
            ...s.config,
            students: s.config.students.map((st) =>
              st.id === studentId ? { ...st, [field]: value } : st
            ),
          },
        })),

      updateStudentDomainScore: (studentId, domainId, traitId, value) =>
        set((s) => {
          const students = s.config.students.map((st) => {
            if (st.id !== studentId) return st;
            const domainScores = { ...(st.domainScores[domainId] || {}) };
            domainScores[traitId] = value;
            return { ...st, domainScores: { ...st.domainScores, [domainId]: domainScores } };
          });
          return { config: { ...s.config, students } };
        }),

      setStudentAttendance: (studentId, field, value) =>
        set((s) => ({
          config: {
            ...s.config,
            students: s.config.students.map((st) =>
              st.id === studentId
                ? { ...st, attendance: { ...st.attendance, [field]: value } }
                : st
            ),
          },
        })),

      setSchoolLogo: (dataUrl) =>
        set((s) => ({ config: { ...s.config, schoolLogoDataUrl: dataUrl } })),

      addDomain: (name) =>
        set((s) => ({
          config: {
            ...s.config,
            domains: [...(s.config.domains || []), { id: `dom_${Date.now()}`, name, traits: [] }],
          },
        })),

      removeDomain: (id) =>
        set((s) => ({
          config: { ...s.config, domains: (s.config.domains || []).filter((d) => d.id !== id) },
        })),

      updateDomain: (id, partial) =>
        set((s) => ({
          config: {
            ...s.config,
            domains: (s.config.domains || []).map((d) => (d.id === id ? { ...d, ...partial } : d)),
          },
        })),

      saveConfig: (name) =>
        set((s) => {
          const updated = { ...s.config, sheetTitle: name } as any;
          const idx = s.savedConfigs.findIndex((c) => (c as any).sheetTitle === name);
          if (idx >= 0) {
            const list = [...s.savedConfigs];
            (list[idx] as any) = updated;
            return { savedConfigs: list, config: s.config };
          }
          return { savedConfigs: [...s.savedConfigs, updated], config: s.config };
        }),

      loadConfig: (cfg) =>
        set({ config: { ...cfg }, activeTab: 'configurator', currentStudentIndex: 0 }),

      deleteSavedConfig: (name) =>
        set((s) => ({
          savedConfigs: s.savedConfigs.filter((c) => (c as any).sheetTitle !== name),
        })),
    }),
    {
      name: 'skoolar-report-card-print',
      version: 1,
      migrate: (persisted: any) => {
        if (!persisted?.config) return persisted;
        persisted.config.subjects = Array.isArray(persisted.config.subjects) ? persisted.config.subjects : [];
        persisted.config.scoreTypes = Array.isArray(persisted.config.scoreTypes) ? persisted.config.scoreTypes : [];
        if (!Array.isArray(persisted.config.domains)) {
          persisted.config.domains = [];
        } else {
          persisted.config.domains = persisted.config.domains.map((d: any) => ({
            id: d.id || `dom_${Date.now()}`,
            name: d.name || 'Domain',
            traits: Array.isArray(d.traits) ? d.traits : [],
          }));
        }
        if (!Array.isArray(persisted.config.students)) {
          persisted.config.students = [];
        } else {
          persisted.config.students = persisted.config.students.map((st: any) => ({
            ...st,
            scores: st.scores || {},
            domainScores: st.domainScores || {},
            attendance: st.attendance || { present: 0, absent: 0, total: 0 },
          }));
        }
        return persisted;
      },
      partialize: (s) => ({
        savedConfigs: (s.savedConfigs || []).map(cfg => ({
          ...cfg,
          students: (cfg.students || []).map(st => ({ ...st, photoDataUrl: '' })),
          schoolLogoDataUrl: '',
        })),
        config: {
          ...s.config,
          students: (s.config.students || []).map(st => ({ ...st, photoDataUrl: '' })),
          schoolLogoDataUrl: '',
        },
      }),
    }
  )
);
