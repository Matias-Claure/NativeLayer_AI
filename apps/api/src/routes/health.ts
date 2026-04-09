import type { FastifyPluginAsync } from 'fastify';

const VERSION = process.env['npm_package_version'] ?? '0.1.0';

const healthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (_request, reply) => {
    return reply.code(200).send({
      status: 'ok',
      version: VERSION,
      timestamp: new Date().toISOString(),
    });
  });
};

export default healthRoute;
