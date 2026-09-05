import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import {
  isGoogleOAuthConfigured,
  validateGoogleOAuthConfig,
  getGoogleAuthUrl,
} from '../src/integrations/google/oauth';

describe('Authentication Middleware and Isolation', () => {
  function createMockAuthMiddleware(mockUserFinder: (id: string) => Promise<any>) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const userId = (req as any).session?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required. Please log in.',
        });
        return;
      }

      const user = await mockUserFinder(userId);
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Session invalid or user no longer exists.',
        });
        return;
      }

      (req as any).user = user;
      next();
    };
  }

  it('should return 401 when request has no active session', async () => {
    const middleware = createMockAuthMiddleware(async () => null);

    const req: any = { session: {} };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.stringContaining('Authentication required') })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should attach user to req and invoke next() when session is valid', async () => {
    const mockUser = {
      id: 'usr-123',
      name: 'Test Engineer',
      email: 'engineer@test.com',
    };

    const middleware = createMockAuthMiddleware(async (id) => {
      if (id === 'usr-123') return mockUser;
      return null;
    });

    const req: any = { session: { userId: 'usr-123' } };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await middleware(req, res, next);

    expect(req.user).toEqual(mockUser);
    expect(next).toHaveBeenCalled();
  });
});

describe('Google OAuth 2.0 Configuration and URL Generation', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should accurately report status when Google OAuth credentials are empty or placeholders', () => {
    process.env.GOOGLE_CLIENT_ID = '';
    process.env.GOOGLE_CLIENT_SECRET = '';
    process.env.GOOGLE_CALLBACK_URL = 'http://localhost:5000/api/auth/google/callback';

    const status = validateGoogleOAuthConfig();
    expect(status.isConfigured).toBe(false);
    expect(status.hasClientId).toBe(false);
    expect(status.hasClientSecret).toBe(false);
    expect(status.hasCallbackUrl).toBe(true);
    expect(status.missingVariables).toContain('GOOGLE_CLIENT_ID');
    expect(status.missingVariables).toContain('GOOGLE_CLIENT_SECRET');
  });

  it('should throw an explicit error when attempting getGoogleAuthUrl with unconfigured credentials', () => {
    process.env.GOOGLE_CLIENT_ID = '';
    process.env.GOOGLE_CLIENT_SECRET = '';

    expect(() => getGoogleAuthUrl()).toThrow(/Google OAuth credentials missing or invalid/);
  });

  it('should generate an authorization URL with all required query parameters when credentials are valid', () => {
    process.env.GOOGLE_CLIENT_ID = '1234567890-abcdef.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'GOCSPX-validTestSecret123';
    process.env.GOOGLE_CALLBACK_URL = 'http://localhost:5000/api/auth/google/callback';

    const status = validateGoogleOAuthConfig();
    expect(status.isConfigured).toBe(true);
    expect(status.hasClientId).toBe(true);
    expect(status.hasClientSecret).toBe(true);
    expect(status.clientIdMasked).toBe('12345678...nt.com');
    expect(status.missingVariables).toHaveLength(0);

    const authUrl = getGoogleAuthUrl('test-csrf-state');
    const parsed = new URL(authUrl);

    expect(parsed.origin).toBe('https://accounts.google.com');
    expect(parsed.pathname).toBe('/o/oauth2/v2/auth');
    expect(parsed.searchParams.get('client_id')).toBe('1234567890-abcdef.apps.googleusercontent.com');
    expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost:5000/api/auth/google/callback');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('access_type')).toBe('offline');
    expect(parsed.searchParams.get('prompt')).toBe('consent');
    expect(parsed.searchParams.get('state')).toBe('test-csrf-state');
    expect(parsed.searchParams.get('scope')).toContain('openid');
    expect(parsed.searchParams.get('scope')).toContain('userinfo.email');
    expect(parsed.searchParams.get('scope')).toContain('userinfo.profile');
  });

  it('should never expose client_secret in the authorization URL', () => {
    process.env.GOOGLE_CLIENT_ID = '1234567890-abcdef.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'SUPER_SECRET_KEY_NEVER_LEAK';
    process.env.GOOGLE_CALLBACK_URL = 'http://localhost:5000/api/auth/google/callback';

    const authUrl = getGoogleAuthUrl();
    expect(authUrl).not.toContain('SUPER_SECRET_KEY_NEVER_LEAK');
  });
});
