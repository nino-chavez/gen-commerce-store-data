import assert from 'node:assert/strict';
import test from 'node:test';

import { validateProductManifest } from '../src/manifests/products.mjs';
import {
  assertNoRealBrandCollisions,
  buildDryRunExport,
  filterByTier,
  mergeCategoryPathMaps,
  serializeCatalogExport,
  summarizeCatalog,
} from '../src/manifests/pet-catalog-export.mjs';
import { generatePetCatalog } from '../src/generators/pet-catalog.mjs';
import { BRANDS, REAL_BRAND_DENYLIST, leafCategories } from '../src/presets/pets-data.mjs';

const SMALL_ENTERPRISE = 320;
const SMALL_MEDIUM = 70;

test('the evidence-manifest schema (PR #1) silently drops fields a synthetic bulk corpus needs', () => {
  // This is the mechanical justification for building a sibling export
  // module instead of routing pets products through
  // src/manifests/products.mjs: normalizeProduct there is an explicit
  // whitelist that has no room for `variations` or `tier`, and requires a
  // real HTTPS `source.url` + non-empty `facts` per product -- fields a
  // synthetic corpus cannot honestly supply at any scale, let alone 3,200x.
  const product = {
    id: 'probe', name: 'Probe', brand: 'B', sku: 'SKU-PROBE', price: '10.00',
    description: 'd', categories: ['Dogs > Food > Dry Food'], tags: ['synthetic-demo'],
    readiness: 'research-candidate',
    source: { retailer: 'X', url: 'https://example.com/x', retrievedAt: '2026-08-14', price: '10.00', facts: ['f'] },
    metadata: {},
    variations: [{ sku: 'SKU-PROBE-A', price: '10.00' }],
    tier: 'medium',
  };
  const manifest = { schemaVersion: '1.0', catalogId: 'c', currency: 'USD', retrievedAt: '2026-08-14', products: [product] };
  const normalized = validateProductManifest(manifest);

  assert.equal('variations' in normalized.products[0], false);
  assert.equal('tier' in normalized.products[0], false);
});

test('generation is deterministic: two runs with the same seed are identical', () => {
  const first = generatePetCatalog({ enterpriseCount: SMALL_ENTERPRISE, mediumCount: SMALL_MEDIUM });
  const second = generatePetCatalog({ enterpriseCount: SMALL_ENTERPRISE, mediumCount: SMALL_MEDIUM });
  assert.deepEqual(first, second);
});

test('a different seed produces a different corpus', () => {
  const seeded = generatePetCatalog({ seed: 1, enterpriseCount: SMALL_ENTERPRISE, mediumCount: SMALL_MEDIUM });
  const otherSeed = generatePetCatalog({ seed: 2, enterpriseCount: SMALL_ENTERPRISE, mediumCount: SMALL_MEDIUM });
  assert.notDeepEqual(seeded, otherSeed);
});

test('default seed produces counts within +/-5% of the medium/enterprise targets', () => {
  const enterprise = buildDryRunExport({ tier: 'enterprise' });
  const medium = buildDryRunExport({ tier: 'medium' });

  assert.ok(Math.abs(enterprise.products.length - 3200) / 3200 <= 0.05);
  assert.ok(Math.abs(medium.products.length - 700) / 700 <= 0.05);
  assert.equal(medium.products.length, 700, 'medium count is exact by construction, not just within tolerance');
  assert.equal(enterprise.products.length, 3200, 'enterprise count is exact by construction, not just within tolerance');
});

test('medium tier is a strict, ordered prefix subset of the enterprise corpus', () => {
  const enterprise = generatePetCatalog({ enterpriseCount: SMALL_ENTERPRISE, mediumCount: SMALL_MEDIUM });
  const medium = filterByTier(enterprise, 'medium');

  assert.equal(medium.length, SMALL_MEDIUM);
  assert.deepEqual(medium, enterprise.slice(0, SMALL_MEDIUM));
  for (const product of medium) {
    assert.equal(product.tier, 'medium');
  }
});

test('enterprise tier filter returns the full corpus (medium is included, not additive)', () => {
  const enterprise = generatePetCatalog({ enterpriseCount: SMALL_ENTERPRISE, mediumCount: SMALL_MEDIUM });
  const filtered = filterByTier(enterprise, 'enterprise');
  assert.deepEqual(filtered, enterprise);
});

test('filterByTier rejects an unknown tier', () => {
  assert.throws(() => filterByTier([], 'ultra'), /Unknown tier/);
});

test('every invented brand avoids collision with real pet brands', () => {
  assert.equal(BRANDS.length, 36);
  assert.doesNotThrow(() => assertNoRealBrandCollisions(BRANDS.map((b) => ({ brand: b.name }))));
});

