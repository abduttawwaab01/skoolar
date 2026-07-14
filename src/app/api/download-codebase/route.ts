import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { execSync } from 'child_process';
import fs from 'fs';

export async function GET(request: NextRequest) {
  try {
    // BLOCK in production — this endpoint exposes source code
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Not available' }, { status: 404 });
    }

    // Verify SUPER_ADMIN authentication
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token || token.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized. Super Admin access required.' }, { status: 401 });
    }

    const projectRoot = process.cwd();

    // Use timestamp-based filename to prevent any caching
    const timestamp = Date.now();
    const zipPath = `/tmp/skoolar-codebase-${timestamp}.zip`;

    // Create zip using system zip - always reads fresh from disk
    execSync(
      `cd "${projectRoot}" && zip -r "${zipPath}" src/ prisma/ package.json next.config.ts next.config.mjs tsconfig.json postcss.config.mjs tailwind.config.ts .env.example public/ middleware.ts -x "src/node_modules/*" "src/.next/*" 2>/dev/null`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );

    if (!fs.existsSync(zipPath)) {
      return NextResponse.json({ error: 'Failed to create zip file.' }, { status: 500 });
    }

    const fileBuffer = fs.readFileSync(zipPath);
    const dateStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toISOString().split('T')[1].replace(/:/g, '-').split('.')[0];
    const fileName = `skoolar-codebase-${dateStr}-${timeStr}.zip`;

    // Clean up temp file
    try {
      fs.unlinkSync(zipPath);
    } catch {
      // Ignore cleanup errors
    }

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
        'ETag': `"${timestamp}"`,
        'X-Accel-Expires': '0',
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: 'Failed to generate download.' }, { status: 500 });
  }
}
