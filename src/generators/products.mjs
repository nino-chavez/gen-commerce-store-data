import { faker } from '@faker-js/faker';
import { createLogger } from '../logger.mjs';

const log = createLogger('products');

const CATEGORIES = [
  'Clothing', 'Electronics', 'Home & Garden', 'Sports', 'Books',
  'Toys', 'Health & Beauty', 'Food & Drink', 'Automotive', 'Pet Supplies',
];

const ATTRIBUTES = {
  Color: ['Red', 'Blue', 'Green', 'Black', 'White', 'Navy', 'Grey'],
  Size: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  Material: ['Cotton', 'Polyester', 'Leather', 'Denim', 'Silk', 'Wool'],
};

function generateSimpleProduct() {
  const price = faker.commerce.price({ min: 5, max: 500, dec: 2 });
  const onSale = faker.datatype.boolean(0.3);

  return {
    name: faker.commerce.productName(),
    type: 'simple',
    regular_price: price,
    sale_price: onSale ? faker.commerce.price({ min: 1, max: parseFloat(price) * 0.8, dec: 2 }) : '',
    description: faker.commerce.productDescription(),
    short_description: faker.lorem.sentence(),
    sku: `SKU-${faker.string.alphanumeric(8).toUpperCase()}`,
    manage_stock: true,
    stock_quantity: faker.number.int({ min: 0, max: 200 }),
    weight: String(faker.number.float({ min: 0.1, max: 50, fractionDigits: 1 })),
    dimensions: {
      length: String(faker.number.int({ min: 1, max: 100 })),
      width: String(faker.number.int({ min: 1, max: 100 })),
      height: String(faker.number.int({ min: 1, max: 50 })),
    },
    categories: [{ name: faker.helpers.arrayElement(CATEGORIES) }],
    tags: faker.helpers.arrayElements(
      ['Sale', 'New', 'Featured', 'Clearance', 'Popular', 'Limited'],
      { min: 0, max: 3 },
    ).map((name) => ({ name })),
  };
}

function generateVariableProduct() {
  const attrName = faker.helpers.arrayElement(Object.keys(ATTRIBUTES));
  const attrOptions = faker.helpers.arrayElements(ATTRIBUTES[attrName], { min: 2, max: 4 });
  const basePrice = faker.number.float({ min: 10, max: 300, fractionDigits: 2 });

  return {
    product: {
      name: faker.commerce.productName(),
      type: 'variable',
      description: faker.commerce.productDescription(),
      short_description: faker.lorem.sentence(),
      sku: `SKU-${faker.string.alphanumeric(8).toUpperCase()}`,
      categories: [{ name: faker.helpers.arrayElement(CATEGORIES) }],
      attributes: [
        {
          name: attrName,
          visible: true,
          variation: true,
          options: attrOptions,
        },
      ],
    },
    variations: attrOptions.map((option) => {
      const modifier = faker.number.float({ min: -10, max: 20, fractionDigits: 2 });
      const price = Math.max(1, basePrice + modifier).toFixed(2);

      return {
        regular_price: price,
        sku: `SKU-${faker.string.alphanumeric(8).toUpperCase()}`,
        manage_stock: true,
        stock_quantity: faker.number.int({ min: 0, max: 100 }),
        weight: String(faker.number.float({ min: 0.1, max: 50, fractionDigits: 1 })),
        attributes: [{ name: attrName, option }],
      };
    }),
  };
}

export async function seedProducts(client, amount = 20, opts = {}) {
  const type = opts.type || 'mixed'; // simple, variable, mixed
  log.banner(`Seeding ${amount} product(s) (type: ${type})`);

  const results = { created: 0, failed: 0, ids: [] };

  for (let i = 0; i < amount; i++) {
    try {
      const useVariable =
        type === 'variable' || (type === 'mixed' && faker.datatype.boolean(0.3));

      if (useVariable) {
        const { product, variations } = generateVariableProduct();
        const created = await client.post('products', product);

        for (const variation of variations) {
          await client.post(`products/${created.id}/variations`, variation);
        }

        results.ids.push(created.id);
        log.success(`${created.name} (variable, ${variations.length} variations) [id: ${created.id}]`);
      } else {
        const product = generateSimpleProduct();
        const created = await client.post('products', product);
        results.ids.push(created.id);
        log.success(`${created.name} @ $${created.regular_price} [id: ${created.id}]`);
      }

      results.created++;
    } catch (err) {
      results.failed++;
      log.error(`Product ${i + 1}: ${err.message}`);
    }

    log.progress(i + 1, amount, `products`);
  }

  log.info(`\nDone: ${results.created} created, ${results.failed} failed`);
  return results;
}