test('assertNoRealBrandCollisions actually catches a collision (denylist is wired up)', () => {
  const withCollision = [{ brand: 'Purina Pro Plan' }, { brand: 'Totally Fine Brand' }];
  assert.throws(() => assertNoRealBrandCollisions(withCollision), /collides with real pet brand/);
  assert.ok(REAL_BRAND_DENYLIST.length >= 25);
});

test('every generated product has a valid 3-level category path', () => {
  const leaves = new Set(leafCategories().map((leaf) => `${leaf.species} > ${leaf.department} > ${leaf.subcategory}`));
  const corpus = generatePetCatalog({ enterpriseCount: SMALL_ENTERPRISE, mediumCount: SMALL_MEDIUM });

  for (const product of corpus) {
    assert.equal(product.categoryPath.length, 3);
    assert.equal(product.categories[0], product.categoryPath.join(' > '));
    assert.ok(leaves.has(product.categories[0]), `${product.categories[0]} is not a known leaf category`);
  }
});

test('medium tier alone covers every leaf category (round-robin assignment)', () => {
  const corpus = generatePetCatalog();
  const medium = filterByTier(corpus, 'medium');
  const coverage = summarizeCatalog(medium).categoryCoverage;
  assert.equal(coverage.distinctPaths, coverage.totalLeaves);
});

test('variant integrity: food gets size x flavor, gear gets size x color, toys are single-variant', () => {
  const corpus = generatePetCatalog({ enterpriseCount: SMALL_ENTERPRISE, mediumCount: SMALL_MEDIUM });

  for (const product of corpus) {
    const department = product.categoryPath[1];

    if (department === 'Food') {
      assert.ok(Array.isArray(product.variations) && product.variations.length > 0);
      const attrNames = product.attributes.map((a) => a.name).sort();
      assert.deepEqual(attrNames, ['Flavor', 'Size']);
      for (const variation of product.variations) {
        const names = variation.attributes.map((a) => a.name).sort();
        assert.deepEqual(names, ['Flavor', 'Size']);
        assert.ok(variation.sku.startsWith(product.sku));
      }
    } else if (department === 'Gear & Habitat') {
      assert.ok(Array.isArray(product.variations) && product.variations.length > 0);
      const attrNames = product.attributes.map((a) => a.name).sort();
      assert.deepEqual(attrNames, ['Color', 'Size']);
      for (const variation of product.variations) {
        const names = variation.attributes.map((a) => a.name).sort();
        assert.deepEqual(names, ['Color', 'Size']);
      }
    } else {
      // Treats, Toys & Enrichment, Health & Care: single-variant simple products.
      assert.equal(product.variations, undefined);
      assert.equal(typeof product.price, 'string');
      assert.equal(typeof product.stockQuantity, 'number');
    }
  }
});

test('every product carries the honesty labels the writer path maps to custom_fields', () => {
  const corpus = generatePetCatalog({ enterpriseCount: SMALL_ENTERPRISE, mediumCount: SMALL_MEDIUM });
  for (const product of corpus) {
    assert.ok(product.tags.includes('synthetic-demo'));
    assert.equal(product.metadata.provenance, 'synthetic');
    assert.equal(product.metadata.tier, product.tier);
  }
});

test('SKUs are unique across the full enterprise corpus', () => {
  const corpus = generatePetCatalog();
  const skus = new Set(corpus.map((p) => p.sku));
  assert.equal(skus.size, corpus.length);
});

test('mergeCategoryPathMaps: layers a tree addendum over the base export by path', () => {
  const base = [
    { id: 388, path: 'Dogs > Food' },
    { id: 389, path: 'Dogs > Treats' },
  ];
  const addendum = [
    { id: 414, path: 'Fish & Aquatics > Food' },
    { id: 415, path: 'Fish & Aquatics > Treats' },
  ];

  const merged = mergeCategoryPathMaps(base, addendum);

  assert.equal(merged.size, 4);
  assert.equal(merged.get('Dogs > Food'), 388);
  assert.equal(merged.get('Fish & Aquatics > Food'), 414);
});

test('mergeCategoryPathMaps: a later array overrides an earlier one on path collision', () => {
  const base = [{ id: 1, path: 'Dogs > Food' }];
  const patch = [{ id: 999, path: 'Dogs > Food' }];

  const merged = mergeCategoryPathMaps(base, patch);

  assert.equal(merged.get('Dogs > Food'), 999);
});

test('mergeCategoryPathMaps: tolerates missing/empty inputs', () => {
  assert.equal(mergeCategoryPathMaps().size, 0);
  assert.equal(mergeCategoryPathMaps(undefined, [{ id: 1, path: 'X' }], null).size, 1);
});

test('serializeCatalogExport round-trips through JSON with a trailing newline', () => {
  const result = buildDryRunExport({ tier: 'medium', enterpriseCount: SMALL_ENTERPRISE, mediumCount: SMALL_MEDIUM });
  const serialized = serializeCatalogExport(result);
  assert.match(serialized, /\n$/);
  assert.deepEqual(JSON.parse(serialized), result);
});
