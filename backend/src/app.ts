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
import { errorHandler, notFound } from './middleware/errorHandler';
import { logger } from './config/logger';

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use(notFound);
app.use(errorHandler);

export default app;
