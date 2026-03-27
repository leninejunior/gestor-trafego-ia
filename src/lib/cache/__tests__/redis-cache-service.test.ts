import { RedisCacheService } from '@/lib/cache/redis-cache-service';

describe('RedisCacheService', () => {
  beforeEach(async () => {
    delete process.env.REDIS_REST_URL;
    delete process.env.REDIS_REST_TOKEN;
  });

  it('stores and reads JSON values from fallback cache', async () => {
    const cache = new RedisCacheService({ keyPrefix: 'test-cache' });

    await cache.setJson('foo', { ok: true, value: 10 }, 30);
    const result = await cache.getJson<{ ok: boolean; value: number }>('foo');

    expect(result).toEqual({ ok: true, value: 10 });
  });

  it('expires values based on ttl', async () => {
    const cache = new RedisCacheService({ keyPrefix: 'test-cache-ttl' });

    await cache.setRaw('short', 'value', 1);
    await new Promise(resolve => setTimeout(resolve, 1100));

    const result = await cache.getRaw('short');
    expect(result).toBeNull();
  });

  it('deletes keys by prefix', async () => {
    const cache = new RedisCacheService({ keyPrefix: 'test-cache-prefix' });

    await cache.setRaw('client:1:a', '1', 30);
    await cache.setRaw('client:1:b', '2', 30);
    await cache.setRaw('client:2:a', '3', 30);

    const deleted = await cache.deleteByPrefix('client:1:');

    expect(deleted).toBeGreaterThanOrEqual(2);
    expect(await cache.getRaw('client:1:a')).toBeNull();
    expect(await cache.getRaw('client:1:b')).toBeNull();
    expect(await cache.getRaw('client:2:a')).toBe('3');
  });
});
