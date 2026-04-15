import { createLogger } from '../logger.mjs';

const log = createLogger('shopify-writer');

/**
 * Translates platform-neutral shapes to Shopify Admin REST payloads and POSTs them.
 *
 * Shopify specifics:
 *   - Products: `variants` are inline on the product create call
 *   - Customers: `addresses[]` are inline on the customer create call
 *   - Orders: `line_items[]` reference variant IDs; financial_status replaces WC status
 *   - Coupons: modeled as a PriceRule + DiscountCode pair
 */
export class ShopifyWriter {
  constructor(client) {
    this.client = client;
  }

  // --- Categories (Shopify has no real categories — use product_type/tags) ---

  async ensureCategories(names) {
    return names;
  }

  // --- Products ---

  async writeSimpleProduct(product) {
    const payload = {
      product: {
        title: product.name,
        body_html: product.description,
        vendor: product.vendor || 'Seed Toolkit',
        product_type: product.categories[0] || '',
        tags: product.tags.join(', '),
        status: 'active',
        variants: [
          {
            price: product.price,
            compare_at_price: product.salePrice || null,
            sku: product.sku,
            inventory_management: 'shopify',
            inventory_quantity: product.stockQuantity,
            weight: product.weight,
            weight_unit: 'kg',
          },
        ],
      },
    };

    const res = await this.client.post('/products.json', payload);
    return this._normalize(res.product);
  }

  async writeVariableProduct(product) {
    const attrName = product.attributes[0]?.name || 'Option';
    const options = product.attributes[0]?.options || [];

    const payload = {
      product: {
        title: product.name,
        body_html: product.description,
        vendor: product.vendor || 'Seed Toolkit',
        product_type: product.categories[0] || '',
        status: 'active',
        options: [{ name: attrName, values: options }],
        variants: product.variations.map((v) => ({
          option1: v.attributes[0]?.option,
          price: v.price,
          sku: v.sku,
          inventory_management: 'shopify',
          inventory_quantity: v.stockQuantity,
          weight: v.weight,
          weight_unit: 'kg',
        })),
      },
    };

    const res = await this.client.post('/products.json', payload);
    return this._normalize(res.product);
  }

  _normalize(product) {
    return {
      id: product.id,
      type: product.variants?.length > 1 ? 'variable' : 'simple',
      variations: product.variants?.map((v) => v.id) || [],
      raw: product,
    };
  }

  // --- Customers ---

  async writeCustomer(customer) {
    const payload = {
      customer: {
        email: customer.email,
        first_name: customer.firstName,
        last_name: customer.lastName,
        verified_email: true,
        addresses: [
          {
            first_name: customer.billing.firstName,
            last_name: customer.billing.lastName,
            company: customer.billing.company || '',
            address1: customer.billing.address1,
            address2: customer.billing.address2 || '',
            city: customer.billing.city,
            province: customer.billing.state,
            zip: customer.billing.postcode,
            country_code: customer.billing.country,
            phone: customer.billing.phone || '',
            default: true,
          },
        ],
        send_email_welcome: false,
      },
    };

    const res = await this.client.post('/customers.json', payload);
    return { id: res.customer.id, email: res.customer.email };
  }

  // --- Orders ---

  async fetchProducts() {
    // Shopify uses Link-header cursor pagination — first 250 is enough for seeding.
    const all = [];
    const res = await this.client.get('/products.json?limit=250');
    for (const p of res.products || []) {
      all.push({
        id: p.id,
        type: p.variants?.length > 1 ? 'variable' : 'simple',
        variations: p.variants?.map((v) => v.id) || [],
        raw: p,
      });
    }
    return all;
  }

  async fetchCustomers() {
    const res = await this.client.get('/customers.json?limit=250');
    return (res.customers || []).map((c) => ({ id: c.id, email: c.email }));
  }

  async writeOrder(order) {
    // Shopify line_items need variant_id. For variable products with
    // variations in the neutral shape, item.variationId already is a variant id.
    // For simple products we use the product's first variant id — fetched lazily.
    const lineItems = [];
    for (const item of order.lineItems) {
      if (item.variationId) {
        lineItems.push({ variant_id: item.variationId, quantity: item.quantity });
        continue;
      }
      // Need a variant id for simple products — fetch it
      try {
        const res = await this.client.get(`/products/${item.productId}/variants.json`);
        const firstVariant = res.variants?.[0];
        if (firstVariant) {
          lineItems.push({ variant_id: firstVariant.id, quantity: item.quantity });
        }
      } catch (err) {
        log.warn(`Could not resolve variant for product ${item.productId}: ${err.message}`);
      }
    }

    if (lineItems.length === 0) {
      throw new Error('No resolvable line items for order');
    }

    const address = {
      first_name: order.billing.firstName,
      last_name: order.billing.lastName,
      address1: order.billing.address1,
      address2: order.billing.address2 || '',
      city: order.billing.city,
      province: order.billing.state,
      zip: order.billing.postcode,
      country: order.billing.country,
      phone: order.billing.phone || '',
    };

    const payload = {
      order: {
        line_items: lineItems,
        billing_address: address,
        shipping_address: address,
        email: order.billingEmail,
        financial_status: this._mapFinancialStatus(order.status),
        fulfillment_status: this._mapFulfillmentStatus(order.status),
        send_receipt: false,
        send_fulfillment_receipt: false,
        processed_at: order.dateCreated,
      },
    };

    if (order.customerId) {
      payload.order.customer = { id: order.customerId };
    }

    const res = await this.client.post('/orders.json', payload);
    return { id: res.order.id, name: res.order.name };
  }

  _mapFinancialStatus(status) {
    const map = {
      completed: 'paid',
      processing: 'paid',
      'on-hold': 'pending',
      pending: 'pending',
      failed: 'voided',
      refunded: 'refunded',
      cancelled: 'voided',
    };
    return map[status] || 'pending';
  }

  _mapFulfillmentStatus(status) {
    if (status === 'completed') return 'fulfilled';
    return null;
  }

  // --- Coupons (PriceRule + DiscountCode) ---

  async writeCoupon(coupon) {
    const isPercent = coupon.discountType === 'percent';
    const valueType = isPercent ? 'percentage' : 'fixed_amount';
    // Shopify uses negative values for discounts
    const value = `-${Math.abs(parseFloat(coupon.amount))}`;

    const pricePayload = {
      price_rule: {
        title: coupon.code,
        target_type: 'line_item',
        target_selection: 'all',
        allocation_method: 'across',
        value_type: valueType,
        value,
        customer_selection: 'all',
        starts_at: new Date().toISOString(),
        ends_at: coupon.dateExpires ? `${coupon.dateExpires}T00:00:00Z` : null,
      },
    };

    if (coupon.usageLimit) {
      pricePayload.price_rule.usage_limit = coupon.usageLimit;
    }
    if (coupon.usageLimitPerUser) {
      pricePayload.price_rule.once_per_customer = coupon.usageLimitPerUser === 1;
    }
    if (coupon.minimumAmount) {
      pricePayload.price_rule.prerequisite_subtotal_range = {
        greater_than_or_equal_to: String(coupon.minimumAmount),
      };
    }

    const priceRule = await this.client.post('/price_rules.json', pricePayload);
    const priceRuleId = priceRule.price_rule.id;

    const codeRes = await this.client.post(`/price_rules/${priceRuleId}/discount_codes.json`, {
      discount_code: { code: coupon.code },
    });

    return { id: codeRes.discount_code.id, priceRuleId };
  }
}
