import { Resend } from 'resend';

let resend: Resend | null = null;

function getResend() {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY || 'dummy-key-for-build');
  }
  return resend;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; error?: string; data?: unknown }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not set. Email sending disabled.');
      return { success: false, error: 'Email service not configured' };
    }

     const from = options.from || `${process.env.EMAIL_FROM || 'noreply@skoolar.org'}`;

     const result = await getResend().emails.send({
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
