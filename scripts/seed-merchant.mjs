/**
 * Seed script: creates a merchant record and initializes all 4 capability rows.
 * Run once after `npm run db:migrate`.
 *
 * Usage:
 *   SEED_SHOPIFY_STORE_DOMAIN=your-store.myshopify.com \
 *   SEED_SHOPIFY_STOREFRONT_TOKEN=your-token \
 *   node scripts/seed-merchant.mjs
 */

import { createCipheriv, randomBytes } from 'node:crypto';
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env manually (no dotenv dependency)
try {
  const env = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
  for (const line of env.split('\n')) {
    const [key, ...valueParts] = line.split('=');
    if (key && !key.startsWith('#') && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      if (!process.env[key.trim()]) process.env[key.trim()] = value;
    }
  }
} catch { /* .env not found, use existing env vars */ }

const DATABASE_URL = process.env.DATABASE_URL;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const STORE_DOMAIN = process.env.SEED_SHOPIFY_STORE_DOMAIN;
const STOREFRONT_TOKEN = process.env.SEED_SHOPIFY_STOREFRONT_TOKEN;

if (!DATABASE_URL) throw new Error('DATABASE_URL is required');
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) throw new Error('ENCRYPTION_KEY must be 64-char hex');
if (!STORE_DOMAIN || !STOREFRONT_TOKEN) {
  throw new Error('SEED_SHOPIFY_STORE_DOMAIN and SEED_SHOPIFY_STOREFRONT_TOKEN are required');
}

const key = Buffer.from(ENCRYPTION_KEY, 'hex');

function encrypt(plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { ciphertext, iv, tag } = encrypt(STOREFRONT_TOKEN);

    // Upsert merchant
    const { rows } = await client.query(
      `INSERT INTO merchants (shop_domain, encrypted_shopify_token, token_iv, token_tag, status)
       VALUES ($1, $2, $3, $4, 'active')
       ON CONFLICT (shop_domain) DO UPDATE
         SET encrypted_shopify_token = EXCLUDED.encrypted_shopify_token,
             token_iv = EXCLUDED.token_iv,
             token_tag = EXCLUDED.token_tag,
             updated_at = now()
       RETURNING id`,
      [STORE_DOMAIN, ciphertext, iv, tag],
    );

    const merchantId = rows[0].id;
    console.log(`Merchant upserted: ${STORE_DOMAIN} (id: ${merchantId})`);

    // Initialize all 4 capability rows (disabled by default)
    const capabilities = ['search', 'product_detail', 'cart', 'checkout_handoff'];
    for (const cap of capabilities) {
      await client.query(
        `INSERT INTO endpoint_settings (merchant_id, capability, enabled)
         VALUES ($1, $2, false)
         ON CONFLICT (merchant_id, capability) DO NOTHING`,
        [merchantId, cap],
      );
    }
    console.log('Capability rows initialized (all disabled by default).');

    await client.query('COMMIT');
    console.log('✓ Seed complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
