import { IPaymentProvider } from '../interfaces/payment-provider.interface';
import { 
  PaymentRequest, 
  ProviderStatus, 
  PaymentError, 
  PaymentErrorType 
} from '../types';
import { ProviderRegistry } from './provider-registry';
import { HealthChecker } from './health-checker';
import { LoadBalancingStrategy } from './load-balancer';

/**
 * Estratégias de roteamento inteligente
 */
export enum IntelligentRoutingStrategy {
  /** Roteamento baseado em machine learning */
  ML_BASED = 'ml_based',
  
  /** Roteamento adaptativo baseado em condições atuais */
  ADAPTIVE = 'adaptive',
  
  /** Roteamento por custo-benefício */
  COST_OPTIMIZED = 'cost_optimized',
  
  /** Roteamento por taxa de sucesso */
  SUCCESS_RATE_OPTIMIZED = 'success_rate_optimized',
  
  /** Roteamento por latência */
  LATENCY_OPTIMIZED = 'latency_optimized',
  
  /** Roteamento híbrido (combina múltiplos fatores) */
  HYBRID = 'hybrid'
}

/**
 * Configuração do roteamento inteligente
 */
export interface IntelligentRoutingConfig {
  /** Estratégia principal de roteamento */
  primaryStrategy: IntelligentRoutingStrategy;
  
  /** Estratégia de fallback */
  fallbackStrategy: LoadBalancingStrategy;
  
  /** Pesos para diferentes fatores no roteamento híbrido */
  hybridWeights: {
    successRate: number;
    latency: number;
    cost: number;
    availability: number;
  };
  
  /** Configuração de cache */
  cacheConfig: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
  
  /** Configuração de machine learning */
  mlConfig: {
    enabled: boolean;
    learningRate: number;
    minSamples: number;
    retrainInterval: number;
  };
  
  /** Configuração de monitoramento */
  monitoringConfig: {
    enabled: boolean;
    metricsInterval: number;
    alertThresholds: {
      successRate: number;
      latency: number;
      errorRate: number;
    };
  };
}

/**
 * Decisão de roteamento
 */
export interface RoutingDecision {
  /** Provedor selecionado */
  selectedProvider: IPaymentProvider;
  
  /** Estratégia utilizada */
  strategyUsed: IntelligentRoutingStrategy;
  
  /** Score de confiança (0-100) */
  confidenceScore: number;
  
  /** Provedores alternativos */
  alternativeProviders: IPaymentProvider[];
  
  /** Razão da seleção */
  selectionReason: string;
  
  /** ID único da decisão */
  decisionId: string;
  
  /** Timestamp da decisão */
  timestamp: Date;
  
  /** Métricas da decisão */
  decisionMetrics: {
    successRates: Record<string, number>;
    latencies: Record<string, number>;
    costs: Record<string, number>;
    availability: Record<string, number>;
  };
}

/**
 * Opções de roteamento
 */
export interface RoutingOptions {
  /** Provedor preferido */
  preferredProvider?: string;
  
  /** Provedores a excluir */
  excludeProviders?: string[];
  
  /** Forçar estratégia específica */
  forceStrategy?: IntelligentRoutingStrategy;
  
  /** Contexto adicional */
  context?: Record<string, any>;
}

/**
 * Estatísticas de roteamento
 */
export interface RoutingStatistics {
  /** Total de decisões tomadas */
  totalDecisions: number;
  
  /** Estratégias utilizadas */
  strategiesUsed: Record<IntelligentRoutingStrategy, number>;
  
  /** Score médio de confiança */
  averageConfidenceScore: number;
  
  /** Uso por provedor */
  providerUsage: Record<string, number>;
  
  /** Taxa de acerto do cache */
  cacheHitRate: number;
  
  /** Acurácia do modelo ML (se habilitado) */
  mlModelAccuracy?: number;
}

/**
 * Dados de treinamento para ML
 */
interface MLTrainingData {
  providerId: string;
  features: {
    successRate: number;
    latency: number;
    cost: number;
    availability: number;
    timeOfDay: number;
    dayOfWeek: number;
    transactionAmount: number;
  };
  outcome: {
    success: boolean;
    responseTime: number;
    cost: number;
  };
  timestamp: Date;
}

/**
 * Modelo de ML simples
 */
interface MLModel {
  weights: Record<string, number>;
  bias: number;
  accuracy: number;
  lastTrained: Date;
  trainingDataSize: number;
}

