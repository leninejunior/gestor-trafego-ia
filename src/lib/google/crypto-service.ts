/**
 * Google Ads Cryptography Service
 * 
 * Handles encryption/decryption of sensitive tokens with key rotation support
 * Requirements: 1.1, 1.3
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface EncryptionResult {
  encryptedData: string;
  keyVersion: number;
  algorithm: string;
}

export interface DecryptionResult {
  decryptedData: string;
  keyVersion: number;
}

export interface EncryptionKey {
  id: string;
  version: number;
  key: string;
  algorithm: string;
  createdAt: Date;
  isActive: boolean;
}

// ============================================================================
// Cryptography Service Class
// ============================================================================

export class GoogleAdsCryptoService {
  // Encryption configuration
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly IV_LENGTH = 16;
  private readonly SALT_LENGTH = 32;
  private readonly TAG_LENGTH = 16;
  private readonly KEY_LENGTH = 32;
  
  // Key rotation settings
  private readonly KEY_ROTATION_DAYS = 90; // Rotate keys every 90 days
  private readonly MAX_KEY_VERSIONS = 5; // Keep last 5 key versions for decryption
  
  // Cache for encryption keys
  private keyCache: Map<number, Buffer> = new Map();
  private currentKeyVersion: number | null = null;

  constructor() {
    this.initializeKeyRotation();
  }

  // ==========================================================================
  // Key Management
  // ==========================================================================

  /**
   * Initialize key rotation system
   */
  private async initializeKeyRotation(): Promise<void> {
    try {
      // Check if we have a current active key
      const activeKey = await this.getCurrentEncryptionKey();
      
      if (!activeKey || this.isKeyExpired(activeKey)) {
        console.log('[Crypto Service] No active key found or key expired, generating new key');
        await this.rotateEncryptionKey();
      } else {
        this.currentKeyVersion = activeKey.version;
        console.log('[Crypto Service] Using existing active key version:', activeKey.version);
      }
    } catch (error) {
      console.error('[Crypto Service] Error initializing key rotation:', error);
      // Fallback to environment key if database keys fail
      this.currentKeyVersion = 0;
    }
  }

  /**
   * Get current active encryption key from database
   */
  private async getCurrentEncryptionKey(): Promise<EncryptionKey | null> {
    try {
      const supabase = createServiceClient();
      
      const { data, error } = await supabase
        .from('google_ads_encryption_keys')
        .select('*')
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id,
        version: data.version,
        key: data.key_hash, // This is actually the encrypted key
        algorithm: data.algorithm,
        createdAt: new Date(data.created_at),
        isActive: data.is_active,
      };
    } catch (error) {
      console.error('[Crypto Service] Error getting current encryption key:', error);
      return null;
    }
  }

  /**
   * Check if encryption key is expired
   */
  private isKeyExpired(key: EncryptionKey): boolean {
    const expirationDate = new Date(key.createdAt);
    expirationDate.setDate(expirationDate.getDate() + this.KEY_ROTATION_DAYS);
    return new Date() > expirationDate;
  }

  /**
   * Generate new encryption key and rotate
   */
  async rotateEncryptionKey(): Promise<void> {
    try {
      console.log('[Crypto Service] Starting key rotation...');
      
      // Generate new key
      const newKey = randomBytes(this.KEY_LENGTH);
      const newVersion = await this.getNextKeyVersion();
      
      // Encrypt the key itself using master key
      const encryptedKey = this.encryptKeyWithMaster(newKey);
      
      const supabase = createServiceClient();
      
      // Deactivate current active key
      await supabase
        .from('google_ads_encryption_keys')
        .update({ is_active: false })
        .eq('is_active', true);

      // Insert new active key
      const { error } = await supabase
        .from('google_ads_encryption_keys')
        .insert({
          version: newVersion,
          key_hash: encryptedKey,
          algorithm: this.ALGORITHM,
          is_active: true,
          created_at: new Date().toISOString(),
        });

      if (error) {
        throw error;
      }

      // Update cache
      this.keyCache.set(newVersion, newKey);
      this.currentKeyVersion = newVersion;
      
      // Clean up old keys
      await this.cleanupOldKeys();
      
      console.log('[Crypto Service] Key rotation completed. New version:', newVersion);
    } catch (error) {
      console.error('[Crypto Service] Error during key rotation:', error);
      throw new Error('Failed to rotate encryption key');
    }
  }

  /**
   * Get next key version number
   */
  private async getNextKeyVersion(): Promise<number> {
    try {
      const supabase = createServiceClient();
      
      const { data, error } = await supabase
        .from('google_ads_encryption_keys')
        .select('version')
        .order('version', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return 1; // First key
      }

      return data.version + 1;
    } catch (error) {
      console.error('[Crypto Service] Error getting next key version:', error);
      return 1;
    }
  }

  /**
   * Encrypt key with master key from environment
   */
  private encryptKeyWithMaster(key: Buffer): string {
    const masterKey = this.getMasterKey();
    const salt = randomBytes(this.SALT_LENGTH);
    const iv = randomBytes(this.IV_LENGTH);
    
    const derivedKey = scryptSync(masterKey, salt, this.KEY_LENGTH);
    const cipher = createCipheriv(this.ALGORITHM, derivedKey, iv);
    
    let encrypted = cipher.update(key, null, 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    const combined = Buffer.concat([
      salt,
      iv,
      authTag,
      Buffer.from(encrypted, 'hex')
    ]);

    return combined.toString('base64');
  }

  /**
   * Decrypt key with master key from environment
   */
  private decryptKeyWithMaster(encryptedKey: string): Buffer {
    const masterKey = this.getMasterKey();
    const combined = Buffer.from(encryptedKey, 'base64');

    const salt = combined.subarray(0, this.SALT_LENGTH);
    const iv = combined.subarray(this.SALT_LENGTH, this.SALT_LENGTH + this.IV_LENGTH);
    const authTag = combined.subarray(
      this.SALT_LENGTH + this.IV_LENGTH,
      this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH
    );
    const encrypted = combined.subarray(this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH);

    const derivedKey = scryptSync(masterKey, salt, this.KEY_LENGTH);
    const decipher = createDecipheriv(this.ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted.toString('hex'), 'hex');
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted;
  }

  /**
   * Get master key from environment with fallback
   */
  private getMasterKey(): string {
    const masterKey = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || 
                     process.env.SUPABASE_SERVICE_ROLE_KEY ||
                     'fallback-master-key-not-secure';

    if (masterKey === 'fallback-master-key-not-secure') {
      console.warn('[Crypto Service] Using insecure fallback master key. Set GOOGLE_TOKEN_ENCRYPTION_KEY in production!');
    }

    return masterKey;
  }

  /**
   * Get encryption key by version
   */
  private async getEncryptionKey(version: number): Promise<Buffer> {
    // Check cache first
    if (this.keyCache.has(version)) {
      return this.keyCache.get(version)!;
    }

    // Fallback to environment key for version 0
    if (version === 0) {
      const envKey = this.getMasterKey();
      const key = scryptSync(envKey, 'google-ads-salt', this.KEY_LENGTH);
      this.keyCache.set(version, key);
      return key;
    }

    // Get from database
    try {
      const supabase = createServiceClient();
      
      const { data, error } = await supabase
        .from('google_ads_encryption_keys')
        .select('key_hash')
        .eq('version', version)
        .single();

      if (error || !data) {
        throw new Error(`Encryption key version ${version} not found`);
      }

      const key = this.decryptKeyWithMaster(data.key_hash);
      this.keyCache.set(version, key);
      
      return key;
    } catch (error) {
      console.error(`[Crypto Service] Error getting encryption key version ${version}:`, error);
      throw error;
    }
  }

  /**
   * Clean up old encryption keys
   */
  private async cleanupOldKeys(): Promise<void> {
    try {
      const supabase = createServiceClient();
      
      // Get all keys ordered by version (newest first)
      const { data: keys, error } = await supabase
        .from('google_ads_encryption_keys')
        .select('id, version')
        .order('version', { ascending: false });

      if (error || !keys) {
        return;
      }

      // Keep only the latest MAX_KEY_VERSIONS
      const keysToDelete = keys.slice(this.MAX_KEY_VERSIONS);
      
      if (keysToDelete.length > 0) {
        const idsToDelete = keysToDelete.map(key => key.id);
        
        await supabase
          .from('google_ads_encryption_keys')
          .delete()
          .in('id', idsToDelete);

        // Remove from cache
        keysToDelete.forEach(key => {
          this.keyCache.delete(key.version);
        });

        console.log(`[Crypto Service] Cleaned up ${keysToDelete.length} old encryption keys`);
      }
    } catch (error) {
      console.error('[Crypto Service] Error cleaning up old keys:', error);
    }
  }

  // ==========================================================================
  // Token Encryption/Decryption
  // ==========================================================================

  /**
   * Encrypt a token with current active key
   */
  async encryptToken(token: string): Promise<EncryptionResult> {
    try {
      // Ensure we have a current key
      if (this.currentKeyVersion === null) {
        await this.initializeKeyRotation();
      }

      const keyVersion = this.currentKeyVersion!;
      const encryptionKey = await this.getEncryptionKey(keyVersion);
      
      const salt = randomBytes(this.SALT_LENGTH);
      const iv = randomBytes(this.IV_LENGTH);
      
      // Create cipher
      const cipher = createCipheriv(this.ALGORITHM, encryptionKey, iv);
      
      // Encrypt
      let encrypted = cipher.update(token, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get auth tag
      const authTag = cipher.getAuthTag();

      // Combine version + salt + iv + authTag + encrypted
      const versionBuffer = Buffer.alloc(4);
      versionBuffer.writeUInt32BE(keyVersion, 0);
      
      const combined = Buffer.concat([
        versionBuffer,
        salt,
        iv,
        authTag,
        Buffer.from(encrypted, 'hex')
      ]);

      return {
        encryptedData: combined.toString('base64'),
        keyVersion,
        algorithm: this.ALGORITHM,
      };
    } catch (error) {
      console.error('[Crypto Service] Token encryption error:', error);
      throw new Error('Failed to encrypt token');
    }
  }

  /**
   * Decrypt a token (supports multiple key versions)
   */
  async decryptToken(encryptedData: string): Promise<DecryptionResult> {
    try {
      // Decode from base64
      const combined = Buffer.from(encryptedData, 'base64');

      // Extract version (first 4 bytes)
      const keyVersion = combined.readUInt32BE(0);
      
      // Extract components
      const salt = combined.subarray(4, 4 + this.SALT_LENGTH);
      const iv = combined.subarray(
        4 + this.SALT_LENGTH,
        4 + this.SALT_LENGTH + this.IV_LENGTH
      );
      const authTag = combined.subarray(
        4 + this.SALT_LENGTH + this.IV_LENGTH,
        4 + this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH
      );
      const encrypted = combined.subarray(
        4 + this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH
      );

      // Get encryption key for this version
      const encryptionKey = await this.getEncryptionKey(keyVersion);

      // Create decipher
      const decipher = createDecipheriv(this.ALGORITHM, encryptionKey, iv);
      decipher.setAuthTag(authTag);

      // Decrypt
      let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return {
        decryptedData: decrypted,
        keyVersion,
      };
    } catch (error) {
      console.error('[Crypto Service] Token decryption error:', error);
      throw new Error('Failed to decrypt token');
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Test encryption/decryption functionality
   */
  async testEncryption(): Promise<{
    success: boolean;
    keyVersion?: number;
    error?: string;
  }> {
    try {
      const testToken = `test-token-${Date.now()}-${Math.random()}`;
      
      const encrypted = await this.encryptToken(testToken);
      const decrypted = await this.decryptToken(encrypted.encryptedData);
      
      const success = testToken === decrypted.decryptedData;
      
      return {
        success,
        keyVersion: encrypted.keyVersion,
      };
    } catch (error) {
      console.error('[Crypto Service] Encryption test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get encryption statistics
   */
  async getEncryptionStats(): Promise<{
    currentKeyVersion: number | null;
    totalKeys: number;
    activeKeys: number;
    oldestKeyAge: number; // days
  }> {
    try {
      const supabase = createServiceClient();
      
      const { data: keys, error } = await supabase
        .from('google_ads_encryption_keys')
        .select('version, created_at, is_active')
        .order('created_at', { ascending: true });

      if (error || !keys) {
        return {
          currentKeyVersion: this.currentKeyVersion,
          totalKeys: 0,
          activeKeys: 0,
          oldestKeyAge: 0,
        };
      }

      const activeKeys = keys.filter(key => key.is_active).length;
      const oldestKey = keys[0];
      const oldestKeyAge = oldestKey 
        ? Math.floor((Date.now() - new Date(oldestKey.created_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        currentKeyVersion: this.currentKeyVersion,
        totalKeys: keys.length,
        activeKeys,
        oldestKeyAge,
      };
    } catch (error) {
      console.error('[Crypto Service] Error getting encryption stats:', error);
      return {
        currentKeyVersion: this.currentKeyVersion,
        totalKeys: 0,
        activeKeys: 0,
        oldestKeyAge: 0,
      };
    }
  }

  /**
   * Force key rotation (for manual rotation)
   */
  async forceKeyRotation(): Promise<void> {
    console.log('[Crypto Service] Forcing key rotation...');
    await this.rotateEncryptionKey();
  }

  /**
   * Sanitize token for logging (never log actual tokens)
   */
  static sanitizeTokenForLogging(token: string): string {
    if (!token || token.length < 8) {
      return '[REDACTED]';
    }
    
    // Show only first 4 and last 4 characters
    return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
  }

  /**
   * Generate secure hash for audit logging
   */
  static generateTokenHash(token: string): string {
    return createHash('sha256').update(token).digest('hex').substring(0, 16);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let cryptoServiceInstance: GoogleAdsCryptoService | null = null;

/**
 * Get singleton instance of GoogleAdsCryptoService
 */
export function getGoogleAdsCryptoService(): GoogleAdsCryptoService {
  if (!cryptoServiceInstance) {
    cryptoServiceInstance = new GoogleAdsCryptoService();
  }
  return cryptoServiceInstance;
}