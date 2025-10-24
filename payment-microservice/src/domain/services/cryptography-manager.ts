import * as crypto from 'crypto';
import { CredentialsManager, EncryptionKey, EncryptedData, KeyRotationConfig } from './credentials-manager';
import { WebhookSecurity, WebhookSecurityConfig, SSLCertificate } from './webhook-security';
import { PaymentError, PaymentErrorType } from '../types';

/**
 * Configuração do gerenciador de criptografia
 */
export interface CryptographyConfig {
  /** Configuração de rotação de chaves */
  keyRotation?: Partial<KeyRotationConfig>;
  
  /** Chave mestra para derivação */
  masterKey?: string;
  
  /** Configurações de webhook por provedor */
  webhookConfigs?: Map<string, WebhookSecurityConfig>;
  
  /** Domínios para monitoramento SSL */
  monitoredDomains?: string[];
  
  /** Intervalo de verificação SSL em milissegundos */
  sslCheckInterval?: number;
}

/**
 * Estatísticas do sistema de criptografia
 */
export interface CryptographyStats {
  /** Estatísticas das chaves */
  keys: {
    total: number;
    active: number;
    currentKeyId?: string;
    autoRotationEnabled: boolean;
  };
  
  /** Estatísticas dos certificados */
  certificates: {
    total: number;
    valid: number;
    expiringSoon: number;
    expired: number;
  };
  
  /** Estatísticas de webhooks */
  webhooks: {
    totalProviders: number;
    validationsToday: number;
    failedValidations: number;
  };
}

/**
 * Gerenciador centralizado de criptografia
 * Integra gerenciamento de credenciais, segurança de webhooks e validação SSL/TLS
 */
export class CryptographyManager {
  private credentialsManager: CredentialsManager;
  private webhookSecurity: WebhookSecurity;
  private config: CryptographyConfig;
  private sslMonitorTimer?: NodeJS.Timeout;
  private webhookStats = {
    validationsToday: 0,
    failedValidations: 0
  };

  constructor(config: CryptographyConfig = {}) {
    this.config = config;
    this.credentialsManager = new CredentialsManager(config.keyRotation);
    this.webhookSecurity = new WebhookSecurity();
    
    // Configura webhooks para provedores conhecidos
    this.setupDefaultWebhookConfigs();
    
    // Inicia monitoramento SSL se configurado
    if (config.monitoredDomains && config.monitoredDomains.length > 0) {
      this.startSSLMonitoring();
    }
  }

