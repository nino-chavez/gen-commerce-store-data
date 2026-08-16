import { faker } from '@faker-js/faker';
import {
  BRANDS,
  DEFAULT_SEED,
  DEPARTMENT_PRICE_RANGE,
  FOOD_FLAVORS,
  FOOD_SIZES,
  GEAR_COLORS,
  GEAR_SIZES,
  POSITIONING_MULTIPLIER,
  SPECIES_OWNER_LABEL,
  SPECIES_PRICE_MULTIPLIER,
  STYLE_DESCRIPTORS,
  categoryPath,
  leafCategories,
} from '../presets/pets-data.mjs';

export const DEFAULT_ENTERPRISE_COUNT = 3200;
export const DEFAULT_MEDIUM_COUNT = 700;

const SPECIES_CODE = {
  Dogs: 'DOG',
  Cats: 'CAT',
  Birds: 'BRD',
  Reptiles: 'RPT',
  'Small Pets': 'SPT',
  'Fish & Aquatics': 'FSH',
};

const DEPARTMENT_CODE = {
  Food: 'FOD',
  Treats: 'TRT',
  'Toys & Enrichment': 'TOY',
  'Health & Care': 'HLT',
  'Gear & Habitat': 'GER',
};

function priceRangeFor(department, species, positioning) {
  const base = DEPARTMENT_PRICE_RANGE[department];
  const speciesMult = SPECIES_PRICE_MULTIPLIER[species];
  const posMult = POSITIONING_MULTIPLIER[positioning];
  return {
    min: Math.round(base.min * speciesMult * posMult * 100) / 100,
    max: Math.round(base.max * speciesMult * posMult * 100) / 100,
  };
}

function pickBrand(leaf) {
  const pool = BRANDS.filter((brand) => brand.species === leaf.species);
  return faker.helpers.arrayElement(pool);
}

function buildName(leaf, brand) {
  const descriptor = faker.helpers.arrayElement(STYLE_DESCRIPTORS[leaf.department]);
  return `${brand.name} ${descriptor} ${leaf.subcategory}`;
}

function buildDescription(leaf, brand, name) {
  const ownerLabel = SPECIES_OWNER_LABEL[leaf.species];
  const deptLower = leaf.department.toLowerCase();
  return `${name} from ${brand.name} is formulated for ${ownerLabel} owners shopping the ${deptLower} aisle. `
    + `Part of the ${leaf.subcategory} line under ${leaf.species} > ${leaf.department}. `
    + faker.lorem.sentence();
}

function sku(index, leaf) {
  return `PET-${SPECIES_CODE[leaf.species]}-${DEPARTMENT_CODE[leaf.department]}-${String(index + 1).padStart(5, '0')}`;
}

function honestyMetadata(tier) {
  return { provenance: 'synthetic', tier };
}

function buildFoodVariations(leaf, brand, baseSku, range) {
  const sizes = faker.helpers.arrayElements(FOOD_SIZES[leaf.species], { min: 2, max: Math.min(3, FOOD_SIZES[leaf.species].length) });
  const flavors = faker.helpers.arrayElements(FOOD_FLAVORS[leaf.species], { min: 2, max: Math.min(4, FOOD_FLAVORS[leaf.species].length) });
  const basePrice = faker.number.float({ min: range.min, max: range.max, fractionDigits: 2 });

  const variations = [];
  let suffix = 0;
  for (const size of sizes) {
    for (const flavor of flavors) {
      suffix += 1;
      const sizeIndex = sizes.indexOf(size);
      const modifier = sizeIndex * (basePrice * 0.35);
      const price = Math.max(1, basePrice + modifier).toFixed(2);
      variations.push({
        sku: `${baseSku}-${String(suffix).padStart(2, '0')}`,
        price,
        stockQuantity: faker.number.int({ min: 0, max: 200 }),
        weight: faker.number.float({ min: 0.2, max: 35, fractionDigits: 1 }),
        attributes: [
          { name: 'Size', option: size },
          { name: 'Flavor', option: flavor },
        ],
      });
    }
  }

  return {
    attributes: [
      { name: 'Size', options: sizes },
      { name: 'Flavor', options: flavors },
    ],
    variations,
  };
}

