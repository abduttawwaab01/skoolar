let initPromise: Promise<void> | null = null;
const WASM_FETCH_TIMEOUT_MS = 15_000;

async function tryLoadWasm(): Promise<void> {
  const resvgPkg = '@resvg/resvg-' + 'wasm';
  const { initWasm } = await import(resvgPkg);

  // Strategy 1: Next.js post-build WASM copy location
  if (typeof process !== 'undefined' && process.versions?.node) {
    const path = await import('node:path');
    const fs = await import('node:fs');
    const cwd = process.cwd();
    const candidates = [
      // Post-build copy to server chunks
      path.resolve(cwd, '.next', 'server', 'chunks', 'index_bg.wasm'),
      // Standalone / Vercel
      path.resolve(cwd, '.next', 'server', 'chunks', 'resvg-wasm.wasm'),
      // Dev: directly from node_modules
      path.resolve(cwd, 'node_modules', '@resvg', 'resvg-wasm', 'index_bg.wasm'),
      // Alternate Next.js build output locations
      path.resolve(cwd, '.next', 'server', 'node_modules', '@resvg', 'resvg-wasm', 'index_bg.wasm'),
      path.resolve(__dirname, '..', '..', '..', 'node_modules', '@resvg', 'resvg-wasm', 'index_bg.wasm'),
      // Standalone output mode
      path.resolve(cwd, '.next', 'standalone', 'node_modules', '@resvg', 'resvg-wasm', 'index_bg.wasm'),
      // AWS Lambda / serverless
      path.resolve(process.env.LAMBDA_TASK_ROOT || '', 'node_modules', '@resvg', 'resvg-wasm', 'index_bg.wasm'),
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

  // Strategy 3: CDN fallback with timeout
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

  console.error('resvg WASM initialization failed. Attempted: filesystem paths and CDN.');
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
