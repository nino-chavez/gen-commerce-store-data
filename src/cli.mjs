import { program } from 'commander';
import { createLogger } from './logger.mjs';
import { loadPreset, listPresets } from './presets/index.mjs';
import { seedProductManifest, seedProducts } from './generators/products.mjs';
import {
  assertProductManifestApplyReady,
  loadProductManifest,
  serializeProductManifest,
  writeProductManifest,
} from './manifests/products.mjs';
import { seedCustomers } from './generators/customers.mjs';
import { seedOrders } from './generators/orders.mjs';
import { seedCoupons } from './generators/coupons.mjs';
import { seedShipping } from './generators/shipping.mjs';
import { seedTaxRates } from './generators/tax-rates.mjs';
import { seedContent } from './generators/content.mjs';
import { authenticate } from './auth.mjs';

const log = createLogger('seed');

async function createWriter(opts) {
  const { loadConfig } = await import('./config.mjs');
  const config = loadConfig(opts);

  if (config.platform === 'bc') {
    const [{ BCClient }, { BCWriter }] = await Promise.all([
      import('./clients/bc-client.mjs'),
      import('./writers/bc-writer.mjs'),
    ]);
    const client = new BCClient(config);
    log.info(`Target: BigCommerce store ${config.storeHash}`);
    return { writer: new BCWriter(client), platform: 'bc', client };
  }

  if (config.platform === 'shopify') {
    const [{ ShopifyClient }, { ShopifyWriter }] = await Promise.all([
      import('./clients/shopify-client.mjs'),
      import('./writers/shopify-writer.mjs'),
    ]);
    const client = new ShopifyClient(config);
    log.info(`Target: Shopify store ${config.storeUrl}`);
    return { writer: new ShopifyWriter(client), platform: 'shopify', client };
  }

  const [{ WCClient }, { WCWriter }] = await Promise.all([
    import('./clients/wc-client.mjs'),
    import('./writers/wc-writer.mjs'),
  ]);
  const client = new WCClient(config);
  log.info(`Target: WooCommerce ${config.url}`);
  return { writer: new WCWriter(client), platform: 'wc', client };
}

async function withWriter(opts, fn) {
  try {
    const { writer, platform, client } = await createWriter(opts);
    await fn(writer, platform, client);
  } catch (err) {
    log.error(err.message);
    process.exit(1);
  }
}

// Global options
program
  .name('seed')
  .description('Multi-platform e-commerce test data seeder (WooCommerce, BigCommerce, Shopify)')
  .version('3.0.0')
  .option('-p, --platform <platform>', 'Platform: wc, bc, or shopify', 'wc')
  .option('--preset <preset>', `Store preset: ${listPresets().join(', ')}`)
  .option('--url <url>', 'WooCommerce store URL')
  .option('--key <key>', 'WC consumer key')
  .option('--secret <secret>', 'WC consumer secret')
  .option('--store-hash <hash>', 'BigCommerce store hash')
  .option('--store-url <url>', 'Shopify store URL (e.g. my-store.myshopify.com)')
  .option('--access-token <token>', 'BigCommerce or Shopify access token');

// Auth (Shopify-only)
program
  .command('auth')
  .description('Run Shopify OAuth flow and save access token to .env (Shopify only)')
  .action(async () => {
    const storeUrl = process.env.SHOPIFY_STORE_URL;
    const clientId = process.env.SHOPIFY_CLIENT_ID;
    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

    if (!storeUrl || !clientId || !clientSecret) {
      log.error('Missing required env vars for auth:');
      log.error('  SHOPIFY_STORE_URL, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET');
      log.error('Add them to your .env file first.');
      process.exit(1);
    }

    try {
      await authenticate(storeUrl, clientId, clientSecret);
    } catch (err) {
      log.error(err.message);
      process.exit(1);
    }
  });

