export type EmailStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED';

export interface User {
  id: string;
  googleId: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  senders?: Sender[];
  isSlackConnected?: boolean;
  isDevDemo?: boolean;
}

export interface Sender {
  id: string;
  email: string;
  etherealUsername: string;
  createdAt?: string;
}

export interface Email {
  id: string;
  campaignId: string;
  userId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt?: string | null;
  status: EmailStatus;
  bullmqJobId?: string | null;
  messageId?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  sender?: {
    email: string;
  };
}

export interface EmailStats {
  scheduled: number;
  processing: number;
  sent: number;
  failed: number;
  total: number;
}

export interface PaginatedResult<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface LeadParseResult {
  validEmails: string[];
  invalidEmails: string[];
  duplicatesRemoved: number;
  totalParsed: number;
}

export interface SlackStatus {
  isConnected: boolean;
  connection?: {
    id: string;
    teamId: string;
    channelId: string;
    createdAt: string;
  } | null;
}
