import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { env } from './config/env';
import apiRouter from './routes';
import { setupBullBoard } from './queues/bullBoard';
import { errorHandler } from './middleware/errorHandler';

export function createApp(): express.Application {
  const app = express();

  // Trust proxy for secure cookie delivery when behind reverse proxies / dev servers
  app.set('trust proxy', 1);

  // Security headers with Helmet
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allows Bull Board dashboard and external assets
      crossOriginEmbedderPolicy: false,
    })
  );

  // Cross-Origin Resource Sharing
  const allowedOrigins = [
    env.FRONTEND_URL,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://localhost:5000',
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or server-to-server)
        if (!origin) return callback(null, true);
        if (
          allowedOrigins.includes(origin) ||
          /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
        ) {
          return callback(null, true);
        }
        return callback(new Error(`CORS origin not allowed: ${origin}`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Session configuration with HTTP-only cookies
  app.use(
    session({
      name: 'mailpulse.sid',
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        path: '/',
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    })
  );

  // Bull Board Queue Dashboard: /admin/queues
  const bullBoardRouter = setupBullBoard();
  app.use('/admin/queues', bullBoardRouter);

  // API routes
  app.use('/api', apiRouter);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: `Endpoint [${req.method} ${req.path}] not found`,
    });
  });

  // Centralized error handling middleware
  app.use(errorHandler);

  return app;
}
