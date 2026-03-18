/**
 * Google Ads Health Check Endpoint
 * 
 * Validates:
 * - Database connectivity
 * - Encryption keys existence
 * - Token validity
 * - Active connections status
 * - API quota status
 * 
 * Requirements: 2.1, 4.1, 9.1-9.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getGoogleTokenManager } from '@/lib/google/token-manager';
import { getGoogleAdsCryptoService } from '@/lib/google/crypto-service';

// ============================================================================
// Types
// ============================================================================

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: CheckResult;
    encryptionKeys: CheckResult;
    activeConnections: CheckResult;
    tokenValidation: CheckResult;
    apiQuota: CheckResult;
  };
  summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
  };
  recommendations?: string[];
}

interface CheckResult {
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: Record<string, unknown>;
  error?: string;
}

// ============================================================================
// Health Check Functions
// ============================================================================

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<CheckResult> {
  try {
    const supabase = createServiceClient();
    
    // Simple query to test connection
    const { data, error } = await supabase
      .from('google_ads_connections')
      .select('id')
      .limit(1);

    if (error) {
      return {
        status: 'fail',
        message: 'Database connection failed',
        error: error.message,
        details: {
          errorCode: error.code,
          errorHint: error.hint,
        },
      };
    }

    return {
      status: 'pass',
      message: 'Database connection successful',
      details: {
        queryExecuted: true,
        responseReceived: true,
      },
    };
  } catch (error) {
    return {
      status: 'fail',
      message: 'Database check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check encryption keys configuration
 */
