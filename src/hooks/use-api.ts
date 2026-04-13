import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/app-store';

const API_BASE = '/api';

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  
  return response.json();
}

export function useStudents(params?: {
  page?: number;
  limit?: number;
  classId?: string;
  search?: string;
  gender?: string;
  isActive?: boolean;
}) {
  const { currentUser } = useAppStore();
  
  return useQuery({
    queryKey: ['students', params, currentUser.schoolId],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.limit) searchParams.set('limit', String(params.limit));
      if (params?.classId) searchParams.set('classId', params.classId);
      if (params?.search) searchParams.set('search', params.search);
      if (params?.gender) searchParams.set('gender', params.gender);
      if (params?.isActive !== undefined) searchParams.set('isActive', String(params.isActive));
      
      return fetchApi<{ data: unknown[]; total: number; page: number; totalPages: number }>(
        `${API_BASE}/students?${searchParams.toString()}`
      );
    },
    staleTime: 30 * 1000,
  });
}

export function useTeachers(params?: { page?: number; limit?: number; search?: string }) {
  const { currentUser } = useAppStore();
  
  return useQuery({
    queryKey: ['teachers', params, currentUser.schoolId],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.limit) searchParams.set('limit', String(params.limit));
      if (params?.search) searchParams.set('search', params.search);
      
      return fetchApi<{ data: unknown[]; total: number; page: number; totalPages: number }>(
        `${API_BASE}/teachers?${searchParams.toString()}`
      );
    },
    staleTime: 30 * 1000,
  });
}

export function useClasses() {
  const { currentUser } = useAppStore();
  
  return useQuery({
    queryKey: ['classes', currentUser.schoolId],
    queryFn: () => fetchApi<{ data: unknown[] }>(`/api/classes?schoolId=${currentUser.schoolId}`),
    staleTime: 60 * 1000,
  });
}

export function useSubjects() {
  const { currentUser } = useAppStore();
  
  return useQuery({
    queryKey: ['subjects', currentUser.schoolId],
    queryFn: () => fetchApi<{ data: unknown[] }>(`/api/subjects?schoolId=${currentUser.schoolId}`),
    staleTime: 60 * 1000,
  });
}

export function useAttendance(params?: { date?: string; classId?: string; termId?: string }) {
  const { currentUser, selectedTermId } = useAppStore();
  
  return useQuery({
    queryKey: ['attendance', params, currentUser.schoolId],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.date) searchParams.set('date', params.date);
      if (params?.classId) searchParams.set('classId', params.classId);
      if (params?.termId) searchParams.set('termId', params.termId);
      else if (selectedTermId) searchParams.set('termId', selectedTermId);
      
      return fetchApi<{ data: unknown[] }>(`/api/attendance?${searchParams.toString()}`);
    },
    staleTime: 15 * 1000,
  });
}

export function useExams(params?: { classId?: string; subjectId?: string; termId?: string }) {
  const { currentUser, selectedTermId } = useAppStore();
  
  return useQuery({
    queryKey: ['exams', params, currentUser.schoolId],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.classId) searchParams.set('classId', params.classId);
      if (params?.subjectId) searchParams.set('subjectId', params.subjectId);
      if (params?.termId) searchParams.set('termId', params.termId);
      else if (selectedTermId) searchParams.set('termId', selectedTermId);
      
      return fetchApi<{ data: unknown[] }>(`/api/exams?${searchParams.toString()}`);
    },
    staleTime: 30 * 1000,
  });
}

export function useResults(params?: { studentId?: string; classId?: string; termId?: string }) {
  const { currentUser, selectedTermId } = useAppStore();
  
  return useQuery({
    queryKey: ['results', params, currentUser.schoolId],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.studentId) searchParams.set('studentId', params.studentId);
      if (params?.classId) searchParams.set('classId', params.classId);
      if (params?.termId) searchParams.set('termId', params.termId);
      else if (selectedTermId) searchParams.set('termId', selectedTermId);
      
      return fetchApi<{ data: unknown[] }>(`/api/results?${searchParams.toString()}`);
    },
    staleTime: 30 * 1000,
  });
}

