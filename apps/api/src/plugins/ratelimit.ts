/**
 * ratelimit plugin
 * ----------------
 * In-memory token bucket rate limiter.
 * Limits: per-client-key (RPM) and per-merchant (RPM).
 * Designed to drop in Redis for horizontal scale without API changes.
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const CLIENT_RPM = parseInt(process.env['RATE_LIMIT_RPM'] ?? '60', 10);
const MERCHANT_RPM = parseInt(process.env['RATE_LIMIT_MERCHANT_RPM'] ?? '300', 10);
const REFILL_INTERVAL_MS = 60_000;

const clientBuckets = new Map<string, Bucket>();
const merchantBuckets = new Map<string, Bucket>();

function consume(buckets: Map<string, Bucket>, key: string, limit: number): boolean {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { tokens: limit - 1, lastRefill: now };
    buckets.set(key, bucket);
    return true;
  }

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill;
  if (elapsed >= REFILL_INTERVAL_MS) {
    bucket.tokens = limit;
    bucket.lastRefill = now;
  }

  if (bucket.tokens <= 0) return false;
  bucket.tokens -= 1;
  return true;
}

const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.url.startsWith('/ai/')) return;
    if (!request.merchant || !request.client) return;

    const clientAllowed = consume(clientBuckets, request.client.id, CLIENT_RPM);
    const merchantAllowed = consume(merchantBuckets, request.merchant.id, MERCHANT_RPM);

    if (!clientAllowed || !merchantAllowed) {
      return reply.code(429).send({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please slow down.',
          request_id: request.id,
        },
      });
    }
  });
};

export default fp(rateLimitPlugin, { name: 'ratelimit', dependencies: ['auth'] });
