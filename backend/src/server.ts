import 'dotenv/config';
import app from './app';
import prisma from './config/database';
import { logger } from './config/logger';
import { startEmailInboxWorker, stopEmailInboxWorker } from './workers/emailInboxWorker';

const PORT = parseInt(process.env.PORT || '4000');

async function bootstrap() {
  await prisma.$connect();
  logger.info('Database connected');

  const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
  startEmailInboxWorker();

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down`);
    stopEmailInboxWorker();
    server.close(async () => {
      await prisma.$disconnect();
      logger.info('Shutdown complete');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((e) => {
  logger.error('Bootstrap failed', e);
  process.exit(1);
});
