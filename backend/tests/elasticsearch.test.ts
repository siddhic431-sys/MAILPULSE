describe('Elasticsearch Query Building & Multi-tenant Isolation', () => {
  function buildElasticsearchSearchQuery({
    userId,
    query,
    page = 1,
    limit = 20,
  }: {
    userId: string;
    query?: string;
    page?: number;
    limit?: number;
  }) {
    const from = (page - 1) * limit;

    // Strict user isolation filter
    const filterClauses = [{ term: { userId } }];

    let queryClause: any = { match_all: {} };

    if (query && query.trim()) {
      queryClause = {
        multi_match: {
          query: query.trim(),
          fields: ['recipient^3', 'sender^2', 'subject^2', 'body', 'status'],
          fuzziness: 'AUTO',
        },
      };
    }

    return {
      from,
      size: limit,
      body: {
        query: {
          bool: {
            filter: filterClauses,
            must: queryClause,
          },
        },
        sort: [{ scheduledAt: { order: 'desc' } }],
      },
    };
  }

  it('should always enforce userId filter in bool.filter to isolate user records', () => {
    const queryObj = buildElasticsearchSearchQuery({
      userId: 'user-tenant-xyz',
      query: 'quarterly update',
    });

    expect(queryObj.body.query.bool.filter).toContainEqual({
      term: { userId: 'user-tenant-xyz' },
    });
  });

  it('should build multi_match across recipient, sender, subject, body, and status', () => {
    const queryObj = buildElasticsearchSearchQuery({
      userId: 'user-tenant-xyz',
      query: 'newsletter',
    });

    const mustClause = queryObj.body.query.bool.must;
    expect(mustClause.multi_match).toBeDefined();
    expect(mustClause.multi_match.query).toBe('newsletter');
    expect(mustClause.multi_match.fields).toEqual([
      'recipient^3',
      'sender^2',
      'subject^2',
      'body',
      'status',
    ]);
  });

  it('should fall back to match_all when search term is empty or blank', () => {
    const queryObj = buildElasticsearchSearchQuery({
      userId: 'user-tenant-xyz',
      query: '   ',
    });

    expect(queryObj.body.query.bool.must).toEqual({ match_all: {} });
  });

  it('should calculate correct from/size pagination offsets', () => {
    const page2 = buildElasticsearchSearchQuery({
      userId: 'user-1',
      page: 3,
      limit: 15,
    });

    expect(page2.from).toBe(30);
    expect(page2.size).toBe(15);
  });
});
