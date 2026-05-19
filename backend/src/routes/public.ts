import { Router, Response, NextFunction } from 'express';
import prisma from '../config/database';

const router = Router();

/** Public subscription tiers for the marketing pricing page (no auth). */
router.get('/plans', async (_req, res: Response, next: NextFunction): Promise<void> => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { active: true },
      orderBy: { tier: 'asc' },
      select: {
        tier: true,
        name: true,
        description: true,
        monthlyPriceCents: true,
        maxActiveUsers: true,
        maxLocations: true,
        maxAssets: true,
        maxActiveTickets: true,
        allowPush: true,
        allowSso: true,
        allowExports: true,
      },
    });
    res.json(plans);
  } catch (err) {
    next(err);
  }
});

export default router;