function buildGearVariations(leaf, brand, baseSku, range) {
  const sizes = faker.helpers.arrayElements(GEAR_SIZES[leaf.species], { min: 2, max: Math.min(3, GEAR_SIZES[leaf.species].length) });
  const colors = faker.helpers.arrayElements(GEAR_COLORS, { min: 2, max: 3 });
  const basePrice = faker.number.float({ min: range.min, max: range.max, fractionDigits: 2 });

  const variations = [];
  let suffix = 0;
  for (const size of sizes) {
    for (const color of colors) {
      suffix += 1;
      const sizeIndex = sizes.indexOf(size);
      const modifier = sizeIndex * (basePrice * 0.25);
      const price = Math.max(1, basePrice + modifier).toFixed(2);
      variations.push({
        sku: `${baseSku}-${String(suffix).padStart(2, '0')}`,
        price,
        stockQuantity: faker.number.int({ min: 0, max: 120 }),
        weight: faker.number.float({ min: 0.5, max: 60, fractionDigits: 1 }),
        attributes: [
          { name: 'Size', option: size },
          { name: 'Color', option: color },
        ],
      });
    }
  }

  return {
    attributes: [
      { name: 'Size', options: sizes },
      { name: 'Color', options: colors },
    ],
    variations,
  };
}

function buildSimpleFields(range) {
  const price = faker.commerce.price({ min: range.min, max: range.max, dec: 2 });
  return {
    price,
    stockQuantity: faker.number.int({ min: 0, max: 200 }),
    weight: faker.number.float({ min: 0.1, max: 40, fractionDigits: 1 }),
    dimensions: {
      length: faker.number.int({ min: 1, max: 40 }),
      width: faker.number.int({ min: 1, max: 40 }),
      height: faker.number.int({ min: 1, max: 30 }),
    },
  };
}

/**
 * Generate the full deterministic pets corpus. Same seed -> identical output
 * every run (faker is seeded once, generation order is fixed by index).
 *
 * Products [0, mediumCount) carry tier "medium" and are included in both the
 * medium and enterprise exports. Products [mediumCount, enterpriseCount) carry
 * tier "enterprise" and are enterprise-only. Category assignment round-robins
 * over the full leaf list by index, so the medium subset (which walks the same
 * leaf order) still touches every leaf multiple times.
 */
export function generatePetCatalog({
  seed = DEFAULT_SEED,
  enterpriseCount = DEFAULT_ENTERPRISE_COUNT,
  mediumCount = DEFAULT_MEDIUM_COUNT,
} = {}) {
  faker.seed(seed);
  const leaves = leafCategories();
  const products = [];

  for (let i = 0; i < enterpriseCount; i++) {
    const leaf = leaves[i % leaves.length];
    const brand = pickBrand(leaf);
    const tier = i < mediumCount ? 'medium' : 'enterprise';
    const range = priceRangeFor(leaf.department, leaf.species, brand.positioning);
    const name = buildName(leaf, brand);
    const description = buildDescription(leaf, brand, name);
    const baseSku = sku(i, leaf);
    const path = categoryPath(leaf);

    const product = {
      id: baseSku,
      sku: baseSku,
      name,
      description,
      shortDescription: faker.lorem.sentence(),
      brand: brand.name,
      brandPositioning: brand.positioning,
      species: leaf.species,
      categoryPath: path,
      categories: [path.join(' > ')],
      tags: ['synthetic-demo', leaf.department],
      tier,
      metadata: honestyMetadata(tier),
    };

    if (leaf.department === 'Food') {
      Object.assign(product, buildFoodVariations(leaf, brand, baseSku, range));
    } else if (leaf.department === 'Gear & Habitat') {
      Object.assign(product, buildGearVariations(leaf, brand, baseSku, range));
    } else {
      Object.assign(product, buildSimpleFields(range));
    }

    products.push(product);
  }

  return products;
}
