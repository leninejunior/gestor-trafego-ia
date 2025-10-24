import { Response, NextFunction } from 'express';
import { Logger } from '../logging/logger';
import { MetricsService } from '../monitoring/metrics.service';
import { ProviderRegistry } from '../../domain/services/provider-registry';
import { HealthChecker } from '../../domain/services/health-checker';
import { AuditService } from '../../domain/services/audit-service';
import { ReportService } from './report.service';
import { AlertManager } from './alert-manager';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export interface AdminUser {
  id: string;
  email: string;
  role: 'super_admin' | 'admin' | 'viewer';
  organizationId?: string;
  permissions: string[];
}

export class AdminController {
  private logger = Logger.getInstance();
  private metricsService = MetricsService.getInstance();

  constructor(
    private providerRegistry: ProviderRegistry,
    private healthChecker: HealthChecker,
    private auditService: AuditService,
    private reportService: ReportService,
    private alertManager: AlertManager
  ) {}

  /**
   * GET /api/v1/admin/dashboard
   * Get admin dashboard overview
   */
  async getDashboard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AdminUser;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          correlationId: req.correlationId
        });
        return;
      }

      this.logger.info('Admin dashboard accessed', {
        correlationId: req.correlationId,
        userId: user.id,
        role: user.role
      });

      // Check permissions
      if (!this.hasPermission(user, 'dashboard:read')) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          correlationId: req.correlationId
        });
        return;
      }

      // Get dashboard data
      const [
        providersStatus,
        systemMetrics,
        recentTransactions,
        activeAlerts
      ] = await Promise.all([
        this.getProvidersOverview(),
        this.getSystemMetrics(),
        this.getRecentTransactions(user),
        this.getActiveAlerts(user)
      ]);

      const dashboard = {
        overview: {
          totalProviders: providersStatus.length,
          healthyProviders: providersStatus.filter(p => p.status === 'healthy').length,
          totalTransactions: systemMetrics.totalTransactions,
          successRate: systemMetrics.successRate,
          averageResponseTime: systemMetrics.averageResponseTime
        },
        providers: providersStatus,
        metrics: systemMetrics,
        recentTransactions: recentTransactions.slice(0, 10),
        alerts: activeAlerts,
        lastUpdated: new Date()
      };

      res.json({
        success: true,
        data: dashboard,
        correlationId: req.correlationId
      });

    } catch (error) {
      this.logger.error('Admin dashboard failed', {
        correlationId: req.correlationId,
        userId: (req.user as AdminUser)?.id,
        error: error instanceof Error ? error.message : error
      });
      
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/providers
   * Get detailed provider information for admin
   */
  async getProvidersAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AdminUser;

      this.logger.info('Admin providers list accessed', {
        correlationId: req.correlationId,
        userId: user.id,
        role: user.role
      });

      // Check permissions
      if (!this.hasPermission(user, 'providers:read')) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          correlationId: req.correlationId
        });
        return;
      }

      const providers = this.providerRegistry.getAllProviders();
      const detailedProviders = await Promise.all(
        providers.map(async (provider: any) => {
          const healthStatus = await this.healthChecker.checkProvider(provider);
          const metrics = await this.getProviderMetrics(provider.name);
          
          return {
            name: provider.name,
            version: provider.version,
            status: healthStatus.status,
            responseTime: healthStatus.responseTime,
            errorRate: metrics.errorRate,
            totalTransactions: metrics.totalTransactions,
            successfulTransactions: metrics.successfulTransactions,
            failedTransactions: metrics.failedTransactions,
            lastTransaction: metrics.lastTransaction,
            configuration: {
              isActive: true, // TODO: Get from database
              priority: 1, // TODO: Get from database
              webhookUrl: (provider as any).webhookUrl || null
            },
            capabilities: {
              payments: true,
              subscriptions: true,
              refunds: true,
              webhooks: true
            }
          };
        })
      );

      res.json({
        success: true,
        data: detailedProviders,
        count: detailedProviders.length,
        correlationId: req.correlationId
      });

    } catch (error) {
      this.logger.error('Admin providers list failed', {
        correlationId: req.correlationId,
        userId: (req.user as AdminUser)?.id,
        error: error instanceof Error ? error.message : error
      });
      
      next(error);
    }
  }

  /**
   * PUT /api/v1/admin/providers/:name/config
   * Update provider configuration
   */
  async updateProviderConfig(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AdminUser;
      const { name } = req.params;
      const { isActive, priority, credentials, settings } = req.body;

      this.logger.info('Admin updating provider config', {
        correlationId: req.correlationId,
        userId: user.id,
        providerName: name,
        isActive,
        priority
      });

      // Check permissions
      if (!this.hasPermission(user, 'providers:write')) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          correlationId: req.correlationId
        });
        return;
      }

      const provider = this.providerRegistry.getProvider(name);
      if (!provider) {
        res.status(404).json({
          success: false,
          error: 'Provider not found',
          correlationId: req.correlationId
        });
        return;
      }

      // Validate configuration
      if (credentials && typeof credentials !== 'object') {
        res.status(400).json({
          success: false,
          error: 'Invalid credentials format',
          correlationId: req.correlationId
        });
        return;
      }

      if (priority !== undefined && (typeof priority !== 'number' || priority < 0)) {
        res.status(400).json({
          success: false,
          error: 'Priority must be a non-negative number',
          correlationId: req.correlationId
        });
        return;
      }

      // Update provider configuration
      try {
        // Here we would normally update the database
        // For now, we'll simulate the update
        
        if (credentials) {
          // Encrypt credentials before storing
          // This would use the CredentialsManager in a real implementation
          this.logger.info('Credentials updated for provider', { providerName: name });
        }

        // Reload provider configuration if it's active
        if (isActive !== false) {
          // Create a basic config object for the provider
          const config = {
            apiKey: credentials?.apiKey || '',
            apiSecret: credentials?.apiSecret || '',
            environment: settings?.environment || 'sandbox',
            webhookUrl: settings?.webhookUrl || '',
            ...settings
          };
          
          await provider.configure(config);
          this.logger.info('Provider configuration reloaded', { providerName: name });
        }
      } catch (configError) {
        this.logger.error('Failed to update provider configuration', {
          providerName: name,
          error: configError instanceof Error ? configError.message : configError
        });
        
        res.status(500).json({
          success: false,
          error: 'Failed to update provider configuration',
          correlationId: req.correlationId
        });
        return;
      }

      // Audit the configuration change
      await this.auditService.logAction({
        userId: user.id,
        action: 'provider_config_updated',
        resourceType: 'provider',
        resourceId: name,
        details: {
          isActive,
          priority,
          hasCredentials: !!credentials,
          settingsKeys: settings ? Object.keys(settings) : []
        },
        timestamp: new Date()
      });

      const updatedConfig = {
        name,
        isActive: isActive ?? true,
        priority: priority ?? 1,
        settings: settings || {},
        updatedAt: new Date(),
        updatedBy: user.id
      };

      res.json({
        success: true,
        data: updatedConfig,
        correlationId: req.correlationId
      });

    } catch (error) {
      this.logger.error('Admin provider config update failed', {
        correlationId: req.correlationId,
        userId: (req.user as AdminUser)?.id,
        providerName: req.params.name,
        error: error instanceof Error ? error.message : error
      });
      
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/reports/financial
   * Get consolidated financial reports
   */
  async getFinancialReports(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AdminUser;
      const { startDate, endDate, groupBy = 'day', providers } = req.query;

      this.logger.info('Admin financial reports accessed', {
        correlationId: req.correlationId,
        userId: user.id,
        startDate,
        endDate,
        groupBy
      });

      // Check permissions
      if (!this.hasPermission(user, 'reports:read')) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          correlationId: req.correlationId
        });
        return;
      }

      const reportParams = {
        startDate: startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: endDate ? new Date(endDate as string) : new Date(),
        groupBy: groupBy as 'hour' | 'day' | 'week' | 'month',
        providers: providers ? (providers as string).split(',') : undefined,
        organizationId: user.role !== 'super_admin' ? user.organizationId : undefined
      };

      const report = await this.reportService.generateFinancialReport(reportParams);

      res.json({
        success: true,
        data: report,
        correlationId: req.correlationId
      });

    } catch (error) {
      this.logger.error('Admin financial reports failed', {
        correlationId: req.correlationId,
        userId: (req.user as AdminUser)?.id,
        error: error instanceof Error ? error.message : error
      });
      
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/reports/performance
   * Get provider performance reports
   */
  async getPerformanceReports(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AdminUser;
      const { startDate, endDate, providers } = req.query;

      this.logger.info('Admin performance reports accessed', {
        correlationId: req.correlationId,
        userId: user.id,
        startDate,
        endDate
      });

      // Check permissions
      if (!this.hasPermission(user, 'reports:read')) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          correlationId: req.correlationId
        });
        return;
      }

      const reportParams = {
        startDate: startDate ? new Date(startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: endDate ? new Date(endDate as string) : new Date(),
        providers: providers ? (providers as string).split(',') : undefined
      };

      const report = await this.reportService.generatePerformanceReport(reportParams);

      res.json({
        success: true,
        data: report,
        correlationId: req.correlationId
      });

    } catch (error) {
      this.logger.error('Admin performance reports failed', {
        correlationId: req.correlationId,
        userId: (req.user as AdminUser)?.id,
        error: error instanceof Error ? error.message : error
      });
      
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/audit-logs
   * Get audit logs
   */
  async getAuditLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AdminUser;
      const { 
        startDate, 
        endDate, 
        userId, 
        action, 
        resourceType,
        limit = 100,
        offset = 0 
      } = req.query;

      this.logger.info('Admin audit logs accessed', {
        correlationId: req.correlationId,
        userId: user.id,
        filters: { userId, action, resourceType }
      });

      // Check permissions
      if (!this.hasPermission(user, 'audit:read')) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          correlationId: req.correlationId
        });
        return;
      }

      const filters = {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        userId: userId as string,
        action: action as string,
        resourceType: resourceType as string,
        organizationId: user.role !== 'super_admin' ? user.organizationId : undefined
      };

      const auditLogs = await this.auditService.getAuditLogs(
        filters,
        parseInt(limit as string),
        parseInt(offset as string)
      );

      res.json({
        success: true,
        data: auditLogs,
        correlationId: req.correlationId
      });

    } catch (error) {
      this.logger.error('Admin audit logs failed', {
        correlationId: req.correlationId,
        userId: (req.user as AdminUser)?.id,
        error: error instanceof Error ? error.message : error
      });
      
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/alerts
   * Get system alerts
   */
  async getAlerts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AdminUser;
      const { status, severity, limit = 50 } = req.query;

      this.logger.info('Admin alerts accessed', {
        correlationId: req.correlationId,
        userId: user.id,
        filters: { status, severity }
      });

      // Check permissions
      if (!this.hasPermission(user, 'alerts:read')) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          correlationId: req.correlationId
        });
        return;
      }

      const filters = {
        status: status as 'active' | 'resolved' | 'acknowledged',
        severity: severity as 'low' | 'medium' | 'high' | 'critical',
        organizationId: user.role !== 'super_admin' ? user.organizationId : undefined
      };

      const alerts = await this.alertManager.getAlerts(filters, parseInt(limit as string));

      res.json({
        success: true,
        data: alerts,
        count: alerts.length,
        correlationId: req.correlationId
      });

    } catch (error) {
      this.logger.error('Admin alerts failed', {
        correlationId: req.correlationId,
        userId: (req.user as AdminUser)?.id,
        error: error instanceof Error ? error.message : error
      });
      
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/system/health
   * Get detailed system health information
   */
  async getSystemHealth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AdminUser;

      this.logger.info('Admin system health accessed', {
        correlationId: req.correlationId,
        userId: user.id
      });

      // Check permissions
      if (!this.hasPermission(user, 'system:read')) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          correlationId: req.correlationId
        });
        return;
      }

      const [providersHealth, systemMetrics] = await Promise.all([
        this.getProvidersOverview(),
        this.getSystemMetrics()
      ]);

      const health = {
        status: 'healthy',
        timestamp: new Date(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        providers: providersHealth,
        metrics: systemMetrics,
        database: {
          status: 'connected', // This would be checked in a real implementation
          connections: 10 // This would come from connection pool
        },
        redis: {
          status: 'connected', // This would be checked in a real implementation
          memory: '50MB' // This would come from Redis info
        }
      };

      res.json({
        success: true,
        data: health,
        correlationId: req.correlationId
      });

    } catch (error) {
      this.logger.error('Admin system health failed', {
        correlationId: req.correlationId,
        userId: (req.user as AdminUser)?.id,
        error: error instanceof Error ? error.message : error
      });
      
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/system/maintenance
   * Enable/disable maintenance mode
   */
  async setMaintenanceMode(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AdminUser;
      const { enabled, message } = req.body;

      this.logger.info('Admin maintenance mode change', {
        correlationId: req.correlationId,
        userId: user.id,
        enabled,
        message
      });

      // Check permissions
      if (!this.hasPermission(user, 'system:write')) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          correlationId: req.correlationId
        });
        return;
      }

      // Validate input
      if (typeof enabled !== 'boolean') {
        res.status(400).json({
          success: false,
          error: 'enabled field must be a boolean',
          correlationId: req.correlationId
        });
        return;
      }

      // In a real implementation, this would update a global maintenance flag
      // For now, we'll just log and audit the action
      
      await this.auditService.logAction({
        userId: user.id,
        action: enabled ? 'maintenance_enabled' : 'maintenance_disabled',
        resourceType: 'system',
        resourceId: 'maintenance',
        details: { message },
        timestamp: new Date()
      });

      res.json({
        success: true,
        data: {
          maintenanceMode: enabled,
          message: message || (enabled ? 'System is under maintenance' : 'System is operational'),
          updatedBy: user.id,
          updatedAt: new Date()
        },
        correlationId: req.correlationId
      });

    } catch (error) {
      this.logger.error('Admin maintenance mode failed', {
        correlationId: req.correlationId,
        userId: (req.user as AdminUser)?.id,
        error: error instanceof Error ? error.message : error
      });
      
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/alerts/:id/acknowledge
   * Acknowledge an alert
   */
  async acknowledgeAlert(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AdminUser;
      const { id } = req.params;
      const { note } = req.body;

      this.logger.info('Admin acknowledging alert', {
        correlationId: req.correlationId,
        userId: user.id,
        alertId: id
      });

      // Check permissions
      if (!this.hasPermission(user, 'alerts:write')) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          correlationId: req.correlationId
        });
        return;
      }

      await this.alertManager.acknowledgeAlert(id, user.id, note);

      // Audit the action
      await this.auditService.logAction({
        userId: user.id,
        action: 'alert_acknowledged',
        resourceType: 'alert',
        resourceId: id,
        details: { note },
        timestamp: new Date()
      });

      res.json({
        success: true,
        message: 'Alert acknowledged successfully',
        correlationId: req.correlationId
      });

    } catch (error) {
      this.logger.error('Admin alert acknowledgment failed', {
        correlationId: req.correlationId,
        userId: (req.user as AdminUser)?.id,
        alertId: req.params.id,
        error: error instanceof Error ? error.message : error
      });
      
      next(error);
    }
  }

  // Helper methods

  private hasPermission(user: AdminUser, permission: string): boolean {
    // Validate user object
    if (!user || !user.role || !Array.isArray(user.permissions)) {
      return false;
    }

    // Super admin has all permissions
    if (user.role === 'super_admin') {
      return true;
    }

    // Check if user has specific permission
    return user.permissions.includes(permission);
  }

  private async getProvidersOverview() {
    const providers = this.providerRegistry.getAllProviders();
    return Promise.all(
      providers.map(async (provider) => {
        const healthStatus = await this.healthChecker.checkProvider(provider);
        return {
          name: provider.name,
          status: healthStatus.status,
          responseTime: healthStatus.responseTime
        };
      })
    );
  }

  private async getSystemMetrics() {
    try {
      // Get metrics from Prometheus registry
      const metricsString = await this.metricsService.getMetrics();
      
      // Parse basic metrics from the metrics string
      // In a real implementation, you'd have proper metric aggregation
      const totalTransactions = this.parseMetricValue(metricsString, 'payment_transactions_total') || 0;
      const errorCount = this.parseMetricValue(metricsString, 'payment_errors_total') || 0;
      
      return {
        totalTransactions,
        successRate: totalTransactions > 0 ? ((totalTransactions - errorCount) / totalTransactions) * 100 : 0,
        averageResponseTime: this.parseMetricValue(metricsString, 'payment_duration_seconds') || 0,
        errorRate: totalTransactions > 0 ? (errorCount / totalTransactions) * 100 : 0,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      };
    } catch (error) {
      this.logger.warn('Failed to get system metrics', {
        error: error instanceof Error ? error.message : error
      });
      
      return {
        totalTransactions: 0,
        successRate: 0,
        averageResponseTime: 0,
        errorRate: 0,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      };
    }
  }

  private parseMetricValue(metricsString: string, metricName: string): number {
    try {
      const regex = new RegExp(`${metricName}\\s+(\\d+(?:\\.\\d+)?)`);
      const match = metricsString.match(regex);
      return match ? parseFloat(match[1]) : 0;
    } catch {
      return 0;
    }
  }

  private async getRecentTransactions(user: AdminUser) {
    try {
      // Get recent transactions from audit service
      const filters = {
        eventType: 'payment_processed',
        organizationId: user.role !== 'super_admin' ? user.organizationId : undefined,
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      };
      
      const auditLogs = await this.auditService.getAuditLogs(filters, 10, 0);
      
      return auditLogs.map(log => ({
        id: log.id,
        amount: (log as any).metadata?.amount || 0,
        currency: (log as any).metadata?.currency || 'USD',
        provider: (log as any).metadata?.provider || 'unknown',
        status: (log as any).metadata?.status || 'unknown',
        timestamp: log.timestamp,
        organizationId: (log as any).metadata?.organizationId
      }));
    } catch (error) {
      this.logger.warn('Failed to get recent transactions', {
        error: error instanceof Error ? error.message : error
      });
      return [];
    }
  }

  private async getActiveAlerts(user: AdminUser) {
    const filters = {
      status: 'active' as const,
      organizationId: user.role !== 'super_admin' ? user.organizationId : undefined
    };
    return this.alertManager.getAlerts(filters, 5);
  }

  private async getProviderMetrics(providerName: string) {
    try {
      // Get provider-specific metrics from Prometheus registry
      const metricsString = await this.metricsService.getMetrics();
      
      // Parse provider-specific metrics
      const totalTransactions = this.parseProviderMetricValue(metricsString, 'payment_transactions_total', providerName) || 0;
      const errorCount = this.parseProviderMetricValue(metricsString, 'payment_errors_total', providerName) || 0;
      const successfulTransactions = totalTransactions - errorCount;
      
      return {
        errorRate: totalTransactions > 0 ? (errorCount / totalTransactions) * 100 : 0,
        totalTransactions,
        successfulTransactions,
        failedTransactions: errorCount,
        lastTransaction: null, // This would come from a database query in real implementation
        averageResponseTime: this.parseProviderMetricValue(metricsString, 'payment_duration_seconds', providerName) || 0,
        successRate: totalTransactions > 0 ? (successfulTransactions / totalTransactions) * 100 : 0
      };
    } catch (error) {
      this.logger.warn('Failed to get provider metrics', {
        providerName,
        error: error instanceof Error ? error.message : error
      });
      
      return {
        errorRate: 0,
        totalTransactions: 0,
        successfulTransactions: 0,
        failedTransactions: 0,
        lastTransaction: null,
        averageResponseTime: 0,
        successRate: 0
      };
    }
  }

  private parseProviderMetricValue(metricsString: string, metricName: string, providerName: string): number {
    try {
      const regex = new RegExp(`${metricName}\\{[^}]*provider="${providerName}"[^}]*\\}\\s+(\\d+(?:\\.\\d+)?)`);
      const match = metricsString.match(regex);
      return match ? parseFloat(match[1]) : 0;
    } catch {
      return 0;
    }
  }
}