  /**
   * Inicializa o gerenciador de criptografia
   */
  async initialize(): Promise<void> {
    try {
      await this.credentialsManager.initialize(this.config.masterKey);
    } catch (error) {
      throw new PaymentError(
        PaymentErrorType.CONFIGURATION_ERROR,
        `Failed to initialize cryptography manager: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error,
        false
      );
    }
  }

  /**
   * Criptografa dados sensíveis
   */
  async encryptData(data: string): Promise<EncryptedData> {
    return this.credentialsManager.encrypt(data);
  }

  /**
   * Descriptografa dados
   */
  async decryptData(encryptedData: EncryptedData): Promise<string> {
    return this.credentialsManager.decrypt(encryptedData);
  }

  /**
   * Criptografa credenciais de provedor
   */
  async encryptProviderCredentials(
    providerName: string,
    credentials: Record<string, string>
  ): Promise<Record<string, EncryptedData>> {
    try {
      return await this.credentialsManager.encryptCredentials(credentials);
    } catch (error) {
      throw new PaymentError(
        PaymentErrorType.CONFIGURATION_ERROR,
        `Failed to encrypt credentials for provider ${providerName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error,
        false
      );
    }
  }

  /**
   * Descriptografa credenciais de provedor
   */
  async decryptProviderCredentials(
    providerName: string,
    encryptedCredentials: Record<string, EncryptedData>
  ): Promise<Record<string, string>> {
    try {
      return await this.credentialsManager.decryptCredentials(encryptedCredentials);
    } catch (error) {
      throw new PaymentError(
        PaymentErrorType.CONFIGURATION_ERROR,
        `Failed to decrypt credentials for provider ${providerName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error,
        false
      );
    }
  }

  /**
   * Valida webhook de provedor
   */
  async validateProviderWebhook(
    providerName: string,
    payload: string,
    headers: Record<string, string>,
    secret: string
  ): Promise<{
    isValid: boolean;
    reason?: string;
    timestamp?: Date;
  }> {
    try {
      const config = this.config.webhookConfigs?.get(providerName) ||
                    WebhookSecurity.createProviderConfig(providerName as any);

      const result = this.webhookSecurity.validateWebhook(payload, headers, secret, config);
      
      // Atualiza estatísticas
      this.webhookStats.validationsToday++;
      if (!result.isValid) {
        this.webhookStats.failedValidations++;
      }

      return result;
    } catch (error) {
      this.webhookStats.failedValidations++;
      throw new PaymentError(
        PaymentErrorType.VALIDATION_ERROR,
        `Webhook validation failed for provider ${providerName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error,
        true
      );
    }
  }

  /**
   * Gera assinatura para webhook
   */
  generateWebhookSignature(
    providerName: string,
    payload: string,
    secret: string
  ): string {
    const config = this.config.webhookConfigs?.get(providerName) ||
                  WebhookSecurity.createProviderConfig(providerName as any);

    return this.webhookSecurity.generateHmacSignature(payload, secret, config);
  }

  /**
   * Adiciona certificado SSL para monitoramento
   */
  addSSLCertificate(domain: string, certificate: SSLCertificate): void {
    this.webhookSecurity.addCertificate(domain, certificate);
  }

  /**
   * Valida certificado SSL/TLS
   */
  async validateSSLCertificate(domain: string): Promise<{
    isValid: boolean;
    certificate?: SSLCertificate;
    errors?: string[];
  }> {
    return this.webhookSecurity.validateCertificate(domain);
  }

  /**
   * Valida SSL avançado com verificação TLS
   */
  async validateAdvancedSSL(domain: string, port: number = 443): Promise<{
    isValid: boolean;
    certificate?: SSLCertificate;
    tlsVersion?: string;
    cipherSuite?: string;
    errors?: string[];
    warnings?: string[];
  }> {
    return this.webhookSecurity.validateAdvancedSSL(domain, port);
  }

  /**
   * Rotaciona chaves de criptografia
   */
  async rotateEncryptionKeys(): Promise<EncryptionKey> {
    return this.credentialsManager.rotateKeys();
  }

  /**
   * Gera nova chave de criptografia
   */
  async generateNewEncryptionKey(): Promise<EncryptionKey> {
    return this.credentialsManager.generateNewKey();
  }

  /**
   * Monitora certificados próximos do vencimento
   */
  async checkCertificateExpirations(): Promise<Array<{
    domain: string;
    daysUntilExpiration: number;
    isExpiring: boolean;
    isExpired: boolean;
  }>> {
    return this.webhookSecurity.monitorCertificateExpiration();
  }

  /**
   * Gera relatório de segurança completo
   */
  async generateSecurityReport(): Promise<{
    ssl: {
      summary: {
        totalDomains: number;
        validCertificates: number;
        expiringSoon: number;
        expired: number;
        insecureTLS: number;
      };
      details: Array<{
        domain: string;
        isValid: boolean;
        tlsVersion?: string;
        expiresIn?: number;
        issues: string[];
      }>;
    };
    encryption: {
      keys: Array<Omit<EncryptionKey, 'key'>>;
      stats: any;
    };
    webhooks: {
      validationsToday: number;
      failedValidations: number;
      successRate: number;
    };
  }> {
    const domains = this.config.monitoredDomains || [];
    const sslReport = await this.webhookSecurity.generateSecurityReport(domains);
    
    const successRate = this.webhookStats.validationsToday > 0 
      ? ((this.webhookStats.validationsToday - this.webhookStats.failedValidations) / this.webhookStats.validationsToday) * 100
      : 100;

    return {
      ssl: sslReport,
      encryption: {
        keys: this.credentialsManager.listKeys(),
        stats: this.credentialsManager.getStats()
      },
      webhooks: {
        validationsToday: this.webhookStats.validationsToday,
        failedValidations: this.webhookStats.failedValidations,
        successRate
      }
    };
  }

  /**
   * Obtém estatísticas do sistema de criptografia
   */
  getStats(): CryptographyStats {
    const keyStats = this.credentialsManager.getStats();
    const certificates = this.webhookSecurity.listCertificates();
    
    const now = new Date();
    const validCertificates = certificates.filter(cert => cert.isValid).length;
    const expiringSoon = certificates.filter(cert => {
      const daysUntilExpiration = Math.ceil(
        (cert.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysUntilExpiration <= 30 && daysUntilExpiration > 0;
    }).length;
    const expired = certificates.filter(cert => cert.expiresAt < now).length;

    return {
      keys: {
        total: keyStats.totalKeys,
        active: keyStats.activeKeys,
        currentKeyId: keyStats.currentKeyId,
        autoRotationEnabled: keyStats.autoRotationEnabled
      },
      certificates: {
        total: certificates.length,
        valid: validCertificates,
        expiringSoon,
        expired
      },
      webhooks: {
        totalProviders: this.config.webhookConfigs?.size || 0,
        validationsToday: this.webhookStats.validationsToday,
        failedValidations: this.webhookStats.failedValidations
      }
    };
  }

  /**
   * Configura webhooks padrão para provedores conhecidos
   */
  private setupDefaultWebhookConfigs(): void {
    if (!this.config.webhookConfigs) {
      this.config.webhookConfigs = new Map();
    }

    const providers = ['stripe', 'paypal', 'mercadopago', 'pagseguro'] as const;
    
    providers.forEach(provider => {
      if (!this.config.webhookConfigs!.has(provider)) {
        this.config.webhookConfigs!.set(
          provider,
          WebhookSecurity.createProviderConfig(provider)
        );
      }
    });
  }

  /**
   * Inicia monitoramento SSL automático
   */
  private startSSLMonitoring(): void {
    if (this.sslMonitorTimer) {
      clearInterval(this.sslMonitorTimer);
    }

    const interval = this.config.sslCheckInterval || 24 * 60 * 60 * 1000; // 24 horas

    this.sslMonitorTimer = setInterval(async () => {
      try {
        await this.performSSLCheck();
      } catch (error) {
        console.error('SSL monitoring check failed:', error);
      }
    }, interval);
  }

  /**
   * Executa verificação SSL
   */
  private async performSSLCheck(): Promise<void> {
    if (!this.config.monitoredDomains) return;

    const expirations = await this.checkCertificateExpirations();
    
    // Log certificados próximos do vencimento
    expirations.forEach(cert => {
      if (cert.isExpiring) {
        console.warn(`Certificate for ${cert.domain} expires in ${cert.daysUntilExpiration} days`);
      }
      if (cert.isExpired) {
        console.error(`Certificate for ${cert.domain} has expired`);
      }
    });
  }

  /**
   * Para monitoramento SSL
   */
  stopSSLMonitoring(): void {
    if (this.sslMonitorTimer) {
      clearInterval(this.sslMonitorTimer);
      this.sslMonitorTimer = undefined;
    }
  }

  /**
   * Limpa recursos e para processos automáticos
   */
  destroy(): void {
    this.credentialsManager.stopAutoRotation();
    this.stopSSLMonitoring();
    this.webhookSecurity.clearCertificates();
    this.credentialsManager.clear();
  }
}