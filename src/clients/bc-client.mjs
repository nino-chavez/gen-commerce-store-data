import Bottleneck from 'bottleneck';

const REQUEST_TIMEOUT = 30_000;
const RETRY_ATTEMPTS = 6;
const RETRY_BASE_DELAY = 1000;
const MAX_RATE_LIMIT_WAIT = 60_000;

class RetriableError extends Error {
  constructor(message, { rateLimitResetMs } = {}) {
    super(message);
    this.name = 'RetriableError';
    this.rateLimitResetMs = rateLimitResetMs;
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

          // BC documents X-Rate-Limit-Time-Reset-Ms as the authoritative wait
          // time on 429s: https://docs.bigcommerce.com/developer/docs/overview/api-fundamentals/rate-limits.md
          const resetHeader = response.headers.get('X-Rate-Limit-Time-Reset-Ms');
          const rateLimitResetMs = resetHeader !== null ? Number(resetHeader) : undefined;
          throw new RetriableError(msg, { rateLimitResetMs });
        }

        // v2 returns data directly, v3 wraps in { data }. Bulk assignment
        // PUTs (and some DELETEs) return 204 with an empty body.
        const text = await response.text();
        if (!text) return null;
        const json = JSON.parse(text);
        return version === 'v2' ? json : (json.data ?? json);
      } catch (error) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
          error = new RetriableError(`Timeout after ${REQUEST_TIMEOUT}ms: ${method} ${endpoint}`);
        } else if (error.name === 'TypeError' && error.cause) {
          // Transport-level failure (DNS, connection reset) — undici surfaces
          // these as a bare TypeError, which would otherwise abort a long run.
          error = new RetriableError(`Network error: ${method} ${endpoint}: ${error.cause.code ?? error.cause.message}`);
        }

        if (attempt === RETRY_ATTEMPTS || !(error instanceof RetriableError)) {
          throw error;
        }

        const backoff = RETRY_BASE_DELAY * Math.pow(2, attempt - 1) * (0.5 + Math.random() * 0.5);
        // Prefer BC's own reset window over our exponential guess when it's given
        // and sane; a server-reported wait is more accurate than a blind backoff.
        const rateLimitWait = Number.isFinite(error.rateLimitResetMs) && error.rateLimitResetMs > 0
          ? Math.min(error.rateLimitResetMs, MAX_RATE_LIMIT_WAIT)
          : undefined;
        const delay = rateLimitWait !== undefined ? Math.max(rateLimitWait, backoff) : backoff;
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

  /**
   * POST multipart/form-data (e.g. raw file upload to the product images
   * endpoint). Bypasses the JSON request() path -- BC's image upload only
   * accepts image_url over JSON; a local file requires multipart/form-data
   * with an `image_file` field. Reuses the same rate limiter and retry logic.
   */
  async postMultipart(endpoint, formData) {
    return this.limiter.schedule(() => this._multipartWithRetry(endpoint, formData));
  }

  async _multipartWithRetry(endpoint, formData) {
    const url = `${this.baseUrlV3}/${endpoint}`;

    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'X-Auth-Token': this.accessToken,
            Accept: 'application/json',
          },
          body: formData,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.text();
          const msg = `POST ${endpoint} (multipart) -> ${response.status}: ${errorBody}`;
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw new Error(msg);
          }
          const resetHeader = response.headers.get('X-Rate-Limit-Time-Reset-Ms');
          const rateLimitResetMs = resetHeader !== null ? Number(resetHeader) : undefined;
          throw new RetriableError(msg, { rateLimitResetMs });
        }

        const json = await response.json();
        return json.data ?? json;
      } catch (error) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
          error = new RetriableError(`Timeout after ${REQUEST_TIMEOUT}ms: POST ${endpoint} (multipart)`);
        } else if (error.name === 'TypeError' && error.cause) {
          error = new RetriableError(`Network error: POST ${endpoint} (multipart): ${error.cause.code ?? error.cause.message}`);
        }

        if (attempt === RETRY_ATTEMPTS || !(error instanceof RetriableError)) {
          throw error;
        }

        const backoff = RETRY_BASE_DELAY * Math.pow(2, attempt - 1) * (0.5 + Math.random() * 0.5);
        const rateLimitWait = Number.isFinite(error.rateLimitResetMs) && error.rateLimitResetMs > 0
          ? Math.min(error.rateLimitResetMs, MAX_RATE_LIMIT_WAIT)
          : undefined;
        const delay = rateLimitWait !== undefined ? Math.max(rateLimitWait, backoff) : backoff;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
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
