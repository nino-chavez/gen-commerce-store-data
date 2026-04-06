import Bottleneck from 'bottleneck';

const REQUEST_TIMEOUT = 30_000;
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY = 1000;

class RetriableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RetriableError';
  }
}

/**
 * BigCommerce REST API client with retry logic and rate limiting.
 * Uses v3 for catalog/customers, v2 for orders/coupons.
 */
export class BCClient {
  constructor(config) {
    this.storeHash = config.storeHash;
    this.baseUrlV3 = `https://api.bigcommerce.com/stores/${config.storeHash}/v3`;
    this.baseUrlV2 = `https://api.bigcommerce.com/stores/${config.storeHash}/v2`;
    this.accessToken = config.accessToken;

    // Rate limiter: BC allows ~150 req/30s — stay well under
    this.limiter = new Bottleneck({
      maxConcurrent: 5,
      minTime: 200, // 5 req/s = 150/30s
    });
  }

  async request(method, endpoint, body = null, { version = 'v3' } = {}) {
    return this.limiter.schedule(() =>
      this._requestWithRetry(method, endpoint, body, version),
    );
  }

  async _requestWithRetry(method, endpoint, body, version) {
    const base = version === 'v2' ? this.baseUrlV2 : this.baseUrlV3;
    const url = `${base}/${endpoint}`;

    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      try {
        const options = {
          method,
          headers: {
            'X-Auth-Token': this.accessToken,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          signal: controller.signal,
        };

        if (body) {
          options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.text();
          const msg = `${method} ${endpoint} -> ${response.status}: ${errorBody}`;

          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw new Error(msg);
          }
          throw new RetriableError(msg);
        }

        // v2 returns data directly, v3 wraps in { data }
        const json = await response.json();
        return version === 'v2' ? json : (json.data ?? json);
      } catch (error) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
          error = new RetriableError(`Timeout after ${REQUEST_TIMEOUT}ms: ${method} ${endpoint}`);
        }

        if (attempt === RETRY_ATTEMPTS || !(error instanceof RetriableError)) {
          throw error;
        }

        const delay = RETRY_BASE_DELAY * Math.pow(2, attempt - 1) * (0.5 + Math.random() * 0.5);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  // Convenience methods

  async get(endpoint, opts) {
    return this.request('GET', endpoint, null, opts);
  }

  async post(endpoint, body, opts) {
    return this.request('POST', endpoint, body, opts);
  }

  async put(endpoint, body, opts) {
    return this.request('PUT', endpoint, body, opts);
  }

  async del(endpoint, opts) {
    return this.request('DELETE', endpoint, null, opts);
  }

  async testConnection() {
    try {
      await this.get('catalog/summary');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Fetch all items from a paginated v3 endpoint.
   * BC v3 uses { data: [], meta: { pagination: { total_pages } } }
   */
  async getAll(endpoint, params = {}) {
    const items = [];
    let page = 1;
    const limit = params.limit || 250;

    while (true) {
      const qs = new URLSearchParams({ ...params, limit, page }).toString();
      // Use raw request to get the full response envelope
      const result = await this.limiter.schedule(async () => {
        const base = this.baseUrlV3;
        const url = `${base}/${endpoint}?${qs}`;
        const response = await fetch(url, {
          headers: {
            'X-Auth-Token': this.accessToken,
            Accept: 'application/json',
          },
        });
        if (!response.ok) {
          throw new Error(`GET ${endpoint} -> ${response.status}`);
        }
        return response.json();
      });

      items.push(...(result.data || []));

      const pagination = result.meta?.pagination;
      if (!pagination || page >= pagination.total_pages) break;
      page++;
    }

    return items;
  }

  /**
   * Fetch all items from a paginated v2 endpoint.
   * BC v2 returns arrays directly, uses ?page=N&limit=N
   */
  async getAllV2(endpoint, params = {}) {
    const items = [];
    let page = 1;
    const limit = params.limit || 250;

    while (true) {
      const qs = new URLSearchParams({ ...params, limit, page }).toString();
      const batch = await this.request('GET', `${endpoint}?${qs}`, null, { version: 'v2' });
      if (!Array.isArray(batch) || batch.length === 0) break;
      items.push(...batch);
      if (batch.length < limit) break;
      page++;
    }

    return items;
  }
}
