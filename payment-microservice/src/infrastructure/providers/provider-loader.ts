import { ProviderRegistry } from '../../domain/services/provider-registry';
import { StripePlugin } from '../../domain/providers/stripe.plugin';
import { IuguPlugin } from '../../domain/providers/iugu.plugin';
import { PagSeguroPlugin } from '../../domain/providers/pagseguro.plugin';
import { MercadoPagoPlugin } from '../../domain/providers/mercadopago.plugin';

/**
 * Carregador de provedores de pagamento
 * Registra todos os provedores disponíveis no sistema
 */
export class ProviderLoader {
  private static instance: ProviderLoader;
  private registry: ProviderRegistry;
  private isLoaded: boolean = false;

  private constructor() {
    this.registry = ProviderRegistry.getInstance();
  }

  /**
   * Singleton instance
   */
  static getInstance(): ProviderLoader {
    if (!ProviderLoader.instance) {
      ProviderLoader.instance = new ProviderLoader();
    }
    return ProviderLoader.instance;
  }

  /**
   * Carrega todos os provedores disponíveis
   */
  async loadProviders(): Promise<void> {
    if (this.isLoaded) {
      return;
    }

    try {
      // Registra o provedor Stripe
      this.registry.registerPlugin(StripePlugin);

      // Registra o provedor Iugu
      this.registry.registerPlugin(IuguPlugin);

      // Registra o provedor PagSeguro
      this.registry.registerPlugin(PagSeguroPlugin);

      // Registra o provedor Mercado Pago
      this.registry.registerPlugin(MercadoPagoPlugin);

      console.log('All payment providers loaded successfully');

      this.isLoaded = true;
      console.log('Payment providers loaded successfully');
    } catch (error) {
      console.error('Failed to load payment providers:', error);
      throw error;
    }
  }

  /**
   * Recarrega todos os provedores
   */
  async reloadProviders(): Promise<void> {
    this.registry.clear();
    this.isLoaded = false;
    await this.loadProviders();
  }

  /**
   * Lista provedores carregados
   */
  getLoadedProviders(): string[] {
    return this.registry.listActivePlugins().map(plugin => plugin.name);
  }

  /**
   * Verifica se um provedor específico está carregado
   */
  isProviderLoaded(name: string): boolean {
    return this.registry.hasPlugin(name);
  }

  /**
   * Obtém estatísticas dos provedores
   */
  getProviderStats(): {
    total: number;
    active: number;
    loaded: string[];
  } {
    const allPlugins = this.registry.listPlugins();
    const activePlugins = this.registry.listActivePlugins();

    return {
      total: allPlugins.length,
      active: activePlugins.length,
      loaded: activePlugins.map(plugin => plugin.name)
    };
  }
}

/**
 * Função utilitária para inicializar provedores
 */
export async function initializeProviders(): Promise<void> {
  const loader = ProviderLoader.getInstance();
  await loader.loadProviders();
}

/**
 * Função utilitária para obter registry de provedores
 */
export function getProviderRegistry(): ProviderRegistry {
  return ProviderRegistry.getInstance();
}