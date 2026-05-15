import fs from 'fs';
import path from 'path';

let _fontFaceCSS: string | null = null;

function findFontFile(name: string): string | null {
  const base = process.cwd();
  const candidates = [
    path.join(__dirname, name),
    path.join(base, 'src', 'lib', 'id-card-utils', name),
    path.join(base, 'public', 'fonts', name),
    path.join(base, '.next', 'server', 'chunks', `src_lib_id-card-utils_${name.replace('.', '_')}`),
    path.join(base, 'node_modules', 'next', 'dist', 'compiled', '@vercel', 'og', name),
  ];

  for (const fp of candidates) {
    try {
      if (fs.existsSync(fp)) return fp;
    } catch {}
  }
  return null;
}

export function getFontFaceCSS(): string {
  if (_fontFaceCSS) return _fontFaceCSS;

  const regularPath = findFontFile('Geist-Regular.ttf');
  const boldPath = findFontFile('Geist-Bold.ttf');

  if (!regularPath && !boldPath) {
    _fontFaceCSS = '';
    return '';
  }

  try {
    let css = '';
    if (regularPath) {
      const data = fs.readFileSync(regularPath);
      const b64 = data.toString('base64');
      css += `
@font-face {
  font-family: 'SkoolarCard';
  src: url(data:font/ttf;base64,${b64}) format('truetype');
  font-weight: normal;
  font-style: normal;
}`;
    }
    if (boldPath) {
      const data = fs.readFileSync(boldPath);
      const b64 = data.toString('base64');
      css += `
@font-face {
  font-family: 'SkoolarCard';
  src: url(data:font/ttf;base64,${b64}) format('truetype');
  font-weight: bold;
  font-style: normal;
}`;
    } else if (regularPath) {
      css += `
@font-face {
  font-family: 'SkoolarCard';
  src: url(data:font/ttf;base64,${fs.readFileSync(regularPath).toString('base64')}) format('truetype');
  font-weight: bold;
  font-style: normal;
}`;
    }
    _fontFaceCSS = css;
  } catch {
    _fontFaceCSS = '';
  }

  return _fontFaceCSS;
}
