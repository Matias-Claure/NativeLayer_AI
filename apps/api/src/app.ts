import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import { createLogger } from '@nativelayer/observability';
import { generateCorrelationId } from '@nativelayer/security';

import authPlugin from './plugins/auth.js';
import policyPlugin from './plugins/policy.js';
import rateLimitPlugin from './plugins/ratelimit.js';
import auditPlugin from './plugins/audit.js';

import healthRoute from './routes/health.js';
import searchRoute from './routes/search.js';
import productRoute from './routes/product.js';
import cartRoute from './routes/cart.js';
import checkoutHandoffRoute from './routes/checkout-handoff.js';
import authRoute from './routes/auth.js';
import billingRoute from './routes/billing.js';
import webhooksRoute from './routes/webhooks.js';
import privacyRoute from './routes/privacy.js';
import embeddedAppRoute from './routes/embedded-app.js';

const log = createLogger('api');

export function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      redact: {
        paths: ['req.headers.authorization', 'req.headers["x-api-key"]'],
        censor: '[REDACTED]',
      },
    },
    genReqId: () => generateCorrelationId(),
    requestIdHeader: 'x-request-id',
    trustProxy: true,
  });

  // Track request start time for latency calculation
  app.addHook('onRequest', async (request) => {
    (request as { startTime?: number }).startTime = Date.now();
  });

  // Security headers
  void app.register(helmet, {
    contentSecurityPolicy: false, // API-only; no HTML served
  });

  // Core plugins (order matters — auth before policy before ratelimit)
  void app.register(authPlugin);
  void app.register(policyPlugin);
  void app.register(rateLimitPlugin);
  void app.register(auditPlugin);

  // Routes
  void app.register(healthRoute);
  void app.register(privacyRoute);
  void app.register(embeddedAppRoute);
  void app.register(authRoute);
  void app.register(billingRoute);
  void app.register(webhooksRoute);
  void app.register(searchRoute, { prefix: '/ai' });
  void app.register(productRoute, { prefix: '/ai' });
  void app.register(cartRoute, { prefix: '/ai' });
  void app.register(checkoutHandoffRoute, { prefix: '/ai' });

  // Centralized error handler — never leak stack traces
  app.setErrorHandler((err: unknown, request, reply) => {
    const requestId = request.id as string;
    const e = err as { statusCode?: number; message?: string };
    const statusCode = e.statusCode;
    const message = e.message ?? 'Unknown error';
    if (statusCode && statusCode < 500) {
      log.warn({ requestId, err: message }, 'Client error');
      return reply.code(statusCode).send({
        error: { code: 'CLIENT_ERROR', message, request_id: requestId },
      });
    }
    log.error({ requestId, err }, 'Unhandled server error');
    return reply.code(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.', request_id: requestId },
    });
  });

  // 404 handler
  app.setNotFoundHandler((request, reply) => {
    return reply.code(404).send({
      error: { code: 'NOT_FOUND', message: 'Route not found.', request_id: request.id },
    });
  });

  return app;
}
