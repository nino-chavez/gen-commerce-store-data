# wc-seed-toolkit

WooCommerce test data seeder for the DMS team. Bulk-generates products, customers, orders, coupons, shipping zones, and tax rates into any WooCommerce store via the REST API.

> **Important:** Only run this against **staging/dev stores**. It creates real data that is difficult to undo in bulk. Never run against a production store.

---

## Prerequisites

- **Node.js 18+** — check with `node -v`. Install from https://nodejs.org if needed.
- **WooCommerce REST API credentials** — a consumer key and secret from the target store (see below).

### Getting WooCommerce API Credentials

You need a key/secret pair from the WooCommerce store you want to seed:

1. Log into the WordPress admin for the target store
2. Go to **WooCommerce > Settings > Advanced > REST API**
3. Click **Add key**
4. Set:
   - **Description:** `wc-seed-toolkit`
   - **User:** your admin user
   - **Permissions:** `Read/Write`
5. Click **Generate API key**
6. Copy the **Consumer key** (`ck_...`) and **Consumer secret** (`cs_...`) — the secret is only shown once

---

## Quickstart

```bash
# 1. Clone or copy the tool
cd tools/wc-seed-toolkit

# 2. Install dependencies
npm install

# 3. Configure your store
cp .env.example .env
```

Edit `.env` with your store URL and credentials:

```env
WC_URL=https://your-store.example.com
WC_CONSUMER_KEY=ck_your_key_here
WC_CONSUMER_SECRET=cs_your_secret_here
```

```bash
# 4. Test that it connects (seed a single product)
node bin/wc-seed products 1

# 5. Seed everything with defaults
node bin/wc-seed all
```

If you get `permission denied` on the first run:
```bash
chmod +x bin/wc-seed
```

---

## Commands

### Seed everything at once

```bash
node bin/wc-seed all
```

Creates 30 products, 15 customers, 10 coupons, 50 orders, shipping zones (positive + negative), and tax rates. Customize counts:

```bash
node bin/wc-seed all --products=100 --customers=50 --orders=200 --coupons=20
node bin/wc-seed all --skip-shipping --skip-tax   # data only, no config seeding
```

### Individual commands

```bash
# Products — simple, variable, or mixed
node bin/wc-seed products 50
node bin/wc-seed products 20 --type=variable
node bin/wc-seed products 30 --type=simple

# Customers — optionally scoped to a country
node bin/wc-seed customers 25
node bin/wc-seed customers 10 --country=CA

# Orders — requires products to exist first
node bin/wc-seed orders 100
node bin/wc-seed orders 50 --status=completed
node bin/wc-seed orders 30 --date-start=2025-01-01 --date-end=2025-06-30

# Coupons
node bin/wc-seed coupons 10
node bin/wc-seed coupons 5 --discount-type=percent --min=10 --max=40

# Shipping zones — positive test scenarios
node bin/wc-seed shipping

# Shipping zones — negative/edge-case scenarios for migration testing
node bin/wc-seed shipping --negative

# Tax rates — imports 93 rates from the built-in CSV fixture
node bin/wc-seed tax-rates
node bin/wc-seed tax-rates --clean   # delete existing rates first
```

### Override credentials inline

If you don't want to use a `.env` file:

```bash
node bin/wc-seed products 10 \
  --url=https://store.example.com \
  --key=ck_xxx \
  --secret=cs_xxx
```

---

## Command Reference

| Command | Description | Key Options |
|---------|-------------|-------------|
| `products [n]` | Simple + variable products with realistic names, SKUs, pricing, stock, dimensions | `--type=simple\|variable\|mixed` |
| `customers [n]` | Customers with billing/shipping addresses | `--country=US\|CA\|GB\|AU\|DE\|FR\|...` |
| `orders [n]` | Orders with 1-5 line items, weighted status distribution, optional fees | `--status`, `--date-start`, `--date-end` |
| `coupons [n]` | Fixed-amount and percentage discount coupons | `--discount-type`, `--min`, `--max` |
| `shipping` | Seed shipping zones from built-in fixture data | `--negative` for edge-case zones |
| `tax-rates` | Import tax rates from built-in CSV | `--clean` to wipe existing rates first |
| `all` | Run all of the above in sequence | `--products=N`, `--customers=N`, `--orders=N`, `--coupons=N`, `--skip-shipping`, `--skip-tax` |

