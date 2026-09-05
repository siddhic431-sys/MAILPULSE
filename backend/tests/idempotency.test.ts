describe('Idempotency and Atomic State Transition', () => {
  type EmailStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED';

  interface MockEmail {
    id: string;
    status: EmailStatus;
    sentAt: Date | null;
  }

  class MockDb {
    emails: Map<string, MockEmail> = new Map();

    insert(email: MockEmail) {
      this.emails.set(email.id, { ...email });
    }

    /**
     * Simulates Prisma's atomic updateMany:
     * UPDATE "Email" SET status = 'PROCESSING'
     * WHERE id = $id AND status IN ('SCHEDULED', 'FAILED')
     */
    atomicClaim(id: string): { count: number } {
      const email = this.emails.get(id);
      if (!email) return { count: 0 };

      if (email.status === 'SCHEDULED' || email.status === 'FAILED') {
        email.status = 'PROCESSING';
        return { count: 1 };
      }
      return { count: 0 };
    }

    markSent(id: string) {
      const email = this.emails.get(id);
      if (email) {
        email.status = 'SENT';
        email.sentAt = new Date();
      }
    }
  }

  it('should allow only ONE worker to successfully claim a job when multiple workers attempt simultaneously', () => {
    const db = new MockDb();
    const emailId = 'email-race-test-01';
    db.insert({ id: emailId, status: 'SCHEDULED', sentAt: null });

    // Worker 1 and Worker 2 attempt to claim simultaneously
    const worker1Claim = db.atomicClaim(emailId);
    const worker2Claim = db.atomicClaim(emailId);

    expect(worker1Claim.count).toBe(1); // Worker 1 won the atomic claim
    expect(worker2Claim.count).toBe(0); // Worker 2 was rejected
    expect(db.emails.get(emailId)?.status).toBe('PROCESSING');
  });

  it('should NEVER allow an email already marked SENT to be claimed or sent again', () => {
    const db = new MockDb();
    const emailId = 'email-sent-test-02';
    db.insert({ id: emailId, status: 'SENT', sentAt: new Date() });

    const claimAttempt = db.atomicClaim(emailId);
    expect(claimAttempt.count).toBe(0);
    expect(db.emails.get(emailId)?.status).toBe('SENT');
  });

  it('should allow retrying a FAILED email by claiming it back into PROCESSING', () => {
    const db = new MockDb();
    const emailId = 'email-retry-test-03';
    db.insert({ id: emailId, status: 'FAILED', sentAt: null });

    const retryClaim = db.atomicClaim(emailId);
    expect(retryClaim.count).toBe(1);
    expect(db.emails.get(emailId)?.status).toBe('PROCESSING');
  });
});
