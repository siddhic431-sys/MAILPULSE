export type EmailStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED';

export interface EmailJobData {
  emailId: string;
  campaignId: string;
  userId: string;
  senderId: string;
  attempt?: number;
}

export interface ScheduleCampaignInput {
  subject: string;
  body: string;
  recipients: string[];
  senderId: string;
  startTime: string; // ISO string
  delayMs?: number;
  hourlyLimit?: number;
}

export interface ParsedLeadResult {
  validEmails: string[];
  invalidEmails: string[];
  duplicatesRemoved: number;
  totalParsed: number;
}

export interface EmailSearchQuery {
  q?: string;
  page?: number;
  limit?: number;
}

export interface AuthenticatedUser {
  id: string;
  googleId: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}