/**
 * Gerenciador de roteamento inteligente
 */
export class IntelligentRoutingManager {
  private static instance: IntelligentRoutingManager;
  private config: IntelligentRoutingConfig;
  private providerRegistry: ProviderRegistry;
  private healthChecker: HealthChecker;
  
  // Cache de decisões
  private decisionCache: Map<string, RoutingDecision> = new Map();
  
  // Estatísticas
  private statistics: RoutingStatistics = {
    totalDecisions: 0,
    strategiesUsed: {} as Record<IntelligentRoutingStrategy, number>,
    averageConfidenceScore: 0,
    providerUsage: {},
    cacheHitRate: 0
  };
  
  // ML
  private mlModel?: MLModel;
  private trainingData: MLTrainingData[] = [];
  
  // Histórico de decisões para análise
  private decisionHistory: Map<string, {
    decision: RoutingDecision;
    result?: {
      success: boolean;
      latency: number;
      cost?: number;
    };
  }> = new Map();

  private constructor(config: Partial<IntelligentRoutingConfig>) {
    this.config = this.mergeWithDefaults(config);
    this.providerRegistry = ProviderRegistry.getInstance();
    this.healthChecker = HealthChecker.getInstance();
    
    // Inicializa estatísticas
    Object.values(IntelligentRoutingStrategy).forEach(strategy => {
      this.statistics.strategiesUsed[strategy] = 0;
    });
    
    // Inicia treinamento ML se habilitado
    if (this.config.mlConfig.enabled) {
      this.initializeMLModel();
    }
  }

  /**
   * Obtém instância singleton
   */
  public static getInstance(config?: Partial<IntelligentRoutingConfig>): IntelligentRoutingManager {
    if (!IntelligentRoutingManager.instance) {
      IntelligentRoutingManager.instance = new IntelligentRoutingManager(config || {});
    }
    return IntelligentRoutingManager.instance;
  }

  /**
   * Destrói a instância (útil para testes)
   */
  public destroy(): void {
    this.decisionCache.clear();
    this.decisionHistory.clear();
    this.trainingData = [];
    IntelligentRoutingManager.instance = undefined as any;
  }

  /**
   * Toma decisão de roteamento
   */
  public async makeRoutingDecision(
    request: PaymentRequest,
    options: RoutingOptions = {}
  ): Promise<RoutingDecision> {
    const startTime = Date.now();
    let availableProviders: IPaymentProvider[] = [];
    
    try {
      // Verifica cache se habilitado
      if (this.config.cacheConfig.enabled) {
        const cacheKey = this.generateCacheKey(request, options);
        const cached = this.decisionCache.get(cacheKey);
        if (cached && this.isCacheValid(cached)) {
          this.updateCacheHitRate(true);
          return this.cloneDecisionWithNewId(cached);
        }
        this.updateCacheHitRate(false);
      }

      // Obtém provedores disponíveis
      availableProviders = await this.getAvailableProviders(options);
      
      if (availableProviders.length === 0) {
        throw new PaymentError(
          PaymentErrorType.PROVIDER_UNAVAILABLE,
          'No providers available for routing',
          { request, options }
        );
      }

      // Seleciona estratégia
      const strategy = options.forceStrategy || this.config.primaryStrategy;
      
      // Aplica estratégia de roteamento
      const decision = await this.applyRoutingStrategy(
        strategy,
        availableProviders,
        request,
        options
      );

      // Armazena no cache se habilitado
      if (this.config.cacheConfig.enabled) {
        const cacheKey = this.generateCacheKey(request, options);
        this.decisionCache.set(cacheKey, decision);
        this.cleanExpiredCache();
      }

      // Atualiza estatísticas
      this.updateStatistics(decision, Date.now() - startTime);
      
      // Armazena para análise posterior
      this.decisionHistory.set(decision.decisionId, { decision });

      return decision;
      
    } catch (error) {
      // Fallback para estratégia simples
      return this.fallbackDecision(request, availableProviders);
    }
  }

  /**
   * Registra resultado de uma decisão
   */
  public async recordDecisionResult(
    decisionId: string,
    success: boolean,
    latency: number,
    cost?: number
  ): Promise<void> {
    const decisionRecord = this.decisionHistory.get(decisionId);
    if (!decisionRecord) {
      return; // Decisão não encontrada, ignora silenciosamente
    }

    const result = { success, latency, cost };
    decisionRecord.result = result;

    // Adiciona aos dados de treinamento se ML estiver habilitado
    if (this.config.mlConfig.enabled) {
      await this.addTrainingData(decisionRecord.decision, result);
    }

    // Atualiza modelo ML se necessário
    if (this.shouldRetrainModel()) {
      await this.retrainMLModel();
    }
  }

