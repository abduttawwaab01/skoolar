import { z } from 'zod';

// These variables have sensible defaults or are only needed at runtime.
// Vercel injects env vars at runtime, NOT during the build step.
// Therefore this validation MUST NOT run during `next build`.

const requiredEnvVars = z.object({
  DATABASE_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(32).optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  PAYSTACK_SECRET_KEY: z.string().min(1).optional(),
  PAYSTACK_PUBLIC_KEY: z.string().min(1).optional(),
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  R2_BUCKET_NAME: z.string().min(1).optional(),
  NEXT_PUBLIC_CDN_URL: z.string().url().optional(),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().min(1).optional(),
});

const optionalEnvVars = z.object({
  EMAIL_SERVER_HOST: z.string().optional(),
  EMAIL_SERVER_PORT: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  RESEND_API_KEY: z.string().optional(),
  GOOGLE_SHEET_URL: z.string().url().optional(),
  OPENROUTER_BASE_URL: z.string().url().optional(),
  PAYSTACK_MODE: z.enum(['test', 'live']).optional(),
  INITIAL_ADMIN_PASSWORD: z.string().min(8).optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
});

/**
 * Validate environment variables at RUNTIME only.
 * This function should be called from middleware or API routes,
 * NEVER at module evaluation time (which runs during `next build`).
 */
export function validateEnv() {
  // Skip validation during build — env vars are not available yet on Vercel
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return;
  }

  const result = requiredEnvVars.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues
      .map(issue => issue.path.join('.'))
      .filter(Boolean);

    if (missing.length > 0) {
      console.error('❌ Missing required environment variables:');
      missing.forEach(v => console.error(`   - ${v}`));
      console.error('');
      console.error('Add these in Vercel Dashboard → Project Settings → Environment Variables');
      console.error('or copy .env.example to .env for local development.');
      // Only throw in production runtime, not during build
      if (process.env.NODE_ENV === 'production' && process.env.VERCEL !== '1') {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
      }
    }
  }

  const optionalResult = optionalEnvVars.safeParse(process.env);
  if (!optionalResult.success) {
    console.warn('⚠️  Optional environment variable issues:');
    optionalResult.error.issues.forEach(issue => {
      console.warn(`   - ${issue.path.join('.')}: ${issue.message}`);
    });
  }
}

/**
 * Check if critical env vars are available for a specific feature.
 * Returns true if all specified keys have non-empty values.
 */
export function checkFeatureEnv(keys: string[]): boolean {
  return keys.every(key => !!process.env[key]);
}

// Export individual getters with defaults where safe
export const getEnv = <T extends keyof z.infer<typeof requiredEnvVars>>(key: T): z.infer<typeof requiredEnvVars>[T] | undefined => {
  return process.env[key] as z.infer<typeof requiredEnvVars>[T] | undefined;
};

export const getOptionalEnv = <T extends keyof z.infer<typeof optionalEnvVars>>(
  key: T,
  defaultValue?: z.infer<typeof optionalEnvVars>[T]
): z.infer<typeof optionalEnvVars>[T] | undefined => {
  return (process.env[key] as z.infer<typeof optionalEnvVars>[T]) ?? defaultValue;
};
