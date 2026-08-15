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

  // --- Tiered pets corpus (multi-storefront) ---
  //
  // These methods are additive and do not touch writeSimpleProduct /
  // writeVariableProduct above. They target BigCommerce's MSF (multi-
  // storefront) model, verified against bigcommerce/api-specs
  // reference/catalog/products_catalog.v3.yml before writing this:
  //   - PUT /v3/catalog/products/channel-assignments  (bulk [{product_id, channel_id}])
  //   - PUT /v3/catalog/products/category-assignments (bulk [{product_id, category_id}])
  //   - custom_fields is an array of {name, value}, not a map
  //   - POST /v3/catalog/products/{id}/images accepts multipart image_file
  //     (raw upload) or JSON image_url (reusing an already-hosted URL)
  // A product created here intentionally omits the plain `categories` field:
  // BC's MSF guide states "a product must be explicitly assigned to a
  // channel to be sold on that channel" -- category/channel visibility is
  // handled entirely by the explicit assignment calls below, so a product
  // with no assignment calls made against it is invisible everywhere,
  // including the default channel.

  /**
   * Create a pets-corpus product (see src/generators/pet-catalog.mjs for the
   * input shape). Simple products (no `variations`) map straight through;
   * Food/Gear products with `variations` become BC's inline variants[].
   * Does not assign any channel or category -- call assignChannels /
   * assignCategories afterward.
   */
  async createPetProduct(product, { imageUrl } = {}) {
    const customFields = [
      { name: 'provenance', value: product.metadata.provenance },
      { name: 'tier', value: product.metadata.tier },
      { name: 'species', value: product.species },
    ];

    const base = {
      name: product.name,
      type: 'physical',
      sku: product.sku,
      description: product.description,
      is_visible: true,
      tags: product.tags,
      custom_fields: customFields,
    };

    if (imageUrl) {
      // Inline at create time -- avoids a second POST per product when
      // reusing an already-uploaded brand packshot's CDN URL.
      base.images = [{ image_url: imageUrl, is_thumbnail: true, description: `${product.brand} packshot` }];
    }

    if (Array.isArray(product.variations) && product.variations.length > 0) {
      Object.assign(base, {
        price: parseFloat(product.variations[0].price),
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
      });
    } else {
      Object.assign(base, {
        price: parseFloat(product.price),
        inventory_tracking: 'product',
        inventory_level: product.stockQuantity,
        weight: product.weight,
        depth: product.dimensions.length,
        width: product.dimensions.width,
        height: product.dimensions.height,
      });
    }

    return this.client.post('catalog/products', base);
  }

  /** Bulk PUT /v3/catalog/products/channel-assignments. assignments: [{productId, channelId}]. */
  async assignChannels(assignments) {
    const body = assignments.map((a) => ({ product_id: a.productId, channel_id: a.channelId }));
    return this.client.put('catalog/products/channel-assignments', body);
  }

  /** Bulk PUT /v3/catalog/products/category-assignments. assignments: [{productId, categoryId}]. */
  async assignCategories(assignments) {
    const body = assignments.map((a) => ({ product_id: a.productId, category_id: a.categoryId }));
    return this.client.put('catalog/products/category-assignments', body);
  }

  /** Multipart-upload a local image file to a product, returning the created image (with CDN URLs). */
  async uploadProductImageFile(productId, filePath, { isThumbnail = true, description } = {}) {
    const { readFile } = await import('node:fs/promises');
    const { basename } = await import('node:path');
    const buffer = await readFile(filePath);
    const formData = new FormData();
    formData.append('product_id', String(productId));
    formData.append('is_thumbnail', String(isThumbnail));
    if (description) formData.append('description', description);
    formData.append('image_file', new Blob([buffer]), basename(filePath));
    return this.client.postMultipart(`catalog/products/${productId}/images`, formData);
  }

  /** Attach an already-hosted image URL (e.g. a CDN URL from a prior upload) to a product. */
  async attachProductImageUrl(productId, imageUrl, { isThumbnail = true, description } = {}) {
    const payload = { image_url: imageUrl, is_thumbnail: isThumbnail };
    if (description) payload.description = description;
    return this.client.post(`catalog/products/${productId}/images`, payload);
  }

  /** Paginate the full catalog once and return Map(sku -> productId), for idempotent bulk runs. */
  async fetchSkuIndex() {
    const products = await this.client.getAll('catalog/products', { include_fields: 'sku' });
    const index = new Map();
    for (const p of products) {
      if (p.sku) index.set(p.sku, p.id);
    }
    return index;
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
