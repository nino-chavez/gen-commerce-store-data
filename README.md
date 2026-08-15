# @signalx/gen-commerce-store-data

Multi-platform e-commerce test data seeder. Bulk-generates products, customers, orders, coupons, and content for **WooCommerce**, **BigCommerce**, and **Shopify** stores via their REST APIs. Includes store type presets (furniture, electronics, apparel) for vertical-specific test data.

> **Important:** Only run this against **staging/dev stores**. It creates real data that is difficult to undo in bulk. Never run against a production store.

---

## Prerequisites

- **Node.js 18+** — check with `node -v`
- **API credentials** for your target platform (see below)

### WooCommerce Credentials

1. Log into WordPress admin
2. Go to **WooCommerce > Settings > Advanced > REST API**
3. Click **Add key** — set Permissions to **Read/Write**
4. Copy the **Consumer key** (`ck_...`) and **Consumer secret** (`cs_...`)

### BigCommerce Credentials

1. Log into the BigCommerce admin
2. Go to **Settings > API > API Accounts**
3. Create a V2/V3 API account with appropriate scopes (Products, Customers, Orders modify)
4. Copy the **Store Hash** and **Access Token**

### Shopify Credentials

You have two options:

**Option A — Custom App (recommended for staging stores):**
1. In Shopify Admin, go to **Settings > Apps and sales channels > Develop apps**
2. Create an app with these Admin API scopes:
   - `write_products`, `read_products`
   - `write_customers`, `read_customers`
   - `write_orders`, `read_orders`
   - `write_content`, `read_content`
   - `write_price_rules`, `read_price_rules`
   - `write_discounts`, `read_discounts`
3. Install the app and copy the **Admin API access token** (`shpat_...`)

**Option B — OAuth via `seed auth`:**
Set `SHOPIFY_STORE_URL`, `SHOPIFY_CLIENT_ID`, and `SHOPIFY_CLIENT_SECRET` in `.env`, then run `node bin/seed auth`. A browser will open for authorization and the token will be written back to `.env`.

---

## Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Configure your store
cp .env.example .env
```

Edit `.env` with your platform and credentials:

```env
# Platform: wc, bc, or shopify
PLATFORM=wc

# WooCommerce
WC_URL=https://your-store.example.com
WC_CONSUMER_KEY=ck_your_key_here
WC_CONSUMER_SECRET=cs_your_secret_here

# BigCommerce
BC_STORE_HASH=your_store_hash
BC_ACCESS_TOKEN=your_access_token

# Shopify
SHOPIFY_STORE_URL=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_your_access_token
```

```bash
# 3. Test (seed a single product)
node bin/seed products 1

# 4. Seed with a store preset
node bin/seed products 50 --preset=furniture

# 5. Seed a BigCommerce store
node bin/seed products 50 --platform=bc --preset=furniture

# 6. Seed a Shopify store
node bin/seed products 50 --platform=shopify --preset=apparel
```

If you get `permission denied`:
```bash
chmod +x bin/seed
```

---

## Review a source-backed product manifest

A product manifest is a deterministic alternative to faker data. Previewing is the default: it validates the file and emits normalized JSON without loading store credentials or creating a platform client.

```bash
# Print a normalized preview to stdout. No credentials required.
node bin/seed products --manifest ./catalog-candidates.json