export function usePayments(params?: { studentId?: string; status?: string; termId?: string }) {
  const { currentUser, selectedTermId } = useAppStore();
  
  return useQuery({
    queryKey: ['payments', params, currentUser.schoolId],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.studentId) searchParams.set('studentId', params.studentId);
      if (params?.status) searchParams.set('status', params.status);
      if (params?.termId) searchParams.set('termId', params.termId);
      else if (selectedTermId) searchParams.set('termId', selectedTermId);
      
      return fetchApi<{ data: unknown[] }>(`/api/payments?${searchParams.toString()}`);
    },
    staleTime: 15 * 1000,
  });
}

export function useAnnouncements() {
  const { currentUser } = useAppStore();
  
  return useQuery({
    queryKey: ['announcements', currentUser.schoolId],
    queryFn: () => fetchApi<{ data: unknown[] }>(`/api/announcements?schoolId=${currentUser.schoolId}`),
    staleTime: 30 * 1000,
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => fetchApi<{ data: unknown[] }>(`/api/notifications`),
    staleTime: 20 * 1000,
  });
}

export function useAnalytics() {
  const { currentUser } = useAppStore();
  
  return useQuery({
    queryKey: ['analytics', currentUser.schoolId],
    queryFn: () => {
      if (!currentUser.schoolId) {
        return Promise.resolve({ data: null });
      }
      return fetchApi<{ data: unknown }>(`/api/analytics?schoolId=${currentUser.schoolId}`);
    },
    enabled: !!currentUser.schoolId,
    staleTime: 60 * 1000,
  });
}

export function useFeeStructure() {
  const { currentUser } = useAppStore();
  
  return useQuery({
    queryKey: ['fee-structure', currentUser.schoolId],
    queryFn: () => fetchApi<{ data: unknown[] }>(`/api/fee-structure?schoolId=${currentUser.schoolId}`),
    staleTime: 60 * 1000,
  });
}

export function useLibraryBooks(params?: { search?: string; category?: string }) {
  const { currentUser } = useAppStore();
  
  return useQuery({
    queryKey: ['library-books', params, currentUser.schoolId],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.set('search', params.search);
      if (params?.category) searchParams.set('category', params.category);
      
      return fetchApi<{ data: unknown[] }>(`/api/library/books?${searchParams.toString()}`);
    },
    staleTime: 60 * 1000,
  });
}

export function useBooksBorrowRecords() {
  return useQuery({
    queryKey: ['borrow-records'],
    queryFn: () => fetchApi<{ data: unknown[] }>(`/api/library/borrow`),
    staleTime: 30 * 1000,
  });
}

export function useHomework(params?: { classId?: string; status?: string }) {
  const { currentUser } = useAppStore();
  
  return useQuery({
    queryKey: ['homework', params, currentUser.schoolId],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.classId) searchParams.set('classId', params.classId);
      if (params?.status) searchParams.set('status', params.status);
      
      return fetchApi<{ data: unknown[] }>(`/api/homework?${searchParams.toString()}`);
    },
    staleTime: 20 * 1000,
  });
}

export function useVideoLessons(params?: { subjectId?: string; classId?: string }) {
  const { currentUser } = useAppStore();
  
  return useQuery({
    queryKey: ['video-lessons', params, currentUser.schoolId],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.subjectId) searchParams.set('subjectId', params.subjectId);
      if (params?.classId) searchParams.set('classId', params.classId);
      
      return fetchApi<{ data: unknown[] }>(`/api/video-lessons?${searchParams.toString()}`);
    },
    staleTime: 60 * 1000,
  });
}

export function useParents(params?: { search?: string }) {
  const { currentUser } = useAppStore();
  
  return useQuery({
    queryKey: ['parents', params, currentUser.schoolId],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.set('search', params.search);
      
      return fetchApi<{ data: unknown[] }>(`/api/parents?${searchParams.toString()}`);
    },
    staleTime: 30 * 1000,
  });
}

export function useSchoolSettings() {
  const { currentUser } = useAppStore();
  
  return useQuery({
    queryKey: ['school-settings', currentUser.schoolId],
    queryFn: () => fetchApi<{ data: unknown }>(`/api/school-settings?schoolId=${currentUser.schoolId}`),
    staleTime: 60 * 1000,
  });
}

export function useCalendarEvents(params?: { start?: string; end?: string }) {
  const { currentUser } = useAppStore();
  
  return useQuery({
    queryKey: ['calendar-events', params, currentUser.schoolId],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.start) searchParams.set('start', params.start);
      if (params?.end) searchParams.set('end', params.end);
      
      return fetchApi<{ data: unknown[] }>(`/api/calendar?${searchParams.toString()}`);
    },
    staleTime: 30 * 1000,
  });
}

