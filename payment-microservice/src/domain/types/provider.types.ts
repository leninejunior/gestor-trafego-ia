/**
 * Tipos para configuração e status de provedores
 */

export enum ProviderStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  OFFLINE = 'offline'
}

export interface ProviderConfig {
  /** ID único da configuração */
  id: string;
  
  /** Nome do provedor */
  name: string;
  
  /** Se o provedor está ativo */
  isActive: boolean;
  
  /** Prioridade do provedor (menor número = maior prioridade) */
  priority: number;
  
  /** Credenciais criptografadas */
  credentials: Record<string, string>;
  
  /** Configurações específicas do provedor */
  settings: Record<string, any>;
  
  /** URL para health check */
  healthCheckUrl?: string;
  
  /** URL para receber webhooks */
  webhookUrl?: string;
  
  /** Timestamp de criação */
  createdAt: Date;
  
  /** Timestamp de atualização */
  updatedAt: Date;
}

export interface HealthStatus {
  /** Status geral do provedor */
  status: ProviderStatus;
  
  /** Tempo de resposta em milissegundos */
  responseTime?: number;
  
  /** Taxa de erro (0-100) */
  errorRate?: number;
  
  /** Última verificação */
  lastCheck: Date;
  
  /** Detalhes adicionais */
  details?: {
    /** Se a API está acessível */
    apiAccessible: boolean;
    
    /** Se as credenciais são válidas */
    credentialsValid: boolean;
    
    /** Mensagens de erro */
    errors?: string[];
    
    /** Informações adicionais */
    metadata?: Record<string, any>;
  };
}

export interface ProviderMetrics {
  /** Nome do provedor */
  providerName: string;
  
  /** Total de transações processadas */
  totalTransactions: number;
  
  /** Transações bem-sucedidas */
  successfulTransactions: number;
  
  /** Taxa de sucesso (0-100) */
  successRate: number;
  
  /** Tempo médio de resposta */
  averageResponseTime: number;
  
  /** Período das métricas */
  period: {
    start: Date;
    end: Date;
  };
}