import { createEmailWorker } from './workers/emailWorker';
import { connectPrisma } from './lib/prisma';
import { logger } from './utils/logger';

async function bootstrapWorker() {
  logger.info('=======================================================');
  logger.info('Starting MailPulse Distributed BullMQ Email Worker...');
  logger.info('=======================================================');

  await connectPrisma();

  const worker = createEmailWorker();

  const shutdown = async (signal: string) => {
    logger.info(`Worker received ${signal}. Closing BullMQ worker gracefully...`);
    try {
      await worker.close();
      logger.info('BullMQ worker stopped successfully.');
      process.exit(0);
    } catch (err: any) {
      logger.error('Error during worker shutdown:', { error: err.message });
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrapWorker().catch((err) => {
  logger.error('Fatal worker error:', { error: err.message, stack: err.stack });
  process.exit(1);
});