  /**
   * Obtém estatísticas de roteamento
   */
  public getRoutingStatistics(): RoutingStatistics {
    return { ...this.statistics };
  }

  /**
   * Atualiza configuração
   */
  public updateConfig(newConfig: Partial<IntelligentRoutingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Reinicializa ML se necessário
    if (newConfig.mlConfig?.enabled && !this.mlModel) {
      this.initializeMLModel();
    }
  }

  /**
   * Obtém configuração atual
   */
  public getConfig(): IntelligentRoutingConfig {
    return { ...this.config };
  }

  // Métodos privados

  private mergeWithDefaults(config: Partial<IntelligentRoutingConfig>): IntelligentRoutingConfig {
    return {
      primaryStrategy: IntelligentRoutingStrategy.HYBRID,
      fallbackStrategy: LoadBalancingStrategy.WEIGHTED,
      hybridWeights: {
        successRate: 0.4,
        latency: 0.3,
        cost: 0.2,
        availability: 0.1
      },
      cacheConfig: {
        enabled: true,
        ttl: 30000, // 30 segundos
        maxSize: 1000
      },
      mlConfig: {
        enabled: false,
        learningRate: 0.01,
        minSamples: 100,
        retrainInterval: 3600000 // 1 hora
      },
      monitoringConfig: {
        enabled: true,
        metricsInterval: 60000, // 1 minuto
        alertThresholds: {
          successRate: 0.95,
          latency: 2000,
          errorRate: 0.05
        }
      },
      ...config
    };
  }

  private async getAvailableProviders(options: RoutingOptions): Promise<IPaymentProvider[]> {
    let providers = this.providerRegistry.listActiveProviders();
    
    // Filtra por saúde - se não há status, assume como saudável
    providers = providers.filter(provider => {
      const status = this.healthChecker.getProviderStatus(provider.name);
      // Se não há status definido, assume como saudável para permitir uso
      return status === undefined || status === ProviderStatus.HEALTHY || status === ProviderStatus.DEGRADED;
    });
    
    // Aplica filtros das opções
    if (options.excludeProviders?.length) {
      providers = providers.filter(p => !options.excludeProviders!.includes(p.name));
    }
    
    return providers;
  }

  private async applyRoutingStrategy(
    strategy: IntelligentRoutingStrategy,
    providers: IPaymentProvider[],
    request: PaymentRequest,
    options: RoutingOptions
  ): Promise<RoutingDecision> {
    
    switch (strategy) {
      case IntelligentRoutingStrategy.LATENCY_OPTIMIZED:
        return this.routeByLatency(providers, request, options);
        
      case IntelligentRoutingStrategy.SUCCESS_RATE_OPTIMIZED:
        return this.routeBySuccessRate(providers, request, options);
        
      case IntelligentRoutingStrategy.COST_OPTIMIZED:
        return this.routeByCost(providers, request, options);
        
      case IntelligentRoutingStrategy.HYBRID:
        return this.routeByHybrid(providers, request, options);
        
      case IntelligentRoutingStrategy.ML_BASED:
        return this.routeByML(providers, request, options);
        
      case IntelligentRoutingStrategy.ADAPTIVE:
        return this.routeAdaptive(providers, request, options);
        
      default:
        return this.routeByHybrid(providers, request, options);
    }
  }

  private async routeByLatency(
    providers: IPaymentProvider[],
    request: PaymentRequest,
    options: RoutingOptions
  ): Promise<RoutingDecision> {
    const metrics = await this.getProviderMetrics(providers);
    
    // Ordena por latência
    const sorted = providers.sort((a, b) => {
      const latencyA = metrics[a.name]?.latency || 9999;
      const latencyB = metrics[b.name]?.latency || 9999;
      return latencyA - latencyB;
    });
    
    const selected = options.preferredProvider 
      ? providers.find(p => p.name === options.preferredProvider) || sorted[0]
      : sorted[0];
    
    return this.createDecision(
      selected,
      IntelligentRoutingStrategy.LATENCY_OPTIMIZED,
      sorted.filter(p => p !== selected),
      `Selected based on lowest latency: ${metrics[selected.name]?.latency || 'unknown'}ms`,
      this.calculateConfidence(metrics[selected.name], 'latency'),
      metrics
    );
  }

