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
