import Bottleneck from 'bottleneck';

const API_VERSION = 'wc/v3';
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
 * WooCommerce REST API client with retry logic and rate limiting.
 * Ported from dms-self-serve seed-woo-shipping.mjs and bc-migration WCClient.
 */
export class WCClient {
  constructor(config) {
    this.baseUrl = `${config.url}/wp-json/${API_VERSION}`;
    this.authHeader = `Basic ${btoa(`${config.consumerKey}:${config.consumerSecret}`)}`;

    // Rate limiter: max 10 concurrent, min 100ms between requests
    this.limiter = new Bottleneck({
      maxConcurrent: 10,
      minTime: 100,
    });
  }

  async request(method, endpoint, body = null) {
    return this.limiter.schedule(() => this._requestWithRetry(method, endpoint, body));
  }

  async _requestWithRetry(method, endpoint, body) {
    const url = `${this.baseUrl}/${endpoint}`;

    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      try {
        const options = {
          method,
          headers: {
            Authorization: this.authHeader,
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

        return await response.json();
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

  async get(endpoint) {
    return this.request('GET', endpoint);
  }

  async post(endpoint, body) {
    return this.request('POST', endpoint, body);
  }

  async put(endpoint, body) {
    return this.request('PUT', endpoint, body);
  }

  async del(endpoint) {
    return this.request('DELETE', `${endpoint}?force=true`);
  }

  async testConnection() {
    try {
      await this.get('system_status');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Fetch all items from a paginated endpoint.
   */
  async getAll(endpoint, params = {}) {
    const items = [];
    let page = 1;
    const perPage = params.per_page || 100;

    while (true) {
      const qs = new URLSearchParams({ ...params, per_page: perPage, page }).toString();
      const batch = await this.get(`${endpoint}?${qs}`);
      items.push(...batch);
      if (batch.length < perPage) break;
      page++;
    }

    return items;
  }
}
