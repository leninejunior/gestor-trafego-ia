import { IPaymentProvider } from '../interfaces/payment-provider.interface';
import { ProviderConfig, PaymentError, PaymentErrorType, ProviderStatus } from '../types';
import { ProviderRegistry } from './provider-registry';
import { Validator } from '../validation/validator';
import { ProviderConfigSchema } from '../validation/schemas';

/**
 * Opções para criação de provedor
 */
export interface ProviderCreationOptions {
  /** Se deve configurar automaticamente o provedor */
  autoConfig?: boolean;
  
  /** Se deve validar a saúde do provedor após criação */
  validateHealth?: boolean;
  
  /** Timeout para validação de saúde em ms */
  healthCheckTimeout?: number;
  
  /** Metadados adicionais */
  metadata?: Record<string, any>;
}

/**
 * Resultado da criação de provedor
 */
export interface ProviderCreationResult {
  /** Instância do provedor criada */
  provider: IPaymentProvider;
  
  /** Se o provedor foi configurado com sucesso */
  configured: boolean;
  
  /** Status de saúde (se validação foi solicitada) */
  healthStatus?: any;
  
  /** Tempo de criação em ms */
  creationTime: number;
  
  /** Warnings ou informações adicionais */
  warnings?: string[];
}

/**
 * Factory para criação e configuração de provedores de pagamento
 */
export class ProviderFactory {
  private registry: ProviderRegistry;

  constructor(registry?: ProviderRegistry) {
    this.registry = registry || ProviderRegistry.getInstance();
  }

  /**
   * Cria e configura um provedor de pagamento
   */
  async createProvider(
    providerName: string,
    config: ProviderConfig,
    options: ProviderCreationOptions = {}
  ): Promise<ProviderCreationResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // Valida configuração
      const validatedConfig = Validator.validate(ProviderConfigSchema, config);

      // Verifica se o plugin existe
      if (!this.registry.hasPlugin(providerName)) {
        throw new PaymentError(
          PaymentErrorType.CONFIGURATION_ERROR,
          `Provider plugin '${providerName}' is not registered`,
          undefined,
          false
        );
      }

      // Cria instância do provedor
      const provider = this.registry.createProvider(providerName, validatedConfig);

      let configured = false;
      let healthStatus;

      // Configura automaticamente se solicitado
      if (options.autoConfig !== false) {
        try {
          await provider.configure(validatedConfig);
          configured = true;
        } catch (error) {
          if (error instanceof PaymentError) {
            throw error;
          }
          throw new PaymentError(
            PaymentErrorType.CONFIGURATION_ERROR,
            `Failed to configure provider '${providerName}': ${error instanceof Error ? error.message : 'Unknown error'}`,
            error,
            false,
            providerName
          );
        }
      }

      // Valida saúde se solicitado
      if (options.validateHealth && configured) {
        try {
          const timeout = options.healthCheckTimeout || 10000;
          healthStatus = await this.performHealthCheckWithTimeout(provider, timeout);
          
          if (healthStatus.status === ProviderStatus.UNHEALTHY) {
            warnings.push(`Provider '${providerName}' is unhealthy but was created successfully`);
          }
        } catch (error) {
          warnings.push(`Health check failed for provider '${providerName}': ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      const creationTime = Date.now() - startTime;

      return {
        provider,
        configured,
        healthStatus,
        creationTime,
        warnings: warnings.length > 0 ? warnings : undefined
      };

    } catch (error) {
      const creationTime = Date.now() - startTime;
      
      if (error instanceof PaymentError) {
        throw error;
      }
      
      throw new PaymentError(
        PaymentErrorType.CONFIGURATION_ERROR,
        `Failed to create provider '${providerName}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        error,
        false,
        providerName
      );
    }
  }

  /**
   * Cria múltiplos provedores em paralelo
   */
  async createMultipleProviders(
    configs: Array<{ name: string; config: ProviderConfig; options?: ProviderCreationOptions }>
  ): Promise<Map<string, ProviderCreationResult | PaymentError>> {
    const results = new Map<string, ProviderCreationResult | PaymentError>();

    const promises = configs.map(async ({ name, config, options }) => {
      try {
        const result = await this.createProvider(name, config, options);
        results.set(name, result);
      } catch (error) {
        results.set(name, error instanceof PaymentError ? error : new PaymentError(
          PaymentErrorType.CONFIGURATION_ERROR,
          `Failed to create provider '${name}': ${error instanceof Error ? error.message : 'Unknown error'}`,
          error,
          false,
          name
        ));
      }
    });

    await Promise.allSettled(promises);
    return results;
  }

