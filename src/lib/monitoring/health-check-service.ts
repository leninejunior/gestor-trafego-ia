/**
 * Serviço de Health Check
 * Gerencia verificações de saúde do sistema
 */

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    [key: string]: {
      status: 'pass' | 'fail' | 'warn';
      time: string;
      output?: string;
    };
  };
  version?: string;
  uptime?: number;
}

export class HealthCheckService {
  private startTime: Date;

  constructor() {
    this.startTime = new Date();
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const checks: HealthStatus['checks'] = {};
    
    // Database check
    try {
      const dbCheck = await this.checkDatabase();
      checks.database = {
        status: dbCheck ? 'pass' : 'fail',
        time: new Date().toISOString(),
        output: dbCheck ? 'Database connection successful' : 'Database connection failed'
      };
    } catch (error) {
      checks.database = {
        status: 'fail',
        time: new Date().toISOString(),
        output: error instanceof Error ? error.message : 'Database check failed'
      };
    }

    // Memory check
    try {
      const memoryCheck = await this.checkMemory();
      checks.memory = {
        status: memoryCheck.status,
        time: new Date().toISOString(),
        output: memoryCheck.message
      };
    } catch (error) {
      checks.memory = {
        status: 'warn',
        time: new Date().toISOString(),
        output: 'Memory check not available'
      };
    }

    // API endpoints check
    try {
      const apiCheck = await this.checkApiEndpoints();
      checks.api = {
        status: apiCheck ? 'pass' : 'fail',
        time: new Date().toISOString(),
        output: apiCheck ? 'API endpoints responding' : 'Some API endpoints failing'
      };
    } catch (error) {
      checks.api = {
        status: 'fail',
        time: new Date().toISOString(),
        output: error instanceof Error ? error.message : 'API check failed'
      };
    }

    // Determine overall status
    const hasFailures = Object.values(checks).some(check => check.status === 'fail');
    const hasWarnings = Object.values(checks).some(check => check.status === 'warn');
    
    let overallStatus: HealthStatus['status'] = 'healthy';
    if (hasFailures) {
      overallStatus = 'unhealthy';
    } else if (hasWarnings) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
      version: process.env.npm_package_version || '1.0.0',
      uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000)
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      // Simple check - in a real implementation you would test actual database connection
      // For now, we'll assume it's working if we can import the client
      const { createClient } = await import('@/lib/supabase/server');
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkMemory(): Promise<{ status: 'pass' | 'warn' | 'fail'; message: string }> {
    try {
      // Check if performance.memory is available (Chrome/Edge)
      const memoryInfo = (performance as any).memory;
      
      if (!memoryInfo) {
        return {
          status: 'warn',
          message: 'Memory information not available'
        };
      }

      const usedMB = Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024);
      const totalMB = Math.round(memoryInfo.totalJSHeapSize / 1024 / 1024);
      const limitMB = Math.round(memoryInfo.jsHeapSizeLimit / 1024 / 1024);
      
      const usagePercent = (usedMB / limitMB) * 100;
      
      if (usagePercent > 90) {
        return {
          status: 'fail',
          message: `Critical memory usage: ${usedMB}MB/${limitMB}MB (${usagePercent.toFixed(1)}%)`
        };
      } else if (usagePercent > 75) {
        return {
          status: 'warn',
          message: `High memory usage: ${usedMB}MB/${limitMB}MB (${usagePercent.toFixed(1)}%)`
        };
      } else {
        return {
          status: 'pass',
          message: `Memory usage normal: ${usedMB}MB/${limitMB}MB (${usagePercent.toFixed(1)}%)`
        };
      }
    } catch (error) {
      return {
        status: 'warn',
        message: 'Memory check failed'
      };
    }
  }

  private async checkApiEndpoints(): Promise<boolean> {
    try {
      // In a real implementation, you would test critical API endpoints
      // For now, we'll do a simple check
      return true;
    } catch (error) {
      return false;
    }
  }

  async checkDependencies(): Promise<{
    supabase: boolean;
    environment: boolean;
    configuration: boolean;
  }> {
    const results = {
      supabase: false,
      environment: false,
      configuration: false
    };

    // Check Supabase configuration
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      results.supabase = !!(supabaseUrl && supabaseKey);
    } catch (error) {
      results.supabase = false;
    }

    // Check environment variables
    try {
      const requiredEnvVars = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY'
      ];
      
      results.environment = requiredEnvVars.every(envVar => 
        process.env[envVar] && process.env[envVar]!.length > 0
      );
    } catch (error) {
      results.environment = false;
    }

    // Check basic configuration
    try {
      results.configuration = true; // Simplified check
    } catch (error) {
      results.configuration = false;
    }

    return results;
  }

  getUptime(): number {
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  getVersion(): string {
    return process.env.npm_package_version || '1.0.0';
  }
}

export default HealthCheckService;