Default counts for `all`: 30 products, 15 customers, 10 coupons, 50 orders.

---

## What Gets Created

### Products

Faker-generated products with:
- Realistic product names, descriptions, SKUs
- Random pricing ($5-$500), 30% chance of sale price
- Stock management with random quantities
- Weight and dimensions
- Auto-created categories (Clothing, Electronics, Home & Garden, etc.)
- **Variable products** get 2-4 variations with attribute options (Color, Size, Material)

### Customers

Faker-generated customer profiles with:
- Realistic names, emails, usernames
- Full billing and shipping addresses
- 30% chance of company name
- Country-specific address formatting when `--country` is set

### Orders

Randomly assembled from existing store data:
- 1-5 products per order (sampled from existing products)
- Weighted status distribution: 45% completed, 25% processing, 10% on-hold, 10% pending, 5% failed, 5% refunded
- 20% chance of an extra fee line (handling, gift wrap, rush processing)
- Supports custom date ranges for historical order data

### Coupons

- Random codes like `SAVE25`, `PROMO15`, `VIPFXQM`
- Mix of fixed-cart and percentage discounts
- Random usage limits, per-user limits, minimum/maximum amounts, expiry dates
- 15% chance of free shipping flag

### Shipping Zones

Two fixture sets ported from the `dms-self-serve` shipping seed scripts:

**Positive zones** (7 zones) — standard migration scenarios:
- Mixed location types (country + state + postcode in one zone)
- Wildcard postcodes
- Free shipping thresholds
- Multi-method zones (flat rate + free shipping + local pickup)
- Continent-type locations (EU)

**Negative zones** (13 zones + Zone 0) — edge cases for migration testing:
- Carrier-only zones (USPS, FedEx, UPS, DHL, etc.) that should be skipped
- Formula-based costs (`[qty] * 2`, `[fee percent="10"]`, `[cost]`)
- Orphan postcodes with no country context
- All-disabled method zones
- Shipping class cost overrides
- Free shipping `requires` variants (coupon, both, either, min_amount)
- Empty zones (no methods)
- Kitchen-sink zones combining multiple skip reasons
- Zone 0 "Rest of the World" catch-all

### Tax Rates

93 tax rates from the built-in CSV covering:
- **US:** 16 states with state + city + county-level rates, postcode ranges, compound taxes
- **Canada:** Province-level PST/GST/HST/QST combinations
- **International:** GB (VAT), FR (TVA), DE (MwSt), AU (GST), JP, IN (CGST/SGST/IGST), MX (IVA), BR (ICMS)
- Includes reduced-rate and zero-rate tax classes

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `permission denied: bin/wc-seed` | Run `chmod +x bin/wc-seed` |
| `Missing required config: WC_URL` | Create a `.env` file (see Quickstart) or pass `--url`, `--key`, `--secret` |
| `401 Unauthorized` | Check your consumer key/secret. Make sure permissions are set to Read/Write. |
| `No products found. Seed products first` | The `orders` command needs existing products. Run `products` before `orders`. |
| `timeout` / `ECONNREFUSED` | Check the store URL is correct and accessible from your machine |
| Rate limit errors (429) | The tool auto-retries with backoff. If persistent, wait a minute and try again. |

---

## Architecture

```
src/
├── cli.mjs              # Commander CLI — all subcommands
├── config.mjs           # .env + CLI flag config loading
├── wc-client.mjs        # WooCommerce REST API client (retry + rate limiting)
├── logger.mjs           # Colored console output + progress bars
├── generators/
│   ├── products.mjs     # Product generation (faker)
│   ├── customers.mjs    # Customer generation (faker)
│   ├── orders.mjs       # Order generation (faker + existing store data)
│   ├── coupons.mjs      # Coupon generation (faker)
│   ├── shipping.mjs     # Shipping zone seeder (fixture-driven)
│   └── tax-rates.mjs    # Tax rate importer (CSV fixture)
└── fixtures/
    ├── shipping-zones.json           # 7 positive test zones
    ├── shipping-zones-negative.json  # 13 edge-case zones + Zone 0
    └── tax-rates.csv                 # 93 tax rates (US/CA/GB/FR/DE/AU/JP/IN/MX/BR)
```
