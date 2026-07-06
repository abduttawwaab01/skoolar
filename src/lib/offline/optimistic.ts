import type { QueryClient } from '@tanstack/react-query';

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

export interface OptimisticContext<T = unknown> {
  previousData: T | undefined;
  queryKey: unknown[];
}

export async function optimisticCreate<T extends { data?: unknown[] }>(
  queryClient: QueryClient,
  queryKey: unknown[],
  newItem: unknown,
): Promise<OptimisticContext<T>> {
  await queryClient.cancelQueries({ queryKey });
  const previousData = queryClient.getQueryData<T>(queryKey);
  if (previousData) {
    const prevData = previousData as { data: unknown[] };
    if (Array.isArray(prevData.data)) {
      const optimisticItem = {
        ...(newItem as Record<string, unknown>),
        id: `opt-${Date.now()}`,
        _optimistic: true,
      };
      queryClient.setQueryData<T>(queryKey, {
        ...previousData,
        data: [...prevData.data, optimisticItem],
      } as T);
    }
  }
  return { previousData, queryKey };
}

export async function optimisticUpdate<T extends { data?: unknown[] }>(
  queryClient: QueryClient,
  queryKey: unknown[],
  id: string,
  updates: unknown,
): Promise<OptimisticContext<T>> {
  await queryClient.cancelQueries({ queryKey });
  const previousData = queryClient.getQueryData<T>(queryKey);
  if (previousData) {
    const prevData = previousData as { data: unknown[] };
    if (Array.isArray(prevData.data)) {
      const updatedData = prevData.data.map((item) => {
        const record = item as Record<string, unknown>;
        return record.id === id ? { ...record, ...(updates as Record<string, unknown>), _optimistic: true } : item;
      });
      queryClient.setQueryData<T>(queryKey, {
        ...previousData,
        data: updatedData,
      } as T);
    }
  }
  return { previousData, queryKey };
}

export async function optimisticDelete<T extends { data?: unknown[] }>(
  queryClient: QueryClient,
  queryKey: unknown[],
  id: string,
): Promise<OptimisticContext<T>> {
  await queryClient.cancelQueries({ queryKey });
  const previousData = queryClient.getQueryData<T>(queryKey);
  if (previousData) {
    const prevData = previousData as { data: unknown[] };
    if (Array.isArray(prevData.data)) {
      const filteredData = prevData.data.filter((item) => {
        const record = item as Record<string, unknown>;
        return record.id !== id;
      });
      queryClient.setQueryData<T>(queryKey, {
        ...previousData,
        data: filteredData,
      } as T);
    }
  }
  return { previousData, queryKey };
}

export function rollbackOptimistic<T>(
  queryClient: QueryClient,
  context: OptimisticContext<T> | undefined,
): void {
  if (context?.previousData) {
    queryClient.setQueryData(context.queryKey, context.previousData);
  }
}
