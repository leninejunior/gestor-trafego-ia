import { Validator } from '../domain/validation/validator';
import { PaymentRequestSchema, SubscriptionRequestSchema } from '../domain/validation/schemas';
import { PaymentError, PaymentErrorType, Currency, BillingInterval } from '../domain/types';

describe('Business Logic Tests', () => {
  describe('Payment Validation', () => {
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

    it('should reject invalid payment amount', () => {
      const invalidRequest = {
        amount: -100,
        currency: Currency.BRL,
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
  });

  describe('Subscription Validation', () => {
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
        billingInterval: 'INVALID' as any
      };

      expect(() => Validator.validate(SubscriptionRequestSchema, invalidRequest))
        .toThrow(PaymentError);
    });
  });

  describe('Data Sanitization', () => {
    it('should sanitize dangerous strings', () => {
      const dangerousString = '<script>alert("xss")</script>';
      const sanitized = Validator.sanitizeString(dangerousString);

      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
    });

    it('should validate email format', () => {
      expect(Validator.validateEmail('test@example.com')).toBe(true);
      expect(Validator.validateEmail('invalid-email')).toBe(false);
    });

    it('should validate URL format', () => {
      expect(Validator.validateUrl('https://example.com')).toBe(true);
      expect(Validator.validateUrl('not-a-url')).toBe(false);
    });

    it('should validate UUID format', () => {
      expect(Validator.validateUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(Validator.validateUuid('not-a-uuid')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should create PaymentError with correct properties', () => {
      const error = new PaymentError(
        PaymentErrorType.VALIDATION_ERROR,
        'Test error message',
        { originalError: 'details' },
        false,
        'test-provider'
      );

      expect(error.type).toBe(PaymentErrorType.VALIDATION_ERROR);
      expect(error.message).toBe('Test error message');
      expect(error.retryable).toBe(false);
      expect(error.providerName).toBe('test-provider');
    });

    it('should handle validation errors correctly', () => {
      try {
        Validator.validate(PaymentRequestSchema, { invalid: 'data' });
      } catch (error) {
        expect(error).toBeInstanceOf(PaymentError);
        expect((error as PaymentError).type).toBe(PaymentErrorType.VALIDATION_ERROR);
      }
    });
  });

  describe('Safe Parsing', () => {
    it('should return success for valid data', () => {
      const validData = {
        amount: 1000,
        currency: Currency.BRL,
        organizationId: '123e4567-e89b-12d3-a456-426614174000'
      };

      const result = Validator.safeParse(PaymentRequestSchema, validData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validData);
      expect(result.error).toBeUndefined();
    });

    it('should return error for invalid data', () => {
      const invalidData = { amount: -100 };

      const result = Validator.safeParse(PaymentRequestSchema, invalidData);

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBeDefined();
    });
  });

  describe('Metadata Validation', () => {
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

    it('should sanitize string values in metadata', () => {
      const metadataWithDangerousStrings = {
        description: '<script>alert("xss")</script>',
        note: 'javascript:alert("malicious")'
      };

      const result = Validator.validateMetadata(metadataWithDangerousStrings);

      expect(result.description).not.toContain('<script>');
      expect(result.note).not.toContain('javascript:');
    });

    it('should remove invalid value types from metadata', () => {
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

  describe('Credentials Schema Creation', () => {
    it('should create schema with required fields', () => {
      const requiredFields = ['apiKey', 'secretKey'];
      const schema = Validator.createCredentialsSchema(requiredFields);

      const validCredentials = {
        apiKey: 'api_123',
        secretKey: 'secret_456'
      };

      const result = Validator.validate(schema, validCredentials);
      expect(result).toEqual(validCredentials);
    });

    it('should reject credentials with empty values', () => {
      const requiredFields = ['apiKey'];
      const schema = Validator.createCredentialsSchema(requiredFields);

      const invalidCredentials = {
        apiKey: ''
      };

      expect(() => Validator.validate(schema, invalidCredentials))
        .toThrow(PaymentError);
    });
  });
});