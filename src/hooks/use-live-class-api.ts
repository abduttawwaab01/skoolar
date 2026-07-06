import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { offlineGateway } from '@/lib/offline/gateway';

const API_BASE = '/api/live-classes';

async function fetchJSON<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const result = await offlineGateway<T>(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers as Record<string, string> },
  });
  if ('fromCache' in result) {
    return result.data as T;
  }
  if ('queued' in result && result.queued) {
    return { _queued: true, _mutationId: result.mutationId } as T;
  }
  return result as T;
}

export function useLiveClasses(schoolId?: string, status?: string, enabled?: boolean) {
  const params = new URLSearchParams();
  if (schoolId) params.set('schoolId', schoolId);
  if (status) params.set('status', status);

  return useQuery<{ data: unknown[] }>({
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

export function useDeleteLiveClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      fetchJSON(`${API_BASE}/${id}`, { method: 'DELETE' }),
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
