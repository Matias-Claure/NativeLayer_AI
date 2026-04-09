/**
 * policy plugin
 * -------------
 * Enforces capability toggles for each /ai/* endpoint.
 * Default-deny: if a capability is not explicitly enabled, the request is rejected with 403.
 *
 * Cache: per-merchant capability map, 30-second TTL.
 * On multi-instance deploys this cache is per-instance; replace with Redis for horizontal scale.
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { endpointSettings } from '../db/schema.js';
import type { Capability } from '@nativelayer/schemas';

// Route path → capability name mapping
const PATH_CAPABILITY_MAP: Record<string, Capability> = {
  '/ai/search': 'search',
  '/ai/cart': 'cart',
  '/ai/checkout-handoff': 'checkout_handoff',
};

function getCapabilityForPath(path: string): Capability | null {
  // Strip query string
  const basePath = path.split('?')[0] ?? path;
  if (basePath.startsWith('/ai/product/')) return 'product_detail';
  return PATH_CAPABILITY_MAP[basePath] ?? null;
}

// Cache: merchantId → { capability → enabled, fetchedAt }
interface CacheEntry {
  capabilities: Map<string, boolean>;
  fetchedAt: number;
}
const CACHE_TTL_MS = 30_000;
const _cache = new Map<string, CacheEntry>();

async function isCapabilityEnabled(merchantId: string, capability: Capability): Promise<boolean> {
  const now = Date.now();
  const cached = _cache.get(merchantId);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.capabilities.get(capability) ?? false;
  }

  // Fetch all capabilities for this merchant from DB
  const db = getDb();
  const rows = await db
    .select()
    .from(endpointSettings)
    .where(eq(endpointSettings.merchant_id, merchantId));

  const capabilities = new Map<string, boolean>();
  for (const row of rows) {
    capabilities.set(row.capability, row.enabled);
  }
  _cache.set(merchantId, { capabilities, fetchedAt: now });

  return capabilities.get(capability) ?? false;
}

/** Invalidate the cache for a merchant (call after toggling capabilities in dashboard). */
export function invalidatePolicyCache(merchantId: string): void {
  _cache.delete(merchantId);
}

const policyPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.url.startsWith('/ai/')) return;
    // auth plugin runs first and sets request.merchant
    if (!request.merchant) return; // will already have a 401 queued

    const capability = getCapabilityForPath(request.url);
    if (!capability) return; // unknown path — let the route handler return 404

    const enabled = await isCapabilityEnabled(request.merchant.id, capability).catch(() => false);
    if (!enabled) {
      return reply.code(403).send({
        error: {
          code: 'CAPABILITY_DISABLED',
          message: `The '${capability}' capability is not enabled for this merchant.`,
          request_id: request.id,
        },
      });
    }
  });
};

export default fp(policyPlugin, { name: 'policy', dependencies: ['auth'] });
