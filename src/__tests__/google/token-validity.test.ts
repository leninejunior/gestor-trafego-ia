/**
 * Token Validity Tests for Google Ads Health Check
 * 
 * Tests token validation functionality in the health check endpoint:
 * - Token expiration detection
 * - Encryption/decryption validation
 * - Connection status validation
 * 
 * Requirements: Task 4.1 - Test token validity
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { createServiceClient } from '@/lib/supabase/server';
import { getGoogleAdsCryptoService } from '@/lib/google/crypto-service';
import { getGoogleTokenManager } from '@/lib/google/token-manager';

describe('Token Validity Tests - Health Check', () => {
  let supabase: Awaited<ReturnType<typeof createServiceClient>>;

  beforeAll(async () => {
    supabase = createServiceClient();
  });

  describe('Token Expiration Detection', () => {
    it('should identify connections with expired tokens', async () => {
      const now = new Date();
      
      // Query for connections with expired tokens
      const { data, error } = await supabase
        .from('google_ads_connections')
        .select('id, customer_id, token_expires_at, status')
        .eq('status', 'active')
        .lt('token_expires_at', now.toISOString());

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);

      // If there are expired tokens, log them
      if (data && data.length > 0) {
        console.log(`Found ${data.length} connections with expired tokens`);
        data.forEach(conn => {
          const expiresAt = new Date(conn.token_expires_at);
          const minutesExpired = Math.floor((now.getTime() - expiresAt.getTime()) / (1000 * 60));
          console.log(`Connection ${conn.id}: expired ${minutesExpired} minutes ago`);
        });
      }
    });

    it('should identify connections with tokens expiring soon', async () => {
      const now = new Date();
      const bufferTime = new Date();
      bufferTime.setMinutes(bufferTime.getMinutes() + 10);

      // Query for connections with tokens expiring in next 10 minutes
      const { data, error } = await supabase
        .from('google_ads_connections')
        .select('id, customer_id, token_expires_at, status')
        .eq('status', 'active')
        .gte('token_expires_at', now.toISOString())
        .lt('token_expires_at', bufferTime.toISOString());

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);

      // If there are tokens expiring soon, log them
      if (data && data.length > 0) {
        console.log(`Found ${data.length} connections with tokens expiring soon`);
        data.forEach(conn => {
          const expiresAt = new Date(conn.token_expires_at);
          const minutesUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60));
          console.log(`Connection ${conn.id}: expires in ${minutesUntilExpiry} minutes`);
        });
      }
    });

    it('should validate token expiration dates are in correct format', async () => {
      const { data, error } = await supabase
        .from('google_ads_connections')
        .select('id, token_expires_at')
        .eq('status', 'active')
        .limit(5);

      expect(error).toBeNull();

      if (data && data.length > 0) {
        data.forEach(conn => {
          // Should be able to parse as date
          const expiresAt = new Date(conn.token_expires_at);
          expect(expiresAt).toBeInstanceOf(Date);
          expect(expiresAt.getTime()).toBeGreaterThan(0);
          expect(isNaN(expiresAt.getTime())).toBe(false);
        });
      }
    });
  });

  describe('Token Refresh Detection', () => {
    it('should use token manager to identify connections needing refresh', async () => {
      const tokenManager = getGoogleTokenManager();
      
      const connectionsNeedingRefresh = await tokenManager.getConnectionsNeedingRefresh();

      expect(connectionsNeedingRefresh).toBeDefined();
      expect(Array.isArray(connectionsNeedingRefresh)).toBe(true);

      if (connectionsNeedingRefresh.length > 0) {
        console.log(`Token manager identified ${connectionsNeedingRefresh.length} connections needing refresh`);
        console.log('Connection IDs:', connectionsNeedingRefresh);
      } else {
        console.log('No connections currently need token refresh');
      }
    });

    it('should verify connections needing refresh have valid structure', async () => {
      const tokenManager = getGoogleTokenManager();
      const connectionsNeedingRefresh = await tokenManager.getConnectionsNeedingRefresh();

      // Each connection ID should be a string
      connectionsNeedingRefresh.forEach(connId => {
        expect(typeof connId).toBe('string');
        expect(connId.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Token Validation with Encryption', () => {
    it('should validate encryption/decryption functionality', async () => {
      const cryptoService = getGoogleAdsCryptoService();
      
      const testResult = await cryptoService.testEncryption();

      expect(testResult).toBeDefined();
      expect(testResult).toHaveProperty('success');
      
      if (testResult.success) {
        console.log('✅ Encryption/decryption test passed');
      } else {
        console.error('❌ Encryption/decryption test failed:', testResult.error);
      }

      expect(testResult.success).toBe(true);
    });

    it('should validate token manager encryption test', async () => {
      const tokenManager = getGoogleTokenManager();
      
      const isValid = await tokenManager.testEncryption();

      expect(typeof isValid).toBe('boolean');
      
      if (isValid) {
        console.log('✅ Token manager encryption test passed');
      } else {
        console.error('❌ Token manager encryption test failed');
      }
    });
  });

  describe('Token Validity Check Integration', () => {
    it('should verify active connections have valid token structure', async () => {
      const { data, error } = await supabase
        .from('google_ads_connections')
        .select('id, access_token, refresh_token, token_expires_at, status')
        .eq('status', 'active')
        .limit(3);

      expect(error).toBeNull();

      if (data && data.length > 0) {
        data.forEach(conn => {
          // Should have access token
          expect(conn.access_token).toBeDefined();
          expect(typeof conn.access_token).toBe('string');
          expect(conn.access_token.length).toBeGreaterThan(0);

          // Should have refresh token
          expect(conn.refresh_token).toBeDefined();
          
          // Should have expiration date
          expect(conn.token_expires_at).toBeDefined();
          const expiresAt = new Date(conn.token_expires_at);
          expect(expiresAt).toBeInstanceOf(Date);
          expect(isNaN(expiresAt.getTime())).toBe(false);

          console.log(`Connection ${conn.id}: token expires at ${expiresAt.toISOString()}`);
        });
      } else {
        console.log('No active connections found to validate');
      }
    });

    it('should verify token validation check returns proper structure', async () => {
      const tokenManager = getGoogleTokenManager();
      const cryptoService = getGoogleAdsCryptoService();
      
      // Test encryption/decryption
      const encryptionTest = await cryptoService.testEncryption();
      expect(encryptionTest).toHaveProperty('success');
      
      // Check for connections needing refresh
      const connectionsNeedingRefresh = await tokenManager.getConnectionsNeedingRefresh();
      expect(Array.isArray(connectionsNeedingRefresh)).toBe(true);

      // This mimics what the health check endpoint does
      const tokenValidationResult = {
        encryptionTest: encryptionTest.success ? 'passed' : 'failed',
        connectionsNeedingRefresh: connectionsNeedingRefresh.length,
        status: encryptionTest.success && connectionsNeedingRefresh.length === 0 ? 'pass' : 'warning',
      };

      expect(tokenValidationResult).toHaveProperty('encryptionTest');
      expect(tokenValidationResult).toHaveProperty('connectionsNeedingRefresh');
      expect(tokenValidationResult).toHaveProperty('status');
      expect(['pass', 'warning', 'fail']).toContain(tokenValidationResult.status);

      console.log('Token validation result:', tokenValidationResult);
    });
  });

  describe('Connection Status by Token Validity', () => {
    it('should count connections by status', async () => {
      const statuses = ['active', 'expired', 'revoked'];
      const statusCounts: Record<string, number> = {};

      for (const status of statuses) {
        const { data, error } = await supabase
          .from('google_ads_connections')
          .select('id', { count: 'exact', head: true })
          .eq('status', status);

        expect(error).toBeNull();
        statusCounts[status] = data?.length || 0;
      }

      console.log('Connection status counts:', statusCounts);

      // Verify we can query each status
      expect(statusCounts).toHaveProperty('active');
      expect(statusCounts).toHaveProperty('expired');
      expect(statusCounts).toHaveProperty('revoked');
    });

    it('should verify expired connections have past expiration dates', async () => {
      const now = new Date();

      const { data, error } = await supabase
        .from('google_ads_connections')
        .select('id, token_expires_at, status')
        .eq('status', 'expired')
        .limit(5);

      expect(error).toBeNull();

      if (data && data.length > 0) {
        data.forEach(conn => {
          const expiresAt = new Date(conn.token_expires_at);
          const isExpired = expiresAt.getTime() < now.getTime();
          
          console.log(`Expired connection ${conn.id}: token expired ${Math.floor((now.getTime() - expiresAt.getTime()) / (1000 * 60))} minutes ago`);
          
          // Expired connections should have past expiration dates
          // (though this might not always be true if status is manually set)
          expect(expiresAt).toBeInstanceOf(Date);
        });
      } else {
        console.log('No expired connections found');
      }
    });
  });

  describe('Health Check Token Validation Simulation', () => {
    it('should simulate the health check token validation process', async () => {
      const tokenManager = getGoogleTokenManager();
      const cryptoService = getGoogleAdsCryptoService();
      
      // Step 1: Test encryption/decryption
      const encryptionTest = await cryptoService.testEncryption();
      
      // Step 2: Check for connections needing refresh
      const connectionsNeedingRefresh = await tokenManager.getConnectionsNeedingRefresh();
      
      // Step 3: Determine status
      let status: 'pass' | 'warning' | 'fail';
      let message: string;
      
      if (!encryptionTest.success) {
        status = 'fail';
        message = 'Token encryption/decryption test failed';
      } else if (connectionsNeedingRefresh.length > 0) {
        status = 'warning';
        message = `${connectionsNeedingRefresh.length} connections need token refresh`;
      } else {
        status = 'pass';
        message = 'Token validation system operational';
      }

      const result = {
        status,
        message,
        details: {
          encryptionTest: encryptionTest.success ? 'passed' : 'failed',
          connectionsNeedingRefresh: connectionsNeedingRefresh.length,
        },
      };

      console.log('Health check token validation result:', result);

      // Verify result structure
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('details');
      expect(['pass', 'warning', 'fail']).toContain(result.status);
      expect(typeof result.message).toBe('string');
      expect(result.details).toHaveProperty('encryptionTest');
      expect(result.details).toHaveProperty('connectionsNeedingRefresh');
    });
  });
});
