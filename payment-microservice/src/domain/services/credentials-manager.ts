import * as crypto from 'crypto';
import { PaymentError, PaymentErrorType } from '../types';

/**
 * Interface para chave de criptografia
 */
export interface EncryptionKey {
  /** ID único da chave */
  id: string;
  
  /** Chave de criptografia (base64) */
  key: string;
  
  /** Algoritmo usado */
  algorithm: string;
  
  /** Data de criação */
  createdAt: Date;
  
  /** Data de expiração */
  expiresAt?: Date;
  
  /** Se a chave está ativa */
  isActive: boolean;
  
  /** Versão da chave */
  version: number;
}

/**
 * Dados criptografados
 */
export interface EncryptedData {
  /** Dados criptografados (base64) */
  data: string;
  
  /** IV usado na criptografia (base64) */
  iv: string;
  
  /** ID da chave usada */
  keyId: string;
  
  /** Algoritmo usado */
  algorithm: string;
  
  /** Timestamp da criptografia */
  encryptedAt: Date;
  
  /** Tag de autenticação para GCM (base64) - obrigatório para algoritmos autenticados */
  authTag?: string;
  
  /** Hash de integridade dos dados originais (opcional) */
  integrityHash?: string;
}

/**
 * Configuração para rotação de chaves
 */
export interface KeyRotationConfig {
  /** Intervalo de rotação em milissegundos */
  rotationInterval: number;
  
  /** Número máximo de chaves ativas */
  maxActiveKeys: number;
  
  /** Tempo de retenção de chaves antigas em milissegundos */
  keyRetentionTime: number;
  
  /** Se deve rotacionar automaticamente */
  autoRotate: boolean;
}

/**
 * Gerenciador de credenciais com criptografia AES-256
 */
export class CredentialsManager {
  private keys: Map<string, EncryptionKey> = new Map();
  private currentKeyId?: string;
  private rotationConfig: KeyRotationConfig;
  private rotationTimer?: NodeJS.Timeout;

  constructor(rotationConfig?: Partial<KeyRotationConfig>) {
    this.rotationConfig = {
      rotationInterval: 24 * 60 * 60 * 1000, // 24 horas
      maxActiveKeys: 3,
      keyRetentionTime: 7 * 24 * 60 * 60 * 1000, // 7 dias
      autoRotate: true,
      ...rotationConfig
    };

    // Inicia rotação automática se habilitada
    if (this.rotationConfig.autoRotate) {
      this.startAutoRotation();
    }
  }

  /**
   * Inicializa o gerenciador com uma chave mestra
   */
  async initialize(masterKey?: string): Promise<void> {
    try {
      if (masterKey) {
        // Usa chave mestra fornecida
        await this.createKeyFromMaster(masterKey);
      } else {
        // Gera nova chave aleatória
        await this.generateNewKey();
      }
    } catch (error) {
      throw new PaymentError(
        PaymentErrorType.CONFIGURATION_ERROR,
        `Failed to initialize credentials manager: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error,
        false
      );
    }
  }

  /**
   * Criptografa dados sensíveis usando AES-256-GCM para autenticação integrada
   */
  async encrypt(data: string): Promise<EncryptedData> {
    if (!this.currentKeyId) {
      throw new PaymentError(
        PaymentErrorType.CONFIGURATION_ERROR,
        'Credentials manager not initialized',
        undefined,
        false
      );
    }

    const key = this.keys.get(this.currentKeyId);
    if (!key) {
      throw new PaymentError(
        PaymentErrorType.CONFIGURATION_ERROR,
        'Current encryption key not found',
        undefined,
        false
      );
    }

    try {
      // Gera IV aleatório (12 bytes para GCM)
      const iv = crypto.randomBytes(12);
      
      // Usa AES-256-GCM para criptografia autenticada
      const keyBuffer = Buffer.from(key.key, 'base64');
      if (keyBuffer.length !== 32) {
        throw new Error(`Invalid key length: expected 32 bytes, got ${keyBuffer.length}`);
      }
      
      const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
      
      // Criptografa dados
      let encrypted = cipher.update(data, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      // Obtém tag de autenticação
      const authTag = cipher.getAuthTag();

      return {
        data: encrypted,
        iv: iv.toString('base64'),
        keyId: key.id,
        algorithm: 'aes-256-gcm',
        encryptedAt: new Date(),
        authTag: authTag.toString('base64')
      };

    } catch (error) {
      throw new PaymentError(
        PaymentErrorType.CONFIGURATION_ERROR,
        `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error,
        false
      );
    }
  }

