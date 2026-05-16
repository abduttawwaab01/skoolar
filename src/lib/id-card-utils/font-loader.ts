import fs from 'fs';
import path from 'path';

function isTrueType(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  const magic = buffer.readUInt32BE(0);
  return magic === 0x00010000 || magic === 0x74727565;
}

function isOpenType(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  return buffer.readUInt32BE(0) === 0x4F54544F;
}

function isWoff2(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  return buffer.readUInt32BE(0) === 0x774F4632;
}

function isWoff(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  return buffer.readUInt32BE(0) === 0x774F4646;
}

function findFontFile(name: string): string | null {
  const cwd = process.cwd();

  const candidates = [
    path.join(cwd, 'public', 'fonts', name),
    path.join(cwd, 'src', 'lib', 'id-card-utils', name),
    path.join(__dirname, name),
    path.join(__dirname, '..', 'id-card-utils', name),
    path.join(__dirname, '..', '..', '..', 'src', 'lib', 'id-card-utils', name),
    path.join(cwd, '.next', 'server', 'chunks', name),
    path.join(cwd, '.next', 'static', 'fonts', name),
  ];

  for (const fp of candidates) {
    try {
      if (fs.existsSync(fp)) {
        return fp;
      }
    } catch {
      // ignore
    }
  }

  return null;
}

export function getFontPaths(): string[] {
  const paths: string[] = [];
  const regularPath = findFontFile('Geist-Regular.ttf');
  if (regularPath) paths.push(regularPath);
  
  const boldPath = findFontFile('Geist-Bold.ttf');
  if (boldPath) paths.push(boldPath);
  
  return paths;
}

export function getFontFaceCSS(): string {
  const regularPath = findFontFile('Geist-Regular.ttf');
  const boldPath = findFontFile('Geist-Bold.ttf');

  let validRegularBuffer: Buffer | null = null;
  let validBoldBuffer: Buffer | null = null;

  if (regularPath) {
    try {
      const buf = fs.readFileSync(regularPath);
      if (isTrueType(buf) || isOpenType(buf)) {
        validRegularBuffer = buf;
        console.log(`[IDCard] Valid Regular font found: TrueType/OpenType (${buf.length} bytes)`);
      } else if (isWoff2(buf)) {
        console.warn(`[IDCard] Regular font is WOFF2 format (not supported for SVG embedding). Will use system fonts.`);
      } else if (isWoff(buf)) {
        console.warn(`[IDCard] Regular font is WOFF format (not supported for SVG embedding). Will use system fonts.`);
      } else {
        console.warn(`[IDCard] Regular font has unknown format. Magic bytes: ${buf.slice(0, 4).toString('hex')}. Will use system fonts.`);
      }
    } catch (err) {
      console.warn(`[IDCard] Failed to read Regular font:`, err);
    }
  }

  if (boldPath) {
    try {
      const buf = fs.readFileSync(boldPath);
      if (isTrueType(buf) || isOpenType(buf)) {
        validBoldBuffer = buf;
        console.log(`[IDCard] Valid Bold font found: TrueType/OpenType (${buf.length} bytes)`);
      } else if (isWoff2(buf)) {
        console.warn(`[IDCard] Bold font is WOFF2 format (not supported for SVG embedding). Will fall back to Regular or system fonts.`);
      } else if (isWoff(buf)) {
        console.warn(`[IDCard] Bold font is WOFF format (not supported for SVG embedding). Will fall back to Regular or system fonts.`);
      } else {
        console.warn(`[IDCard] Bold font has unknown format. Magic bytes: ${buf.slice(0, 4).toString('hex')}. Will use system fonts.`);
      }
    } catch (err) {
      console.warn(`[IDCard] Failed to read Bold font:`, err);
    }
  }

  if (!validRegularBuffer && !validBoldBuffer) {
    console.log('[IDCard] No valid TrueType/OpenType fonts found. Using system font stack (most reliable).');
    return '';
  }

  try {
    let css = '';

    if (validRegularBuffer) {
      const b64 = validRegularBuffer.toString('base64');
      css += `
@font-face {
  font-family: 'SkoolarCard';
  src: url(data:font/truetype;base64,${b64}) format('truetype');
  font-weight: 400;
  font-style: normal;
}`;
    }

    const boldSource = validBoldBuffer || validRegularBuffer;
    if (boldSource) {
      const b64 = boldSource.toString('base64');
      css += `
@font-face {
  font-family: 'SkoolarCard';
  src: url(data:font/truetype;base64,${b64}) format('truetype');
  font-weight: 700;
  font-style: normal;
}`;
    }

    return css;
  } catch (err) {
    console.error('[IDCard] Failed to embed font CSS:', err);
    return '';
  }
}
