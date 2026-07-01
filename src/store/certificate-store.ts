import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  type CertificateDesignState,
  type CertificateType,
  type IssuedCertificate,
  DEFAULT_CERTIFICATE_DESIGN,
} from '@/lib/certificate-utils/types';

interface SelectionState {
  schoolId: string | null;
  classId: string | null;
  termId: string | null;
  studentId: string | null;
  studentIds: string[];
  certificateType: CertificateType;
}

interface PreviewState {
  html: string | null;
  loading: boolean;
  zoom: number;
}

interface CertificateStore {
  design: CertificateDesignState;
  savedDesigns: CertificateDesignState[];
  selection: SelectionState;
  preview: PreviewState;
  issuedCertificates: IssuedCertificate[];
  activeTab: string;

  setDesign: (partial: Partial<CertificateDesignState>) => void;
  setDesignColors: (colors: Partial<CertificateDesignState['colors']>) => void;
  setSelection: (partial: Partial<SelectionState>) => void;
  setPreview: (partial: Partial<PreviewState>) => void;
  setActiveTab: (tab: string) => void;
  resetDesign: () => void;
  loadDesign: (design: CertificateDesignState) => void;
  saveDesign: (name: string) => void;
  deleteSavedDesign: (name: string) => void;
  addIssuedCertificate: (cert: IssuedCertificate) => void;
  revokeCertificate: (id: string) => void;
  clearHistory: () => void;
  updateIssuedCertificate: (id: string, updates: Partial<IssuedCertificate>) => void;
}

export const useCertificateStore = create<CertificateStore>()(
  persist(
    (set) => ({
      design: { ...DEFAULT_CERTIFICATE_DESIGN },
      savedDesigns: [],
      selection: {
        schoolId: null,
        classId: null,
        termId: null,
        studentId: null,
        studentIds: [],
        certificateType: 'ACHIEVEMENT',
      },
      preview: {
        html: null,
        loading: false,
        zoom: 100,
      },
      issuedCertificates: [],
      activeTab: 'designer',

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

      setSelection: (partial) =>
        set((state) => ({
          selection: { ...state.selection, ...partial },
        })),

      setPreview: (partial) =>
        set((state) => ({
          preview: { ...state.preview, ...partial },
        })),

      setActiveTab: (tab) => set({ activeTab: tab }),

      resetDesign: () =>
        set({ design: { ...DEFAULT_CERTIFICATE_DESIGN }, preview: { html: null, loading: false, zoom: 100 } }),

      loadDesign: (design) =>
        set({ design: { ...design }, activeTab: 'designer' }),

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

      addIssuedCertificate: (cert) =>
        set((state) => ({
          issuedCertificates: [cert, ...state.issuedCertificates],
        })),

      revokeCertificate: (id) =>
        set((state) => ({
          issuedCertificates: state.issuedCertificates.map((c) =>
            c.id === id ? { ...c, status: 'REVOKED' as const } : c
          ),
        })),

      clearHistory: () => set({ issuedCertificates: [] }),

      updateIssuedCertificate: (id, updates) =>
        set((state) => ({
          issuedCertificates: state.issuedCertificates.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        })),
    }),
    {
      name: 'skoolar-certificates',
      partialize: (state) => ({
        savedDesigns: state.savedDesigns,
        issuedCertificates: state.issuedCertificates,
      }),
    }
  )
);