export function useAuditLogs(params?: { action?: string; entity?: string; page?: number }) {
  const { currentUser } = useAppStore();
  
  return useQuery({
    queryKey: ['audit-logs', params, currentUser.schoolId],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.action) searchParams.set('action', params.action);
      if (params?.entity) searchParams.set('entity', params.entity);
      if (params?.page) searchParams.set('page', String(params.page));
      
      return fetchApi<{ data: unknown[]; total: number }>(`/api/audit-logs?${searchParams.toString()}`);
    },
    staleTime: 60 * 1000,
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: unknown) => fetchApi<{ data: unknown }>('/api/students', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
    onError: (error) => {
      console.error('Failed to create student:', error);
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => fetchApi<{ data: unknown }>(`/api/students/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (error) => {
      console.error('Failed to update student:', error);
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

export function useDeleteStudent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => fetchApi<{ data: unknown }>(`/api/students/${id}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
    onError: (error) => {
      console.error('Failed to delete student:', error);
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

export function useCreateTeacher() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: unknown) => fetchApi<{ data: unknown }>('/api/teachers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
    onError: (error) => {
      console.error('Failed to create teacher:', error);
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
  });
}

export function useUpdateTeacher() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => fetchApi<{ data: unknown }>(`/api/teachers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
    onError: (error) => {
      console.error('Failed to update teacher:', error);
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
  });
}

export function useDeleteTeacher() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => fetchApi<{ data: unknown }>(`/api/teachers/${id}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
    onError: (error) => {
      console.error('Failed to delete teacher:', error);
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
  });
}

export function useCreateClass() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: unknown) => fetchApi<{ data: unknown }>('/api/classes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
    onError: (error) => {
      console.error('Failed to create class:', error);
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });
}

export function useUpdateClass() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => fetchApi<{ data: unknown }>(`/api/classes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (error) => {
      console.error('Failed to update class:', error);
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });
}

export function useDeleteClass() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => fetchApi<{ data: unknown }>(`/api/classes/${id}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
    onError: (error) => {
      console.error('Failed to delete class:', error);
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: unknown) => fetchApi<{ data: unknown }>('/api/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: unknown) => fetchApi<{ data: unknown }>('/api/announcements', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });
}

export function useCreateHomework() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: unknown) => fetchApi<{ data: unknown }>('/api/homework', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homework'] });
    },
  });
}

export function useCreateExam() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: unknown) => fetchApi<{ data: unknown }>('/api/exams', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
    },
  });
}

