import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Permission } from '@prisma/client';
import { AuthRequest } from '../types';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { AppError } from '../middleware/errorHandler';
import prisma from '../config/database';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '25');

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf',
      'video/mp4', 'video/quicktime',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

const router = Router();
router.use(authenticate);

router.post(
  '/tickets/:ticketId',
  requirePermission(Permission.TICKET_UPDATE),
  upload.single('file'),
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.file) {
      next(new AppError(400, 'No file uploaded'));
      return;
    }
    try {
      const ticket = await prisma.ticket.findFirst({
        where: { id: req.params.ticketId, organizationId: req.user!.organizationId },
      });
      if (!ticket) {
        next(new AppError(404, 'Ticket not found'));
        return;
      }

      const attachment = await prisma.attachment.create({
        data: {
          organizationId: req.user!.organizationId,
          ticketId: req.params.ticketId,
          filename: req.file.filename,
          originalName: req.file.originalname,
          url: `/uploads/${req.file.filename}`,
          mimeType: req.file.mimetype,
          sizeBytes: req.file.size,
          uploadedById: req.user!.id,
        },
      });
      res.status(201).json(attachment);
    } catch (e) {
      next(e);
    }
  }
);

router.delete(
  '/:id',
  requirePermission(Permission.TICKET_UPDATE),
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const attachment = await prisma.attachment.findFirst({
        where: { id: req.params.id, organizationId: req.user!.organizationId },
      });
      if (!attachment) {
        next(new AppError(404, 'Attachment not found'));
        return;
      }

      await prisma.attachment.delete({ where: { id: attachment.id } });
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  }
);

export default router;
