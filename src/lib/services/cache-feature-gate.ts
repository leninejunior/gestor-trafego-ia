import { createClient } from '@/lib/supabase/server';
import { PlanConfigurationService } from './plan-configuration-service';

/**
 * Cache Feature Gate Service
 * 
 * Serviço especializado para validação de limites relacionados ao cache de dados históricos.
 * Implementa requisitos 2.1, 2.2, 3.1, 3.2, 3.3, 7.1, 7.2, 7.3, 8.3
 */
export class CacheFeatureGate {
  private planConfigService: PlanConfigurationService;

  constructor() {
    this.planConfigService = new PlanConfigurationService();
  }

  /**
   * Verifica se o usuário pode acessar dados históricos no período solicitado
   * Requisitos: 2.1, 2.2
   * 
   * @param userId - ID do usuário
   * @param requestedDays - Número de dias de dados históricos solicitados
   * @returns Objeto com resultado da validação
   */
  async checkDataRetention(
    userId: string,
    requestedDays: number
  ): Promise<{
    allowed: boolean;
    requestedDays: number;
    allowedDays: number;
    reason?: string;
  }> {
    try {
      const limits = await this.planConfigService.getUserPlanLimits(userId);

      if (!limits) {
        return {
          allowed: false,
          requestedDays,
          allowedDays: 0,
          reason: 'No active subscription found',
        };
      }

      const allowed = requestedDays <= limits.data_retention_days;

      return {
        allowed,
        requestedDays,
        allowedDays: limits.data_retention_days,
        reason: allowed
          ? undefined
          : `Data retention limit exceeded. Your plan allows ${limits.data_retention_days} days, but ${requestedDays} days were requested.`,
      };
    } catch (error) {
      console.error('Error checking data retention:', error);
      return {
        allowed: false,
        requestedDays,
        allowedDays: 0,
        reason: 'Error checking data retention limits',
      };
    }
  }

  /**
   * Verifica se o usuário pode adicionar mais clientes
   * Requisitos: 3.1, 3.2, 7.2
   * 
   * @param userId - ID do usuário
   * @returns Objeto com resultado da validação e contadores
   */
  async checkClientLimit(userId: string): Promise<{
    allowed: boolean;
    current: number;
    limit: number;
    remaining: number;
    isUnlimited: boolean;
    reason?: string;
  }> {
    try {
      const result = await this.planConfigService.canAddClient(userId);

      const isUnlimited = result.limit === -1;
      const remaining = isUnlimited ? -1 : Math.max(0, result.limit - result.current);

      return {
        allowed: result.allowed,
        current: result.current,
        limit: result.limit,
        remaining,
        isUnlimited,
        reason: result.allowed
          ? undefined
          : `Client limit reached. Your plan allows ${result.limit} clients, and you currently have ${result.current}.`,
      };
    } catch (error) {
      console.error('Error checking client limit:', error);
      return {
        allowed: false,
        current: 0,
        limit: 0,
        remaining: 0,
        isUnlimited: false,
        reason: 'Error checking client limits',
      };
    }
  }

  /**
   * Verifica se um cliente pode adicionar mais campanhas
   * Requisitos: 3.1, 3.2, 7.3
   * 
   * @param clientId - ID do cliente
   * @returns Objeto com resultado da validação e contadores
   */
  async checkCampaignLimit(clientId: string): Promise<{
    allowed: boolean;
    current: number;
    limit: number;
    remaining: number;
    isUnlimited: boolean;
    reason?: string;
  }> {
    try {
      const result = await this.planConfigService.canAddCampaign(clientId);

      const isUnlimited = result.limit === -1;
      const remaining = isUnlimited ? -1 : Math.max(0, result.limit - result.current);

      return {
        allowed: result.allowed,
        current: result.current,
        limit: result.limit,
        remaining,
        isUnlimited,
        reason: result.allowed
          ? undefined
          : `Campaign limit reached. Your plan allows ${result.limit} campaigns per client, and this client currently has ${result.current}.`,
      };
    } catch (error) {
      console.error('Error checking campaign limit:', error);
      return {
        allowed: false,
        current: 0,
        limit: 0,
        remaining: 0,
        isUnlimited: false,
        reason: 'Error checking campaign limits',
      };
    }
  }

  /**
   * Verifica se o usuário tem permissão para exportar dados no formato especificado
   * Requisitos: 8.3
   * 
   * @param userId - ID do usuário
   * @param format - Formato de exportação ('csv' ou 'json')
   * @returns Objeto com resultado da validação
   */
  async checkExportPermission(
    userId: string,
    format: 'csv' | 'json'
  ): Promise<{
    allowed: boolean;
    format: string;
    reason?: string;
  }> {
    try {
      const allowed = await this.planConfigService.canExport(userId, format);

      return {
        allowed,
        format,
        reason: allowed
          ? undefined
          : `Export to ${format.toUpperCase()} is not available in your current plan. Please upgrade to access this feature.`,
      };
    } catch (error) {
      console.error('Error checking export permission:', error);
      return {
        allowed: false,
        format,
        reason: 'Error checking export permissions',
      };
    }
  }

