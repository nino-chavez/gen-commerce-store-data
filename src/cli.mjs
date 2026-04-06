import { program } from 'commander';
import { loadConfig } from './config.mjs';
import { WCClient } from './wc-client.mjs';
import { createLogger } from './logger.mjs';
import { seedProducts } from './generators/products.mjs';
import { seedCustomers } from './generators/customers.mjs';
import { seedOrders } from './generators/orders.mjs';
import { seedCoupons } from './generators/coupons.mjs';
import { seedShipping } from './generators/shipping.mjs';
import { seedTaxRates } from './generators/tax-rates.mjs';

const log = createLogger('wc-seed');

function createClient(opts) {
  const config = loadConfig(opts);
  log.info(`Target: ${config.url}`);
  return new WCClient(config);
}

async function withClient(opts, fn) {
  try {
    const client = createClient(opts);
    await fn(client);
  } catch (err) {
    log.error(err.message);
    process.exit(1);
  }
}

// Global options
program
  .name('wc-seed')
  .description('WooCommerce test data seeder for the DMS team')
  .version('1.0.0')
  .option('--url <url>', 'WooCommerce store URL')
  .option('--key <key>', 'Consumer key')
  .option('--secret <secret>', 'Consumer secret');

// Products
program
  .command('products')
  .description('Generate products with faker data')
  .argument('[amount]', 'Number of products to create', '20')
  .option('-t, --type <type>', 'Product type: simple, variable, mixed', 'mixed')
  .action(async (amount, opts, cmd) => {
    await withClient(cmd.optsWithGlobals(), (client) =>
      seedProducts(client, parseInt(amount), { type: opts.type }),
    );
  });

// Customers
program
  .command('customers')
  .description('Generate customers with faker data')
  .argument('[amount]', 'Number of customers to create', '10')
  .option('-c, --country <code>', 'ISO country code (e.g. US, CA, GB)')
  .action(async (amount, opts, cmd) => {
    await withClient(cmd.optsWithGlobals(), (client) =>
      seedCustomers(client, parseInt(amount), { country: opts.country }),
    );
  });

// Orders
program
  .command('orders')
  .description('Generate orders (requires existing products)')
  .argument('[amount]', 'Number of orders to create', '20')
  .option('-s, --status <status>', 'Order status: completed, processing, on-hold, pending, failed')
  .option('--date-start <date>', 'Start date (YYYY-MM-DD)')
  .option('--date-end <date>', 'End date (YYYY-MM-DD)')
  .action(async (amount, opts, cmd) => {
    await withClient(cmd.optsWithGlobals(), (client) =>
      seedOrders(client, parseInt(amount), {
        status: opts.status,
        dateStart: opts.dateStart,
        dateEnd: opts.dateEnd,
      }),
    );
  });

// Coupons
program
  .command('coupons')
  .description('Generate discount coupons')
  .argument('[amount]', 'Number of coupons to create', '10')
  .option('-t, --discount-type <type>', 'Discount type: fixed_cart, percent')
  .option('--min <amount>', 'Minimum discount amount')
  .option('--max <amount>', 'Maximum discount amount')
  .action(async (amount, opts, cmd) => {
    await withClient(cmd.optsWithGlobals(), (client) =>
      seedCoupons(client, parseInt(amount), {
        discountType: opts.discountType,
        min: opts.min ? parseFloat(opts.min) : undefined,
        max: opts.max ? parseFloat(opts.max) : undefined,
      }),
    );
  });

// Shipping
program
  .command('shipping')
  .description('Seed shipping zones from fixtures')
  .option('-n, --negative', 'Seed negative/edge-case zones (DMS-6309)')
  .action(async (opts, cmd) => {
    await withClient(cmd.optsWithGlobals(), (client) =>
      seedShipping(client, { negative: opts.negative }),
    );
  });

// Tax Rates
program
  .command('tax-rates')
  .description('Import tax rates from CSV fixture')
  .option('--clean', 'Delete existing tax rates before importing')
  .action(async (opts, cmd) => {
    await withClient(cmd.optsWithGlobals(), (client) =>
      seedTaxRates(client, { clean: opts.clean }),
    );
  });

// All
program
  .command('all')
  .description('Seed everything: products, customers, orders, coupons, shipping, tax rates')
  .option('--products <n>', 'Number of products', '30')
  .option('--customers <n>', 'Number of customers', '15')
  .option('--orders <n>', 'Number of orders', '50')
  .option('--coupons <n>', 'Number of coupons', '10')
  .option('--skip-shipping', 'Skip shipping zones')
  .option('--skip-tax', 'Skip tax rates')
  .action(async (opts, cmd) => {
    await withClient(cmd.optsWithGlobals(), async (client) => {
      await seedProducts(client, parseInt(opts.products));
      await seedCustomers(client, parseInt(opts.customers));
      await seedCoupons(client, parseInt(opts.coupons));
      await seedOrders(client, parseInt(opts.orders));

      if (!opts.skipShipping) {
        await seedShipping(client, { negative: false });
        await seedShipping(client, { negative: true });
      }

      if (!opts.skipTax) {
        await seedTaxRates(client, { clean: true });
      }

      log.banner('ALL SEEDING COMPLETE');
    });
  });

program.parse();