# Write the normalized preview to a file. No credentials required.
node bin/seed products --manifest ./catalog-candidates.json --output ./catalog-preview.json
```

Every product carries its retailer source, retrieval date, source facts, and one of two readiness values:

- `research-candidate` is review-only and can never be applied to a store.
- `merchant-approved` is eligible for an explicit `--apply` only when stock, weight, and dimensions are complete.

The manifest must use schema version `1.0`:

```json
{
  "schemaVersion": "1.0",
  "catalogId": "review-catalog",
  "currency": "USD",
  "retrievedAt": "2026-08-14",
  "products": [
    {
      "id": "source-backed-product",
      "name": "Source-backed Product",
      "brand": "Example Brand",
      "sku": "REVIEW-001",
      "price": "12.00",
      "description": "Merchant-facing product description.",
      "categories": ["Example Category"],
      "tags": ["review"],
      "readiness": "research-candidate",
      "source": {
        "retailer": "Example Retailer",
        "url": "https://example.com/products/source-backed-product",
        "retrievedAt": "2026-08-14",
        "price": "12.00",
        "facts": ["A fact supported by the linked product page."]
      },
      "metadata": {
        "role": "example-role"
      }
    }
  ]
}
```

Applying is deliberately separate and keeps the existing platform flags:

```bash
# Fails if any row remains a research candidate or lacks commerce fields.
node bin/seed products --manifest ./approved-catalog.json --apply \
  --platform=bc --store-hash=abc123 --access-token=xxx
```

`--output` cannot be combined with `--apply`. Current platform writers create these as simple physical products. Source and metadata fields remain in the neutral manifest but are not yet persisted by the platform adapters.

---

## Platform & Preset Flags

These global flags apply to all commands:

| Flag | Values | Default | Description |
|------|--------|---------|-------------|
| `--platform` / `-p` | `wc`, `bc`, `shopify` | `wc` | Target platform |
| `--preset` | `furniture`, `electronics`, `apparel`, `pets` | none | Store type preset for product generation |

```bash
# WooCommerce with furniture preset
node bin/seed products 50 --platform=wc --preset=furniture

# BigCommerce with electronics preset
node bin/seed products 30 --platform=bc --preset=electronics

# Shopify with apparel preset
node bin/seed products 30 --platform=shopify --preset=apparel
```

---

## Commands

### Seed everything at once

```bash
node bin/seed all
```

Creates 30 products, 15 customers, 10 coupons, 50 orders. On WooCommerce, also seeds shipping zones and tax rates. On Shopify, also seeds pages and blog posts. Customize:

```bash
node bin/seed all --products=100 --customers=50 --orders=200 --coupons=20
node bin/seed all --skip-shipping --skip-tax   # WC: data only, no config seeding
node bin/seed all --skip-content               # Shopify: skip pages + blog posts
node bin/seed all --platform=bc --preset=furniture
node bin/seed all --platform=shopify --preset=apparel
```

### Individual commands

```bash
# Products — simple, variable, or mixed
node bin/seed products 50
node bin/seed products 20 --type=variable
node bin/seed products 30 --type=simple --preset=apparel

# Products — validate/preview a deterministic manifest without credentials
node bin/seed products --manifest=./catalog-candidates.json
node bin/seed products --manifest=./catalog-candidates.json --output=./catalog-preview.json

# Products — pets preset tiered dry-run export (no credentials, no store writes)
node bin/seed products --preset=pets --dry-run --tier=medium --output=./pets-medium.json
node bin/seed products --preset=pets --dry-run --tier=enterprise --output=./pets-enterprise.json

# Customers — optionally scoped to a country
node bin/seed customers 25
node bin/seed customers 10 --country=CA

# Orders — requires products to exist first
node bin/seed orders 100
node bin/seed orders 50 --status=completed
node bin/seed orders 30 --date-start=2025-01-01 --date-end=2025-06-30

# Coupons
node bin/seed coupons 10
node bin/seed coupons 5 --discount-type=percent --min=10 --max=40

# Shipping zones — WooCommerce only
node bin/seed shipping
node bin/seed shipping --negative

# Tax rates — WooCommerce only
node bin/seed tax-rates
node bin/seed tax-rates --clean

# Content (pages + blog posts) — Shopify only
node bin/seed content --pages=5 --blog-posts=10

# Shopify OAuth bootstrap — writes SHOPIFY_ACCESS_TOKEN to .env
node bin/seed auth
```

### Override credentials inline

```bash
# WooCommerce
node bin/seed products 10 --url=https://store.example.com --key=ck_xxx --secret=cs_xxx

