/**
 * Simple in-memory cache for API responses with TTL support
 */
export class APICache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }

  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @returns {any} Cached value or undefined
   */
  get(key) {
    return this.cache.get(key);
  }

  /**
   * Set a value in cache with optional TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds (default: 5 minutes)
   */
  set(key, value, ttl = 5 * 60 * 1000) {
    // Clear existing timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    this.cache.set(key, value);

    // Set expiration timer
    const timer = setTimeout(() => {
      this.cache.delete(key);
      this.timers.delete(key);
    }, ttl);

    this.timers.set(key, timer);
  }

  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Clear specific cache entry
   * @param {string} key - Cache key
   */
  delete(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear() {
    this.timers.forEach(timer => clearTimeout(timer));
    this.cache.clear();
    this.timers.clear();
  }

  /**
   * Generate cache key from URL and params
   * @param {string} method - HTTP method
   * @param {string} url - URL path
   * @param {any} params - Query parameters
   * @returns {string}
   */
  static generateKey(method, url, params = {}) {
    const paramString = Object.keys(params)
      .sort()
      .map(k => `${k}=${JSON.stringify(params[k])}`)
      .join('&');
    return `${method}:${url}${paramString ? '?' + paramString : ''}`;
  }
}

export const apiCache = new APICache();

/**
 * Wrapper for cacheable GET requests
 * @param {function} requestFn - Function that makes the API request
 * @param {string} cacheKey - Key for caching
 * @param {number} ttl - Time to live in milliseconds
 * @returns {Promise}
 */
export const cachedRequest = async (requestFn, cacheKey, ttl = 5 * 60 * 1000) => {
  // Return cached value if available
  if (apiCache.has(cacheKey)) {
    return Promise.resolve(apiCache.get(cacheKey));
  }

  try {
    const response = await requestFn();
    // Cache successful response
    apiCache.set(cacheKey, response, ttl);
    return response;
  } catch (error) {
    // Throw error but keep cache if available
    throw error;
  }
};

/**
 * Invalidate cache entries matching a pattern
 * @param {string} pattern - Pattern to match (e.g., 'GET:/books')
 */
export const invalidateCachePattern = (pattern) => {
  for (const [key] of apiCache.cache) {
    if (key.includes(pattern)) {
      apiCache.delete(key);
    }
  }
};
