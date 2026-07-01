import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type MathDrillConfig, type MathProblem, DEFAULT_MATH_DRILL_CONFIG } from '@/lib/math-drill-utils/types';
import { generateProblems } from '@/lib/math-drill-utils/problem-generator';

interface MathDrillStore {
  config: MathDrillConfig;
  problems: MathProblem[];
  savedConfigs: MathDrillConfig[];
  activeTab: string;
  setConfig: (partial: Partial<MathDrillConfig>) => void;
  setActiveTab: (tab: string) => void;
  regenerateProblems: () => void;
  resetConfig: () => void;
  saveConfig: (name: string) => void;
  loadConfig: (cfg: MathDrillConfig) => void;
  deleteSavedConfig: (name: string) => void;
}

const generateFresh = (config: MathDrillConfig): MathProblem[] => {
  try {
    return generateProblems(config);
  } catch {
    return [];
  }
};

export const useMathDrillStore = create<MathDrillStore>()(
  persist(
    (set, get) => ({
      config: { ...DEFAULT_MATH_DRILL_CONFIG },
      problems: generateFresh(DEFAULT_MATH_DRILL_CONFIG),
      savedConfigs: [],
      activeTab: 'configurator',

      setConfig: (partial) =>
        set((s) => {
          const updated = { ...s.config, ...partial };
          return { config: updated, problems: generateFresh(updated) };
        }),

      setActiveTab: (tab) => set({ activeTab: tab }),

      regenerateProblems: () =>
        set((s) => ({ problems: generateFresh(s.config) })),

      resetConfig: () =>
        set({
          config: { ...DEFAULT_MATH_DRILL_CONFIG },
          problems: generateFresh(DEFAULT_MATH_DRILL_CONFIG),
        }),

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
        set({ config: { ...cfg }, problems: generateFresh(cfg), activeTab: 'configurator' }),

      deleteSavedConfig: (name) =>
        set((s) => ({
          savedConfigs: s.savedConfigs.filter((c) => c.sheetTitle !== name),
        })),
    }),
    {
      name: 'skoolar-math-drill',
      partialize: (s) => ({
        savedConfigs: s.savedConfigs,
        config: s.config,
      }),
    }
  )
);
