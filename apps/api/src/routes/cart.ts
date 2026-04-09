import type { FastifyPluginAsync } from 'fastify';
import { CartRequest } from '@nativelayer/schemas';
import { getShopifyClient } from '@nativelayer/shopify-client';
import { decrypt, getEncryptionKey } from '@nativelayer/security';

const cartRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/cart', async (request, reply) => {
    const parsed = CartRequest.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues.map((i) => i.message).join('; '),
          request_id: request.id,
        },
      });
    }

    const { line_items } = parsed.data;
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
    const cart = await client.createCart(line_items);

    return reply.code(201).send({ ...cart, request_id: request.id });
  });
};

export default cartRoute;
