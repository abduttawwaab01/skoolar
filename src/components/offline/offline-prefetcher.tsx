'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/app-store';
import { cacheEntities } from '@/lib/offline/db';

const API_BASE = '/api';
const PAGE_SIZE = 200;

export function OfflinePrefetcher() {
  const queryClient = useQueryClient();
  const { currentUser, selectedTermId } = useAppStore();
  const prefetched = useRef(false);

  useEffect(() => {
    if (!currentUser.schoolId || prefetched.current) return;
    prefetched.current = true;

    const schoolId = currentUser.schoolId;

    async function fetchAllPages(url: string): Promise<unknown[]> {
      const allItems: unknown[] = [];
      let page = 1;
      let totalPages = 1;

      while (page <= totalPages) {
        try {
          const pageUrl = `${url}${url.includes('?') ? '&' : '?'}page=${page}&limit=${PAGE_SIZE}`;
          const res = await fetch(pageUrl);
          if (!res.ok) break;
          const result = await res.json();
          const items = result?.data || result;
          if (Array.isArray(items)) {
            allItems.push(...items);
          }
          totalPages = result?.totalPages || 1;
          page++;
        } catch {
          break;
        }
      }

      return allItems;
    }

    const prefetch = async (key: unknown[], baseUrl: string) => {
      try {
        await queryClient.prefetchQuery({
          queryKey: key,
          queryFn: async () => {
            const allItems = await fetchAllPages(baseUrl);
            const entityType = (key[0] as string).replace(/s$/, '');
            if (Array.isArray(allItems) && allItems.length > 0) {
              const bulk = allItems.map((item: any) => ({ id: item.id, data: item, version: item._version || 1 }));
              try { await cacheEntities(key[0] as string, schoolId, bulk); } catch { /* offline */ }
            }
            return { data: allItems };
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

      // Core data - fetch ALL pages
      await Promise.allSettled([
        prefetch(['classes', schoolId], `${API_BASE}/classes${q}`),
        prefetch(['subjects', schoolId], `${API_BASE}/subjects${q}`),
        prefetch(['fee-structure', schoolId], `${API_BASE}/fee-structure${q}`),
        prefetch(['school-settings', schoolId], `${API_BASE}/school-settings${q}`),
        prefetch(['announcements', schoolId], `${API_BASE}/announcements${q}`),
        prefetch(['students', schoolId], `${API_BASE}/students${q}`),
        prefetch(['teachers', schoolId], `${API_BASE}/teachers${q}`),
        prefetch(['attendance', schoolId], `${API_BASE}/attendance${q}${t}`),
        prefetch(['exams', schoolId], `${API_BASE}/exams${q}${t}`),
        prefetch(['payments', schoolId], `${API_BASE}/payments${q}${t}`),
        prefetch(['parents', schoolId], `${API_BASE}/parents${q}`),
        prefetch(['library-books', schoolId], `${API_BASE}/library/books${q}`),
        prefetch(['homework', schoolId], `${API_BASE}/homework${q}${t}`),
        prefetch(['video-lessons', schoolId], `${API_BASE}/video-lessons${q}`),
        prefetch(['grade-scales', schoolId], `${API_BASE}/grade-scales${q}`),
      ]);
    };

    // Delay prefetch to avoid network contention on login
    const timer = setTimeout(prefetchAll, 2000);
    return () => clearTimeout(timer);
  }, [currentUser.schoolId, selectedTermId, queryClient]);

  return null;
}
