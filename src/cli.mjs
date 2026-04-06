import { program } from 'commander';
import { loadConfig } from './config.mjs';
import { WCClient } from './clients/wc-client.mjs';
import { BCClient } from './clients/bc-client.mjs';
import { WCWriter } from './writers/wc-writer.mjs';
import { BCWriter } from './writers/bc-writer.mjs';
import { createLogger } from './logger.mjs';
import { loadPreset, listPresets } from './presets/index.mjs';
import { seedProducts } from './generators/products.mjs';
import { seedCustomers } from './generators/customers.mjs';
import { seedOrders } from './generators/orders.mjs';
import { seedCoupons } from './generators/coupons.mjs';
import { seedShipping } from './generators/shipping.mjs';
import { seedTaxRates } from './generators/tax-rates.mjs';

const log = createLogger('seed');

function createWriter(opts) {
  const config = loadConfig(opts);

  if (config.platform === 'bc') {
    const client = new BCClient(config);
    log.info(`Target: BigCommerce store ${config.storeHash}`);
    return { writer: new BCWriter(client), platform: 'bc', client };
  }

  const client = new WCClient(config);
  log.info(`Target: ${config.url}`);
  return { writer: new WCWriter(client), platform: 'wc', client };
}

async function withWriter(opts, fn) {
  try {
    const { writer, platform, client } = createWriter(opts);
    await fn(writer, platform, client);
  } catch (err) {
    log.error(err.message);
    process.exit(1);
  }
}

// Global options
program
  .name('seed')
  .description('Multi-platform e-commerce test data seeder')
  .version('2.0.0')
  .option('-p, --platform <platform>', 'Platform: wc or bc', 'wc')
  .option('--preset <preset>', `Store preset: ${listPresets().join(', ')}`)
  .option('--url <url>', 'WooCommerce store URL')
  .option('--key <key>', 'WC consumer key')
  .option('--secret <secret>', 'WC consumer secret')
  .option('--store-hash <hash>', 'BigCommerce store hash')
  .option('--access-token <token>', 'BigCommerce access token');

// Products
program
  .command('products')
  .description('Generate products with faker data')
  .argument('[amount]', 'Number of products to create', '20')
  .option('-t, --type <type>', 'Product type: simple, variable, mixed', 'mixed')
  .action(async (amount, opts, cmd) => {
    const globals = cmd.optsWithGlobals();
    await withWriter(globals, (writer) => {
      const preset = loadPreset(globals.preset);
      return seedProducts(writer, parseInt(amount), { type: opts.type, preset });
    });
  });

// Customers
program
  .command('customers')
  .description('Generate customers with faker data')
  .argument('[amount]', 'Number of customers to create', '10')
  .option('-c, --country <code>', 'ISO country code (e.g. US, CA, GB)')
  .action(async (amount, opts, cmd) => {
    await withWriter(cmd.optsWithGlobals(), (writer) =>
      seedCustomers(writer, parseInt(amount), { country: opts.country }),
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
    await withWriter(cmd.optsWithGlobals(), (writer) =>
      seedOrders(writer, parseInt(amount), {
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
    await withWriter(cmd.optsWithGlobals(), (writer) =>
      seedCoupons(writer, parseInt(amount), {
        discountType: opts.discountType,
        min: opts.min ? parseFloat(opts.min) : undefined,
        max: opts.max ? parseFloat(opts.max) : undefined,
      }),
    );
  });

// Shipping (WC-only)
program
  .command('shipping')
  .description('Seed shipping zones from fixtures (WooCommerce only)')
  .option('-n, --negative', 'Seed negative/edge-case zones')
  .action(async (opts, cmd) => {
    const globals = cmd.optsWithGlobals();
    if (globals.platform === 'bc') {
      log.error('Shipping zone seeding is only supported for WooCommerce.');
      process.exit(1);
    }
    await withWriter(globals, (_writer, _platform, client) =>
      seedShipping(client, { negative: opts.negative }),
    );
  });

// Tax Rates (WC-only)
program
  .command('tax-rates')
  .description('Import tax rates from CSV fixture (WooCommerce only)')
  .option('--clean', 'Delete existing tax rates before importing')
  .action(async (opts, cmd) => {
    const globals = cmd.optsWithGlobals();
    if (globals.platform === 'bc') {
      log.error('Tax rate seeding is only supported for WooCommerce.');
      process.exit(1);
    }
    await withWriter(globals, (_writer, _platform, client) =>
      seedTaxRates(client, { clean: opts.clean }),
    );
  });

// All
program
  .command('all')
  .description('Seed everything: products, customers, orders, coupons (+ shipping/tax for WC)')
  .option('--products <n>', 'Number of products', '30')
  .option('--customers <n>', 'Number of customers', '15')
  .option('--orders <n>', 'Number of orders', '50')
  .option('--coupons <n>', 'Number of coupons', '10')
  .option('--skip-shipping', 'Skip shipping zones')
  .option('--skip-tax', 'Skip tax rates')
  .action(async (opts, cmd) => {
    const globals = cmd.optsWithGlobals();
    await withWriter(globals, async (writer, platform, client) => {
      const preset = loadPreset(globals.preset);
      await seedProducts(writer, parseInt(opts.products), { preset });
      await seedCustomers(writer, parseInt(opts.customers));
      await seedCoupons(writer, parseInt(opts.coupons));
      await seedOrders(writer, parseInt(opts.orders));

      // WC-specific seeders
      if (platform === 'wc') {
        if (!opts.skipShipping) {
          await seedShipping(client, { negative: false });
          await seedShipping(client, { negative: true });
        }

        if (!opts.skipTax) {
          await seedTaxRates(client, { clean: true });
        }
      }

      log.banner('ALL SEEDING COMPLETE');
    });
  });

program.parse();
