export async function clearAllOfflineCaches(): Promise<void> {
  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHES' });
    }
  } catch {}
  try {
    if ('indexedDB' in window) {
      const dbs = await indexedDB.databases?.() ?? [];
      for (const db of dbs) {
        if (db.name && db.name.startsWith('skoolar')) {
          indexedDB.deleteDatabase(db.name);
        }
      }
    }
  } catch {}
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && (key.startsWith('skoolar') || key.includes('skoolar') || key.startsWith('next-auth') || key.startsWith('__') || key === 'auth-storage')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => window.localStorage.removeItem(k));
    }
  } catch {}
}

export function logoutWithCacheCleanup(targetUrl: string): void {
  clearAllOfflineCaches().finally(() => {
    window.location.href = targetUrl;
  });
}