  private async routeBySuccessRate(
    providers: IPaymentProvider[],
    request: PaymentRequest,
    options: RoutingOptions
  ): Promise<RoutingDecision> {
    const metrics = await this.getProviderMetrics(providers);
    
    // Ordena por taxa de sucesso
    const sorted = providers.sort((a, b) => {
      const rateA = metrics[a.name]?.successRate || 0;
      const rateB = metrics[b.name]?.successRate || 0;
      return rateB - rateA;
    });
    
    const selected = options.preferredProvider 
      ? providers.find(p => p.name === options.preferredProvider) || sorted[0]
      : sorted[0];
    
    return this.createDecision(
      selected,
      IntelligentRoutingStrategy.SUCCESS_RATE_OPTIMIZED,
      sorted.filter(p => p !== selected),
      `Selected based on highest success rate: ${(metrics[selected.name]?.successRate || 0).toFixed(1)}%`,
      this.calculateConfidence(metrics[selected.name], 'successRate'),
      metrics
    );
  }

  private async routeByCost(
    providers: IPaymentProvider[],
    request: PaymentRequest,
    options: RoutingOptions
  ): Promise<RoutingDecision> {
    const metrics = await this.getProviderMetrics(providers);
    
    // Ordena por custo
    const sorted = providers.sort((a, b) => {
      const costA = metrics[a.name]?.cost || 9999;
      const costB = metrics[b.name]?.cost || 9999;
      return costA - costB;
    });
    
    const selected = options.preferredProvider 
      ? providers.find(p => p.name === options.preferredProvider) || sorted[0]
      : sorted[0];
    
    return this.createDecision(
      selected,
      IntelligentRoutingStrategy.COST_OPTIMIZED,
      sorted.filter(p => p !== selected),
      `Selected based on lowest cost: $${(metrics[selected.name]?.cost || 0).toFixed(3)}`,
      this.calculateConfidence(metrics[selected.name], 'cost'),
      metrics
    );
  }

  private async routeByHybrid(
    providers: IPaymentProvider[],
    request: PaymentRequest,
    options: RoutingOptions
  ): Promise<RoutingDecision> {
    const metrics = await this.getProviderMetrics(providers);
    const weights = this.config.hybridWeights;
    
    // Calcula score híbrido para cada provedor
    const scores = providers.map(provider => {
      const m = metrics[provider.name] || this.getDefaultMetrics();
      
      // Normaliza métricas (0-1)
      const normalizedSuccessRate = m.successRate / 100;
      const normalizedLatency = Math.max(0, 1 - (m.latency / 5000)); // 5s max
      const normalizedCost = Math.max(0, 1 - (m.cost / 10)); // $10 max
      const normalizedAvailability = m.availability;
      
      // Calcula score ponderado
      const score = (
        normalizedSuccessRate * weights.successRate +
        normalizedLatency * weights.latency +
        normalizedCost * weights.cost +
        normalizedAvailability * weights.availability
      );
      
      return { provider, score };
    });
    
    // Ordena por score
    scores.sort((a, b) => b.score - a.score);
    
    const selected = options.preferredProvider 
      ? providers.find(p => p.name === options.preferredProvider) || scores[0].provider
      : scores[0].provider;
    
    const selectedScore = scores.find(s => s.provider === selected)?.score || 0;
    
    return this.createDecision(
      selected,
      IntelligentRoutingStrategy.HYBRID,
      scores.filter(s => s.provider !== selected).map(s => s.provider),
      `Selected based on hybrid score: ${selectedScore.toFixed(3)}`,
      selectedScore * 100,
      metrics
    );
  }

