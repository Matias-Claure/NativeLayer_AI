/** Internal types for Shopify Storefront API responses. Never exported to AI clients. */

export interface ShopifyMoneyV2 {
  amount: string;
  currencyCode: string;
}

export interface ShopifyProductVariant {
  id: string;
  title: string;
  price: ShopifyMoneyV2;
  availableForSale: boolean;
  sku: string | null;
  selectedOptions: Array<{ name: string; value: string }>;
}

export interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  variants: {
    edges: Array<{ node: ShopifyProductVariant }>;
  };
  images: {
    edges: Array<{
      node: { url: string; altText: string | null };
    }>;
  };
  priceRange: {
    minVariantPrice: ShopifyMoneyV2;
  };
  availableForSale: boolean;
}

export interface ShopifyCart {
  id: string;
  checkoutUrl: string;
  lines: {
    edges: Array<{
      node: {
        id: string;
        quantity: number;
        merchandise: {
          id: string;
          title: string;
          price: ShopifyMoneyV2;
        };
      };
    }>;
  };
  cost: {
    subtotalAmount: ShopifyMoneyV2;
  };
}

export interface ShopifySearchResult {
  predictiveSearch: {
    products: ShopifyProduct[];
  };
}

export interface ShopifyCartCreateResult {
  cartCreate: {
    cart: ShopifyCart;
    userErrors: Array<{ field: string[]; message: string }>;
  };
}
