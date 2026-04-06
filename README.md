# @signalx/seed-toolkit

Multi-platform e-commerce test data seeder. Bulk-generates products, customers, orders, and coupons for **WooCommerce** and **BigCommerce** stores via their REST APIs. Includes store type presets (furniture, electronics, apparel) for vertical-specific test data.

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
# Platform: wc or bc
PLATFORM=wc

# WooCommerce
WC_URL=https://your-store.example.com
WC_CONSUMER_KEY=ck_your_key_here
WC_CONSUMER_SECRET=cs_your_secret_here

# BigCommerce
BC_STORE_HASH=your_store_hash
BC_ACCESS_TOKEN=your_access_token
```

```bash
# 3. Test (seed a single product)
node bin/seed products 1

# 4. Seed with a store preset
node bin/seed products 50 --preset=furniture

# 5. Seed a BigCommerce store
node bin/seed products 50 --platform=bc --preset=furniture
```

If you get `permission denied`:
```bash
chmod +x bin/seed
```

---

## Platform & Preset Flags

These global flags apply to all commands:

| Flag | Values | Default | Description |
|------|--------|---------|-------------|
| `--platform` / `-p` | `wc`, `bc` | `wc` | Target platform |
| `--preset` | `furniture`, `electronics`, `apparel` | none | Store type preset for product generation |

```bash
# WooCommerce with furniture preset
node bin/seed products 50 --platform=wc --preset=furniture

# BigCommerce with electronics preset
node bin/seed products 30 --platform=bc --preset=electronics
```

---

## Commands

### Seed everything at once

```bash
node bin/seed all
```

Creates 30 products, 15 customers, 10 coupons, 50 orders. On WooCommerce, also seeds shipping zones and tax rates. Customize:

```bash
node bin/seed all --products=100 --customers=50 --orders=200 --coupons=20
node bin/seed all --skip-shipping --skip-tax   # data only, no config seeding
node bin/seed all --platform=bc --preset=furniture
```

### Individual commands

```bash
# Products — simple, variable, or mixed
node bin/seed products 50
node bin/seed products 20 --type=variable
node bin/seed products 30 --type=simple --preset=apparel

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
```

### Override credentials inline

```bash
# WooCommerce
node bin/seed products 10 --url=https://store.example.com --key=ck_xxx --secret=cs_xxx

# BigCommerce
node bin/seed products 10 --platform=bc --store-hash=abc123 --access-token=xxx
```

---

## Command Reference

| Command | Description | Key Options |
|---------|-------------|-------------|
| `products [n]` | Simple + variable products with realistic names, SKUs, pricing, stock | `--type=simple\|variable\|mixed` |
| `customers [n]` | Customers with billing/shipping addresses | `--country=US\|CA\|GB\|AU\|DE\|FR\|...` |
| `orders [n]` | Orders with 1-5 line items, weighted status distribution | `--status`, `--date-start`, `--date-end` |
| `coupons [n]` | Fixed-amount and percentage discount coupons | `--discount-type`, `--min`, `--max` |
| `shipping` | Seed shipping zones from fixtures (WC only) | `--negative` for edge-case zones |
| `tax-rates` | Import tax rates from CSV fixture (WC only) | `--clean` to wipe existing rates first |
| `all` | Run all commands in sequence | `--products=N`, `--customers=N`, `--orders=N`, `--coupons=N`, `--skip-shipping`, `--skip-tax` |

Default counts for `all`: 30 products, 15 customers, 10 coupons, 50 orders.

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
- On BigCommerce, addresses are created as a separate resource

### Orders

- 1-5 products per order (sampled from existing store products)
- Weighted status: 45% completed, 25% processing, 10% on-hold, 10% pending, 5% failed, 5% refunded
- 20% chance of extra fee line
- Custom date ranges for historical data

### Coupons

- Random codes like `SAVE25`, `PROMO15`, `VIPFXQM`
- Fixed-cart and percentage discounts
- Random usage limits, minimum/maximum amounts, expiry dates

### Shipping Zones (WC only)

Two fixture sets:

**Positive zones** (7 zones): mixed location types, wildcard postcodes, free shipping thresholds, multi-method zones, continent locations.

**Negative zones** (13 zones + Zone 0): carrier-only zones, formula costs, orphan postcodes, disabled methods, shipping class overrides, free shipping `requires` variants, empty zones.

### Tax Rates (WC only)

93 rates from CSV: US (16 states, city/county-level), Canada (PST/GST/HST/QST), international (GB, FR, DE, AU, JP, IN, MX, BR). Includes reduced-rate and zero-rate classes.

---

## Platform Differences

| Feature | WooCommerce | BigCommerce |
|---------|------------|-------------|
| Products | `regular_price` on product | `price` on product |
| Variants | Separate POST per variation | Inline `variants[]` on create |
| Categories | Auto-created by name | Must pre-create, use numeric IDs |
| Customers | Inline billing/shipping | Separate `/customers/addresses` call |
| Orders | v3 API with `line_items` | v2 API with `products[]` |
| Coupons | `discount_type` field | `type` field with different values |
| Shipping/Tax | Supported via fixtures | Not supported (platform-managed) |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `permission denied: bin/seed` | Run `chmod +x bin/seed` |
| `Missing required WooCommerce config` | Create `.env` or pass `--url`, `--key`, `--secret` |
| `Missing required BigCommerce config` | Create `.env` or pass `--store-hash`, `--access-token` |
| `401 Unauthorized` | Check credentials. WC needs Read/Write permissions. |
| `No products found` | Run `products` before `orders` |
| `Shipping/tax only supported for WooCommerce` | These commands don't apply to BigCommerce |
| Rate limit errors (429) | Auto-retries with backoff. If persistent, wait and retry. |

---

## Architecture

```
src/
├── cli.mjs                  # Commander CLI — subcommands + global flags
├── config.mjs               # .env + CLI flag config (WC + BC)
├── logger.mjs               # Colored console output + progress bars
├── clients/
│   ├── wc-client.mjs        # WooCommerce REST API client (retry + rate limiting)
│   └── bc-client.mjs        # BigCommerce REST API client (v3 + v2, retry + rate limiting)
├── writers/
│   ├── wc-writer.mjs        # Neutral shape → WooCommerce payload
│   └── bc-writer.mjs        # Neutral shape → BigCommerce payload
├── generators/
│   ├── products.mjs         # Product generation (faker + preset support)
│   ├── customers.mjs        # Customer generation (faker)
│   ├── orders.mjs           # Order generation (faker + existing store data)
│   ├── coupons.mjs          # Coupon generation (faker)
│   ├── shipping.mjs         # Shipping zone seeder (WC fixtures)
│   └── tax-rates.mjs        # Tax rate importer (WC CSV fixture)
├── presets/
│   ├── index.mjs            # Preset loader
│   ├── furniture.mjs        # Furniture vertical (Haven)
│   ├── electronics.mjs      # Electronics vertical
│   └── apparel.mjs          # Apparel vertical
└── fixtures/
    ├── shipping-zones.json
    ├── shipping-zones-negative.json
    └── tax-rates.csv
```

Generators produce platform-neutral objects. Writers translate those objects into platform-specific API payloads and POST them. This keeps the data generation logic separate from the API integration.
