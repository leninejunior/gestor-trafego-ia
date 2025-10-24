import * as crypto from 'crypto';
import * as tls from 'tls';
import * as https from 'https';
import { PaymentError, PaymentErrorType } from '../types';

/**
 * Configuração para validação de webhook
 */
export interface WebhookSecurityConfig {
  /** Algoritmo de hash para HMAC */
  algorithm: 'sha256' | 'sha1' | 'sha512';
  
  /** Formato da assinatura esperada */
  signatureFormat: 'hex' | 'base64';
  
  /** Prefixo da assinatura (ex: 'sha256=') */
  signaturePrefix?: string;
  
  /** Header onde a assinatura é enviada */
  signatureHeader: string;
  
  /** Tolerância de timestamp em segundos */
  timestampTolerance?: number;
  
  /** Header do timestamp */
  timestampHeader?: string;
}

/**
 * Resultado da validação de assinatura de webhook
 */
export interface WebhookSignatureValidationResult {
  /** Se a validação foi bem-sucedida */
  isValid: boolean;
  
  /** Motivo da falha (se aplicável) */
  reason?: string;
  
  /** Timestamp do webhook */
  timestamp?: Date;
  
  /** Assinatura calculada */
  calculatedSignature?: string;
  
  /** Assinatura recebida */
  receivedSignature?: string;
}

/**
 * Certificado SSL/TLS
 */
export interface SSLCertificate {
  /** Certificado em formato PEM */
  certificate: string;
  
  /** Chave privada em formato PEM */
  privateKey: string;
  
  /** Cadeia de certificados */
  certificateChain?: string[];
  
  /** Data de expiração */
  expiresAt: Date;
  
  /** Domínios cobertos pelo certificado */
  domains: string[];
  
  /** Se o certificado é válido */
  isValid: boolean;
}

/**
 * Serviço de segurança para webhooks e comunicação SSL/TLS
 */
export class WebhookSecurity {
  private certificates: Map<string, SSLCertificate> = new Map();

