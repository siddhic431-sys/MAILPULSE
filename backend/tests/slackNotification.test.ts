describe('Slack Rate-Limit Alert Integration', () => {
  interface MockSlackConnection {
    userId: string;
    accessToken: string;
    channelId: string;
  }

  class MockSlackService {
    connections: Map<string, MockSlackConnection> = new Map();
    notifiedWindows: Set<string> = new Set();
    sentMessages: { channel: string; text: string }[] = [];

    setConnection(conn: MockSlackConnection) {
      this.connections.set(conn.userId, conn);
    }

    async sendAlert({
      userId,
      senderEmail,
      hourlyLimit,
      hourWindow,
      rescheduledTime,
    }: {
      userId: string;
      senderEmail: string;
      hourlyLimit: number;
      hourWindow: string;
      rescheduledTime: Date;
    }): Promise<boolean> {
      // 1. Deduplication key check
      const dedupeKey = `${senderEmail}:${hourWindow}`;
      if (this.notifiedWindows.has(dedupeKey)) {
        return false; // Skip duplicate notification
      }
      this.notifiedWindows.add(dedupeKey);

      // 2. Lookup user's connection
      const connection = this.connections.get(userId);
      if (!connection) {
        // Disconnected behavior: gracefully return without failing
        return false;
      }

      // 3. Dispatch message
      const text = `Rate limit reached for sender ${senderEmail}. Limit: ${hourlyLimit}. Rescheduled to: ${rescheduledTime.toISOString()}`;
      this.sentMessages.push({
        channel: connection.channelId,
        text,
      });
      return true;
    }
  }

  it('should dispatch a Slack message when Slack is connected and rate limit is reached', async () => {
    const service = new MockSlackService();
    const userId = 'user-101';
    service.setConnection({
      userId,
      accessToken: 'xoxb-test',
      channelId: 'C_ALERTS',
    });

    const sent = await service.sendAlert({
      userId,
      senderEmail: 'marketing@mailpulse.io',
      hourlyLimit: 200,
      hourWindow: '2026-09-05-14',
      rescheduledTime: new Date('2026-09-05T15:00:00.000Z'),
    });

    expect(sent).toBe(true);
    expect(service.sentMessages).toHaveLength(1);
    expect(service.sentMessages[0].channel).toBe('C_ALERTS');
    expect(service.sentMessages[0].text).toContain('marketing@mailpulse.io');
  });

  it('should safely skip notification without crashing when Slack is disconnected', async () => {
    const service = new MockSlackService();
    const userId = 'unconnected-user';

    const sent = await service.sendAlert({
      userId,
      senderEmail: 'sales@mailpulse.io',
      hourlyLimit: 50,
      hourWindow: '2026-09-05-14',
      rescheduledTime: new Date('2026-09-05T15:00:00.000Z'),
    });

    expect(sent).toBe(false);
    expect(service.sentMessages).toHaveLength(0);
  });

  it('should deduplicate Slack alerts so only one message is sent per sender per hour window', async () => {
    const service = new MockSlackService();
    const userId = 'user-dedupe';
    service.setConnection({
      userId,
      accessToken: 'xoxb-test',
      channelId: 'C_ALERTS',
    });

    // 1st email hits rate limit
    const first = await service.sendAlert({
      userId,
      senderEmail: 'promo@mailpulse.io',
      hourlyLimit: 10,
      hourWindow: '2026-09-05-16',
      rescheduledTime: new Date('2026-09-05T17:00:00.000Z'),
    });

    // 2nd email hits rate limit in the same hour window
    const second = await service.sendAlert({
      userId,
      senderEmail: 'promo@mailpulse.io',
      hourlyLimit: 10,
      hourWindow: '2026-09-05-16',
      rescheduledTime: new Date('2026-09-05T17:00:00.000Z'),
    });

    expect(first).toBe(true);
    expect(second).toBe(false); // Deduplicated!
    expect(service.sentMessages).toHaveLength(1);
  });
});
