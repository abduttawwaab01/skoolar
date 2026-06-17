import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { GEIST_REGULAR_BASE64, GEIST_BOLD_BASE64, GEIST_FONT_FAMILY } from '@/lib/id-card-utils/geist-font-data';
import { ARABIC_FONT_BASE64, ARABIC_FONT_FAMILY } from '@/lib/id-card-utils/arabic-font-data';

let fontFiles: string[] | null = null;
let tmpDir: string | null = null;

export function getFontFiles(): string[] {
  if (fontFiles) return fontFiles;
  tmpDir = mkdtempSync(join(tmpdir(), 'skoolar-fonts-'));
  const geistPath = join(tmpDir, 'Geist-Regular.ttf');
  const geistBoldPath = join(tmpDir, 'Geist-Bold.ttf');
  const arabicPath = join(tmpDir, 'NotoNaskhArabic-Regular.ttf');
  writeFileSync(geistPath, Buffer.from(GEIST_REGULAR_BASE64, 'base64'));
  writeFileSync(geistBoldPath, Buffer.from(GEIST_BOLD_BASE64, 'base64'));
  writeFileSync(arabicPath, Buffer.from(ARABIC_FONT_BASE64, 'base64'));
  fontFiles = [geistPath, geistBoldPath, arabicPath];
  return fontFiles;
}
