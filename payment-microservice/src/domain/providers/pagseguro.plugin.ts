import { ProviderPlugin } from '../services/provider-registry';
import { PagSeguroProvider } from './pagseguro-provider';

/**
 * Plugin definition for PagSeguro provider
 */
export const PagSeguroPlugin: ProviderPlugin = {
  name: 'pagseguro',
  version: '1.0.0',
  providerClass: PagSeguroProvider,
  requiredCredentials: ['email', 'token'],
  isActive: true,
  defaultConfig: {
    settings: {
      automaticCapture: false, // PagSeguro requer ação do usuário
      supportedCurrencies: ['BRL'],
      paymentMethods: ['creditCard', 'boleto', 'pix', 'debitCard'],
      environment: 'sandbox'
    }
  }
};

export default PagSeguroPlugin;