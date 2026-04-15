import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from project root
loadDotenv({ path: resolve(__dirname, '..', '.env') });

export function loadConfig(opts = {}) {
  const platform = opts.platform || process.env.PLATFORM || 'wc';

  if (platform === 'bc') return loadBCConfig(opts);
  if (platform === 'shopify') return loadShopifyConfig(opts);
  return loadWCConfig(opts);
}

function loadWCConfig(opts) {
  const url = opts.url || process.env.WC_URL;
  const consumerKey = opts.key || process.env.WC_CONSUMER_KEY;
  const consumerSecret = opts.secret || process.env.WC_CONSUMER_SECRET;

  if (!url || !consumerKey || !consumerSecret) {
    const missing = [];
    if (!url) missing.push('WC_URL');
    if (!consumerKey) missing.push('WC_CONSUMER_KEY');
    if (!consumerSecret) missing.push('WC_CONSUMER_SECRET');
    throw new Error(
      `Missing required WooCommerce config: ${missing.join(', ')}\n` +
        'Set them as environment variables or in a .env file.',
    );
  }

  return {
    platform: 'wc',
    url: url.replace(/\/$/, ''),
    consumerKey,
    consumerSecret,
  };
}

function loadBCConfig(opts) {
  const storeHash = opts.storeHash || process.env.BC_STORE_HASH || process.env.BIGCOMMERCE_STORE_HASH;
  const accessToken = opts.accessToken || process.env.BC_ACCESS_TOKEN || process.env.BIGCOMMERCE_ACCESS_TOKEN;

  if (!storeHash || !accessToken) {
    const missing = [];
    if (!storeHash) missing.push('BC_STORE_HASH');
    if (!accessToken) missing.push('BC_ACCESS_TOKEN');
    throw new Error(
      `Missing required BigCommerce config: ${missing.join(', ')}\n` +
        'Set them as environment variables or in a .env file.',
    );
  }

  return {
    platform: 'bc',
    storeHash,
    accessToken,
  };
}

function loadShopifyConfig(opts) {
  const storeUrl = opts.storeUrl || process.env.SHOPIFY_STORE_URL;
  const accessToken = opts.accessToken || process.env.SHOPIFY_ACCESS_TOKEN;

  if (!storeUrl || !accessToken) {
    const missing = [];
    if (!storeUrl) missing.push('SHOPIFY_STORE_URL');
    if (!accessToken) missing.push('SHOPIFY_ACCESS_TOKEN');
    throw new Error(
      `Missing required Shopify config: ${missing.join(', ')}\n` +
        'Set them as environment variables or in a .env file. Run `seed auth` to obtain an access token.',
    );
  }

  return {
    platform: 'shopify',
    storeUrl: storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    accessToken,
  };
}
