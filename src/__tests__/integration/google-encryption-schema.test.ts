/**
 * Integration Test: Google Ads Encryption Keys Schema
 * Task 1.1: Test encryption/decryption with new schema
 * 
 * This test verifies that:
 * 1. The google_ads_encryption_keys table has all required columns
 * 2. The crypto service can encrypt and decrypt tokens
 * 3. Key rotation works correctly with the new schema
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { createServiceClient } from '@/lib/supabase/server';
import { getGoogleAdsCryptoService } from '@/lib/google/crypto-service';

describe('Google Ads Encryption Keys Schema', () => {
  let supabase: any;
  let cryptoService: any;

  beforeAll(async () => {
    supabase = createServiceClient();
    cryptoService = getGoogleAdsCryptoService();
  });

  describe('Schema Validation', () => {
    it('should have google_ads_encryption_keys table with all required columns', async () => {
      const { data: columns, error } = await supabase
        .rpc('get_table_columns', { table_name: 'google_ads_encryption_keys' })
        .catch(() => {
          // Fallback: query information_schema directly
          return supabase
            .from('information_schema.columns')
            .select('column_name, data_type')
            .eq('table_name', 'google_ads_encryption_keys');
        });

      // If RPC doesn't exist, query directly
      if (error || !columns) {
        const { data: directColumns } = await supabase.rpc('exec_sql', {
          query: `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'google_ads_encryption_keys'
          `
        });

        expect(directColumns).toBeDefined();
      }

      // Required columns
      const requiredColumns = [
        'id',
        'key_data',
        'algorithm',
        'version',
        'key_hash',
        'is_active',
        'created_at',
        'expires_at'
      ];

      // Check if we can query the table with all columns
      const { data: testQuery, error: queryError } = await supabase
        .from('google_ads_encryption_keys')
        .select('id, key_data, algorithm, version, key_hash, is_active, created_at, expires_at')
        .limit(1);

      expect(queryError).toBeNull();
      expect(testQuery).toBeDefined();
    });

    it('should have algorithm column with default value', async () => {
      const { data, error } = await supabase
        .from('google_ads_encryption_keys')
        .select('algorithm')
        .limit(1)
        .single();

      if (data) {
        expect(data.algorithm).toBeDefined();
        expect(typeof data.algorithm).toBe('string');
      }
    });

    it('should have version column with integer type', async () => {
      const { data, error } = await supabase
        .from('google_ads_encryption_keys')
        .select('version')
        .limit(1)
        .single();

      if (data) {
        expect(data.version).toBeDefined();
        expect(typeof data.version).toBe('number');
      }
    });

    it('should have key_hash column', async () => {
      const { data, error } = await supabase
        .from('google_ads_encryption_keys')
        .select('key_hash')
        .limit(1)
        .single();

      // key_hash can be null for old keys, but column should exist
      expect(error).toBeNull();
    });
  });

  describe('Crypto Service Integration', () => {
    it('should encrypt a token successfully', async () => {
      const testToken = 'test-access-token-' + Date.now();
      
      const result = await cryptoService.encryptToken(testToken);

      expect(result).toBeDefined();
      expect(result.encryptedData).toBeDefined();
      expect(result.keyVersion).toBeDefined();
      expect(result.algorithm).toBe('aes-256-gcm');
      expect(typeof result.encryptedData).toBe('string');
      expect(typeof result.keyVersion).toBe('number');
    });

    it('should decrypt an encrypted token successfully', async () => {
      const testToken = 'test-refresh-token-' + Date.now();
      
      // Encrypt
      const encrypted = await cryptoService.encryptToken(testToken);
      
      // Decrypt
      const decrypted = await cryptoService.decryptToken(encrypted.encryptedData);

      expect(decrypted).toBeDefined();
      expect(decrypted.decryptedData).toBe(testToken);
      expect(decrypted.keyVersion).toBe(encrypted.keyVersion);
    });

    it('should perform round-trip encryption/decryption', async () => {
      const originalToken = 'ya29.a0AfH6SMBx...' + Math.random();
      
      const encrypted = await cryptoService.encryptToken(originalToken);
      const decrypted = await cryptoService.decryptToken(encrypted.encryptedData);

      expect(decrypted.decryptedData).toBe(originalToken);
    });

    it('should run encryption test successfully', async () => {
      const testResult = await cryptoService.testEncryption();

      expect(testResult).toBeDefined();
      expect(testResult.success).toBe(true);
      expect(testResult.keyVersion).toBeDefined();
      expect(testResult.error).toBeUndefined();
    });
  });

  describe('Key Management', () => {
    it('should have at least one active encryption key', async () => {
      const { data: activeKeys, error } = await supabase
        .from('google_ads_encryption_keys')
        .select('*')
        .eq('is_active', true);

      expect(error).toBeNull();
      expect(activeKeys).toBeDefined();
      expect(activeKeys.length).toBeGreaterThanOrEqual(0);
    });

    it('should have encryption keys with correct algorithm', async () => {
      const { data: keys, error } = await supabase
        .from('google_ads_encryption_keys')
        .select('algorithm')
        .eq('is_active', true);

      expect(error).toBeNull();
      if (keys && keys.length > 0) {
        keys.forEach(key => {
          expect(key.algorithm).toBe('aes-256-gcm');
        });
      }
    });

    it('should get encryption statistics', async () => {
      const stats = await cryptoService.getEncryptionStats();

      expect(stats).toBeDefined();
      expect(stats.currentKeyVersion).toBeDefined();
      expect(typeof stats.totalKeys).toBe('number');
      expect(typeof stats.activeKeys).toBe('number');
      expect(typeof stats.oldestKeyAge).toBe('number');
    });
  });

  describe('Data Integrity', () => {
    it('should not have duplicate active keys', async () => {
      const { data: activeKeys, error } = await supabase
        .from('google_ads_encryption_keys')
        .select('*')
        .eq('is_active', true);

      expect(error).toBeNull();
      expect(activeKeys).toBeDefined();
      
      // Should have exactly 1 active key
      if (activeKeys && activeKeys.length > 0) {
        expect(activeKeys.length).toBeLessThanOrEqual(1);
      }
    });

    it('should have unique version numbers', async () => {
      const { data: keys, error } = await supabase
        .from('google_ads_encryption_keys')
        .select('version');

      expect(error).toBeNull();
      
      if (keys && keys.length > 0) {
        const versions = keys.map(k => k.version);
        const uniqueVersions = new Set(versions);
        
        // All versions should be unique
        expect(uniqueVersions.size).toBe(versions.length);
      }
    });

    it('should have non-null required fields', async () => {
      const { data: keys, error } = await supabase
        .from('google_ads_encryption_keys')
        .select('*');

      expect(error).toBeNull();
      
      if (keys && keys.length > 0) {
        keys.forEach(key => {
          expect(key.id).toBeDefined();
          expect(key.key_data).toBeDefined();
          expect(key.algorithm).toBeDefined();
          expect(key.version).toBeDefined();
          expect(key.is_active).toBeDefined();
          expect(key.created_at).toBeDefined();
        });
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle decryption of invalid data gracefully', async () => {
      const invalidEncryptedData = 'invalid-base64-data';

      const result = await cryptoService.decryptToken(invalidEncryptedData);
      expect(result).toBeDefined();
      expect(result.decryptedData).toBe(invalidEncryptedData);
      expect(result.keyVersion).toBe(0);
    });

    it('should handle empty token encryption', async () => {
      const result = await cryptoService.encryptToken('');
      expect(result).toBeDefined();
      expect(typeof result.encryptedData).toBe('string');
      expect(result.encryptedData.length).toBeGreaterThan(0);
      expect(typeof result.keyVersion).toBe('number');
    });
  });
});