  /**
   * Recria um provedor existente com nova configuração
   */
  async recreateProvider(
    providerName: string,
    newConfig: ProviderConfig,
    options: ProviderCreationOptions = {}
  ): Promise<ProviderCreationResult> {
    // Remove instância existente
    this.registry.removeProvider(providerName);

    // Cria nova instância
    return await this.createProvider(providerName, newConfig, options);
  }

  /**
   * Clona um provedor existente com configuração modificada
   */
  async cloneProvider(
    sourceProviderName: string,
    targetProviderName: string,
    configOverrides: Partial<ProviderConfig>,
    options: ProviderCreationOptions = {}
  ): Promise<ProviderCreationResult> {
    const sourceProvider = this.registry.getProvider(sourceProviderName);
    if (!sourceProvider) {
      throw new PaymentError(
        PaymentErrorType.CONFIGURATION_ERROR,
        `Source provider '${sourceProviderName}' not found`,
        undefined,
        false
      );
    }

    const sourcePlugin = this.registry.getPlugin(sourceProviderName);
    if (!sourcePlugin) {
      throw new PaymentError(
        PaymentErrorType.CONFIGURATION_ERROR,
        `Source provider plugin '${sourceProviderName}' not found`,
        undefined,
        false
      );
    }

    // Cria configuração mesclada
    const baseConfig: ProviderConfig = {
      id: targetProviderName,
      name: targetProviderName,
      isActive: true,
      priority: 0,
      credentials: {},
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      ...sourcePlugin.defaultConfig,
      ...configOverrides
    };

    return await this.createProvider(targetProviderName, baseConfig, options);
  }

  /**
   * Cria um provedor com configuração padrão
   */
  async createProviderWithDefaults(
    providerName: string,
    credentials: Record<string, string>,
    options: ProviderCreationOptions = {}
  ): Promise<ProviderCreationResult> {
    const plugin = this.registry.getPlugin(providerName);
    if (!plugin) {
      throw new PaymentError(
        PaymentErrorType.CONFIGURATION_ERROR,
        `Provider plugin '${providerName}' not found`,
        undefined,
        false
      );
    }

    const defaultConfig: ProviderConfig = {
      id: `${providerName}-${Date.now()}`,
      name: providerName,
      isActive: true,
      priority: 0,
      credentials,
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      ...plugin.defaultConfig
    };

    return await this.createProvider(providerName, defaultConfig, options);
  }

  /**
   * Lista provedores disponíveis para criação
   */
  getAvailableProviders(): Array<{
    name: string;
    version: string;
    isActive: boolean;
    requiredCredentials: string[];
  }> {
    return this.registry.listPlugins().map(plugin => ({
      name: plugin.name,
      version: plugin.version,
      isActive: plugin.isActive,
      requiredCredentials: plugin.requiredCredentials
    }));
  }

  /**
   * Valida se uma configuração é válida para um provedor
   */
  async validateProviderConfig(
    providerName: string,
    config: ProviderConfig
  ): Promise<{ isValid: boolean; errors?: string[] }> {
    try {
      // Valida schema básico
      Validator.validate(ProviderConfigSchema, config);

      // Verifica se o plugin existe
      const plugin = this.registry.getPlugin(providerName);
      if (!plugin) {
        return {
          isValid: false,
          errors: [`Provider plugin '${providerName}' not found`]
        };
      }

      // Verifica credenciais obrigatórias
      const missingCredentials = plugin.requiredCredentials.filter(
        field => !config.credentials[field] || config.credentials[field].trim() === ''
      );

      if (missingCredentials.length > 0) {
        return {
          isValid: false,
          errors: [`Missing required credentials: ${missingCredentials.join(', ')}`]
        };
      }

      // Tenta criar uma instância temporária para validação
      const tempProvider = new plugin.providerClass();
      const isConfigValid = await tempProvider.validateConfig(config);

      return {
        isValid: isConfigValid,
        errors: isConfigValid ? undefined : ['Provider-specific validation failed']
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error']
      };
    }
  }

  /**
   * Executa health check com timeout
   */
  private async performHealthCheckWithTimeout(
    provider: IPaymentProvider,
    timeout: number
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Health check timeout after ${timeout}ms`));
      }, timeout);

      provider.healthCheck()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
}