import { readFile, writeFile } from 'node:fs/promises';

const SCHEMA_VERSION = '1.0';
const READINESS_VALUES = new Set(['research-candidate', 'merchant-approved']);
const DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function fail(path, message) {
  throw new Error(`${path}: ${message}`);
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requirePlainObject(value, path) {
  if (!isPlainObject(value)) fail(path, 'must be a plain object');
  return value;
}

function requireNonEmptyString(value, path) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(path, 'must be a non-empty string');
  }
  return value.trim();
}

function requireStringArray(value, path, { nonEmpty = false } = {}) {
  if (!Array.isArray(value) || (nonEmpty && value.length === 0)) {
    fail(path, `must be ${nonEmpty ? 'a non-empty' : 'an'} array of strings`);
  }

  return value.map((item, index) => requireNonEmptyString(item, `${path}[${index}]`));
}

function requireDate(value, path) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    fail(path, 'must be a valid date in YYYY-MM-DD format');
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    fail(path, 'must be a valid date in YYYY-MM-DD format');
  }
  return value;
}

function requireHttpsUrl(value, path) {
  const url = requireNonEmptyString(value, path);
  try {
    if (new URL(url).protocol !== 'https:') fail(path, 'must use HTTPS');
  } catch (error) {
    if (error.message.startsWith(`${path}:`)) throw error;
    fail(path, 'must be a valid HTTPS URL');
  }
  return url;
}

function requireDecimal(value, path) {
  const numericValue = typeof value === 'string' ? Number(value) : Number.NaN;
  if (
    typeof value !== 'string'
    || !DECIMAL_PATTERN.test(value)
    || !Number.isFinite(numericValue)
    || numericValue <= 0
  ) {
    fail(path, 'must be a decimal string greater than zero');
  }
  return value;
}

function canonicalDecimal(value) {
  const [integer, fraction = ''] = value.split('.');
  const normalizedFraction = fraction.replace(/0+$/, '');
  return normalizedFraction ? `${integer}.${normalizedFraction}` : integer;
}

function requireStockQuantity(value, path) {
  if (!Number.isInteger(value) || value < 0) fail(path, 'must be an integer greater than or equal to zero');
  return value;
}

function requirePositiveNumber(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    fail(path, 'must be a finite number greater than zero');
  }
  return value;
}

function normalizeDimensions(value, path) {
  requirePlainObject(value, path);
  return {
    length: requirePositiveNumber(value.length, `${path}.length`),
    width: requirePositiveNumber(value.width, `${path}.width`),
    height: requirePositiveNumber(value.height, `${path}.height`),
  };
}

function normalizeSource(source, product, path) {
  requirePlainObject(source, path);
  const price = requireDecimal(source.price, `${path}.price`);
  if (canonicalDecimal(price) !== canonicalDecimal(product.price)) {
    fail(`${path}.price`, `must equal ${path.replace(/\.source$/, '')}.price`);
  }

  return {
    retailer: requireNonEmptyString(source.retailer, `${path}.retailer`),
    url: requireHttpsUrl(source.url, `${path}.url`),
    retrievedAt: requireDate(source.retrievedAt, `${path}.retrievedAt`),
    price,
    facts: requireStringArray(source.facts, `${path}.facts`, { nonEmpty: true }),
  };
}

function normalizeProduct(product, index) {
  const path = `products[${index}]`;
  requirePlainObject(product, path);

  const readiness = requireNonEmptyString(product.readiness, `${path}.readiness`);
  if (!READINESS_VALUES.has(readiness)) {
    fail(`${path}.readiness`, `must be one of: ${[...READINESS_VALUES].join(', ')}`);
  }

  const normalized = {
    id: requireNonEmptyString(product.id, `${path}.id`),
    name: requireNonEmptyString(product.name, `${path}.name`),
    brand: requireNonEmptyString(product.brand, `${path}.brand`),
    sku: requireNonEmptyString(product.sku, `${path}.sku`),
    price: requireDecimal(product.price, `${path}.price`),
    description: requireNonEmptyString(product.description, `${path}.description`),
    categories: requireStringArray(product.categories, `${path}.categories`, { nonEmpty: true }),
    tags: requireStringArray(product.tags, `${path}.tags`),
    readiness,
  };

  normalized.source = normalizeSource(product.source, normalized, `${path}.source`);
  normalized.metadata = requirePlainObject(product.metadata, `${path}.metadata`);

  if (product.stockQuantity !== undefined || readiness === 'merchant-approved') {
    normalized.stockQuantity = requireStockQuantity(product.stockQuantity, `${path}.stockQuantity`);
  }
  if (product.weight !== undefined || readiness === 'merchant-approved') {
    normalized.weight = requirePositiveNumber(product.weight, `${path}.weight`);
  }
  if (product.dimensions !== undefined || readiness === 'merchant-approved') {
    normalized.dimensions = normalizeDimensions(product.dimensions, `${path}.dimensions`);
  }

  return normalized;
}

function assertUnique(products, key, label) {
  const seen = new Map();
  for (let index = 0; index < products.length; index++) {
    const value = key === 'source.url' ? products[index].source.url : products[index][key];
    if (seen.has(value)) {
      fail(`products[${index}].${key}`, `${label} duplicates products[${seen.get(value)}].${key}`);
    }
    seen.set(value, index);
  }
}

export function validateProductManifest(value) {
  requirePlainObject(value, 'manifest');
  if (value.schemaVersion !== SCHEMA_VERSION) {
    fail('schemaVersion', `must be "${SCHEMA_VERSION}"`);
  }
  if (!Array.isArray(value.products) || value.products.length === 0) {
    fail('products', 'must be a non-empty array');
  }

  const products = value.products.map(normalizeProduct);
  assertUnique(products, 'id', 'product ID');
  assertUnique(products, 'sku', 'SKU');
  assertUnique(products, 'source.url', 'source URL');

  return {
    schemaVersion: SCHEMA_VERSION,
    catalogId: requireNonEmptyString(value.catalogId, 'catalogId'),
    currency: typeof value.currency === 'string' && /^[A-Z]{3}$/.test(value.currency)
      ? value.currency
      : fail('currency', 'must be three uppercase letters'),
    retrievedAt: requireDate(value.retrievedAt, 'retrievedAt'),
    products,
  };
}

export async function loadProductManifest(path) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') fail('manifest', `file not found: ${path}`);
    if (error instanceof SyntaxError) fail('manifest', `invalid JSON in ${path}: ${error.message}`);
    throw error;
  }
  return validateProductManifest(parsed);
}

export function serializeProductManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export async function writeProductManifest(path, manifest) {
  await writeFile(path, serializeProductManifest(manifest), 'utf8');
}

export function assertProductManifestApplyReady(manifest) {
  const normalized = validateProductManifest(manifest);
  const candidate = normalized.products.find((product) => product.readiness !== 'merchant-approved');
  if (candidate) {
    fail(
      `products[${normalized.products.indexOf(candidate)}].readiness`,
      `cannot apply research candidate "${candidate.id}"; merchant approval is required`,
    );
  }

  return normalized;
}
