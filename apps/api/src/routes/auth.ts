/**
 * auth route
 * ----------
 * Handles the Shopify OAuth installation flow.
 *
 * GET /auth/shopify  — entry point; redirects merchant to Shopify consent screen
 * GET /auth/callback — Shopify redirects here after merchant approves
 */
import type { FastifyPluginAsync } from 'fastify';
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { encrypt, getEncryptionKey } from '@nativelayer/security';
import { getDb } from '../db/client.js';
import { merchants } from '../db/schema.js';

// ---------------------------------------------------------------------------
// Nonce store — short-lived in-memory map to prevent CSRF during OAuth
// ---------------------------------------------------------------------------
const _nonces = new Map<string, { value: string; expiresAt: number }>();

function storeNonce(shop: string, nonce: string): void {
  _nonces.set(shop, { value: nonce, expiresAt: Date.now() + 10 * 60 * 1000 });
}

function consumeNonce(shop: string, nonce: string): boolean {
  const entry = _nonces.get(shop);
  _nonces.delete(shop);
  if (!entry || Date.now() > entry.expiresAt) return false;
  return entry.value === nonce;
}

// ---------------------------------------------------------------------------
// HMAC verification for the OAuth callback query string
// ---------------------------------------------------------------------------
function verifyShopifyHmac(query: Record<string, string>, secret: string): boolean {
  const { hmac, ...rest } = query;
  if (!hmac) return false;
  const message = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join('&');
  const expected = createHmac('sha256', secret).update(message).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(hmac, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------
const authRoute: FastifyPluginAsync = async (fastify) => {
  // Step 1 — redirect merchant to Shopify's OAuth consent screen
  fastify.get('/auth/shopify', async (request, reply) => {
    const { shop } = request.query as { shop?: string };

    if (!shop || !shop.match(/^[a-zA-Z0-9-]+\.myshopify\.com$/)) {
      return reply.code(400).send({ error: 'Missing or invalid shop parameter.' });
    }

    const nonce = randomBytes(16).toString('hex');
    storeNonce(shop, nonce);

    const apiKey = process.env['SHOPIFY_API_KEY']!;
    const appUrl = process.env['APP_URL']!;
    const scopes = [
      'read_products',
      'unauthenticated_read_product_listings',
      'unauthenticated_read_product_inventory',
      'unauthenticated_read_selling_plans',
    ].join(',');

    const redirectUri = encodeURIComponent(`${appUrl}/auth/callback`);
    const authUrl =
      `https://${shop}/admin/oauth/authorize` +
      `?client_id=${apiKey}` +
      `&scope=${scopes}` +
      `&redirect_uri=${redirectUri}` +
      `&state=${nonce}`;

    return reply.redirect(authUrl);
  });

  // Step 2 — Shopify redirects here with an authorization code
  fastify.get('/auth/callback', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const { shop, code, state } = query;

    const apiKey = process.env['SHOPIFY_API_KEY']!;
    const apiSecret = process.env['SHOPIFY_API_SECRET']!;
    const appUrl = process.env['APP_URL']!;
    const apiVersion = process.env['SHOPIFY_API_VERSION'] ?? '2025-01';

    if (!shop || !code || !state) {
      return reply.code(400).send({ error: 'Missing required OAuth parameters.' });
    }

    // Verify Shopify's HMAC signature on the redirect
    if (!verifyShopifyHmac(query, apiSecret)) {
      return reply.code(401).send({ error: 'Invalid HMAC — request may have been tampered with.' });
    }

    // Verify our nonce to prevent CSRF
    if (!consumeNonce(shop, state)) {
      return reply.code(401).send({ error: 'Invalid or expired state parameter.' });
    }

    // Exchange the authorization code for a permanent Admin API access token
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: apiKey, client_secret: apiSecret, code }),
    });

    if (!tokenRes.ok) {
      fastify.log.error({ shop, status: tokenRes.status }, 'Failed to exchange OAuth code');
      return reply.code(500).send({ error: 'Failed to exchange authorization code.' });
    }

    const { access_token: adminToken } = (await tokenRes.json()) as { access_token: string };

    // Use the Admin API token to create a Storefront Access Token
    const sfRes = await fetch(
      `https://${shop}/admin/api/${apiVersion}/storefront_access_tokens.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': adminToken,
        },
        body: JSON.stringify({ storefront_access_token: { title: 'NativeLayer' } }),
      },
    );

    if (!sfRes.ok) {
      fastify.log.error({ shop, status: sfRes.status }, 'Failed to create Storefront Access Token');
      return reply.code(500).send({ error: 'Failed to create Storefront Access Token.' });
    }

    const sfData = (await sfRes.json()) as {
      storefront_access_token: { access_token: string };
    };
    const storefrontToken = sfData.storefront_access_token.access_token;

    // Encrypt both tokens before storing
    const encKey = getEncryptionKey();
    const encStorefront = encrypt(storefrontToken, encKey);
    const encAdmin = encrypt(adminToken, encKey);

    // Upsert merchant row (handles re-installs gracefully)
    const db = getDb();
    await db
      .insert(merchants)
      .values({
        shop_domain: shop,
        encrypted_shopify_token: encStorefront.ciphertext,
        token_iv: encStorefront.iv,
        token_tag: encStorefront.tag,
        shopify_admin_token: JSON.stringify(encAdmin),
        status: 'active',
        billing_status: 'pending',
      })
      .onConflictDoUpdate({
        target: merchants.shop_domain,
        set: {
          encrypted_shopify_token: encStorefront.ciphertext,
          token_iv: encStorefront.iv,
          token_tag: encStorefront.tag,
          shopify_admin_token: JSON.stringify(encAdmin),
          status: 'active',
          billing_status: 'pending',
          updated_at: new Date(),
        },
      });

    // Register required webhooks
    const webhookTopics = [
      'app/uninstalled',
      'app_subscriptions/cancelled',
      'customers/data_request',
      'customers/redact',
      'shop/redact',
    ];
    for (const topic of webhookTopics) {
      const whRes = await fetch(`https://${shop}/admin/api/${apiVersion}/webhooks.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': adminToken,
        },
        body: JSON.stringify({
          webhook: { topic, address: `${appUrl}/webhooks`, format: 'json' },
        }),
      });
      if (!whRes.ok) {
        fastify.log.warn({ shop, topic, status: whRes.status }, 'Failed to register webhook');
      }
    }

    fastify.log.info({ shop }, 'OAuth install complete — redirecting to billing');
    return reply.redirect(`${appUrl}/billing/confirm?shop=${encodeURIComponent(shop)}`);
  });
};

export default authRoute;
