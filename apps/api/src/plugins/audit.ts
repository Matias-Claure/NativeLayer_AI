/**
 * audit plugin
 * ------------
 * Writes a redacted audit log entry after every /ai/* request completes.
 * Never logs secrets, tokens, or raw API keys.
 */
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { getDb } from '../db/client.js';
import { auditLogs } from '../db/schema.js';
import { redact } from '@nativelayer/observability';

const auditPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onResponse', async (request, reply) => {
    if (!request.url.startsWith('/ai/')) return;
    if (!request.merchant) return; // unauthenticated — already rejected upstream

    const startTime = (request as { startTime?: number }).startTime ?? Date.now();
    const latencyMs = Date.now() - startTime;

    // Build a redacted snapshot of the relevant request fields
    const requestSummary = redact({
      url: request.url,
      method: request.method,
      body: request.body,
    }) as Record<string, unknown>;

    // Strip any remaining sensitive-looking fields at the top level
    delete requestSummary['authorization'];

    const db = getDb();
    await db
      .insert(auditLogs)
      .values({
        merchant_id: request.merchant.id,
        client_id: request.client?.id ?? null,
        endpoint: request.routeOptions?.url ?? request.url,
        method: request.method,
        status_code: reply.statusCode,
        correlation_id: request.id as string,
        request_summary: requestSummary,
        latency_ms: latencyMs,
        ip_addr: request.ip ?? null,
      })
      .catch((err) => {
        // Audit log failure must NOT affect the response
        fastify.log.error({ err }, 'Failed to write audit log');
      });
  });
};

export default fp(auditPlugin, { name: 'audit', dependencies: ['auth'] });
