/**
 * Redis-compatible cache service with in-memory fallback.
 *
 * This service supports two modes:
 * 1. Redis REST mode (Upstash-compatible) via REDIS_REST_URL/REDIS_REST_TOKEN
 * 2. In-memory mode (default fallback when Redis is unavailable)
 */

interface MemoryCacheEntry {
  value: string;
  expiresAt?: number;
}

export interface RedisCacheServiceOptions {
  keyPrefix?: string;
  defaultTtlSeconds?: number;
}

export class RedisCacheService {
  private readonly keyPrefix: string;
  private readonly defaultTtlSeconds: number;
  private readonly memoryCache = new Map<string, MemoryCacheEntry>();

  constructor(options: RedisCacheServiceOptions = {}) {
    this.keyPrefix = options.keyPrefix || 'ads-manager';
    this.defaultTtlSeconds = options.defaultTtlSeconds || 300;
  }

  async getRaw(key: string): Promise<string | null> {
    const namespacedKey = this.buildKey(key);

    const redisValue = await this.getFromRedis(namespacedKey);
    if (redisValue !== undefined) {
      return redisValue;
    }

    return this.getFromMemory(namespacedKey);
  }

  async setRaw(
    key: string,
    value: string,
    ttlSeconds?: number
  ): Promise<void> {
    const namespacedKey = this.buildKey(key);
    const ttl = ttlSeconds || this.defaultTtlSeconds;

    this.setInMemory(namespacedKey, value, ttl);

    await this.setInRedis(namespacedKey, value, ttl);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.getRaw(key);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      await this.delete(key);
      return null;
    }
  }

  async setJson<T>(
    key: string,
    value: T,
    ttlSeconds?: number
  ): Promise<void> {
    await this.setRaw(key, JSON.stringify(value), ttlSeconds);
  }

  async delete(key: string): Promise<void> {
    const namespacedKey = this.buildKey(key);
    this.memoryCache.delete(namespacedKey);
    await this.deleteInRedis(namespacedKey);
  }

  async deleteByPrefix(prefix: string): Promise<number> {
    const namespacedPrefix = this.buildKey(prefix);
    let deleted = 0;

    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(namespacedPrefix)) {
        this.memoryCache.delete(key);
        deleted++;
      }
    }

    const redisDeleted = await this.deleteByPrefixInRedis(namespacedPrefix);
    return Math.max(deleted, redisDeleted);
  }

  async clearMemory(): Promise<void> {
    this.memoryCache.clear();
  }

  private buildKey(key: string): string {
    return this.keyPrefix + ':' + key;
  }

  private getFromMemory(key: string): string | null {
    const entry = this.memoryCache.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }

    return entry.value;
  }

  private setInMemory(key: string, value: string, ttlSeconds: number): void {
    const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : undefined;
    this.memoryCache.set(key, { value, expiresAt });
  }

  private get redisRestUrl(): string | undefined {
    return process.env.REDIS_REST_URL;
  }

  private get redisRestToken(): string | undefined {
    return process.env.REDIS_REST_TOKEN;
  }

  private get isRedisConfigured(): boolean {
    return Boolean(this.redisRestUrl && this.redisRestToken);
  }

  private async executeRedisCommand(args: string[]): Promise<unknown> {
    if (!this.isRedisConfigured || !this.redisRestUrl || !this.redisRestToken) {
      throw new Error('Redis REST is not configured');
    }

    const response = await fetch(this.redisRestUrl, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + this.redisRestToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(args)
    });

    if (!response.ok) {
      throw new Error('Redis command failed with status ' + response.status);
    }

    const payload = (await response.json().catch(() => ({}))) as {
      result?: unknown;
      error?: string;
    };

    if (payload.error) {
      throw new Error(payload.error);
    }

    return payload.result;
  }

  private async getFromRedis(key: string): Promise<string | null | undefined> {
    if (!this.isRedisConfigured) {
      return undefined;
    }

    try {
      const result = await this.executeRedisCommand(['GET', key]);
      if (typeof result === 'string') {
        this.setInMemory(key, result, this.defaultTtlSeconds);
        return result;
      }
      return null;
    } catch (error) {
      return undefined;
    }
  }

  private async setInRedis(
    key: string,
    value: string,
    ttlSeconds: number
  ): Promise<void> {
    if (!this.isRedisConfigured) {
      return;
    }

    try {
      if (ttlSeconds > 0) {
        await this.executeRedisCommand([
          'SET',
          key,
          value,
          'EX',
          String(ttlSeconds)
        ]);
        return;
      }

      await this.executeRedisCommand(['SET', key, value]);
    } catch (error) {
      // Keep in-memory fallback active even if Redis write fails.
    }
  }

  private async deleteInRedis(key: string): Promise<void> {
    if (!this.isRedisConfigured) {
      return;
    }

    try {
      await this.executeRedisCommand(['DEL', key]);
    } catch (error) {
      // Ignore Redis delete errors to avoid blocking request flow.
    }
  }

  private async deleteByPrefixInRedis(prefix: string): Promise<number> {
    if (!this.isRedisConfigured) {
      return 0;
    }

    try {
      const keys = await this.executeRedisCommand([
        'KEYS',
        prefix + '*'
      ]);

      if (!Array.isArray(keys) || keys.length === 0) {
        return 0;
      }

      const keyArgs = keys.map(key => String(key));
      const deleted = await this.executeRedisCommand(['DEL', ...keyArgs]);

      if (typeof deleted === 'number') {
        return deleted;
      }

      return keyArgs.length;
    } catch (error) {
      return 0;
    }
  }
}

export const redisCacheService = new RedisCacheService();