  /**
   * Valida assinatura HMAC de webhook com proteção contra timing attacks
   */
  validateHmacSignature(
    payload: string,
    signature: string,
    secret: string,
    config: WebhookSecurityConfig
  ): WebhookSignatureValidationResult {
    try {
      // Validações básicas
      if (!payload || typeof payload !== 'string') {
        return {
          isValid: false,
          reason: 'Invalid payload: must be a non-empty string',
          receivedSignature: signature
        };
      }

      if (!signature || typeof signature !== 'string') {
        return {
          isValid: false,
          reason: 'Invalid signature: must be a non-empty string',
          receivedSignature: signature
        };
      }

      if (!secret || typeof secret !== 'string') {
        return {
          isValid: false,
          reason: 'Invalid secret: must be a non-empty string',
          receivedSignature: signature
        };
      }

      // Remove prefixo da assinatura se presente
      let cleanSignature = signature;
      if (config.signaturePrefix) {
        if (signature.startsWith(config.signaturePrefix)) {
          cleanSignature = signature.substring(config.signaturePrefix.length);
        } else {
          return {
            isValid: false,
            reason: `Signature missing expected prefix: ${config.signaturePrefix}`,
            receivedSignature: signature
          };
        }
      }

      // Valida formato da assinatura
      const expectedLength = config.signatureFormat === 'base64' 
        ? this.getBase64Length(config.algorithm)
        : this.getHexLength(config.algorithm);

      if (cleanSignature.length !== expectedLength) {
        return {
          isValid: false,
          reason: `Invalid signature length: expected ${expectedLength}, got ${cleanSignature.length}`,
          receivedSignature: cleanSignature
        };
      }

      // Calcula assinatura esperada
      const hmac = crypto.createHmac(config.algorithm, secret);
      hmac.update(payload, 'utf8');
      
      const calculatedSignature = config.signatureFormat === 'base64' 
        ? hmac.digest('base64')
        : hmac.digest('hex');

      // Comparação segura para evitar timing attacks
      let isValid = false;
      try {
        isValid = crypto.timingSafeEqual(
          Buffer.from(cleanSignature, config.signatureFormat === 'base64' ? 'base64' : 'hex'),
          Buffer.from(calculatedSignature, config.signatureFormat === 'base64' ? 'base64' : 'hex')
        );
      } catch (bufferError) {
        return {
          isValid: false,
          reason: `Invalid signature encoding: ${bufferError instanceof Error ? bufferError.message : 'Unknown error'}`,
          receivedSignature: cleanSignature
        };
      }

      return {
        isValid,
        reason: isValid ? undefined : 'Signature mismatch',
        calculatedSignature,
        receivedSignature: cleanSignature
      };

    } catch (error) {
      return {
        isValid: false,
        reason: `Signature validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        receivedSignature: signature
      };
    }
  }

  /**
   * Obtém o comprimento esperado para assinatura base64
   */
  private getBase64Length(algorithm: string): number {
    const hashLengths: Record<string, number> = {
      'sha1': 28,    // 20 bytes -> 28 chars base64
      'sha256': 44,  // 32 bytes -> 44 chars base64
      'sha512': 88   // 64 bytes -> 88 chars base64
    };
    return hashLengths[algorithm] || 44;
  }

  /**
   * Obtém o comprimento esperado para assinatura hex
   */
  private getHexLength(algorithm: string): number {
    const hashLengths: Record<string, number> = {
      'sha1': 40,    // 20 bytes -> 40 chars hex
      'sha256': 64,  // 32 bytes -> 64 chars hex
      'sha512': 128  // 64 bytes -> 128 chars hex
    };
    return hashLengths[algorithm] || 64;
  }

  /**
   * Valida timestamp do webhook para prevenir replay attacks
   */
  validateTimestamp(
    timestamp: string | number,
    toleranceSeconds: number = 300
  ): WebhookSignatureValidationResult {
    try {
      const webhookTime = typeof timestamp === 'string' 
        ? parseInt(timestamp, 10) 
        : timestamp;

      if (isNaN(webhookTime)) {
        return {
          isValid: false,
          reason: 'Invalid timestamp format'
        };
      }

      const now = Math.floor(Date.now() / 1000);
      const timeDiff = Math.abs(now - webhookTime);

      const isValid = timeDiff <= toleranceSeconds;

      return {
        isValid,
        reason: isValid ? undefined : `Timestamp outside tolerance window (${timeDiff}s > ${toleranceSeconds}s)`,
        timestamp: new Date(webhookTime * 1000)
      };

    } catch (error) {
      return {
        isValid: false,
        reason: `Timestamp validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Valida webhook completo (assinatura + timestamp)
   */
  validateWebhook(
    payload: string,
    headers: Record<string, string>,
    secret: string,
    config: WebhookSecurityConfig
  ): WebhookSignatureValidationResult {
    // Valida assinatura
    const signature = headers[config.signatureHeader.toLowerCase()];
    if (!signature) {
      return {
        isValid: false,
        reason: `Missing signature header: ${config.signatureHeader}`
      };
    }

    const signatureResult = this.validateHmacSignature(payload, signature, secret, config);
    if (!signatureResult.isValid) {
      return signatureResult;
    }

    // Valida timestamp se configurado
    if (config.timestampHeader && config.timestampTolerance) {
      const timestamp = headers[config.timestampHeader.toLowerCase()];
      if (!timestamp) {
        return {
          isValid: false,
          reason: `Missing timestamp header: ${config.timestampHeader}`
        };
      }

      const timestampResult = this.validateTimestamp(timestamp, config.timestampTolerance);
      if (!timestampResult.isValid) {
        return timestampResult;
      }

      return {
        isValid: true,
        timestamp: timestampResult.timestamp,
        calculatedSignature: signatureResult.calculatedSignature,
        receivedSignature: signatureResult.receivedSignature
      };
    }

    return signatureResult;
  }

  /**
   * Gera assinatura HMAC para webhook
   */
  generateHmacSignature(
    payload: string,
    secret: string,
    config: WebhookSecurityConfig
  ): string {
    try {
      const hmac = crypto.createHmac(config.algorithm, secret);
      hmac.update(payload, 'utf8');
      
      const signature = config.signatureFormat === 'base64' 
        ? hmac.digest('base64')
        : hmac.digest('hex');

      return config.signaturePrefix 
        ? `${config.signaturePrefix}${signature}`
        : signature;

    } catch (error) {
      throw new PaymentError(
        PaymentErrorType.CONFIGURATION_ERROR,
        `Failed to generate HMAC signature: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error,
        false
      );
    }
  }

  /**
   * Adiciona certificado SSL/TLS
   */
  addCertificate(domain: string, certificate: SSLCertificate): void {
    this.certificates.set(domain, certificate);
  }

  /**
   * Valida certificado SSL/TLS
   */
  async validateCertificate(domain: string): Promise<{
    isValid: boolean;
    certificate?: SSLCertificate;
    errors?: string[];
  }> {
    const certificate = this.certificates.get(domain);
    if (!certificate) {
      return {
        isValid: false,
        errors: [`No certificate found for domain: ${domain}`]
      };
    }

    const errors: string[] = [];

    try {
      // Verifica se o certificado não expirou
      if (certificate.expiresAt < new Date()) {
        errors.push('Certificate has expired');
      }

      // Verifica se o domínio está coberto pelo certificado
      if (!certificate.domains.includes(domain)) {
        errors.push(`Domain ${domain} not covered by certificate`);
      }

      // Valida formato do certificado
      if (!certificate.certificate.includes('BEGIN CERTIFICATE')) {
        errors.push('Invalid certificate format');
      }

      if (!certificate.privateKey.includes('BEGIN PRIVATE KEY') && 
          !certificate.privateKey.includes('BEGIN RSA PRIVATE KEY')) {
        errors.push('Invalid private key format');
      }

      return {
        isValid: errors.length === 0,
        certificate,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      return {
        isValid: false,
        certificate,
        errors: [`Certificate validation error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Verifica se um certificado está próximo do vencimento
   */
  checkCertificateExpiration(domain: string, warningDays: number = 30): {
    isExpiring: boolean;
    daysUntilExpiration?: number;
    expiresAt?: Date;
  } {
    const certificate = this.certificates.get(domain);
    if (!certificate) {
      return { isExpiring: false };
    }

    const now = new Date();
    const daysUntilExpiration = Math.ceil(
      (certificate.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      isExpiring: daysUntilExpiration <= warningDays,
      daysUntilExpiration,
      expiresAt: certificate.expiresAt
    };
  }

  /**
   * Lista todos os certificados
   */
  listCertificates(): Array<{
    domain: string;
    expiresAt: Date;
    isValid: boolean;
    domains: string[];
  }> {
    return Array.from(this.certificates.entries()).map(([domain, cert]) => ({
      domain,
      expiresAt: cert.expiresAt,
      isValid: cert.isValid,
      domains: cert.domains
    }));
  }

  /**
   * Remove certificado
   */
  removeCertificate(domain: string): boolean {
    return this.certificates.delete(domain);
  }

  /**
   * Limpa todos os certificados
   */
  clearCertificates(): void {
    this.certificates.clear();
  }

  /**
   * Valida certificado SSL/TLS de forma avançada
   */
  async validateAdvancedSSL(hostname: string, port: number = 443): Promise<{
    isValid: boolean;
    certificate?: SSLCertificate;
    tlsVersion?: string;
    cipherSuite?: string;
    errors?: string[];
    warnings?: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Verifica certificado básico
      const certResult = await this.validateCertificate(hostname);
      if (!certResult.isValid && certResult.errors) {
        errors.push(...certResult.errors);
      }

      // Verifica configuração TLS
      const tlsConfig = await this.checkTLSConfiguration(hostname, port);
      
      // Verifica se usa TLS seguro
      if (!this.isSecureTLSVersion(tlsConfig.protocol)) {
        errors.push(`Insecure TLS version: ${tlsConfig.protocol}`);
      }

      // Verifica cipher suite
      if (!this.isSecureCipherSuite(tlsConfig.cipher)) {
        warnings.push(`Weak cipher suite: ${tlsConfig.cipher}`);
      }

      return {
        isValid: errors.length === 0,
        certificate: certResult.certificate,
        tlsVersion: tlsConfig.protocol,
        cipherSuite: tlsConfig.cipher,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [`SSL validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Verifica configuração TLS de um host
   */
  private async checkTLSConfiguration(hostname: string, port: number): Promise<{
    protocol: string;
    cipher: string;
  }> {
    return new Promise((resolve, reject) => {
      const socket = tls.connect(port, hostname, {
        rejectUnauthorized: false,
      });

      socket.on('secureConnect', () => {
        const protocol = socket.getProtocol() || 'Unknown';
        const cipher = socket.getCipher()?.name || 'Unknown';
        
        socket.destroy();
        resolve({ protocol, cipher });
      });

      socket.on('error', (error) => {
        reject(error);
      });

      socket.setTimeout(10000, () => {
        socket.destroy();
        reject(new Error('TLS configuration check timeout'));
      });
    });
  }

  /**
   * Verifica se uma versão TLS é segura
   */
  private isSecureTLSVersion(version: string): boolean {
    const secureVersions = ['TLSv1.2', 'TLSv1.3'];
    return secureVersions.includes(version);
  }

  /**
   * Verifica se um cipher suite é seguro
   */
  private isSecureCipherSuite(cipher: string): boolean {
    // Lista de cipher suites considerados seguros
    const secureCiphers = [
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-ECDSA-AES256-GCM-SHA384',
      'ECDHE-ECDSA-AES128-GCM-SHA256',
      'DHE-RSA-AES256-GCM-SHA384',
      'DHE-RSA-AES128-GCM-SHA256'
    ];

    // Verifica se contém algoritmos seguros
    return secureCiphers.some(secure => cipher.includes(secure)) ||
           (cipher.includes('AES') && cipher.includes('GCM') && cipher.includes('SHA'));
  }

  /**
   * Monitora certificados próximos do vencimento
   */
  async monitorCertificateExpiration(): Promise<Array<{
    domain: string;
    daysUntilExpiration: number;
    isExpiring: boolean;
    isExpired: boolean;
  }>> {
    const results: Array<{
      domain: string;
      daysUntilExpiration: number;
      isExpiring: boolean;
      isExpired: boolean;
    }> = [];

    for (const [domain] of this.certificates) {
      const expirationCheck = this.checkCertificateExpiration(domain, 30);
      const now = new Date();
      const isExpired = expirationCheck.expiresAt ? expirationCheck.expiresAt < now : false;

      results.push({
        domain,
        daysUntilExpiration: expirationCheck.daysUntilExpiration || 0,
        isExpiring: expirationCheck.isExpiring,
        isExpired
      });
    }

    return results;
  }

  /**
   * Valida múltiplos certificados em paralelo
   */
  async validateMultipleCertificates(domains: string[]): Promise<Map<string, {
    isValid: boolean;
    errors?: string[];
    certificate?: SSLCertificate;
  }>> {
    const results = new Map();
    
    const validationPromises = domains.map(async (domain) => {
      try {
        const result = await this.validateCertificate(domain);
        results.set(domain, result);
      } catch (error) {
        results.set(domain, {
          isValid: false,
          errors: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
        });
      }
    });

    await Promise.allSettled(validationPromises);
    return results;
  }

  /**
   * Gera relatório de segurança SSL/TLS
   */
  async generateSecurityReport(domains: string[]): Promise<{
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
  }> {
    const details: Array<{
      domain: string;
      isValid: boolean;
      tlsVersion?: string;
      expiresIn?: number;
      issues: string[];
    }> = [];

    let validCertificates = 0;
    let expiringSoon = 0;
    let expired = 0;
    let insecureTLS = 0;

    for (const domain of domains) {
      const issues: string[] = [];
      
      try {
        const sslResult = await this.validateAdvancedSSL(domain);
        
        if (sslResult.isValid) {
          validCertificates++;
        }

        if (sslResult.errors) {
          issues.push(...sslResult.errors);
        }

        if (sslResult.warnings) {
          issues.push(...sslResult.warnings);
        }

        if (sslResult.tlsVersion && !this.isSecureTLSVersion(sslResult.tlsVersion)) {
          insecureTLS++;
        }

        const expirationCheck = this.checkCertificateExpiration(domain);
        if (expirationCheck.isExpiring) {
          expiringSoon++;
        }

        const now = new Date();
        if (expirationCheck.expiresAt && expirationCheck.expiresAt < now) {
          expired++;
        }

        details.push({
          domain,
          isValid: sslResult.isValid,
          tlsVersion: sslResult.tlsVersion,
          expiresIn: expirationCheck.daysUntilExpiration,
          issues
        });

      } catch (error) {
        details.push({
          domain,
          isValid: false,
          issues: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
        });
      }
    }

    return {
      summary: {
        totalDomains: domains.length,
        validCertificates,
        expiringSoon,
        expired,
        insecureTLS
      },
      details
    };
  }

  /**
   * Cria configuração padrão para diferentes provedores
   */
  static createProviderConfig(provider: 'stripe' | 'paypal' | 'mercadopago' | 'pagseguro'): WebhookSecurityConfig {
    switch (provider) {
      case 'stripe':
        return {
          algorithm: 'sha256',
          signatureFormat: 'hex',
          signaturePrefix: 'v1=',
          signatureHeader: 'stripe-signature',
          timestampTolerance: 300,
          timestampHeader: 'stripe-timestamp'
        };

      case 'paypal':
        return {
          algorithm: 'sha256',
          signatureFormat: 'base64',
          signatureHeader: 'paypal-auth-algo',
          timestampTolerance: 300
        };

      case 'mercadopago':
        return {
          algorithm: 'sha256',
          signatureFormat: 'hex',
          signatureHeader: 'x-signature',
          timestampTolerance: 300
        };

      case 'pagseguro':
        return {
          algorithm: 'sha1',
          signatureFormat: 'hex',
          signatureHeader: 'x-pagseguro-signature',
          timestampTolerance: 300
        };

      default:
        return {
          algorithm: 'sha256',
          signatureFormat: 'hex',
          signatureHeader: 'x-signature',
          timestampTolerance: 300
        };
    }
  }
}