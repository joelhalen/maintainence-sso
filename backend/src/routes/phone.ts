import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthRequest } from '../types';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { sendVerificationCode, confirmVerificationCode } from '../services/smsService';
import prisma from '../config/database';

const router = Router();
router.use(authenticate);

// POST /api/phone/verify — send a 6-digit OTP to the provided phone number
router.post(
  '/verify',
  [body('phone').trim().notEmpty().withMessage('Phone number is required')],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { next(new AppError(400, errors.array()[0].msg as string)); return; }
    try {
      const sent = await sendVerificationCode(req.user!.id, req.body.phone);
      if (!sent) { next(new AppError(503, 'SMS service unavailable — check TWILIO_* configuration')); return; }
      res.json({ message: 'Verification code sent' });
    } catch (e) { next(e); }
  }
);

// POST /api/phone/confirm — validate the OTP
router.post(
  '/confirm',
  [body('code').trim().isLength({ min: 6, max: 6 }).withMessage('Code must be 6 digits')],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { next(new AppError(400, errors.array()[0].msg as string)); return; }
    try {
      const result = await confirmVerificationCode(req.user!.id, req.body.code);
      if (result === 'ok') {
        res.json({ message: 'Phone number verified' });
      } else if (result === 'expired') {
        next(new AppError(410, 'Verification code has expired — please request a new one'));
      } else if (result === 'too_many_attempts') {
        next(new AppError(429, 'Too many failed attempts — please request a new code'));
      } else {
        next(new AppError(400, 'Invalid verification code'));
      }
    } catch (e) { next(e); }
  }
);

// GET /api/phone/status — return current phone + verification state for the current user
router.get('/status', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { phone: true, phoneVerified: true },
    });
    const pending = await prisma.phoneVerification.findUnique({
      where: { userId: req.user!.id },
      select: { phone: true, expiresAt: true },
    });
    res.json({ ...user, pending: pending ?? null });
  } catch (e) { next(e); }
});

// PATCH /api/phone/sms-preferences — update SMS notification prefs
router.patch(
  '/sms-preferences',
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const allowed = ['smsEnabled', 'onAssignSms', 'onStatusSms', 'onCommentSms'];
      const data: Record<string, boolean> = {};
      for (const k of allowed) {
        if (typeof req.body[k] === 'boolean') data[k] = req.body[k];
      }
      const prefs = await prisma.notificationPreference.upsert({
        where: { userId: req.user!.id },
        update: data,
        create: { userId: req.user!.id, ...data },
      });
      res.json(prefs);
    } catch (e) { next(e); }
  }
);

export default router;
