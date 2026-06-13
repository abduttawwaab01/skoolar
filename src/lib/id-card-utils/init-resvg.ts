import { initWasm } from '@resvg/resvg-wasm';

let initPromise: Promise<void> | null = null;

async function tryLoadWasm(): Promise<void> {
  // Strategy 1: Node.js — try node_modules
  if (typeof process !== 'undefined' && process.versions?.node) {
    const path = await import('node:path');
    const fs = await import('node:fs');
    const candidates = [
      path.resolve(process.cwd(), 'node_modules', '@resvg', 'resvg-wasm', 'index_bg.wasm'),
      path.resolve(process.cwd(), '.next', 'server', 'chunks', 'resvg-wasm.wasm'),
      path.resolve(process.cwd(), '.next', 'server', 'node_modules', '@resvg', 'resvg-wasm', 'index_bg.wasm'),
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

  // Strategy 2: Browser / Edge — try CDN
  const urls = [
    'https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm',
    'https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm',
  ];
  for (const url of urls) {
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        await initWasm(resp);
        return;
      }
    } catch { /* try next */ }
  }

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
