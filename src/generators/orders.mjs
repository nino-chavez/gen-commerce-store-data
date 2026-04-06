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
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    address1: faker.location.streetAddress(),
    address2: faker.datatype.boolean(0.2) ? faker.location.secondaryAddress() : '',
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

export async function seedOrders(writer, amount = 20, opts = {}) {
  const status = opts.status || null;
  log.banner(`Seeding ${amount} order(s)${status ? ` (status: ${status})` : ''}`);

  // Fetch existing products and customers via writer
  log.info('Fetching existing products...');
  const products = await writer.fetchProducts();
  if (products.length === 0) {
    log.error('No products found. Seed products first.');
    return { created: 0, failed: 0, ids: [] };
  }
  log.info(`Found ${products.length} product(s) to sample from`);

  log.info('Fetching existing customers...');
  const customers = await writer.fetchCustomers();
  log.info(`Found ${customers.length} customer(s) to sample from`);

  const results = { created: 0, failed: 0, ids: [] };

  for (let i = 0; i < amount; i++) {
    try {
      const numItems = faker.number.int({ min: 1, max: 5 });
      const selectedProducts = faker.helpers.arrayElements(products, { min: 1, max: numItems });

      const lineItems = selectedProducts.map((p) => {
        const qty = faker.number.int({ min: 1, max: 4 });
        if (p.type === 'variable' && p.variations?.length > 0) {
          return { variationId: faker.helpers.arrayElement(p.variations), quantity: qty };
        }
        return { productId: p.id, quantity: qty };
      });

      const billing = generateAddress();
      const orderDate = randomDate(opts.dateStart, opts.dateEnd);

      const orderData = {
        status: status || weightedStatus(),
        dateCreated: orderDate.toISOString(),
        billing,
        billingEmail: faker.internet.email().toLowerCase(),
        shipping: billing,
        lineItems,
        shippingTotal: faker.commerce.price({ min: 0, max: 25, dec: 2 }),
        customerId: customers.length > 0
          ? faker.helpers.arrayElement(customers).id
          : null,
        feeLines: faker.datatype.boolean(0.2) ? [{
          name: faker.helpers.arrayElement(['Handling Fee', 'Rush Processing', 'Gift Wrap']),
          total: faker.commerce.price({ min: 1, max: 15, dec: 2 }),
        }] : [],
      };

      const created = await writer.writeOrder(orderData);
      results.ids.push(created.id);
      results.created++;
      log.success(`Order #${created.id} -- ${orderData.status} (${lineItems.length} items)`);
    } catch (err) {
      results.failed++;
      log.error(`Order ${i + 1}: ${err.message}`);
    }

    log.progress(i + 1, amount, 'orders');
  }

  log.info(`\nDone: ${results.created} created, ${results.failed} failed`);
  return results;
}
