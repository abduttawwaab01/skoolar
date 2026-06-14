export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '';
  try {
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(d || '');
  }
}

export function fmtDateShort(d: string | Date | null | undefined): string {
  if (!d) return '';
  try {
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
    });
  } catch {
    return String(d || '');
  }
}

export function esc(s: unknown): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function n(v: number): string {
  return String(Math.round(v));
}

export function adj(c: string, a: number): string {
  const h = c.replace('#', '');
  const cl = (x: number) => Math.max(0, Math.min(255, x));
  const rv = cl(parseInt(h.slice(0, 2), 16) + a);
  const gv = cl(parseInt(h.slice(2, 4), 16) + a);
  const bv = cl(parseInt(h.slice(4, 6), 16) + a);
  return `#${rv.toString(16).padStart(2, '0')}${gv.toString(16).padStart(2, '0')}${bv.toString(16).padStart(2, '0')}`;
}

export function contrast(bg: string): string {
  const h = bg.replace('#', '');
  const lum = (0.299 * parseInt(h.slice(0, 2), 16) + 0.587 * parseInt(h.slice(2, 4), 16) + 0.114 * parseInt(h.slice(4, 6), 16)) / 255;
  return lum > 0.55 ? '#1a1a1a' : '#ffffff';
}

export function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

export function rtlAttr(text: string): string {
  return hasArabic(text) ? ' direction="rtl" unicode-bidi="bidi-override"' : '';
}

export function wrapToLines(text: string, maxChars: number): string[] {
  if (!text || text.length <= maxChars) return [text];
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? line + ' ' + word : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.flatMap((l) =>
    l.length > maxChars
      ? l.match(new RegExp(`.{1,${maxChars}}`, 'g')) || [l]
      : [l]
  );
}

export function fitName(
  text: string,
  maxWidthChars: number,
  baseFs: number,
  minFs: number
): { lines: string[]; fontSize: number } {
  if (!text) return { lines: ['Unknown'], fontSize: baseFs };
  for (let fs = baseFs; fs >= minFs; fs -= 2) {
    const charsPerLine = Math.max(Math.round(maxWidthChars * (baseFs / fs)), 8);
    const lines = wrapToLines(text, charsPerLine);
    if (lines.length <= 2) return { lines, fontSize: fs };
  }
  const charsPerLine = Math.max(Math.round(maxWidthChars * (baseFs / minFs)), 8);
  return { lines: wrapToLines(text, charsPerLine), fontSize: minFs };
}

export function renderWrapped(
  x: number,
  y: number,
  fontSize: number,
  color: string,
  lines: string[],
  anchor: string,
  rtl: string,
  lineGap: number
): string {
  return lines
    .map(
      (l, i) =>
        `<text x="${n(x)}" y="${n(y + i * (fontSize + lineGap))}" font-size="${n(fontSize)}" font-weight="700" fill="${color}" text-anchor="${anchor}"${rtl}>${esc(l)}</text>`
    )
    .join('\n');
}

export function parseBackText(
  text: string,
  name: string,
  id: string,
  company: string
): string {
  if (!text) return '';
  return text
    .replace(/\{name\}/gi, name)
    .replace(/\{id\}/gi, id)
    .replace(/\{company\}/gi, company);
}
