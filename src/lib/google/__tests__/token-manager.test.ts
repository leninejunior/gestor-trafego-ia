/**
 * Token Manager Tests
 * 
 * Tests for Google Ads Token Manager functionality
 */

import { GoogleTokenManager } from '../token-manager';

describe('GoogleTokenManager', () => {
  let tokenManager: GoogleTokenManager;

  beforeEach(() => {
    tokenManager = new GoogleTokenManager();
  });

  describe('Encryption', () => {
    it('should encrypt and decrypt tokens correctly', async () => {
      const result = await tokenManager.testEncryption();
      expect(result).toBe(true);
    });

    it('should produce different encrypted values for same input', () => {
      const token = 'test-token-123';
      
      // Access private method for testing
      const encrypt = (tokenManager as any).encryptToken.bind(tokenManager);
      
      const encrypted1 = encrypt(token);
      const encrypted2 = encrypt(token);
      
      // Should be different due to random IV and salt
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should decrypt to original value', () => {
      const token = 'test-token-456';
      
      const encrypt = (tokenManager as any).encryptToken.bind(tokenManager);
      const decrypt = (tokenManager as any).decryptToken.bind(tokenManager);
      
      const encrypted = encrypt(token);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(token);
    });
  });

  describe('Token Expiration', () => {
    it('should detect expired tokens', () => {
      const pastDate = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      const isExpired = tokenManager.isTokenExpired(pastDate);
      expect(isExpired).toBe(true);
    });

    it('should detect tokens about to expire', () => {
      const soonDate = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes from now
      const isExpired = tokenManager.isTokenExpired(soonDate);
      expect(isExpired).toBe(true); // Should refresh with 5 min buffer
    });

    it('should not mark valid tokens as expired', () => {
      const futureDate = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
      const isExpired = tokenManager.isTokenExpired(futureDate);
      expect(isExpired).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid encrypted data gracefully', () => {
      const decrypt = (tokenManager as any).decryptToken.bind(tokenManager);
      
      expect(() => {
        decrypt('invalid-base64-data');
      }).toThrow('Failed to decrypt token');
    });

    it('should handle empty token gracefully', () => {
      const encrypt = (tokenManager as any).encryptToken.bind(tokenManager);
      
      const encrypted = encrypt('');
      const decrypt = (tokenManager as any).decryptToken.bind(tokenManager);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe('');
    });
  });
});
