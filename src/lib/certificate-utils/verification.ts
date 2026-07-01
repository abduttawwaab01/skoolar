export async function generateQRDataUrl(text: string): Promise<string> {
  try {
    const qrModule = await import('qrcode');
    return await qrModule.default.toDataURL(text, {
      width: 200,
      margin: 1,
      color: { dark: '#1a365d', light: '#ffffff' },
    });
  } catch {
    return generateQRFallbackSVG(text);
  }
}

function generateQRFallbackSVG(_text: string): string {
  const size = 80;
  const cells = 11;
  const cellSize = size / cells;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
  svg += `<rect width="${size}" height="${size}" fill="white" rx="2" />`;

  const positions = [
    [0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[7,0],
    [0,1],[7,1],[0,2],[7,2],[0,3],[3,3],[4,3],[7,3],
    [0,4],[3,4],[4,4],[7,4],[0,5],[7,5],[0,6],[7,6],
    [0,7],[1,7],[2,7],[3,7],[4,7],[5,7],[6,7],[7,7],
    [3,2],[4,2],[2,3],[5,3],[2,4],[5,4],
  ];

  for (const [x, y] of positions) {
    svg += `<rect x="${x * cellSize + 1}" y="${y * cellSize + 1}" width="${cellSize - 1}" height="${cellSize - 1}" fill="#1a365d" rx="0.5" />`;
  }

  svg += `</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export function buildVerificationUrl(verificationCode: string): string {
  if (typeof window === 'undefined') return `https://skoolar.app/verify/${verificationCode}`;
  return `${window.location.origin}/verify/${verificationCode}`;
}

export function generateCertificateNumber(index?: number): string {
  const year = new Date().getFullYear();
  const seq = index !== undefined
    ? String(index + 1).padStart(4, '0')
    : String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
  return `SKL-${year}-${seq}`;
}

export function generateVerificationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) result += '-';
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
