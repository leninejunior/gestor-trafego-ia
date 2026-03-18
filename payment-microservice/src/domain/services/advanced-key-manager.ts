import * as crypto from 'crypto';
import { EncryptionKey, EncryptedData, KeyRotationConfig } from './credentials-manager';
import { PaymentError, PaymentErrorType } from '../types';

/**
 * Configuração avançada para gerenciamento de chaves
 */
export interface AdvancedKeyConfig extends KeyRotationConfig {
  /** Algoritmo de derivação de chave */
  keyDerivationAlgorithm: 'pbkdf2' | 'scrypt' | 'argon2';
  
  /** Número de iterações para derivação */
  derivationIterations: number;
  
  /** Tamanho do salt em bytes */
  saltSize: number;
  
  /** Habilita backup automático de chaves */
  enableKeyBackup: boolean;
  
  /** Caminho para backup de chaves */
  keyBackupPath?: string;
  
  /** Habilita sincronização entre instâncias */
  enableDistributedSync: boolean;
  
  /** URL do serviço de sincronização */
  syncServiceUrl?: string;
}

/**
 * Metadados de chave para auditoria
 */
export interface KeyMetadata {
  /** ID da chave */
  keyId: string;
  
  /** Versão da chave */
  version: number;
  
  /** Algoritmo usado */
  algorithm: string;
  
  /** Data de criação */
  createdAt: Date;
  
  /** Data de ativação */
  activatedAt?: Date;
  
  /** Data de desativação */
  deactivatedAt?: Date;
  
  /** Motivo da rotação */
  rotationReason?: string;
  
  /** Hash da chave anterior */
  previousKeyHash?: string;
  
  /** Usuário que criou a chave */
  createdBy?: string;
  
  /** Ambiente (dev, staging, prod) */
  environment: string;
}

/**
 * Resultado de operação de chave
 */
export interface KeyOperationResult {
  /** Se a operação foi bem-sucedida */
  success: boolean;
  
  /** ID da chave afetada */
  keyId?: string;
  
  /** Mensagem de resultado */
  message: string;
  
  /** Metadados da operação */
  metadata?: KeyMetadata;
  
  /** Erro, se houver */
  error?: Error;
}

/**
 * Gerenciador avançado de chaves com recursos empresariais
 */
export class AdvancedKeyManager {
  private keys: Map<string, EncryptionKey> = new Map();
  private keyMetadata: Map<string, KeyMetadata> = new Map();
  private currentKeyId?: string;
  private config: AdvancedKeyConfig;
  private rotationTimer?: NodeJS.Timeout;
  private syncTimer?: NodeJS.Timeout;

  private readonly defaultConfig: AdvancedKeyConfig = {
    rotationInterval: 24 * 60 * 60 * 1000, // 24 horas
    maxActiveKeys: 5,
    keyRetentionTime: 30 * 24 * 60 * 60 * 1000, // 30 dias
    autoRotate: true,
    keyDerivationAlgorithm: 'scrypt',
    derivationIterations: 100000,
    saltSize: 32,
    enableKeyBackup: true,
    enableDistributedSync: false
  };

  constructor(config: Partial<AdvancedKeyConfig> = {}) {
    this.config = { ...this.defaultConfig, ...config };
    
    if (this.config.autoRotate) {
      this.startAutoRotation();
    }
    
    if (this.config.enableDistributedSync && this.config.syncServiceUrl) {
      this.startDistributedSync();
    }
  }

