import { z } from 'zod';
import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import {
  HealthResponse,
  SearchRequest,
  SearchResponse,
  ProductResponse,
  CartRequest,
  CartResponse,
  CheckoutHandoffRequest,
  CheckoutHandoffResponse,
  ErrorResponse,
} from './ai-actions.js';

export function buildRegistry(): OpenAPIRegistry {
  const registry = new OpenAPIRegistry();

  // ── GET /health ────────────────────────────────────────────────────────────
  registry.registerPath({
    method: 'get',
    path: '/health',
    summary: 'Health check',
    tags: ['Operations'],
    responses: {
      200: {
        description: 'Service is healthy',
        content: { 'application/json': { schema: HealthResponse } },
      },
    },
  });

  // ── POST /ai/search ────────────────────────────────────────────────────────
  registry.registerPath({
    method: 'post',
    path: '/ai/search',
    summary: 'Search merchant catalog',
    tags: ['AI Actions'],
    security: [{ apiKey: [] }],
    request: { body: { content: { 'application/json': { schema: SearchRequest } } } },
    responses: {
      200: {
        description: 'Search results',
        content: { 'application/json': { schema: SearchResponse } },
      },
      401: { description: 'Invalid or missing API key', content: { 'application/json': { schema: ErrorResponse } } },
      403: { description: 'Capability disabled', content: { 'application/json': { schema: ErrorResponse } } },
      429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: ErrorResponse } } },
    },
  });

  // ── GET /ai/product/:id ────────────────────────────────────────────────────
  const ProductParamsSchema = z.object({ id: z.string().openapi({ example: 'prod_123' }) });
  registry.registerPath({
    method: 'get',
    path: '/ai/product/{id}',
    summary: 'Fetch product detail',
    tags: ['AI Actions'],
    security: [{ apiKey: [] }],
    request: { params: ProductParamsSchema },
    responses: {
      200: {
        description: 'Product detail',
        content: { 'application/json': { schema: ProductResponse } },
      },
      401: { description: 'Invalid or missing API key', content: { 'application/json': { schema: ErrorResponse } } },
      403: { description: 'Capability disabled', content: { 'application/json': { schema: ErrorResponse } } },
      404: { description: 'Product not found', content: { 'application/json': { schema: ErrorResponse } } },
    },
  });

  // ── POST /ai/cart ──────────────────────────────────────────────────────────
  registry.registerPath({
    method: 'post',
    path: '/ai/cart',
    summary: 'Create a cart',
    tags: ['AI Actions'],
    security: [{ apiKey: [] }],
    request: { body: { content: { 'application/json': { schema: CartRequest } } } },
    responses: {
      201: {
        description: 'Cart created',
        content: { 'application/json': { schema: CartResponse } },
      },
      401: { description: 'Invalid or missing API key', content: { 'application/json': { schema: ErrorResponse } } },
      403: { description: 'Capability disabled', content: { 'application/json': { schema: ErrorResponse } } },
    },
  });

  // ── POST /ai/checkout-handoff ──────────────────────────────────────────────
  registry.registerPath({
    method: 'post',
    path: '/ai/checkout-handoff',
    summary: 'Get checkout handoff URL',
    tags: ['AI Actions'],
    security: [{ apiKey: [] }],
    request: { body: { content: { 'application/json': { schema: CheckoutHandoffRequest } } } },
    responses: {
      200: {
        description: 'Checkout handoff info',
        content: { 'application/json': { schema: CheckoutHandoffResponse } },
      },
      401: { description: 'Invalid or missing API key', content: { 'application/json': { schema: ErrorResponse } } },
      403: { description: 'Capability disabled', content: { 'application/json': { schema: ErrorResponse } } },
      404: { description: 'Cart not found', content: { 'application/json': { schema: ErrorResponse } } },
    },
  });

  return registry;
}

export function generateOpenApiDocument() {
  const registry = buildRegistry();
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'NativeLayer AI Action API',
      version: '0.1.0',
      description:
        'Compact, permissioned endpoints for AI agents to interact with Shopify stores.',
    },
    servers: [{ url: 'https://api.nativelayer.ai', description: 'Production' }],
  });
}
