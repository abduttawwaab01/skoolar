'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/app-store';
import { cacheEntities } from '@/lib/offline/db';

const API_BASE = '/api';

export function OfflinePrefetcher() {
  const queryClient = useQueryClient();
  const { currentUser, selectedTermId } = useAppStore();
  const prefetched = useRef(false);

  useEffect(() => {
    if (!currentUser.schoolId || prefetched.current) return;
    prefetched.current = true;

    const schoolId = currentUser.schoolId;

    const prefetch = async (key: unknown[], url: string) => {
      try {
        await queryClient.prefetchQuery({
          queryKey: key,
          queryFn: async () => {
            const res = await fetch(url);
            if (!res.ok) return null;
            const data = await res.json();
            const items = data?.data || data;
            if (Array.isArray(items)) {
              const entityType = (key[0] as string).replace(/s$/, '');
              const bulk = items.map((item: any) => ({ id: item.id, data: item, version: item._version || 1 }));
              try { await cacheEntities(key[0] as string, schoolId, bulk); } catch { /* offline */ }
            }
            return data;
          },
          staleTime: 24 * 60 * 60 * 1000,
          gcTime: 7 * 24 * 60 * 60 * 1000,
        });
      } catch {
        // Silently fail — user may be offline
      }
    };

    const prefetchAll = async () => {
      const q = `?schoolId=${schoolId}`;
      const t = selectedTermId ? `&termId=${selectedTermId}` : '';

      await Promise.allSettled([
        prefetch(['classes', schoolId], `${API_BASE}/classes${q}`),
        prefetch(['subjects', schoolId], `${API_BASE}/subjects${q}`),
        prefetch(['fee-structure', schoolId], `${API_BASE}/fee-structure${q}`),
        prefetch(['school-settings', schoolId], `${API_BASE}/school-settings${q}`),
        prefetch(['announcements', schoolId], `${API_BASE}/announcements${q}`),
        prefetch(['students', { limit: 50 }, schoolId], `${API_BASE}/students?limit=50${q}`),
        prefetch(['teachers', { limit: 50 }, schoolId], `${API_BASE}/teachers?limit=50${q}`),
        prefetch(['attendance', { termId: selectedTermId }, schoolId], `${API_BASE}/attendance?limit=50${q}${t}`),
        prefetch(['exams', { termId: selectedTermId }, schoolId], `${API_BASE}/exams?limit=50${q}${t}`),
        prefetch(['payments', { termId: selectedTermId }, schoolId], `${API_BASE}/payments?limit=50${q}${t}`),
      ]);
    };

    // Delay prefetch to avoid network contention on login
    const timer = setTimeout(prefetchAll, 2000);
    return () => clearTimeout(timer);
  }, [currentUser.schoolId, selectedTermId, queryClient]);

  return null;
}
