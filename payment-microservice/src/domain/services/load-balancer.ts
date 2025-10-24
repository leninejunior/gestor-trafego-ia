import { IPaymentProvider } from '../interfaces/payment-provider.interface';
import { ProviderStatus, PaymentRequest } from '../types';
import { ProviderRegistry } from './provider-registry';
import { HealthChecker } from './health-checker';

/**
 * Estratégias de balanceamento de carga
 */
export enum LoadBalancingStrategy {
  /** Round Robin simples */
  ROUND_ROBIN = 'round_robin',
  
  /** Baseado em peso/performance */
  WEIGHTED = 'weighted',
  
  /** Menor latência primeiro */
  LEAST_LATENCY = 'least_latency',
  
  /** Menor carga atual */
  LEAST_CONNECTIONS = 'least_connections',
  
  /** Baseado em região geográfica */
  GEOGRAPHIC = 'geographic',
  
  /** Baseado em moeda */
  CURRENCY_BASED = 'currency_based',
  
  /** Baseado em valor da transação */
  AMOUNT_BASED = 'amount_based'
}

/**
 * Configuração de peso por provedor
 */
export interface ProviderWeight {
  providerName: string;
  weight: number;
  maxConcurrentRequests?: number;
  supportedCurrencies?: string[];
  supportedRegions?: string[];
  minAmount?: number;
  maxAmount?: number;
}

/**
 * Configuração do load balancer
 */
export interface LoadBalancerConfig {
  /** Estratégia de balanceamento */
  strategy: LoadBalancingStrategy;
  
  /** Configurações de peso por provedor */
  providerWeights: ProviderWeight[];
  
  /** Se deve considerar apenas provedores saudáveis */
  healthyProvidersOnly: boolean;
  
  /** Threshold de latência para considerar provedor lento (ms) */
  latencyThreshold: number;
  
  /** Blacklist automática após N falhas consecutivas */
  autoBlacklistThreshold: number;
  
  /** Tempo de blacklist em ms */
  blacklistDuration: number;
}

/**
 * Contexto da requisição para roteamento inteligente
 */
export interface RoutingContext {
  /** Dados da requisição de pagamento */
  paymentRequest?: PaymentRequest;
  
  /** Região do cliente */
  clientRegion?: string;
  
  /** Moeda preferida */
  preferredCurrency?: string;
  
  /** Valor da transação */
  amount?: number;
  
  /** Provedor preferido */
  preferredProvider?: string;
  
  /** Metadados adicionais */
  metadata?: Record<string, any>;
}

/**
 * Métricas de um provedor para balanceamento
 */
interface ProviderMetrics {
  providerName: string;
  currentConnections: number;
  averageLatency: number;
  successRate: number;
  lastResponseTime: number;
  isBlacklisted: boolean;
  blacklistUntil?: Date;
}

/**
 * Serviço de balanceamento de carga inteligente
 */
export class LoadBalancer {
  private static instance: LoadBalancer;
  private providerMetrics: Map<string, ProviderMetrics> = new Map();
  private roundRobinIndex = 0;
  
  private readonly defaultConfig: LoadBalancerConfig = {
    strategy: LoadBalancingStrategy.WEIGHTED,
    providerWeights: [],
    healthyProvidersOnly: true,
    latencyThreshold: 5000, // 5 segundos
    autoBlacklistThreshold: 5,
    blacklistDuration: 300000 // 5 minutos
  };

  private constructor(
    config: Partial<LoadBalancerConfig> = {},
    private providerRegistry: ProviderRegistry = ProviderRegistry.getInstance(),
    private healthChecker: HealthChecker = HealthChecker.getInstance()
  ) {
    this.config = { ...this.defaultConfig, ...config };
  }

  private config: LoadBalancerConfig;

  /**
   * Singleton instance
   */
  static getInstance(config?: Partial<LoadBalancerConfig>): LoadBalancer {
    if (!LoadBalancer.instance) {
      LoadBalancer.instance = new LoadBalancer(config || {});
    }
    return LoadBalancer.instance;
  }

