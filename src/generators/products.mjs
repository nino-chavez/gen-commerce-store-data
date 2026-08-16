import { faker } from '@faker-js/faker';
import { createLogger } from '../logger.mjs';
import { assertProductManifestApplyReady } from '../manifests/products.mjs';

const log = createLogger('products');

// Default fallbacks when no preset is provided
const DEFAULT_CATEGORIES = [
  'Clothing', 'Electronics', 'Home & Garden', 'Sports', 'Books',
  'Toys', 'Health & Beauty', 'Food & Drink', 'Automotive', 'Pet Supplies',
];

const DEFAULT_ATTRIBUTES = {
  Color: ['Red', 'Blue', 'Green', 'Black', 'White', 'Navy', 'Grey'],
  Size: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  Material: ['Cotton', 'Polyester', 'Leather', 'Denim', 'Silk', 'Wool'],
};

const DEFAULT_PRICE_RANGE = { min: 5, max: 500 };

/**
 * Generate a platform-neutral simple product.
 */
function generateSimpleProduct(preset) {
  const categories = preset?.categories?.map((c) => c.name || c) || DEFAULT_CATEGORIES;
  const priceRange = preset?.priceRange || DEFAULT_PRICE_RANGE;
  const category = faker.helpers.arrayElement(categories);

  // Use category-specific price range if available
  const catConfig = preset?.categories?.find((c) => (c.name || c) === category);
  const range = catConfig?.priceRange || priceRange;

  const price = faker.commerce.price({ min: range.min, max: range.max, dec: 2 });
  const onSale = faker.datatype.boolean(0.3);

  const name = preset?.nameGenerator
    ? preset.nameGenerator(category)
    : faker.commerce.productName();

  const description = preset?.descriptionGenerator
    ? preset.descriptionGenerator(name, category)
    : faker.commerce.productDescription();

  return {
    name,
    price,
    salePrice: onSale ? faker.commerce.price({ min: 1, max: parseFloat(price) * 0.8, dec: 2 }) : null,
    description,
    shortDescription: faker.lorem.sentence(),
    sku: `SKU-${faker.string.alphanumeric(8).toUpperCase()}`,
    stockQuantity: faker.number.int({ min: 0, max: 200 }),
    weight: faker.number.float({ min: 0.1, max: 50, fractionDigits: 1 }),
    dimensions: {
      length: faker.number.int({ min: 1, max: 100 }),
      width: faker.number.int({ min: 1, max: 100 }),
      height: faker.number.int({ min: 1, max: 50 }),
    },
    categories: [category],
    tags: faker.helpers.arrayElements(
      preset?.tags || ['Sale', 'New', 'Featured', 'Clearance', 'Popular', 'Limited'],
      { min: 0, max: 3 },
    ),
  };
}

/**
 * Generate a platform-neutral variable product.
 */
function generateVariableProduct(preset) {
  const categories = preset?.categories?.map((c) => c.name || c) || DEFAULT_CATEGORIES;
  const attributes = preset?.attributes || DEFAULT_ATTRIBUTES;
  const priceRange = preset?.priceRange || DEFAULT_PRICE_RANGE;
  const category = faker.helpers.arrayElement(categories);

  const catConfig = preset?.categories?.find((c) => (c.name || c) === category);
  const range = catConfig?.priceRange || priceRange;

  const attrName = faker.helpers.arrayElement(Object.keys(attributes));
  const attrOptions = faker.helpers.arrayElements(attributes[attrName], { min: 2, max: 4 });
  const basePrice = faker.number.float({ min: range.min, max: range.max, fractionDigits: 2 });

  const name = preset?.nameGenerator
    ? preset.nameGenerator(category)
    : faker.commerce.productName();

  return {
    name,
    description: preset?.descriptionGenerator
      ? preset.descriptionGenerator(name, category)
      : faker.commerce.productDescription(),
    shortDescription: faker.lorem.sentence(),
    sku: `SKU-${faker.string.alphanumeric(8).toUpperCase()}`,
    categories: [category],
    attributes: [{
      name: attrName,
      options: attrOptions,
    }],
    variations: attrOptions.map((option) => {
      const modifier = faker.number.float({ min: -10, max: 20, fractionDigits: 2 });
      const price = Math.max(1, basePrice + modifier).toFixed(2);

      return {
        price,
        sku: `SKU-${faker.string.alphanumeric(8).toUpperCase()}`,
        stockQuantity: faker.number.int({ min: 0, max: 100 }),
        weight: faker.number.float({ min: 0.1, max: 50, fractionDigits: 1 }),
        attributes: [{ name: attrName, option }],
      };
    }),
  };
}

export async function seedProducts(writer, amount = 20, opts = {}) {
  const type = opts.type || 'mixed';
  const preset = opts.preset || null;
  log.banner(`Seeding ${amount} product(s) (type: ${type}${preset ? `, preset: ${preset.name}` : ''})`);

  const results = { created: 0, failed: 0, ids: [] };

  for (let i = 0; i < amount; i++) {
    try {
      const useVariable =
        type === 'variable' || (type === 'mixed' && faker.datatype.boolean(0.3));

      if (useVariable) {
        const product = generateVariableProduct(preset);
        const created = await writer.writeVariableProduct(product);
        results.ids.push(created.id);
        log.success(`${product.name} (variable, ${product.variations.length} variations) [id: ${created.id}]`);
      } else {
        const product = generateSimpleProduct(preset);
        const created = await writer.writeSimpleProduct(product);
        results.ids.push(created.id);
        log.success(`${product.name} @ $${product.price} [id: ${created.id}]`);
      }

      results.created++;
    } catch (err) {
      results.failed++;
      log.error(`Product ${i + 1}: ${err.message}`);
    }

    log.progress(i + 1, amount, 'products');
  }

  log.info(`\nDone: ${results.created} created, ${results.failed} failed`);
  return results;
}

/**
 * Apply validated, merchant-approved manifest products through an existing writer.
 * Research candidates are rejected before the writer receives any product.
 */
export async function seedProductManifest(writer, manifest) {
  const normalized = assertProductManifestApplyReady(manifest);
  log.banner(`Seeding ${normalized.products.length} merchant-approved manifest product(s)`);

  const results = { created: 0, failed: 0, ids: [] };

  for (let index = 0; index < normalized.products.length; index++) {
    const product = normalized.products[index];
    try {
      const created = await writer.writeSimpleProduct(product);
      results.created++;
      if (created?.id !== undefined) results.ids.push(created.id);
      log.success(`${product.name} @ ${normalized.currency} ${product.price}${created?.id !== undefined ? ` [id: ${created.id}]` : ''}`);
    } catch (error) {
      results.failed++;
      log.error(`Manifest product ${product.id}: ${error.message}`);
    }

    log.progress(index + 1, normalized.products.length, 'products');
  }

  log.info(`\nDone: ${results.created} created, ${results.failed} failed`);
  return results;
}
