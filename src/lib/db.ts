import { PrismaClient } from '@prisma/client';

// ============================================
// Prisma Client — Dual Mode
// ============================================
// Mode 1 (DEFAULT) — Standard Node.js PrismaClient
//   Works everywhere: local dev, Oracle VM, Vercel, any Node.js host.
//   Uses TCP connections — requires DIRECT database access (no HTTP proxy).
//
// Mode 2 — Neon Serverless Adapter (DATABASE_PROVIDER=neon)
//   For Cloudflare Workers / edge runtimes that lack TCP socket support.
//   Uses HTTP via @prisma/adapter-neon + @neondatabase/serverless.
//   Falls back to standard client if adapter import fails.
//
// Choose via DATABASE_PROVIDER env var:
//   DATABASE_PROVIDER=neon   → edge-compatible HTTP driver
//   DATABASE_PROVIDER=pg     → standard PrismaClient (default)

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
};

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const provider = (process.env.DATABASE_PROVIDER || 'pg').toLowerCase();

  if (provider === 'neon') {
    try {
      // Dynamic import so the Neon packages are optional at build time
      const { PrismaNeon } = require('@prisma/adapter-neon') as typeof import('@prisma/adapter-neon');
      const adapter = new PrismaNeon({ connectionString: databaseUrl });
      return new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : [],
      });
    } catch {
      console.warn('[DB] Neon adapter not available, falling back to standard PrismaClient');
    }
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : [],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
