/**
 * auth plugin
 * -----------
 * Extracts X-API-Key from every /ai/* request, hashes it, looks up the
 * matching api_client and merchant in the DB, and decorates the request
 * with `request.merchant` and `request.client`.
 *
 * Also optionally enforces HMAC-SHA256 request signing when
 * REQUIRE_HMAC_SIGNING=true.
 *
 * Rejects with 401 if:
 *   - No API key is provided
 *   - Key not found / inactive
 *   - Merchant is suspended
 *   - HMAC is required but missing/invalid
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { eq } from 'drizzle-orm';
import { hashApiKey, verifyHmac } from '@nativelayer/security';
import { getDb } from '../db/client.js';
import { apiClients, merchants } from '../db/schema.js';
import type { Merchant, ApiClient } from '../db/schema.js';

declare module 'fastify' {
  interface FastifyRequest {
    merchant: Merchant;
    client: ApiClient;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Only protect /ai/* routes
    if (!request.url.startsWith('/ai/')) return;

    const rawKey = request.headers['x-api-key'];
    if (!rawKey || typeof rawKey !== 'string') {
      return reply.code(401).send(buildError('MISSING_API_KEY', 'X-API-Key header is required.', request.id as string));
    }

    const db = getDb();
    const keyHash = hashApiKey(rawKey);

    const [clientRow] = await db
      .select()
      .from(apiClients)
      .where(eq(apiClients.key_hash, keyHash))
      .limit(1);

    if (!clientRow || !clientRow.is_active) {
      return reply.code(401).send(buildError('INVALID_API_KEY', 'Invalid or revoked API key.', request.id as string));
    }

    const [merchantRow] = await db
      .select()
      .from(merchants)
      .where(eq(merchants.id, clientRow.merchant_id))
      .limit(1);

    if (!merchantRow || merchantRow.status !== 'active') {
      return reply.code(401).send(buildError('MERCHANT_SUSPENDED', 'Merchant account is suspended.', request.id as string));
    }

    // Optional HMAC verification
    if (process.env['REQUIRE_HMAC_SIGNING'] === 'true') {
      const signature = request.headers['x-signature'];
      if (!signature || typeof signature !== 'string') {
        return reply.code(401).send(buildError('MISSING_SIGNATURE', 'X-Signature header is required.', request.id as string));
      }
      // Use the API key itself as the HMAC secret for MVP
      const body = (request.body as string | undefined) ?? '';
      if (!verifyHmac(body, signature, rawKey)) {
        return reply.code(401).send(buildError('INVALID_SIGNATURE', 'Request signature is invalid.', request.id as string));
      }
    }

    // Update last_used_at asynchronously (fire and forget — don't block the request)
    void db
      .update(apiClients)
      .set({ last_used_at: new Date() })
      .where(eq(apiClients.id, clientRow.id))
      .catch(() => {/* non-critical */});

    request.merchant = merchantRow;
    request.client = clientRow;
  });
};

function buildError(code: string, message: string, requestId: string) {
  return { error: { code, message, request_id: requestId } };
}

export default fp(authPlugin, { name: 'auth' });