  /**
   * Descriptografa dados com suporte a múltiplos algoritmos
   */
  async decrypt(encryptedData: EncryptedData): Promise<string> {
    const key = this.keys.get(encryptedData.keyId);
    if (!key) {
      throw new PaymentError(
        PaymentErrorType.CONFIGURATION_ERROR,
        `Encryption key '${encryptedData.keyId}' not found`,
        undefined,
        false
      );
    }

    try {
      const algorithm = encryptedData.algorithm || 'aes-256-cbc';
      const iv = Buffer.from(encryptedData.iv, 'base64');
      const keyBuffer = Buffer.from(key.key, 'base64');
      
      if (keyBuffer.length !== 32) {
        throw new Error(`Invalid key length: expected 32 bytes, got ${keyBuffer.length}`);
      }

      let decrypted: string;

      if (algorithm === 'aes-256-gcm') {
        // Descriptografia autenticada com GCM
        if (!encryptedData.authTag) {
          throw new Error('Authentication tag is required for GCM decryption');
        }
        
        const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
        const authTag = Buffer.from(encryptedData.authTag, 'base64');
        decipher.setAuthTag(authTag);
        
        decrypted = decipher.update(encryptedData.data, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
      } else {
        // Descriptografia tradicional (CBC - compatibilidade com dados antigos)
        const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
        decrypted = decipher.update(encryptedData.data, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
      }

      return decrypted;

    } catch (error) {
      throw new PaymentError(
        PaymentErrorType.CONFIGURATION_ERROR,
        `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error,
        false
      );
    }
  }

  /**
   * Criptografa credenciais de um provedor
   */
  async encryptCredentials(credentials: Record<string, string>): Promise<Record<string, EncryptedData>> {
    const encrypted: Record<string, EncryptedData> = {};

    for (const [key, value] of Object.entries(credentials)) {
      if (value && typeof value === 'string') {
        encrypted[key] = await this.encrypt(value);
      }
    }

    return encrypted;
  }

  /**
   * Descriptografa credenciais de um provedor
   */
  async decryptCredentials(encryptedCredentials: Record<string, EncryptedData>): Promise<Record<string, string>> {
    const decrypted: Record<string, string> = {};

    for (const [key, encryptedValue] of Object.entries(encryptedCredentials)) {
      if (encryptedValue && typeof encryptedValue === 'object') {
        decrypted[key] = await this.decrypt(encryptedValue);
      }
    }

    return decrypted;
  }

  /**
   * Gera uma nova chave de criptografia
   */
  async generateNewKey(): Promise<EncryptionKey> {
    try {
      // Gera ID da chave de forma mais robusta
      const keyId = Date.now().toString(36) + Math.random().toString(36).substr(2);
      
      const keyBuffer = crypto.randomBytes(32); // 256 bits para AES-256
      if (!keyBuffer || keyBuffer.length !== 32) {
        throw new Error('Failed to generate encryption key');
      }
      
      const newKey: EncryptionKey = {
        id: keyId,
        key: keyBuffer.toString('base64'),
        algorithm: 'aes-256-gcm',
        createdAt: new Date(),
        isActive: true,
        version: this.keys.size + 1
      };

      this.keys.set(keyId, newKey);
      this.currentKeyId = keyId;

      // Limpa chaves antigas se necessário
      await this.cleanupOldKeys();

      return newKey;

    } catch (error) {
      throw new PaymentError(
        PaymentErrorType.CONFIGURATION_ERROR,
        `Failed to generate new key: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error,
        false
      );
    }
  }

  /**
   * Cria chave a partir de uma chave mestra
   */
  private async createKeyFromMaster(masterKey: string): Promise<EncryptionKey> {
    try {
      // Deriva chave usando PBKDF2
      const salt = crypto.randomBytes(32);
      const derivedKey = crypto.pbkdf2Sync(masterKey, salt, 100000, 32, 'sha256');
      
      const keyId = Date.now().toString(36) + Math.random().toString(36).substr(2);
      
      const newKey: EncryptionKey = {
        id: keyId,
        key: derivedKey.toString('base64'),
        algorithm: 'aes-256-gcm',
        createdAt: new Date(),
        isActive: true,
        version: 1
      };

      this.keys.set(keyId, newKey);
      this.currentKeyId = keyId;

      return newKey;

    } catch (error) {
      throw new PaymentError(
        PaymentErrorType.CONFIGURATION_ERROR,
        `Failed to create key from master: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error,
        false
      );
    }
  }

  /**
   * Rotaciona chaves de criptografia
   */
  async rotateKeys(): Promise<EncryptionKey> {
    // Desativa chave atual
    if (this.currentKeyId) {
      const currentKey = this.keys.get(this.currentKeyId);
      if (currentKey) {
        currentKey.isActive = false;
      }
    }

    // Gera nova chave
    const newKey = await this.generateNewKey();

    return newKey;
  }

  /**
   * Inicia rotação automática de chaves
   */
  private startAutoRotation(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
    }

    this.rotationTimer = setInterval(async () => {
      try {
        await this.rotateKeys();
      } catch (error) {
        console.error('Auto key rotation failed:', error);
      }
    }, this.rotationConfig.rotationInterval);
  }

  /**
   * Para rotação automática de chaves
   */
  stopAutoRotation(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = undefined;
    }
  }

  /**
   * Remove chaves antigas baseado na configuração de retenção
   */
  private async cleanupOldKeys(): Promise<void> {
    const now = new Date();
    const keysToRemove: string[] = [];

    for (const [keyId, key] of this.keys) {
      // Remove chaves expiradas
      if (key.expiresAt && key.expiresAt < now) {
        keysToRemove.push(keyId);
        continue;
      }

      // Remove chaves antigas inativas
      if (!key.isActive) {
        const keyAge = now.getTime() - key.createdAt.getTime();
        if (keyAge > this.rotationConfig.keyRetentionTime) {
          keysToRemove.push(keyId);
        }
      }
    }

    // Mantém apenas o número máximo de chaves ativas
    const activeKeys = Array.from(this.keys.values())
      .filter(key => key.isActive)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (activeKeys.length > this.rotationConfig.maxActiveKeys) {
      const excessKeys = activeKeys.slice(this.rotationConfig.maxActiveKeys);
      excessKeys.forEach(key => {
        key.isActive = false;
        keysToRemove.push(key.id);
      });
    }

    // Remove chaves marcadas
    keysToRemove.forEach(keyId => {
      this.keys.delete(keyId);
    });
  }

  /**
   * Lista todas as chaves (apenas metadados)
   */
  listKeys(): Array<Omit<EncryptionKey, 'key'>> {
    return Array.from(this.keys.values()).map(key => ({
      id: key.id,
      algorithm: key.algorithm,
      createdAt: key.createdAt,
      expiresAt: key.expiresAt,
      isActive: key.isActive,
      version: key.version
    }));
  }

  /**
   * Obtém estatísticas do gerenciador
   */
  getStats(): {
    totalKeys: number;
    activeKeys: number;
    currentKeyId?: string;
    autoRotationEnabled: boolean;
    nextRotationIn?: number;
  } {
    const activeKeys = Array.from(this.keys.values()).filter(key => key.isActive);
    
    return {
      totalKeys: this.keys.size,
      activeKeys: activeKeys.length,
      currentKeyId: this.currentKeyId,
      autoRotationEnabled: this.rotationConfig.autoRotate,
      nextRotationIn: this.rotationTimer ? this.rotationConfig.rotationInterval : undefined
    };
  }

  /**
   * Limpa todas as chaves (útil para testes)
   */
  clear(): void {
    this.stopAutoRotation();
    this.keys.clear();
    this.currentKeyId = undefined;
  }
}