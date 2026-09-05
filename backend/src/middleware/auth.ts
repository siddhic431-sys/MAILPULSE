import { Request, Response, NextFunction } from 'express';
import { prisma, getIsPrismaConnected } from '../lib/prisma';
import { logger } from '../utils/logger';

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.session?.userId;

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required. Please log in.',
    });
    return;
  }

  // Pre-populate from session if available
  if (req.session?.user) {
    req.user = req.session.user;
  }

  if (getIsPrismaConnected()) {
    try {
      let user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          googleId: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      });

      // If user was not found by id, sync using session's googleId or email
      if (!user && (req.session?.user?.googleId || req.session?.user?.email)) {
        const googleId = req.session.user.googleId;
        const email = req.session.user.email;

        if (googleId) {
          user = await prisma.user.findUnique({
            where: { googleId },
            select: {
              id: true,
              googleId: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          });
        }

        if (!user && email) {
          user = await prisma.user.findUnique({
            where: { email },
            select: {
              id: true,
              googleId: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          });
        }

        if (!user && googleId && email) {
          user = await prisma.user.upsert({
            where: { googleId },
            update: {
              name: req.session.user.name,
              email,
              avatarUrl: req.session.user.avatarUrl,
            },
            create: {
              googleId,
              name: req.session.user.name,
              email,
              avatarUrl: req.session.user.avatarUrl,
            },
            select: {
              id: true,
              googleId: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          });
        }

        if (user) {
          req.session.userId = user.id;
          req.session.user = {
            id: user.id,
            googleId: user.googleId,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
          };
        }
      }

      if (user) {
        req.user = user;
      } else if (!req.user) {
        // User genuinely deleted or session invalid
        req.session.destroy(() => {});
        res.status(401).json({
          success: false,
          error: 'Session invalid or user no longer exists.',
        });
        return;
      }
    } catch (error: any) {
      // If DB fails, rely on verified session user
      logger.warn('Database query skipped in requireAuth, using session user:', { error: error.message });
    }
  }

  if (!req.user) {
    req.session.destroy(() => {});
    res.status(401).json({
      success: false,
      error: 'Session invalid or user no longer exists.',
    });
    return;
  }

  next();
}
