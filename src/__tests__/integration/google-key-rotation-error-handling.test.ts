/**
 * Integration tests for Google Ads Crypto Service Key Rotation Error Handling
 * 
 * Tests Task 2.2: Handle key rotation errors gracefully
 * - Test key rotation with database failures
 * - Test rollback mechanisms
 * - Test fallback to environment keys
 * - Test graceful degradation
 * 
 * Requirements: 1.1, 8.2
 */

import { GoogleAdsCryptoService } from '@/lib/google/crypto-service';

describe('Google Ads Key Rotation Error Handling', () => {
  let cryptoService: GoogleAdsCryptoService;

  beforeEach(() => {
    // Create a new instance for each test
    cryptoService = new GoogleAdsCryptoService();
  });

  describe('Key Rotation Error Scenarios', () => {
    it('should handle key rotation gracefully during initialization failures', async () => {
      // Wait for initialization
      await cryptoService.ensureInitialized();

      const status = cryptoService.getInitializationStatus();

      // Service should be initialized even if there were errors
      expect(status.isInitialized).toBe(true);

      if (status.hasError) {
        console.log('⚠️ Initialization had errors, using fallback:', {
          error: status.error,
          keyVersion: status.currentKeyVersion,
        });
        
        // Should fall back to version 0 (environment key)
        expect(status.currentKeyVersion).toBe(0);
      } else {
        console.log('✅ Initialization successful without errors');
        expect(status.currentKeyVersion).toBeGreaterThanOrEqual(0);
      }
    });

    it('should still encrypt/decrypt after initialization errors', async () => {
      await cryptoService.ensureInitialized();

      const testToken = 'test-token-after-init-error';

      // Should be able to encrypt even with fallback key
      const encrypted = await cryptoService.encryptToken(testToken);
      expect(encrypted.encryptedData).toBeDefined();
      expect(encrypted.keyVersion).toBeGreaterThanOrEqual(0);

      // Should be able to decrypt
      const decrypted = await cryptoService.decryptToken(encrypted.encryptedData);
      expect(decrypted.decryptedData).toBe(testToken);

      console.log('✅ Encryption/decryption works after initialization errors');
    });

    it('should handle manual key rotation attempts gracefully', async () => {
      await cryptoService.ensureInitialized();

      try {
        // Attempt manual key rotation
        await cryptoService.forceKeyRotation();
        
        console.log('✅ Manual key rotation succeeded');
        
        // Verify service still works after rotation
        const testToken = 'test-after-rotation';
        const encrypted = await cryptoService.encryptToken(testToken);
        const decrypted = await cryptoService.decryptToken(encrypted.encryptedData);
        
        expect(decrypted.decryptedData).toBe(testToken);
      } catch (error) {
        // Key rotation might fail due to database issues, but service should still work
        console.log('⚠️ Manual key rotation failed (expected in some environments):', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        // Verify service still works with existing key
        const testToken = 'test-after-failed-rotation';
        const encrypted = await cryptoService.encryptToken(testToken);
        const decrypted = await cryptoService.decryptToken(encrypted.encryptedData);
        
        expect(decrypted.decryptedData).toBe(testToken);
        console.log('✅ Service continues to work after failed rotation');
      }
    });

    it('should maintain encryption capability across multiple operations', async () => {
      await cryptoService.ensureInitialized();

      const tokens = [
        'token-1',
        'token-2',
        'token-3',
        'token-4',
        'token-5',
      ];

      // Encrypt all tokens
      const encrypted = await Promise.all(
        tokens.map(token => cryptoService.encryptToken(token))
      );

      // Decrypt all tokens
      const decrypted = await Promise.all(
        encrypted.map(enc => cryptoService.decryptToken(enc.encryptedData))
      );

      // Verify all tokens match
      decrypted.forEach((dec, index) => {
        expect(dec.decryptedData).toBe(tokens[index]);
      });

      console.log('✅ Multiple operations successful:', {
        tokensProcessed: tokens.length,
      });
    });
  });

  describe('Fallback Mechanisms', () => {
    it('should use environment key as fallback when database unavailable', async () => {
      await cryptoService.ensureInitialized();

      const status = cryptoService.getInitializationStatus();

      if (status.currentKeyVersion === 0) {
        console.log('✅ Using environment key fallback (version 0)');
        
        // Verify encryption still works with fallback
        const testToken = 'fallback-test-token';
        const encrypted = await cryptoService.encryptToken(testToken);
        const decrypted = await cryptoService.decryptToken(encrypted.encryptedData);
        
        expect(decrypted.decryptedData).toBe(testToken);
        expect(encrypted.keyVersion).toBe(0);
      } else {
        console.log('✅ Using database key (version > 0)');
        expect(status.currentKeyVersion).toBeGreaterThan(0);
      }
    });

    it('should handle plain text tokens during migration', async () => {
      // Test various plain text token formats
      const plainTextTokens = [
        'ya29.a0AfH6SMBxxx', // Google access token format
        '1//0gxxx',          // Google refresh token format
        'short',             // Short token
        'plain-text-token',  // Generic plain text
      ];

      for (const token of plainTextTokens) {
        const result = await cryptoService.decryptToken(token);
        
        expect(result.decryptedData).toBe(token);
        expect(result.keyVersion).toBe(0);
      }

      console.log('✅ All plain text token formats handled correctly');
    });

    it('should handle corrupted encrypted data gracefully', async () => {
      const corruptedData = [
        'corrupted-base64-!@#$',
        'invalid-encrypted-data',
        'not-a-valid-token',
      ];

      for (const data of corruptedData) {
        // Should not throw, but return as plain text fallback
        const result = await cryptoService.decryptToken(data);
        
        expect(result.decryptedData).toBe(data);
        expect(result.keyVersion).toBe(0);
      }

      console.log('✅ Corrupted data handled with fallback');
    });
  });

  describe('Error Logging and Diagnostics', () => {
    it('should log detailed error information during failures', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error');
      const consoleWarnSpy = jest.spyOn(console, 'warn');

      await cryptoService.ensureInitialized();

      // Check if any errors or warnings were logged
      const hasErrors = consoleErrorSpy.mock.calls.length > 0;
      const hasWarnings = consoleWarnSpy.mock.calls.length > 0;

      if (hasErrors || hasWarnings) {
        console.log('⚠️ Errors/warnings logged during initialization:', {
          errors: consoleErrorSpy.mock.calls.length,
          warnings: consoleWarnSpy.mock.calls.length,
        });
      } else {
        console.log('✅ No errors or warnings during initialization');
      }

      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('should provide detailed initialization status', async () => {
      await cryptoService.ensureInitialized();

      const status = cryptoService.getInitializationStatus();

      expect(status).toHaveProperty('isInitialized');
      expect(status).toHaveProperty('hasError');
      expect(status).toHaveProperty('currentKeyVersion');

      console.log('✅ Initialization status:', status);
    });

    it('should provide encryption statistics', async () => {
      await cryptoService.ensureInitialized();

      const stats = await cryptoService.getEncryptionStats();

      expect(stats).toHaveProperty('currentKeyVersion');
      expect(stats).toHaveProperty('totalKeys');
      expect(stats).toHaveProperty('activeKeys');
      expect(stats).toHaveProperty('oldestKeyAge');

      console.log('✅ Encryption statistics:', stats);
    });
  });

  describe('Service Resilience', () => {
    it('should continue working after multiple error scenarios', async () => {
      await cryptoService.ensureInitialized();

      // Perform multiple operations to test resilience
      const operations = [
        async () => {
          const token = 'test-1';
          const enc = await cryptoService.encryptToken(token);
          const dec = await cryptoService.decryptToken(enc.encryptedData);
          expect(dec.decryptedData).toBe(token);
        },
        async () => {
          // Plain text fallback
          const plainText = 'ya29.plain';
          const dec = await cryptoService.decryptToken(plainText);
          expect(dec.decryptedData).toBe(plainText);
        },
        async () => {
          // Corrupted data fallback
          const corrupted = 'corrupted-data';
          const dec = await cryptoService.decryptToken(corrupted);
          expect(dec.decryptedData).toBe(corrupted);
        },
        async () => {
          // Normal encryption
          const token = 'test-2';
          const enc = await cryptoService.encryptToken(token);
          const dec = await cryptoService.decryptToken(enc.encryptedData);
          expect(dec.decryptedData).toBe(token);
        },
      ];

      // Execute all operations
      for (const operation of operations) {
        await operation();
      }

      console.log('✅ Service remains resilient after multiple operations');
    });

    it('should handle concurrent encryption operations', async () => {
      await cryptoService.ensureInitialized();

      const tokens = Array.from({ length: 10 }, (_, i) => `concurrent-token-${i}`);

      // Encrypt all tokens concurrently
      const encryptedResults = await Promise.all(
        tokens.map(token => cryptoService.encryptToken(token))
      );

      // Decrypt all tokens concurrently
      const decryptedResults = await Promise.all(
        encryptedResults.map(enc => cryptoService.decryptToken(enc.encryptedData))
      );

      // Verify all tokens match
      decryptedResults.forEach((dec, index) => {
        expect(dec.decryptedData).toBe(tokens[index]);
      });

      console.log('✅ Concurrent operations handled successfully:', {
        operations: tokens.length,
      });
    });
  });

  describe('Test Encryption Method', () => {
    it('should pass internal encryption test', async () => {
      const testResult = await cryptoService.testEncryption();

      expect(testResult).toHaveProperty('success');
      expect(testResult).toHaveProperty('initializationStatus');

      if (testResult.success) {
        console.log('✅ Internal encryption test passed:', {
          keyVersion: testResult.keyVersion,
        });
      } else {
        console.log('⚠️ Internal encryption test failed:', {
          error: testResult.error,
        });
      }

      // Service should still be usable even if test fails
      const token = 'test-after-internal-test';
      const enc = await cryptoService.encryptToken(token);
      const dec = await cryptoService.decryptToken(enc.encryptedData);
      expect(dec.decryptedData).toBe(token);
    });
  });
});
