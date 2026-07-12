import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  type BannerDesignState,
  DEFAULT_BANNER_DESIGN,
} from '@/lib/banner-templates/types';

interface PreviewState {
  html: string | null;
  loading: boolean;
}

interface BannerTemplatesStore {
  design: BannerDesignState;
  savedDesigns: BannerDesignState[];
  preview: PreviewState;
  activeTab: string;
  previewTab: 'design' | 'social';

  setDesign: (partial: Partial<BannerDesignState>) => void;
  setDesignColors: (colors: Partial<BannerDesignState['colors']>) => void;
  setPreview: (partial: Partial<PreviewState>) => void;
  setActiveTab: (tab: string) => void;
  setPreviewTab: (tab: 'design' | 'social') => void;
  resetDesign: () => void;
  loadDesign: (design: BannerDesignState) => void;
  saveDesign: (name: string) => void;
  deleteSavedDesign: (name: string) => void;
}

export const useBannerTemplatesStore = create<BannerTemplatesStore>()(
  persist(
    (set) => ({
      design: { ...DEFAULT_BANNER_DESIGN },
      savedDesigns: [],
      preview: { html: null, loading: false },
      activeTab: 'templates',
      previewTab: 'design',

      setDesign: (partial) =>
        set((state) => ({
          design: { ...state.design, ...partial },
        })),

      setDesignColors: (colors) =>
        set((state) => ({
          design: {
            ...state.design,
            colors: { ...state.design.colors, ...colors },
          },
        })),

      setPreview: (partial) =>
        set((state) => ({
          preview: { ...state.preview, ...partial },
        })),

      setActiveTab: (tab) => set({ activeTab: tab }),
      setPreviewTab: (tab) => set({ previewTab: tab }),

      resetDesign: () =>
        set({
          design: { ...DEFAULT_BANNER_DESIGN },
          preview: { html: null, loading: false },
        }),

      loadDesign: (design) =>
        set({ design: { ...design }, activeTab: 'designer', previewTab: 'design' }),

      saveDesign: (name) =>
        set((state) => {
          const updated = { ...state.design, name };
          const existing = state.savedDesigns.findIndex((d) => d.name === name);
          if (existing >= 0) {
            const designs = [...state.savedDesigns];
            designs[existing] = updated;
            return { savedDesigns: designs, design: updated };
          }
          return { savedDesigns: [...state.savedDesigns, updated], design: updated };
        }),

      deleteSavedDesign: (name) =>
        set((state) => ({
          savedDesigns: state.savedDesigns.filter((d) => d.name !== name),
        })),
    }),
    {
      name: 'skoolar-banner-templates',
      partialize: (state) => ({
        savedDesigns: state.savedDesigns,
      }),
    }
  )
);