  /**
   * Inicializa o gerenciador com chave mestra
   */
  async initialize(masterKey?: string, environment: string = 'development'): Promise<KeyOperationResult> {
    try {
      if (masterKey) {
        const result = await this.createKeyFromMaster(masterKey, environment);
        return {
          success: true,
          keyId: result.id,
          message: 'Key manager initialized with master key',
          metadata: this.keyMetadata.get(result.id)
        };
      } else {
        const result = await this.generateNewKey(environment, 'initial_setup');
        return {
          success: true,
          keyId: result.id,
          message: 'Key manager initialized with generated key',
          metadata: this.keyMetadata.get(result.id)
        };
      }
    } catch (error) {
      return {
        success: false,
        message: 'Failed to initialize key manager',
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }

  /**
   * Gera nova chave com metadados completos
   */
  async generateNewKey(
    environment: string = 'development',
    rotationReason?: string,
    createdBy?: string
  ): Promise<EncryptionKey> {
    try {
      const keyId = Date.now().toString(36) + Math.random().toString(36).substr(2);
      const keyBuffer = await this.generateSecureKey();
      
      const newKey: EncryptionKey = {
        id: keyId,
        key: keyBuffer.toString('base64'),
        algorithm: 'aes-256-gcm',
        createdAt: new Date(),
        isActive: true,
        version: this.keys.size + 1
      };

      // Cria metadados
      const metadata: KeyMetadata = {
        keyId,
        version: newKey.version,
        algorithm: newKey.algorithm,
        createdAt: newKey.createdAt,
        activatedAt: new Date(),
        rotationReason,
        createdBy,
        environment,
        previousKeyHash: this.currentKeyId ? this.hashKey(this.currentKeyId) : undefined
      };

      // Armazena chave e metadados
      this.keys.set(keyId, newKey);
      this.keyMetadata.set(keyId, metadata);
      
      // Desativa chave anterior
      if (this.currentKeyId) {
        const previousKey = this.keys.get(this.currentKeyId);
        if (previousKey) {
          previousKey.isActive = false;
          const previousMetadata = this.keyMetadata.get(this.currentKeyId);
          if (previousMetadata) {
            previousMetadata.deactivatedAt = new Date();
          }
        }
      }

      this.currentKeyId = keyId;

      // Backup se habilitado
      if (this.config.enableKeyBackup) {
        await this.backupKey(newKey, metadata);
      }

      // Limpa chaves antigas
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
   * Cria chave a partir de chave mestra com derivação segura
   */
  private async createKeyFromMaster(
    masterKey: string,
    environment: string,
    createdBy?: string
  ): Promise<EncryptionKey> {
    try {
      const salt = crypto.randomBytes(this.config.saltSize);
      let derivedKey: Buffer;

      // Usa algoritmo de derivação configurado
      switch (this.config.keyDerivationAlgorithm) {
        case 'pbkdf2':
          derivedKey = crypto.pbkdf2Sync(
            masterKey,
            salt,
            this.config.derivationIterations,
            32,
            'sha256'
          );
          break;
          
        case 'scrypt':
          derivedKey = crypto.scryptSync(
            masterKey,
            salt,
            32,
            {
              N: 16384,
              r: 8,
              p: 1
            }
          );
          break;
          
        default:
          throw new Error(`Unsupported key derivation algorithm: ${this.config.keyDerivationAlgorithm}`);
      }
      
      const keyId = Date.now().toString(36) + Math.random().toString(36).substr(2);
      
      const newKey: EncryptionKey = {
        id: keyId,
        key: derivedKey.toString('base64'),
        algorithm: 'aes-256-gcm',
        createdAt: new Date(),
        isActive: true,
        version: 1
      };

      // Cria metadados
      const metadata: KeyMetadata = {
        keyId,
        version: 1,
        algorithm: newKey.algorithm,
        createdAt: newKey.createdAt,
        activatedAt: new Date(),
        rotationReason: 'master_key_derivation',
        createdBy,
        environment
      };

      this.keys.set(keyId, newKey);
      this.keyMetadata.set(keyId, metadata);
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
   * Gera chave criptograficamente segura
   */
  private async generateSecureKey(): Promise<Buffer> {
    // Use synchronous version for better performance in tests
    return crypto.randomBytes(32);
  }

  /**
   * Rotaciona chaves com auditoria completa
   */
  async rotateKeys(
    reason: string = 'scheduled_rotation',
    createdBy?: string,
    environment: string = 'development'
  ): Promise<KeyOperationResult> {
    try {
      const oldKeyId = this.currentKeyId;
      const newKey = await this.generateNewKey(environment, reason, createdBy);

      return {
        success: true,
        keyId: newKey.id,
        message: `Key rotation completed. Old key: ${oldKeyId}, New key: ${newKey.id}`,
        metadata: this.keyMetadata.get(newKey.id)
      };

    } catch (error) {
      return {
        success: false,
        message: 'Key rotation failed',
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }

  /**
   * Força rotação de emergência
   */
  async emergencyRotation(
    reason: string,
    createdBy: string,
    environment: string = 'production'
  ): Promise<KeyOperationResult> {
    try {
      // Primeiro gera nova chave
      const newKey = await this.generateNewKey(environment, `emergency: ${reason}`, createdBy);

      // Depois desativa todas as outras chaves ativas
      for (const [keyId, key] of this.keys) {
        if (key.isActive && keyId !== newKey.id) {
          key.isActive = false;
          const metadata = this.keyMetadata.get(keyId);
          if (metadata) {
            metadata.deactivatedAt = new Date();
            metadata.rotationReason = `emergency_rotation: ${reason}`;
          }
        }
      }

      return {
        success: true,
        keyId: newKey.id,
        message: `Emergency key rotation completed. Reason: ${reason}`,
        metadata: this.keyMetadata.get(newKey.id)
      };

    } catch (error) {
      return {
        success: false,
        message: 'Emergency key rotation failed',
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }

  /**
   * Faz backup de chave (simulado - em produção seria para HSM ou vault)
   */
  private async backupKey(key: EncryptionKey, metadata: KeyMetadata): Promise<void> {
    try {
      // Em produção, isso seria integrado com um sistema de backup seguro
      const backupData = {
        keyId: key.id,
        algorithm: key.algorithm,
        version: key.version,
        createdAt: key.createdAt,
        metadata,
        // Chave seria criptografada com chave de backup
        encryptedKey: this.encryptForBackup(key.key)
      };

      // Simula backup (em produção seria persistido de forma segura)
      console.log(`Key backup created for ${key.id} at ${new Date().toISOString()}`);
      
    } catch (error) {
      console.error('Key backup failed:', error);
      // Em produção, isso seria um alerta crítico
    }
  }

  /**
   * Criptografa chave para backup (simulado)
   */
  private encryptForBackup(keyData: string): string {
    // Em produção, usaria chave de backup dedicada
    const backupKey = crypto.scryptSync('backup-master-key', 'backup-salt', 32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', backupKey, iv);
    
    let encrypted = cipher.update(keyData, 'base64', 'base64');
    encrypted += cipher.final('base64');
    
    const authTag = cipher.getAuthTag();
    
    return Buffer.concat([
      iv,
      authTag,
      Buffer.from(encrypted, 'base64')
    ]).toString('base64');
  }

  /**
   * Gera hash de chave para auditoria
   */
  private hashKey(keyId: string): string {
    const key = this.keys.get(keyId);
    if (!key) return '';
    
    return crypto.createHash('sha256')
      .update(key.key)
      .digest('hex');
  }

  /**
   * Remove chaves antigas baseado na política de retenção
   */
  private async cleanupOldKeys(): Promise<void> {
    const now = new Date();
    const keysToRemove: string[] = [];

    for (const [keyId, key] of this.keys) {
      const metadata = this.keyMetadata.get(keyId);
      
      // Remove chaves expiradas
      if (key.expiresAt && key.expiresAt < now) {
        keysToRemove.push(keyId);
        continue;
      }

      // Remove chaves antigas inativas (apenas se passaram do tempo de retenção)
      if (!key.isActive && metadata?.deactivatedAt) {
        const keyAge = now.getTime() - metadata.deactivatedAt.getTime();
        if (keyAge > this.config.keyRetentionTime) {
          keysToRemove.push(keyId);
        }
      }
    }

    // Mantém apenas o número máximo de chaves ativas
    const activeKeys = Array.from(this.keys.values())
      .filter(key => key.isActive)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (activeKeys.length > this.config.maxActiveKeys) {
      const excessKeys = activeKeys.slice(this.config.maxActiveKeys);
      excessKeys.forEach(key => {
        key.isActive = false;
        const metadata = this.keyMetadata.get(key.id);
        if (metadata) {
          metadata.deactivatedAt = new Date();
          metadata.rotationReason = 'max_keys_exceeded';
        }
        // Não remove imediatamente, apenas desativa
      });
    }

    // Remove chaves marcadas
    keysToRemove.forEach(keyId => {
      this.keys.delete(keyId);
      this.keyMetadata.delete(keyId);
    });

    if (keysToRemove.length > 0) {
      console.log(`Cleaned up ${keysToRemove.length} old keys`);
    }
  }

  /**
   * Inicia rotação automática
   */
  private startAutoRotation(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
    }

    this.rotationTimer = setInterval(async () => {
      try {
        await this.rotateKeys('scheduled_rotation', 'system');
      } catch (error) {
        console.error('Auto key rotation failed:', error);
      }
    }, this.config.rotationInterval);
  }

  /**
   * Inicia sincronização distribuída (simulado)
   */
  private startDistributedSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(async () => {
      try {
        await this.syncWithRemote();
      } catch (error) {
        console.error('Distributed sync failed:', error);
      }
    }, 60000); // Sync a cada minuto
  }

  /**
   * Sincroniza com serviço remoto (simulado)
   */
  private async syncWithRemote(): Promise<void> {
    // Em produção, isso sincronizaria com um serviço de chaves distribuído
    console.log('Syncing keys with remote service...');
  }

  /**
   * Obtém relatório de auditoria de chaves
   */
  getAuditReport(): {
    summary: {
      totalKeys: number;
      activeKeys: number;
      inactiveKeys: number;
      currentKeyId?: string;
      lastRotation?: Date;
    };
    keys: Array<KeyMetadata & { isActive: boolean }>;
  } {
    const activeKeys = Array.from(this.keys.values()).filter(key => key.isActive);
    const inactiveKeys = Array.from(this.keys.values()).filter(key => !key.isActive);
    
    const lastRotation = Array.from(this.keyMetadata.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]?.createdAt;

    const keys = Array.from(this.keyMetadata.values()).map(metadata => ({
      ...metadata,
      isActive: this.keys.get(metadata.keyId)?.isActive || false
    }));

    return {
      summary: {
        totalKeys: this.keys.size,
        activeKeys: activeKeys.length,
        inactiveKeys: inactiveKeys.length,
        currentKeyId: this.currentKeyId,
        lastRotation
      },
      keys
    };
  }

  /**
   * Para todos os processos automáticos
   */
  destroy(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = undefined;
    }
    
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
    
    this.keys.clear();
    this.keyMetadata.clear();
    this.currentKeyId = undefined;
  }
}