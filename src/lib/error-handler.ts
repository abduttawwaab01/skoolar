import { toast } from 'sonner';

export function handleError(error: unknown, context?: string) {
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  console.error(`[Error${context ? `: ${context}` : ''}]`, error);
  toast.error(context ? `${context}: ${message}` : message);
}

export function handleSilentError(error: unknown, context?: string) {
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  console.error(`[Silent Error${context ? `: ${context}` : ''}]`, error);
}