export function useMarkAttendance() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: unknown) => fetchApi<{ data: unknown }>('/api/attendance', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

export function usePrefetchStudents(queryClient: { prefetchQuery: (options: unknown) => Promise<void> }) {
  const { currentUser } = useAppStore();
  
  return () => {
    queryClient.prefetchQuery({
      queryKey: ['students', { limit: 20 }, currentUser.schoolId],
      queryFn: () => fetchApi<{ data: unknown[] }>(`/api/students?limit=20`),
    });
  };
}

export function useInfiniteStudents(params?: { classId?: string; search?: string; gender?: string }) {
  const { currentUser } = useAppStore();
  
  return useInfiniteQuery({
    queryKey: ['students', 'infinite', params, currentUser.schoolId],
    queryFn: async ({ pageParam = 1 }) => {
      const searchParams = new URLSearchParams();
      searchParams.set('page', String(pageParam));
      searchParams.set('limit', '50');
      if (params?.classId) searchParams.set('classId', params.classId);
      if (params?.search) searchParams.set('search', params.search);
      if (params?.gender) searchParams.set('gender', params.gender);
      
      return fetchApi<{ data: unknown[]; total: number; page: number; totalPages: number }>(
        `${API_BASE}/students?${searchParams.toString()}`
      );
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    staleTime: 30 * 1000,
  });
}

export function useInfiniteTeachers(params?: { search?: string }) {
  const { currentUser } = useAppStore();
  
  return useInfiniteQuery({
    queryKey: ['teachers', 'infinite', params, currentUser.schoolId],
    queryFn: async ({ pageParam = 1 }) => {
      const searchParams = new URLSearchParams();
      searchParams.set('page', String(pageParam));
      searchParams.set('limit', '50');
      if (params?.search) searchParams.set('search', params.search);
      
      return fetchApi<{ data: unknown[]; total: number; page: number; totalPages: number }>(
        `${API_BASE}/teachers?${searchParams.toString()}`
      );
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    staleTime: 30 * 1000,
  });
}

export function useInfinitePayments(params?: { studentId?: string; status?: string }) {
  const { currentUser, selectedTermId } = useAppStore();
  
  return useInfiniteQuery({
    queryKey: ['payments', 'infinite', params, currentUser.schoolId],
    queryFn: async ({ pageParam = 1 }) => {
      const searchParams = new URLSearchParams();
      searchParams.set('page', String(pageParam));
      searchParams.set('limit', '50');
      if (params?.studentId) searchParams.set('studentId', params.studentId);
      if (params?.status) searchParams.set('status', params.status);
      if (selectedTermId) searchParams.set('termId', selectedTermId);
      
      return fetchApi<{ data: unknown[]; total: number; page: number; totalPages: number }>(
        `${API_BASE}/payments?${searchParams.toString()}`
      );
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    staleTime: 15 * 1000,
  });
}

export function useInfiniteAttendance(params?: { date?: string; classId?: string }) {
  const { currentUser, selectedTermId } = useAppStore();
  
  return useInfiniteQuery({
    queryKey: ['attendance', 'infinite', params, currentUser.schoolId],
    queryFn: async ({ pageParam = 1 }) => {
      const searchParams = new URLSearchParams();
      searchParams.set('page', String(pageParam));
      searchParams.set('limit', '100');
      if (params?.date) searchParams.set('date', params.date);
      if (params?.classId) searchParams.set('classId', params.classId);
      if (selectedTermId) searchParams.set('termId', selectedTermId);
      
      return fetchApi<{ data: unknown[]; total: number; page: number; totalPages: number }>(
        `${API_BASE}/attendance?${searchParams.toString()}`
      );
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    staleTime: 15 * 1000,
  });
}

export function useInfiniteResults(params?: { studentId?: string; classId?: string }) {
  const { currentUser, selectedTermId } = useAppStore();
  
  return useInfiniteQuery({
    queryKey: ['results', 'infinite', params, currentUser.schoolId],
    queryFn: async ({ pageParam = 1 }) => {
      const searchParams = new URLSearchParams();
      searchParams.set('page', String(pageParam));
      searchParams.set('limit', '50');
      if (params?.studentId) searchParams.set('studentId', params.studentId);
      if (params?.classId) searchParams.set('classId', params.classId);
      if (selectedTermId) searchParams.set('termId', selectedTermId);
      
      return fetchApi<{ data: unknown[]; total: number; page: number; totalPages: number }>(
        `${API_BASE}/results?${searchParams.toString()}`
      );
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    staleTime: 30 * 1000,
  });
}

export function useInfiniteHomework(params?: { classId?: string; status?: string }) {
  const { currentUser } = useAppStore();
  
  return useInfiniteQuery({
    queryKey: ['homework', 'infinite', params, currentUser.schoolId],
    queryFn: async ({ pageParam = 1 }) => {
      const searchParams = new URLSearchParams();
      searchParams.set('page', String(pageParam));
      searchParams.set('limit', '30');
      if (params?.classId) searchParams.set('classId', params.classId);
      if (params?.status) searchParams.set('status', params.status);
      
      return fetchApi<{ data: unknown[]; total: number; page: number; totalPages: number }>(
        `${API_BASE}/homework?${searchParams.toString()}`
      );
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    staleTime: 20 * 1000,
  });
}

export function useInfiniteExamScores(examId: string) {
  return useInfiniteQuery({
    queryKey: ['exam-scores', 'infinite', examId],
    queryFn: async ({ pageParam = 1 }) => {
      const searchParams = new URLSearchParams();
      searchParams.set('page', String(pageParam));
      searchParams.set('limit', '50');
      
      return fetchApi<{ data: unknown[]; total: number; page: number; totalPages: number }>(
        `${API_BASE}/exams/${examId}/scores?${searchParams.toString()}`
      );
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    staleTime: 30 * 1000,
    enabled: !!examId,
  });
}