import { AuthenticatedUser } from './index';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    user?: AuthenticatedUser;
  }
}

export {};
