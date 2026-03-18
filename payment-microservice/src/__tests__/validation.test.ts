import { Validator } from '../domain/validation/validator';
import {
  PaymentRequestSchema,
  SubscriptionRequestSchema,
  ProviderConfigSchema,
  RefundRequestSchema,
  WebhookPayloadSchema
} from '../domain/validation/schemas';
import { PaymentError, PaymentErrorType, Currency, BillingInterval } from '../domain/types';
import { z } from 'zod';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { describe } from 'node:test';

describe('Validator', () => {
  describe('validate', () => {
    it('should validate correct data successfully', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().positive()
      });

      const validData = { name: 'John', age: 30 };
      const result = Validator.validate(schema, validData);

      expect(result).toEqual(validData);
    });

    it('should throw PaymentError for invalid data', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().positive()
      });

      const invalidData = { name: 'John', age: -5 };

      expect(() => Validator.validate(schema, invalidData))
        .toThrow(PaymentError);

      try {
        Validator.validate(schema, invalidData);
      } catch (error) {
        expect(error).toBeInstanceOf(PaymentError);
        expect((error as PaymentError).type).toBe(PaymentErrorType.VALIDATION_ERROR);
        expect((error as PaymentError).message).toContain('age: Number must be greater than 0');
      }
    });

    it('should handle missing required fields', () => {
      const schema = z.object({
        name: z.string(),
        email: z.string().email()
      });

      const invalidData = { name: 'John' };

      expect(() => Validator.validate(schema, invalidData))
        .toThrow(PaymentError);

      try {
        Validator.validate(schema, invalidData);
      } catch (error) {
        expect((error as PaymentError).message).toContain('email: Required');
      }
    });
  });

  describe('validateAsync', () => {
    it('should validate data asynchronously', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number()
      });

      const validData = { name: 'Jane', age: 25 };
      const result = await Validator.validateAsync(schema, validData);

      expect(result).toEqual(validData);
    });

    it('should throw PaymentError for invalid async validation', async () => {
      const schema = z.object({
        email: z.string().email()
      });

      const invalidData = { email: 'invalid-email' };

      await expect(Validator.validateAsync(schema, invalidData))
        .rejects.toThrow(PaymentError);
    });
  });

  describe('safeParse', () => {
    it('should return success result for valid data', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number()
      });

      const validData = { name: 'Bob', age: 40 };
      const result = Validator.safeParse(schema, validData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validData);
      expect(result.error).toBeUndefined();
    });

    it('should return error result for invalid data', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().positive()
      });

      const invalidData = { name: 'Bob', age: -10 };
      const result = Validator.safeParse(schema, invalidData);

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toContain('age: Number must be greater than 0');
    });
  });

  describe('validateMany', () => {
    it('should validate array of valid objects', () => {
      const schema = z.object({
        id: z.number(),
        name: z.string()
      });

      const validArray = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' }
      ];

      const result = Validator.validateMany(schema, validArray);

      expect(result).toHaveLength(2);
      expect(result).toEqual(validArray);
    });

    it('should throw error with item index for invalid data', () => {
      const schema = z.object({
        id: z.number(),
        name: z.string()
      });

      const invalidArray = [
        { id: 1, name: 'Item 1' },
        { id: 'invalid', name: 'Item 2' }
      ];

      expect(() => Validator.validateMany(schema, invalidArray))
        .toThrow(PaymentError);

      try {
        Validator.validateMany(schema, invalidArray);
      } catch (error) {
        expect((error as PaymentError).message).toContain('Item 1:');
      }
    });
  });

  describe('createCredentialsSchema', () => {
    it('should create schema with required fields', () => {
      const requiredFields = ['apiKey', 'secretKey', 'webhookSecret'];
      const schema = Validator.createCredentialsSchema(requiredFields);

      const validCredentials = {
        apiKey: 'api_123',
        secretKey: 'secret_456',
        webhookSecret: 'webhook_789'
      };

      const result = Validator.validate(schema, validCredentials);
      expect(result).toEqual(validCredentials);
    });

    it('should reject credentials missing required fields', () => {
      const requiredFields = ['apiKey', 'secretKey'];
      const schema = Validator.createCredentialsSchema(requiredFields);

      const invalidCredentials = {
        apiKey: 'api_123'
        // missing secretKey
      };

      expect(() => Validator.validate(schema, invalidCredentials))
        .toThrow(PaymentError);
    });

    it('should reject empty string values', () => {
      const requiredFields = ['apiKey'];
      const schema = Validator.createCredentialsSchema(requiredFields);

      const invalidCredentials = {
        apiKey: ''
      };

      expect(() => Validator.validate(schema, invalidCredentials))
        .toThrow(PaymentError);
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'admin+tag@company.org'
      ];

      validEmails.forEach(email => {
        expect(Validator.validateEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user..name@domain.com'
      ];

      invalidEmails.forEach(email => {
        expect(Validator.validateEmail(email)).toBe(false);
      });
    });
  });

  describe('validateUrl', () => {
    it('should validate correct URLs', () => {
      const validUrls = [
        'https://example.com',
        'http://localhost:3000',
        'https://api.stripe.com/v1/webhooks'
      ];

      validUrls.forEach(url => {
        expect(Validator.validateUrl(url)).toBe(true);
      });
    });

    it('should reject invalid URLs', () => {
      const invalidUrls = [
        'not-a-url',
        'example.com',
        'http://',
        'javascript:alert(1)'
      ];

      invalidUrls.forEach(url => {
        expect(Validator.validateUrl(url)).toBe(false);
      });
    });
  });

  describe('validateUuid', () => {
    it('should validate correct UUIDs', () => {
      const validUuids = [
        '123e4567-e89b-12d3-a456-426614174000',
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
      ];

      validUuids.forEach(uuid => {
        expect(Validator.validateUuid(uuid)).toBe(true);
      });
    });

    it('should reject invalid UUIDs', () => {
      const invalidUuids = [
        'not-a-uuid',
        '123e4567-e89b-12d3-a456',
        '123e4567-e89b-12d3-a456-426614174000-extra'
      ];

      invalidUuids.forEach(uuid => {
        expect(Validator.validateUuid(uuid)).toBe(false);
      });
    });
  });

  describe('sanitizeString', () => {
    it('should remove dangerous characters', () => {
      const dangerousString = '<script>alert("xss")</script>';
      const sanitized = Validator.sanitizeString(dangerousString);

      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
      expect(sanitized).toBe('scriptalert("xss")/script');
    });

    it('should remove javascript: protocol', () => {
      const dangerousString = 'javascript:alert("xss")';
      const sanitized = Validator.sanitizeString(dangerousString);

      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).toBe('alert("xss")');
    });

    it('should remove event handlers', () => {
      const dangerousString = 'onclick=alert("xss") onload=malicious()';
      const sanitized = Validator.sanitizeString(dangerousString);

      expect(sanitized).not.toContain('onclick=');
      expect(sanitized).not.toContain('onload=');
    });

    it('should trim whitespace', () => {
      const stringWithWhitespace = '  normal string  ';
      const sanitized = Validator.sanitizeString(stringWithWhitespace);

      expect(sanitized).toBe('normal string');
    });
  });

  describe('validateMetadata', () => {
    it('should keep valid metadata', () => {
      const validMetadata = {
        orderId: 'order_123',
        amount: 1000,
        isTest: true,
        description: 'Test payment',
        nullValue: null
      };

      const result = Validator.validateMetadata(validMetadata);

      expect(result).toEqual(validMetadata);
    });

    it('should sanitize string values', () => {
      const metadataWithDangerousStrings = {
        description: '<script>alert("xss")</script>',
        note: 'javascript:alert("malicious")'
      };

      const result = Validator.validateMetadata(metadataWithDangerousStrings);

      expect(result.description).not.toContain('<script>');
      expect(result.note).not.toContain('javascript:');
    });

    it('should remove invalid key types', () => {
      const metadataWithInvalidKeys = {
        validKey: 'valid value',
        '': 'empty key should be removed',
        ['a'.repeat(101)]: 'key too long should be removed'
      };

      const result = Validator.validateMetadata(metadataWithInvalidKeys);

      expect(result).toEqual({
        validKey: 'valid value'
      });
    });

    it('should remove invalid value types', () => {
      const metadataWithInvalidValues = {
        validString: 'valid',
        validNumber: 123,
        validBoolean: true,
        validNull: null,
        invalidObject: { nested: 'object' },
        invalidArray: [1, 2, 3],
        invalidFunction: () => 'function'
      };

      const result = Validator.validateMetadata(metadataWithInvalidValues);

      expect(result).toEqual({
        validString: 'valid',
        validNumber: 123,
        validBoolean: true,
        validNull: null
      });
    });
  });
});

