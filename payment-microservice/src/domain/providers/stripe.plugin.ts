import { ProviderPlugin } from '../services/provider-registry';
import { StripeProvider } from './stripe-provider';

/**
 * Plugin definition for Stripe provider
 */
export const StripePlugin: ProviderPlugin = {
  name: 'stripe',
  version: '1.0.0',
  providerClass: StripeProvider,
  requiredCredentials: ['secretKey'],
  isActive: true,
  defaultConfig: {
    settings: {
      automaticCapture: true,
      supportedCurrencies: ['BRL', 'USD', 'EUR'],
      paymentMethods: ['card', 'pix', 'boleto']
    }
  }
};

export default StripePlugin;