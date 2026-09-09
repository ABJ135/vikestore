import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';
import { BrevoClient } from '@getbrevo/brevo';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private client: BrevoClient;

  constructor(private readonly prisma: PrismaService) {}

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
   * Retrieves all active admins and employees from the database who have enabled notifications for the given type.
   */
  async getActiveStaffRecipients(type: 'lowStock' | 'newOrder'): Promise<Array<{ email: string; name: string }>> {
    const whereCondition =
      type === 'lowStock'
        ? { isActive: true, notifyLowStock: true }
        : { isActive: true, notifyNewOrder: true };

    const staff = await this.prisma.admin.findMany({
      where: whereCondition,
      select: { email: true, name: true },
    });
    return staff.map((s) => ({ email: s.email, name: s.name }));
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
   * Sends a Low Stock Alert email to all active admins and employees.
   */
  async sendLowStockAlert(product: { id: string; name: string; sku: string; stock: number }): Promise<void> {
    try {
      const recipients = await this.getActiveStaffRecipients('lowStock');
      if (recipients.length === 0) {
        this.logger.warn(`No active staff recipients found for low stock alert on product ${product.name} (${product.sku})`);
        return;
      }

      const subject = `[Low Stock Alert] Product "${product.name}" has only ${product.stock} units remaining`;
      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Low Stock Alert</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f4f6f9;color:#1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.05);overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="padding:32px 36px 20px 36px;text-align:center;background:linear-gradient(135deg,#991b1b 0%,#b91c1c 100%);">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">⚠️ Low Stock Alert</h1>
              <p style="margin:6px 0 0 0;font-size:13px;color:#fca5a5;text-transform:uppercase;letter-spacing:1px;">VikeStore Inventory Warning</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 36px 28px 36px;">
              <p style="margin:0 0 20px 0;font-size:15px;line-height:24px;color:#334155;">
                Attention Store Staff,
              </p>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:24px;color:#475569;">
                The stock level for the following product has fallen below <strong>10 units</strong>. Please reorder inventory as soon as possible.
              </p>
              <table role="presentation" width="100%" style="margin:0 0 24px 0;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;border-spacing:0;overflow:hidden;">
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#64748b;font-weight:600;width:35%;">Product Name:</td>
                  <td style="padding:14px 18px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a;font-weight:700;">${product.name}</td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#64748b;font-weight:600;">SKU:</td>
                  <td style="padding:14px 18px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a;font-family:monospace;">${product.sku}</td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#64748b;font-weight:600;">Remaining Stock:</td>
                  <td style="padding:14px 18px;border-bottom:1px solid #e2e8f0;font-size:16px;color:#dc2626;font-weight:800;">${product.stock} units</td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;font-size:14px;color:#64748b;font-weight:600;">Product ID:</td>
                  <td style="padding:14px 18px;font-size:13px;color:#475569;font-family:monospace;">${product.id}</td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;line-height:20px;color:#94a3b8;">
                This is an automated notification from your VikeStore system.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 36px;background-color:#f8fafc;border-top:1px solid #f1f5f9;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                &copy; ${new Date().getFullYear()} VikeStore Admin System
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
        `Low Stock Alert - VikeStore`,
        ``,
        `Product Name: ${product.name}`,
        `SKU: ${product.sku}`,
        `Remaining Stock: ${product.stock} units`,
        `Product ID: ${product.id}`,
        ``,
        `Please restock this product promptly.`,
      ].join('\n');

      await this.sendEmail({
        to: recipients,
        subject,
        htmlContent,
        textContent,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send low stock alert for product ${product.id}: ${msg}`);
    }
  }

  /**
   * Sends a New Order Alert email to all active admins and employees.
   */
  async sendNewOrderAlert(order: {
    id: string;
    totalCents: number;
    customer?: { name?: string; email?: string } | null;
    items?: Array<{
      quantity: number;
      priceCents: number;
      product?: { name: string; sku: string } | null;
    }>;
  }): Promise<void> {
    try {
      const recipients = await this.getActiveStaffRecipients('newOrder');
      if (recipients.length === 0) {
        this.logger.warn(`No active staff recipients found for new order alert on order ${order.id}`);
        return;
      }

      const customerName = order.customer?.name ?? 'Customer';
      const customerEmail = order.customer?.email ?? 'N/A';
      const formattedTotal = `$${(order.totalCents / 100).toFixed(2)}`;
      const subject = `[New Order Alert] Order #${order.id.slice(0, 8)} placed (${formattedTotal})`;

      const itemsHtml = (order.items ?? [])
        .map(
          (item) => `
            <tr>
              <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a;">
                <strong>${item.product?.name ?? 'Product'}</strong><br>
                <span style="font-size:12px;color:#64748b;font-family:monospace;">SKU: ${item.product?.sku ?? 'N/A'}</span>
              </td>
              <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#334155;text-align:center;">
                ${item.quantity}
              </td>
              <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#334155;text-align:right;">
                $${(item.priceCents / 100).toFixed(2)}
              </td>
              <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a;font-weight:600;text-align:right;">
                $${((item.priceCents * item.quantity) / 100).toFixed(2)}
              </td>
            </tr>
          `,
        )
        .join('');

      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Order Alert</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f4f6f9;color:#1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:600px;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.05);overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="padding:32px 36px 20px 36px;text-align:center;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">🛍️ New Order Received</h1>
              <p style="margin:6px 0 0 0;font-size:13px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">VikeStore Order Alert</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 36px 28px 36px;">
              <p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:#334155;">
                A new order has been placed on VikeStore!
              </p>
              <div style="margin:0 0 24px 0;padding:16px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
                <p style="margin:0 0 8px 0;font-size:14px;color:#475569;"><strong>Order ID:</strong> <span style="font-family:monospace;">${order.id}</span></p>
                <p style="margin:0 0 8px 0;font-size:14px;color:#475569;"><strong>Customer:</strong> ${customerName} (${customerEmail})</p>
                <p style="margin:0;font-size:14px;color:#475569;"><strong>Total Amount:</strong> <span style="font-size:16px;color:#16a34a;font-weight:700;">${formattedTotal}</span></p>
              </div>
              <h3 style="margin:0 0 12px 0;font-size:16px;color:#0f172a;">Order Items</h3>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px 0;border:1px solid #e2e8f0;border-radius:8px;border-spacing:0;overflow:hidden;">
                <thead>
                  <tr style="background-color:#f1f5f9;">
                    <th style="padding:10px 14px;text-align:left;font-size:12px;color:#475569;text-transform:uppercase;">Item</th>
                    <th style="padding:10px 14px;text-align:center;font-size:12px;color:#475569;text-transform:uppercase;">Qty</th>
                    <th style="padding:10px 14px;text-align:right;font-size:12px;color:#475569;text-transform:uppercase;">Price</th>
                    <th style="padding:10px 14px;text-align:right;font-size:12px;color:#475569;text-transform:uppercase;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
              <p style="margin:0;font-size:13px;line-height:20px;color:#94a3b8;">
                Log in to the admin portal to process and update shipping status for this order.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 36px;background-color:#f8fafc;border-top:1px solid #f1f5f9;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                &copy; ${new Date().getFullYear()} VikeStore Admin Notification
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

      const itemsText = (order.items ?? [])
        .map(
          (item) =>
            `- ${item.product?.name ?? 'Product'} (SKU: ${item.product?.sku ?? 'N/A'}) x${item.quantity} @ $${(item.priceCents / 100).toFixed(2)} = $${((item.priceCents * item.quantity) / 100).toFixed(2)}`,
        )
        .join('\n');

      const textContent = [
        `New Order Received - VikeStore`,
        ``,
        `Order ID: ${order.id}`,
        `Customer: ${customerName} (${customerEmail})`,
        `Total Amount: ${formattedTotal}`,
        ``,
        `Order Items:`,
        itemsText,
      ].join('\n');

      await this.sendEmail({
        to: recipients,
        subject,
        htmlContent,
        textContent,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send new order alert for order ${order.id}: ${msg}`);
    }
  }

  /**
   * Generic transactional email sender using the Brevo SDK.
   */
  async sendEmail(options: {
    to: string | Array<{ email: string; name?: string }>;
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

    const recipients = Array.isArray(options.to)
      ? options.to
      : [{ email: options.to, name: options.name ?? options.to }];

    try {
      const response = await this.client.transactionalEmails.sendTransacEmail({
        sender: {
          name: 'VikeStore',
          email: senderEmail,
        },
        to: recipients,
        subject: options.subject,
        htmlContent: options.htmlContent,
        textContent: options.textContent,
      });

      const messageId = (response as unknown as { data?: { messageId?: string } })?.data?.messageId;
      const logTarget = Array.isArray(options.to)
        ? `${options.to.length} recipients`
        : options.to;
      this.logger.log(`Email sent to ${logTarget} — messageId: ${messageId ?? 'unknown'}`);
      return { messageId };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send email: ${msg}`, error);
      throw new InternalServerErrorException(`Email delivery failed: ${msg}`);
    }
  }
}