# BigCommerce
node bin/seed products 10 --platform=bc --store-hash=abc123 --access-token=xxx

# Shopify
node bin/seed products 10 --platform=shopify --store-url=my-store.myshopify.com --access-token=shpat_xxx
```

---

## Command Reference

| Command | Description | Platform | Key Options |
|---------|-------------|----------|-------------|
| `products [n]` | Faker products, a deterministic manifest preview/apply, or a `pets` tiered dry-run export | all | `--type`, `--manifest`, `--output`, `--apply`, `--dry-run`, `--tier`, `--seed` |
| `customers [n]` | Customers with billing/shipping addresses | all | `--country=US\|CA\|GB\|AU\|DE\|FR\|...` |
| `orders [n]` | Orders with 1-5 line items, weighted status distribution | all | `--status`, `--date-start`, `--date-end` |
| `coupons [n]` | Fixed-amount and percentage discount coupons | all | `--discount-type`, `--min`, `--max` |
| `shipping` | Seed shipping zones from fixtures | WC only | `--negative` for edge-case zones |
| `tax-rates` | Import tax rates from CSV fixture | WC only | `--clean` to wipe existing rates first |
| `content` | Seed pages + blog posts | Shopify only | `--pages`, `--blog-posts` |
| `auth` | OAuth flow → `SHOPIFY_ACCESS_TOKEN` written to `.env` | Shopify only | — |
| `all` | Run all commands in sequence | all | `--products=N`, `--customers=N`, `--orders=N`, `--coupons=N`, `--skip-shipping`, `--skip-tax`, `--skip-content` |

Default counts for `all`: 30 products, 15 customers, 10 coupons, 50 orders, 5 pages, 10 blog posts.

---

## Store Presets

Presets replace the default generic product data with vertical-specific categories, names, attributes, and price ranges.

### `furniture`

Categories: Living Room, Bedroom, Dining, Office, Outdoor, Kids
Attributes: Material (Oak, Walnut, Pine...), Color (Natural, Espresso...), Size (S/M/L/XL)
Price range: $50 - $3,000
Names: "Modern Hayes Coffee Table", "Scandinavian Reed Bookshelf"

### `electronics`

Categories: Phones, Laptops, Audio, Gaming, Smart Home, Accessories
Attributes: Storage (64GB-1TB), Color (Black, Silver, Space Grey...)
Price range: $5 - $3,000
Names: "Apex Headphones K7F", "Volta Smart Speaker R2X"

### `apparel`

Categories: Men, Women, Kids, Shoes, Accessories, Activewear
Attributes: Size (XS-XXL), Color (Black, Navy, Olive...)
Price range: $10 - $400
Names: "Relaxed-Fit Hoodie", "Tailored Oxford Shoes"

### `pets`

Three-level taxonomy: 6 species (Dogs, Cats, Birds, Reptiles, Small Pets,
Fish & Aquatics) x 5 departments (Food, Treats, Toys & Enrichment,
Health & Care, Gear & Habitat) x 3-5 subcategories each (107 leaf category
paths total, e.g. `Dogs > Food > Dry Food`).

36 invented brands (6 per species, split value/mid/premium). None collide
with real pet brands — checked in `test/pet-catalog.test.mjs` against a
denylist of ~30 real brands. Food products get Size x Flavor variants. Gear
& Habitat products get Size x Color variants. Everything else is a
single-variant simple product.

Works with the generic single-item path like the other presets
(`node bin/seed products 50 --preset=pets`). Also supports a **tiered bulk
dry-run export** — see below.

#### Tiered dry-run export (no store writes)

`pets` is the only preset with a deterministic bulk-corpus generator. It
seeds a "medium" demo catalog (~700 products) and an "enterprise" one
(~3,200 products, which *includes* the medium 700). Generation is seeded
(`faker.seed(...)`, default seed `630071`), so the same seed always produces
byte-identical output. No `Date.now()` or unseeded randomness appears
anywhere in the corpus.

```bash
# Preview only: prints a summary (counts, category coverage, brand
# distribution) to stdout. No file written, no store credentials needed.
node bin/seed products --preset=pets --dry-run --tier=medium

