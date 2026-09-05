import { getElasticsearchClient, ES_INDEX_EMAILS } from '../../lib/elasticsearch';
import { logger } from '../../utils/logger';

export interface EmailDocument {
  id: string;
  userId: string;
  campaignId: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string | Date;
  sentAt?: string | Date | null;
  createdAt: string | Date;
}

export async function indexEmailDocument(doc: EmailDocument): Promise<void> {
  const es = getElasticsearchClient();
  try {
    await es.index({
      index: ES_INDEX_EMAILS,
      id: doc.id,
      document: {
        id: doc.id,
        userId: doc.userId,
        campaignId: doc.campaignId,
        sender: doc.sender,
        recipient: doc.recipient,
        subject: doc.subject,
        body: doc.body,
        status: doc.status,
        scheduledAt: new Date(doc.scheduledAt).toISOString(),
        sentAt: doc.sentAt ? new Date(doc.sentAt).toISOString() : null,
        createdAt: new Date(doc.createdAt).toISOString(),
      },
      refresh: 'wait_for',
    });
    logger.debug(`Email indexed in Elasticsearch: ${doc.id}`);
  } catch (error: any) {
    logger.warn(`Failed to index email ${doc.id} in Elasticsearch:`, { error: error.message });
  }
}

export async function updateEmailDocumentStatus({
  id,
  status,
  sentAt,
  errorMessage,
}: {
  id: string;
  status: string;
  sentAt?: Date | null;
  errorMessage?: string | null;
}): Promise<void> {
  const es = getElasticsearchClient();
  try {
    await es.update({
      index: ES_INDEX_EMAILS,
      id,
      doc: {
        status,
        sentAt: sentAt ? sentAt.toISOString() : null,
        errorMessage: errorMessage || null,
      },
      refresh: 'wait_for',
    });
    logger.debug(`Email updated in Elasticsearch: ${id} -> ${status}`);
  } catch (error: any) {
    logger.warn(`Failed to update email ${id} status in Elasticsearch:`, { error: error.message });
  }
}

export async function searchEmails({
  userId,
  query,
  page = 1,
  limit = 20,
}: {
  userId: string;
  query?: string;
  page?: number;
  limit?: number;
}): Promise<{
  data: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const es = getElasticsearchClient();
  const from = (page - 1) * limit;

  try {
    const filterClauses: any[] = [{ term: { userId } }];

    let queryClause: any = { match_all: {} };

    if (query && query.trim()) {
      const q = query.trim();
      queryClause = {
        multi_match: {
          query: q,
          fields: ['recipient^3', 'sender^2', 'subject^2', 'body', 'status'],
          fuzziness: 'AUTO',
        },
      };
    }

    const response = await es.search({
      index: ES_INDEX_EMAILS,
      from,
      size: limit,
      query: {
        bool: {
          filter: filterClauses,
          must: queryClause,
        },
      },
      sort: [{ scheduledAt: { order: 'desc' } }],
    });

    const totalValue =
      typeof response.hits.total === 'number'
        ? response.hits.total
        : response.hits.total?.value || 0;

    const data = response.hits.hits.map((hit: any) => ({
      ...hit._source,
      score: hit._score,
    }));

    return {
      data,
      total: totalValue,
      page,
      limit,
      totalPages: Math.ceil(totalValue / limit) || 1,
    };
  } catch (error: any) {
    logger.warn('Elasticsearch search error; returning empty results gracefully:', {
      error: error.message,
    });
    return {
      data: [],
      total: 0,
      page,
      limit,
      totalPages: 1,
    };
  }
}