// Products
program
  .command('products')
  .description('Generate faker products or validate a deterministic product manifest')
  .argument('[amount]', 'Number of products to create', '20')
  .option('-t, --type <type>', 'Product type: simple, variable, mixed', 'mixed')
  .option('--manifest <path>', 'Validate and preview a deterministic product manifest')
  .option('--output <path>', 'Write a normalized manifest preview to a JSON file')
  .option('--apply', 'Create merchant-approved manifest products in the configured store')
  .action(async (amount, opts, cmd) => {
    const globals = cmd.optsWithGlobals();

    if (opts.manifest) {
      try {
        const manifest = await loadProductManifest(opts.manifest);

        if (opts.apply) {
          if (opts.output) throw new Error('--output cannot be used with --apply');
          assertProductManifestApplyReady(manifest);
          return withWriter(globals, (writer) => seedProductManifest(writer, manifest));
        }

        if (opts.output) {
          await writeProductManifest(opts.output, manifest);
        } else {
          process.stdout.write(serializeProductManifest(manifest));
        }
        return;
      } catch (error) {
        log.error(error.message);
        process.exitCode = 1;
        return;
      }
    }

    if (opts.output || opts.apply) {
      log.error(`${opts.output ? '--output' : '--apply'} requires --manifest`);
      process.exitCode = 1;
      return;
    }

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
    if (globals.platform !== 'wc') {
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
    if (globals.platform !== 'wc') {
      log.error('Tax rate seeding is only supported for WooCommerce.');
      process.exit(1);
    }
    await withWriter(globals, (_writer, _platform, client) =>
      seedTaxRates(client, { clean: opts.clean }),
    );
  });

// Content: pages + blog posts (Shopify-only)
program
  .command('content')
  .description('Seed pages and blog posts (Shopify only)')
  .option('--pages <n>', 'Number of pages to create', '5')
  .option('--blog-posts <n>', 'Number of blog posts to create', '10')
  .action(async (opts, cmd) => {
    const globals = cmd.optsWithGlobals();
    if (globals.platform !== 'shopify') {
      log.error('Content seeding (pages + blog posts) is only supported for Shopify.');
      process.exit(1);
    }
    await withWriter(globals, (_writer, _platform, client) =>
      seedContent(client, {
        pages: parseInt(opts.pages),
        blogPosts: parseInt(opts.blogPosts),
      }),
    );
  });

// All
program
  .command('all')
  .description('Seed everything: products, customers, orders, coupons (+ shipping/tax for WC, + content for Shopify)')
  .option('--products <n>', 'Number of products', '30')
  .option('--customers <n>', 'Number of customers', '15')
  .option('--orders <n>', 'Number of orders', '50')
  .option('--coupons <n>', 'Number of coupons', '10')
  .option('--pages <n>', 'Number of pages (Shopify)', '5')
  .option('--blog-posts <n>', 'Number of blog posts (Shopify)', '10')
  .option('--skip-shipping', 'Skip shipping zones (WC)')
  .option('--skip-tax', 'Skip tax rates (WC)')
  .option('--skip-content', 'Skip pages + blog posts (Shopify)')
  .action(async (opts, cmd) => {
    const globals = cmd.optsWithGlobals();
    await withWriter(globals, async (writer, platform, client) => {
      const preset = loadPreset(globals.preset);
      await seedProducts(writer, parseInt(opts.products), { preset });
      await seedCustomers(writer, parseInt(opts.customers));
      await seedCoupons(writer, parseInt(opts.coupons));
      await seedOrders(writer, parseInt(opts.orders));

      if (platform === 'wc') {
        if (!opts.skipShipping) {
          await seedShipping(client, { negative: false });
          await seedShipping(client, { negative: true });
        }
        if (!opts.skipTax) {
          await seedTaxRates(client, { clean: true });
        }
      }

      if (platform === 'shopify' && !opts.skipContent) {
        await seedContent(client, {
          pages: parseInt(opts.pages),
          blogPosts: parseInt(opts.blogPosts),
        });
      }

      log.banner('ALL SEEDING COMPLETE');
    });
  });

await program.parseAsync();
