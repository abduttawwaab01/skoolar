import { initWasm } from '@resvg/resvg-wasm';

let initPromise: Promise<void> | null = null;
const WASM_FETCH_TIMEOUT_MS = 10_000;

async function tryLoadWasm(): Promise<void> {
  // Strategy 1: Node.js — try local paths
  if (typeof process !== 'undefined' && process.versions?.node) {
    const path = await import('node:path');
    const fs = await import('node:fs');
    const cwd = process.cwd();
    const candidates = [
      // Dev: directly from node_modules
      path.resolve(cwd, 'node_modules', '@resvg', 'resvg-wasm', 'index_bg.wasm'),
      // Standalone / Vercel: WASM bundled in server chunks
      path.resolve(cwd, '.next', 'server', 'chunks', 'index_bg.wasm'),
      path.resolve(cwd, '.next', 'server', 'chunks', 'resvg-wasm.wasm'),
      // Alternate Next.js build output locations
      path.resolve(cwd, '.next', 'server', 'node_modules', '@resvg', 'resvg-wasm', 'index_bg.wasm'),
      path.resolve(__dirname, '..', '..', '..', 'node_modules', '@resvg', 'resvg-wasm', 'index_bg.wasm'),
    ];
    for (const wasmPath of candidates) {
      try {
        if (fs.existsSync(wasmPath)) {
          const wasmBuffer = fs.readFileSync(wasmPath);
          await initWasm(new Uint8Array(wasmBuffer));
          return;
        }
      } catch { /* try next */ }
    }
  }

  // Strategy 2: Browser / Edge — try CDN with timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WASM_FETCH_TIMEOUT_MS);
  const urls = [
    'https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm',
    'https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm',
  ];
  for (const url of urls) {
    try {
      const resp = await fetch(url, { signal: controller.signal });
      if (resp.ok) {
        clearTimeout(timeout);
        await initWasm(resp);
        return;
      }
    } catch { /* try next */ }
  }
  clearTimeout(timeout);

  throw new Error('Could not load resvg WASM from any source');
}

export function ensureResvgInit(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = tryLoadWasm().catch((err) => {
    initPromise = null;
    throw err;
  });
  return initPromise;
}
