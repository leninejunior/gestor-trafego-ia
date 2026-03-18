/**
 * Google Ads Sync Status API Route
 * 
 * Gets current synchronization status for Google Ads connections
 * Includes connection diagnostics for OAuth scopes, permissions, and token validity
 * Requirements: 3.1, 3.5, 4.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGoogleTokenManager } from '@/lib/google/token-manager';
import { getGoogleAdsClient } from '@/lib/google/client';
import {
  countGoogleCampaignsByConnectionId,
  getActiveSyncByConnectionId,
  getGoogleConnectionById,
  getClientOrganizationId,
  getLatestSyncLogByConnectionId,
  hasOrgMembershipAccess,
  isUserSuperAdmin,
  listGoogleConnectionsByClient,
  updateGoogleSyncLogStatus,
} from '@/lib/postgres/google-sync-repository';
import { z } from 'zod';

// ============================================================================
// Request Validation Schema
// ============================================================================

const StatusQuerySchema = z.object({
  clientId: z.string().uuid('Client ID deve ser um UUID válido'),
  connectionId: z.string().uuid('Connection ID deve ser um UUID válido').optional(),
  includeDiagnostics: z.string().optional().transform(val => val === 'true'),
});

// ============================================================================
// Connection Diagnostics Types
// ============================================================================

interface DiagnosticResult {
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: Record<string, unknown>;
  error?: string;
}

interface ConnectionDiagnostics {
  connectionId: string;
  customerId: string;
  checks: {
    oauthScopes: DiagnosticResult;
    customerIdAccess: DiagnosticResult;
    apiPermissions: DiagnosticResult;
    refreshToken: DiagnosticResult;
  };
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
}

// ============================================================================
// Diagnostic Functions
// ============================================================================

/**
 * Verify OAuth scopes granted to the connection
 * Checks if the required Google Ads API scope is present
 */
