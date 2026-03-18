/**
 * Tests for features validation in admin plans API
 * Validates that features are always handled as arrays
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/admin/plans/route';

// Mock dependencies
jest.mock('@/lib/supabase/server');
jest.mock('@/lib/middleware/admin-auth-improved');

const mockCreateClient = jest.fn();
const mockCheckAdminAuth = jest.fn();

// Mock modules
require('@/lib/supabase/server').createClient = mockCreateClient;
require('@/lib/middleware/admin-auth-improved').checkAdminAuth = mockCheckAdminAuth;
require('@/lib/middleware/admin-auth-improved').createAdminAuthErrorResponse = jest.fn();

describe('Admin Plans API - Features Validation', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn()
    };
    mockCreateClient.mockResolvedValue(mockSupabase);
    mockCheckAdminAuth.mockResolvedValue({
      success: true,
      user: { id: 'admin-123' }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/plans', () => {
    it('should handle array features correctly', async () => {
      // Arrange
      const mockPlans = [{
        id: 'plan-1',
        name: 'Basic Plan',
        features: ['feature1', 'feature2'], // Already an array
        monthly_price: 29.99,
        annual_price: 299.99,
        max_clients: 5,
        max_campaigns: 25
      }];

      mockSupabase.select.mockResolvedValue({
        data: mockPlans,
        error: null
      });

      const request = new NextRequest('http://localhost/api/admin/plans');

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.plans[0].features).toEqual(['feature1', 'feature2']);
    });

    it('should handle non-array features with warning', async () => {
      // Arrange
      const mockPlans = [{
        id: 'plan-1',
        name: 'Basic Plan',
        features: 'invalid-string-feature', // Invalid string type
        monthly_price: 29.99,
        annual_price: 299.99,
        max_clients: 5,
        max_campaigns: 25
      }];

      mockSupabase.select.mockResolvedValue({
        data: mockPlans,
        error: null
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const request = new NextRequest('http://localhost/api/admin/plans');

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.plans[0].features).toEqual([]); // Fallback to empty array
      expect(consoleSpy).toHaveBeenCalledWith(
        'Unexpected features data type:',
        'string',
        'invalid-string-feature'
      );

      consoleSpy.mockRestore();
    });

    it('should handle null features gracefully', async () => {
      // Arrange
      const mockPlans = [{
        id: 'plan-1',
        name: 'Basic Plan',
        features: null, // Null features
        monthly_price: 29.99,
        annual_price: 299.99,
        max_clients: 5,
        max_campaigns: 25
      }];

      mockSupabase.select.mockResolvedValue({
        data: mockPlans,
        error: null
      });

      const request = new NextRequest('http://localhost/api/admin/plans');

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.plans[0].features).toEqual([]); // Fallback to empty array
    });
  });

  describe('POST /api/admin/plans', () => {
    beforeEach(() => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    });

    it('should accept valid array features', async () => {
      // Arrange
      const validPlan = {
        name: 'Test Plan',
        description: 'Test Description',
        features: ['feature1', 'feature2'], // Valid array
        monthly_price: 29.99,
        limits: { max_clients: 5 }
      };

      mockSupabase.single.mockResolvedValue({
        data: { id: 'plan-123', ...validPlan },
        error: null
      });

      const request = new NextRequest('http://localhost/api/admin/plans', {
        method: 'POST',
        body: JSON.stringify(validPlan)
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          features: ['feature1', 'feature2']
        })
      );
    });

    it('should reject non-array features', async () => {
      // Arrange
      const invalidPlan = {
        name: 'Test Plan',
        description: 'Test Description',
        features: 'invalid-string', // Invalid string type
        monthly_price: 29.99
      };

      const request = new NextRequest('http://localhost/api/admin/plans', {
        method: 'POST',
        body: JSON.stringify(invalidPlan)
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Features must be an array of strings');
    });

    it('should handle missing features as empty array', async () => {
      // Arrange
      const planWithoutFeatures = {
        name: 'Test Plan',
        description: 'Test Description',
        monthly_price: 29.99
        // No features property
      };

      mockSupabase.single.mockResolvedValue({
        data: { id: 'plan-123', ...planWithoutFeatures },
        error: null
      });

      const request = new NextRequest('http://localhost/api/admin/plans', {
        method: 'POST',
        body: JSON.stringify(planWithoutFeatures)
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          features: [] // Should default to empty array
        })
      );
    });

    it('should reject object features', async () => {
      // Arrange
      const invalidPlan = {
        name: 'Test Plan',
        description: 'Test Description',
        features: { feature1: true, feature2: false }, // Invalid object type
        monthly_price: 29.99
      };

      const request = new NextRequest('http://localhost/api/admin/plans', {
        method: 'POST',
        body: JSON.stringify(invalidPlan)
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Features must be an array of strings');
    });
  });
});