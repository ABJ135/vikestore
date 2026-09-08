import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';
import { BrevoClient } from '@getbrevo/brevo';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private client: BrevoClient;

  onModuleInit() {
    const apiKey = process.env.BREVO_API_KEY;

    if (!apiKey) {
      this.logger.error('BREVO_API_KEY is not defined in environment variables');
      throw new Error('Mail service misconfiguration: BREVO_API_KEY is missing');
    }

    this.client = new BrevoClient({ apiKey });
    this.logger.log('Brevo client initialized');
  }

  /**
   * Generates a cryptographically secure numeric OTP of the given digit length (default: 6).
   */
  generateOtp(length = 6): string {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return crypto.randomInt(min, max + 1).toString();
  }

  /**
   * Sends an OTP verification email to the user via the Brevo SDK.
   */
  async sendOtpEmail(
    to: string,
    otp: string,
    options?: {
      name?: string;
      expiryMinutes?: number;
    },
  ): Promise<{ messageId?: string }> {
    const recipientName = options?.name ?? 'Valued Customer';
    const expiryMinutes = options?.expiryMinutes ?? 10;
    const subject = `${otp} is your VikeStore verification code`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Code</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f4f6f9;color:#1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.05);overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="padding:32px 36px 20px 36px;text-align:center;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);">
              <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">VikeStore</h1>
              <p style="margin:6px 0 0 0;font-size:13px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Email Verification</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 36px 28px 36px;">
              <p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:#334155;">
                Hello <strong>${recipientName}</strong>,
              </p>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:24px;color:#475569;">
                Your one-time verification code (OTP) for your VikeStore account is:
              </p>
              <div style="margin:0 0 24px 0;padding:18px 24px;background-color:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;text-align:center;">
                <span style="font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:700;letter-spacing:8px;color:#0f172a;display:inline-block;">
                  ${otp}
                </span>
              </div>
              <p style="margin:0 0 20px 0;font-size:14px;line-height:20px;color:#64748b;">
                &#9200; This code expires in <strong>${expiryMinutes} minutes</strong>. Never share it with anyone.
              </p>
              <hr style="border:none;border-top:1px solid #f1f5f9;margin:24px 0;">
              <p style="margin:0;font-size:13px;line-height:20px;color:#94a3b8;">
                If you did not request this code, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 36px;background-color:#f8fafc;border-top:1px solid #f1f5f9;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                &copy; ${new Date().getFullYear()} VikeStore. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    const textContent = [
      `Hello ${recipientName},`,
      ``,
      `Your VikeStore verification code is: ${otp}`,
      ``,
      `This code expires in ${expiryMinutes} minutes. Never share it with anyone.`,
      ``,
      `If you did not request this code, you can safely ignore this email.`,
    ].join('\n');

    return this.sendEmail({
      to,
      name: recipientName,
      subject,
      htmlContent,
      textContent,
    });
  }

  /**
   * Generic transactional email sender using the Brevo SDK.
   */
  async sendEmail(options: {
    to: string;
    name?: string;
    subject: string;
    htmlContent: string;
    textContent?: string;
  }): Promise<{ messageId?: string }> {
    const senderEmail = process.env.BREVO_EMAIL;

    if (!senderEmail) {
      this.logger.error('BREVO_EMAIL is not defined in environment variables');
      throw new InternalServerErrorException('Mail service configuration error: BREVO_EMAIL missing');
    }

    try {
      const response = await this.client.transactionalEmails.sendTransacEmail({
        sender: {
          name: 'VikeStore',
          email: senderEmail,
        },
        to: [
          {
            email: options.to,
            name: options.name ?? options.to,
          },
        ],
        subject: options.subject,
        htmlContent: options.htmlContent,
        textContent: options.textContent,
      });

      const messageId = (response as unknown as { data?: { messageId?: string } })?.data?.messageId;
      this.logger.log(`Email sent to ${options.to} — messageId: ${messageId ?? 'unknown'}`);
      return { messageId };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send email to ${options.to}: ${msg}`, error);
      throw new InternalServerErrorException(`Email delivery failed: ${msg}`);
    }
  }
}