async function verifyOAuthScopes(connectionId: string): Promise<DiagnosticResult> {
  try {
    console.log('[Diagnostics] Verifying OAuth scopes:', { connectionId });

    const tokenManager = getGoogleTokenManager();
    
    // Get connection details
    const connection = await getGoogleConnectionById(connectionId);
    if (!connection) {
      return {
        status: 'fail',
        message: 'Failed to retrieve connection details',
        error: 'Connection not found',
      };
    }
    
    // Get valid access token (will refresh if needed)
    let accessToken: string;
    try {
      accessToken = await tokenManager.ensureValidToken(connectionId);
    } catch (tokenError) {
      return {
        status: 'fail',
        message: 'Failed to obtain valid access token',
        error: tokenError instanceof Error ? tokenError.message : 'Token refresh failed',
        details: {
          recommendation: 'User may need to reconnect their Google Ads account',
        },
      };
    }
    
    // Verify token info from Google OAuth API
    try {
      const tokenInfoResponse = await fetch(
        `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`
      );
      
      if (!tokenInfoResponse.ok) {
        return {
          status: 'fail',
          message: 'Failed to verify token with Google OAuth API',
          error: `HTTP ${tokenInfoResponse.status}: ${tokenInfoResponse.statusText}`,
          details: {
            recommendation: 'Token may be invalid or revoked',
          },
        };
      }
      
      const tokenInfo = await tokenInfoResponse.json();
      
      console.log('[Diagnostics] Token info received:', {
        connectionId,
        hasScope: !!tokenInfo.scope,
        scopes: tokenInfo.scope,
        expiresIn: tokenInfo.expires_in,
        audience: tokenInfo.audience,
      });
      
      // Check if required Google Ads scope is present
      const requiredScope = 'https://www.googleapis.com/auth/adwords';
      const grantedScopes = tokenInfo.scope ? tokenInfo.scope.split(' ') : [];
      const hasRequiredScope = grantedScopes.includes(requiredScope);
      
      if (!hasRequiredScope) {
        return {
          status: 'fail',
          message: 'Required Google Ads API scope not granted',
          details: {
            requiredScope,
            grantedScopes,
            recommendation: 'User needs to reconnect and grant Google Ads API permissions',
          },
        };
      }
      
      // Check token expiration
      const expiresIn = parseInt(tokenInfo.expires_in || '0');
      const expiresInMinutes = Math.floor(expiresIn / 60);
      
      if (expiresIn < 300) { // Less than 5 minutes
        return {
          status: 'warning',
          message: 'Access token expires soon',
          details: {
            requiredScope,
            grantedScopes,
            expiresInSeconds: expiresIn,
            expiresInMinutes,
            recommendation: 'Token will be refreshed automatically on next API call',
          },
        };
      }
      
      return {
        status: 'pass',
        message: 'OAuth scopes verified successfully',
        details: {
          requiredScope,
          grantedScopes,
          expiresInMinutes,
          audience: tokenInfo.audience,
        },
      };
    } catch (verifyError) {
      return {
        status: 'fail',
        message: 'Failed to verify OAuth scopes',
        error: verifyError instanceof Error ? verifyError.message : 'Unknown error',
        details: {
          recommendation: 'Check network connectivity and Google OAuth API availability',
        },
      };
    }
  } catch (error) {
    console.error('[Diagnostics] OAuth scope verification error:', error);
    return {
      status: 'fail',
      message: 'OAuth scope verification failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check customer ID access
 * Verifies that the connection can access the specified customer account
 */
async function checkCustomerIdAccess(connectionId: string): Promise<DiagnosticResult> {
  try {
    console.log('[Diagnostics] Checking customer ID access:', { connectionId });

    // Get connection details
    const connection = await getGoogleConnectionById(connectionId);
    if (!connection) {
      return {
        status: 'fail',
        message: 'Failed to retrieve connection details',
        error: 'Connection not found',
      };
    }
    
    // Create Google Ads client
    const client = getGoogleAdsClient({
      accessToken: '', // Will be refreshed automatically
      refreshToken: connection.refresh_token,
      developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
      customerId: connection.customer_id,
      connectionId: connection.id,
    });
    
    // Try to get account info
    try {
      const accountInfo = await client.getAccountInfo(connection.customer_id);
      
      console.log('[Diagnostics] Customer ID access verified:', {
        connectionId,
        customerId: accountInfo.customerId,
        accountName: accountInfo.descriptiveName,
        canManageClients: accountInfo.canManageClients,
      });
      
      return {
        status: 'pass',
        message: 'Customer ID access verified',
        details: {
          customerId: accountInfo.customerId,
          accountName: accountInfo.descriptiveName,
          currencyCode: accountInfo.currencyCode,
          timeZone: accountInfo.timeZone,
          canManageClients: accountInfo.canManageClients,
        },
      };
    } catch (apiError: any) {
      const errorMessage = apiError?.message || String(apiError);
      
      // Check for specific error types
      if (errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('403')) {
        return {
          status: 'fail',
          message: 'Permission denied to access customer account',
          error: errorMessage,
          details: {
            customerId: connection.customer_id,
            recommendation: 'Verify that the user has access to this Google Ads account',
          },
        };
      }
      
      if (errorMessage.includes('UNAUTHENTICATED') || errorMessage.includes('401')) {
        return {
          status: 'fail',
          message: 'Authentication failed',
          error: errorMessage,
          details: {
            customerId: connection.customer_id,
            recommendation: 'User needs to reconnect their Google Ads account',
          },
        };
      }
      
      if (errorMessage.includes('INVALID_CUSTOMER_ID') || errorMessage.includes('customer')) {
        return {
          status: 'fail',
          message: 'Invalid customer ID',
          error: errorMessage,
          details: {
            customerId: connection.customer_id,
            recommendation: 'Verify the customer ID format (should be 10 digits)',
          },
        };
      }
      
      return {
        status: 'fail',
        message: 'Failed to access customer account',
        error: errorMessage,
        details: {
          customerId: connection.customer_id,
        },
      };
    }
  } catch (error) {
    console.error('[Diagnostics] Customer ID access check error:', error);
    return {
      status: 'fail',
      message: 'Customer ID access check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test API permissions
 * Makes a lightweight API call to verify permissions
 */
async function testApiPermissions(connectionId: string): Promise<DiagnosticResult> {
  try {
    console.log('[Diagnostics] Testing API permissions:', { connectionId });

    // Get connection details
    const connection = await getGoogleConnectionById(connectionId);
    if (!connection) {
      return {
        status: 'fail',
        message: 'Failed to retrieve connection details',
        error: 'Connection not found',
      };
    }
    
    // Create Google Ads client
    const client = getGoogleAdsClient({
      accessToken: '', // Will be refreshed automatically
      refreshToken: connection.refresh_token,
      developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
      customerId: connection.customer_id,
      connectionId: connection.id,
    });
    
    // Try to list accessible customers (lightweight API call)
    try {
      const startTime = Date.now();
      const customers = await client.listAccessibleCustomers();
      const responseTime = Date.now() - startTime;
      
      console.log('[Diagnostics] API permissions verified:', {
        connectionId,
        accessibleCustomersCount: customers.length,
        responseTime: `${responseTime}ms`,
      });
      
      // Check if the connection's customer ID is in the accessible list
      const hasAccessToCustomer = customers.some(
        c => c.customerId === connection.customer_id
      );
      
      if (!hasAccessToCustomer) {
        return {
          status: 'warning',
          message: 'Customer ID not in accessible customers list',
          details: {
            customerId: connection.customer_id,
            accessibleCustomersCount: customers.length,
            recommendation: 'User may have lost access to this account',
          },
        };
      }
      
      return {
        status: 'pass',
        message: 'API permissions verified',
        details: {
          accessibleCustomersCount: customers.length,
          responseTime: `${responseTime}ms`,
          hasAccessToCustomer: true,
        },
      };
    } catch (apiError: any) {
      const errorMessage = apiError?.message || String(apiError);
      
      // Check for developer token issues
      if (errorMessage.includes('Developer Token') || errorMessage.includes('developer-token')) {
        return {
          status: 'fail',
          message: 'Developer Token issue',
          error: errorMessage,
          details: {
            recommendation: 'Verify GOOGLE_ADS_DEVELOPER_TOKEN environment variable and approval status',
            apiCenterUrl: 'https://ads.google.com/aw/apicenter',
          },
        };
      }
      
      // Check for quota issues
      if (errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('quota')) {
        return {
          status: 'fail',
          message: 'API quota exceeded',
          error: errorMessage,
          details: {
            recommendation: 'Wait for quota reset or request increase in Google Ads API Center',
            apiCenterUrl: 'https://ads.google.com/aw/apicenter',
          },
        };
      }
      
      return {
        status: 'fail',
        message: 'API permissions test failed',
        error: errorMessage,
      };
    }
  } catch (error) {
    console.error('[Diagnostics] API permissions test error:', error);
    return {
      status: 'fail',
      message: 'API permissions test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Validate refresh token
 * Checks if the refresh token is valid and can be used to obtain new access tokens
 */
async function validateRefreshToken(connectionId: string): Promise<DiagnosticResult> {
  try {
    console.log('[Diagnostics] Validating refresh token:', { connectionId });
    
    const tokenManager = getGoogleTokenManager();
    
    // Try to ensure valid token (will attempt refresh if needed)
    try {
      const accessToken = await tokenManager.ensureValidToken(connectionId);
      
      console.log('[Diagnostics] Refresh token validated:', {
        connectionId,
        accessTokenLength: accessToken.length,
      });
      
      return {
        status: 'pass',
        message: 'Refresh token is valid',
        details: {
          canRefreshToken: true,
          accessTokenObtained: true,
        },
      };
    } catch (refreshError: any) {
      const errorMessage = refreshError?.message || String(refreshError);
      
      // Check for specific refresh token errors
      if (errorMessage.includes('invalid_grant')) {
        return {
          status: 'fail',
          message: 'Refresh token is invalid or revoked',
          error: errorMessage,
          details: {
            recommendation: 'User needs to reconnect their Google Ads account',
            reason: 'Token may have been revoked or expired',
          },
        };
      }
      
      if (errorMessage.includes('invalid_client')) {
        return {
          status: 'fail',
          message: 'OAuth client configuration error',
          error: errorMessage,
          details: {
            recommendation: 'Verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables',
          },
        };
      }
      
      return {
        status: 'fail',
        message: 'Failed to validate refresh token',
        error: errorMessage,
        details: {
          recommendation: 'User may need to reconnect their Google Ads account',
        },
      };
    }
  } catch (error) {
    console.error('[Diagnostics] Refresh token validation error:', error);
    return {
      status: 'fail',
      message: 'Refresh token validation failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Run all diagnostics for a connection
 */
async function runConnectionDiagnostics(connectionId: string, customerId: string): Promise<ConnectionDiagnostics> {
  console.log('[Diagnostics] Running full diagnostics:', { connectionId, customerId });
  
  const startTime = Date.now();
  
  // Run all checks in parallel
  const [oauthScopes, customerIdAccess, apiPermissions, refreshToken] = await Promise.all([
    verifyOAuthScopes(connectionId),
    checkCustomerIdAccess(connectionId),
    testApiPermissions(connectionId),
    validateRefreshToken(connectionId),
  ]);
  
  const duration = Date.now() - startTime;
  
  // Determine overall status
  const checks = { oauthScopes, customerIdAccess, apiPermissions, refreshToken };
  const checkResults = Object.values(checks);
  const hasFailures = checkResults.some(c => c.status === 'fail');
  const hasWarnings = checkResults.some(c => c.status === 'warning');
  
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  if (hasFailures) {
    overallStatus = 'unhealthy';
  } else if (hasWarnings) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'healthy';
  }
  
  console.log('[Diagnostics] Diagnostics completed:', {
    connectionId,
    overallStatus,
    duration: `${duration}ms`,
    passedChecks: checkResults.filter(c => c.status === 'pass').length,
    failedChecks: checkResults.filter(c => c.status === 'fail').length,
    warningChecks: checkResults.filter(c => c.status === 'warning').length,
  });
  
  return {
    connectionId,
    customerId,
    checks,
    overallStatus,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// GET /api/google/sync/status
// ============================================================================

export async function GET(request: NextRequest) {
  console.log('='.repeat(80));
  console.log('[Google Sync Status] 🔍 VERIFICANDO STATUS DE SINCRONIZAÇÃO');
  console.log('[Google Sync Status] Timestamp:', new Date().toISOString());
  
  try {
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    console.log('[Google Sync Status] 📋 PARÂMETROS RECEBIDOS:', queryParams);
    
    // Validate query parameters
    const { clientId, connectionId, includeDiagnostics } = StatusQuerySchema.parse(queryParams);
    console.log('[Google Sync Status] ✅ PARÂMETROS VALIDADOS:', { clientId, connectionId, includeDiagnostics });

    // Get authenticated user
    console.log('[Google Sync Status] 🔐 VERIFICANDO AUTENTICAÇÃO...');
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log('[Google Sync Status] 📊 RESULTADO DA AUTENTICAÇÃO:', {
      hasUser: !!user,
      userId: user?.id,
      authError: authError?.message
    });

    if (authError || !user) {
      console.error('[Google Sync Status] ❌ USUÁRIO NÃO AUTENTICADO');
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const clientOrgId = await getClientOrganizationId(clientId);
    if (!clientOrgId) {
      return NextResponse.json(
        { error: 'Cliente não encontrado ou sem organização vinculada' },
        { status: 404 }
      );
    }

    const superAdmin = await isUserSuperAdmin(user.id);
    const hasAccess = superAdmin || await hasOrgMembershipAccess(user.id, clientOrgId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Acesso negado ao cliente especificado' },
        { status: 403 }
      );
    }

    const connections = await listGoogleConnectionsByClient(clientId, connectionId || undefined);

    console.log('[Google Sync Status] 📊 RESULTADO DA QUERY DE CONEXÕES:', {
      hasConnections: !!connections,
      connectionsCount: connections?.length || 0
    });

    if (!connections || connections.length === 0) {
      console.log('[Google Sync Status] ⚠️ NENHUMA CONEXÃO ENCONTRADA');
      return NextResponse.json({
        clientId,
        overallStatus: 'never_synced',
        overallMessage: 'Nenhuma conexão Google Ads encontrada',
        hasActiveSyncs: false,
        hasErrors: false,
        totalConnections: 0,
        connections: [],
        nextScheduledSync: null,
        lastUpdated: new Date().toISOString(),
      });
    }

    // Get sync status for each connection (simplified to avoid table errors)
    console.log('[Google Sync Status] 📊 PROCESSANDO STATUS DAS CONEXÕES...');
    const connectionStatuses = await Promise.all(
      connections.map(async (connection) => {
        console.log(`[Google Sync Status] 🔍 Processando conexão: ${connection.id}`);
        
        // Status e métricas via Postgres (dados de negócio fora do Supabase)
        let latestSync = null;
        let activeSync = null;
        let campaignCount = 0;
        let latestMetrics = null;

        try {
          latestSync = await getLatestSyncLogByConnectionId(connection.id);
        } catch (syncError) {
          console.log(`[Google Sync Status] ⚠️ Erro ao buscar latest sync:`, (syncError as Error).message);
        }

        try {
          activeSync = await getActiveSyncByConnectionId(connection.id);
        } catch (activeSyncError) {
          console.log(`[Google Sync Status] ⚠️ Erro ao buscar sync ativa:`, (activeSyncError as Error).message);
        }

        try {
          campaignCount = await countGoogleCampaignsByConnectionId(connection.id);
        } catch (campaignError) {
          console.log(`[Google Sync Status] ⚠️ Erro ao contar campanhas:`, (campaignError as Error).message);
        }

        // Determine current status
        let currentStatus: 'idle' | 'syncing' | 'error' | 'never_synced' = 'idle';
        let progress = 0;
        let statusMessage = '';

        if (activeSync) {
          currentStatus = 'syncing';
          // Calculate rough progress based on time elapsed
          const elapsed = Date.now() - new Date(activeSync.started_at).getTime();
          const estimatedDuration = 5 * 60 * 1000; // 5 minutes estimated
          progress = Math.min(Math.round((elapsed / estimatedDuration) * 100), 95);
          statusMessage = `Sincronizando ${activeSync.sync_type}...`;
        } else if (latestSync) {
          if (latestSync.status === 'failed') {
            currentStatus = 'error';
            statusMessage = latestSync.error_message || 'Erro na última sincronização';
          } else {
            currentStatus = 'idle';
            statusMessage = 'Sincronização concluída';
          }
        } else {
          currentStatus = 'never_synced';
          statusMessage = 'Nunca sincronizado';
        }

        // Calculate next scheduled sync (every 6 hours)
        let nextScheduledSync = null;
        if (connection.last_sync_at) {
          const lastSync = new Date(connection.last_sync_at);
          nextScheduledSync = new Date(lastSync.getTime() + 6 * 60 * 60 * 1000);
        }

        return {
          connectionId: connection.id,
          customerId: connection.customer_id,
          status: currentStatus,
          progress,
          statusMessage,
          lastSync: latestSync ? {
            id: latestSync.id,
            type: latestSync.sync_type,
            status: latestSync.status,
            startedAt: latestSync.started_at,
            completedAt: latestSync.completed_at,
            campaignsSynced: latestSync.campaigns_synced,
            metricsUpdated: latestSync.metrics_updated,
            errorMessage: latestSync.error_message,
            errorCode: latestSync.error_code,
          } : null,
          activeSync: activeSync ? {
            id: activeSync.id,
            type: activeSync.sync_type,
            startedAt: activeSync.started_at,
            elapsedMinutes: Math.round((Date.now() - new Date(activeSync.started_at).getTime()) / 1000 / 60),
          } : null,
          stats: {
            campaignCount,
            latestMetricsDate: latestMetrics?.date || null,
            connectionAge: Math.round((Date.now() - new Date(connection.created_at).getTime()) / 1000 / 60 / 60 / 24), // days
          },
          nextScheduledSync: nextScheduledSync?.toISOString() || null,
        };
      })
    );

    // Calculate overall status
    const hasActiveSyncs = connectionStatuses.some(s => s.status === 'syncing');
    const hasErrors = connectionStatuses.some(s => s.status === 'error');
    const neverSynced = connectionStatuses.some(s => s.status === 'never_synced');

    let overallStatus: 'idle' | 'syncing' | 'error' | 'partial_error' | 'never_synced' = 'idle';
    let overallMessage = '';

    if (hasActiveSyncs) {
      overallStatus = 'syncing';
      const syncingCount = connectionStatuses.filter(s => s.status === 'syncing').length;
      overallMessage = `${syncingCount} sincronização${syncingCount > 1 ? 'ões' : ''} em andamento`;
    } else if (hasErrors && connectionStatuses.every(s => s.status === 'error')) {
      overallStatus = 'error';
      overallMessage = 'Erro em todas as conexões';
    } else if (hasErrors) {
      overallStatus = 'partial_error';
      const errorCount = connectionStatuses.filter(s => s.status === 'error').length;
      overallMessage = `Erro em ${errorCount} de ${connectionStatuses.length} conexões`;
    } else if (neverSynced) {
      overallStatus = 'never_synced';
      overallMessage = 'Algumas conexões nunca foram sincronizadas';
    } else {
      overallStatus = 'idle';
      overallMessage = 'Todas as conexões estão atualizadas';
    }

    // Get next scheduled sync time
    const nextScheduledTimes = connectionStatuses
      .map(s => s.nextScheduledSync)
      .filter(Boolean)
      .sort();
    const nextScheduledSync = nextScheduledTimes[0] || null;

    // Run diagnostics if requested
    let diagnostics: ConnectionDiagnostics[] | undefined;
    if (includeDiagnostics) {
      console.log('[Google Sync Status] 🔍 Running connection diagnostics...');
      
      diagnostics = await Promise.all(
        connections.map(conn => 
          runConnectionDiagnostics(conn.id, conn.customer_id)
        )
      );
      
      console.log('[Google Sync Status] ✅ Diagnostics completed:', {
        totalConnections: diagnostics.length,
        healthyConnections: diagnostics.filter(d => d.overallStatus === 'healthy').length,
        degradedConnections: diagnostics.filter(d => d.overallStatus === 'degraded').length,
        unhealthyConnections: diagnostics.filter(d => d.overallStatus === 'unhealthy').length,
      });
    }

    const statusForWidget: 'idle' | 'syncing' | 'error' | 'success' =
      overallStatus === 'syncing'
        ? 'syncing'
        : overallStatus === 'error' || overallStatus === 'partial_error'
          ? 'error'
          : overallStatus === 'never_synced'
            ? 'idle'
            : 'success';

    const mostRecentSync = connectionStatuses
      .map(s => s.lastSync)
      .filter(Boolean)
      .sort((a, b) => new Date(b!.startedAt).getTime() - new Date(a!.startedAt).getTime())[0] || null;

    return NextResponse.json({
      clientId,
      overallStatus,
      overallMessage,
      hasActiveSyncs,
      hasErrors,
      totalConnections: connectionStatuses.length,
      connections: connectionStatuses,
      nextScheduledSync,
      status: statusForWidget,
      lastSync: mostRecentSync?.completedAt || mostRecentSync?.startedAt || null,
      error: hasErrors
        ? connectionStatuses.find(s => s.status === 'error')?.statusMessage || overallMessage
        : undefined,
      campaignsSynced: mostRecentSync?.campaignsSynced,
      metricsUpdated: mostRecentSync?.metricsUpdated,
      lastUpdated: new Date().toISOString(),
      ...(diagnostics && { diagnostics }),
    });

  } catch (error) {
    console.error('[Google Sync Status] Error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Parâmetros inválidos',
          details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/google/sync/status (update sync status)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { syncId, status, error } = body;

    if (!syncId || !status) {
      return NextResponse.json(
        { error: 'Sync ID e status são obrigatórios' },
        { status: 400 }
      );
    }

    // Get authenticated user (this might be called by internal services)
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      // For internal service calls, you might want to use a service key
      // For now, we'll require authentication
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Update sync log
    const updateData: {
      status?: 'success' | 'failed' | 'partial';
      completedAt?: string;
      errorMessage?: string | null;
    } = {};

    if (status === 'completed') {
      updateData.completedAt = new Date().toISOString();
      updateData.status = 'success';
    } else if (status === 'failed') {
      updateData.completedAt = new Date().toISOString();
      updateData.status = 'failed';
      if (error) {
        updateData.errorMessage = error;
      }
    }

    const updated = await updateGoogleSyncLogStatus(syncId, updateData);
    if (!updated) {
      console.error('[Google Sync Status POST] Error updating sync log:', { syncId, status });
      return NextResponse.json(
        { error: 'Erro ao atualizar status da sincronização' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      syncId,
      status,
      updatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[Google Sync Status POST] Error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
