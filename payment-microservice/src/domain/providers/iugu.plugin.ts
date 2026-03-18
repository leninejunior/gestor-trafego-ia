import { ProviderPlugin } from '../services/provider-registry';
import { IuguProvider } from './iugu-provider';

/**
 * Plugin definition for Iugu provider
 */
export const IuguPlugin: ProviderPlugin = {
  name: 'iugu',
  version: '1.0.0',
  providerClass: IuguProvider,
  requiredCredentials: ['apiToken'],
  isActive: true,
  defaultConfig: {
    settings: {
      automaticCapture: false, // Iugu não tem captura manual
      supportedCurrencies: ['BRL'],
      paymentMethods: ['credit_card', 'bank_slip', 'pix'],
      boletoExpirationDays: 3
    }
  }
};

export default IuguPlugin;