# Write the full corpus to a JSON file for review.
node bin/seed products --preset=pets --dry-run --tier=medium --output=./pets-medium.json
node bin/seed products --preset=pets --dry-run --tier=enterprise --output=./pets-enterprise.json

# Override the seed (rarely needed -- breaks the default determinism guarantee).
node bin/seed products --preset=pets --dry-run --tier=medium --seed=42 --output=./pets-medium-alt.json
```

`--tier` defaults to `enterprise` (the full corpus) when omitted. `medium`
is always the same ordered prefix of `enterprise`, so a medium-tier demo
store is a strict subset of the enterprise-tier one.

Every product carries honesty labels a downstream writer can map to platform
custom fields: tag `synthetic-demo`, plus `metadata: { provenance:
"synthetic", tier: "medium" | "enterprise" }`.

**This does not reuse the `--manifest` evidence-manifest schema above.** That
schema (`src/manifests/products.mjs`) requires a real, HTTPS-sourced
`source.url` and `facts` per product. It's built for curating real,
research-backed products, not a synthetic bulk corpus, and it silently drops
any field outside its whitelist — `variations`, `tier`, and `categoryPath`
included.

The `pets` dry-run export is a sibling module instead
(`src/generators/pet-catalog.mjs` + `src/manifests/pet-catalog-export.mjs`),
with its own JSON shape: `{ schemaVersion, preset, tier, seed, summary,
products }`. Each product carries `sku`, `name`, `brand`,
`brandPositioning`, `species`, `categoryPath` (3-element array), `categories`
(joined path string), `tags`, `tier`, and `metadata`. Simple products add
`price`/`stockQuantity`/`weight`/`dimensions`; Food and Gear & Habitat
products add `attributes`/`variations` instead.

---

## What Gets Created

### Products

Faker-generated products with:
- Vertical-specific names and descriptions (when using a preset) or generic faker data
- Category-aware pricing within realistic ranges
- Stock management with random quantities
- Weight and dimensions
- **Variable products** get 2-4 variations with attribute options

### Customers

- Realistic names, emails, usernames
- Full billing and shipping addresses
- Country-specific address formatting when `--country` is set
- On BigCommerce, addresses are created as a separate resource. On Shopify, addresses are inline on the customer create call.

### Orders

- 1-5 products per order (sampled from existing store products)
- Weighted status: 45% completed, 25% processing, 10% on-hold, 10% pending, 5% failed, 5% refunded
- 20% chance of extra fee line (WC)
- Custom date ranges for historical data

### Coupons

- Random codes like `SAVE25`, `PROMO15`, `VIPFXQM`
- Fixed-cart and percentage discounts
- Random usage limits, minimum/maximum amounts, expiry dates
- On Shopify, modeled as a `PriceRule` + `DiscountCode` pair

### Content (Shopify only)

- **Pages**: About Us, Shipping & Returns, Size Guide, Sustainability, etc. with generated body HTML
- **Blog posts**: lorem-ipsum articles attached to a "News" blog (created if missing)

### Shipping Zones (WC only)

Two fixture sets:

**Positive zones** (7 zones): mixed location types, wildcard postcodes, free shipping thresholds, multi-method zones, continent locations.

**Negative zones** (13 zones + Zone 0): carrier-only zones, formula costs, orphan postcodes, disabled methods, shipping class overrides, free shipping `requires` variants, empty zones.

### Tax Rates (WC only)

93 rates from CSV: US (16 states, city/county-level), Canada (PST/GST/HST/QST), international (GB, FR, DE, AU, JP, IN, MX, BR). Includes reduced-rate and zero-rate classes.

---

## Platform Differences

| Feature | WooCommerce | BigCommerce | Shopify |
|---------|-------------|-------------|---------|
| Products | `regular_price` on product | `price` on product | `variants[].price` inline |
| Variants | Separate POST per variation | Inline `variants[]` on create | Inline `variants[]` on create |
| Categories | Auto-created by name | Must pre-create, use numeric IDs | No real categories — uses `product_type` + `tags` |
| Customers | Inline billing/shipping | Separate `/customers/addresses` call | Inline `addresses[]` |
| Orders | v3 API with `line_items` | v2 API with `products[]` | v2024-10 with `line_items` (variant IDs) |
| Coupons | `discount_type` field | `type` field with different values | `PriceRule` + `DiscountCode` pair |
| Content (pages, blog) | — | — | `/pages.json`, `/blogs/{id}/articles.json` |
| Shipping/Tax | Supported via fixtures | Not supported (platform-managed) | Not supported (platform-managed) |
| Auth | Basic (consumer key/secret) | Static access token | Static access token, or OAuth via `seed auth` |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `permission denied: bin/seed` | Run `chmod +x bin/seed` |
| `Missing required WooCommerce config` | Create `.env` or pass `--url`, `--key`, `--secret` |
| `Missing required BigCommerce config` | Create `.env` or pass `--store-hash`, `--access-token` |
| `Missing required Shopify config` | Create `.env` or pass `--store-url`, `--access-token`, or run `seed auth` |
| `401 Unauthorized` | Check credentials. WC needs Read/Write permissions. |
| `No products found` | Run `products` before `orders` |
| `Shipping/tax only supported for WooCommerce` | These commands don't apply to BC/Shopify |
| `Content seeding only supported for Shopify` | Pages + blog posts is a Shopify-only feature |
| Rate limit errors (429) | Auto-retries with backoff. If persistent, wait and retry. |

---

## Architecture

```
src/
├── cli.mjs                      # Commander CLI — subcommands + global flags
├── config.mjs                   # .env + CLI flag config (WC + BC + Shopify)
├── auth.mjs                     # Shopify OAuth flow (for `seed auth`)
├── logger.mjs                   # Colored console output + progress bars
├── clients/
│   ├── wc-client.mjs            # WooCommerce REST API client
│   ├── bc-client.mjs            # BigCommerce REST API client (v3 + v2)
│   └── shopify-client.mjs       # Shopify Admin REST API client
├── writers/
│   ├── wc-writer.mjs            # Neutral shape → WooCommerce payload
│   ├── bc-writer.mjs            # Neutral shape → BigCommerce payload
│   └── shopify-writer.mjs       # Neutral shape → Shopify payload
├── generators/
│   ├── products.mjs             # Product generation (faker + preset support)
│   ├── pet-catalog.mjs          # Deterministic tiered pets corpus (dry-run only)
│   ├── customers.mjs            # Customer generation (faker)
│   ├── orders.mjs               # Order generation (faker + existing store data)
│   ├── coupons.mjs              # Coupon generation (faker)
│   ├── shipping.mjs             # Shipping zone seeder (WC fixtures)
│   ├── tax-rates.mjs            # Tax rate importer (WC CSV fixture)
│   └── content.mjs              # Pages + blog posts seeder (Shopify)
├── presets/
│   ├── index.mjs                # Preset loader
│   ├── furniture.mjs            # Furniture vertical
│   ├── electronics.mjs          # Electronics vertical
│   ├── apparel.mjs              # Apparel vertical
│   ├── pets.mjs                 # Pets vertical (generic path + dry-run export)
│   └── pets-data.mjs            # Pets taxonomy, brands, pricing (shared data)
├── manifests/
│   ├── products.mjs             # Evidence-manifest schema (source-backed products)
│   └── pet-catalog-export.mjs   # Tiered dry-run export (filter/summarize/serialize)
└── fixtures/
    ├── shipping-zones.json
    ├── shipping-zones-negative.json
    └── tax-rates.csv
```

Generators produce platform-neutral objects. Writers translate those objects into platform-specific API payloads and POST them. This keeps the data generation logic separate from the API integration so adding new platforms is a matter of writing one client + one writer.
