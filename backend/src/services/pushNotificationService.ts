import { getMessaging } from 'firebase-admin/messaging';
import prisma from '../config/database';
import { logger } from '../config/logger';
import { getFcmApp } from '../config/firebase';

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

interface PushMeta {
  templateName?: string;
  ticketId?: string;
  organizationId?: string;
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  meta?: PushMeta
): Promise<{ sent: number; failed: number; skipped: number }> {
  const tokens = await prisma.deviceToken.findMany({
    where: { userId, active: true },
    select: { id: true, token: true, platform: true },
  });

  if (tokens.length === 0) return { sent: 0, failed: 0, skipped: 0 };

  const app = getFcmApp();
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const device of tokens) {
    if (!app) {
      await prisma.pushLog.create({
        data: {
          organizationId: meta?.organizationId,
          userId,
          ticketId: meta?.ticketId,
          templateName: meta?.templateName,
          title: payload.title,
          body: payload.body,
          status: 'SKIPPED',
          errorMessage: 'FCM not configured',
          provider: 'fcm',
        },
      });
      skipped++;
      continue;
    }

    try {
      const providerMessageId = await getMessaging(app).send({
        token: device.token,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
        apns: { payload: { aps: { badge: 1, sound: 'default' } } },
        android: { notification: { sound: 'default' } },
      });

      await prisma.pushLog.create({
        data: {
          organizationId: meta?.organizationId,
          userId,
          ticketId: meta?.ticketId,
          deviceTokenId: device.id,
          templateName: meta?.templateName,
          title: payload.title,
          body: payload.body,
          status: 'SENT',
          provider: 'fcm',
          providerMessageId,
          sentAt: new Date(),
        },
      });
      sent++;
    } catch (err) {
      failed++;
      const error = err instanceof Error ? err.message : String(err);

      // Deactivate tokens that are no longer valid
      if (
        error.includes('registration-token-not-registered') ||
        error.includes('Requested entity was not found') ||
        error.includes('invalid-argument')
      ) {
        await prisma.deviceToken.update({ where: { id: device.id }, data: { active: false } });
      }

      await prisma.pushLog.create({
        data: {
          organizationId: meta?.organizationId,
          userId,
          ticketId: meta?.ticketId,
          deviceTokenId: device.id,
          templateName: meta?.templateName,
          title: payload.title,
          body: payload.body,
          status: 'FAILED',
          errorMessage: error,
          provider: 'fcm',
        },
      });

      logger.error('Push notification failed', { userId, deviceId: device.id, error });
    }
  }

  if (skipped > 0 && sent === 0 && failed === 0) {
    logger.warn('Push notifications skipped — FCM not configured', { userId });
  }

  return { sent, failed, skipped };
}

export async function sendTicketPushNotification(
  userId: string,
  event: 'assign' | 'status' | 'comment',
  payload: {
    ticketNumber: string;
    title: string;
    url: string;
    detail?: string;
    ticketId?: string;
    organizationId?: string;
  }
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { notificationPref: true },
  });

  if (!user) return;
  const prefs = user.notificationPref;
  if (!prefs?.pushEnabled) return;
  if (event === 'assign'  && !prefs.onAssignPush) return;
  if (event === 'status'  && !prefs.onStatusPush) return;
  if (event === 'comment' && !prefs.onCommentPush) return;

  const messages: Record<string, { title: string; body: string }> = {
    assign:  { title: 'Ticket Assigned',                        body: `[${payload.ticketNumber}] ${payload.title}` },
    status:  { title: `Status: ${payload.detail ?? 'Updated'}`, body: `[${payload.ticketNumber}] ${payload.title}` },
    comment: { title: 'New Comment',                            body: `[${payload.ticketNumber}] ${payload.title}` },
  };

  await sendPushToUser(
    userId,
    { ...messages[event], data: { ticketUrl: payload.url, ticketId: payload.ticketId ?? '' } },
    { templateName: `ticket_${event}`, ticketId: payload.ticketId, organizationId: payload.organizationId }
  );
}
