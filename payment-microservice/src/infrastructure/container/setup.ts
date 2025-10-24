import { container } from './container';
import { PaymentService } from '../../application/services/payment.service';
import { ProviderRegistry } from '../../domain/services/provider-registry';
import { HealthChecker } from '../../domain/services/health-checker';
import { WebhookSecurity } from '../../domain/services/webhook-security';
import { FailoverManager } from '../../domain/services/failover-manager';
import { AuditService } from '../../domain/services/audit-service';
import { TransactionRepository } from '../database/repositories/transaction.repository';
import { ProviderConfigRepository } from '../database/repositories/provider-config.repository';
import { AuditRepository } from '../database/repositories/audit.repository';
import { RedisService } from '../cache/redis.service';
import { MetricsService } from '../monitoring/metrics.service';
import { Logger } from '../logging/logger';
import { AdminController } from '../controllers/admin.controller';
import { ReportService } from '../controllers/report.service';
import { AlertManager } from '../controllers/alert-manager';

/**
 * Setup dependency injection container
 */
export function setupContainer(): void {
  // Infrastructure services
  container.registerFactory('Logger', () => Logger.getInstance());
  container.registerFactory('RedisService', () => RedisService.getInstance());
  container.registerFactory('MetricsService', () => MetricsService.getInstance());

  // Repositories
  container.registerFactory('TransactionRepository', () => new TransactionRepository());
  container.registerFactory('ProviderConfigRepository', () => new ProviderConfigRepository());
  container.registerFactory('AuditRepository', () => new AuditRepository());

  // Domain services
  container.registerFactory('ProviderRegistry', () => ProviderRegistry.getInstance());
  
  container.registerFactory('HealthChecker', () => HealthChecker.getInstance());

  container.registerFactory('WebhookSecurity', () => WebhookSecurity.getInstance());

  container.registerFactory('FailoverManager', () => FailoverManager.getInstance());

  container.registerFactory('AuditService', () => AuditService.getInstance());

  // Admin services
  container.registerFactory('ReportService', () => {
    const transactionRepository = container.get<TransactionRepository>('TransactionRepository');
    const providerConfigRepository = container.get<ProviderConfigRepository>('ProviderConfigRepository');
    return new ReportService(transactionRepository, providerConfigRepository);
  });

  container.registerFactory('AlertManager', () => new AlertManager());

  // Application services
  container.registerFactory('PaymentService', () => {
    const transactionRepository = container.get<TransactionRepository>('TransactionRepository');
    return new PaymentService(transactionRepository);
  });

  // Controllers
  container.registerFactory('AdminController', () => {
    const providerRegistry = container.get<ProviderRegistry>('ProviderRegistry');
    const healthChecker = container.get<HealthChecker>('HealthChecker');
    const auditService = container.get<AuditService>('AuditService');
    const reportService = container.get<ReportService>('ReportService');
    const alertManager = container.get<AlertManager>('AlertManager');
    
    return new AdminController(
      providerRegistry,
      healthChecker,
      auditService,
      reportService,
      alertManager
    );
  });
}

/**
 * Get container instance (for testing)
 */
export function getContainer() {
  return container;
}