/**
 * Graceful Degradation Service
 * 
 * Implementa degradação graciosa para quando serviços externos falham,
 * mantendo funcionalidade básica do sistema
 */

export enum ServiceStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNAVAILABLE = 'unavailable'
}

export interface ServiceHealth {
  name: string;
  status: ServiceStatus;
  lastCheck: Date;
  errorCount: number;
  responseTime?: number;
  message?: string;
}

export interface DegradationConfig {
  checkInterval: number;
  healthyThreshold: number;
  degradedThreshold: number;
  maxErrorCount: number;
  services: string[];
}

export interface FallbackStrategy {
  serviceName: string;
  fallbackFunction: () => Promise<any>;
  cacheKey?: string;
  cacheTTL?: number;
}

/**
 * Gerenciador de degradação graciosa
 */
export class GracefulDegradationManager {
  private serviceHealth = new Map<string, ServiceHealth>();
  private fallbackStrategies = new Map<string, FallbackStrategy>();
  private localCache = new Map<string, { data: any; expires: Date }>();
  private healthCheckInterval?: NodeJS.Timeout;

  private config: DegradationConfig = {
    checkInterval: 30000, // 30 segundos
    healthyThreshold: 2000, // 2 segundos
    degradedThreshold: 5000, // 5 segundos
    maxErrorCount: 3,
    services: ['iugu', 'database', 'feature-gate']
  };

  constructor(config?: Partial<DegradationConfig>) {
    this.config = { ...this.config, ...config };
    this.initializeServices();
  }

  /**
   * Inicializa monitoramento de serviços
   */
  private initializeServices(): void {
    this.config.services.forEach(service => {
      this.serviceHealth.set(service, {
        name: service,
        status: ServiceStatus.HEALTHY,
        lastCheck: new Date(),
        errorCount: 0
      });
    });
  }

