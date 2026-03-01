/**
 * Verificador Automático de Saúde do Sistema
 * Executa verificações periódicas e gera alertas
 */

import { createClient } from '@/lib/supabase/server';
import AlertService from './alert-service';
import ObservabilityService from './observability-service';

export interface HealthCheck {
  id: string;
  name: string;
  description: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  lastCheck: Date;
  duration: number;
  message?: string;
  metadata?: Record<string, any>;
}

export interface HealthCheckConfig {
  enabled: boolean;
  interval: number; // in seconds
  timeout: number; // in seconds
  retries: number;
}

export class AutomatedHealthChecker {
  private alertService: AlertService;
  private observabilityService: ObservabilityService;
  private checks: Map<string, HealthCheck> = new Map();
  private config: HealthCheckConfig;

  constructor(config?: Partial<HealthCheckConfig>) {
    this.alertService = new AlertService();
    this.observabilityService = new ObservabilityService();
    this.config = {
      enabled: true,
      interval: 300, // 5 minutes
      timeout: 30, // 30 seconds
      retries: 3,
      ...config
    };
  }

  async runAllChecks(): Promise<HealthCheck[]> {
    if (!this.config.enabled) {
      return Array.from(this.checks.values());
    }

    const checkPromises = [
      this.checkDatabase(),
      this.checkSupabaseConnection(),
      this.checkApiEndpoints(),
      this.checkSystemResources(),
      this.checkCronJobs()
    ];

    const results = await Promise.allSettled(checkPromises);
    
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.observabilityService.log('error', `Health check failed: ${result.reason}`);
      }
    });

    return Array.from(this.checks.values());
  }

  async checkDatabase(): Promise<HealthCheck> {
    const checkId = 'database';
    const startTime = Date.now();
    
    try {
      const supabase = await createClient();
      
      // Simple query to test connection
      const { data, error } = await supabase
        .from('organizations')
        .select('count')
        .limit(1);

      const duration = Date.now() - startTime;

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      const check: HealthCheck = {
        id: checkId,
        name: 'Database Connection',
        description: 'Verifica conectividade com o banco de dados',
        status: duration > 5000 ? 'warning' : 'healthy',
        lastCheck: new Date(),
        duration,
        message: duration > 5000 ? 'Slow database response' : 'Database responding normally',
        metadata: { query_time: duration, records_found: data?.length || 0 }
      };

      this.checks.set(checkId, check);
      this.observabilityService.recordMetric('health_check_duration', duration, { check: checkId });
      
      return check;

    } catch (error) {
      const duration = Date.now() - startTime;
      const check: HealthCheck = {
        id: checkId,
        name: 'Database Connection',
        description: 'Verifica conectividade com o banco de dados',
        status: 'critical',
        lastCheck: new Date(),
        duration,
        message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      };

      this.checks.set(checkId, check);
      this.alertService.createAlert({
        type: 'error',
        title: 'Database Connection Failed',
        message: check.message || 'Database health check failed'
      });

      return check;
    }
  }

  async checkSupabaseConnection(): Promise<HealthCheck> {
    const checkId = 'supabase';
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
        method: 'HEAD',
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
        }
      });

      const duration = Date.now() - startTime;

      const check: HealthCheck = {
        id: checkId,
        name: 'Supabase API',
        description: 'Verifica conectividade com a API do Supabase',
        status: response.ok ? 'healthy' : 'critical',
        lastCheck: new Date(),
        duration,
        message: response.ok ? 'Supabase API responding' : `API returned ${response.status}`,
        metadata: { status_code: response.status, response_time: duration }
      };

      this.checks.set(checkId, check);
      return check;

    } catch (error) {
      const duration = Date.now() - startTime;
      const check: HealthCheck = {
        id: checkId,
        name: 'Supabase API',
        description: 'Verifica conectividade com a API do Supabase',
        status: 'critical',
        lastCheck: new Date(),
        duration,
        message: `Supabase connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      };

      this.checks.set(checkId, check);
      return check;
    }
  }

  async checkApiEndpoints(): Promise<HealthCheck> {
    const checkId = 'api_endpoints';
    const startTime = Date.now();
    
    try {
      // Test critical API endpoints
      const endpoints = [
        '/api/health',
        '/api/organizations',
        '/api/admin/users/simple'
      ];

      const results = await Promise.allSettled(
        endpoints.map(async (endpoint) => {
          const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${endpoint}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
          return { endpoint, status: response.status, ok: response.ok };
        })
      );

      const duration = Date.now() - startTime;
      const failedEndpoints = results
        .filter(result => result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.ok))
        .length;

      const check: HealthCheck = {
        id: checkId,
        name: 'API Endpoints',
        description: 'Verifica disponibilidade dos endpoints críticos',
        status: failedEndpoints === 0 ? 'healthy' : failedEndpoints < endpoints.length ? 'warning' : 'critical',
        lastCheck: new Date(),
        duration,
        message: `${endpoints.length - failedEndpoints}/${endpoints.length} endpoints healthy`,
        metadata: { 
          total_endpoints: endpoints.length, 
          failed_endpoints: failedEndpoints,
          results: results.map(r => r.status === 'fulfilled' ? r.value : { error: 'rejected' })
        }
      };

      this.checks.set(checkId, check);
      return check;

    } catch (error) {
      const duration = Date.now() - startTime;
      const check: HealthCheck = {
        id: checkId,
        name: 'API Endpoints',
        description: 'Verifica disponibilidade dos endpoints críticos',
        status: 'critical',
        lastCheck: new Date(),
        duration,
        message: `API health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      };

      this.checks.set(checkId, check);
      return check;
    }
  }

  async checkSystemResources(): Promise<HealthCheck> {
    const checkId = 'system_resources';
    const startTime = Date.now();
    
    try {
      // Basic memory usage check (simplified for browser environment)
      const memoryInfo = (performance as any).memory;
      const duration = Date.now() - startTime;

      let status: HealthCheck['status'] = 'healthy';
      let message = 'System resources normal';

      if (memoryInfo) {
        const usedMemoryMB = memoryInfo.usedJSHeapSize / 1024 / 1024;
        const totalMemoryMB = memoryInfo.totalJSHeapSize / 1024 / 1024;
        const memoryUsagePercent = (usedMemoryMB / totalMemoryMB) * 100;

        if (memoryUsagePercent > 90) {
          status = 'critical';
          message = `High memory usage: ${memoryUsagePercent.toFixed(1)}%`;
        } else if (memoryUsagePercent > 75) {
          status = 'warning';
          message = `Elevated memory usage: ${memoryUsagePercent.toFixed(1)}%`;
        }
      }

      const check: HealthCheck = {
        id: checkId,
        name: 'System Resources',
        description: 'Verifica uso de recursos do sistema',
        status,
        lastCheck: new Date(),
        duration,
        message,
        metadata: memoryInfo ? {
          used_memory_mb: Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024),
          total_memory_mb: Math.round(memoryInfo.totalJSHeapSize / 1024 / 1024),
          memory_limit_mb: Math.round(memoryInfo.jsHeapSizeLimit / 1024 / 1024)
        } : { note: 'Memory info not available' }
      };

      this.checks.set(checkId, check);
      return check;

    } catch (error) {
      const duration = Date.now() - startTime;
      const check: HealthCheck = {
        id: checkId,
        name: 'System Resources',
        description: 'Verifica uso de recursos do sistema',
        status: 'unknown',
        lastCheck: new Date(),
        duration,
        message: `Resource check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      };

      this.checks.set(checkId, check);
      return check;
    }
  }

  async checkCronJobs(): Promise<HealthCheck> {
    const checkId = 'cron_jobs';
    const startTime = Date.now();
    
    try {
      // Sem integração de scheduler: sinaliza indisponibilidade da checagem
      const duration = Date.now() - startTime;

      const check: HealthCheck = {
        id: checkId,
        name: 'Cron Jobs',
        description: 'Verifica status dos jobs agendados',
        status: 'unknown',
        lastCheck: new Date(),
        duration,
        message: 'Cron jobs check unavailable: scheduler integration not configured',
        metadata: { 
          note: 'No scheduler integration configured',
          last_billing_run: null,
          last_cleanup_run: null
        }
      };

      this.checks.set(checkId, check);
      return check;

    } catch (error) {
      const duration = Date.now() - startTime;
      const check: HealthCheck = {
        id: checkId,
        name: 'Cron Jobs',
        description: 'Verifica status dos jobs agendados',
        status: 'warning',
        lastCheck: new Date(),
        duration,
        message: `Cron job check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      };

      this.checks.set(checkId, check);
      return check;
    }
  }

  getHealthSummary(): {
    overall: 'healthy' | 'warning' | 'critical';
    checks: HealthCheck[];
    summary: {
      total: number;
      healthy: number;
      warning: number;
      critical: number;
      unknown: number;
    };
  } {
    const checks = Array.from(this.checks.values());
    
    const summary = {
      total: checks.length,
      healthy: checks.filter(c => c.status === 'healthy').length,
      warning: checks.filter(c => c.status === 'warning').length,
      critical: checks.filter(c => c.status === 'critical').length,
      unknown: checks.filter(c => c.status === 'unknown').length
    };

    let overall: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (summary.critical > 0) {
      overall = 'critical';
    } else if (summary.warning > 0) {
      overall = 'warning';
    }

    return { overall, checks, summary };
  }

  getCheck(checkId: string): HealthCheck | undefined {
    return this.checks.get(checkId);
  }

  getAllChecks(): HealthCheck[] {
    return Array.from(this.checks.values());
  }
}

export default AutomatedHealthChecker;
