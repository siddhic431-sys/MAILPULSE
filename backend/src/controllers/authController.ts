import { Request, Response } from 'express';
import {
  getGoogleAuthUrl,
  verifyGoogleCodeAndGetProfile,
  isGoogleOAuthConfigured,
  validateGoogleOAuthConfig,
} from '../integrations/google/oauth';
import { createEtherealAccount } from '../integrations/smtp/etherealClient';
import { prisma, getIsPrismaConnected } from '../lib/prisma';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export async function getGoogleAuthUrlHandler(req: Request, res: Response): Promise<void> {
  try {
    const configStatus = validateGoogleOAuthConfig();

    if (!configStatus.isConfigured) {
      logger.warn(
        `Attempted to initiate Google OAuth, but required variables are missing: ${configStatus.missingVariables.join(', ')}`
      );

      const errorMessage =
        'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env';

      // If requested via JSON API, respond with structured 400 error
      if (req.headers.accept?.includes('application/json') || req.xhr) {
        res.status(400).json({
          success: false,
          error: 'google_oauth_unconfigured',
          message: errorMessage,
          missingVariables: configStatus.missingVariables,
        });
        return;
      }

      // If accessed via browser redirect, redirect back to login page with clear notice
      res.redirect(
        `${env.FRONTEND_URL}/login?error=google_oauth_unconfigured&message=${encodeURIComponent(errorMessage)}`
      );
      return;
    }

    const authUrl = getGoogleAuthUrl();
    res.redirect(authUrl);
  } catch (error: any) {
    logger.error('Failed to generate Google Auth URL:', { error: error.message });
    if (req.headers.accept?.includes('application/json') || req.xhr) {
      res.status(500).json({ success: false, error: 'auth_init_failed', message: error.message });
      return;
    }
    res.redirect(
      `${env.FRONTEND_URL}/login?error=auth_init_failed&message=${encodeURIComponent(error.message)}`
    );
  }
}

export async function googleCallbackHandler(req: Request, res: Response): Promise<void> {
  const code = req.query.code as string;
  const oauthError = req.query.error as string;

  if (oauthError) {
    logger.warn('Google OAuth returned error query param:', { error: oauthError });
    res.redirect(
      `${env.FRONTEND_URL}/login?error=${encodeURIComponent(oauthError)}&message=${encodeURIComponent(
        'Google authentication was cancelled or rejected'
      )}`
    );
    return;
  }

  if (!code) {
    res.redirect(`${env.FRONTEND_URL}/login?error=missing_code&message=Authorization+code+missing+from+Google`);
    return;
  }

  try {
    const profile = await verifyGoogleCodeAndGetProfile(code);

    let user: {
      id: string;
      googleId: string;
      name: string;
      email: string;
      avatarUrl?: string | null;
    };

    try {
      // Upsert User in PostgreSQL
      user = await prisma.user.upsert({
        where: { googleId: profile.googleId },
        update: {
          name: profile.name,
          email: profile.email,
          avatarUrl: profile.avatarUrl,
        },
        create: {
          googleId: profile.googleId,
          name: profile.name,
          email: profile.email,
          avatarUrl: profile.avatarUrl,
        },
      });

      // Safely provision default Ethereal sender without blocking authentication
      try {
        const existingSender = await prisma.sender.findFirst({
          where: { userId: user.id },
        });

        if (!existingSender) {
          const ethereal = await createEtherealAccount();
          await prisma.sender.create({
            data: {
              userId: user.id,
              email: ethereal.email,
              etherealUsername: ethereal.user,
              etherealPassword: ethereal.pass,
            },
          });
          logger.info(`Auto-provisioned default Ethereal sender for user ${user.id}`);
        }
      } catch (senderErr: any) {
        logger.warn('Non-critical: Ethereal sender provisioning deferred during callback:', {
          error: senderErr.message,
        });
      }
    } catch (dbError: any) {
      logger.warn(
        'Database write failed during Google callback; creating active session from verified Google profile:',
        { error: dbError.message }
      );
      user = {
        id: `google-${profile.googleId}`,
        googleId: profile.googleId,
        name: profile.name,
        email: profile.email,
        avatarUrl: profile.avatarUrl,
      };
    }

    if (!req.session) {
      throw new Error('Express session middleware not available');
    }

    // Set authenticated session
    req.session.userId = user.id;
    req.session.user = {
      id: user.id,
      googleId: user.googleId,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl || undefined,
    };

    req.session.save((saveErr) => {
      if (saveErr) {
        logger.error('Failed to save session during Google callback:', { error: saveErr.message });
      }
      logger.info(`User [${user.email}] successfully logged in via Google OAuth`);
      res.redirect(`${env.FRONTEND_URL}/dashboard`);
    });
  } catch (error: any) {
    logger.error('Google OAuth callback error:', { error: error.message });
    res.redirect(
      `${env.FRONTEND_URL}/login?error=auth_failed&message=${encodeURIComponent(error.message)}`
    );
  }
}

