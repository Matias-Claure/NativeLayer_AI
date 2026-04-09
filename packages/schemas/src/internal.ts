/**
 * Internal data schemas used by the API and dashboard — not exposed to AI clients.
 */
import { z } from 'zod';

export const Capability = z.enum([
  'search',
  'product_detail',
  'cart',
  'checkout_handoff',
]);
export type Capability = z.infer<typeof Capability>;

export const CAPABILITIES = Capability.options;

export const MerchantStatus = z.enum(['active', 'suspended']);
export type MerchantStatus = z.infer<typeof MerchantStatus>;

/** Merchant record returned from DB (tokens already decrypted where needed). */
export const Merchant = z.object({
  id: z.string().uuid(),
  shop_domain: z.string(),
  status: MerchantStatus,
  created_at: z.date(),
  updated_at: z.date(),
});
export type Merchant = z.infer<typeof Merchant>;

export const ApiClient = z.object({
  id: z.string().uuid(),
  merchant_id: z.string().uuid(),
  name: z.string(),
  key_prefix: z.string(),
  is_active: z.boolean(),
  created_at: z.date(),
  last_used_at: z.date().nullable(),
});
export type ApiClient = z.infer<typeof ApiClient>;

export const AuditLogEntry = z.object({
  merchant_id: z.string().uuid(),
  client_id: z.string().uuid().nullable(),
  endpoint: z.string(),
  method: z.string(),
  status_code: z.number().int(),
  correlation_id: z.string(),
  request_summary: z.record(z.unknown()).nullable(),
  latency_ms: z.number().int().nullable(),
  ip_addr: z.string().nullable(),
});
export type AuditLogEntry = z.infer<typeof AuditLogEntry>;
