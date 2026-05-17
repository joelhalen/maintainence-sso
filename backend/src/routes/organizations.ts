import { Router, Response, NextFunction } from 'express';
import { Permission } from '@prisma/client';
import { AuthRequest } from '../types';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { getUsageSummary } from '../services/entitlementService';

const router = Router();
router.use(authenticate);

router.get('/me', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const usage = await getUsageSummary(req.user!.organizationId);
    res.json({ organization: req.user!.organization, usage });
  } catch (e) {
    next(e);
  }
});

router.get('/subscription', requirePermission(Permission.ADMIN_PANEL), async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const usage = await getUsageSummary(req.user!.organizationId);
    res.json({
      organization: req.user!.organization,
      usage,
      billing: {
        provider: req.user!.organization.subscription.provider,
        providerCustomerId: req.user!.organization.subscription.providerCustomerId,
        paypalSubscriptionId: req.user!.organization.subscription.paypalSubscriptionId,
        checkoutEnabled: false,
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
