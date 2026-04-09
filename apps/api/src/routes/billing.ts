/**
 * billing route
 * -------------
 * Handles Shopify recurring billing after OAuth install.
 *
 * GET /billing/confirm  — creates a recurring charge and redirects to Shopify approval
 * GET /billing/callback — Shopify redirects here after merchant approves or declines
 */
import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { decrypt, getEncryptionKey, generateApiKey } from '@nativelayer/security';
import { getDb } from '../db/client.js';
import { merchants, apiClients, endpointSettings } from '../db/schema.js';
import { storePendingKey } from '../pending-keys.js';

const CAPABILITIES = ['search', 'product_detail', 'cart', 'checkout_handoff'] as const;

function getAdminToken(merchant: { shopify_admin_token: string | null }, encKey: Buffer): string {
  if (!merchant.shopify_admin_token) throw new Error('No admin token on merchant');
  const enc = JSON.parse(merchant.shopify_admin_token) as {
    ciphertext: string;
    iv: string;
    tag: string;
  };
  return decrypt(enc, encKey);
}

const billingRoute: FastifyPluginAsync = async (fastify) => {
  // Redirect merchant to Shopify to approve the subscription charge
  fastify.get('/billing/confirm', async (request, reply) => {
    const { shop } = request.query as { shop?: string };
    if (!shop) return reply.code(400).send({ error: 'Missing shop parameter.' });

    const db = getDb();
    const [merchant] = await db
      .select()
      .from(merchants)
      .where(eq(merchants.shop_domain, shop))
      .limit(1);

    if (!merchant) return reply.code(404).send({ error: 'Merchant not found.' });

    // If already active, skip billing and go straight to the app
    if (merchant.billing_status === 'active') {
      const apiKey = process.env['SHOPIFY_API_KEY']!;
      return reply.redirect(`https://${shop}/admin/apps/${apiKey}`);
    }

    const encKey = getEncryptionKey();
    const adminToken = getAdminToken(merchant, encKey);
    const apiVersion = process.env['SHOPIFY_API_VERSION'] ?? '2025-01';
    const appUrl = process.env['APP_URL']!;
    const price = parseFloat(process.env['BILLING_PRICE'] ?? '49.00');
    const planName = process.env['BILLING_PLAN_NAME'] ?? 'NativeLayer AI';

    const res = await fetch(
      `https://${shop}/admin/api/${apiVersion}/recurring_application_charges.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': adminToken,
        },
        body: JSON.stringify({
          recurring_application_charge: {
            name: planName,
            price,
            return_url: `${appUrl}/billing/callback`,
          },
        }),
      },
    );

    if (!res.ok) {
      fastify.log.error({ shop, status: res.status }, 'Failed to create billing charge');
      return reply.code(500).send({ error: 'Failed to create billing charge.' });
    }

    const data = (await res.json()) as {
      recurring_application_charge: { confirmation_url: string; id: number };
    };

    const { confirmation_url, id: chargeId } = data.recurring_application_charge;

    await db
      .update(merchants)
      .set({ billing_charge_id: String(chargeId) })
      .where(eq(merchants.shop_domain, shop));

    return reply.redirect(confirmation_url);
  });

  // Shopify redirects here after the merchant approves or declines billing
  fastify.get('/billing/callback', async (request, reply) => {
    const { shop, charge_id } = request.query as { shop?: string; charge_id?: string };
    if (!shop || !charge_id) return reply.code(400).send({ error: 'Missing required parameters.' });

    const db = getDb();
    const [merchant] = await db
      .select()
      .from(merchants)
      .where(eq(merchants.shop_domain, shop))
      .limit(1);

    if (!merchant) return reply.code(404).send({ error: 'Merchant not found.' });

    const encKey = getEncryptionKey();
    const adminToken = getAdminToken(merchant, encKey);
    const apiVersion = process.env['SHOPIFY_API_VERSION'] ?? '2025-01';
    const apiKey = process.env['SHOPIFY_API_KEY']!;

    // Verify the charge status
    const chargeRes = await fetch(
      `https://${shop}/admin/api/${apiVersion}/recurring_application_charges/${charge_id}.json`,
      { headers: { 'X-Shopify-Access-Token': adminToken } },
    );

    if (!chargeRes.ok) {
      return reply.code(500).send({ error: 'Failed to verify billing charge.' });
    }

    const chargeData = (await chargeRes.json()) as {
      recurring_application_charge: { status: string };
    };

    if (chargeData.recurring_application_charge.status !== 'accepted') {
      // Merchant declined — redirect back to app with declined state
      return reply.redirect(`https://${shop}/admin/apps/${apiKey}`);
    }

    // Activate the charge
    await fetch(
      `https://${shop}/admin/api/${apiVersion}/recurring_application_charges/${charge_id}/activate.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': adminToken,
        },
        body: JSON.stringify({}),
      },
    );

    // Mark billing active
    await db
      .update(merchants)
      .set({ billing_status: 'active', billing_charge_id: charge_id, updated_at: new Date() })
      .where(eq(merchants.shop_domain, shop));

    // Enable all capabilities for this merchant
    for (const capability of CAPABILITIES) {
      await db
        .insert(endpointSettings)
        .values({ merchant_id: merchant.id, capability, enabled: true })
        .onConflictDoUpdate({
          target: [endpointSettings.merchant_id, endpointSettings.capability],
          set: { enabled: true, updated_at: new Date() },
        });
    }

    // Generate the merchant's API key — only shown once
    const { raw, hash, prefix } = generateApiKey();
    await db.insert(apiClients).values({
      merchant_id: merchant.id,
      name: 'Default',
      key_hash: hash,
      key_prefix: prefix,
      is_active: true,
    });

    fastify.log.info({ shop }, 'Billing activated — merchant setup complete');

    // Store the raw key for one-time display, then send merchant back into the Shopify admin
    storePendingKey(shop, raw);
    return reply.redirect(`https://${shop}/admin/apps/${apiKey}`);
  });
};

export default billingRoute;