async function checkEncryptionKeys(): Promise<CheckResult> {
  try {
    const supabase = createServiceClient();
    
    // Check if encryption keys table exists and has active keys
    const { data, error } = await supabase
      .from('google_ads_encryption_keys')
      .select('id, algorithm, version, is_active, created_at, expires_at')
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1);

    if (error) {
      return {
        status: 'fail',
        message: 'Failed to query encryption keys',
        error: error.message,
        details: {
          errorCode: error.code,
          tableName: 'google_ads_encryption_keys',
        },
      };
    }

    if (!data || data.length === 0) {
      return {
        status: 'fail',
        message: 'No active encryption keys found',
        details: {
          recommendation: 'Run encryption key initialization script',
        },
      };
    }

    const activeKey = data[0];
    const now = new Date();
    const expiresAt = new Date(activeKey.expires_at);
    const daysUntilExpiry = Math.floor(
      (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Warning if key expires in less than 7 days
    if (daysUntilExpiry < 7 && daysUntilExpiry > 0) {
      return {
        status: 'warning',
        message: 'Active encryption key expires soon',
        details: {
          keyVersion: activeKey.version,
          algorithm: activeKey.algorithm,
          expiresAt: activeKey.expires_at,
          daysUntilExpiry,
          recommendation: 'Consider rotating encryption keys',
        },
      };
    }

    // Fail if key is already expired
    if (daysUntilExpiry <= 0) {
      return {
        status: 'fail',
        message: 'Active encryption key has expired',
        details: {
          keyVersion: activeKey.version,
          expiresAt: activeKey.expires_at,
          daysExpired: Math.abs(daysUntilExpiry),
          recommendation: 'Rotate encryption keys immediately',
        },
      };
    }

    return {
      status: 'pass',
      message: 'Encryption keys properly configured',
      details: {
        keyVersion: activeKey.version,
        algorithm: activeKey.algorithm,
        expiresAt: activeKey.expires_at,
        daysUntilExpiry,
      },
    };
  } catch (error) {
    return {
      status: 'fail',
      message: 'Encryption keys check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check active connections
 */
async function checkActiveConnections(): Promise<CheckResult> {
  try {
    const supabase = createServiceClient();
    
    // Get all active connections
    const { data: activeConnections, error: activeError } = await supabase
      .from('google_ads_connections')
      .select('id, client_id, customer_id, status, token_expires_at, created_at')
      .eq('status', 'active');

    if (activeError) {
      return {
        status: 'fail',
        message: 'Failed to query active connections',
        error: activeError.message,
      };
    }

    // Get expired connections
    const { data: expiredConnections, error: expiredError } = await supabase
      .from('google_ads_connections')
      .select('id, status')
      .eq('status', 'expired');

    if (expiredError) {
      return {
        status: 'warning',
        message: 'Could not query expired connections',
        error: expiredError.message,
      };
    }

    const activeCount = activeConnections?.length || 0;
    const expiredCount = expiredConnections?.length || 0;

    if (activeCount === 0) {
      return {
        status: 'warning',
        message: 'No active Google Ads connections found',
        details: {
          activeConnections: 0,
          expiredConnections: expiredCount,
          recommendation: 'Users need to connect their Google Ads accounts',
        },
      };
    }

    // Check for connections with tokens expiring soon
    const now = new Date();
    const expiringSoon = activeConnections?.filter(conn => {
      const expiresAt = new Date(conn.token_expires_at);
      const minutesUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60);
      return minutesUntilExpiry < 10 && minutesUntilExpiry > 0;
    }) || [];

    if (expiringSoon.length > 0) {
      return {
        status: 'warning',
        message: 'Some connections have tokens expiring soon',
        details: {
          activeConnections: activeCount,
          expiredConnections: expiredCount,
          expiringSoon: expiringSoon.length,
          expiringSoonIds: expiringSoon.map(c => c.id),
          recommendation: 'Token refresh will be triggered automatically',
        },
      };
    }

    return {
      status: 'pass',
      message: 'Active connections healthy',
      details: {
        activeConnections: activeCount,
        expiredConnections: expiredCount,
        oldestConnection: activeConnections?.[0]?.created_at,
      },
    };
  } catch (error) {
    return {
      status: 'fail',
      message: 'Active connections check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check token validation functionality
 */
async function checkTokenValidation(): Promise<CheckResult> {
  try {
    const tokenManager = getGoogleTokenManager();
    const cryptoService = getGoogleAdsCryptoService();
    
    // Test encryption/decryption
    const encryptionTest = await cryptoService.testEncryption();
    
    if (!encryptionTest.success) {
      return {
        status: 'fail',
        message: 'Token encryption/decryption test failed',
        error: encryptionTest.error,
        details: {
          recommendation: 'Check encryption keys configuration',
        },
      };
    }

    // Check for connections needing refresh
    const connectionsNeedingRefresh = await tokenManager.getConnectionsNeedingRefresh();
    
    if (connectionsNeedingRefresh.length > 0) {
      return {
        status: 'warning',
        message: 'Some connections need token refresh',
        details: {
          connectionsNeedingRefresh: connectionsNeedingRefresh.length,
          connectionIds: connectionsNeedingRefresh,
          recommendation: 'Token refresh will be triggered on next API call',
        },
      };
    }

    return {
      status: 'pass',
      message: 'Token validation system operational',
      details: {
        encryptionTest: 'passed',
        connectionsNeedingRefresh: 0,
      },
    };
  } catch (error) {
    return {
      status: 'fail',
      message: 'Token validation check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check Google Ads API quota status
 * 
 * Note: Google Ads API doesn't provide a direct quota check endpoint.
 * Instead, we make a lightweight API call and check for quota-related errors.
 * 
 * Requirements: 4.1
 */
async function checkApiQuota(): Promise<CheckResult> {
  try {
    const supabase = createServiceClient();
    
    // Get one active connection to test API quota
    const { data: connections, error: connError } = await supabase
      .from('google_ads_connections')
      .select('id, customer_id, refresh_token, status')
      .eq('status', 'active')
      .limit(1);

    if (connError) {
      return {
        status: 'fail',
        message: 'Failed to query connections for quota check',
        error: connError.message,
      };
    }

    if (!connections || connections.length === 0) {
      return {
        status: 'warning',
        message: 'No active connections to check API quota',
        details: {
          recommendation: 'Connect a Google Ads account to enable quota monitoring',
        },
      };
    }

    const connection = connections[0];
    
    // Import GoogleAdsClient dynamically to avoid circular dependencies
    const { getGoogleAdsClient } = await import('@/lib/google/client');
    
    // Create client with minimal config
    const client = getGoogleAdsClient({
      accessToken: '', // Will be refreshed automatically
      refreshToken: connection.refresh_token,
      developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
      customerId: connection.customer_id,
      connectionId: connection.id,
    });

    // Make a lightweight API call to check quota
    // Using a simple customer query which counts against quota but is minimal
    const startTime = Date.now();
    
    try {
      await client.getAccountInfo(connection.customer_id);
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'pass',
        message: 'API quota available and responsive',
        details: {
          responseTime: `${responseTime}ms`,
          testedCustomerId: connection.customer_id,
          recommendation: 'Monitor API usage in Google Ads API Center',
        },
      };
    } catch (apiError: any) {
      // Check if error is quota-related
      const errorMessage = apiError?.message || String(apiError);
      const isQuotaError = 
        errorMessage.includes('RESOURCE_EXHAUSTED') ||
        errorMessage.includes('quota') ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('429');

      if (isQuotaError) {
        return {
          status: 'fail',
          message: 'API quota exceeded or rate limited',
          error: errorMessage,
          details: {
            errorType: 'QUOTA_EXCEEDED',
            recommendation: 'Wait for quota reset or request quota increase in Google Ads API Center',
            apiCenterUrl: 'https://ads.google.com/aw/apicenter',
          },
        };
      }

      // Check if error is authentication-related
      const isAuthError = 
        errorMessage.includes('UNAUTHENTICATED') ||
        errorMessage.includes('401') ||
        errorMessage.includes('invalid_grant') ||
        errorMessage.includes('authentication');

      if (isAuthError) {
        return {
          status: 'warning',
          message: 'API authentication issue detected',
          error: errorMessage,
          details: {
            errorType: 'AUTHENTICATION_ERROR',
            recommendation: 'Check token validity and refresh tokens',
          },
        };
      }

      // Check if error is permission-related
      const isPermissionError = 
        errorMessage.includes('PERMISSION_DENIED') ||
        errorMessage.includes('403') ||
        errorMessage.includes('access denied');

      if (isPermissionError) {
        return {
          status: 'warning',
          message: 'API permission issue detected',
          error: errorMessage,
          details: {
            errorType: 'PERMISSION_ERROR',
            recommendation: 'Verify Developer Token approval and account access',
          },
        };
      }

      // Other API errors - still operational but with issues
      return {
        status: 'warning',
        message: 'API call failed but quota status unclear',
        error: errorMessage,
        details: {
          errorType: 'API_ERROR',
          recommendation: 'Check connection configuration and API credentials',
        },
      };
    }
  } catch (error) {
    return {
      status: 'fail',
      message: 'API quota check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      details: {
        recommendation: 'Check system configuration and network connectivity',
      },
    };
  }
}

// ============================================================================
// API Route Handler
// ============================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('[Health Check] Starting Google Ads health check:', {
      timestamp: new Date().toISOString(),
      url: request.url,
    });

    // Run all health checks in parallel
    const [database, encryptionKeys, activeConnections, tokenValidation, apiQuota] = await Promise.all([
      checkDatabase(),
      checkEncryptionKeys(),
      checkActiveConnections(),
      checkTokenValidation(),
      checkApiQuota(),
    ]);

    // Calculate summary
    const checks = { database, encryptionKeys, activeConnections, tokenValidation, apiQuota };
    const checkResults = Object.values(checks);
    const passedChecks = checkResults.filter(c => c.status === 'pass').length;
    const failedChecks = checkResults.filter(c => c.status === 'fail').length;
    const warningChecks = checkResults.filter(c => c.status === 'warning').length;

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (failedChecks > 0) {
      overallStatus = 'unhealthy';
    } else if (warningChecks > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    // Collect recommendations
    const recommendations: string[] = [];
    checkResults.forEach(check => {
      if (check.details?.recommendation) {
        recommendations.push(check.details.recommendation as string);
      }
    });

    const duration = Date.now() - startTime;

    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
      summary: {
        totalChecks: checkResults.length,
        passedChecks,
        failedChecks: failedChecks + warningChecks,
      },
      ...(recommendations.length > 0 && { recommendations }),
    };

    console.log('[Health Check] Health check completed:', {
      status: overallStatus,
      duration: `${duration}ms`,
      passedChecks,
      failedChecks,
      warningChecks,
    });

    // Return appropriate HTTP status code
    const httpStatus = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 207 : 503;

    return NextResponse.json(result, { status: httpStatus });
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('[Health Check] Health check failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`,
    });

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Health check failed',
        duration: `${duration}ms`,
      },
      { status: 500 }
    );
  }
}
