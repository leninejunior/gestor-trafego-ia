/**
 * Google Module Index
 * Exporta todas as funcionalidades do módulo Google
 */

export { GoogleOAuthService, getGoogleOAuthService } from './oauth';
export { GoogleAdsCryptoService, getGoogleAdsCryptoService } from './crypto-service';
export { getGoogleAdsAuditService } from './audit-service';

export type {
  GoogleOAuthConfig,
  TokenResponse,
  AuthorizationUrlOptions,
  EncryptionResult,
  DecryptionResult,
  EncryptionKey
} from './oauth';