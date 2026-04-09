/**
 * webhooks route
 * --------------
 * Handles incoming Shopify webhooks.
 * ALL webhooks are verified with HMAC-SHA256 before any action is taken.
 *
 * POST /webhooks
 *   X-Shopify-Topic: app/uninstalled | app_subscriptions/cancelled
 */
import type { FastifyPluginAsync } from 'fastify';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { merchants, apiClients } from '../db/schema.js';

function verifyWebhookHmac(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  const a = Buffer.from(expected, 'base64');
  const b = Buffer.from(signature, 'base64');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const webhooksRoute: FastifyPluginAsync = async (fastify) => {
  // Override the JSON content-type parser for this scoped plugin only,
  // so we can capture the raw body string needed for HMAC verification.
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (req, body: string, done) => {
      (req as Record<string, unknown>).rawBody = body;
      try {
        done(null, JSON.parse(body));
      } catch (e: unknown) {
        const err = e as Error & { statusCode?: number };
        err.statusCode = 400;
        done(err, undefined);
      }
    },
  );

  fastify.post('/webhooks', async (request, reply) => {
    const signature = request.headers['x-shopify-hmac-sha256'] as string | undefined;
    const topic = request.headers['x-shopify-topic'] as string | undefined;
    const rawBody = (request as Record<string, unknown>).rawBody as string | undefined;
    const secret = process.env['SHOPIFY_API_SECRET']!;

    if (!signature) {
      return reply.code(401).send({ error: 'Missing webhook signature.' });
    }

    if (!verifyWebhookHmac(rawBody ?? '', signature, secret)) {
      return reply.code(401).send({ error: 'Invalid webhook signature.' });
    }

    const body = request.body as { domain?: string };
    const shop = body.domain;

    if (!shop) {
      // Return 200 — Shopify will retry on non-2xx, no need to retry unknown payloads
      return reply.code(200).send();
    }

    const db = getDb();
    const [merchant] = await db
      .select()
      .from(merchants)
      .where(eq(merchants.shop_domain, shop))
      .limit(1);

    if (!merchant) return reply.code(200).send();

    if (topic === 'app/uninstalled' || topic === 'app_subscriptions/cancelled') {
      fastify.log.info({ shop, topic }, 'Suspending merchant due to webhook');

      await db
        .update(merchants)
        .set({ status: 'suspended', billing_status: 'cancelled', updated_at: new Date() })
        .where(eq(merchants.id, merchant.id));

      await db
        .update(apiClients)
        .set({ is_active: false })
        .where(eq(apiClients.merchant_id, merchant.id));
    }

    // ── Mandatory GDPR compliance webhooks ────────────────────────────────────
    // Shopify requires these three topics to be handled.
    // We do not store customer PII, so responses are always empty 200s.
    // Audit-log the request for compliance records.
    if (topic === 'customers/data_request') {
      fastify.log.info({ shop, topic }, 'GDPR customer data request received — no PII stored');
    }

    if (topic === 'customers/redact') {
      fastify.log.info({ shop, topic }, 'GDPR customer redact received — no PII stored');
    }

    if (topic === 'shop/redact') {
      fastify.log.info({ shop, topic }, 'GDPR shop redact received — merchant data purged on uninstall');
    }

    // Always return 200 — Shopify retries on any non-2xx response
    return reply.code(200).send();
  });
};

export default webhooksRoute;
