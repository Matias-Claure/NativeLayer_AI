import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getShopifyClient } from '@nativelayer/shopify-client';
import { decrypt, getEncryptionKey } from '@nativelayer/security';

const ParamsSchema = z.object({ id: z.string().min(1) });

const productRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/product/:id', async (request, reply) => {
    const parsed = ParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid product ID.', request_id: request.id },
      });
    }

    const { id } = parsed.data;
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
    const product = await client.getProduct(id);

    if (!product) {
      return reply.code(404).send({
        error: { code: 'PRODUCT_NOT_FOUND', message: `Product '${id}' not found.`, request_id: request.id },
      });
    }

    return reply.code(200).send({ ...product, request_id: request.id });
  });
};

export default productRoute;
