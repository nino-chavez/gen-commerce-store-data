import { faker } from '@faker-js/faker';
import { createLogger } from '../logger.mjs';

const log = createLogger('customers');

const COUNTRY_LOCALES = {
  US: 'en_US', CA: 'en_CA', GB: 'en_GB', AU: 'en_AU',
  DE: 'de', FR: 'fr', ES: 'es', JP: 'ja', MX: 'es_MX', BR: 'pt_BR',
};

function generateAddress(country) {
  return {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    company: faker.datatype.boolean(0.3) ? faker.company.name() : '',
    address1: faker.location.streetAddress(),
    address2: faker.datatype.boolean(0.2) ? faker.location.secondaryAddress() : '',
    city: faker.location.city(),
    state: faker.location.state({ abbreviated: true }),
    postcode: faker.location.zipCode(),
    country: country || 'US',
    phone: faker.phone.number(),
  };
}

/**
 * Generate a platform-neutral customer.
 */
function generateCustomer(country) {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const billing = generateAddress(country);
  const shippingSameAsBilling = faker.datatype.boolean(0.7);

  return {
    email: faker.internet.email({ firstName, lastName }).toLowerCase(),
    firstName,
    lastName,
    username: faker.internet.username({ firstName, lastName }).toLowerCase(),
    billing: { ...billing, firstName, lastName },
    shipping: shippingSameAsBilling
      ? { ...billing, firstName, lastName }
      : { ...generateAddress(country), firstName, lastName },
  };
}

export async function seedCustomers(writer, amount = 10, opts = {}) {
  const country = opts.country || null;
  log.banner(`Seeding ${amount} customer(s)${country ? ` (country: ${country})` : ''}`);

  if (country && COUNTRY_LOCALES[country]) {
    faker.locale = COUNTRY_LOCALES[country];
  }

  const results = { created: 0, failed: 0, ids: [] };

  for (let i = 0; i < amount; i++) {
    try {
      const data = generateCustomer(country || faker.helpers.arrayElement(['US', 'CA', 'GB', 'AU', 'DE']));
      const created = await writer.writeCustomer(data);
      results.ids.push(created.id);
      results.created++;
      log.success(`${data.firstName} ${data.lastName} <${data.email}> [id: ${created.id}]`);
    } catch (err) {
      results.failed++;
      log.error(`Customer ${i + 1}: ${err.message}`);
    }

    log.progress(i + 1, amount, 'customers');
  }

  log.info(`\nDone: ${results.created} created, ${results.failed} failed`);
  return results;
}
