import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';

import authRouter from './routes/auth';
import ticketsRouter from './routes/tickets';
import locationsRouter from './routes/locations';
import assetsRouter from './routes/assets';
import usersRouter from './routes/users';
import reportsRouter from './routes/reports';
import devicesRouter from './routes/devices';
import attachmentsRouter from './routes/attachments';
import signaturesRouter from './routes/signatures';
import exportRouter from './routes/export';
import webhooksRouter from './routes/webhooks';
import organizationsRouter from './routes/organizations';
import adminEmailRouter from './routes/adminEmail';
import adminPushRouter from './routes/adminPush';
import platformRouter from './routes/platform';
import groupsRouter from './routes/groups';
import permissionRulesRouter from './routes/permissionRules';
import appVersionRouter from './routes/appVersion';
import publicRouter from './routes/public';
import platformMobileReleaseRouter from './routes/platformMobileRelease';
import { errorHandler, notFound } from './middleware/errorHandler';
import { logger } from './config/logger';
import { getCorsOrigin } from './config/cors';

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin: getCorsOrigin(),
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);

app.use('/uploads', express.static(path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads')));

app.use('/api/auth', authRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/locations', locationsRouter);
app.use('/api/assets', assetsRouter);
app.use('/api/users', usersRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/attachments', attachmentsRouter);
app.use('/api/signatures', signaturesRouter);
app.use('/api/export', exportRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/organizations', organizationsRouter);
app.use('/api/admin/email', adminEmailRouter);
app.use('/api/admin/push', adminPushRouter);
app.use('/api/platform', platformRouter);
app.use('/api/platform/mobile-release', platformMobileReleaseRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/permission-rules', permissionRulesRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.use('/api/public', publicRouter);
app.use('/api/app', appVersionRouter);

// In production the compiled backend serves the built React frontend.
// Static assets are served first; any non-API GET falls back to index.html
// so that client-side routing works on direct URL navigation.
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

export default app;
