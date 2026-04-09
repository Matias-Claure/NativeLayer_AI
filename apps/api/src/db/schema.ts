import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  unique,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// merchants
// ---------------------------------------------------------------------------
export const merchants = pgTable('merchants', {
  id: uuid('id').primaryKey().defaultRandom(),
  shop_domain: text('shop_domain').notNull().unique(),
  // AES-256-GCM encrypted Shopify Storefront token
  encrypted_shopify_token: text('encrypted_shopify_token').notNull(),
  token_iv: text('token_iv').notNull(),
  token_tag: text('token_tag').notNull(),
  status: text('status').notNull().default('active'), // 'active' | 'suspended'
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  shopify_admin_token: text('shopify_admin_token'),
  billing_status: text('billing_status').default('pending'),
  billing_charge_id: text('billing_charge_id'),
});

// ---------------------------------------------------------------------------
// api_clients  (no FK on merchant_id — audit logs must survive merchant deletion)
// ---------------------------------------------------------------------------
export const apiClients = pgTable('api_clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  merchant_id: uuid('merchant_id').notNull(),
  name: text('name').notNull(),
  key_hash: text('key_hash').notNull().unique(), // SHA-256 of raw key
  key_prefix: text('key_prefix').notNull(),       // first 8 chars for display
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  last_used_at: timestamp('last_used_at', { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// endpoint_settings  (capability toggles per merchant)
// ---------------------------------------------------------------------------
export const endpointSettings = pgTable(
  'endpoint_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchant_id: uuid('merchant_id').notNull(),
    capability: text('capability').notNull(), // 'search' | 'product_detail' | 'cart' | 'checkout_handoff'
    enabled: boolean('enabled').notNull().default(false),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('uq_merchant_capability').on(t.merchant_id, t.capability)],
);

// ---------------------------------------------------------------------------
// audit_logs  (append-only; no FK constraints so logs survive record deletion)
// ---------------------------------------------------------------------------
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  merchant_id: uuid('merchant_id').notNull(),
  client_id: uuid('client_id'),
  endpoint: text('endpoint').notNull(),
  method: text('method').notNull(),
  status_code: integer('status_code').notNull(),
  correlation_id: text('correlation_id').notNull(),
  request_summary: jsonb('request_summary'), // redacted snapshot
  latency_ms: integer('latency_ms'),
  ip_addr: text('ip_addr'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Merchant = typeof merchants.$inferSelect;
export type NewMerchant = typeof merchants.$inferInsert;
export type ApiClient = typeof apiClients.$inferSelect;
export type NewApiClient = typeof apiClients.$inferInsert;
export type EndpointSetting = typeof endpointSettings.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
