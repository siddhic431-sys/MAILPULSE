import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

interface SendMailParams {
  from: string;
  to: string;
  subject: string;
  body: string;
  senderCredentials?: {
    username: string;
    password?: string;
  };
}

interface SendMailResult {
  messageId: string;
  previewUrl?: string | false;
}

let sharedTransporter: Transporter | null = null;

export async function getTransporter(credentials?: { username: string; password?: string }): Promise<Transporter> {
  const user = credentials?.username || env.ETHEREAL_USER;
  const pass = credentials?.password || env.ETHEREAL_PASSWORD;

  // If specific or env credentials exist, use them
  if (user && pass) {
    return nodemailer.createTransport({
      host: env.ETHEREAL_HOST,
      port: env.ETHEREAL_PORT,
      secure: false, // Ethereal uses STARTTLS on 587
      auth: { user, pass },
    });
  }

  // Otherwise, create a shared Ethereal test account automatically
  if (!sharedTransporter) {
    logger.info('No static Ethereal credentials found; generating dynamic Ethereal test account...');
    const testAccount = await nodemailer.createTestAccount();
    sharedTransporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    logger.info(`Dynamic Ethereal test account ready: ${testAccount.user}`);
  }

  return sharedTransporter;
}

/**
 * Creates a new dedicated Ethereal test account (useful for provisioning new senders)
 */
export async function createEtherealAccount(): Promise<{ email: string; user: string; pass: string }> {
  const testAccount = await nodemailer.createTestAccount();
  return {
    email: testAccount.user,
    user: testAccount.user,
    pass: testAccount.pass,
  };
}

export async function sendEmail({
  from,
  to,
  subject,
  body,
  senderCredentials,
}: SendMailParams): Promise<SendMailResult> {
  const transporter = await getTransporter(senderCredentials);

  const info = await transporter.sendMail({
    from: `"${from.split('@')[0]}" <${from}>`,
    to,
    subject,
    text: body,
    html: body.replace(/\n/g, '<br/>'),
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  logger.info(`Email dispatched successfully to ${to}`, {
    messageId: info.messageId,
    previewUrl: previewUrl || undefined,
  });

  return {
    messageId: info.messageId,
    previewUrl,
  };
}
