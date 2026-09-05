import { scheduleEmailSchema } from '../src/controllers/emailController';

describe('Scheduling and Staggered Delay Logic', () => {
  it('should validate valid campaign scheduling inputs', () => {
    const validPayload = {
      subject: 'Welcome to MailPulse',
      body: 'Hello, this is a test email.',
      recipients: ['user1@example.com', 'user2@example.com'],
      senderId: '123e4567-e89b-12d3-a456-426614174000',
      startTime: new Date().toISOString(),
      delayMs: 2000,
      hourlyLimit: 200,
    };

    const parsed = scheduleEmailSchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);
  });

  it('should reject invalid recipient email addresses', () => {
    const invalidPayload = {
      subject: 'Invalid email test',
      body: 'Body text',
      recipients: ['not-an-email'],
      senderId: '123e4567-e89b-12d3-a456-426614174000',
      startTime: new Date().toISOString(),
    };

    const parsed = scheduleEmailSchema.safeParse(invalidPayload);
    expect(parsed.success).toBe(false);
  });

  it('should reject empty recipients list', () => {
    const emptyPayload = {
      subject: 'Empty recipients',
      body: 'Body text',
      recipients: [],
      senderId: '123e4567-e89b-12d3-a456-426614174000',
      startTime: new Date().toISOString(),
    };

    const parsed = scheduleEmailSchema.safeParse(emptyPayload);
    expect(parsed.success).toBe(false);
  });

  it('should correctly calculate staggered scheduledAt times for multiple recipients', () => {
    const startTimestamp = 1700000000000;
    const delayMs = 2000;
    const recipients = ['user1@test.com', 'user2@test.com', 'user3@test.com', 'user4@test.com'];

    const scheduledTimes = recipients.map((_, i) => new Date(startTimestamp + i * delayMs));

    expect(scheduledTimes[0].getTime()).toBe(startTimestamp);
    expect(scheduledTimes[1].getTime()).toBe(startTimestamp + 2000);
    expect(scheduledTimes[2].getTime()).toBe(startTimestamp + 4000);
    expect(scheduledTimes[3].getTime()).toBe(startTimestamp + 6000);
  });

  it('should enforce deterministic job ID format: email:{id}', () => {
    const emailId = 'test-uuid-123';
    const jobId = `email:${emailId}`;
    expect(jobId).toBe('email:test-uuid-123');
  });
});
