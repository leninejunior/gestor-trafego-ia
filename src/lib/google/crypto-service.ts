/**
 * Google Ads Cryptography Service
 * 
 * Handles encryption/decryption of sensitive tokens with key rotation support
 * Requirements: 1.1, 1.3
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { getGoogleAdsAuditService } from './audit-service';

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
  
  // Initialization state
  private initializationPromise: Promise<void> | null = null;
  private isInitialized: boolean = false;
  private initializationError: Error | null = null;

  constructor() {
    // Start initialization but don't wait for it
    // This allows the constructor to complete synchronously
    this.initializationPromise = this.initializeKeyRotation();
  }

  // ==========================================================================
  // Initialization Management
  // ==========================================================================

  /**
   * Ensure the crypto service is initialized before use
   * This method should be called before any encryption/decryption operations
   */
  async ensureInitialized(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      console.log('[Crypto Service] Waiting for initialization to complete...');
      await this.initializationPromise;
    }

    if (this.initializationError) {
      console.warn('[Crypto Service] ⚠️ Initialization had errors, but continuing with fallback', {
        error: this.initializationError.message,
      });
    }
  }

  /**
   * Get initialization status
   */
  getInitializationStatus(): {
    isInitialized: boolean;
    hasError: boolean;
    error?: string;
    currentKeyVersion: number | null;
  } {
    return {
      isInitialized: this.isInitialized,
      hasError: !!this.initializationError,
      error: this.initializationError?.message,
      currentKeyVersion: this.currentKeyVersion,
    };
  }

  // ==========================================================================
  // Key Management
  // ==========================================================================

  /**
   * Initialize key rotation system
   */
  private async initializeKeyRotation(): Promise<void> {
    try {
      console.log('[Crypto Service] ========================================');
      console.log('[Crypto Service] Starting initialization...', {
        timestamp: new Date().toISOString(),
      });

      // Check if database schema is ready
      const schemaReady = await this.checkDatabaseSchema();
      
      if (!schemaReady) {
        console.warn('[Crypto Service] ⚠️ Database schema not ready, using fallback', {
          reason: 'Missing required columns in google_ads_encryption_keys table',
          recommendation: 'Run database migration: database/migrations/001-fix-google-ads-encryption-keys.sql',
        });
        
        // Use fallback immediately
        this.currentKeyVersion = 0;
        this.isInitialized = true;
        this.initializationError = new Error('Database schema not ready - using fallback');
        
        console.log('[Crypto Service] ✅ Initialized with fallback environment key (version 0)');
        console.log('[Crypto Service] ========================================');
        return;
      }

      // Check if we have a current active key
      const activeKey = await this.getCurrentEncryptionKey();
      
      if (!activeKey || this.isKeyExpired(activeKey)) {
        console.log('[Crypto Service] No active key found or key expired, generating new key', {
          hasActiveKey: !!activeKey,
          isExpired: activeKey ? this.isKeyExpired(activeKey) : null,
        });
        await this.rotateEncryptionKey();
      } else {
        this.currentKeyVersion = activeKey.version;
        console.log('[Crypto Service] ✅ Using existing active key:', {
          version: activeKey.version,
          algorithm: activeKey.algorithm,
          createdAt: activeKey.createdAt.toISOString(),
        });
      }
      
      this.isInitialized = true;
      this.initializationError = null;
      
      console.log('[Crypto Service] ✅ Initialization completed successfully', {
        currentKeyVersion: this.currentKeyVersion,
        timestamp: new Date().toISOString(),
      });
      console.log('[Crypto Service] ========================================');
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown initialization error');
      this.initializationError = err;
      
      console.error('[Crypto Service] ❌ Error initializing key rotation:', {
        error: err.message,
        errorType: err.constructor.name,
        stack: err.stack,
        timestamp: new Date().toISOString(),
      });
      
      // Fallback to environment key if database keys fail
      this.currentKeyVersion = 0;
      this.isInitialized = true; // Mark as initialized even with fallback
      
      console.warn('[Crypto Service] ⚠️ Using fallback environment key (version 0)', {
        reason: 'Database initialization failed',
        error: err.message,
      });
      console.log('[Crypto Service] ========================================');
    }
  }

  /**
   * Check if database schema has required columns
   * Returns false if schema is not ready, true if ready
   */
  private async checkDatabaseSchema(): Promise<boolean> {
    try {
      const supabase = createServiceClient();
      
      // Try to query all required columns
      const { data, error } = await supabase
        .from('google_ads_encryption_keys')
        .select('id, key_data, algorithm, version, key_hash, is_active, created_at, expires_at')
        .limit(1);

      if (error) {
        // Check if error is due to missing columns
        if (error.message.includes('algorithm') || 
            error.message.includes('version') || 
            error.message.includes('key_hash')) {
          console.warn('[Crypto Service] ⚠️ Database schema missing required columns:', {
            error: error.message,
            missingColumns: [
              error.message.includes('algorithm') ? 'algorithm' : null,
              error.message.includes('version') ? 'version' : null,
              error.message.includes('key_hash') ? 'key_hash' : null,
            ].filter(Boolean),
          });
          return false;
        }
        
        // Other errors might be transient, log but don't fail
        console.warn('[Crypto Service] ⚠️ Database query error (non-schema):', {
          error: error.message,
          code: error.code,
        });
        return true; // Assume schema is OK, error is something else
      }

      console.log('[Crypto Service] ✅ Database schema validated successfully');
      return true;
    } catch (error) {
      console.error('[Crypto Service] ❌ Error checking database schema:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // On exception, assume schema might not be ready
      return false;
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
    const startTime = Date.now();
    let newKey: Buffer | null = null;
    let newVersion: number | null = null;
    let encryptedKey: string | null = null;
    let deactivationSucceeded = false;
    
    try {
      console.log('[Crypto Service] ========================================');
      console.log('[Crypto Service] Starting key rotation...', {
        timestamp: new Date().toISOString(),
        currentKeyVersion: this.currentKeyVersion,
      });
      
      // Step 1: Generate new key
      try {
        newKey = randomBytes(this.KEY_LENGTH);
        console.log('[Crypto Service] ✅ Generated new random key:', {
          keyLength: newKey.length,
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        console.error('[Crypto Service] ❌ Failed to generate random key:', {
          error: err.message,
          errorType: err.constructor.name,
        });
        throw new Error(`Key generation failed: ${err.message}`);
      }
      
      // Step 2: Get next version number
      try {
        newVersion = await this.getNextKeyVersion();
        console.log('[Crypto Service] ✅ Determined next key version:', {
          version: newVersion,
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        console.error('[Crypto Service] ❌ Failed to get next key version:', {
          error: err.message,
          errorType: err.constructor.name,
        });
        // Fallback: use timestamp-based version
        newVersion = Math.floor(Date.now() / 1000);
        console.warn('[Crypto Service] ⚠️ Using timestamp-based version as fallback:', {
          version: newVersion,
        });
      }
      
      // Step 3: Encrypt the key with master key
      try {
        encryptedKey = this.encryptKeyWithMaster(newKey);
        console.log('[Crypto Service] ✅ Encrypted new key with master key');
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        console.error('[Crypto Service] ❌ Failed to encrypt key with master key:', {
          error: err.message,
          errorType: err.constructor.name,
        });
        throw new Error(`Key encryption failed: ${err.message}`);
      }
      
      const supabase = createServiceClient();
      
      // Step 4: Deactivate current active keys
      console.log('[Crypto Service] Deactivating current active keys...');
      try {
        const { error: deactivateError } = await supabase
          .from('google_ads_encryption_keys')
          .update({ is_active: false })
          .eq('is_active', true);

        if (deactivateError) {
          console.error('[Crypto Service] ⚠️ Error deactivating old keys (non-critical):', {
            error: deactivateError.message,
            code: deactivateError.code,
          });
          // Continue anyway - this is not critical
        } else {
          deactivationSucceeded = true;
          console.log('[Crypto Service] ✅ Deactivated old keys successfully');
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        console.warn('[Crypto Service] ⚠️ Exception during key deactivation (non-critical):', {
          error: err.message,
          errorType: err.constructor.name,
        });
        // Continue anyway - this is not critical
      }

      // Step 5: Insert new active key
      console.log('[Crypto Service] Inserting new encryption key...');
      try {
        const { error: insertError } = await supabase
          .from('google_ads_encryption_keys')
          .insert({
            version: newVersion,
            key_hash: encryptedKey,
            algorithm: this.ALGORITHM,
            is_active: true,
            created_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error('[Crypto Service] ❌ Failed to insert new key:', {
            error: insertError.message,
            code: insertError.code,
            version: newVersion,
            hint: insertError.hint,
            details: insertError.details,
          });
          
          // If we deactivated keys but failed to insert, try to rollback
          if (deactivationSucceeded) {
            console.log('[Crypto Service] Attempting to rollback key deactivation...');
            try {
              await this.rollbackKeyDeactivation(supabase);
            } catch (rollbackError) {
              console.error('[Crypto Service] ❌ Rollback failed:', {
                error: rollbackError instanceof Error ? rollbackError.message : 'Unknown error',
              });
            }
          }
          
          throw new Error(`Database insert failed: ${insertError.message}`);
        }
        
        console.log('[Crypto Service] ✅ New key inserted successfully');
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('Database insert failed:')) {
          throw error; // Re-throw database errors
        }
        
        const err = error instanceof Error ? error : new Error('Unknown error');
        console.error('[Crypto Service] ❌ Exception during key insertion:', {
          error: err.message,
          errorType: err.constructor.name,
        });
        throw new Error(`Key insertion failed: ${err.message}`);
      }

      // Step 6: Update cache and current version
      try {
        this.keyCache.set(newVersion, newKey);
        this.currentKeyVersion = newVersion;
        console.log('[Crypto Service] ✅ Key cached and version updated:', {
          version: newVersion,
          cacheSize: this.keyCache.size,
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        console.error('[Crypto Service] ❌ Failed to update cache:', {
          error: err.message,
          errorType: err.constructor.name,
        });
        // This is critical - we inserted the key but can't use it
        throw new Error(`Cache update failed: ${err.message}`);
      }
      
      // Step 7: Clean up old keys (non-critical, don't fail if this errors)
      try {
        await this.cleanupOldKeys();
        console.log('[Crypto Service] ✅ Old keys cleaned up successfully');
      } catch (cleanupError) {
        console.warn('[Crypto Service] ⚠️ Error cleaning up old keys (non-critical):', {
          error: cleanupError instanceof Error ? cleanupError.message : 'Unknown error',
        });
      }
      
      const duration = Date.now() - startTime;
      
      console.log('[Crypto Service] ✅ Key rotation completed successfully:', {
        newVersion,
        durationMs: duration,
        timestamp: new Date().toISOString(),
        deactivationSucceeded,
      });
      console.log('[Crypto Service] ========================================');
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error instanceof Error ? error : new Error('Unknown error');
      
      console.error('[Crypto Service] ❌ Key rotation failed:', {
        error: err.message,
        errorType: err.constructor.name,
        durationMs: duration,
        stack: err.stack,
        timestamp: new Date().toISOString(),
        newVersion,
        deactivationSucceeded,
      });
      console.log('[Crypto Service] ========================================');
      
      // Don't throw if we're in initialization - allow fallback to environment key
      if (this.initializationPromise) {
        console.warn('[Crypto Service] ⚠️ Key rotation failed during initialization, will use fallback');
        // Set to version 0 (environment key fallback)
        this.currentKeyVersion = 0;
        return;
      }
      
      throw new Error(`Failed to rotate encryption key: ${err.message}`);
    }
  }

  /**
   * Rollback key deactivation in case of insertion failure
   */
  private async rollbackKeyDeactivation(supabase: any): Promise<void> {
    try {
      // Re-activate the most recent key
      const { data: latestKey, error: fetchError } = await supabase
        .from('google_ads_encryption_keys')
        .select('id, version')
        .eq('is_active', false)
        .order('version', { ascending: false })
        .limit(1)
        .single();

      if (fetchError || !latestKey) {
        console.error('[Crypto Service] ❌ Could not find key to rollback');
        return;
      }

      const { error: updateError } = await supabase
        .from('google_ads_encryption_keys')
        .update({ is_active: true })
        .eq('id', latestKey.id);

      if (updateError) {
        console.error('[Crypto Service] ❌ Failed to rollback key deactivation:', {
          error: updateError.message,
        });
      } else {
        console.log('[Crypto Service] ✅ Rolled back key deactivation:', {
          version: latestKey.version,
        });
      }
    } catch (error) {
      console.error('[Crypto Service] ❌ Exception during rollback:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
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
  async encryptToken(token: string, connectionId?: string, clientId?: string): Promise<EncryptionResult> {
    const startTime = Date.now();
    const tokenHash = GoogleAdsCryptoService.generateTokenHash(token);
    
    try {
      // Ensure initialization is complete
      await this.ensureInitialized();

      // Ensure we have a current key
      if (this.currentKeyVersion === null) {
        console.warn('[Crypto Service] ⚠️ No current key version after initialization, re-initializing...');
        await this.initializeKeyRotation();
      }

      const keyVersion = this.currentKeyVersion!;
      
      console.log('[Crypto Service] Encrypting token:', {
        keyVersion,
        algorithm: this.ALGORITHM,
        tokenLength: token.length,
        tokenHash,
        connectionId,
        clientId,
      });
      
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

      const result = {
        encryptedData: combined.toString('base64'),
        keyVersion,
        algorithm: this.ALGORITHM,
      };

      const duration = Date.now() - startTime;

      console.log('[Crypto Service] ✅ Token encrypted successfully:', {
        keyVersion,
        encryptedLength: result.encryptedData.length,
        durationMs: duration,
        tokenHash,
      });

      // Log to audit service
      if (connectionId && clientId) {
        try {
          const auditService = getGoogleAdsAuditService();
          await auditService.logTokenOperation(
            'token_encrypt',
            connectionId,
            clientId,
            true,
            undefined,
            {
              keyVersion,
              algorithm: this.ALGORITHM,
              tokenHash,
              durationMs: duration,
              encryptedLength: result.encryptedData.length,
            }
          );
        } catch (auditError) {
          console.warn('[Crypto Service] ⚠️ Failed to log encryption to audit:', {
            error: auditError instanceof Error ? auditError.message : 'Unknown error',
          });
          // Don't fail encryption if audit logging fails
        }
      }

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      const duration = Date.now() - startTime;
      
      console.error('[Crypto Service] ❌ Token encryption error:', {
        error: err.message,
        errorType: err.constructor.name,
        currentKeyVersion: this.currentKeyVersion,
        isInitialized: this.isInitialized,
        durationMs: duration,
        tokenHash,
        stack: err.stack,
      });

      // Log failure to audit service
      if (connectionId && clientId) {
        try {
          const auditService = getGoogleAdsAuditService();
          await auditService.logTokenOperation(
            'token_encrypt',
            connectionId,
            clientId,
            false,
            err.message,
            {
              tokenHash,
              durationMs: duration,
              errorType: err.constructor.name,
            }
          );
        } catch (auditError) {
          console.warn('[Crypto Service] ⚠️ Failed to log encryption failure to audit:', {
            error: auditError instanceof Error ? auditError.message : 'Unknown error',
          });
        }
      }
      
      throw new Error(`Failed to encrypt token: ${err.message}`);
    }
  }

  /**
   * Decrypt a token (supports multiple key versions)
   * Handles both encrypted and plain text tokens for backward compatibility
   */
  async decryptToken(encryptedData: string, connectionId?: string, clientId?: string): Promise<DecryptionResult> {
    const startTime = Date.now();
    const encryptedDataHash = GoogleAdsCryptoService.generateTokenHash(encryptedData);
    let isPlainText = false;
    let keyVersion: number | undefined;
    
    try {
      // Ensure initialization is complete
      await this.ensureInitialized();

      // Check if token is plain text (migration fallback)
      // Google tokens have specific prefixes
      if (
        encryptedData.startsWith('ya29.') || // Access token
        encryptedData.startsWith('1//') ||   // Refresh token
        encryptedData.length < 100           // Too short to be encrypted
      ) {
        isPlainText = true;
        const duration = Date.now() - startTime;
        
        console.log('[Crypto Service] ⚠️ Token appears to be plain text, returning as-is (migration fallback):', {
          tokenPrefix: encryptedData.substring(0, 10) + '...',
          tokenLength: encryptedData.length,
          durationMs: duration,
          encryptedDataHash,
        });

        const result = {
          decryptedData: encryptedData,
          keyVersion: 0, // Plain text = version 0
        };

        // Log plain text token to audit
        if (connectionId && clientId) {
          try {
            const auditService = getGoogleAdsAuditService();
            await auditService.logTokenOperation(
              'token_decrypt',
              connectionId,
              clientId,
              true,
              undefined,
              {
                keyVersion: 0,
                isPlainText: true,
                tokenHash: encryptedDataHash,
                durationMs: duration,
                migrationFallback: true,
              }
            );
          } catch (auditError) {
            console.warn('[Crypto Service] ⚠️ Failed to log plain text decryption to audit:', {
              error: auditError instanceof Error ? auditError.message : 'Unknown error',
            });
          }
        }
        
        return result;
      }

      console.log('[Crypto Service] Decrypting token:', {
        encryptedLength: encryptedData.length,
        encryptedDataHash,
        connectionId,
        clientId,
      });

      // Decode from base64
      const combined = Buffer.from(encryptedData, 'base64');

      // Extract version (first 4 bytes)
      keyVersion = combined.readUInt32BE(0);
      
      console.log('[Crypto Service] Token encrypted with key version:', keyVersion);
      
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

      const duration = Date.now() - startTime;
      const decryptedHash = GoogleAdsCryptoService.generateTokenHash(decrypted);

      console.log('[Crypto Service] ✅ Token decrypted successfully:', {
        keyVersion,
        decryptedLength: decrypted.length,
        durationMs: duration,
        encryptedDataHash,
        decryptedHash,
      });

      const result = {
        decryptedData: decrypted,
        keyVersion,
      };

      // Log to audit service
      if (connectionId && clientId) {
        try {
          const auditService = getGoogleAdsAuditService();
          await auditService.logTokenOperation(
            'token_decrypt',
            connectionId,
            clientId,
            true,
            undefined,
            {
              keyVersion,
              tokenHash: encryptedDataHash,
              durationMs: duration,
              decryptedLength: decrypted.length,
            }
          );
        } catch (auditError) {
          console.warn('[Crypto Service] ⚠️ Failed to log decryption to audit:', {
            error: auditError instanceof Error ? auditError.message : 'Unknown error',
          });
          // Don't fail decryption if audit logging fails
        }
      }

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      const duration = Date.now() - startTime;
      
      console.error('[Crypto Service] ❌ Token decryption error:', {
        error: err.message,
        errorType: err.constructor.name,
        encryptedDataLength: encryptedData.length,
        encryptedDataPrefix: encryptedData.substring(0, 20) + '...',
        isInitialized: this.isInitialized,
        currentKeyVersion: this.currentKeyVersion,
        keyVersion,
        durationMs: duration,
        encryptedDataHash,
        stack: err.stack,
      });
      
      // If decryption fails, try returning as plain text (migration fallback)
      console.warn('[Crypto Service] ⚠️ Decryption failed, attempting plain text fallback...');

      const result = {
        decryptedData: encryptedData,
        keyVersion: 0,
      };

      // Log failure to audit service
      if (connectionId && clientId) {
        try {
          const auditService = getGoogleAdsAuditService();
          await auditService.logTokenOperation(
            'token_decrypt',
            connectionId,
            clientId,
            false,
            err.message,
            {
              keyVersion: keyVersion || 0,
              tokenHash: encryptedDataHash,
              durationMs: duration,
              errorType: err.constructor.name,
              fallbackToPlainText: true,
            }
          );
        } catch (auditError) {
          console.warn('[Crypto Service] ⚠️ Failed to log decryption failure to audit:', {
            error: auditError instanceof Error ? auditError.message : 'Unknown error',
          });
        }
      }
      
      return result;
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
    initializationStatus?: any;
  }> {
    try {
      console.log('[Crypto Service] ========================================');
      console.log('[Crypto Service] Starting encryption test...');
      
      // Ensure initialization
      await this.ensureInitialized();
      
      const initStatus = this.getInitializationStatus();
      console.log('[Crypto Service] Initialization status:', initStatus);
      
      const testToken = `test-token-${Date.now()}-${Math.random()}`;
      
      console.log('[Crypto Service] Encrypting test token...');
      const encrypted = await this.encryptToken(testToken);
      
      console.log('[Crypto Service] Decrypting test token...');
      const decrypted = await this.decryptToken(encrypted.encryptedData);
      
      const success = testToken === decrypted.decryptedData;
      
      console.log('[Crypto Service] Encryption test result:', {
        success,
        keyVersion: encrypted.keyVersion,
        originalLength: testToken.length,
        encryptedLength: encrypted.encryptedData.length,
        decryptedLength: decrypted.decryptedData.length,
        tokensMatch: success,
      });
      console.log('[Crypto Service] ========================================');
      
      return {
        success,
        keyVersion: encrypted.keyVersion,
        initializationStatus: initStatus,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      
      console.error('[Crypto Service] ❌ Encryption test failed:', {
        error: err.message,
        errorType: err.constructor.name,
        stack: err.stack,
      });
      console.log('[Crypto Service] ========================================');
      
      return {
        success: false,
        error: err.message,
        initializationStatus: this.getInitializationStatus(),
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