import { faker } from '@faker-js/faker';
import { createLogger } from '../logger.mjs';

const log = createLogger('orders');

const STATUS_WEIGHTS = {
  completed: 0.45,
  processing: 0.25,
  'on-hold': 0.1,
  pending: 0.1,
  failed: 0.05,
  refunded: 0.05,
};

function weightedStatus() {
  const rand = Math.random();
  let cumulative = 0;
  for (const [status, weight] of Object.entries(STATUS_WEIGHTS)) {
    cumulative += weight;
    if (rand <= cumulative) return status;
  }
  return 'completed';
}

function generateAddress() {
  return {
    first_name: faker.person.firstName(),
    last_name: faker.person.lastName(),
    address_1: faker.location.streetAddress(),
    address_2: faker.datatype.boolean(0.2) ? faker.location.secondaryAddress() : '',
    city: faker.location.city(),
    state: faker.location.state({ abbreviated: true }),
    postcode: faker.location.zipCode(),
    country: 'US',
    phone: faker.phone.number(),
  };
}

function randomDate(start, end) {
  const s = start ? new Date(start) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const e = end ? new Date(end) : new Date();
  return new Date(s.getTime() + Math.random() * (e.getTime() - s.getTime()));
}

export async function seedOrders(client, amount = 20, opts = {}) {
  const status = opts.status || null;
  log.banner(`Seeding ${amount} order(s)${status ? ` (status: ${status})` : ''}`);

  // Fetch existing products and customers to reference
  log.info('Fetching existing products...');
  const products = await client.getAll('products', { status: 'publish', per_page: 100 });
  if (products.length === 0) {
    log.error('No products found. Seed products first: wc-seed products');
    return { created: 0, failed: 0, ids: [] };
  }
  log.info(`Found ${products.length} product(s) to sample from`);

  log.info('Fetching existing customers...');
  const customers = await client.getAll('customers', { per_page: 100 });
  log.info(`Found ${customers.length} customer(s) to sample from`);

  const results = { created: 0, failed: 0, ids: [] };

  for (let i = 0; i < amount; i++) {
    try {
      // Pick 1-5 random products as line items
      const numItems = faker.number.int({ min: 1, max: 5 });
      const selectedProducts = faker.helpers.arrayElements(products, { min: 1, max: numItems });

      const lineItems = selectedProducts.map((p) => {
        const qty = faker.number.int({ min: 1, max: 4 });

        // Handle variable products — pick a variation if available
        if (p.type === 'variable' && p.variations?.length > 0) {
          return { variation_id: faker.helpers.arrayElement(p.variations), quantity: qty };
        }

        return { product_id: p.id, quantity: qty };
      });

      const billing = generateAddress();
      const orderDate = randomDate(opts.dateStart, opts.dateEnd);

      const orderData = {
        status: status || weightedStatus(),
        date_created: orderDate.toISOString(),
        billing: { ...billing, email: faker.internet.email().toLowerCase() },
        shipping: billing,
        line_items: lineItems,
        shipping_lines: [
          {
            method_id: 'flat_rate',
            method_title: 'Flat Rate',
            total: faker.commerce.price({ min: 0, max: 25, dec: 2 }),
          },
        ],
      };

      // Assign a customer if any exist
      if (customers.length > 0) {
        orderData.customer_id = faker.helpers.arrayElement(customers).id;
      }

      // Optionally add a fee (20% chance)
      if (faker.datatype.boolean(0.2)) {
        orderData.fee_lines = [
          {
            name: faker.helpers.arrayElement(['Handling Fee', 'Rush Processing', 'Gift Wrap']),
            total: faker.commerce.price({ min: 1, max: 15, dec: 2 }),
          },
        ];
      }

      const created = await client.post('orders', orderData);
      results.ids.push(created.id);
      results.created++;
      log.success(`Order #${created.number} — ${created.status} — $${created.total} (${lineItems.length} items) [id: ${created.id}]`);
    } catch (err) {
      results.failed++;
      log.error(`Order ${i + 1}: ${err.message}`);
    }

    log.progress(i + 1, amount, 'orders');
  }

  log.info(`\nDone: ${results.created} created, ${results.failed} failed`);
  return results;
}
