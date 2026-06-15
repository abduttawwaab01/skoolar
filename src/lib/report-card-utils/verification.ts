import { randomBytes } from 'crypto';

export function generateVerificationToken(): string {
  return randomBytes(32).toString('hex');
}

export function generateShortUuid(): string {
  return randomBytes(8).toString('hex');
}

export function buildVerificationUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, '')}/report-cards/verify/${token}`;
}

export function buildDownloadUrl(baseUrl: string, reportCardId: string, token: string, format: 'pdf' | 'png'): string {
  return `${baseUrl.replace(/\/$/, '')}/api/report-cards/${reportCardId}/download?token=${token}&format=${format}`;
}

export interface VerificationResponse {
  valid: boolean;
  reportCardId?: string;
  studentName?: string;
  term?: string;
  session?: string;
  schoolName?: string;
  message: string;
}

export function createSecureAccessToken(reportCardId: string, studentId: string, secret: string): string {
  const data = `${reportCardId}:${studentId}:${secret}`;
  const buf = Buffer.from(data, 'utf-8');
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function verifySecureAccessToken(token: string, reportCardId: string, studentId: string, secret: string): boolean {
  try {
    const decoded = Buffer.from(token.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
    const expected = `${reportCardId}:${studentId}:${secret}`;
    return decoded === expected;
  } catch {
    return false;
  }
}