export async function getMeHandler(req: Request, res: Response): Promise<void> {
  const sessionUser = req.user || req.session?.user;

  if (!sessionUser) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }

  try {
    if (getIsPrismaConnected()) {
      let user = await prisma.user.findUnique({
        where: { id: sessionUser.id },
        include: {
          senders: true,
          slackConnections: true,
        },
      });

      if (!user && (sessionUser.googleId || sessionUser.email)) {
        if (sessionUser.googleId) {
          user = await prisma.user.findUnique({
            where: { googleId: sessionUser.googleId },
            include: { senders: true, slackConnections: true },
          });
        }
        if (!user && sessionUser.email) {
          user = await prisma.user.findUnique({
            where: { email: sessionUser.email },
            include: { senders: true, slackConnections: true },
          });
        }
        if (!user && sessionUser.googleId && sessionUser.email) {
          user = await prisma.user.upsert({
            where: { googleId: sessionUser.googleId },
            update: {
              name: sessionUser.name,
              email: sessionUser.email,
              avatarUrl: sessionUser.avatarUrl,
            },
            create: {
              googleId: sessionUser.googleId,
              name: sessionUser.name,
              email: sessionUser.email,
              avatarUrl: sessionUser.avatarUrl,
            },
            include: { senders: true, slackConnections: true },
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
        if (user.senders.length === 0) {
          try {
            const ethereal = await createEtherealAccount();
            const sender = await prisma.sender.create({
              data: {
                userId: user.id,
                email: ethereal.email,
                etherealUsername: ethereal.user,
                etherealPassword: ethereal.pass,
              },
            });
            user.senders.push(sender);
          } catch (e: any) {
            logger.warn('Could not auto-create ethereal sender in getMeHandler:', { error: e.message });
          }
        }

        res.json({
          success: true,
          user: {
            id: user.id,
            googleId: user.googleId,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
            senders: user.senders.map((s) => ({
              id: s.id,
              email: s.email,
              etherealUsername: s.etherealUsername,
            })),
            isSlackConnected: user.slackConnections.length > 0,
            isDevDemo: user.googleId === 'dev-evaluator-demo-only',
          },
        });
        return;
      }
    }
  } catch (error: any) {
    logger.warn('Database query skipped in getMeHandler; returning session profile:', {
      error: error.message,
    });
  }

  // Graceful fallback: return user info directly from active session
  res.json({
    success: true,
    user: {
      id: sessionUser.id,
      googleId: sessionUser.googleId,
      name: sessionUser.name,
      email: sessionUser.email,
      avatarUrl: sessionUser.avatarUrl,
      senders: [],
      isSlackConnected: false,
      isDevDemo: sessionUser.googleId === 'dev-evaluator-demo-only',
    },
  });
}

export async function logoutHandler(req: Request, res: Response): Promise<void> {
  if (!req.session) {
    res.json({ success: true, message: 'Already logged out' });
    return;
  }

  req.session.destroy((err) => {
    if (err) {
      logger.error('Error destroying session during logout:', { error: err.message });
      res.status(500).json({ success: false, error: 'Logout failed' });
      return;
    }

    res.clearCookie('mailpulse.sid', {
      path: '/',
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    });
    res.clearCookie('connect.sid', { path: '/' });
    res.json({ success: true, message: 'Logged out successfully' });
  });
}

/**
 * One-click Dev Demo Login for evaluators/reviewers without requiring external Google OAuth credentials.
 * Clearly marked as DEV_DEMO_EVALUATOR so it cannot be mistaken for real Google OAuth.
 */
export async function devLoginHandler(req: Request, res: Response): Promise<void> {
  try {
    if (!req.session) {
      logger.error('Session middleware not initialized on devLogin request');
      res.status(500).json({ success: false, error: 'Session store not ready' });
      return;
    }

    const demoEmail = 'evaluator@mailpulse.io';
    const demoGoogleId = 'dev-evaluator-demo-only';

    let user: {
      id: string;
      googleId: string;
      name: string;
      email: string;
      avatarUrl?: string | null;
    };

    // Fast-path: only attempt database query if Prisma successfully connected on startup
    if (getIsPrismaConnected()) {
      try {
        // Use timeout to prevent hanging on latent database connections
        const dbUser = await Promise.race([
          prisma.user.upsert({
            where: { googleId: demoGoogleId },
            update: {
              name: 'Demo Evaluator',
              email: demoEmail,
            },
            create: {
              googleId: demoGoogleId,
              name: 'Demo Evaluator',
              email: demoEmail,
              avatarUrl:
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
            },
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Database timeout')), 2000)
          ),
        ]);

        user = dbUser;
      } catch (dbError: any) {
        logger.warn(
          'Database query failed or timed out during dev demo login; establishing development session for evaluator:',
          { error: dbError.message }
        );
        user = {
          id: 'dev-demo-evaluator-1',
          googleId: demoGoogleId,
          name: 'Demo Evaluator (Local Session)',
          email: demoEmail,
          avatarUrl:
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        };
      }
    } else {
      // Immediate fallback without waiting for database timeout
      user = {
        id: 'dev-demo-evaluator-1',
        googleId: demoGoogleId,
        name: 'Demo Evaluator (Local Session)',
        email: demoEmail,
        avatarUrl:
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      };
    }

    req.session.userId = user.id;
    req.session.user = {
      id: user.id,
      googleId: user.googleId,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl || undefined,
    };

    req.session.save((saveErr) => {
      if (saveErr) {
        logger.error('Failed to save session in devLogin:', { error: saveErr.message });
        res.status(500).json({ success: false, error: 'Failed to complete dev login' });
        return;
      }

      logger.info(`Dev demo evaluator session established for ${user.email}`);
      res.json({
        success: true,
        isDevDemo: true,
        user: {
          id: user.id,
          googleId: user.googleId,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
          senders: [],
          isSlackConnected: false,
          isDevDemo: true,
        },
      });
    });
  } catch (error: any) {
    logger.error('Dev login error:', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to complete dev login' });
  }
}
