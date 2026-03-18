import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { afterEach } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { ProviderLoader, initializeProviders, getProviderRegistry } from '../infrastructure/providers/provider-loader';

describe('ProviderLoader', () => {
  let loader: ProviderLoader;

  beforeEach(async () => {
    loader = ProviderLoader.getInstance();
    // Clear any existing providers and reload
    getProviderRegistry().clear();
    await loader.reloadProviders();
  });

  afterEach(() => {
    // Clean up after each test
    getProviderRegistry().clear();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const loader1 = ProviderLoader.getInstance();
      const loader2 = ProviderLoader.getInstance();
      
      expect(loader1).toBe(loader2);
    });
  });

  describe('Provider Loading', () => {
    it('should load all providers successfully', async () => {
      // Providers should already be loaded in beforeEach
      const loadedProviders = loader.getLoadedProviders();
      
      expect(loadedProviders).toContain('stripe');
      expect(loadedProviders).toContain('iugu');
      expect(loadedProviders).toContain('pagseguro');
      expect(loadedProviders).toContain('mercadopago');
      expect(loadedProviders).toHaveLength(4);
    });

    it('should not reload providers if already loaded', async () => {
      await loader.loadProviders();
      const firstLoad = loader.getLoadedProviders();
      
      await loader.loadProviders();
      const secondLoad = loader.getLoadedProviders();
      
      expect(firstLoad).toEqual(secondLoad);
    });

    it('should reload providers when explicitly requested', async () => {
      await loader.loadProviders();
      const firstStats = loader.getProviderStats();
      
      await loader.reloadProviders();
      const secondStats = loader.getProviderStats();
      
      expect(secondStats.total).toBe(firstStats.total);
      expect(secondStats.active).toBe(firstStats.active);
    });
  });

  describe('Provider Statistics', () => {
    it('should return correct provider statistics', async () => {
      // Providers should already be loaded in beforeEach
      const stats = loader.getProviderStats();
      
      expect(stats.total).toBe(4);
      expect(stats.active).toBe(4);
      expect(stats.loaded).toContain('stripe');
      expect(stats.loaded).toContain('iugu');
      expect(stats.loaded).toContain('pagseguro');
      expect(stats.loaded).toContain('mercadopago');
    });
  });

  describe('Provider Checking', () => {
    it('should check if specific providers are loaded', async () => {
      // Providers should already be loaded in beforeEach
      expect(loader.isProviderLoaded('stripe')).toBe(true);
      expect(loader.isProviderLoaded('iugu')).toBe(true);
      expect(loader.isProviderLoaded('pagseguro')).toBe(true);
      expect(loader.isProviderLoaded('mercadopago')).toBe(true);
      expect(loader.isProviderLoaded('nonexistent')).toBe(false);
    });
  });

  describe('Utility Functions', () => {
    it('should initialize providers through utility function', async () => {
      // Clear registry and reset loader state
      const registry = getProviderRegistry();
      registry.clear();
      
      // Force reload by creating a new loader instance
      const freshLoader = ProviderLoader.getInstance();
      await freshLoader.reloadProviders();
      
      const plugins = registry.listActivePlugins();
      
      expect(plugins).toHaveLength(4);
      expect(plugins.map(p => p.name)).toContain('stripe');
      expect(plugins.map(p => p.name)).toContain('iugu');
      expect(plugins.map(p => p.name)).toContain('pagseguro');
      expect(plugins.map(p => p.name)).toContain('mercadopago');
    });

    it('should return provider registry through utility function', () => {
      const registry = getProviderRegistry();
      
      expect(registry).toBeDefined();
      expect(typeof registry.registerPlugin).toBe('function');
      expect(typeof registry.listActivePlugins).toBe('function');
    });
  });
});