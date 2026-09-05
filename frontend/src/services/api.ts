import axios from 'axios';
import {
  User,
  Sender,
  Email,
  EmailStats,
  PaginatedResult,
  LeadParseResult,
  SlackStatus,
} from '../types';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Authentication
export const authApi = {
  getGoogleLoginUrl: () => '/api/auth/google',
  devLogin: async (): Promise<{ success: boolean; user: User }> => {
    const res = await api.post('/auth/dev-login');
    return res.data;
  },
  getMe: async (): Promise<{ success: boolean; user: User }> => {
    const res = await api.get('/auth/me');
    return res.data;
  },
  logout: async (): Promise<{ success: boolean }> => {
    const res = await api.post('/auth/logout');
    return res.data;
  },
};

// Senders
export const senderApi = {
  getSenders: async (): Promise<{ success: boolean; senders: Sender[] }> => {
    const res = await api.get('/senders');
    return res.data;
  },
  createSender: async (): Promise<{ success: boolean; sender: Sender }> => {
    const res = await api.post('/senders');
    return res.data;
  },
};

// Emails & Campaigns
export const emailApi = {
  scheduleCampaign: async (payload: {
    subject: string;
    body: string;
    recipients: string[];
    senderId: string;
    startTime: string;
    delayMs?: number;
    hourlyLimit?: number;
  }) => {
    const res = await api.post('/emails/schedule', payload);
    return res.data;
  },
  getScheduled: async (page = 1, limit = 10, search = ''): Promise<PaginatedResult<Email>> => {
    const res = await api.get('/emails/scheduled', { params: { page, limit, search } });
    return res.data;
  },
  getSent: async (page = 1, limit = 10, search = ''): Promise<PaginatedResult<Email>> => {
    const res = await api.get('/emails/sent', { params: { page, limit, search } });
    return res.data;
  },
  searchEmails: async (q: string, page = 1, limit = 10): Promise<PaginatedResult<Email>> => {
    const res = await api.get('/emails/search', { params: { q, page, limit } });
    return res.data;
  },
  getStats: async (): Promise<{ success: boolean; stats: EmailStats }> => {
    const res = await api.get('/emails/stats');
    return res.data;
  },
  parseLeads: async (formData: FormData): Promise<{ success: boolean } & LeadParseResult> => {
    const res = await api.post('/emails/parse-leads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  parseLeadsText: async (content: string): Promise<{ success: boolean } & LeadParseResult> => {
    const res = await api.post('/emails/parse-leads', { content });
    return res.data;
  },
};

// Slack
export const slackApi = {
  getConnectUrl: () => '/api/slack/connect',
  getStatus: async (): Promise<SlackStatus> => {
    const res = await api.get('/slack/status');
    return res.data;
  },
  disconnect: async () => {
    const res = await api.post('/slack/disconnect');
    return res.data;
  },
  testNotification: async () => {
    const res = await api.post('/slack/test');
    return res.data;
  },
  mockConnect: async () => {
    const res = await api.post('/slack/mock-connect');
    return res.data;
  },
};