  /**
   * Inicia monitoramento contínuo de saúde dos serviços
   */
  startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.config.checkInterval);

    console.log('[GracefulDegradation] Health monitoring started');
  }

  /**
   * Para monitoramento de saúde
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  /**
   * Executa verificações de saúde em todos os serviços
   */
  private async performHealthChecks(): Promise<void> {
    const promises = Array.from(this.serviceHealth.keys()).map(service => 
      this.checkServiceHealth(service)
    );

    await Promise.allSettled(promises);
  }

  /**
   * Verifica saúde de um serviço específico
   */
  async checkServiceHealth(serviceName: string): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      let isHealthy = false;
      
      switch (serviceName) {
        case 'iugu':
          isHealthy = await this.checkIuguHealth();
          break;
        case 'database':
          isHealthy = await this.checkDatabaseHealth();
          break;
        case 'feature-gate':
          isHealthy = await this.checkFeatureGateHealth();
          break;
        default:
          console.warn(`[GracefulDegradation] Unknown service: ${serviceName}`);
          return this.serviceHealth.get(serviceName)!;
      }

      const responseTime = Date.now() - startTime;
      const health = this.updateServiceHealth(serviceName, isHealthy, responseTime);
      
      return health;
      
    } catch (error) {
      console.error(`[GracefulDegradation] Health check failed for ${serviceName}:`, error);
      return this.updateServiceHealth(serviceName, false);
    }
  }

  /**
   * Atualiza status de saúde de um serviço
   */
  private updateServiceHealth(
    serviceName: string, 
    isHealthy: boolean, 
    responseTime?: number
  ): ServiceHealth {
    const current = this.serviceHealth.get(serviceName)!;
    
    if (isHealthy) {
      current.errorCount = 0;
      current.responseTime = responseTime;
      
      if (responseTime && responseTime > this.config.degradedThreshold) {
        current.status = ServiceStatus.DEGRADED;
        current.message = `High response time: ${responseTime}ms`;
      } else {
        current.status = ServiceStatus.HEALTHY;
        current.message = undefined;
      }
    } else {
      current.errorCount++;
      
      if (current.errorCount >= this.config.maxErrorCount) {
        current.status = ServiceStatus.UNAVAILABLE;
        current.message = `Service unavailable (${current.errorCount} consecutive failures)`;
      } else {
        current.status = ServiceStatus.DEGRADED;
        current.message = `Service degraded (${current.errorCount} failures)`;
      }
    }
    
    current.lastCheck = new Date();
    this.serviceHealth.set(serviceName, current);
    
    console.log(`[GracefulDegradation] ${serviceName} status: ${current.status}`);
    
    return current;
  }

  /**
   * Verifica saúde do Iugu
   */
  private async checkIuguHealth(): Promise<boolean> {
    try {
      const response = await fetch('https://api.iugu.com/v1/customers?limit=1', {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${process.env.IUGU_API_TOKEN}:`).toString('base64')}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(5000) // 5 segundos timeout
      });
      
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verifica saúde do banco de dados
   */
  private async checkDatabaseHealth(): Promise<boolean> {
    try {
      // Usa uma query simples que não depende de RLS
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
        method: 'HEAD',
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        },
      });
      
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verifica saúde do feature gate
   */
  private async checkFeatureGateHealth(): Promise<boolean> {
    try {
      // Simula verificação do feature gate
      // Na implementação real, faria uma verificação real
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Registra estratégia de fallback para um serviço
   */
  registerFallbackStrategy(strategy: FallbackStrategy): void {
    this.fallbackStrategies.set(strategy.serviceName, strategy);
    console.log(`[GracefulDegradation] Fallback strategy registered for ${strategy.serviceName}`);
  }

  /**
   * Executa operação com fallback automático
   */
  async executeWithFallback<T>(
    serviceName: string,
    primaryOperation: () => Promise<T>,
    operationName?: string
  ): Promise<T> {
    const health = this.serviceHealth.get(serviceName);
    
    // Se o serviço está saudável, executa operação normal
    if (health?.status === ServiceStatus.HEALTHY) {
      try {
        return await primaryOperation();
      } catch (error) {
        console.warn(`[GracefulDegradation] Primary operation failed for ${serviceName}, trying fallback`);
        // Atualiza status do serviço
        this.updateServiceHealth(serviceName, false);
      }
    }
    
    // Tenta usar fallback
    const fallback = this.fallbackStrategies.get(serviceName);
    if (fallback) {
      console.log(`[GracefulDegradation] Using fallback for ${serviceName}`);
      
      // Verifica cache primeiro
      if (fallback.cacheKey) {
        const cached = this.getFromCache(fallback.cacheKey);
        if (cached) {
          console.log(`[GracefulDegradation] Using cached data for ${serviceName}`);
          return cached;
        }
      }
      
      try {
        const result = await fallback.fallbackFunction();
        
        // Salva no cache se configurado
        if (fallback.cacheKey && fallback.cacheTTL) {
          this.saveToCache(fallback.cacheKey, result, fallback.cacheTTL);
        }
        
        return result;
      } catch (fallbackError) {
        console.error(`[GracefulDegradation] Fallback also failed for ${serviceName}:`, fallbackError);
        throw new Error(`Both primary and fallback operations failed for ${serviceName}`);
      }
    }
    
    // Se não tem fallback, tenta a operação primária mesmo assim
    console.warn(`[GracefulDegradation] No fallback available for ${serviceName}, trying primary operation`);
    return await primaryOperation();
  }

  /**
   * Salva dados no cache local
   */
  private saveToCache(key: string, data: any, ttlMs: number): void {
    const expires = new Date(Date.now() + ttlMs);
    this.localCache.set(key, { data, expires });
  }

  /**
   * Obtém dados do cache local
   */
  private getFromCache(key: string): any | null {
    const cached = this.localCache.get(key);
    
    if (!cached) {
      return null;
    }
    
    if (cached.expires < new Date()) {
      this.localCache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  /**
   * Limpa cache expirado
   */
  cleanupCache(): void {
    const now = new Date();
    
    for (const [key, value] of this.localCache.entries()) {
      if (value.expires < now) {
        this.localCache.delete(key);
      }
    }
  }

  /**
   * Obtém status de todos os serviços
   */
  getServicesStatus(): Record<string, ServiceHealth> {
    const status: Record<string, ServiceHealth> = {};
    
    this.serviceHealth.forEach((health, name) => {
      status[name] = { ...health };
    });
    
    return status;
  }

  /**
   * Verifica se o sistema está em modo degradado
   */
  isSystemDegraded(): boolean {
    const services = Array.from(this.serviceHealth.values());
    const degradedCount = services.filter(s => 
      s.status === ServiceStatus.DEGRADED || s.status === ServiceStatus.UNAVAILABLE
    ).length;
    
    return degradedCount > 0;
  }

  /**
   * Obtém nível de degradação do sistema (0-1)
   */
  getDegradationLevel(): number {
    const services = Array.from(this.serviceHealth.values());
    const totalServices = services.length;
    
    if (totalServices === 0) return 0;
    
    const degradedWeight = services.filter(s => s.status === ServiceStatus.DEGRADED).length * 0.5;
    const unavailableWeight = services.filter(s => s.status === ServiceStatus.UNAVAILABLE).length * 1;
    
    return Math.min(1, (degradedWeight + unavailableWeight) / totalServices);
  }

  /**
   * Força reset de um serviço (para recuperação manual)
   */
  resetService(serviceName: string): void {
    const health = this.serviceHealth.get(serviceName);
    if (health) {
      health.status = ServiceStatus.HEALTHY;
      health.errorCount = 0;
      health.message = undefined;
      health.lastCheck = new Date();
      
      this.serviceHealth.set(serviceName, health);
      console.log(`[GracefulDegradation] Service ${serviceName} reset to healthy`);
    }
  }
}

/**
 * Instância singleton do gerenciador de degradação
 */
export const gracefulDegradation = new GracefulDegradationManager();

/**
 * Configurações de fallback pré-definidas
 */
export class FallbackStrategies {
  /**
   * Registra todas as estratégias de fallback padrão
   */
  static registerDefaultStrategies(): void {
    // Fallback para Iugu
    gracefulDegradation.registerFallbackStrategy({
      serviceName: 'iugu',
      fallbackFunction: async () => {
        return {
          status: 'fallback_mode',
          message: 'Serviço de pagamento temporariamente indisponível. Sua solicitação foi registrada.',
          checkout_url: '/checkout/fallback',
          fallback: true
        };
      },
      cacheKey: 'iugu-fallback',
      cacheTTL: 300000 // 5 minutos
    });

    // Fallback para Feature Gate
    gracefulDegradation.registerFallbackStrategy({
      serviceName: 'feature-gate',
      fallbackFunction: async () => {
        // Retorna permissões básicas em caso de falha
        return {
          maxClients: 1,
          maxCampaigns: 5,
          advancedAnalytics: false,
          customReports: false,
          apiAccess: false
        };
      },
      cacheKey: 'feature-gate-fallback',
      cacheTTL: 600000 // 10 minutos
    });

    // Fallback para Database
    gracefulDegradation.registerFallbackStrategy({
      serviceName: 'database',
      fallbackFunction: async () => {
        return {
          status: 'cached',
          message: 'Usando dados em cache devido a problemas temporários no banco de dados'
        };
      },
      cacheKey: 'database-fallback',
      cacheTTL: 180000 // 3 minutos
    });

    console.log('[GracefulDegradation] Default fallback strategies registered');
  }
}

/**
 * Inicialização automática
 */
if (typeof window === 'undefined') { // Server-side only
  FallbackStrategies.registerDefaultStrategies();
  gracefulDegradation.startHealthMonitoring();
}