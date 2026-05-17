import nodemailer from 'nodemailer';
import { logger } from './logger';

export const createTransport = () => {
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    pool: true,
    maxConnections: 5,
  });

  transport.verify((error) => {
    if (error) {
      logger.warn('SMTP connection failed — email will not be sent', { error: error.message });
    } else {
      logger.info('SMTP connection verified');
    }
  });

  return transport;
};

export const emailTransport = createTransport();

export function getEmailConfigStatus() {
  return {
    smtpHost: Boolean(process.env.SMTP_HOST),
    smtpPort: Boolean(process.env.SMTP_PORT),
    smtpSecure: process.env.SMTP_SECURE === 'true',
    smtpUser: Boolean(process.env.SMTP_USER),
    smtpPass: Boolean(process.env.SMTP_PASS),
    emailFromName: Boolean(process.env.EMAIL_FROM_NAME),
    emailFromAddress: Boolean(process.env.EMAIL_FROM_ADDRESS),
    frontendUrl: Boolean(process.env.FRONTEND_URL),
    replyDomain: Boolean(process.env.EMAIL_REPLY_DOMAIN),
    replyLocalPart: Boolean(process.env.EMAIL_REPLY_LOCAL_PART),
  };
}

export function getTicketReplyTo(ticketNumber: string): string | undefined {
  const domain = process.env.EMAIL_REPLY_DOMAIN;
  const localPart = process.env.EMAIL_REPLY_LOCAL_PART || 'maintenance';
  if (!domain) return undefined;
  return `${localPart}+ticket-${ticketNumber}@${domain}`;
}
