import { Router, Request, Response, NextFunction } from 'express';
import { getAppReleaseInfo } from '../services/appVersionService';

const router = Router();

router.get('/version', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const info = await getAppReleaseInfo();
    res.json(info);
  } catch (e) {
    next(e);
  }
});

export default router;
