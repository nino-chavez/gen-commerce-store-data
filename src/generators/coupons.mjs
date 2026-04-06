import { faker } from '@faker-js/faker';
import { createLogger } from '../logger.mjs';

const log = createLogger('coupons');

const PREFIXES = ['SAVE', 'DEAL', 'PROMO', 'SALE', 'OFF', 'SPRING', 'SUMMER', 'FALL', 'WELCOME', 'VIP'];

function generateCoupon(opts = {}) {
  const discountType = opts.discountType || faker.helpers.arrayElement(['fixed_cart', 'percent']);
  const isPercent = discountType === 'percent';
  const min = opts.min || (isPercent ? 5 : 5);
  const max = opts.max || (isPercent ? 50 : 100);
  const amount = faker.number.float({ min, max, fractionDigits: 2 });

  const prefix = faker.helpers.arrayElement(PREFIXES);
  const suffix = isPercent ? Math.round(amount) : faker.string.alphanumeric(4).toUpperCase();

  return {
    code: `${prefix}${suffix}`,
    discount_type: discountType,
    amount: String(amount),
    description: `Auto-generated ${isPercent ? 'percentage' : 'fixed'} discount coupon`,
    individual_use: faker.datatype.boolean(0.3),
    usage_limit: faker.datatype.boolean(0.5) ? faker.number.int({ min: 10, max: 500 }) : null,
    usage_limit_per_user: faker.datatype.boolean(0.4) ? faker.number.int({ min: 1, max: 5 }) : null,
    free_shipping: faker.datatype.boolean(0.15),
    minimum_amount: faker.datatype.boolean(0.4) ? String(faker.number.int({ min: 25, max: 200 })) : '',
    maximum_amount: faker.datatype.boolean(0.2) ? String(faker.number.int({ min: 200, max: 1000 })) : '',
    date_expires: faker.datatype.boolean(0.5)
      ? faker.date.future({ years: 1 }).toISOString().split('T')[0]
      : null,
  };
}

export async function seedCoupons(client, amount = 10, opts = {}) {
  log.banner(`Seeding ${amount} coupon(s)`);

  const results = { created: 0, failed: 0, ids: [] };

  for (let i = 0; i < amount; i++) {
    try {
      const data = generateCoupon(opts);
      const created = await client.post('coupons', data);
      results.ids.push(created.id);
      results.created++;

      const typeLabel = created.discount_type === 'percent' ? `${created.amount}%` : `$${created.amount}`;
      log.success(`${created.code} — ${typeLabel} off [id: ${created.id}]`);
    } catch (err) {
      results.failed++;
      log.error(`Coupon ${i + 1}: ${err.message}`);
    }

    log.progress(i + 1, amount, 'coupons');
  }

  log.info(`\nDone: ${results.created} created, ${results.failed} failed`);
  return results;
}
