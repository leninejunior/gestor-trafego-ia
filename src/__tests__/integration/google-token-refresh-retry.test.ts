/**
 * Integration tests for Google Ads Token Refresh Retry Logic
 * 
 * Tests the retry mechanism for token refresh failures
 * Requirements: Task 2.1 - Add retry logic for token refresh failures
 */

import { GoogleTokenManager } from '@/lib/google/token-manager';
import { getGoogleOAuthService } from '@/lib/google/oauth';
import { createServiceClient } from '@/lib/supabase/server';

// Mock the dependencies
jest.mock('@/lib/google/oauth');
jest.mock('@/lib/supabase/server');
jest.mock('@/lib/google/crypto-service', () => ({
  getGoogleAdsCryptoService: jest.fn(() => ({
    encryptToken: jest.fn().mockResolvedValue({
      encryptedData: 'encrypted-token',
      keyVersion: 1,
      algorithm: 'aes-256-gcm',
    }),
    decryptToken: jest.fn().mockResolvedValue({
      decryptedData: 'decrypted-token',
      keyVersion: 1,
    }),
  })),
}));
jest.mock('@/lib/google/audit-service', () => ({
  getGoogleAdsAuditService: jest.fn(() => ({
    logTokenOperation: jest.fn().mockResolvedValue(undefined),
    logEvent: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('Google Token Refresh Retry Logic', () => {
  let tokenManager: GoogleTokenManager;
  let mockOAuthService: any;
  let mockSupabase: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock OAuth service
    mockOAuthService = {
      refreshToken: jest.fn(),
      calculateExpirationDate: jest.fn((expiresIn: number) => {
        const date = new Date();
        date.setSeconds(date.getSeconds() + expiresIn);
        return date;
      }),
      isTokenExpired: jest.fn(),
    };

    (getGoogleOAuthService as jest.Mock).mockReturnValue(mockOAuthService);

    // Setup mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      select: jest.fn().mockReturnThis(),
    };

    (createServiceClient as jest.Mock).mockReturnValue(mockSupabase);

    // Create token manager instance
    tokenManager = new GoogleTokenManager();
  });

  describe('Retry Logic', () => {
    it('should succeed on first attempt when token refresh works', async () => {
      // Arrange
      const connectionId = 'test-connection-id';
      const refreshToken = '1//test-refresh-token';
      const newAccessToken = 'ya29.new-access-token';

      mockOAuthService.refreshToken.mockResolvedValueOnce({
        access_token: newAccessToken,
        refresh_token: refreshToken,
        expires_in: 3600,
        token_type: 'Bearer',
      });

      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Act
      const result = await tokenManager.refreshAccessToken(connectionId, refreshToken);

      // Assert
      expect(result.success).toBe(true);
      expect(result.accessToken).toBe(newAccessToken);
      expect(mockOAuthService.refreshToken).toHaveBeenCalledTimes(1);
    });

    it('should retry on transient failures and succeed on second attempt', async () => {
      // Arrange
      const connectionId = 'test-connection-id';
      const refreshToken = '1//test-refresh-token';
      const newAccessToken = 'ya29.new-access-token';

      // First attempt fails
      mockOAuthService.refreshToken
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({
          access_token: newAccessToken,
          refresh_token: refreshToken,
          expires_in: 3600,
          token_type: 'Bearer',
        });

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null,
      });

      // Act
      const result = await tokenManager.refreshAccessToken(connectionId, refreshToken);

      // Assert
      expect(result.success).toBe(true);
      expect(result.accessToken).toBe(newAccessToken);
      expect(mockOAuthService.refreshToken).toHaveBeenCalledTimes(2);
    });

    it('should retry up to MAX_RETRY_ATTEMPTS times before failing', async () => {
      // Arrange
      const connectionId = 'test-connection-id';
      const refreshToken = '1//test-refresh-token';

      // All attempts fail
      mockOAuthService.refreshToken.mockRejectedValue(new Error('Invalid refresh token'));

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null,
      });

      // Act
      const result = await tokenManager.refreshAccessToken(connectionId, refreshToken);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid refresh token'); // Error message from the last attempt
      expect(mockOAuthService.refreshToken).toHaveBeenCalledTimes(3); // MAX_RETRY_ATTEMPTS = 3
    });

    it('should mark connection as expired after all retries fail', async () => {
      // Arrange
      const connectionId = 'test-connection-id';
      const refreshToken = '1//test-refresh-token';

      mockOAuthService.refreshToken.mockRejectedValue(new Error('Invalid refresh token'));

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null,
      });

      // Act
      await tokenManager.refreshAccessToken(connectionId, refreshToken);

      // Assert
      // Verify that update was called to mark connection as expired
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'expired',
        })
      );
    });

    it('should use exponential backoff between retry attempts', async () => {
      // Arrange
      const connectionId = 'test-connection-id';
      const refreshToken = '1//test-refresh-token';
      const startTime = Date.now();

      // All attempts fail
      mockOAuthService.refreshToken.mockRejectedValue(new Error('Service unavailable'));

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null,
      });

      // Act
      await tokenManager.refreshAccessToken(connectionId, refreshToken);

      // Assert
      const totalDuration = Date.now() - startTime;
      
      // With exponential backoff:
      // Attempt 1: immediate
      // Delay 1: ~1000ms (1s * 2^0)
      // Attempt 2: after delay
      // Delay 2: ~2000ms (1s * 2^1)
      // Attempt 3: after delay
      // Total should be at least 3000ms (1000 + 2000)
      
      expect(totalDuration).toBeGreaterThanOrEqual(2500); // Allow some margin
      expect(mockOAuthService.refreshToken).toHaveBeenCalledTimes(3);
    });

    it('should succeed on third attempt after two failures', async () => {
      // Arrange
      const connectionId = 'test-connection-id';
      const refreshToken = '1//test-refresh-token';
      const newAccessToken = 'ya29.new-access-token';

      // First two attempts fail, third succeeds
      mockOAuthService.refreshToken
        .mockRejectedValueOnce(new Error('Temporary failure 1'))
        .mockRejectedValueOnce(new Error('Temporary failure 2'))
        .mockResolvedValueOnce({
          access_token: newAccessToken,
          refresh_token: refreshToken,
          expires_in: 3600,
          token_type: 'Bearer',
        });

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null,
      });

      // Act
      const result = await tokenManager.refreshAccessToken(connectionId, refreshToken);

      // Assert
      expect(result.success).toBe(true);
      expect(result.accessToken).toBe(newAccessToken);
      expect(mockOAuthService.refreshToken).toHaveBeenCalledTimes(3);
    });
  });

  describe('Retry Logging', () => {
    it('should log each retry attempt', async () => {
      // Arrange
      const connectionId = 'test-connection-id';
      const refreshToken = '1//test-refresh-token';
      const consoleSpy = jest.spyOn(console, 'log');

      mockOAuthService.refreshToken.mockRejectedValue(new Error('Test error'));

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null,
      });

      // Act
      await tokenManager.refreshAccessToken(connectionId, refreshToken);

      // Assert
      // Should log each attempt
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Refresh attempt 1/3'),
        expect.any(Object)
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Refresh attempt 2/3'),
        expect.any(Object)
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Refresh attempt 3/3'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });

    it('should log retry delays', async () => {
      // Arrange
      const connectionId = 'test-connection-id';
      const refreshToken = '1//test-refresh-token';
      const consoleSpy = jest.spyOn(console, 'log');

      mockOAuthService.refreshToken.mockRejectedValue(new Error('Test error'));

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null,
      });

      // Act
      await tokenManager.refreshAccessToken(connectionId, refreshToken);

      // Assert
      // Should log waiting messages
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Waiting before retry'),
        expect.objectContaining({
          retryDelayMs: expect.any(Number),
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should handle different error types during retry', async () => {
      // Arrange
      const connectionId = 'test-connection-id';
      const refreshToken = '1//test-refresh-token';

      // Different error types
      mockOAuthService.refreshToken
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new TypeError('Invalid response'))
        .mockRejectedValueOnce(new Error('Service unavailable'));

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null,
      });

      // Act
      const result = await tokenManager.refreshAccessToken(connectionId, refreshToken);

      // Assert
      expect(result.success).toBe(false);
      expect(mockOAuthService.refreshToken).toHaveBeenCalledTimes(3);
    });

    it('should preserve error message from last attempt', async () => {
      // Arrange
      const connectionId = 'test-connection-id';
      const refreshToken = '1//test-refresh-token';
      const lastErrorMessage = 'Final error message';

      mockOAuthService.refreshToken
        .mockRejectedValueOnce(new Error('First error'))
        .mockRejectedValueOnce(new Error('Second error'))
        .mockRejectedValueOnce(new Error(lastErrorMessage));

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null,
      });

      // Act
      const result = await tokenManager.refreshAccessToken(connectionId, refreshToken);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain(lastErrorMessage);
    });
  });
});
