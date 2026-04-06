import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger } from '../logger.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const log = createLogger('tax-rates');

function loadCsv() {
  const path = resolve(__dirname, '..', 'fixtures', 'tax-rates.csv');
  const raw = readFileSync(path, 'utf-8');
  const lines = raw.trim().split('\n');
  const headers = lines[0].split(',');

  return lines.slice(1).filter(Boolean).map((line) => {
    const values = line.split(',');
    const row = {};
    headers.forEach((h, i) => {
      row[h.trim()] = (values[i] || '').trim();
    });
    return row;
  });
}

function csvRowToTaxRate(row) {
  return {
    country: row['Country Code'] || '',
    state: row['State Code'] || '',
    postcode: row['ZIP/Postcode'] || '',
    city: row['City'] || '',
    rate: row['Rate %'] || '0',
    name: row['Tax Name'] || 'Tax',
    priority: parseInt(row['Priority'] || '1', 10),
    compound: row['Compound'] === '1',
    shipping: row['Shipping'] === '1',
    class: row['Tax Class'] || 'standard',
  };
}

export async function seedTaxRates(client, opts = {}) {
  const rows = loadCsv();
  log.banner(`Seeding ${rows.length} tax rate(s) from fixture`);

  // Optionally clean existing rates first
  if (opts.clean) {
    log.info('Cleaning existing tax rates...');
    const existing = await client.getAll('taxes', { per_page: 100 });
    for (const rate of existing) {
      await client.del(`taxes/${rate.id}`);
    }
    log.info(`Deleted ${existing.length} existing rate(s)`);
  }

  const results = { created: 0, failed: 0 };

  for (let i = 0; i < rows.length; i++) {
    const rate = csvRowToTaxRate(rows[i]);

    try {
      const created = await client.post('taxes', rate);
      results.created++;
      log.dim(`  ${rate.country}/${rate.state} ${rate.postcode || '*'} — ${rate.rate}% ${rate.name} [id: ${created.id}]`);
    } catch (err) {
      results.failed++;
      log.error(`  ${rate.country}/${rate.state} ${rate.name}: ${err.message}`);
    }

    log.progress(i + 1, rows.length, 'tax rates');
  }

  log.info(`\nDone: ${results.created} created, ${results.failed} failed`);
  return results;
}
