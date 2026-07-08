import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'skoolar';

const ALLOWED_ORIGINS = [
  process.env.NEXTAUTH_URL || 'https://www.skoolar.org',
  'http://localhost:3000',
].filter(Boolean) as string[];

async function main() {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    console.error('Missing R2 credentials. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in .env');
    process.exit(1);
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  const corsConfig = {
    CORSRules: [
      {
        AllowedOrigins: ALLOWED_ORIGINS,
        AllowedMethods: ['GET', 'HEAD'],
        AllowedHeaders: ['Content-Type'],
        ExposeHeaders: ['Access-Control-Allow-Origin', 'ETag'],
        MaxAgeSeconds: 3600,
      },
    ],
  };

  try {
    const command = new PutBucketCorsCommand({
      Bucket: R2_BUCKET_NAME,
      CORSConfiguration: corsConfig,
    });
    await client.send(command);
    console.log(`✅ CORS configured for bucket "${R2_BUCKET_NAME}"`);
    console.log(`   Origins allowed: ${ALLOWED_ORIGINS.join(', ')}`);
    console.log(`   Methods: GET, HEAD`);
  } catch (error) {
    console.error('❌ Failed to set CORS:', error);
    process.exit(1);
  }
}

main();