  private async routeByML(
    providers: IPaymentProvider[],
    request: PaymentRequest,
    options: RoutingOptions
  ): Promise<RoutingDecision> {
    if (!this.mlModel || !this.config.mlConfig.enabled) {
      // Fallback para híbrido
      return this.routeByHybrid(providers, request, options);
    }
    
    const metrics = await this.getProviderMetrics(providers);
    
    // Gera predições para cada provedor
    const predictions = providers.map(provider => {
      const features = this.extractFeatures(metrics[provider.name] || this.getDefaultMetrics(), request);
      const prediction = this.predict(features);
      return { provider, prediction };
    });
    
    // Ordena por predição
    predictions.sort((a, b) => b.prediction - a.prediction);
    
    const selected = options.preferredProvider 
      ? providers.find(p => p.name === options.preferredProvider) || predictions[0].provider
      : predictions[0].provider;
    
    const selectedPrediction = predictions.find(p => p.provider === selected)?.prediction || 0;
    
    return this.createDecision(
      selected,
      IntelligentRoutingStrategy.ML_BASED,
      predictions.filter(p => p.provider !== selected).map(p => p.provider),
      `Selected based on ML prediction: ${(selectedPrediction * 100).toFixed(1)}% success probability`,
      selectedPrediction * 100,
      metrics
    );
  }

  private async routeAdaptive(
    providers: IPaymentProvider[],
    request: PaymentRequest,
    options: RoutingOptions
  ): Promise<RoutingDecision> {
    // Estratégia adaptativa: escolhe a melhor estratégia baseada nas condições atuais
    const metrics = await this.getProviderMetrics(providers);
    
    // Analisa condições atuais
    const avgSuccessRate = Object.values(metrics).reduce((sum, m) => sum + m.successRate, 0) / Object.keys(metrics).length;
    const avgLatency = Object.values(metrics).reduce((sum, m) => sum + m.latency, 0) / Object.keys(metrics).length;
    
    let adaptiveStrategy: IntelligentRoutingStrategy;
    
    if (avgSuccessRate < 90) {
      // Se taxa de sucesso está baixa, prioriza confiabilidade
      adaptiveStrategy = IntelligentRoutingStrategy.SUCCESS_RATE_OPTIMIZED;
    } else if (avgLatency > 2000) {
      // Se latência está alta, prioriza velocidade
      adaptiveStrategy = IntelligentRoutingStrategy.LATENCY_OPTIMIZED;
    } else if (request.amount > 100000) { // Transações grandes
      // Para transações grandes, prioriza custo
      adaptiveStrategy = IntelligentRoutingStrategy.COST_OPTIMIZED;
    } else {
      // Condições normais, usa híbrido
      adaptiveStrategy = IntelligentRoutingStrategy.HYBRID;
    }
    
    const decision = await this.applyRoutingStrategy(adaptiveStrategy, providers, request, options);
    
    // Sobrescreve a estratégia para mostrar que foi adaptativa
    return {
      ...decision,
      strategyUsed: IntelligentRoutingStrategy.ADAPTIVE,
      selectionReason: `Adaptive strategy chose ${adaptiveStrategy}: ${decision.selectionReason}`
    };
  }

  private fallbackDecision(request: PaymentRequest, providers: IPaymentProvider[]): RoutingDecision {
    const selected = providers[0] || this.providerRegistry.listActiveProviders()[0];
    
    if (!selected) {
      throw new PaymentError(
        PaymentErrorType.PROVIDER_UNAVAILABLE,
        'No providers available for fallback routing'
      );
    }
    
    return this.createDecision(
      selected,
      IntelligentRoutingStrategy.HYBRID,
      [],
      'Fallback selection due to routing error',
      50,
      {}
    );
  }

  private createDecision(
    provider: IPaymentProvider,
    strategy: IntelligentRoutingStrategy,
    alternatives: IPaymentProvider[],
    reason: string,
    confidence: number,
    metrics: Record<string, any>
  ): RoutingDecision {
    return {
      selectedProvider: provider,
      strategyUsed: strategy,
      confidenceScore: Math.min(100, Math.max(0, confidence)),
      alternativeProviders: alternatives.slice(0, 2), // Máximo 2 alternativas
      selectionReason: reason,
      decisionId: this.generateDecisionId(),
      timestamp: new Date(),
      decisionMetrics: {
        successRates: Object.fromEntries(
          Object.entries(metrics).map(([name, m]) => [name, m.successRate || 0])
        ),
        latencies: Object.fromEntries(
          Object.entries(metrics).map(([name, m]) => [name, m.latency || 0])
        ),
        costs: Object.fromEntries(
          Object.entries(metrics).map(([name, m]) => [name, m.cost || 0])
        ),
        availability: Object.fromEntries(
          Object.entries(metrics).map(([name, m]) => [name, m.availability || 0])
        )
      }
    };
  }

