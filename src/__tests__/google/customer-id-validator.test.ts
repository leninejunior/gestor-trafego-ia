/**
 * Tests for Google Ads Customer ID Validator
 * 
 * Requirements: 3.2
 */

import {
  validateCustomerId,
  formatCustomerId,
  isValidCustomerId,
  validateCustomerIds,
  formatCustomerIds,
} from '@/lib/google/customer-id-validator';

describe('Customer ID Validator', () => {
  describe('validateCustomerId', () => {
    it('should validate a correct 10-digit customer ID', () => {
      const result = validateCustomerId('1234567890');
      
      expect(result.isValid).toBe(true);
      expect(result.formatted).toBe('1234567890');
      expect(result.errors).toHaveLength(0);
    });

    it('should validate and format a customer ID with dashes', () => {
      const result = validateCustomerId('123-456-7890');
      
      expect(result.isValid).toBe(true);
      expect(result.formatted).toBe('1234567890');
      expect(result.errors).toHaveLength(0);
    });

    it('should validate and format a customer ID with spaces', () => {
      const result = validateCustomerId('123 456 7890');
      
      expect(result.isValid).toBe(true);
      expect(result.formatted).toBe('1234567890');
      expect(result.errors).toHaveLength(0);
    });

    it('should reject an empty customer ID', () => {
      const result = validateCustomerId('');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Customer ID is required');
    });

    it('should reject a null customer ID', () => {
      const result = validateCustomerId(null);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Customer ID is required');
    });

    it('should reject an undefined customer ID', () => {
      const result = validateCustomerId(undefined);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Customer ID is required');
    });

    it('should reject a customer ID with less than 10 digits', () => {
      const result = validateCustomerId('123456789');
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('must be exactly 10 digits');
      expect(result.errors[0]).toContain('found 9');
    });

    it('should reject a customer ID with more than 10 digits', () => {
      const result = validateCustomerId('12345678901');
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('must be exactly 10 digits');
      expect(result.errors[0]).toContain('found 11');
    });

    it('should reject a customer ID with all zeros', () => {
      const result = validateCustomerId('0000000000');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Customer ID cannot be all zeros');
    });

    it('should reject a customer ID with letters', () => {
      const result = validateCustomerId('123ABC7890');
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('must be exactly 10 digits');
    });

    it('should handle customer ID with mixed formatting', () => {
      const result = validateCustomerId('123-456 7890');
      
      expect(result.isValid).toBe(true);
      expect(result.formatted).toBe('1234567890');
    });
  });

  describe('formatCustomerId', () => {
    it('should format a valid customer ID', () => {
      expect(formatCustomerId('1234567890')).toBe('1234567890');
    });

    it('should format a customer ID with dashes', () => {
      expect(formatCustomerId('123-456-7890')).toBe('1234567890');
    });

    it('should throw an error for invalid customer ID', () => {
      expect(() => formatCustomerId('123')).toThrow('Invalid customer ID');
    });

    it('should throw an error for empty customer ID', () => {
      expect(() => formatCustomerId('')).toThrow('Invalid customer ID');
    });
  });

  describe('isValidCustomerId', () => {
    it('should return true for valid customer ID', () => {
      expect(isValidCustomerId('1234567890')).toBe(true);
    });

    it('should return true for valid customer ID with dashes', () => {
      expect(isValidCustomerId('123-456-7890')).toBe(true);
    });

    it('should return false for invalid customer ID', () => {
      expect(isValidCustomerId('123')).toBe(false);
    });

    it('should return false for empty customer ID', () => {
      expect(isValidCustomerId('')).toBe(false);
    });

    it('should return false for null customer ID', () => {
      expect(isValidCustomerId(null)).toBe(false);
    });
  });

  describe('validateCustomerIds', () => {
    it('should validate multiple customer IDs', () => {
      const results = validateCustomerIds([
        '1234567890',
        '123-456-7890',
        '123',
        null,
      ]);

      expect(results).toHaveLength(4);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(true);
      expect(results[2].isValid).toBe(false);
      expect(results[3].isValid).toBe(false);
    });
  });

  describe('formatCustomerIds', () => {
    it('should format multiple customer IDs and skip invalid ones', () => {
      const formatted = formatCustomerIds([
        '1234567890',
        '123-456-7890',
        '123', // Invalid - too short
        null, // Invalid - null
        '987-654-3210',
      ]);

      expect(formatted).toEqual([
        '1234567890',
        '1234567890',
        '9876543210',
      ]);
    });

    it('should return empty array for all invalid customer IDs', () => {
      const formatted = formatCustomerIds([
        '123',
        null,
        '',
        undefined,
      ]);

      expect(formatted).toEqual([]);
    });
  });

  describe('Edge cases', () => {
    it('should handle customer ID with only dashes', () => {
      const result = validateCustomerId('----------');
      
      expect(result.isValid).toBe(false);
      expect(result.formatted).toBe('');
    });

    it('should handle customer ID with special characters', () => {
      const result = validateCustomerId('123@456#7890');
      
      expect(result.isValid).toBe(true);
      expect(result.formatted).toBe('1234567890');
    });

    it('should handle customer ID with leading zeros', () => {
      const result = validateCustomerId('0123456789');
      
      expect(result.isValid).toBe(true);
      expect(result.formatted).toBe('0123456789');
    });

    it('should preserve original value in result', () => {
      const original = '123-456-7890';
      const result = validateCustomerId(original);
      
      expect(result.original).toBe(original);
      expect(result.formatted).toBe('1234567890');
    });
  });
});
