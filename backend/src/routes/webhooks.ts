import { Router, Request, Response, NextFunction } from 'express';
import twilio from 'twilio';
import prisma from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../middleware/errorHandler';

const router = Router();

interface TwilioSmsStatusBody {
  MessageSid?: string;
  SmsSid?: string;
  MessageStatus?: string;
  SmsStatus?: string;
  ErrorCode?: string;
  ErrorMessage?: string;
  To?: string;
  From?: string;
}

router.post('/twilio/sms-status', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const callbackUrl = process.env.TWILIO_STATUS_CALLBACK_URL;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const signature = req.header('x-twilio-signature') || '';

    if (!callbackUrl || !authToken) {
      next(new AppError(503, 'Twilio webhook validation is not configured'));
      return;
    }

    const isValid = twilio.validateRequest(
      authToken,
      signature,
      callbackUrl,
      req.body as Record<string, string>
    );

    if (!isValid) {
      next(new AppError(403, 'Invalid Twilio signature'));
      return;
    }

    const body = req.body as TwilioSmsStatusBody;
    const messageSid = body.MessageSid || body.SmsSid;
    const providerStatus = body.MessageStatus || body.SmsStatus;

    if (!messageSid || !providerStatus) {
      next(new AppError(400, 'Missing Twilio message status payload'));
      return;
    }

    const existing = await prisma.smsLog.findUnique({
      where: { providerMessageId: messageSid },
    });

    if (!existing) {
      logger.warn('Received Twilio status callback for unknown message', {
        messageSid,
        providerStatus,
        to: body.To,
        from: body.From,
      });
      res.status(204).send();
      return;
    }

    const status = providerStatus.toUpperCase();
    const now = new Date();

    await prisma.smsLog.update({
      where: { providerMessageId: messageSid },
      data: {
        status,
        statusCallbackAt: now,
        sentAt: existing.sentAt || (status === 'SENT' ? now : undefined),
        deliveredAt: status === 'DELIVERED' ? now : existing.deliveredAt,
        providerErrorCode: body.ErrorCode,
        errorMessage: body.ErrorMessage || existing.errorMessage,
      },
    });

    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

export default router;
