import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type SpellingConfig, DEFAULT_SPELLING_CONFIG } from '@/lib/spelling-utils/types';

interface SpellingStore {
  config: SpellingConfig;
  savedConfigs: SpellingConfig[];
  activeTab: string;
  setConfig: (partial: Partial<SpellingConfig>) => void;
  setActiveTab: (tab: string) => void;
  resetConfig: () => void;
  saveConfig: (name: string) => void;
  loadConfig: (cfg: SpellingConfig) => void;
  deleteSavedConfig: (name: string) => void;
}

export const useSpellingStore = create<SpellingStore>()(
  persist(
    (set) => ({
      config: { ...DEFAULT_SPELLING_CONFIG },
      savedConfigs: [],
      activeTab: 'configurator',

      setConfig: (partial) =>
        set((s) => ({ config: { ...s.config, ...partial } })),

      setActiveTab: (tab) => set({ activeTab: tab }),

      resetConfig: () =>
        set({ config: { ...DEFAULT_SPELLING_CONFIG } }),

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
      name: 'skoolar-spelling',
      partialize: (s) => ({ savedConfigs: s.savedConfigs, config: s.config }),
    }
  )
);
