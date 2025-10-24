import { IPaymentProvider } from '../interfaces/payment-provider.interface';
import { ProviderConfig, PaymentError, PaymentErrorType, HealthStatus } from '../types';
import { Validator } from '../validation/validator';
import { ProviderConfigSchema } from '../validation/schemas';

/**
 * Interface para definição de plugin de provedor
 */
export interface ProviderPlugin {
  /** Nome único do provedor */
  name: string;
  
  /** Versão do plugin */
  version: string;
  
  /** Classe do provedor */
  providerClass: new () => IPaymentProvider;
  
  /** Configuração padrão */
  defaultConfig?: Partial<ProviderConfig>;
  
  /** Campos obrigatórios nas credenciais */
  requiredCredentials: string[];
  
  /** Se o plugin está ativo */
  isActive: boolean;
}

/**
 * Registry para gerenciar plugins de provedores de pagamento
 */
export class ProviderRegistry {
  private static instance: ProviderRegistry;
  private plugins: Map<string, ProviderPlugin> = new Map();
  private providers: Map<string, IPaymentProvider> = new Map();

  private constructor() {}

  /**
   * Singleton instance
   */
  static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  /**
   * Registra um novo plugin de provedor
   */
  registerPlugin(plugin: ProviderPlugin): void {
    // Valida o plugin
    this.validatePlugin(plugin);

    // Verifica se já existe
    if (this.plugins.has(plugin.name)) {
      throw new PaymentError(
        PaymentErrorType.CONFIGURATION_ERROR,
        `Provider plugin '${plugin.name}' is already registered`,
        undefined,
        false
      );
    }

    this.plugins.set(plugin.name, plugin);
  }

  /**
   * Remove um plugin do registry
   */
  unregisterPlugin(name: string): void {
    if (!this.plugins.has(name)) {
      throw new PaymentError(
        PaymentErrorType.CONFIGURATION_ERROR,
        `Provider plugin '${name}' is not registered`,
        undefined,
        false
      );
    }

    // Remove instância ativa se existir
    if (this.providers.has(name)) {
      this.providers.delete(name);
    }

    this.plugins.delete(name);
  }

  /**
   * Lista todos os plugins registrados
   */
  listPlugins(): ProviderPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Lista apenas plugins ativos
   */
  listActivePlugins(): ProviderPlugin[] {
    return Array.from(this.plugins.values()).filter(plugin => plugin.isActive);
  }

  /**
   * Obtém um plugin específico
   */
  getPlugin(name: string): ProviderPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Verifica se um plugin está registrado
   */
  hasPlugin(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Cria uma instância de provedor
   */
  createProvider(name: string, config: ProviderConfig): IPaymentProvider {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new PaymentError(
        PaymentErrorType.CONFIGURATION_ERROR,
        `Provider plugin '${name}' is not registered`,
        undefined,
        false
      );
    }

    if (!plugin.isActive) {
      throw new PaymentError(
        PaymentErrorType.CONFIGURATION_ERROR,
        `Provider plugin '${name}' is not active`,
        undefined,
        false
      );
    }

    // Valida configuração
    const validatedConfig = Validator.validate(ProviderConfigSchema, config);

    // Verifica credenciais obrigatórias
    this.validateRequiredCredentials(plugin, validatedConfig);

    // Cria instância
    const provider = new plugin.providerClass();

    // Armazena instância
    this.providers.set(name, provider);

    return provider;
  }

  /**
   * Obtém uma instância existente de provedor
   */
  getProvider(name: string): IPaymentProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Remove uma instância de provedor
   */
  removeProvider(name: string): void {
    this.providers.delete(name);
  }

  /**
   * Lista todas as instâncias ativas de provedores
   */
  listActiveProviders(): IPaymentProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Obtém todos os provedores registrados (alias para listActiveProviders)
   */
  getAllProviders(): IPaymentProvider[] {
    return this.listActiveProviders();
  }

  /**
   * Verifica saúde de todos os provedores ativos
   */
  async checkAllProvidersHealth(): Promise<Map<string, HealthStatus>> {
    const healthResults = new Map<string, HealthStatus>();

    for (const [name, provider] of this.providers) {
      try {
        const health = await provider.healthCheck();
        healthResults.set(name, health);
      } catch (error) {
        healthResults.set(name, {
          status: 'unhealthy' as any,
          lastCheck: new Date(),
          details: {
            apiAccessible: false,
            credentialsValid: false,
            errors: [error instanceof Error ? error.message : 'Unknown error']
          }
        });
      }
    }

    return healthResults;
  }

  /**
   * Carrega plugins dinamicamente de um diretório
   */
  async loadPluginsFromDirectory(directory: string): Promise<void> {
    try {
      const fs = require('fs').promises;
      const path = require('path');

      const files = await fs.readdir(directory);
      const pluginFiles = files.filter((file: string) => 
        file.endsWith('.plugin.js') || file.endsWith('.plugin.ts')
      );

      for (const file of pluginFiles) {
        try {
          const pluginPath = path.join(directory, file);
          const pluginModule = await import(pluginPath);
          
          if (pluginModule.default && typeof pluginModule.default === 'object') {
            const plugin = pluginModule.default as ProviderPlugin;
            this.registerPlugin(plugin);
          }
        } catch (error) {
          console.warn(`Failed to load plugin from ${file}:`, error);
        }
      }
    } catch (error) {
      throw new PaymentError(
        PaymentErrorType.CONFIGURATION_ERROR,
        `Failed to load plugins from directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error,
        false
      );
    }
  }

  /**
   * Valida um plugin antes do registro
   */
  private validatePlugin(plugin: ProviderPlugin): void {
    if (!plugin.name || typeof plugin.name !== 'string') {
      throw new PaymentError(
        PaymentErrorType.VALIDATION_ERROR,
        'Plugin name is required and must be a string',
        undefined,
        false
      );
    }

    if (!plugin.version || typeof plugin.version !== 'string') {
      throw new PaymentError(
        PaymentErrorType.VALIDATION_ERROR,
        'Plugin version is required and must be a string',
        undefined,
        false
      );
    }

    if (!plugin.providerClass || typeof plugin.providerClass !== 'function') {
      throw new PaymentError(
        PaymentErrorType.VALIDATION_ERROR,
        'Plugin providerClass is required and must be a constructor function',
        undefined,
        false
      );
    }

    if (!Array.isArray(plugin.requiredCredentials)) {
      throw new PaymentError(
        PaymentErrorType.VALIDATION_ERROR,
        'Plugin requiredCredentials must be an array',
        undefined,
        false
      );
    }

    if (typeof plugin.isActive !== 'boolean') {
      throw new PaymentError(
        PaymentErrorType.VALIDATION_ERROR,
        'Plugin isActive must be a boolean',
        undefined,
        false
      );
    }
  }

  /**
   * Valida se as credenciais obrigatórias estão presentes
   */
  private validateRequiredCredentials(plugin: ProviderPlugin, config: ProviderConfig): void {
    const missingCredentials = plugin.requiredCredentials.filter(
      field => !config.credentials[field] || config.credentials[field].trim() === ''
    );

    if (missingCredentials.length > 0) {
      throw new PaymentError(
        PaymentErrorType.CONFIGURATION_ERROR,
        `Missing required credentials for provider '${plugin.name}': ${missingCredentials.join(', ')}`,
        undefined,
        false
      );
    }
  }

  /**
   * Limpa todas as instâncias e plugins (útil para testes)
   */
  clear(): void {
    this.providers.clear();
    this.plugins.clear();
  }
}