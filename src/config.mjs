import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from project root
loadDotenv({ path: resolve(__dirname, '..', '.env') });

export function loadConfig(opts = {}) {
  const url = opts.url || process.env.WC_URL;
  const consumerKey = opts.key || process.env.WC_CONSUMER_KEY;
  const consumerSecret = opts.secret || process.env.WC_CONSUMER_SECRET;

  if (!url || !consumerKey || !consumerSecret) {
    const missing = [];
    if (!url) missing.push('WC_URL');
    if (!consumerKey) missing.push('WC_CONSUMER_KEY');
    if (!consumerSecret) missing.push('WC_CONSUMER_SECRET');
    throw new Error(
      `Missing required config: ${missing.join(', ')}\n` +
        'Set them as environment variables or in a .env file.\n' +
        'See .env.example for reference.',
    );
  }

  return {
    url: url.replace(/\/$/, ''),
    consumerKey,
    consumerSecret,
    wpCliSsh: opts.ssh || process.env.WP_CLI_SSH || null,
  };
}
