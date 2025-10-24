import { it } from 'node:test';
import { it } from 'node:test';
import { afterEach } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { afterEach } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { describe } from 'node:test';
import { CredentialsManager } from '../domain/services/credentials-manager';
import { WebhookSecurity } from '../domain/services/webhook-security';
import { EncryptionService } from '../infrastructure/security/encryption.service';

// Mock environment config for tests
jest.mock('../infrastructure/config/environment', () => ({
  config: {
    security: {
      encryptionKey: 'test-encryption-key-for-testing-purposes-32-chars'
    }
  }
}));

describe('Core Fixes Validation', () => {
  describe('CredentialsManager - Crypto Fix', () => {
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

    it('should encrypt and decrypt data using fixed crypto methods', async () => {
      const testData = 'sensitive-api-key-12345';
      
      const encrypted = await credentialsManager.encrypt(testData);
      expect(encrypted.data).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.keyId).toBeDefined();
      expect(encrypted.algorithm).toBe('aes-256-gcm');
      // authTag is available in GCM mode
      expect(encrypted.authTag).toBeDefined();

      const decrypted = await credentialsManager.decrypt(encrypted);
      expect(decrypted).toBe(testData);
    });

    it('should handle credentials encryption correctly', async () => {
      const credentials = {
        apiKey: 'sk_test_12345',
        secretKey: 'secret_67890'
      };

      const encrypted = await credentialsManager.encryptCredentials(credentials);
      expect(Object.keys(encrypted)).toEqual(Object.keys(credentials));
      
      const decrypted = await credentialsManager.decryptCredentials(encrypted);
      expect(decrypted).toEqual(credentials);
    });
  });

  describe('WebhookSecurity - HMAC Validation Fix', () => {
    let webhookSecurity: WebhookSecurity;

    beforeEach(() => {
      webhookSecurity = new WebhookSecurity();
    });

    it('should validate HMAC signature correctly', () => {
      const payload = '{"event": "payment.completed", "id": "12345"}';
      const secret = 'webhook-secret-key';
      const config = {
        algorithm: 'sha256' as const,
        signatureFormat: 'hex' as const,
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
      const config = {
        algorithm: 'sha256' as const,
        signatureFormat: 'hex' as const,
        signaturePrefix: 'sha256=',
        signatureHeader: 'x-signature'
      };

      const result = webhookSecurity.validateHmacSignature(payload, invalidSignature, secret, config);

      expect(result.isValid).toBe(false);
      expect(result.reason).toMatch(/Invalid signature length|Signature mismatch|Signature validation error/);
    });
  });

  describe('EncryptionService - Crypto Fix', () => {
    let encryptionService: EncryptionService;

    beforeEach(() => {
      encryptionService = new EncryptionService();
    });

    afterEach(() => {
      encryptionService.destroy();
    });

    it('should encrypt and decrypt data correctly with fixed methods', () => {
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
  });
});