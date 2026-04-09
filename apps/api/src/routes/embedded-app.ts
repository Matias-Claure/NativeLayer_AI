/**
 * embedded-app route
 * ------------------
 * Serves the embedded app UI loaded by Shopify inside the admin iframe.
 * Must NOT have X-Frame-Options: SAMEORIGIN (helmet default) — overridden here.
 *
 * GET /app
 *
 * States:
 *   new_key  — merchant just completed billing; show API key once
 *   active   — merchant is set up; show key prefixes and endpoints
 *   pending  — merchant installed but hasn't approved billing yet
 */
import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { merchants, apiClients } from '../db/schema.js';
import { consumePendingKey } from '../pending-keys.js';

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f6f7; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .card { background: #fff; border-radius: 12px; padding: 48px 40px; max-width: 560px; width: 100%; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
  .badge { display: inline-block; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 20px; margin-bottom: 20px; }
  .badge.green { background: #e3f5e1; color: #1a7f37; }
  .badge.yellow { background: #fff8e1; color: #b45309; }
  h1 { font-size: 1.4rem; color: #1a1a1a; margin-bottom: 10px; }
  p { color: #6b7280; font-size: 0.9rem; line-height: 1.6; margin-bottom: 16px; }
  .section { background: #f9fafb; border-radius: 8px; padding: 16px 20px; margin: 20px 0; }
  .section-title { font-size: 0.75rem; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 10px; }
  .key-box { display: flex; align-items: center; gap: 10px; background: #1e1e2e; border-radius: 8px; padding: 14px 16px; margin: 8px 0; }
  .key-value { font-family: monospace; font-size: 0.85rem; color: #a6e3a1; flex: 1; word-break: break-all; }
  .copy-btn { background: #6366f1; color: #fff; border: none; border-radius: 6px; padding: 6px 14px; font-size: 0.8rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
  .copy-btn:hover { background: #4f46e5; }
  .warning { background: #fff8e1; border: 1px solid #fcd34d; border-radius: 8px; padding: 12px 16px; margin: 16px 0; font-size: 0.85rem; color: #92400e; }
  .warning strong { display: block; margin-bottom: 2px; }
  .endpoint { font-family: monospace; font-size: 0.85rem; color: #374151; padding: 5px 0; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; gap: 10px; }
  .endpoint:last-child { border-bottom: none; }
  .method { font-weight: 700; color: #6366f1; width: 38px; flex-shrink: 0; }
  .key-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f0f0f0; font-size: 0.85rem; }
  .key-row:last-child { border-bottom: none; }
  .key-prefix { font-family: monospace; color: #374151; }
  .key-meta { color: #9ca3af; font-size: 0.8rem; }
  .base-url { font-family: monospace; font-size: 0.8rem; color: #6366f1; word-break: break-all; }
  .billing-btn { display: inline-block; background: #6366f1; color: #fff; text-decoration: none; border-radius: 8px; padding: 12px 24px; font-size: 0.9rem; font-weight: 600; margin-top: 8px; }
  .billing-btn:hover { background: #4f46e5; }
  .support { margin-top: 24px; text-align: center; font-size: 0.8rem; color: #9ca3af; }
  .support a { color: #6366f1; text-decoration: none; }
`;

const embeddedAppRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/app', async (request, reply) => {
    const shopifyApiKey = process.env['SHOPIFY_API_KEY']!;
    const appUrl = process.env['APP_URL']!;
    const { shop } = request.query as { shop?: string };

    // Remove X-Frame-Options so Shopify can embed this page
    void reply.removeHeader('X-Frame-Options');
    void reply.header(
      'Content-Security-Policy',
      `frame-ancestors https://${shop ?? '*'} https://admin.shopify.com;`,
    );

    // Check for a one-time pending key (just came from billing callback)
    const pendingKey = shop ? consumePendingKey(shop) : null;

    // Look up merchant and their active API keys
    let billingStatus = 'pending';
    let keyPrefixes: { prefix: string; name: string; createdAt: Date }[] = [];

    if (shop) {
      const db = getDb();
      const [merchant] = await db
        .select()
        .from(merchants)
        .where(eq(merchants.shop_domain, shop))
        .limit(1);

      if (merchant) {
        billingStatus = merchant.billing_status ?? 'pending';
        const keys = await db
          .select()
          .from(apiClients)
          .where(eq(apiClients.merchant_id, merchant.id));
        keyPrefixes = keys
          .filter((k) => k.is_active)
          .map((k) => ({ prefix: k.key_prefix, name: k.name, createdAt: k.created_at }));
      }
    }

    let bodyHtml: string;

    if (pendingKey) {
      // ── State: new key just generated ──────────────────────────────────────
      bodyHtml = `
        <span class="badge green">Setup complete</span>
        <h1>You're all set!</h1>
        <p>Copy your API key below. <strong>It will not be shown again.</strong></p>

        <div class="warning">
          <strong>Save this key now</strong>
          Store it somewhere safe — we only hash it, so there is no way to recover the raw value.
        </div>

        <div class="section">
          <div class="section-title">Your API key</div>
          <div class="key-box">
            <span class="key-value" id="apiKey">${escHtml(pendingKey)}</span>
            <button class="copy-btn" onclick="copyKey()">Copy</button>
          </div>
        </div>

        <div class="section">
          <div class="section-title">API base URL</div>
          <div style="padding: 4px 0;"><span class="base-url">${escHtml(appUrl)}</span></div>
        </div>

        <div class="section">
          <div class="section-title">Available endpoints</div>
          <div class="endpoint"><span class="method">GET</span>/ai/search</div>
          <div class="endpoint"><span class="method">GET</span>/ai/products/:handle</div>
          <div class="endpoint"><span class="method">POST</span>/ai/cart</div>
          <div class="endpoint"><span class="method">POST</span>/ai/checkout</div>
        </div>

        <script>
          function copyKey() {
            const key = document.getElementById('apiKey').textContent;
            navigator.clipboard.writeText(key).then(() => {
              const btn = document.querySelector('.copy-btn');
              btn.textContent = 'Copied!';
              btn.style.background = '#16a34a';
              setTimeout(() => { btn.textContent = 'Copy'; btn.style.background = ''; }, 2000);
            });
          }
        </script>`;
    } else if (billingStatus === 'active') {
      // ── State: active merchant ─────────────────────────────────────────────
      const keyRowsHtml = keyPrefixes.length > 0
        ? keyPrefixes.map((k) => `
          <div class="key-row">
            <span class="key-prefix">${escHtml(k.prefix)}••••••••••••••••••••</span>
            <span class="key-meta">${escHtml(k.name)} · ${new Date(k.createdAt).toLocaleDateString()}</span>
          </div>`).join('')
        : `<div class="key-row"><span class="key-meta">No active keys</span></div>`;

      bodyHtml = `
        <span class="badge green">Active</span>
        <h1>NativeLayer AI is connected</h1>
        <p>Your store is live. Use your API key to call the NativeLayer endpoints from your AI integration.</p>

        <div class="section">
          <div class="section-title">API base URL</div>
          <div style="padding: 4px 0;"><span class="base-url">${escHtml(appUrl)}</span></div>
        </div>

        <div class="section">
          <div class="section-title">API keys</div>
          ${keyRowsHtml}
        </div>

        <div class="section">
          <div class="section-title">Available endpoints</div>
          <div class="endpoint"><span class="method">GET</span>/ai/search</div>
          <div class="endpoint"><span class="method">GET</span>/ai/products/:handle</div>
          <div class="endpoint"><span class="method">POST</span>/ai/cart</div>
          <div class="endpoint"><span class="method">POST</span>/ai/checkout</div>
        </div>`;
    } else {
      // ── State: billing not completed ───────────────────────────────────────
      const billingUrl = shop
        ? `${appUrl}/billing/confirm?shop=${encodeURIComponent(shop)}`
        : '#';

      bodyHtml = `
        <span class="badge yellow">Setup required</span>
        <h1>Complete your setup</h1>
        <p>Approve the NativeLayer AI subscription to activate your API access.</p>
        <a class="billing-btn" href="${escHtml(billingUrl)}">Approve subscription →</a>`;
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NativeLayer AI</title>
  <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" data-api-key="${escHtml(shopifyApiKey)}" crossorigin="anonymous"></script>
  <style>${CSS}</style>
</head>
<body>
  <div class="card">
    ${bodyHtml}
    <div class="support"><a href="mailto:maticlaure@outlook.com">Contact support</a></div>
  </div>
</body>
</html>`;

    return reply.type('text/html').send(html);
  });
};

export default embeddedAppRoute;
