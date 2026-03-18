/**
 * Services Module Index
 * Exporta todos os serviços disponíveis
 */

export { SubscriptionIntentService } from './subscription-intent-service';
export { PlanManagerService } from './plan-manager';
export { BillingEngineService } from './billing-engine';
export { ExportService } from './export-service';
export { NotificationService } from './notification-service';
export { HybridDataService } from './hybrid-data-service';
export { PlatformAggregationService } from './platform-aggregation';
export { CleanupService } from './cleanup-service';
export { FeatureGateService } from './feature-gate';
export { CacheFeatureGateService } from './cache-feature-gate';
export { PlanConfigurationService } from './plan-configuration-service';
export { SubscriptionService } from './subscription-service';
export { BalanceAlertService } from './balance-alert-service';
export { SubscriptionNotificationIntegrationService } from './subscription-notification-integration';
export { SubscriptionAnalyticsService } from './subscription-analytics';
export { SubscriptionIntentExpirationService } from './subscription-intent-expiration-service';
export { SubscriptionIntentStateMachineService } from './subscription-intent-state-machine';
export { GoogleTokenManagerService } from './google-token-manager';
export { EmailNotificationService } from './email-notification-service';
export { BillingNotificationService } from './billing-notification-service';

// Export types if needed
export type {
  // Add service types here if needed
} from './subscription-intent-service';