  private async getProviderMetrics(providers: IPaymentProvider[]): Promise<Record<string, any>> {
    const metrics: Record<string, any> = {};
    
    for (const provider of providers) {
      // Simula métricas - em produção viria de sistema de monitoramento
      metrics[provider.name] = {
        successRate: 95 + Math.random() * 5, // 95-100%
        latency: 100 + Math.random() * 500, // 100-600ms
        cost: 0.01 + Math.random() * 0.05, // $0.01-0.06
        availability: 0.95 + Math.random() * 0.05 // 95-100%
      };
    }
    
    return metrics;
  }

  private getDefaultMetrics() {
    return {
      successRate: 95,
      latency: 1000,
      cost: 0.03,
      availability: 0.95
    };
  }

  private calculateConfidence(metrics: any, factor: string): number {
    if (!metrics) return 50;
    
    switch (factor) {
      case 'latency':
        return Math.max(0, 100 - (metrics.latency / 50)); // 50ms = 1 point
      case 'successRate':
        return metrics.successRate;
      case 'cost':
        return Math.max(0, 100 - (metrics.cost * 1000)); // $0.1 = 100 points
      default:
        return 75;
    }
  }

  private generateCacheKey(request: PaymentRequest, options: RoutingOptions): string {
    return `${request.amount}_${request.currency}_${options.preferredProvider || 'none'}_${options.forceStrategy || 'default'}`;
  }

