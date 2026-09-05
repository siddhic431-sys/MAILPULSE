// Ensure environment variables are loaded first before any other modules initialize
import { env } from './config/env';
import { createApp } from './app';
import { connectPrisma } from './lib/prisma';
import { initElasticsearchIndex } from './lib/elasticsearch';
import { reportGoogleOAuthStatus } from './integrations/google/oauth';
import { logger } from './utils/logger';


async function bootstrap() {
  logger.info('Starting MailPulse API Server...');

  // Report Google OAuth configuration status without leaking secrets
  reportGoogleOAuthStatus();

  // Connect database and init Elasticsearch index
  await connectPrisma();
  await initElasticsearchIndex();

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`=======================================================`);
    logger.info(`MailPulse API Server is running on port: ${env.PORT}`);
    logger.info(`Health check: http://localhost:${env.PORT}/api/health`);
    logger.info(`Bull Board UI: http://localhost:${env.PORT}/admin/queues`);
    logger.info(`Frontend URL: ${env.FRONTEND_URL}`);
    logger.info(`=======================================================`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down MailPulse API Server gracefully...`);
    server.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('Fatal startup error:', { error: err.message, stack: err.stack });
  process.exit(1);
});
