import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export const CorrelationId = z
  .string()
  .min(1)
  .max(64)
  .openapi({ example: 'req_abc123' });

export const ErrorResponse = z
  .object({
    error: z.object({
      code: z.string().openapi({ example: 'CAPABILITY_DISABLED' }),
      message: z.string().openapi({ example: 'The requested capability is not enabled.' }),
      request_id: CorrelationId,
    }),
  })
  .openapi('ErrorResponse');

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------

export const HealthResponse = z
  .object({
    status: z.literal('ok'),
    version: z.string().openapi({ example: '0.1.0' }),
    timestamp: z.string().datetime().openapi({ example: '2025-04-06T12:00:00Z' }),
  })
  .openapi('HealthResponse');

export type HealthResponse = z.infer<typeof HealthResponse>;

// ---------------------------------------------------------------------------
// POST /ai/search
// ---------------------------------------------------------------------------

export const SearchRequest = z
  .object({
    query: z.string().min(1).max(256).openapi({ example: 'black hoodie' }),
    filters: z
      .object({
        min_price: z.number().nonnegative().optional(),
        max_price: z.number().nonnegative().optional(),
        in_stock: z.boolean().optional(),
      })
      .optional(),
    limit: z.number().int().min(1).max(50).default(10),
  })
  .openapi('SearchRequest');

export type SearchRequest = z.infer<typeof SearchRequest>;

export const SearchItem = z
  .object({
    id: z.string().openapi({ example: 'prod_gid_123' }),
    title: z.string().openapi({ example: 'Black Hoodie' }),
    price: z.string().openapi({ example: '42.00' }),
    currency: z.string().length(3).openapi({ example: 'USD' }),
    in_stock: z.boolean(),
  })
  .openapi('SearchItem');

export const SearchResponse = z
  .object({
    items: z.array(SearchItem),
    request_id: CorrelationId,
  })
  .openapi('SearchResponse');

export type SearchResponse = z.infer<typeof SearchResponse>;

// ---------------------------------------------------------------------------
// GET /ai/product/:id
// ---------------------------------------------------------------------------

export const ProductVariant = z
  .object({
    id: z.string(),
    title: z.string().openapi({ example: 'Large / Black' }),
    price: z.string().openapi({ example: '42.00' }),
    currency: z.string().length(3),
    available: z.boolean(),
    sku: z.string().optional(),
  })
  .openapi('ProductVariant');

export const ProductResponse = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    variants: z.array(ProductVariant),
    images: z
      .array(
        z.object({
          url: z.string().url(),
          alt_text: z.string().optional(),
        }),
      )
      .optional(),
    request_id: CorrelationId,
  })
  .openapi('ProductResponse');

export type ProductResponse = z.infer<typeof ProductResponse>;

// ---------------------------------------------------------------------------
// POST /ai/cart
// ---------------------------------------------------------------------------

export const CartRequest = z
  .object({
    line_items: z
      .array(
        z.object({
          variant_id: z.string().min(1),
          qty: z.number().int().min(1).max(100),
        }),
      )
      .min(1)
      .max(50),
  })
  .openapi('CartRequest');

export type CartRequest = z.infer<typeof CartRequest>;

export const CartResponse = z
  .object({
    cart_id: z.string(),
    checkout_url: z.string().url(),
    subtotal: z.string().openapi({ example: '42.00' }),
    currency: z.string().length(3),
    request_id: CorrelationId,
  })
  .openapi('CartResponse');

export type CartResponse = z.infer<typeof CartResponse>;

// ---------------------------------------------------------------------------
// POST /ai/checkout-handoff
// ---------------------------------------------------------------------------

export const CheckoutHandoffRequest = z
  .object({
    cart_id: z.string().min(1),
  })
  .openapi('CheckoutHandoffRequest');

export type CheckoutHandoffRequest = z.infer<typeof CheckoutHandoffRequest>;

export const CheckoutHandoffResponse = z
  .object({
    checkout_url: z.string().url(),
    expires_at: z.string().datetime().optional(),
    request_id: CorrelationId,
  })
  .openapi('CheckoutHandoffResponse');

export type CheckoutHandoffResponse = z.infer<typeof CheckoutHandoffResponse>;