describe('Validation Schemas', () => {
  describe('PaymentRequestSchema', () => {
    it('should validate correct payment request', () => {
      const validRequest = {
        amount: 1000,
        currency: Currency.BRL,
        organizationId: '123e4567-e89b-12d3-a456-426614174000',
        description: 'Test payment'
      };

      const result = Validator.validate(PaymentRequestSchema, validRequest);
      expect(result).toEqual(validRequest);
    });

    it('should reject negative amount', () => {
      const invalidRequest = {
        amount: -100,
        currency: Currency.BRL,
        organizationId: '123e4567-e89b-12d3-a456-426614174000'
      };

      expect(() => Validator.validate(PaymentRequestSchema, invalidRequest))
        .toThrow(PaymentError);
    });

    it('should reject invalid currency', () => {
      const invalidRequest = {
        amount: 1000,
        currency: 'INVALID',
        organizationId: '123e4567-e89b-12d3-a456-426614174000'
      };

      expect(() => Validator.validate(PaymentRequestSchema, invalidRequest))
        .toThrow(PaymentError);
    });

    it('should reject invalid organization ID', () => {
      const invalidRequest = {
        amount: 1000,
        currency: Currency.BRL,
        organizationId: 'not-a-uuid'
      };

      expect(() => Validator.validate(PaymentRequestSchema, invalidRequest))
        .toThrow(PaymentError);
    });

    it('should reject description that is too long', () => {
      const invalidRequest = {
        amount: 1000,
        currency: Currency.BRL,
        organizationId: '123e4567-e89b-12d3-a456-426614174000',
        description: 'a'.repeat(501)
      };

      expect(() => Validator.validate(PaymentRequestSchema, invalidRequest))
        .toThrow(PaymentError);
    });
  });

  describe('SubscriptionRequestSchema', () => {
    it('should validate correct subscription request', () => {
      const validRequest = {
        customerId: 'cus_123',
        organizationId: '123e4567-e89b-12d3-a456-426614174000',
        planId: 'plan_basic',
        amount: 2999,
        currency: 'BRL',
        billingInterval: BillingInterval.MONTHLY
      };

      const result = Validator.validate(SubscriptionRequestSchema, validRequest);
      expect(result).toEqual(validRequest);
    });

    it('should reject invalid billing interval', () => {
      const invalidRequest = {
        customerId: 'cus_123',
        organizationId: '123e4567-e89b-12d3-a456-426614174000',
        planId: 'plan_basic',
        amount: 2999,
        currency: 'BRL',
        billingInterval: 'INVALID'
      };

      expect(() => Validator.validate(SubscriptionRequestSchema, invalidRequest))
        .toThrow(PaymentError);
    });

    it('should validate optional trial period', () => {
      const validRequest = {
        customerId: 'cus_123',
        organizationId: '123e4567-e89b-12d3-a456-426614174000',
        planId: 'plan_basic',
        amount: 2999,
        currency: 'BRL',
        billingInterval: BillingInterval.MONTHLY,
        trialPeriodDays: 14
      };

      const result = Validator.validate(SubscriptionRequestSchema, validRequest);
      expect(result.trialPeriodDays).toBe(14);
    });

    it('should reject invalid trial period', () => {
      const invalidRequest = {
        customerId: 'cus_123',
        organizationId: '123e4567-e89b-12d3-a456-426614174000',
        planId: 'plan_basic',
        amount: 2999,
        currency: 'BRL',
        billingInterval: BillingInterval.MONTHLY,
        trialPeriodDays: 400 // Too many days
      };

      expect(() => Validator.validate(SubscriptionRequestSchema, invalidRequest))
        .toThrow(PaymentError);
    });
  });

  describe('ProviderConfigSchema', () => {
    it('should validate correct provider config', () => {
      const validConfig = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'stripe',
        isActive: true,
        priority: 1,
        credentials: {
          secretKey: 'sk_mock_123',
          webhookSecret: 'whsec_123'
        },
        settings: {
          timeout: 30000
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = Validator.validate(ProviderConfigSchema, validConfig);
      expect(result).toEqual(validConfig);
    });

    it('should reject empty credentials', () => {
      const invalidConfig = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'stripe',
        isActive: true,
        priority: 1,
        credentials: {},
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(() => Validator.validate(ProviderConfigSchema, invalidConfig))
        .toThrow(PaymentError);
    });

    it('should reject negative priority', () => {
      const invalidConfig = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'stripe',
        isActive: true,
        priority: -1,
        credentials: { key: 'value' },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(() => Validator.validate(ProviderConfigSchema, invalidConfig))
        .toThrow(PaymentError);
    });
  });

  describe('WebhookPayloadSchema', () => {
    it('should validate correct webhook payload', () => {
      const validPayload = {
        id: 'evt_123',
        type: 'payment.succeeded',
        data: {
          object: {
            id: 'pi_123',
            status: 'succeeded'
          }
        },
        created: 1234567890
      };

      const result = Validator.validate(WebhookPayloadSchema, validPayload);
      expect(result).toEqual(validPayload);
    });

    it('should accept different created formats', () => {
      const payloadWithStringCreated = {
        id: 'evt_123',
        type: 'payment.succeeded',
        data: { object: {} },
        created: '2023-01-01T00:00:00Z'
      };

      const payloadWithDateCreated = {
        id: 'evt_123',
        type: 'payment.succeeded',
        data: { object: {} },
        created: new Date()
      };

      expect(() => Validator.validate(WebhookPayloadSchema, payloadWithStringCreated))
        .not.toThrow();
      expect(() => Validator.validate(WebhookPayloadSchema, payloadWithDateCreated))
        .not.toThrow();
    });

    it('should reject missing required fields', () => {
      const invalidPayload = {
        id: 'evt_123',
        // missing type
        data: { object: {} },
        created: 1234567890
      };

      expect(() => Validator.validate(WebhookPayloadSchema, invalidPayload))
        .toThrow(PaymentError);
    });
  });
});