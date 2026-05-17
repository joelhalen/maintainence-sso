import {
  getTwilioClient,
  getTwilioFromNumber,
  getTwilioStatusCallbackUrl,
  isTwilioConfigured,
} from '../config/twilio';
import prisma from '../config/database';
import { logger } from '../config/logger';
import { SmsOptions } from '../types';

const E164_PHONE_RE = /^\+[1-9]\d{7,14}$/;

export function isSmsCapablePhone(phone?: string | null): phone is string {
  return Boolean(phone && E164_PHONE_RE.test(phone));
}

export async function sendSms(options: SmsOptions): Promise<boolean> {
  const log = await prisma.smsLog.create({
    data: {
      organizationId: options.organizationId,
      to: options.to,
      body: options.body,
      userId: options.userId,
      ticketId: options.ticketId,
      status: isTwilioConfigured() ? 'PENDING' : 'SKIPPED',
      errorMessage: isTwilioConfigured() ? undefined : 'Twilio is not configured',
    },
  });

  if (!isSmsConfiguredForRecipient(options.to)) {
    await prisma.smsLog.update({
      where: { id: log.id },
      data: {
        status: 'SKIPPED',
        errorMessage: isTwilioConfigured()
          ? 'Recipient phone number must be in E.164 format'
          : 'Twilio is not configured',
      },
    });
    return false;
  }

  const client = getTwilioClient();
  const from = getTwilioFromNumber();
  const statusCallback = getTwilioStatusCallbackUrl();
  if (!client || !from) return false;

  try {
    const result = await client.messages.create({
      to: options.to,
      from,
      body: options.body,
      statusCallback,
    });

    await prisma.smsLog.update({
      where: { id: log.id },
      data: {
        status: result.status?.toUpperCase() || 'SENT',
        providerMessageId: result.sid,
        sentAt: new Date(),
      },
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.smsLog.update({
      where: { id: log.id },
      data: { status: 'FAILED', errorMessage: message },
    });
    logger.error('SMS send failed', { error: message, to: options.to, userId: options.userId });
    return false;
  }
}

function isSmsConfiguredForRecipient(to: string): boolean {
  return isTwilioConfigured() && isSmsCapablePhone(to);
}

export function ticketAssignedSmsText(data: {
  ticketNumber: string;
  title: string;
  priority: string;
  ticketUrl: string;
}): string {
  return `${process.env.COMPANY_NAME || 'MegaMTX'}: You were assigned ${data.ticketNumber} (${data.priority}) - ${data.title}. ${data.ticketUrl}`;
}

export function ticketStatusChangedSmsText(data: {
  ticketNumber: string;
  status: string;
  changedBy: string;
  ticketUrl: string;
}): string {
  return `${process.env.COMPANY_NAME || 'MegaMTX'}: ${data.ticketNumber} status changed to ${data.status} by ${data.changedBy}. ${data.ticketUrl}`;
}

export function smsVerificationCodeText(code: string): string {
  return `${process.env.COMPANY_NAME || 'MegaMTX'} verification code: ${code}. This code expires soon.`;
}
