import Bottleneck from 'bottleneck';

const API_VERSION = '2024-10';
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
 * Shopify Admin REST API client with retry logic and rate limiting.
 * Shopify enforces a leaky-bucket at 2 req/s (40 bucket) on standard plans.
 */
export class ShopifyClient {
  constructor(config) {
    const store = config.storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    this.store = store;
    this.baseUrl = `https://${store}/admin/api/${API_VERSION}`;
    this.accessToken = config.accessToken;

    this.limiter = new Bottleneck({
      maxConcurrent: 2,
      minTime: 500,
    });
  }

  async request(method, endpoint, body = null) {
    return this.limiter.schedule(() => this._requestWithRetry(method, endpoint, body));
  }

  async _requestWithRetry(method, endpoint, body) {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      try {
        const options = {
          method,
          headers: {
            'X-Shopify-Access-Token': this.accessToken,
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

        if (response.status === 204) return null;
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
    return this.request('DELETE', endpoint);
  }

  async testConnection() {
    try {
      await this.get('/shop.json');
      return true;
    } catch {
      return false;
    }
  }
}
