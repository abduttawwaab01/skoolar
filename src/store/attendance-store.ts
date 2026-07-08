import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type AttendanceConfig, type AttendanceStudent, DEFAULT_ATTENDANCE_CONFIG } from '@/lib/attendance-utils/types';

interface AttendanceStore {
  config: AttendanceConfig;
  savedConfigs: AttendanceConfig[];
  activeTab: string;
  setConfig: (partial: Partial<AttendanceConfig>) => void;
  setActiveTab: (tab: string) => void;
  resetConfig: () => void;
  addStudent: (student: AttendanceStudent) => void;
  removeStudent: (id: string) => void;
  addStudentsBulk: (names: string[]) => void;
  clearStudents: () => void;
  saveConfig: (name: string) => void;
  loadConfig: (cfg: AttendanceConfig) => void;
  deleteSavedConfig: (name: string) => void;
}

let idCounter = 1;
const genId = () => `stu_${idCounter++}_${Date.now()}`;

export const useAttendanceStore = create<AttendanceStore>()(
  persist(
    (set) => ({
      config: { ...DEFAULT_ATTENDANCE_CONFIG },
      savedConfigs: [],
      activeTab: 'configurator',

      setConfig: (partial) =>
        set((s) => ({ config: { ...s.config, ...partial } })),

      setActiveTab: (tab) => set({ activeTab: tab }),

      resetConfig: () =>
        set({ config: { ...DEFAULT_ATTENDANCE_CONFIG } }),

      addStudent: (student) =>
        set((s) => ({
          config: {
            ...s.config,
            students: [...s.config.students, { ...student, id: student.id || genId() }],
          },
        })),

      removeStudent: (id) =>
        set((s) => ({
          config: {
            ...s.config,
            students: s.config.students.filter((st) => st.id !== id),
          },
        })),

      addStudentsBulk: (names) =>
        set((s) => {
          const existing = new Set(s.config.students.map((st) => st.name.toLowerCase().trim()));
          const newStudents: AttendanceStudent[] = [];
          for (const name of names) {
            const trimmed = name.trim();
            if (trimmed && !existing.has(trimmed.toLowerCase())) {
              newStudents.push({ id: genId(), name: trimmed });
              existing.add(trimmed.toLowerCase());
            }
          }
          if (newStudents.length === 0) return s;
          return {
            config: {
              ...s.config,
              students: [...s.config.students, ...newStudents],
            },
          };
        }),

      clearStudents: () =>
        set((s) => ({
          config: { ...s.config, students: [] },
        })),

      saveConfig: (name) =>
        set((s) => {
          const updated = { ...s.config, sheetTitle: name };
          const idx = s.savedConfigs.findIndex((c) => c.sheetTitle === name);
          if (idx >= 0) {
            const list = [...s.savedConfigs];
            list[idx] = updated;
            return { savedConfigs: list, config: updated };
          }
          return { savedConfigs: [...s.savedConfigs, updated], config: updated };
        }),

      loadConfig: (cfg) =>
        set({ config: { ...cfg }, activeTab: 'configurator' }),

      deleteSavedConfig: (name) =>
        set((s) => ({
          savedConfigs: s.savedConfigs.filter((c) => c.sheetTitle !== name),
        })),
    }),
    {
      name: 'skoolar-attendance',
      partialize: (s) => ({
        savedConfigs: s.savedConfigs,
        config: s.config,
      }),
    }
  )
);
