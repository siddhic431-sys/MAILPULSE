import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

export interface GoogleUserProfile {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface GoogleOAuthConfigStatus {
  isConfigured: boolean;
  hasClientId: boolean;
  hasClientSecret: boolean;
  hasCallbackUrl: boolean;
  clientIdMasked?: string;
  clientSecretLength?: number;
  callbackUrl: string;
  missingVariables: string[];
}

/**
 * Validates Google OAuth environment configuration without leaking secrets.
 */
export function validateGoogleOAuthConfig(): GoogleOAuthConfigStatus {
  const clientId = (process.env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET || '').trim();
  const callbackUrl = (process.env.GOOGLE_CALLBACK_URL || env.GOOGLE_CALLBACK_URL || '').trim();

  const missingVariables: string[] = [];

  const hasClientId = Boolean(
    clientId.length > 0 &&
    !clientId.includes('your-google-client-id') &&
    !clientId.includes('your-client-id')
  );
  if (!hasClientId) missingVariables.push('GOOGLE_CLIENT_ID');

  const hasClientSecret = Boolean(
    clientSecret.length > 0 &&
    !clientSecret.includes('your-google-client-secret') &&
    !clientSecret.includes('your-client-secret')
  );
  if (!hasClientSecret) missingVariables.push('GOOGLE_CLIENT_SECRET');

  const hasCallbackUrl = Boolean(
    callbackUrl.length > 0 &&
    (callbackUrl.startsWith('http://') || callbackUrl.startsWith('https://'))
  );
  if (!hasCallbackUrl) missingVariables.push('GOOGLE_CALLBACK_URL');

  const isConfigured = hasClientId && hasClientSecret && hasCallbackUrl;

  const clientIdMasked = hasClientId
    ? clientId.length > 14
      ? `${clientId.substring(0, 8)}...${clientId.substring(clientId.length - 6)}`
      : '***'
    : undefined;

  return {
    isConfigured,
    hasClientId,
    hasClientSecret,
    hasCallbackUrl,
    clientIdMasked,
    clientSecretLength: hasClientSecret ? clientSecret.length : undefined,
    callbackUrl: callbackUrl || env.GOOGLE_CALLBACK_URL,
    missingVariables,
  };
}

/**
 * Checks whether Google OAuth is fully configured with non-empty client ID & secret.
 */
export function isGoogleOAuthConfigured(): boolean {
  return validateGoogleOAuthConfig().isConfigured;
}

/**
 * Startup validation that reports OAuth status without exposing secret values.
 */
export function reportGoogleOAuthStatus(): void {
  const status = validateGoogleOAuthConfig();

  if (status.isConfigured) {
    logger.info('=======================================================');
    logger.info('[OAUTH STATUS] Google OAuth 2.0 is ACTIVE & CONFIGURED');
    logger.info(`- Client ID:     ${status.clientIdMasked}`);
    logger.info(`- Client Secret: [CONFIGURED - ${status.clientSecretLength} chars]`);
    logger.info(`- Callback URL:  ${status.callbackUrl}`);
    logger.info('=======================================================');
  } else {
    logger.warn('=======================================================');
    logger.warn('[OAUTH STATUS] Google OAuth 2.0 is NOT configured in backend/.env');
    logger.warn(`- Missing Variables:    ${status.missingVariables.join(', ') || 'None'}`);
    logger.warn(`- GOOGLE_CLIENT_ID:     ${status.hasClientId ? '[SET]' : 'MISSING / EMPTY'}`);
    logger.warn(`- GOOGLE_CLIENT_SECRET: ${status.hasClientSecret ? '[SET]' : 'MISSING / EMPTY'}`);
    logger.warn(`- GOOGLE_CALLBACK_URL:  ${status.callbackUrl}`);
    logger.warn('To enable real Google sign-in:');
    logger.warn('1. Create OAuth 2.0 Web Application credentials in Google Cloud Console');
    logger.warn(`2. Add Authorized Redirect URI: ${status.callbackUrl}`);
    logger.warn('3. Configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env');
    logger.warn('=======================================================');
  }
}

/**
 * Instantiates the Google OAuth2 client with validated credentials.
 */
export function getGoogleOAuthClient(): OAuth2Client {
  const clientId = (process.env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET || '').trim();
  const callbackUrl = (process.env.GOOGLE_CALLBACK_URL || env.GOOGLE_CALLBACK_URL || '').trim();

  return new OAuth2Client({
    clientId,
    clientSecret,
    redirectUri: callbackUrl,
  });
}

/**
 * Generates the Google OAuth authorization URL.
 * Throws an explicit error if GOOGLE_CLIENT_ID or SECRET is not configured.
 */
export function getGoogleAuthUrl(state?: string): string {
  const status = validateGoogleOAuthConfig();
  if (!status.isConfigured) {
    throw new Error(
      `Google OAuth credentials missing or invalid in backend/.env: ${status.missingVariables.join(', ')}`
    );
  }

  const oauth2Client = getGoogleOAuthClient();

  const scopes = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid',
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    include_granted_scopes: true,
    response_type: 'code',
    state,
    prompt: 'consent',
  });

  // Strict verification that generated URL contains all required OAuth 2.0 query parameters
  const parsed = new URL(authUrl);
  if (!parsed.searchParams.get('client_id')) {
    throw new Error('Generated Google OAuth authorization URL is missing client_id parameter');
  }
  if (!parsed.searchParams.get('redirect_uri')) {
    throw new Error('Generated Google OAuth authorization URL is missing redirect_uri parameter');
  }
  if (parsed.searchParams.get('response_type') !== 'code') {
    throw new Error('Generated Google OAuth authorization URL is missing response_type=code parameter');
  }

  return authUrl;
}

/**
 * Exchanges the one-time authorization code with Google for tokens and extracts verified profile.
 */
export async function verifyGoogleCodeAndGetProfile(code: string): Promise<GoogleUserProfile> {
  const oauth2Client = getGoogleOAuthClient();

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  if (!tokens.id_token) {
    throw new Error('No id_token received from Google OAuth token exchange');
  }

  const clientId = (process.env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID || '').trim();
  const ticket = await oauth2Client.verifyIdToken({
    idToken: tokens.id_token,
    audience: clientId,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email) {
    throw new Error('Failed to extract valid user profile from Google ID token');
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name || payload.email.split('@')[0],
    avatarUrl: payload.picture,
  };
}