  /**
   * Seleciona o melhor provedor baseado na estratégia e contexto
   */
  async selectProvider(context: RoutingContext = {}): Promise<IPaymentProvider | null> {
    const availableProviders = await this.getAvailableProviders(context);
    
    if (availableProviders.length === 0) {
      return null;
    }

    // Se há provedor preferido e está disponível, usa ele
    if (context.preferredProvider) {
      const preferred = availableProviders.find(p => p.name === context.preferredProvider);
      if (preferred) {
        return preferred;
      }
    }

    // Aplica estratégia de balanceamento
    switch (this.config.strategy) {
      case LoadBalancingStrategy.ROUND_ROBIN:
        return this.selectRoundRobin(availableProviders);
        
      case LoadBalancingStrategy.WEIGHTED:
        return this.selectWeighted(availableProviders);
        
      case LoadBalancingStrategy.LEAST_LATENCY:
        return this.selectLeastLatency(availableProviders);
        
      case LoadBalancingStrategy.LEAST_CONNECTIONS:
        return this.selectLeastConnections(availableProviders);
        
      case LoadBalancingStrategy.GEOGRAPHIC:
        return this.selectByGeography(availableProviders, context);
        
      case LoadBalancingStrategy.CURRENCY_BASED:
        return this.selectByCurrency(availableProviders, context);
        
      case LoadBalancingStrategy.AMOUNT_BASED:
        return this.selectByAmount(availableProviders, context);
        
      default:
        return availableProviders[0];
    }
  }

  /**
   * Seleciona múltiplos provedores ordenados por prioridade
   */
  async selectProviders(context: RoutingContext = {}, count: number = 3): Promise<IPaymentProvider[]> {
    const availableProviders = await this.getAvailableProviders(context);
    
    // Ordena todos os provedores pela estratégia atual
    const orderedProviders = await this.orderProviders(availableProviders, context);
    
    return orderedProviders.slice(0, count);
  }

  /**
   * Registra início de uma requisição para um provedor
   */
  recordRequestStart(providerName: string): void {
    const metrics = this.getOrCreateMetrics(providerName);
    metrics.currentConnections++;
  }

  /**
   * Registra fim de uma requisição para um provedor
   */
  recordRequestEnd(providerName: string, responseTime: number, success: boolean): void {
    const metrics = this.getOrCreateMetrics(providerName);
    metrics.currentConnections = Math.max(0, metrics.currentConnections - 1);
    metrics.lastResponseTime = responseTime;
    
    // Atualiza latência média
    metrics.averageLatency = (metrics.averageLatency + responseTime) / 2;
    
    // Atualiza taxa de sucesso (média móvel simples)
    const currentSuccessRate = success ? 100 : 0;
    metrics.successRate = (metrics.successRate + currentSuccessRate) / 2;
    
    // Verifica se deve blacklistar por latência alta
    if (responseTime > this.config.latencyThreshold) {
      this.considerBlacklist(providerName, 'high_latency');
    }
    
    // Verifica se deve blacklistar por falha
    if (!success) {
      this.considerBlacklist(providerName, 'failure');
    }
  }

  /**
   * Adiciona provedor à blacklist
   */
  blacklistProvider(providerName: string, duration?: number): void {
    const metrics = this.getOrCreateMetrics(providerName);
    metrics.isBlacklisted = true;
    metrics.blacklistUntil = new Date(Date.now() + (duration || this.config.blacklistDuration));
  }

  /**
   * Remove provedor da blacklist
   */
  unblacklistProvider(providerName: string): void {
    const metrics = this.getOrCreateMetrics(providerName);
    metrics.isBlacklisted = false;
    metrics.blacklistUntil = undefined;
  }

  /**
   * Obtém métricas de um provedor
   */
  getProviderMetrics(providerName: string): ProviderMetrics | undefined {
    return this.providerMetrics.get(providerName);
  }

  /**
   * Obtém métricas de todos os provedores
   */
  getAllProviderMetrics(): ProviderMetrics[] {
    return Array.from(this.providerMetrics.values());
  }

