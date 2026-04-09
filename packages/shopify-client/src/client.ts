import type { SearchResponse, ProductResponse, CartResponse, CheckoutHandoffResponse } from '@nativelayer/schemas';
import {
  SEARCH_PRODUCTS_QUERY,
  GET_PRODUCT_QUERY,
  CART_CREATE_MUTATION,
  GET_CART_QUERY,
} from './graphql.js';

const SHOPIFY_API_VERSION = '2025-04';

export interface SearchFilters {
  min_price?: number | undefined;
  max_price?: number | undefined;
  in_stock?: boolean | undefined;
}

export interface CartLineItem {
  variant_id: string;
  qty: number;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export class ShopifyClient {
  private readonly endpoint: string;
  private readonly headers: Record<string, string>;

  constructor(storeDomain: string, storefrontToken: string) {
    this.endpoint = `https://${storeDomain}/api/${SHOPIFY_API_VERSION}/graphql.json`;
    this.headers = {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': storefrontToken,
    };
  }

  private async query<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
    }

    const json = (await response.json()) as GraphQLResponse<T>;
    if (json.errors?.length) {
      throw new Error(`Shopify GraphQL error: ${json.errors.map((e) => e.message).join(', ')}`);
    }
    if (!json.data) {
      throw new Error('Shopify API returned no data');
    }
    return json.data;
  }

  async searchProducts(
    queryStr: string,
    filters?: SearchFilters,
    limit = 10,
  ): Promise<SearchResponse['items']> {
    // Build Shopify product query string with filters
    let shopifyQuery = queryStr;
    if (filters?.in_stock === true) shopifyQuery += ' available_for_sale:true';
    if (filters?.min_price !== undefined) shopifyQuery += ` price:>=${filters.min_price}`;
    if (filters?.max_price !== undefined) shopifyQuery += ` price:<=${filters.max_price}`;

    const data = await this.query<{
      products: {
        edges: Array<{
          node: {
            id: string;
            title: string;
            availableForSale: boolean;
            priceRange: { minVariantPrice: { amount: string; currencyCode: string } };
          };
        }>;
      };
    }>(SEARCH_PRODUCTS_QUERY, { query: shopifyQuery, first: limit });

    return data.products.edges.map(({ node }) => ({
      id: this.normalizeId(node.id),
      title: node.title,
      price: node.priceRange.minVariantPrice.amount,
      currency: node.priceRange.minVariantPrice.currencyCode,
      in_stock: node.availableForSale,
    }));
  }

  async getProduct(id: string): Promise<Omit<ProductResponse, 'request_id'> | null> {
    const gid = this.toGid(id, 'Product');

    const data = await this.query<{
      product: {
        id: string;
        title: string;
        description: string;
        images: { edges: Array<{ node: { url: string; altText: string | null } }> };
        variants: {
          edges: Array<{
            node: {
              id: string;
              title: string;
              availableForSale: boolean;
              sku: string | null;
              price: { amount: string; currencyCode: string };
            };
          }>;
        };
      } | null;
    }>(GET_PRODUCT_QUERY, { id: gid });

    if (!data.product) return null;
    const p = data.product;

    return {
      id: this.normalizeId(p.id),
      title: p.title,
      description: p.description || undefined,
      variants: p.variants.edges.map(({ node: v }) => ({
        id: this.normalizeId(v.id),
        title: v.title,
        price: v.price.amount,
        currency: v.price.currencyCode,
        available: v.availableForSale,
        sku: v.sku ?? undefined,
      })),
      images:
        p.images.edges.length > 0
          ? p.images.edges.map(({ node: img }) => ({
              url: img.url,
              alt_text: img.altText ?? undefined,
            }))
          : undefined,
    };
  }

  async createCart(lineItems: CartLineItem[]): Promise<Omit<CartResponse, 'request_id'>> {
    const lines = lineItems.map((item) => ({
      merchandiseId: this.toGid(item.variant_id, 'ProductVariant'),
      quantity: item.qty,
    }));

    const data = await this.query<{
      cartCreate: {
        cart: {
          id: string;
          checkoutUrl: string;
          cost: { subtotalAmount: { amount: string; currencyCode: string } };
        };
        userErrors: Array<{ field: string[]; message: string }>;
      };
    }>(CART_CREATE_MUTATION, { lines });

    if (data.cartCreate.userErrors.length > 0) {
      throw new Error(
        `Cart creation failed: ${data.cartCreate.userErrors.map((e) => e.message).join(', ')}`,
      );
    }

    const cart = data.cartCreate.cart;
    return {
      cart_id: this.normalizeId(cart.id),
      checkout_url: cart.checkoutUrl,
      subtotal: cart.cost.subtotalAmount.amount,
      currency: cart.cost.subtotalAmount.currencyCode,
    };
  }

  async getCheckoutHandoff(
    cartId: string,
  ): Promise<Omit<CheckoutHandoffResponse, 'request_id'> | null> {
    const gid = this.toGid(cartId, 'Cart');

    const data = await this.query<{
      cart: { id: string; checkoutUrl: string } | null;
    }>(GET_CART_QUERY, { id: gid });

    if (!data.cart) return null;

    // expires_at: Shopify checkout URLs are valid for ~24h after cart creation
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    return {
      checkout_url: data.cart.checkoutUrl,
      expires_at: expiresAt,
    };
  }

  /**
   * Converts a platform ID (either raw numeric or already a GID) to a Shopify GID.
   * Shopify GIDs look like: gid://shopify/Product/123456789
   */
  private toGid(id: string, type: string): string {
    if (id.startsWith('gid://')) return id;
    return `gid://shopify/${type}/${id}`;
  }

  /**
   * Normalizes a Shopify GID to a stable platform ID.
   * We store the full GID as the platform ID so round-trips are lossless.
   */
  private normalizeId(gid: string): string {
    // Strip the GID prefix for cleaner IDs in responses
    // e.g. "gid://shopify/Product/123" → "prod_123"
    const match = /gid:\/\/shopify\/(\w+)\/(\d+)/.exec(gid);
    if (!match || !match[1] || !match[2]) return gid;
    const typePrefixes: Record<string, string> = {
      Product: 'prod',
      ProductVariant: 'var',
      Cart: 'cart',
    };
    const prefix = typePrefixes[match[1]] ?? match[1].toLowerCase();
    return `${prefix}_${match[2]}`;
  }
}

/**
 * Factory function — creates a ShopifyClient for a given merchant.
 * The token is decrypted by the calling route before being passed here.
 */
export function getShopifyClient(storeDomain: string, storefrontToken: string): ShopifyClient {
  return new ShopifyClient(storeDomain, storefrontToken);
}