  private isCacheValid(decision: RoutingDecision): boolean {
    const age = Date.now() - decision.timestamp.getTime();
    return age < this.config.cacheConfig.ttl;
  }

  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [key, decision] of this.decisionCache.entries()) {
      if (now - decision.timestamp.getTime() > this.config.cacheConfig.ttl) {
        this.decisionCache.delete(key);
      }
    }
    
    // Limita tamanho do cache
    if (this.decisionCache.size > this.config.cacheConfig.maxSize) {
      const entries = Array.from(this.decisionCache.entries());
      entries.sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());
      
      const toDelete = entries.slice(0, entries.length - this.config.cacheConfig.maxSize);
      toDelete.forEach(([key]) => this.decisionCache.delete(key));
    }
  }

  private cloneDecisionWithNewId(decision: RoutingDecision): RoutingDecision {
    return {
      ...decision,
      decisionId: this.generateDecisionId(),
      timestamp: new Date()
    };
  }

  private updateCacheHitRate(hit: boolean): void {
    // Implementação simplificada
    const currentHits = this.statistics.cacheHitRate * this.statistics.totalDecisions;
    const newTotal = this.statistics.totalDecisions + 1;
    const newHits = hit ? currentHits + 1 : currentHits;
    this.statistics.cacheHitRate = newHits / newTotal;
  }

  private updateStatistics(decision: RoutingDecision, processingTime: number): void {
    this.statistics.totalDecisions++;
    this.statistics.strategiesUsed[decision.strategyUsed]++;
    
    // Atualiza score médio de confiança
    const totalScore = this.statistics.averageConfidenceScore * (this.statistics.totalDecisions - 1);
    this.statistics.averageConfidenceScore = (totalScore + decision.confidenceScore) / this.statistics.totalDecisions;
    
    // Atualiza uso por provedor
    this.statistics.providerUsage[decision.selectedProvider.name] = 
      (this.statistics.providerUsage[decision.selectedProvider.name] || 0) + 1;
  }

  private generateDecisionId(): string {
    return `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Métodos de ML

  private initializeMLModel(): void {
    this.mlModel = {
      weights: {
        successRate: 0.4,
        latency: -0.3,
        cost: -0.2,
        availability: 0.3,
        timeOfDay: 0.1,
        dayOfWeek: 0.05,
        transactionAmount: 0.1
      },
      bias: 0.5,
      accuracy: 0.75,
      lastTrained: new Date(),
      trainingDataSize: 0
    };
    
    // Atualiza estatísticas
    this.statistics.mlModelAccuracy = this.mlModel.accuracy;
  }

  private extractFeatures(metrics: any, request: PaymentRequest): Record<string, number> {
    const now = new Date();
    return {
      successRate: metrics.successRate / 100,
      latency: Math.min(metrics.latency / 5000, 1), // Normaliza para 0-1
      cost: Math.min(metrics.cost / 10, 1), // Normaliza para 0-1
      availability: metrics.availability,
      timeOfDay: now.getHours() / 24,
      dayOfWeek: now.getDay() / 7,
      transactionAmount: Math.min(request.amount / 1000000, 1) // Normaliza para 0-1
    };
  }

  private predict(features: Record<string, number>): number {
    if (!this.mlModel) return 0.5;
    
    let score = this.mlModel.bias;
    for (const [feature, value] of Object.entries(features)) {
      score += (this.mlModel.weights[feature] || 0) * value;
    }
    
    // Aplica sigmoid
    return 1 / (1 + Math.exp(-score));
  }

  private async addTrainingData(decision: RoutingDecision, result: any): Promise<void> {
    const metrics = decision.decisionMetrics;
    const providerMetrics = {
      successRate: metrics.successRates[decision.selectedProvider.name] || 95,
      latency: metrics.latencies[decision.selectedProvider.name] || 1000,
      cost: metrics.costs[decision.selectedProvider.name] || 0.03,
      availability: metrics.availability[decision.selectedProvider.name] || 0.95
    };
    
    this.trainingData.push({
      providerId: decision.selectedProvider.name,
      features: {
        successRate: providerMetrics.successRate,
        latency: providerMetrics.latency,
        cost: providerMetrics.cost,
        availability: providerMetrics.availability,
        timeOfDay: decision.timestamp.getHours(),
        dayOfWeek: decision.timestamp.getDay(),
        transactionAmount: 10000 // Placeholder
      },
      outcome: {
        success: result.success,
        responseTime: result.latency,
        cost: result.cost || 0.03
      },
      timestamp: new Date()
    });
    
    // Mantém apenas dados recentes
    if (this.trainingData.length > this.config.mlConfig.minSamples * 2) {
      this.trainingData = this.trainingData.slice(-this.config.mlConfig.minSamples);
    }
  }

  private shouldRetrainModel(): boolean {
    if (!this.mlModel || !this.config.mlConfig.enabled) return false;
    
    const timeSinceLastTrain = Date.now() - this.mlModel.lastTrained.getTime();
    const hasEnoughData = this.trainingData.length >= this.config.mlConfig.minSamples;
    const timeToRetrain = timeSinceLastTrain > this.config.mlConfig.retrainInterval;
    
    return hasEnoughData && timeToRetrain;
  }

  private async retrainMLModel(): Promise<void> {
    if (!this.mlModel || this.trainingData.length < this.config.mlConfig.minSamples) {
      return;
    }
    
    // Implementação simplificada de treinamento
    // Em produção, usaria biblioteca de ML mais robusta
    
    const learningRate = this.config.mlConfig.learningRate;
    const epochs = 100;
    
    for (let epoch = 0; epoch < epochs; epoch++) {
      for (const data of this.trainingData) {
        const features = {
          successRate: data.features.successRate / 100,
          latency: data.features.latency / 5000,
          cost: data.features.cost / 10,
          availability: data.features.availability,
          timeOfDay: data.features.timeOfDay / 24,
          dayOfWeek: data.features.dayOfWeek / 7,
          transactionAmount: data.features.transactionAmount / 1000000
        };
        
        const prediction = this.predict(features);
        const actual = data.outcome.success ? 1 : 0;
        const error = prediction - actual;
        
        // Atualiza pesos
        for (const [feature, value] of Object.entries(features)) {
          this.mlModel.weights[feature] -= learningRate * error * value;
        }
        this.mlModel.bias -= learningRate * error;
      }
    }
    
    // Calcula nova acurácia
    let correct = 0;
    for (const data of this.trainingData.slice(-50)) { // Testa nos últimos 50
      const features = {
        successRate: data.features.successRate / 100,
        latency: data.features.latency / 5000,
        cost: data.features.cost / 10,
        availability: data.features.availability,
        timeOfDay: data.features.timeOfDay / 24,
        dayOfWeek: data.features.dayOfWeek / 7,
        transactionAmount: data.features.transactionAmount / 1000000
      };
      
      const prediction = this.predict(features);
      const actual = data.outcome.success ? 1 : 0;
      
      if ((prediction > 0.5 && actual === 1) || (prediction <= 0.5 && actual === 0)) {
        correct++;
      }
    }
    
    this.mlModel.accuracy = correct / Math.min(50, this.trainingData.length);
    this.mlModel.lastTrained = new Date();
    this.mlModel.trainingDataSize = this.trainingData.length;
    
    // Atualiza estatísticas
    this.statistics.mlModelAccuracy = this.mlModel.accuracy;
  }
}