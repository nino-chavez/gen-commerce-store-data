import assert from 'node:assert/strict';
import test from 'node:test';

import { BCWriter } from '../src/writers/bc-writer.mjs';
import { generatePetCatalog } from '../src/generators/pet-catalog.mjs';

// Payload shapes here are pinned against bigcommerce/api-specs
// reference/catalog/products_catalog.v3.yml (read directly, not recalled):
// ProductChannelAssignment { product_id, channel_id }, ProductCategoryAssignment
// { product_id, category_id }, custom_fields as [{ name, value }].

function mockClient() {
  const calls = [];
  return {
    calls,
    async post(endpoint, body) {
      calls.push({ method: 'post', endpoint, body });
      return { id: 999, sku: body.sku };
    },
    async put(endpoint, body) {
      calls.push({ method: 'put', endpoint, body });
      return undefined;
    },
  };
}

test('createPetProduct: simple product (Treats/Toys/Health) maps to a flat BC payload with no categories field', async () => {
  const corpus = generatePetCatalog({ enterpriseCount: 50, mediumCount: 20 });
  const simple = corpus.find((p) => !p.variations);
  const client = mockClient();
  const writer = new BCWriter(client);

  await writer.createPetProduct(simple);

  assert.equal(client.calls.length, 1);
  const { endpoint, body } = client.calls[0];
  assert.equal(endpoint, 'catalog/products');
  assert.equal(body.sku, simple.sku);
  assert.equal(body.type, 'physical');
  assert.equal(body.is_visible, true);
  assert.deepEqual(body.tags, simple.tags);
  assert.deepEqual(body.custom_fields, [
    { name: 'provenance', value: 'synthetic' },
    { name: 'tier', value: simple.tier },
    { name: 'species', value: simple.species },
  ]);
  assert.equal(body.price, parseFloat(simple.price));
  assert.equal(body.inventory_tracking, 'product');
  assert.equal('categories' in body, false, 'category assignment is explicit, not on the create payload');
  assert.equal('variants' in body, false);
});

test('createPetProduct: variable product (Food/Gear) maps variations to BC inline variants[]', async () => {
  const corpus = generatePetCatalog({ enterpriseCount: 50, mediumCount: 20 });
  const variable = corpus.find((p) => Array.isArray(p.variations) && p.variations.length > 0);
  const client = mockClient();
  const writer = new BCWriter(client);

  await writer.createPetProduct(variable);

  const { body } = client.calls[0];
  assert.equal(body.price, parseFloat(variable.variations[0].price));
  assert.equal(body.variants.length, variable.variations.length);
  for (const [i, variant] of body.variants.entries()) {
    const source = variable.variations[i];
    assert.equal(variant.sku, source.sku);
    assert.equal(variant.price, parseFloat(source.price));
    assert.equal(variant.inventory_level, source.stockQuantity);
    assert.deepEqual(variant.option_values, source.attributes.map((a) => ({
      option_display_name: a.name,
      label: a.option,
    })));
  }
  assert.equal('price' in body && 'depth' in body, false, 'simple-product-only fields must not leak onto a variable product');
});

test('assignChannels: bulk PUT with product_id/channel_id keys', async () => {
  const client = mockClient();
  const writer = new BCWriter(client);

  await writer.assignChannels([
    { productId: 101, channelId: 1890403 },
    { productId: 101, channelId: 1857860 },
    { productId: 102, channelId: 1890403 },
  ]);

  assert.equal(client.calls.length, 1);
  const { method, endpoint, body } = client.calls[0];
  assert.equal(method, 'put');
  assert.equal(endpoint, 'catalog/products/channel-assignments');
  assert.deepEqual(body, [
    { product_id: 101, channel_id: 1890403 },
    { product_id: 101, channel_id: 1857860 },
    { product_id: 102, channel_id: 1890403 },
  ]);
});

test('assignCategories: bulk PUT with product_id/category_id keys', async () => {
  const client = mockClient();
  const writer = new BCWriter(client);

  await writer.assignCategories([{ productId: 101, categoryId: 555 }]);

  const { method, endpoint, body } = client.calls[0];
  assert.equal(method, 'put');
  assert.equal(endpoint, 'catalog/products/category-assignments');
  assert.deepEqual(body, [{ product_id: 101, category_id: 555 }]);
});

test('attachProductImageUrl: JSON POST with image_url, no multipart', async () => {
  const client = mockClient();
  const writer = new BCWriter(client);

  await writer.attachProductImageUrl(101, 'https://cdn.example.com/brand.png', { description: 'Brand packshot' });

  const { endpoint, body } = client.calls[0];
  assert.equal(endpoint, 'catalog/products/101/images');
  assert.equal(body.image_url, 'https://cdn.example.com/brand.png');
  assert.equal(body.is_thumbnail, true);
  assert.equal(body.description, 'Brand packshot');
});

test('fetchSkuIndex: builds a Map(sku -> id) from a paginated getAll', async () => {
  const client = {
    async getAll(endpoint, params) {
      assert.equal(endpoint, 'catalog/products');
      assert.equal(params.include_fields, 'sku');
      return [{ id: 1, sku: 'PET-DOG-FOD-00001' }, { id: 2, sku: 'PET-CAT-TOY-00002' }, { id: 3 }];
    },
  };
  const writer = new BCWriter(client);
  const index = await writer.fetchSkuIndex();

  assert.equal(index.size, 2);
  assert.equal(index.get('PET-DOG-FOD-00001'), 1);
  assert.equal(index.get('PET-CAT-TOY-00002'), 2);
});
