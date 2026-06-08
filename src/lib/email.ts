import { Resend } from 'resend';
import nodemailer from 'nodemailer';

// ============================================
// Email — Dual Provider
// ============================================
// Provider 1 (DEFAULT) — Resend API (EMAIL_PROVIDER=resend)
//   Uses the Resend REST API. Requires RESEND_API_KEY.
//
// Provider 2 — SMTP (EMAIL_PROVIDER=smtp)
//   Uses generic SMTP (works with Postfix, Gmail, Mailgun, SendGrid SMTP).
//   Configure via EMAIL_SERVER_HOST, EMAIL_SERVER_PORT, EMAIL_FROM,
//   EMAIL_SERVER_USER, EMAIL_SERVER_PASSWORD.
//
// Provider 3 — Log only (EMAIL_PROVIDER=log)
//   Logs emails to console — useful for development.

let resend: Resend | undefined;
let smtpTransport: nodemailer.Transporter | undefined;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

function getSmtpTransport(): nodemailer.Transporter | null {
  if (smtpTransport) return smtpTransport;
  const host = process.env.EMAIL_SERVER_HOST;
  if (!host) return null;
  smtpTransport = nodemailer.createTransport({
    host,
    port: parseInt(process.env.EMAIL_SERVER_PORT || '587', 10),
    secure: process.env.EMAIL_SERVER_SECURE === 'true',
    auth: process.env.EMAIL_SERVER_USER
      ? { user: process.env.EMAIL_SERVER_USER, pass: process.env.EMAIL_SERVER_PASSWORD || '' }
      : undefined,
    tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
  });
  return smtpTransport;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; error?: string; data?: unknown }> {
  const provider = (process.env.EMAIL_PROVIDER || 'resend').toLowerCase();
  const from = options.from || process.env.EMAIL_FROM || 'noreply@skoolar.org';

  try {
    if (provider === 'log') {
      console.log('[EMAIL LOG]', { from, to: options.to, subject: options.subject });
      return { success: true };
    }

    if (provider === 'smtp') {
      const transport = getSmtpTransport();
      if (!transport) {
        return { success: false, error: 'SMTP not configured. Set EMAIL_SERVER_HOST.' };
      }
      await transport.sendMail({
        from,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      return { success: true };
    }

    // Default: Resend API
    const resendClient = getResend();
    if (!resendClient) {
      return { success: false, error: 'Email service not configured. Set RESEND_API_KEY or EMAIL_PROVIDER=smtp.' };
    }

    const result = await resendClient.emails.send({
      from,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
    } as any);

    if ('error' in result && result.error) {
      console.error('Email sending failed:', result.error);
      return { success: false, error: result.error.message };
    }

    return { success: true, data: 'data' in result ? result.data : undefined };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error('Email sending exception:', err);
    return { success: false, error };
  }
}

export function createPasswordResetEmail(name?: string, resetUrl?: string) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Reset Password - Skoolar</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb; }
          .container { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #f0f0f0; }
          .logo { font-size: 24px; font-weight: bold; color: #059669; }
          .content { margin: 30px 0; }
          .button { display: inline-block; padding: 12px 30px; background: #059669; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 15px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #f0f0f0; font-size: 12px; color: #666; text-align: center; }
          .url-box { background: #f3f4f6; padding: 12px; border-radius: 6px; word-break: break-all; font-family: monospace; font-size: 12px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Skoolar</div>
            <p style="color: #666; margin-top: 5px;">Education Management Platform</p>
          </div>
          <div class="content">
            <h2>Hello ${name || 'User'},</h2>
            <p>You requested a password reset. Click the button below to set a new password. This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
            <p><strong>Reset Password:</strong></p>
            <a class="button" href="${resetUrl}">Reset Your Password</a>
            <p><small>Or copy this link:</small></p>
            <div class="url-box">${resetUrl}</div>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Skoolar. All rights reserved.</p>
            <p>If you did not request this email, please ignore it.</p>
          </div>
        </div>
      </body>
    </html>
  `;
  return { subject: 'Reset Your Password - Skoolar', html };
}

export function createEmailVerificationEmail(name?: string, verifyUrl?: string) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Verify Email - Skoolar</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb; }
          .container { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #f0f0f0; }
          .logo { font-size: 24px; font-weight: bold; color: #059669; }
          .content { margin: 30px 0; }
          .button { display: inline-block; padding: 12px 30px; background: #059669; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 15px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #f0f0f0; font-size: 12px; color: #666; text-align: center; }
          .url-box { background: #f3f4f6; padding: 12px; border-radius: 6px; word-break: break-all; font-family: monospace; font-size: 12px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Skoolar</div>
            <p style="color: #666; margin-top: 5px;">Education Management Platform</p>
          </div>
          <div class="content">
            <h2>Hello ${name || 'User'},</h2>
            <p>Please verify your email address by clicking the button below. This link will expire in 24 hours.</p>
            <p>If you didn't request this, please ignore this email.</p>
            <p><strong>Verify Email:</strong></p>
            <a class="button" href="${verifyUrl}">Verify Email Address</a>
            <p><small>Or copy this link:</small></p>
            <div class="url-box">${verifyUrl}</div>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Skoolar. All rights reserved.</p>
            <p>If you did not request this email, please ignore it.</p>
          </div>
        </div>
      </body>
    </html>
  `;
  return { subject: 'Verify Your Email - Skoolar', html };
}

export async function sendVerificationEmail(options: { to: string; name?: string; verifyUrl: string }) {
  const { to, name, verifyUrl } = options;
  const { subject, html } = createEmailVerificationEmail(name, verifyUrl);
  return sendEmail({ to, subject, html });
}

export function createAdmissionLetterEmail(
  recipientName: string,
  schoolName: string,
  letterType: 'admission' | 'offer',
  letterUrl: string,
) {
  const typeLabel = letterType === 'admission' ? 'Admission Offer' : 'Employment Offer';
  const subject = `${typeLabel} - ${schoolName}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8" /></head>
    <body style="font-family:Arial,sans-serif;padding:20px;max-width:600px;margin:0 auto">
      <div style="background:#059669;padding:20px;text-align:center;border-radius:8px 8px 0 0">
        <h1 style="color:white;margin:0;font-size:20px">${schoolName}</h1>
      </div>
      <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <p style="font-size:16px;color:#333">Dear ${recipientName},</p>
        <p style="font-size:14px;color:#555;line-height:1.6">
          Congratulations! Your ${letterType === 'admission' ? 'admission offer letter' : 'letter of employment'} from <strong>${schoolName}</strong> is ready.
        </p>
        <p style="font-size:14px;color:#555;line-height:1.6">
          Please click the button below to view and download your letter.
        </p>
        <div style="text-align:center;margin:24px 0">
          <a href="${letterUrl}" style="display:inline-block;background:#059669;color:white;padding:12px 32px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:600">
            View ${typeLabel} Letter
          </a>
        </div>
        <p style="font-size:13px;color:#888;line-height:1.5">
          If you have any questions, please contact the school administration.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
        <p style="font-size:12px;color:#aaa;text-align:center">
          This email was sent by Skoolar on behalf of ${schoolName}.
        </p>
      </div>
    </body>
    </html>
  `;
  return { subject, html };
}

