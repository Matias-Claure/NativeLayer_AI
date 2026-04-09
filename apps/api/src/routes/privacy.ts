/**
 * privacy route
 * -------------
 * Serves the NativeLayer AI privacy policy at GET /privacy
 * Required for Shopify app listing.
 */
import type { FastifyPluginAsync } from 'fastify';

const PRIVACY_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Privacy Policy — NativeLayer AI</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 760px; margin: 48px auto; padding: 0 24px; color: #1a1a1a; line-height: 1.7; }
    h1 { font-size: 2rem; margin-bottom: 4px; }
    h2 { font-size: 1.2rem; margin-top: 40px; }
    .meta { color: #666; font-size: 0.9rem; margin-bottom: 40px; }
    a { color: #5c6bc0; }
    ul { padding-left: 20px; }
    li { margin-bottom: 6px; }
  </style>
</head>
<body>
  <h1>Privacy Policy</h1>
  <p class="meta">NativeLayer AI &nbsp;|&nbsp; Effective date: April 7, 2025 &nbsp;|&nbsp; Last updated: April 7, 2025</p>

  <p>
    NativeLayer AI ("we", "us", or "our") provides an AI-powered commerce API for Shopify merchants.
    This Privacy Policy explains what data we collect, how we use it, and your rights regarding that data.
  </p>

  <h2>1. Data We Collect</h2>
  <p><strong>From Shopify merchants (store owners) during installation:</strong></p>
  <ul>
    <li>Your Shopify store domain (e.g. <code>yourstore.myshopify.com</code>)</li>
    <li>A Shopify Storefront API access token — stored AES-256-GCM encrypted at rest</li>
    <li>A Shopify Admin API access token — stored AES-256-GCM encrypted at rest, used only during setup</li>
    <li>Billing subscription status and charge identifiers from Shopify</li>
  </ul>
  <p><strong>From API usage (your shoppers' requests relayed through our API):</strong></p>
  <ul>
    <li>Request metadata: endpoint called, HTTP method, response status code, latency</li>
    <li>IP address of the originating request</li>
    <li>A redacted, non-identifiable snapshot of request parameters (e.g. search query text, product ID)</li>
  </ul>
  <p>We do <strong>not</strong> collect, store, or process end-customer personal data such as names, email addresses, payment information, or order history.</p>

  <h2>2. How We Use Your Data</h2>
  <ul>
    <li>To authenticate your store and proxy Shopify Storefront API requests on your behalf</li>
    <li>To enforce your subscription status and API access controls</li>
    <li>To generate audit logs for your own review in the merchant dashboard</li>
    <li>To enforce rate limits and detect abuse</li>
    <li>To communicate with you about your subscription or service changes</li>
  </ul>
  <p>We do <strong>not</strong> sell, rent, or share your data with third parties for marketing purposes.</p>

  <h2>3. Data Retention</h2>
  <ul>
    <li><strong>Merchant account data</strong> is retained while your subscription is active. If you uninstall the app, your merchant record is marked suspended; you may request full deletion by contacting us.</li>
    <li><strong>Audit logs</strong> are retained for 90 days, then automatically purged.</li>
    <li><strong>API keys</strong> are stored as one-way SHA-256 hashes and cannot be recovered.</li>
  </ul>

  <h2>4. Data Security</h2>
  <p>
    All Shopify access tokens are encrypted at rest using AES-256-GCM. Data is transmitted exclusively
    over HTTPS/TLS. We follow Shopify's security best practices for app development.
  </p>

  <h2>5. Third-Party Services</h2>
  <p>
    NativeLayer AI acts as a proxy to the <strong>Shopify Storefront API</strong>. Requests made through
    our API are subject to <a href="https://www.shopify.com/legal/privacy" target="_blank" rel="noopener">Shopify's Privacy Policy</a>.
    We do not use any other third-party analytics, advertising, or data-sharing services.
  </p>

  <h2>6. Your Rights</h2>
  <p>As a merchant, you may:</p>
  <ul>
    <li>Request a copy of the data we hold about your store</li>
    <li>Request deletion of your store's data at any time</li>
    <li>Uninstall the app via your Shopify admin, which immediately suspends all API access</li>
  </ul>

  <h2>7. Changes to This Policy</h2>
  <p>
    We may update this policy from time to time. Material changes will be communicated via email to the
    address associated with your Shopify account. Continued use of the app after the effective date
    constitutes acceptance of the revised policy.
  </p>

  <h2>8. Contact</h2>
  <p>
    For privacy questions or data deletion requests, contact us at:
    <a href="mailto:maticlaure@outlook.com">maticlaure@outlook.com</a>
  </p>
</body>
</html>`;

const privacyRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/privacy', async (_request, reply) => {
    return reply.type('text/html').send(PRIVACY_HTML);
  });
};

export default privacyRoute;
