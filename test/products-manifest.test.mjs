import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { seedProductManifest } from '../src/generators/products.mjs';
import {
  serializeProductManifest,
  validateProductManifest,
} from '../src/manifests/products.mjs';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

function candidateProduct(overrides = {}) {
  return {
    id: 'sample-product',
    name: 'Sample Product',
    brand: 'Sample Brand',
    sku: 'SAMPLE-001',
    price: '12.00',
    description: 'A deterministic source-backed sample product.',
    categories: ['Sample Category'],
    tags: ['sample'],
    readiness: 'research-candidate',
    source: {
      retailer: 'Example Retailer',
      url: 'https://example.com/products/sample-product',
      retrievedAt: '2026-08-14',
      price: '12.0',
      facts: ['The source lists the product under Sample Category.'],
    },
    metadata: { species: ['cat'], role: 'daily-food' },
    ...overrides,
  };
}

function manifest(products = [candidateProduct()], overrides = {}) {
  return {
    schemaVersion: '1.0',
    catalogId: 'sample-catalog',
    currency: 'USD',
    retrievedAt: '2026-08-14',
    products,
    ...overrides,
  };
}

function approvedProduct(overrides = {}) {
  return candidateProduct({
    readiness: 'merchant-approved',
    stockQuantity: 10,
    weight: 1.5,
    dimensions: { length: 8, width: 5, height: 3 },
    ...overrides,
  });
}

test('validates and deterministically normalizes a research candidate', () => {
  const normalized = validateProductManifest(manifest());

  assert.equal(normalized.products[0].source.price, '12.0');
  assert.deepEqual(normalized.products[0].metadata, { species: ['cat'], role: 'daily-food' });
  assert.equal(normalized.products[0].stockQuantity, undefined);
  assert.equal(serializeProductManifest(normalized), serializeProductManifest(normalized));
  assert.match(serializeProductManifest(normalized), /\n$/);
});

for (const [field, duplicate] of [
  ['id', { id: 'sample-product', sku: 'SAMPLE-002', source: { ...candidateProduct().source, url: 'https://example.com/products/two' } }],
  ['sku', { id: 'sample-product-two', source: { ...candidateProduct().source, url: 'https://example.com/products/two' } }],
  ['source URL', { id: 'sample-product-two', sku: 'SAMPLE-002' }],
]) {
  test(`rejects a duplicate ${field}`, () => {
    const second = candidateProduct(duplicate);
    assert.throws(() => validateProductManifest(manifest([candidateProduct(), second])), /duplicates products\[0\]/);
  });
}

test('rejects a source price that differs from the product price', () => {
  const product = candidateProduct({
    source: { ...candidateProduct().source, price: '12.01' },
  });
  assert.throws(() => validateProductManifest(manifest([product])), /products\[0\]\.source\.price: must equal products\[0\]\.price/);
});

test('rejects invalid source URLs and calendar dates with field paths', () => {
  const badUrl = candidateProduct({
    source: { ...candidateProduct().source, url: 'http://example.com/product' },
  });
  assert.throws(() => validateProductManifest(manifest([badUrl])), /products\[0\]\.source\.url: must use HTTPS/);

  const badDate = candidateProduct({
    source: { ...candidateProduct().source, retrievedAt: '2026-02-30' },
  });
  assert.throws(() => validateProductManifest(manifest([badDate])), /products\[0\]\.source\.retrievedAt: must be a valid date/);
});

test('rejects applying a research candidate before calling the writer', async () => {
  let calls = 0;
  const writer = { writeSimpleProduct: async () => { calls++; } };
  const normalized = validateProductManifest(manifest());

  await assert.rejects(() => seedProductManifest(writer, normalized), /merchant approval is required/);
  assert.equal(calls, 0);
});

test('requires complete commerce fields for merchant-approved products', () => {
  assert.throws(
    () => validateProductManifest(manifest([candidateProduct({ readiness: 'merchant-approved' })])),
    /products\[0\]\.stockQuantity/,
  );
});

test('rejects an unvalidated incomplete approved manifest before calling the writer', async () => {
  let calls = 0;
  const writer = { writeSimpleProduct: async () => { calls++; } };
  const incomplete = manifest([candidateProduct({ readiness: 'merchant-approved' })]);

  await assert.rejects(() => seedProductManifest(writer, incomplete), /products\[0\]\.stockQuantity/);
  assert.equal(calls, 0);
});

test('applies each validated merchant-approved product once', async () => {
  const calls = [];
  const writer = {
    async writeSimpleProduct(product) {
      calls.push(product);
      return { id: 91 };
    },
  };
  const normalized = validateProductManifest(manifest([approvedProduct()]));

  const result = await seedProductManifest(writer, normalized);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].source.url, 'https://example.com/products/sample-product');
  assert.deepEqual(result, { created: 1, failed: 0, ids: [91] });
});

test('CLI previews a manifest without credentials and emits normalized JSON', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'commerce-manifest-'));
  const input = join(directory, 'input.json');
  const output = join(directory, 'output.json');
  await writeFile(input, JSON.stringify(manifest()), 'utf8');

  const preview = spawnSync(process.execPath, ['bin/seed', 'products', '--manifest', input], {
    cwd: projectRoot,
    env: { PATH: process.env.PATH },
    encoding: 'utf8',
  });
  assert.equal(preview.status, 0, preview.stderr);
  assert.equal(JSON.parse(preview.stdout).catalogId, 'sample-catalog');
  assert.match(preview.stdout, /\n$/);

  const filePreview = spawnSync(
    process.execPath,
    ['bin/seed', 'products', '--manifest', input, '--output', output],
    { cwd: projectRoot, env: { PATH: process.env.PATH }, encoding: 'utf8' },
  );
  assert.equal(filePreview.status, 0, filePreview.stderr);
  assert.match(await readFile(output, 'utf8'), /\n$/);
});

test('CLI rejects candidate apply before loading platform credentials', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'commerce-manifest-'));
  const input = join(directory, 'input.json');
  await writeFile(input, JSON.stringify(manifest()), 'utf8');

  const result = spawnSync(process.execPath, ['bin/seed', 'products', '--manifest', input, '--apply'], {
    cwd: projectRoot,
    env: { PATH: process.env.PATH },
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /merchant approval is required/);
  assert.doesNotMatch(result.stderr, /Missing required .* config/);

  const invalidCombination = spawnSync(
    process.execPath,
    ['bin/seed', 'products', '--manifest', input, '--apply', '--output', join(directory, 'preview.json')],
    { cwd: projectRoot, env: { PATH: process.env.PATH }, encoding: 'utf8' },
  );
  assert.equal(invalidCombination.status, 1);
  assert.match(invalidCombination.stderr, /--output cannot be used with --apply/);
});
