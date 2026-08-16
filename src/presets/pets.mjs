import { faker } from '@faker-js/faker';
import {
  BRANDS,
  FOOD_FLAVORS,
  FOOD_SIZES,
  GEAR_COLORS,
  GEAR_SIZES,
  POSITIONING_MULTIPLIER,
  SPECIES_OWNER_LABEL,
  SPECIES_PRICE_MULTIPLIER,
  DEPARTMENT_PRICE_RANGE,
  STYLE_DESCRIPTORS,
  categoryPath,
  leafCategories,
} from './pets-data.mjs';
import { buildDryRunExport } from '../manifests/pet-catalog-export.mjs';

// Full 3-level leaf paths ("Dogs > Food > Dry Food") as flat "categories",
// so this preset works with the generic single-item faker path
// (`generateSimpleProduct`/`generateVariableProduct` in
// src/generators/products.mjs) the same way apparel/furniture/electronics do.
// The tiered bulk corpus used by `--dry-run` lives in
// src/generators/pet-catalog.mjs and does not go through this generic path.
const CATEGORIES = leafCategories().map((leaf) => {
  const base = DEPARTMENT_PRICE_RANGE[leaf.department];
  const speciesMult = SPECIES_PRICE_MULTIPLIER[leaf.species];
  const midMult = POSITIONING_MULTIPLIER.mid;
  return {
    name: categoryPath(leaf).join(' > '),
    priceRange: {
      min: Math.round(base.min * speciesMult * midMult * 100) / 100,
      max: Math.round(base.max * speciesMult * midMult * 100) / 100,
    },
  };
});

const ATTRIBUTES = {
  Size: [...new Set([...Object.values(GEAR_SIZES).flat(), ...Object.values(FOOD_SIZES).flat()])],
  Flavor: [...new Set(Object.values(FOOD_FLAVORS).flat())],
  Color: GEAR_COLORS,
};

const TAGS = ['synthetic-demo', ...Object.keys(DEPARTMENT_PRICE_RANGE)];

function parseCategory(category) {
  const [species, department, subcategory] = category.split(' > ');
  return { species, department, subcategory };
}

function nameGenerator(category) {
  const leaf = parseCategory(category);
  const pool = BRANDS.filter((brand) => brand.species === leaf.species);
  const brand = faker.helpers.arrayElement(pool);
  const descriptor = faker.helpers.arrayElement(STYLE_DESCRIPTORS[leaf.department] || STYLE_DESCRIPTORS.Food);
  return `${brand.name} ${descriptor} ${leaf.subcategory}`;
}

function descriptionGenerator(name, category) {
  const leaf = parseCategory(category);
  const ownerLabel = SPECIES_OWNER_LABEL[leaf.species];
  return `${name} is made for ${ownerLabel} owners shopping ${leaf.department.toLowerCase()}. `
    + `Part of the ${leaf.subcategory} line under ${leaf.species} > ${leaf.department}. `
    + faker.lorem.sentence();
}

export default {
  name: 'pets',
  categories: CATEGORIES,
  attributes: ATTRIBUTES,
  tags: TAGS,
  priceRange: { min: 2, max: 460 },
  nameGenerator,
  descriptionGenerator,
  // Tiered bulk-corpus dry-run export. Not part of the generic single-item
  // preset shape above -- consumed directly by `seed products --dry-run`.
  buildDryRunExport,
};
