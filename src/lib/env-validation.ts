import { z } from 'zod';

const requiredEnvVars = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),
  PAYSTACK_SECRET_KEY: z.string().min(1),
  PAYSTACK_PUBLIC_KEY: z.string().min(1),
});

const optionalEnvVars = z.object({
  DIRECT_URL: z.string().url().optional(),
  
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPER_ADMIN_EMAIL: z.string().email().optional(),
  NEXT_PUBLIC_CDN_URL: z.string().url().optional(),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  
  SUPER_ADMIN_USERNAME: z.string().optional(),
  SUPER_ADMIN_EMAIL: z.string().email().optional(),
  SUPER_ADMIN_NAME: z.string().optional(),
  
  R2_BUCKET_NAME: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().url().optional(),
  
  EMAIL_SERVER_HOST: z.string().optional(),
  EMAIL_SERVER_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  EMAIL_FROM: z.string().email().optional(),
  RESEND_API_KEY: z.string().optional(),
  
  GOOGLE_SHEET_URL: z.string().url().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
  PAYSTACK_MODE: z.enum(['test', 'live']).optional(),
  INITIAL_ADMIN_PASSWORD: z.string().min(8).optional(),
  
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
});

export function validateEnv() {
  const isBuildTime = process.env.NEXT_TELEMETRY_DISABLED === '1' && process.argv.includes('next');
  
  const result = requiredEnvVars.safeParse(process.env);
  if (!result.success) {
    if (isBuildTime) {
      console.warn('⚠️  Build-time: some required env vars are missing (will be provided at runtime)');
      return null;
    }
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
