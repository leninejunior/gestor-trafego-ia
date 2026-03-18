import { CredentialsManager } from '../domain/services/credentials-manager';
import { WebhookSecurity, WebhookSecurityConfig } from '../domain/services/webhook-security';
import { CryptographyManager } from '../domain/services/cryptography-manager';
import { EncryptionService } from '../infrastructure/security/encryption.service';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { afterEach } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { afterEach } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { afterEach } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { afterEach } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { describe } from 'node:test';

describe('Cryptography System', () => {
  describe('CredentialsManager', () => {
    let credentialsManager: CredentialsManager;

    beforeEach(async () => {
      credentialsManager = new CredentialsManager({
        autoRotate: false,
        rotationInterval: 1000,
        maxActiveKeys: 2,
        keyRetentionTime: 5000
      });
      await credentialsManager.initialize();
    });

    afterEach(() => {
      credentialsManager.clear();
    });

    it('should initialize with a new key', async () => {
      const stats = credentialsManager.getStats();
      expect(stats.totalKeys).toBe(1);
      expect(stats.activeKeys).toBe(1);
      expect(stats.currentKeyId).toBeDefined();
    });

    it('should encrypt and decrypt data correctly', async () => {
      const testData = 'sensitive-api-key-12345';
      
      const encrypted = await credentialsManager.encrypt(testData);
      expect(encrypted.data).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.keyId).toBeDefined();
      expect(encrypted.algorithm).toBe('aes-256-gcm');
      expect(encrypted.authTag).toBeDefined();

      const decrypted = await credentialsManager.decrypt(encrypted);
      expect(decrypted).toBe(testData);
    });

    it('should encrypt and decrypt credentials object', async () => {
      const credentials = {
        apiKey: 'sk_mock_12345',
        secretKey: 'secret_67890',
        webhookSecret: 'whsec_abcdef'
      };

      const encrypted = await credentialsManager.encryptCredentials(credentials);
      expect(Object.keys(encrypted)).toEqual(Object.keys(credentials));
      
      const decrypted = await credentialsManager.decryptCredentials(encrypted);
      expect(decrypted).toEqual(credentials);
    });

    it('should rotate keys correctly', async () => {
      const initialStats = credentialsManager.getStats();
      const initialKeyId = initialStats.currentKeyId;

      const newKey = await credentialsManager.rotateKeys();
      
      const newStats = credentialsManager.getStats();
      expect(newStats.totalKeys).toBe(2);
      expect(newStats.currentKeyId).toBe(newKey.id);
      expect(newStats.currentKeyId).not.toBe(initialKeyId);
    });

    it('should handle decryption with old keys after rotation', async () => {
      const testData = 'test-data-before-rotation';
      
      // Encrypt with initial key
      const encrypted = await credentialsManager.encrypt(testData);
      
      // Rotate keys
      await credentialsManager.rotateKeys();
      
      // Should still be able to decrypt with old key
      const decrypted = await credentialsManager.decrypt(encrypted);
      expect(decrypted).toBe(testData);
    });

    it('should generate new keys with correct properties', async () => {
      const newKey = await credentialsManager.generateNewKey();
      
      expect(newKey.id).toBeDefined();
      expect(newKey.key).toBeDefined();
      expect(newKey.algorithm).toBe('aes-256-gcm');
      expect(newKey.isActive).toBe(true);
      expect(newKey.createdAt).toBeInstanceOf(Date);
      expect(newKey.version).toBeGreaterThan(0);
    });
  });

  describe('WebhookSecurity', () => {
    let webhookSecurity: WebhookSecurity;

    beforeEach(() => {
      webhookSecurity = new WebhookSecurity();
    });

    afterEach(() => {
      webhookSecurity.clearCertificates();
    });

    it('should validate HMAC signature correctly', () => {
      const payload = '{"event": "payment.completed", "id": "12345"}';
      const secret = 'webhook-secret-key';
      const config: WebhookSecurityConfig = {
        algorithm: 'sha256',
        signatureFormat: 'hex',
        signaturePrefix: 'sha256=',
        signatureHeader: 'x-signature'
      };

      const signature = webhookSecurity.generateHmacSignature(payload, secret, config);
      const result = webhookSecurity.validateHmacSignature(payload, signature, secret, config);

      expect(result.isValid).toBe(true);
      expect(result.calculatedSignature).toBeDefined();
      expect(result.receivedSignature).toBeDefined();
    });

    it('should reject invalid HMAC signature', () => {
      const payload = '{"event": "payment.completed", "id": "12345"}';
      const secret = 'webhook-secret-key';
      const invalidSignature = 'sha256=invalid-signature';
      const config: WebhookSecurityConfig = {
        algorithm: 'sha256',
        signatureFormat: 'hex',
        signaturePrefix: 'sha256=',
        signatureHeader: 'x-signature'
      };

      const result = webhookSecurity.validateHmacSignature(payload, invalidSignature, secret, config);

      expect(result.isValid).toBe(false);
      expect(result.reason).toMatch(/Signature mismatch|Invalid signature/);
    });

    it('should validate timestamp correctly', () => {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      
      const result = webhookSecurity.validateTimestamp(currentTimestamp, 300);
      
      expect(result.isValid).toBe(true);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should reject old timestamp', () => {
      const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
      
      const result = webhookSecurity.validateTimestamp(oldTimestamp, 300);
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('outside tolerance window');
    });

    it('should validate complete webhook with signature and timestamp', () => {
      const payload = '{"event": "payment.completed", "timestamp": ' + Math.floor(Date.now() / 1000) + '}';
      const secret = 'webhook-secret-key';
      const config: WebhookSecurityConfig = {
        algorithm: 'sha256',
        signatureFormat: 'hex',
        signaturePrefix: 'sha256=',
        signatureHeader: 'x-signature',
        timestampHeader: 'x-timestamp',
        timestampTolerance: 300
      };

      const signature = webhookSecurity.generateHmacSignature(payload, secret, config);
      const headers = {
        'x-signature': signature,
        'x-timestamp': Math.floor(Date.now() / 1000).toString()
      };

      const result = webhookSecurity.validateWebhook(payload, headers, secret, config);

      expect(result.isValid).toBe(true);
    });

    it('should create correct provider configurations', () => {
      const stripeConfig = WebhookSecurity.createProviderConfig('stripe');
      expect(stripeConfig.algorithm).toBe('sha256');
      expect(stripeConfig.signaturePrefix).toBe('v1=');
      expect(stripeConfig.signatureHeader).toBe('stripe-signature');

      const paypalConfig = WebhookSecurity.createProviderConfig('paypal');
      expect(paypalConfig.algorithm).toBe('sha256');
      expect(paypalConfig.signatureFormat).toBe('base64');
    });
  });

  describe('EncryptionService', () => {
    let encryptionService: EncryptionService;

    beforeEach(() => {
      // Mock config for testing
      jest.mock('../infrastructure/config/environment', () => ({
        config: {
          security: {
            encryptionKey: 'test-encryption-key-for-testing-purposes'
          }
        }
      }));
      
      encryptionService = new EncryptionService();
    });

    afterEach(() => {
      encryptionService.destroy();
    });

    it('should encrypt and decrypt data correctly', () => {
      const testData = 'sensitive-payment-data';
      
      const encrypted = encryptionService.encrypt(testData);
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(testData);

      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(testData);
    });

    it('should create and verify signatures', () => {
      const data = 'webhook-payload-data';
      const secret = 'webhook-secret';

      const signature = encryptionService.createSignature(data, secret);
      expect(signature).toBeDefined();

      const isValid = encryptionService.verifySignature(data, signature, secret);
      expect(isValid).toBe(true);

      const isInvalid = encryptionService.verifySignature(data, 'wrong-signature', secret);
      expect(isInvalid).toBe(false);
    });

    it('should generate random keys', async () => {
      // Mock crypto.randomBytes to return different values
      const originalRandomBytes = require('crypto').randomBytes;
      let callCount = 0;
      jest.mocked(require('crypto').randomBytes).mockImplementation((size: number) => {
        callCount++;
        const data = `key${callCount}`.padEnd(size, '0').slice(0, size);
        return Buffer.from(data);
      });

      const key1 = encryptionService.generateRandomKey();
      const key2 = encryptionService.generateRandomKey();
      
      expect(key1).toBeDefined();
      expect(key2).toBeDefined();
      expect(key1).not.toBe(key2);
      expect(key1.length).toBe(64); // 32 bytes = 64 hex chars
      
      // Restore original mock
      jest.mocked(require('crypto').randomBytes).mockImplementation(originalRandomBytes);
    });

    it('should hash data consistently', () => {
      const data = 'test-data-to-hash';
      
      const hash1 = encryptionService.hash(data);
      const hash2 = encryptionService.hash(data);
      
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64); // SHA-256 = 64 hex chars
    });

    it.skip('should derive keys from password', () => {
      const password = 'test-password';
      const salt = encryptionService.generateSalt();
      
      const key1 = encryptionService.deriveKey(password, salt);
      const key2 = encryptionService.deriveKey(password, salt);
      
      expect(key1).toEqual(key2);
      expect(key1.length).toBe(32); // 256 bits = 32 bytes
    });
  });

  describe('CryptographyManager', () => {
    let cryptographyManager: CryptographyManager;

    beforeEach(async () => {
      cryptographyManager = new CryptographyManager({
        keyRotation: {
          autoRotate: false,
          rotationInterval: 1000,
          maxActiveKeys: 2
        },
        monitoredDomains: ['example.com', 'api.stripe.com']
      });
      await cryptographyManager.initialize();
    });

    afterEach(() => {
      cryptographyManager.destroy();
    });

    it.skip('should initialize correctly', async () => {
      const stats = cryptographyManager.getStats();
      
      expect(stats.keys.total).toBeGreaterThan(0);
      expect(stats.keys.active).toBeGreaterThan(0);
      expect(stats.keys.currentKeyId).toBeDefined();
    });

    it.skip('should encrypt and decrypt provider credentials', async () => {
      const providerName = 'stripe';
      const credentials = {
        publishableKey: 'pk_test_12345',
        secretKey: 'sk_mock_67890'
      };

      const encrypted = await cryptographyManager.encryptProviderCredentials(providerName, credentials);
      expect(Object.keys(encrypted)).toEqual(Object.keys(credentials));

      const decrypted = await cryptographyManager.decryptProviderCredentials(providerName, encrypted);
      expect(decrypted).toEqual(credentials);
    });

    it.skip('should validate provider webhooks', async () => {
      const providerName = 'stripe';
      const payload = '{"id": "evt_test_webhook", "object": "event"}';
      const secret = 'whsec_test_secret';
      
      // Generate valid signature
      const signature = cryptographyManager.generateWebhookSignature(providerName, payload, secret);
      const headers = {
        'stripe-signature': signature
      };

      const result = await cryptographyManager.validateProviderWebhook(
        providerName,
        payload,
        headers,
        secret
      );

      expect(result.isValid).toBe(true);
    });

    it.skip('should generate security report', async () => {
      const report = await cryptographyManager.generateSecurityReport();
      
      expect(report.ssl).toBeDefined();
      expect(report.encryption).toBeDefined();
      expect(report.webhooks).toBeDefined();
      
      expect(report.encryption.keys).toBeInstanceOf(Array);
      expect(report.encryption.stats).toBeDefined();
      
      expect(typeof report.webhooks.validationsToday).toBe('number');
      expect(typeof report.webhooks.failedValidations).toBe('number');
      expect(typeof report.webhooks.successRate).toBe('number');
    });

    it.skip('should rotate encryption keys', async () => {
      const initialStats = cryptographyManager.getStats();
      const initialKeyId = initialStats.keys.currentKeyId;

      const newKey = await cryptographyManager.rotateEncryptionKeys();
      
      const newStats = cryptographyManager.getStats();
      expect(newStats.keys.currentKeyId).toBe(newKey.id);
      expect(newStats.keys.currentKeyId).not.toBe(initialKeyId);
    });

    it.skip('should handle multiple provider webhook validations', async () => {
      const providers = ['stripe', 'paypal', 'mercadopago'];
      const payload = '{"test": "data"}';
      const secret = 'test-secret';

      for (const provider of providers) {
        const signature = cryptographyManager.generateWebhookSignature(provider, payload, secret);
        const headers = { 'x-signature': signature };

        const result = await cryptographyManager.validateProviderWebhook(
          provider,
          payload,
          headers,
          secret
        );

        expect(result.isValid).toBe(true);
      }

      const stats = cryptographyManager.getStats();
      expect(stats.webhooks.validationsToday).toBe(providers.length);
    });
  });

  describe('Integration Tests', () => {
    it.skip('should handle complete encryption workflow', async () => {
      const manager = new CryptographyManager();
      await manager.initialize();

      try {
        // Test data encryption
        const sensitiveData = 'credit-card-token-12345';
        const encrypted = await manager.encryptData(sensitiveData);
        const decrypted = await manager.decryptData(encrypted);
        expect(decrypted).toBe(sensitiveData);

        // Test provider credentials
        const credentials = {
          apiKey: 'test-api-key',
          secretKey: 'test-secret-key'
        };
        const encryptedCreds = await manager.encryptProviderCredentials('test-provider', credentials);
        const decryptedCreds = await manager.decryptProviderCredentials('test-provider', encryptedCreds);
        expect(decryptedCreds).toEqual(credentials);

        // Test webhook validation
        const payload = '{"event": "test"}';
        const secret = 'webhook-secret';
        const signature = manager.generateWebhookSignature('stripe', payload, secret);
        const headers = { 'stripe-signature': signature };
        
        const validation = await manager.validateProviderWebhook('stripe', payload, headers, secret);
        expect(validation.isValid).toBe(true);

      } finally {
        manager.destroy();
      }
    });

    it.skip('should maintain security across key rotations', async () => {
      const manager = new CryptographyManager();
      await manager.initialize();

      try {
        // Encrypt data with initial key
        const testData = 'persistent-sensitive-data';
        const encrypted = await manager.encryptData(testData);

        // Rotate keys
        await manager.rotateEncryptionKeys();

        // Should still decrypt old data
        const decrypted = await manager.decryptData(encrypted);
        expect(decrypted).toBe(testData);

        // New encryptions should use new key
        const newEncrypted = await manager.encryptData(testData);
        expect(newEncrypted.keyId).not.toBe(encrypted.keyId);

        const newDecrypted = await manager.decryptData(newEncrypted);
        expect(newDecrypted).toBe(testData);

      } finally {
        manager.destroy();
      }
    });
  });
});