import type { FastifyPluginAsync } from 'fastify';
import { CheckoutHandoffRequest } from '@nativelayer/schemas';
import { getShopifyClient } from '@nativelayer/shopify-client';
import { decrypt, getEncryptionKey } from '@nativelayer/security';

const checkoutHandoffRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/checkout-handoff', async (request, reply) => {
    const parsed = CheckoutHandoffRequest.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues.map((i) => i.message).join('; '),
          request_id: request.id,
        },
      });
    }

    const { cart_id } = parsed.data;
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
    const handoff = await client.getCheckoutHandoff(cart_id);

    if (!handoff) {
      return reply.code(404).send({
        error: { code: 'CART_NOT_FOUND', message: `Cart '${cart_id}' not found or expired.`, request_id: request.id },
      });
    }

    return reply.code(200).send({ ...handoff, request_id: request.id });
  });
};

export default checkoutHandoffRoute;
