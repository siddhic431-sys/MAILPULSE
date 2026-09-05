import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export const ES_INDEX_EMAILS = 'mailpulse-emails';

let client: Client | null = null;

export function getElasticsearchClient(): Client {
  if (!client) {
    const options: any = {
      node: env.ELASTICSEARCH_URL,
    };

    if (env.ELASTICSEARCH_USERNAME && env.ELASTICSEARCH_PASSWORD) {
      options.auth = {
        username: env.ELASTICSEARCH_USERNAME,
        password: env.ELASTICSEARCH_PASSWORD,
      };
    }

    client = new Client(options);
  }
  return client;
}

export async function initElasticsearchIndex(): Promise<boolean> {
  const es = getElasticsearchClient();
  try {
    const exists = await es.indices.exists({ index: ES_INDEX_EMAILS });

    if (!exists) {
      await es.indices.create({
        index: ES_INDEX_EMAILS,
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
          analysis: {
            analyzer: {
              email_analyzer: {
                type: 'custom',
                tokenizer: 'uax_url_email',
                filter: ['lowercase'],
              },
            },
          },
        },
        mappings: {
          properties: {
            id: { type: 'keyword' },
            userId: { type: 'keyword' },
            campaignId: { type: 'keyword' },
            sender: {
              type: 'text',
              analyzer: 'email_analyzer',
              fields: { keyword: { type: 'keyword' } },
            },
            recipient: {
              type: 'text',
              analyzer: 'email_analyzer',
              fields: { keyword: { type: 'keyword' } },
            },
            subject: { type: 'text' },
            body: { type: 'text' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
            createdAt: { type: 'date' },
          },
        },
      });
      logger.info(`Elasticsearch index [${ES_INDEX_EMAILS}] created successfully`);
    } else {
      logger.info(`Elasticsearch index [${ES_INDEX_EMAILS}] already exists`);
    }
    return true;
  } catch (error: any) {
    logger.warn('Elasticsearch initialization warning (is Elasticsearch running?):', {
      error: error.message,
    });
    return false;
  }
}
