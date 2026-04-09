import type { FastifyPluginAsync } from 'fastify';
import { SearchRequest } from '@nativelayer/schemas';
import { getShopifyClient } from '@nativelayer/shopify-client';
import { decrypt, getEncryptionKey } from '@nativelayer/security';

const searchRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/search', async (request, reply) => {
    const parsed = SearchRequest.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues.map((i) => i.message).join('; '),
          request_id: request.id,
        },
      });
    }

    const { query, filters, limit } = parsed.data;
    const merchant = request.merchant;

    const shopifyToken = decrypt(
      {
        ciphertext: merchant.encrypted_shopify_token,
        iv: merchant.token_iv,
        tag: merchant.token_tag,
      },
      getEncryptionKey(),
    );

    const client = getShopifyClient(merchant.shop_domain, shopifyToken);
    const items = await client.searchProducts(query, filters, limit);

    return reply.code(200).send({ items, request_id: request.id });
  });
};

export default searchRoute;
