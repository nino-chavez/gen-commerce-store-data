/**
 * Translates platform-neutral shapes to WooCommerce payloads and POSTs them.
 */
export class WCWriter {
  constructor(client) {
    this.client = client;
  }

  // --- Categories ---

  async ensureCategories(names) {
    // WC auto-creates categories by name, so just return name objects
    return names.map((name) => ({ name }));
  }

  // --- Products ---

  async writeSimpleProduct(product) {
    const payload = {
      name: product.name,
      type: 'simple',
      regular_price: product.price,
      sale_price: product.salePrice || '',
      description: product.description,
      short_description: product.shortDescription,
      sku: product.sku,
      manage_stock: true,
      stock_quantity: product.stockQuantity,
      weight: String(product.weight),
      dimensions: {
        length: String(product.dimensions.length),
        width: String(product.dimensions.width),
        height: String(product.dimensions.height),
      },
      categories: product.categories.map((name) => ({ name })),
      tags: product.tags.map((name) => ({ name })),
    };

    return this.client.post('products', payload);
  }

  async writeVariableProduct(product) {
    const payload = {
      name: product.name,
      type: 'variable',
      description: product.description,
      short_description: product.shortDescription,
      sku: product.sku,
      categories: product.categories.map((name) => ({ name })),
      attributes: product.attributes.map((attr) => ({
        name: attr.name,
        visible: true,
        variation: true,
        options: attr.options,
      })),
    };

    const created = await this.client.post('products', payload);

    // WC requires separate POST per variation
    for (const variation of product.variations) {
      await this.client.post(`products/${created.id}/variations`, {
        regular_price: variation.price,
        sku: variation.sku,
        manage_stock: true,
        stock_quantity: variation.stockQuantity,
        weight: String(variation.weight),
        attributes: variation.attributes.map((a) => ({
          name: a.name,
          option: a.option,
        })),
      });
    }

    return created;
  }

  // --- Customers ---

  async writeCustomer(customer) {
    const payload = {
      email: customer.email,
      first_name: customer.firstName,
      last_name: customer.lastName,
      username: customer.username,
      billing: this._toWCAddress(customer.billing, customer.email),
      shipping: this._toWCAddress(customer.shipping),
    };

    return this.client.post('customers', payload);
  }

  _toWCAddress(addr, email) {
    const result = {
      first_name: addr.firstName,
      last_name: addr.lastName,
      company: addr.company || '',
      address_1: addr.address1,
      address_2: addr.address2 || '',
      city: addr.city,
      state: addr.state,
      postcode: addr.postcode,
      country: addr.country,
      phone: addr.phone,
    };
    if (email) result.email = email;
    return result;
  }

  // --- Orders ---

  async fetchProducts() {
    return this.client.getAll('products', { status: 'publish', per_page: 100 });
  }

  async fetchCustomers() {
    return this.client.getAll('customers', { per_page: 100 });
  }

  async writeOrder(order) {
    const lineItems = order.lineItems.map((item) => {
      if (item.variationId) {
        return { variation_id: item.variationId, quantity: item.quantity };
      }
      return { product_id: item.productId, quantity: item.quantity };
    });

    const payload = {
      status: order.status,
      date_created: order.dateCreated,
      billing: { ...this._toWCAddress(order.billing), email: order.billingEmail },
      shipping: this._toWCAddress(order.shipping),
      line_items: lineItems,
      shipping_lines: [{
        method_id: 'flat_rate',
        method_title: 'Flat Rate',
        total: order.shippingTotal,
      }],
    };

    if (order.customerId) {
      payload.customer_id = order.customerId;
    }

    if (order.feeLines?.length) {
      payload.fee_lines = order.feeLines.map((f) => ({
        name: f.name,
        total: f.total,
      }));
    }

    return this.client.post('orders', payload);
  }

  // --- Coupons ---

  async writeCoupon(coupon) {
    const payload = {
      code: coupon.code,
      discount_type: coupon.discountType,
      amount: coupon.amount,
      description: coupon.description,
      individual_use: coupon.individualUse,
      usage_limit: coupon.usageLimit,
      usage_limit_per_user: coupon.usageLimitPerUser,
      free_shipping: coupon.freeShipping,
      minimum_amount: coupon.minimumAmount || '',
      maximum_amount: coupon.maximumAmount || '',
      date_expires: coupon.dateExpires,
    };

    return this.client.post('coupons', payload);
  }

  // --- Existing WC-specific seeders (shipping, tax) pass through directly ---

  get passthrough() {
    return this.client;
  }
}
