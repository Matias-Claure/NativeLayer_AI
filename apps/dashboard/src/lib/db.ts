/**
 * Dashboard DB client — shares the same Postgres instance as the API.
 * Uses Drizzle with the same schema.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import {
  pgTable, uuid, text, boolean, timestamp, integer, jsonb, unique,
} from 'drizzle-orm/pg-core';

let _pool: Pool | null = null;

function getPool(): Pool {
  if (!_pool) {
    const url = process.env['DATABASE_URL'];
    if (!url) throw new Error('DATABASE_URL is required');
    _pool = new Pool({ connectionString: url, max: 5 });
  }
  return _pool;
}

// Re-define schema inline for dashboard (avoids importing from apps/api)
export const merchants = pgTable('merchants', {
  id: uuid('id').primaryKey().defaultRandom(),
  shop_domain: text('shop_domain').notNull().unique(),
  encrypted_shopify_token: text('encrypted_shopify_token').notNull(),
  token_iv: text('token_iv').notNull(),
  token_tag: text('token_tag').notNull(),
  status: text('status').notNull().default('active'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const apiClients = pgTable('api_clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  merchant_id: uuid('merchant_id').notNull(),
  name: text('name').notNull(),
  key_hash: text('key_hash').notNull().unique(),
  key_prefix: text('key_prefix').notNull(),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  last_used_at: timestamp('last_used_at', { withTimezone: true }),
});

export const endpointSettings = pgTable(
  'endpoint_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchant_id: uuid('merchant_id').notNull(),
    capability: text('capability').notNull(),
    enabled: boolean('enabled').notNull().default(false),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('uq_merchant_capability').on(t.merchant_id, t.capability)],
);

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  merchant_id: uuid('merchant_id').notNull(),
  client_id: uuid('client_id'),
  endpoint: text('endpoint').notNull(),
  method: text('method').notNull(),
  status_code: integer('status_code').notNull(),
  correlation_id: text('correlation_id').notNull(),
  request_summary: jsonb('request_summary'),
  latency_ms: integer('latency_ms'),
  ip_addr: text('ip_addr'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export function getDb() {
  return drizzle(getPool(), {
    schema: { merchants, apiClients, endpointSettings, auditLogs },
  });
}
