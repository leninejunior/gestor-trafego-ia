import { ProviderPlugin } from '../services/provider-registry';
import { MercadoPagoProvider } from './mercadopago-provider';

/**
 * Plugin definition for Mercado Pago provider
 */
export const MercadoPagoPlugin: ProviderPlugin = {
  name: 'mercadopago',
  version: '1.0.0',
  providerClass: MercadoPagoProvider,
  requiredCredentials: ['accessToken'],
  isActive: true,
  defaultConfig: {
    settings: {
      automaticCapture: false, // Mercado Pago requer ação do usuário
      supportedCurrencies: ['BRL', 'ARS', 'CLP', 'COP', 'MXN', 'PEN', 'UYU'],
      paymentMethods: ['credit_card', 'debit_card', 'ticket', 'pix', 'bank_transfer'],
      boletoExpirationDays: 3,
      pixSettings: {
        expirationMinutes: 30
      }
    }
  }
};

export default MercadoPagoPlugin;