  /**
   * Obtém o intervalo de sincronização configurado para o plano do usuário
   * 
   * @param userId - ID do usuário
   * @returns Intervalo de sincronização em horas
   */
  async getSyncInterval(userId: string): Promise<number> {
    try {
      const limits = await this.planConfigService.getUserPlanLimits(userId);
      return limits?.sync_interval_hours || 24; // Default: 24 horas
    } catch (error) {
      console.error('Error getting sync interval:', error);
      return 24;
    }
  }

  /**
   * Valida se uma data solicitada está dentro do período de retenção
   * 
   * @param userId - ID do usuário
   * @param requestedDate - Data solicitada
   * @returns true se a data está dentro do período permitido
   */
  async isDateWithinRetention(userId: string, requestedDate: Date): Promise<boolean> {
    try {
      const limits = await this.planConfigService.getUserPlanLimits(userId);

      if (!limits) {
        return false;
      }

      const now = new Date();
      const diffTime = Math.abs(now.getTime() - requestedDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return diffDays <= limits.data_retention_days;
    } catch (error) {
      console.error('Error checking date retention:', error);
      return false;
    }
  }

  /**
   * Obtém o período máximo de retenção de dados para um usuário
   * 
   * @param userId - ID do usuário
   * @returns Número de dias de retenção permitidos
   */
  async getMaxRetentionDays(userId: string): Promise<number> {
    try {
      const limits = await this.planConfigService.getUserPlanLimits(userId);
      return limits?.data_retention_days || 90; // Default: 90 dias
    } catch (error) {
      console.error('Error getting max retention days:', error);
      return 90;
    }
  }

  /**
   * Valida múltiplos limites de uma vez
   * Útil para validações em batch
   * 
   * @param userId - ID do usuário
   * @param checks - Array de verificações a realizar
   * @returns Objeto com resultados de todas as verificações
   */
  async validateMultipleLimits(
    userId: string,
    checks: {
      dataRetention?: number;
      clientLimit?: boolean;
      exportFormat?: 'csv' | 'json';
    }
  ): Promise<{
    valid: boolean;
    results: {
      dataRetention?: {
        allowed: boolean;
        requestedDays: number;
        allowedDays: number;
        reason?: string;
      };
      clientLimit?: {
        allowed: boolean;
        current: number;
        limit: number;
        remaining: number;
        isUnlimited: boolean;
        reason?: string;
      };
      exportPermission?: {
        allowed: boolean;
        format: string;
        reason?: string;
      };
    };
    errors: string[];
  }> {
    const results: any = {};
    const errors: string[] = [];

    try {
      // Verificar retenção de dados
      if (checks.dataRetention !== undefined) {
        const retentionResult = await this.checkDataRetention(userId, checks.dataRetention);
        results.dataRetention = retentionResult;
        if (!retentionResult.allowed && retentionResult.reason) {
          errors.push(retentionResult.reason);
        }
      }

      // Verificar limite de clientes
      if (checks.clientLimit) {
        const clientResult = await this.checkClientLimit(userId);
        results.clientLimit = clientResult;
        if (!clientResult.allowed && clientResult.reason) {
          errors.push(clientResult.reason);
        }
      }

      // Verificar permissão de exportação
      if (checks.exportFormat) {
        const exportResult = await this.checkExportPermission(userId, checks.exportFormat);
        results.exportPermission = exportResult;
        if (!exportResult.allowed && exportResult.reason) {
          errors.push(exportResult.reason);
        }
      }

      return {
        valid: errors.length === 0,
        results,
        errors,
      };
    } catch (error) {
      console.error('Error validating multiple limits:', error);
      return {
        valid: false,
        results,
        errors: ['Error validating limits'],
      };
    }
  }

  /**
   * Obtém um resumo completo dos limites e uso atual do usuário
   * Requisito: 7.1, 7.4
   * 
   * @param userId - ID do usuário
   * @returns Objeto com todos os limites e uso atual
   */
  async getLimitsSummary(userId: string): Promise<{
    dataRetention: {
      days: number;
      isUnlimited: boolean;
    };
    clients: {
      current: number;
      limit: number;
      remaining: number;
      isUnlimited: boolean;
    };
    syncInterval: {
      hours: number;
    };
    export: {
      csv: boolean;
      json: boolean;
    };
  }> {
    try {
      const limits = await this.planConfigService.getUserPlanLimits(userId);

      if (!limits) {
        // Retornar limites padrão se não houver assinatura
        return {
          dataRetention: { days: 90, isUnlimited: false },
          clients: { current: 0, limit: 5, remaining: 5, isUnlimited: false },
          syncInterval: { hours: 24 },
          export: { csv: false, json: false },
        };
      }

      const clientCheck = await this.checkClientLimit(userId);

      return {
        dataRetention: {
          days: limits.data_retention_days,
          isUnlimited: limits.data_retention_days === -1,
        },
        clients: {
          current: clientCheck.current,
          limit: clientCheck.limit,
          remaining: clientCheck.remaining,
          isUnlimited: clientCheck.isUnlimited,
        },
        syncInterval: {
          hours: limits.sync_interval_hours,
        },
        export: {
          csv: limits.allow_csv_export,
          json: limits.allow_json_export,
        },
      };
    } catch (error) {
      console.error('Error getting limits summary:', error);
      throw error;
    }
  }
}

// Exportar instância singleton
export const cacheFeatureGate = new CacheFeatureGate();
