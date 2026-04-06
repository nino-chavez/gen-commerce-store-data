import { createLogger } from '../logger.mjs';

const log = createLogger('bc-writer');

/**
 * Translates platform-neutral shapes to BigCommerce payloads and POSTs them.
 */
export class BCWriter {
  constructor(client) {
    this.client = client;
    this._categoryCache = new Map(); // name → id
  }

  // --- Categories ---

  async ensureCategories(names) {
    const ids = [];
    for (const name of names) {
      if (this._categoryCache.has(name)) {
        ids.push(this._categoryCache.get(name));
        continue;
      }

      // Check if category already exists
      const existing = await this.client.getAll('catalog/categories', {
        name,
      });
      if (existing.length > 0) {
        this._categoryCache.set(name, existing[0].id);
        ids.push(existing[0].id);
        continue;
      }

      // Create it — parent_id 0 = top-level
      const created = await this.client.post('catalog/categories', {
        name,
        parent_id: 0,
      });
      this._categoryCache.set(name, created.id);
      ids.push(created.id);
      log.dim(`  Created category: ${name} [id: ${created.id}]`);
    }
    return ids;
  }

  // --- Products ---

  async writeSimpleProduct(product) {
    const categoryIds = await this.ensureCategories(product.categories);

    const payload = {
      name: product.name,
      type: 'physical',
      price: parseFloat(product.price),
      sale_price: product.salePrice ? parseFloat(product.salePrice) : undefined,
      description: product.description,
      sku: product.sku,
      inventory_tracking: 'product',
      inventory_level: product.stockQuantity,
      weight: product.weight,
      depth: product.dimensions.length,
      width: product.dimensions.width,
      height: product.dimensions.height,
      categories: categoryIds,
    };

    // Remove undefined keys
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    return this.client.post('catalog/products', payload);
  }

  async writeVariableProduct(product) {
    const categoryIds = await this.ensureCategories(product.categories);

    // BC handles variants inline — first create product with option(s)
    const payload = {
      name: product.name,
      type: 'physical',
      description: product.description,
      sku: product.sku,
      categories: categoryIds,
      // Need a base price for BC
      price: parseFloat(product.variations[0]?.price || '0'),
      variants: product.variations.map((v) => ({
        sku: v.sku,
        price: parseFloat(v.price),
        inventory_level: v.stockQuantity,
        weight: v.weight,
        option_values: v.attributes.map((a) => ({
          option_display_name: a.name,
          label: a.option,
        })),
      })),
    };

    return this.client.post('catalog/products', payload);
  }

  // --- Customers ---

  async writeCustomer(customer) {
    // BC v3: create customer first, then add address separately
    const customerPayload = [{
      email: customer.email,
      first_name: customer.firstName,
      last_name: customer.lastName,
    }];

    const [created] = await this.client.post('customers', customerPayload);

    // Add billing address
    const addressPayload = [{
      customer_id: created.id,
      first_name: customer.billing.firstName,
      last_name: customer.billing.lastName,
      company: customer.billing.company || '',
      address1: customer.billing.address1,
      address2: customer.billing.address2 || '',
      city: customer.billing.city,
      state_or_province: customer.billing.state,
      postal_code: customer.billing.postcode,
      country_code: customer.billing.country,
      phone: customer.billing.phone || '',
      address_type: 'residential',
    }];

    try {
      await this.client.post('customers/addresses', addressPayload);
    } catch (err) {
      log.warn(`  Could not add address for customer ${created.id}: ${err.message}`);
    }

    return created;
  }

  // --- Orders ---

  async fetchProducts() {
    return this.client.getAll('catalog/products');
  }

  async fetchCustomers() {
    return this.client.getAll('customers');
  }

  async writeOrder(order) {
    // BC v2 orders API
    const products = order.lineItems.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
    }));

    const payload = {
      status_id: this._mapOrderStatus(order.status),
      date_created: order.dateCreated,
      billing_address: {
        first_name: order.billing.firstName,
        last_name: order.billing.lastName,
        street_1: order.billing.address1,
        street_2: order.billing.address2 || '',
        city: order.billing.city,
        state: order.billing.state,
        zip: order.billing.postcode,
        country: order.billing.country,
        country_iso2: order.billing.country,
        email: order.billingEmail,
        phone: order.billing.phone || '',
      },
      products,
    };

    if (order.customerId) {
      payload.customer_id = order.customerId;
    }

    return this.client.post('orders', payload, { version: 'v2' });
  }

  _mapOrderStatus(status) {
    // BC status IDs: 0=Incomplete, 1=Pending, 2=Shipped, 5=Cancelled,
    // 7=Awaiting Payment, 9=Awaiting Fulfillment, 10=Completed, 11=Awaiting Shipment
    const map = {
      pending: 7,
      processing: 9,
      'on-hold': 1,
      completed: 10,
      cancelled: 5,
      refunded: 4,
      failed: 6,
    };
    return map[status] || 9;
  }

  // --- Coupons ---

  async writeCoupon(coupon) {
    // BC v2 coupons
    const typeMap = {
      fixed_cart: 'per_total_discount',
      percent: 'percentage_discount',
    };

    const payload = {
      name: coupon.description || coupon.code,
      code: coupon.code,
      type: typeMap[coupon.discountType] || 'percentage_discount',
      amount: coupon.amount,
      enabled: true,
      applies_to: { entity: 'categories', ids: [0] }, // all categories
    };

    if (coupon.minimumAmount) {
      payload.min_purchase = coupon.minimumAmount;
    }
    if (coupon.usageLimit) {
      payload.max_uses = coupon.usageLimit;
    }
    if (coupon.usageLimitPerUser) {
      payload.max_uses_per_customer = coupon.usageLimitPerUser;
    }

    return this.client.post('coupons', payload, { version: 'v2' });
  }
}
