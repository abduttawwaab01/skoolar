import { z } from 'zod';

const requiredEnvVars = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  
  // Auth
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),
  
  // Payments
  PAYSTACK_SECRET_KEY: z.string().min(1),
  PAYSTACK_PUBLIC_KEY: z.string().min(1),
  
  // AI (required for production)
  OPENROUTER_API_KEY: z.string().min(1),
  
  // Storage
  R2_BUCKET_NAME: z.string().min(1),
  NEXT_PUBLIC_CDN_URL: z.string().url(),
  
  // Push notifications (if used in production)
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1),
  VAPID_PRIVATE_KEY: z.string().min(1),
  VAPID_SUBJECT: z.string().email(),
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
  // Rate limiting (Upstash Redis)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
});

export function validateEnv() {
  const result = requiredEnvVars.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Missing required environment variables:');
    result.error.issues.forEach(issue => {
      console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
    });
    throw new Error('Invalid environment configuration');
  }
  
  const optionalResult = optionalEnvVars.safeParse(process.env);
  if (!optionalResult.success) {
    console.warn('⚠️  Optional environment variable issues:');
    optionalResult.error.issues.forEach(issue => {
      console.warn(`   - ${issue.path.join('.')}: ${issue.message}`);
    });
  }
  
  console.log('✅ Environment validation passed');
  return result.data;
}

// Export individual getters with defaults where safe
export const getEnv = <T extends keyof z.infer<typeof requiredEnvVars>>(key: T): z.infer<typeof requiredEnvVars>[T] => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value as z.infer<typeof requiredEnvVars>[T];
};

export const getOptionalEnv = <T extends keyof z.infer<typeof optionalEnvVars>>(
  key: T, 
  defaultValue?: z.infer<typeof optionalEnvVars>[T]
): z.infer<typeof optionalEnvVars>[T] | undefined => {
  return (process.env[key] as z.infer<typeof optionalEnvVars>[T]) ?? defaultValue;
};