  /**
   * Atualiza configuração
   */
  updateConfig(newConfig: Partial<LoadBalancerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Obtém configuração atual
   */
  getConfig(): LoadBalancerConfig {
    return { ...this.config };
  }

  /**
   * Reseta todas as métricas
   */
  resetMetrics(): void {
    this.providerMetrics.clear();
    this.roundRobinIndex = 0;
  }

  /**
   * Obtém provedores disponíveis baseado no contexto
   */
  private async getAvailableProviders(context: RoutingContext): Promise<IPaymentProvider[]> {
    let providers = this.providerRegistry.listActiveProviders();
    
    // Filtra apenas provedores saudáveis se configurado
    if (this.config.healthyProvidersOnly) {
      providers = providers.filter(provider => {
        const status = this.healthChecker.getProviderStatus(provider.name);
        return status === ProviderStatus.HEALTHY || status === ProviderStatus.DEGRADED;
      });
    }
    
    // Remove provedores blacklistados
    providers = providers.filter(provider => {
      const metrics = this.providerMetrics.get(provider.name);
      if (!metrics || !metrics.isBlacklisted) {
        return true;
      }
      
      // Verifica se blacklist expirou
      if (metrics.blacklistUntil && metrics.blacklistUntil <= new Date()) {
        this.unblacklistProvider(provider.name);
        return true;
      }
      
      return false;
    });
    
    // Filtra por moeda se especificada
    if (context.preferredCurrency) {
      providers = providers.filter(provider => {
        const weight = this.config.providerWeights.find(w => w.providerName === provider.name);
        return !weight?.supportedCurrencies || weight.supportedCurrencies.includes(context.preferredCurrency!);
      });
    }
    
    // Filtra por região se especificada
    if (context.clientRegion) {
      providers = providers.filter(provider => {
        const weight = this.config.providerWeights.find(w => w.providerName === provider.name);
        return !weight?.supportedRegions || weight.supportedRegions.includes(context.clientRegion!);
      });
    }
    
    // Filtra por valor se especificado
    if (context.amount !== undefined) {
      providers = providers.filter(provider => {
        const weight = this.config.providerWeights.find(w => w.providerName === provider.name);
        if (!weight) return true;
        
        if (weight.minAmount !== undefined && context.amount! < weight.minAmount) {
          return false;
        }
        
        if (weight.maxAmount !== undefined && context.amount! > weight.maxAmount) {
          return false;
        }
        
        return true;
      });
    }
    
    return providers;
  }

  /**
   * Ordena provedores pela estratégia atual
   */
  private async orderProviders(providers: IPaymentProvider[], context: RoutingContext): Promise<IPaymentProvider[]> {
    switch (this.config.strategy) {
      case LoadBalancingStrategy.WEIGHTED:
        return this.orderByWeight(providers);
        
      case LoadBalancingStrategy.LEAST_LATENCY:
        return this.orderByLatency(providers);
        
      case LoadBalancingStrategy.LEAST_CONNECTIONS:
        return this.orderByConnections(providers);
        
      default:
        return providers;
    }
  }

  /**
   * Seleção Round Robin
   */
  private selectRoundRobin(providers: IPaymentProvider[]): IPaymentProvider {
    const provider = providers[this.roundRobinIndex % providers.length];
    this.roundRobinIndex++;
    return provider;
  }

  /**
   * Seleção por peso
   */
  private selectWeighted(providers: IPaymentProvider[]): IPaymentProvider {
    const ordered = this.orderByWeight(providers);
    return ordered[0];
  }

  /**
   * Seleção por menor latência
   */
  private selectLeastLatency(providers: IPaymentProvider[]): IPaymentProvider {
    const ordered = this.orderByLatency(providers);
    return ordered[0];
  }

  /**
   * Seleção por menor número de conexões
   */
  private selectLeastConnections(providers: IPaymentProvider[]): IPaymentProvider {
    const ordered = this.orderByConnections(providers);
    return ordered[0];
  }

  /**
   * Seleção por geografia
   */
  private selectByGeography(providers: IPaymentProvider[], context: RoutingContext): IPaymentProvider {
    if (!context.clientRegion) {
      return providers[0];
    }
    
    // Prioriza provedores que suportam a região
    const regionalProviders = providers.filter(provider => {
      const weight = this.config.providerWeights.find(w => w.providerName === provider.name);
      return weight?.supportedRegions?.includes(context.clientRegion!);
    });
    
    return regionalProviders.length > 0 ? regionalProviders[0] : providers[0];
  }

  /**
   * Seleção por moeda
   */
  private selectByCurrency(providers: IPaymentProvider[], context: RoutingContext): IPaymentProvider {
    if (!context.preferredCurrency) {
      return providers[0];
    }
    
    // Prioriza provedores que suportam a moeda
    const currencyProviders = providers.filter(provider => {
      const weight = this.config.providerWeights.find(w => w.providerName === provider.name);
      return weight?.supportedCurrencies?.includes(context.preferredCurrency!);
    });
    
    return currencyProviders.length > 0 ? currencyProviders[0] : providers[0];
  }

  /**
   * Seleção por valor
   */
  private selectByAmount(providers: IPaymentProvider[], context: RoutingContext): IPaymentProvider {
    if (context.amount === undefined) {
      return providers[0];
    }
    
    // Encontra provedor mais adequado para o valor
    const suitableProviders = providers.filter(provider => {
      const weight = this.config.providerWeights.find(w => w.providerName === provider.name);
      if (!weight) return true;
      
      if (weight.minAmount !== undefined && context.amount! < weight.minAmount) {
        return false;
      }
      
      if (weight.maxAmount !== undefined && context.amount! > weight.maxAmount) {
        return false;
      }
      
      return true;
    });
    
    return suitableProviders.length > 0 ? suitableProviders[0] : providers[0];
  }

  /**
   * Ordena provedores por peso
   */
  private orderByWeight(providers: IPaymentProvider[]): IPaymentProvider[] {
    return providers.sort((a, b) => {
      const weightA = this.config.providerWeights.find(w => w.providerName === a.name)?.weight || 1;
      const weightB = this.config.providerWeights.find(w => w.providerName === b.name)?.weight || 1;
      return weightB - weightA; // Maior peso primeiro
    });
  }

  /**
   * Ordena provedores por latência
   */
  private orderByLatency(providers: IPaymentProvider[]): IPaymentProvider[] {
    return providers.sort((a, b) => {
      const metricsA = this.providerMetrics.get(a.name);
      const metricsB = this.providerMetrics.get(b.name);
      
      const latencyA = metricsA?.averageLatency || 0;
      const latencyB = metricsB?.averageLatency || 0;
      
      return latencyA - latencyB; // Menor latência primeiro
    });
  }

  /**
   * Ordena provedores por número de conexões
   */
  private orderByConnections(providers: IPaymentProvider[]): IPaymentProvider[] {
    return providers.sort((a, b) => {
      const metricsA = this.providerMetrics.get(a.name);
      const metricsB = this.providerMetrics.get(b.name);
      
      const connectionsA = metricsA?.currentConnections || 0;
      const connectionsB = metricsB?.currentConnections || 0;
      
      return connectionsA - connectionsB; // Menor número de conexões primeiro
    });
  }

  /**
   * Obtém ou cria métricas para um provedor
   */
  private getOrCreateMetrics(providerName: string): ProviderMetrics {
    if (!this.providerMetrics.has(providerName)) {
      this.providerMetrics.set(providerName, {
        providerName,
        currentConnections: 0,
        averageLatency: 0,
        successRate: 100,
        lastResponseTime: 0,
        isBlacklisted: false
      });
    }
    return this.providerMetrics.get(providerName)!;
  }

  /**
   * Considera blacklistar um provedor
   */
  private considerBlacklist(providerName: string, reason: 'high_latency' | 'failure'): void {
    // Implementação simplificada - pode ser expandida com lógica mais sofisticada
    const metrics = this.getOrCreateMetrics(providerName);
    
    if (reason === 'failure' && metrics.successRate < 50) {
      this.blacklistProvider(providerName);
    } else if (reason === 'high_latency' && metrics.averageLatency > this.config.latencyThreshold * 2) {
      this.blacklistProvider(providerName);
    }
  }
}