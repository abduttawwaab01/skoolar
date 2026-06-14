import QRCode from 'qrcode';

export interface QRCardData {
  type: string;
  userId: string;
  personId: string;
  schoolId: string;
  cardId?: string;
  uuid: string;
  validationToken: string;
  name: string;
  role: string;
}

export async function generateQRBuffer(
  data: QRCardData,
  color: string = '#059669',
  size: number = 480
): Promise<Buffer> {
  try {
    const payload = JSON.stringify({
      v: 2,
      t: data.type,
      uid: data.userId,
      pid: data.personId,
      sid: data.schoolId,
      cid: data.cardId || '',
      u: data.uuid,
      tk: data.validationToken.slice(0, 8),
      n: data.name,
      r: data.role,
    });
    return await QRCode.toBuffer(payload, {
      width: size,
      margin: 1,
      color: { dark: color, light: '#ffffff' },
      errorCorrectionLevel: 'H',
    });
  } catch {
    return Buffer.alloc(0);
  }
}

export async function generateQRBase64(
  data: QRCardData,
  color: string = '#059669',
  size: number = 480
): Promise<string> {
  try {
    const buf = await generateQRBuffer(data, color, size);
    return buf.toString('base64');
  } catch {
    return '';
  }
}

export async function generateQRDataUrl(
  data: QRCardData,
  color: string = '#059669',
  size: number = 300
): Promise<string> {
  try {
    const payload = JSON.stringify({
      v: 2,
      t: data.type,
      uid: data.userId,
      pid: data.personId,
      sid: data.schoolId,
      cid: data.cardId || '',
      u: data.uuid,
      tk: data.validationToken.slice(0, 8),
      n: data.name,
      r: data.role,
    });
    return await QRCode.toDataURL(payload, {
      width: size,
      margin: 1,
      color: { dark: color, light: '#ffffff' },
      errorCorrectionLevel: 'H',
    });
  } catch {
    return '';
  }
}

export function parseQRData(
  raw: string
): QRCardData | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.u) return null;
    return {
      type: parsed.t || 'student',
      userId: parsed.uid || '',
      personId: parsed.pid || '',
      schoolId: parsed.sid || '',
      cardId: parsed.cid || '',
      uuid: parsed.u || '',
      validationToken: parsed.tk || '',
      name: parsed.n || '',
      role: parsed.r || '',
    };
  } catch {
    return null;
  }
}

export function buildVerificationUrl(
  baseUrl: string,
  uuid: string
): string {
  return `${baseUrl.replace(/\/$/, '')}/verify/${uuid}`;
}

export function buildAttendanceUrl(
  baseUrl: string,
  uuid: string
): string {
  return `${baseUrl.replace(/\/$/, '')}/api/id-cards/scan?uuid=${uuid}`;
}
