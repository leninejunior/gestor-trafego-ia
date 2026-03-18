import * as crypto from 'crypto';
import * as tls from 'tls';
import * as https from 'https';
import { config } from '../config/environment';

/**
 * Configuração de rotação de chaves
 */
export interface KeyRotationConfig {
  /** Intervalo de rotação em milissegundos */
  rotationInterval: number;
  /** Número máximo de chaves ativas */
  maxActiveKeys: number;
  /** Tempo de retenção de chaves antigas */
  keyRetentionTime: number;
  /** Auto rotação habilitada */
  autoRotate: boolean;
}

/**
 * Informações de certificado SSL/TLS
 */
export interface CertificateInfo {
  /** Subject do certificado */
  subject: string;
  /** Issuer do certificado */
  issuer: string;
  /** Data de validade */
  validTo: Date;
  /** Data de início */
  validFrom: Date;
  /** Nomes alternativos */
  subjectAltNames: string[];
  /** Fingerprint */
  fingerprint: string;
  /** Se é válido */
  isValid: boolean;
}

export class EncryptionService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;
  private readonly key: Buffer;
  private rotationConfig: KeyRotationConfig;
  private rotationTimer?: NodeJS.Timeout;

  constructor(rotationConfig?: Partial<KeyRotationConfig>) {
    // Derive key from the configured encryption key
    this.key = crypto.scryptSync(config.security.encryptionKey, 'salt', this.keyLength);
    
    this.rotationConfig = {
      rotationInterval: 24 * 60 * 60 * 1000, // 24 horas
      maxActiveKeys: 3,
      keyRetentionTime: 7 * 24 * 60 * 60 * 1000, // 7 dias
      autoRotate: true,
      ...rotationConfig
    };

    if (this.rotationConfig.autoRotate) {
      this.startKeyRotation();
    }
  }

  encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Combine iv and encrypted data
      const combined = Buffer.concat([iv, Buffer.from(encrypted, 'hex')]);
      return combined.toString('base64');
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  decrypt(encryptedData: string): string {
    try {
      const combined = Buffer.from(encryptedData, 'base64');
      
      // Extract iv and encrypted data
      const iv = combined.subarray(0, this.ivLength);
      const encrypted = combined.subarray(this.ivLength);

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);

      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  generateRandomKey(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  verifySignature(data: string, signature: string, secret: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(data)
        .digest('hex');
      
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      return false;
    }
  }

  createSignature(data: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  }

  /**
   * Gera nova chave de criptografia
   */
  generateNewKey(): Buffer {
    return crypto.randomBytes(this.keyLength);
  }

  /**
   * Deriva chave usando PBKDF2
   */
  deriveKey(password: string, salt: Buffer, iterations: number = 100000): Buffer {
    return crypto.pbkdf2Sync(password, salt, iterations, this.keyLength, 'sha256');
  }

  /**
   * Inicia rotação automática de chaves
   */
  private startKeyRotation(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
    }

    this.rotationTimer = setInterval(() => {
      try {
        this.rotateKey();
      } catch (error) {
        console.error('Key rotation failed:', error);
      }
    }, this.rotationConfig.rotationInterval);
  }

  /**
   * Para rotação automática de chaves
   */
  stopKeyRotation(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = undefined;
    }
  }

  /**
   * Rotaciona chave de criptografia
   */
  private rotateKey(): void {
    // Em uma implementação real, isso seria mais complexo
    // envolvendo persistência e sincronização entre instâncias
    console.log('Key rotation triggered at:', new Date().toISOString());
  }

  /**
   * Valida certificado SSL/TLS de um host
   */
  async validateSSLCertificate(hostname: string, port: number = 443): Promise<CertificateInfo> {
    return new Promise((resolve, reject) => {
      const options = {
        host: hostname,
        port: port,
        method: 'GET',
        rejectUnauthorized: false, // Para poder analisar certificados inválidos
      };

      const req = https.request(options, (res) => {
        const cert = (res.socket as any).getPeerCertificate();
        
        if (!cert || Object.keys(cert).length === 0) {
          reject(new Error('No certificate found'));
          return;
        }

        const certInfo: CertificateInfo = {
          subject: cert.subject?.CN || 'Unknown',
          issuer: cert.issuer?.CN || 'Unknown',
          validTo: new Date(cert.valid_to),
          validFrom: new Date(cert.valid_from),
          subjectAltNames: cert.subjectaltname ? cert.subjectaltname.split(', ') : [],
          fingerprint: cert.fingerprint || '',
          isValid: this.isCertificateValid(cert, hostname)
        };

        resolve(certInfo);
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Certificate validation timeout'));
      });

      req.end();
    });
  }

  /**
   * Verifica se um certificado é válido
   */
  private isCertificateValid(cert: any, hostname: string): boolean {
    const now = new Date();
    const validFrom = new Date(cert.valid_from);
    const validTo = new Date(cert.valid_to);

    // Verifica se está dentro do período de validade
    if (now < validFrom || now > validTo) {
      return false;
    }

    // Verifica se o hostname está coberto pelo certificado
    const subjectCN = cert.subject?.CN;
    const altNames = cert.subjectaltname ? cert.subjectaltname.split(', ') : [];
    
    const coveredNames = [subjectCN, ...altNames.map((name: string) => name.replace('DNS:', ''))];
    
    return coveredNames.some(name => {
      if (!name) return false;
      
      // Suporte a wildcards
      if (name.startsWith('*.')) {
        const domain = name.substring(2);
        return hostname.endsWith(domain) && hostname !== domain;
      }
      
      return name === hostname;
    });
  }

  /**
   * Verifica configuração TLS de um host
   */
  async checkTLSConfiguration(hostname: string, port: number = 443): Promise<{
    protocol: string;
    cipher: string;
    isSecure: boolean;
    supportedProtocols: string[];
  }> {
    return new Promise((resolve, reject) => {
      const socket = tls.connect(port, hostname, {
        rejectUnauthorized: false,
      });

      socket.on('secureConnect', () => {
        const protocol = socket.getProtocol();
        const cipher = socket.getCipher();
        
        const result = {
          protocol: protocol || 'Unknown',
          cipher: cipher?.name || 'Unknown',
          isSecure: this.isSecureProtocol(protocol || undefined),
          supportedProtocols: this.getSupportedProtocols(socket)
        };

        socket.destroy();
        resolve(result);
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
   * Verifica se um protocolo TLS é seguro
   */
  private isSecureProtocol(protocol?: string): boolean {
    if (!protocol) return false;
    
    const secureProtocols = ['TLSv1.2', 'TLSv1.3'];
    return secureProtocols.includes(protocol);
  }

  /**
   * Obtém protocolos suportados (simulado)
   */
  private getSupportedProtocols(socket: tls.TLSSocket): string[] {
    // Em uma implementação real, isso seria mais complexo
    const protocol = socket.getProtocol();
    return protocol ? [protocol] : [];
  }

  /**
   * Cria assinatura digital para webhook
   */
  createWebhookSignature(payload: string, secret: string, algorithm: string = 'sha256'): string {
    return crypto
      .createHmac(algorithm, secret)
      .update(payload, 'utf8')
      .digest('hex');
  }

  /**
   * Verifica assinatura digital de webhook
   */
  verifyWebhookSignature(
    payload: string, 
    signature: string, 
    secret: string, 
    algorithm: string = 'sha256'
  ): boolean {
    try {
      const expectedSignature = this.createWebhookSignature(payload, secret, algorithm);
      
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Gera salt criptográfico
   */
  generateSalt(length: number = 32): Buffer {
    return crypto.randomBytes(length);
  }

  /**
   * Obtém estatísticas do serviço de criptografia
   */
  getStats(): {
    algorithm: string;
    keyLength: number;
    autoRotationEnabled: boolean;
    rotationInterval?: number;
  } {
    return {
      algorithm: this.algorithm,
      keyLength: this.keyLength,
      autoRotationEnabled: this.rotationConfig.autoRotate,
      rotationInterval: this.rotationConfig.autoRotate ? this.rotationConfig.rotationInterval : undefined
    };
  }

  /**
   * Limpa recursos
   */
  destroy(): void {
    this.stopKeyRotation();
  }
}