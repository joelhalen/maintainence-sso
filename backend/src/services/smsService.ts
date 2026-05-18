import crypto from 'crypto';
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

// ─── Provider abstraction ─────────────────────────────────────────────────────

interface SmsProvider {
  send(to: string, body: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
  name: string;
}

class TwilioProvider implements SmsProvider {
  name = 'twilio';

  async send(to: string, body: string) {
    const sid  = process.env.TWILIO_ACCOUNT_SID;
    const auth = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;

    if (!sid || !auth || !from) {
      return { success: false, error: 'Twilio credentials not configured' };
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const creds = Buffer.from(`${sid}:${auth}`).toString('base64');

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${creds}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
      });

      const json = await resp.json() as { sid?: string; message?: string };
      if (resp.ok) return { success: true, messageId: json.sid };
      return { success: false, error: json.message ?? `HTTP ${resp.status}` };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

// ─── Active provider ─────────────────────────────────────────────────────────

function getProvider(): SmsProvider | null {
  if (process.env.TWILIO_ACCOUNT_SID) return new TwilioProvider();
  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Low-level send — accepts either the legacy SmsOptions object (for backward
 * compatibility with ticketService / adminSms routes) or the newer positional
 * (to, body, meta) signature used by the phone-verification flow.
 */
export async function sendSms(
  toOrOptions: string | SmsOptions,
  body?: string,
  meta?: { templateName?: string; ticketId?: string; userId?: string; organizationId?: string }
): Promise<boolean> {
  let to: string;
  let msgBody: string;
  let templateName: string | undefined;
  let ticketId: string | undefined;
  let userId: string | undefined;
  let organizationId: string | undefined;

  if (typeof toOrOptions === 'string') {
    to = toOrOptions;
    msgBody = body!;
    templateName = meta?.templateName;
    ticketId = meta?.ticketId;
    userId = meta?.userId;
    organizationId = meta?.organizationId;
  } else {
    const opts = toOrOptions as SmsOptions;
    to = opts.to;
    msgBody = opts.body;
    ticketId = opts.ticketId;
    userId = opts.userId;
    organizationId = opts.organizationId;
  }

  // Legacy path: use Twilio SDK wrapper if available, otherwise fall through
  // to the provider abstraction.
  if (isTwilioConfigured() && isSmsCapablePhone(to)) {
    const client = getTwilioClient();
    const from = getTwilioFromNumber();
    const statusCallback = getTwilioStatusCallbackUrl();

    if (client && from) {
      const log = await prisma.smsLog.create({
        data: {
          organizationId,
          to,
          body: msgBody,
          userId,
          ticketId,
          status: 'PENDING',
          provider: 'twilio',
        },
      });
      try {
        const result = await client.messages.create({
          to,
          from,
          body: msgBody,
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
        logger.error('SMS send failed', { error: message, to, userId });
        return false;
      }
    }
  }

  // Provider-abstraction path
  const provider = getProvider();

  const log = await prisma.smsLog.create({
    data: {
      organizationId,
      to,
      body: msgBody,
      templateName,
      ticketId,
      userId,
      provider: provider?.name ?? 'none',
      status: 'PENDING',
    },
  });

  if (!provider) {
    await prisma.smsLog.update({ where: { id: log.id }, data: { status: 'FAILED', errorMessage: 'No SMS provider configured' } });
    logger.warn('SMS not sent — no provider configured', { to });
    return false;
  }

  const result = await provider.send(to, msgBody);

  await prisma.smsLog.update({
    where: { id: log.id },
    data: {
      status: result.success ? 'SENT' : 'FAILED',
      messageId: result.messageId,
      errorMessage: result.error,
      sentAt: result.success ? new Date() : undefined,
    },
  });

  if (!result.success) logger.warn('SMS delivery failed', { to, error: result.error });
  return result.success;
}

function isSmsConfiguredForRecipient(to: string): boolean {
  return isTwilioConfigured() && isSmsCapablePhone(to);
}

// ─── Legacy text helpers (used by ticketService on HEAD branch) ───────────────

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

// ─── Phone verification ───────────────────────────────────────────────────────

/**
 * Generates a 6-digit OTP, stores a sha256 hash of it, and sends it to
 * the given phone number. Expires in 10 minutes.
 */
export async function sendVerificationCode(userId: string, phone: string): Promise<boolean> {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.phoneVerification.upsert({
    where: { userId },
    update: { phone, codeHash, expiresAt, attempts: 0, createdAt: new Date() },
    create: { userId, phone, codeHash, expiresAt },
  });

  const sent = await sendSms(
    phone,
    `Your verification code is: ${code}. It expires in 10 minutes.`,
    { templateName: 'phone_verification', userId }
  );

  if (!sent) {
    logger.error('Failed to send verification SMS', { userId, phone });
  }
  return sent;
}

/**
 * Verifies the OTP provided by the user. On success marks the phone as
 * verified and deletes the pending verification record.
 * Returns 'ok' | 'invalid' | 'expired' | 'too_many_attempts'
 */
export async function confirmVerificationCode(
  userId: string,
  code: string
): Promise<'ok' | 'invalid' | 'expired' | 'too_many_attempts'> {
  const record = await prisma.phoneVerification.findUnique({ where: { userId } });
  if (!record) return 'invalid';
  if (record.attempts >= 5) return 'too_many_attempts';
  if (record.expiresAt < new Date()) return 'expired';

  const hash = crypto.createHash('sha256').update(code).digest('hex');
  if (hash !== record.codeHash) {
    await prisma.phoneVerification.update({ where: { userId }, data: { attempts: { increment: 1 } } });
    return 'invalid';
  }

  await Promise.all([
    prisma.user.update({ where: { id: userId }, data: { phone: record.phone, phoneVerified: true } }),
    prisma.phoneVerification.delete({ where: { userId } }),
  ]);
  return 'ok';
}

// ─── Notification helpers ─────────────────────────────────────────────────────

export async function sendTicketSmsNotification(
  userId: string,
  event: 'assign' | 'status' | 'comment',
  payload: { ticketNumber: string; title: string; url: string; detail?: string }
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { notificationPref: true },
  });
  if (!user?.phone || !user.phoneVerified) return;
  const prefs = user.notificationPref;
  if (!prefs?.smsEnabled) return;
  if (event === 'assign'  && !prefs.onAssignSms) return;
  if (event === 'status'  && !prefs.onStatusSms) return;
  if (event === 'comment' && !prefs.onCommentSms) return;

  const messages: Record<string, string> = {
    assign:  `[${payload.ticketNumber}] Ticket assigned to you: ${payload.title}`,
    status:  `[${payload.ticketNumber}] Status updated${payload.detail ? ` to ${payload.detail}` : ''}: ${payload.title}`,
    comment: `[${payload.ticketNumber}] New comment on: ${payload.title}`,
  };

  await sendSms(user.phone, messages[event], { templateName: `ticket_${event}`, userId });
}
