import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api/live-classes';

async function fetchJSON(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export function useLiveClasses(schoolId?: string, status?: string, enabled?: boolean) {
  const params = new URLSearchParams();
  if (schoolId) params.set('schoolId', schoolId);
  if (status) params.set('status', status);

  return useQuery({
    queryKey: ['live-classes', { schoolId, status }],
    queryFn: () => fetchJSON(`${API_BASE}?${params}`),
    enabled: enabled !== undefined ? enabled : !!schoolId,
  });
}

export function useLiveClass(id: string) {
  return useQuery({
    queryKey: ['live-class', id],
    queryFn: () => fetchJSON(`${API_BASE}/${id}`),
    enabled: !!id,
  });
}

export function useCreateLiveClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) =>
      fetchJSON(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-classes'] });
    },
  });
}

export function useEndLiveClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      fetchJSON(`${API_BASE}/${id}/end`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-classes'] });
    },
  });
}

export function useLiveClassMessages(liveClassId: string) {
  return useQuery({
    queryKey: ['live-class-chat', liveClassId],
    queryFn: () => fetchJSON(`${API_BASE}/${liveClassId}/chat`),
    enabled: !!liveClassId,
    refetchInterval: 5000,
  });
}

export function useLiveClassPolls(liveClassId: string) {
  return useQuery({
    queryKey: ['live-class-polls', liveClassId],
    queryFn: () => fetchJSON(`${API_BASE}/${liveClassId}/polls`),
    enabled: !!liveClassId,
    refetchInterval: 3000,
  });
}
