// Dry-run export for tiered preset corpora (currently `pets`). Sibling to
// manifests/products.mjs rather than an extension of it: that module's
// evidence-manifest schema (src/manifests/products.mjs `normalizeProduct`)
// is a whitelist that requires a real retailer `source` per product and
// silently drops anything outside id/name/brand/sku/price/description/
// categories/tags/readiness/source/metadata/stockQuantity/weight/dimensions.
// A synthetic bulk corpus has neither real sources to cite nor a shape that
// fits that whitelist (`variations`, `tier`, `categoryPath` would all be
// dropped) -- see test/pet-catalog.test.mjs for the mechanical proof.

import { DEFAULT_SEED, REAL_BRAND_DENYLIST, leafCategories } from '../presets/pets-data.mjs';
import {
  DEFAULT_ENTERPRISE_COUNT,
  DEFAULT_MEDIUM_COUNT,
  generatePetCatalog,
} from '../generators/pet-catalog.mjs';

const SCHEMA_VERSION = '1.0';
const VALID_TIERS = new Set(['medium', 'enterprise']);

export function filterByTier(products, tier = 'enterprise') {
  if (!VALID_TIERS.has(tier)) {
    throw new Error(`Unknown tier "${tier}". Must be one of: ${[...VALID_TIERS].join(', ')}`);
  }
  // Enterprise is a superset: it includes every medium-tier product plus the
  // enterprise-only remainder. Medium is a strict subset filtered by tier.
  return tier === 'medium' ? products.filter((product) => product.tier === 'medium') : products;
}

export function summarizeCatalog(products) {
  const byTier = { medium: 0, enterprise: 0 };
  const bySpecies = {};
  const byDepartment = {};
  const brandDistribution = {};
  const categoryPaths = new Set();

  for (const product of products) {
    byTier[product.tier] = (byTier[product.tier] || 0) + 1;
    bySpecies[product.species] = (bySpecies[product.species] || 0) + 1;
    const department = product.categoryPath[1];
    byDepartment[department] = (byDepartment[department] || 0) + 1;
    brandDistribution[product.brand] = (brandDistribution[product.brand] || 0) + 1;
    categoryPaths.add(product.categoryPath.join(' > '));
  }

  return {
    total: products.length,
    byTier,
    bySpecies,
    byDepartment,
    brandDistribution,
    categoryCoverage: {
      distinctPaths: categoryPaths.size,
      totalLeaves: leafCategories().length,
    },
  };
}

export function assertNoRealBrandCollisions(products) {
  const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const brandNames = [...new Set(products.map((product) => product.brand))];

  for (const brand of brandNames) {
    const normalizedBrand = normalize(brand);
    for (const real of REAL_BRAND_DENYLIST) {
      const normalizedReal = normalize(real);
      if (normalizedBrand.includes(normalizedReal) || normalizedReal.includes(normalizedBrand)) {
        throw new Error(`Brand "${brand}" collides with real pet brand "${real}"`);
      }
    }
  }
  return brandNames;
}

export function buildDryRunExport({
  tier = 'enterprise',
  seed = DEFAULT_SEED,
  enterpriseCount = DEFAULT_ENTERPRISE_COUNT,
  mediumCount = DEFAULT_MEDIUM_COUNT,
} = {}) {
  if (!VALID_TIERS.has(tier)) {
    throw new Error(`Unknown tier "${tier}". Must be one of: ${[...VALID_TIERS].join(', ')}`);
  }

  const fullCatalog = generatePetCatalog({ seed, enterpriseCount, mediumCount });
  const products = filterByTier(fullCatalog, tier);

  return {
    schemaVersion: SCHEMA_VERSION,
    preset: 'pets',
    tier,
    seed,
    summary: summarizeCatalog(products),
    products,
  };
}

export function serializeCatalogExport(exportObject) {
  return `${JSON.stringify(exportObject, null, 2)}\n`;
}

/**
 * Merge one or more BC category-tree handoff arrays (each item shaped
 * { id, path, ... }, `path` being " > "-joined) into a single
 * Map(path -> id). Later arrays win on a path collision. Used to layer a
 * tree addendum (e.g. a species branch added to an existing tree after the
 * fact) over the tree's original export without either side needing to
 * know about the other's origin.
 */
export function mergeCategoryPathMaps(...rowArrays) {
  const map = new Map();
  for (const rows of rowArrays) {
    for (const row of rows || []) {
      if (row?.path && row?.id !== undefined) map.set(row.path, row.id);
    }
  }
  return map;
}
