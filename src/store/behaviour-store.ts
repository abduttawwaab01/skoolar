import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  type BehaviourConfig,
  type BehaviourTemplateId,
  type StudentBehaviourEntry,
  type BehaviourCategory,
  type ColourState,
  DEFAULT_BEHAVIOUR_CONFIG,
  CATEGORY_PRESETS,
} from '@/lib/behaviour-utils/types';

interface BehaviourStore {
  config: BehaviourConfig;
  savedConfigs: BehaviourConfig[];
  activeTab: string;
  previewHtml: string | null;
  previewLoading: boolean;

  setConfig: (partial: Partial<BehaviourConfig>) => void;
  setActiveTab: (tab: string) => void;
  setPreview: (html: string | null, loading?: boolean) => void;

  // Students
  setStudents: (students: StudentBehaviourEntry[]) => void;
  addStudent: (name: string) => void;
  removeStudent: (id: string) => void;
  setScore: (studentId: string, categoryId: string, score: number) => void;
  setColour: (studentId: string, colour: ColourState) => void;
  setLadderRung: (studentId: string, rung: number) => void;
  setGoalScore: (studentId: string, goalId: string, score: number) => void;

  // Categories
  setCategories: (categories: BehaviourCategory[]) => void;
  loadCategoryPreset: (preset: string) => void;

  // Template
  setTemplate: (templateId: BehaviourTemplateId) => void;

  // Config management
  resetConfig: () => void;
  saveConfig: (name: string) => void;
  loadConfig: (config: BehaviourConfig) => void;
  deleteSavedConfig: (name: string) => void;
}

export const useBehaviourStore = create<BehaviourStore>()(
  persist(
    (set) => ({
      config: { ...DEFAULT_BEHAVIOUR_CONFIG, students: JSON.parse(JSON.stringify(DEFAULT_BEHAVIOUR_CONFIG.students)) },
      savedConfigs: [],
      activeTab: 'configurator',
      previewHtml: null,
      previewLoading: false,

      setConfig: (partial) =>
        set((state) => ({ config: { ...state.config, ...partial } })),

      setActiveTab: (tab) => set({ activeTab: tab }),

      setPreview: (html, loading = false) =>
        set({ previewHtml: html, previewLoading: loading }),

      setStudents: (students) =>
        set((state) => ({ config: { ...state.config, students } })),

      addStudent: (name) =>
        set((state) => {
          const id = `s${Date.now()}`;
          return {
            config: {
              ...state.config,
              students: [...state.config.students, { id, name, scores: {} }],
            },
          };
        }),

      removeStudent: (id) =>
        set((state) => ({
          config: {
            ...state.config,
            students: state.config.students.filter((s) => s.id !== id),
          },
        })),

      setScore: (studentId, categoryId, score) =>
        set((state) => ({
          config: {
            ...state.config,
            students: state.config.students.map((s) =>
              s.id === studentId
                ? { ...s, scores: { ...s.scores, [categoryId]: score } }
                : s
            ),
          },
        })),

      setColour: (studentId, colour) =>
        set((state) => ({
          config: {
            ...state.config,
            students: state.config.students.map((s) =>
              s.id === studentId ? { ...s, colour } : s
            ),
          },
        })),

      setLadderRung: (studentId, rung) =>
        set((state) => ({
          config: {
            ...state.config,
            students: state.config.students.map((s) =>
              s.id === studentId ? { ...s, ladderRung: rung } : s
            ),
          },
        })),

      setGoalScore: (studentId, goalId, score) =>
        set((state) => ({
          config: {
            ...state.config,
            students: state.config.students.map((s) =>
              s.id === studentId
                ? { ...s, goals: { ...(s.goals || {}), [goalId]: score } }
                : s
            ),
          },
        })),

      setCategories: (categories) =>
        set((state) => ({ config: { ...state.config, categories } })),

      loadCategoryPreset: (preset) =>
        set((state) => {
          const p = CATEGORY_PRESETS[preset];
          if (!p) return state;
          return {
            config: {
              ...state.config,
              categories: p.categories.map((c) => ({ ...c })),
              categoryPreset: preset,
            },
          };
        }),

      setTemplate: (templateId) =>
        set((state) => ({ config: { ...state.config, templateId } })),

      resetConfig: () =>
        set({
          config: { ...DEFAULT_BEHAVIOUR_CONFIG, students: JSON.parse(JSON.stringify(DEFAULT_BEHAVIOUR_CONFIG.students)) },
          previewHtml: null,
        }),

      saveConfig: (name) =>
        set((state) => {
          const updated = { ...state.config, chartTitle: name };
          const existing = state.savedConfigs.findIndex((c) => c.chartTitle === name);
          if (existing >= 0) {
            const configs = [...state.savedConfigs];
            configs[existing] = updated;
            return { savedConfigs: configs, config: updated };
          }
          return { savedConfigs: [...state.savedConfigs, updated], config: updated };
        }),

      loadConfig: (config) =>
        set({ config: { ...config }, activeTab: 'configurator' }),

      deleteSavedConfig: (name) =>
        set((state) => ({
          savedConfigs: state.savedConfigs.filter((c) => c.chartTitle !== name),
        })),
    }),
    {
      name: 'skoolar-behaviour',
      partialize: (state) => ({
        savedConfigs: state.savedConfigs,
        config: state.config,
      }),
    }
  )
);
