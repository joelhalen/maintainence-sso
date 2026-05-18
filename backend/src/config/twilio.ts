import twilio from 'twilio';
import { logger } from './logger';

type TwilioClient = ReturnType<typeof twilio>;

let client: TwilioClient | null = null;
let warned = false;

export function isTwilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  );
}

export function getTwilioFromNumber(): string | undefined {
  return process.env.TWILIO_FROM_NUMBER;
}

export function getTwilioStatusCallbackUrl(): string | undefined {
  return process.env.TWILIO_STATUS_CALLBACK_URL;
}

export function getTwilioConfigStatus() {
  return {
    configured: isTwilioConfigured(),
    hasAccountSid: Boolean(process.env.TWILIO_ACCOUNT_SID),
    hasAuthToken: Boolean(process.env.TWILIO_AUTH_TOKEN),
    hasFromNumber: Boolean(process.env.TWILIO_FROM_NUMBER),
    fromNumber: process.env.TWILIO_FROM_NUMBER || '',
    hasStatusCallbackUrl: Boolean(process.env.TWILIO_STATUS_CALLBACK_URL),
  };
}

export function getTwilioClient(): TwilioClient | null {
  if (!isTwilioConfigured()) {
    if (!warned) {
      logger.warn('Twilio is not fully configured - SMS messages will be skipped');
      warned = true;
    }
    return null;
  }

  if (!client) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
  }

  return client;
}
