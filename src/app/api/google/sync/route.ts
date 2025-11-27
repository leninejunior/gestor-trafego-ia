/**
 * Google Ads Sync API Route
 * 
 * Manages manual synchronization of Google Ads data
 * Requirements: 3.1, 3.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGoogleSyncService } from '@/lib/google/sync-service';
import { validateCustomerId, logCustomerIdError } from '@/lib/google/customer-id-validator';
import { z } from 'zod';

// ============================================================================
// Request Validation Schemas
// ============================================================================

const SyncRequestSchema = z.object({
  clientId: z.string().uuid('Client ID deve ser um UUID válido'),
  connectionId: z.string().uuid('Connection ID deve ser um UUID válido').optional(),
  fullSync: z.boolean().default(false),
  syncType: z.enum(['campaigns', 'metrics', 'full']).default('full'),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD').optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD').optional(),
});

// ============================================================================
// Rate Limiting Configuration
// ============================================================================

const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes
const MAX_SYNCS_PER_WINDOW = 3; // Max 3 manual syncs per 5 minutes per client

// In-memory rate limiting (in production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(clientId: string): { allowed: boolean; resetTime?: number } {
  const now = Date.now();
  const key = `sync_${clientId}`;
  const current = rateLimitMap.get(key);

  if (!current || now > current.resetTime) {
    // Reset or initialize
    rateLimitMap.set(key, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return { allowed: true };
  }

  if (current.count >= MAX_SYNCS_PER_WINDOW) {
    return { allowed: false, resetTime: current.resetTime };
  }

  current.count += 1;
  return { allowed: true };
}

// ============================================================================
// POST /api/google/sync
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    
    // Log incoming request parameters
    const requestId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[Google Sync API] Incoming sync request [${requestId}]:`, {
      body,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent'),
      origin: request.headers.get('origin'),
    });
    
    const {
      clientId,
      connectionId,
      fullSync,
      syncType,
      dateFrom,
      dateTo,
    } = SyncRequestSchema.parse(body);
    
    console.log(`[Google Sync API] Validated parameters [${requestId}]:`, {
      clientId,
      connectionId,
      fullSync,
      syncType,
      dateFrom,
      dateTo,
      timestamp: new Date().toISOString(),
    });

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Verify user has access to the client through organization
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('org_id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      );
    }

    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', client.org_id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Acesso negado ao cliente especificado' },
        { status: 403 }
      );
    }

    // Check rate limiting
    const rateLimit = checkRateLimit(clientId);
    if (!rateLimit.allowed) {
      const resetIn = Math.ceil((rateLimit.resetTime! - Date.now()) / 1000 / 60);
      return NextResponse.json(
        { 
          error: 'Limite de sincronizações excedido',
          message: `Aguarde ${resetIn} minutos antes de tentar novamente`,
          resetIn,
        },
        { status: 429 }
      );
    }

    // Get connections for the client
    let connectionsQuery = supabase
      .from('google_ads_connections')
      .select('id, customer_id, status, last_sync_at')
      .eq('client_id', clientId)
      .eq('status', 'active');

    if (connectionId) {
      connectionsQuery = connectionsQuery.eq('id', connectionId);
    }

    const { data: connections, error: connectionsError } = await connectionsQuery;

    if (connectionsError || !connections || connections.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma conexão ativa encontrada para este cliente' },
        { status: 404 }
      );
    }

    // Validate customer IDs for all connections
    const invalidConnections: Array<{ id: string; customerId: string; errors: string[] }> = [];
    
    for (const connection of finalConnections) {
      const validation = validateCustomerId(connection.customer_id);
      
      if (!validation.isValid) {
        invalidConnections.push({
          id: connection.id,
          customerId: connection.customer_id,
          errors: validation.errors,
        });
        
        logCustomerIdError(connection.customer_id, {
          connectionId: connection.id,
          clientId,
          requestId,
        });
      }
    }
    
    // If any connections have invalid customer IDs, return error
    if (invalidConnections.length > 0) {
      console.error(`[Google Sync API] Invalid customer IDs found [${requestId}]:`, {
        invalidConnections,
        totalConnections: finalConnections.length,
        clientId,
        timestamp: new Date().toISOString(),
      });
      
      return NextResponse.json(
        { 
          error: 'Formato inválido de Customer ID',
          message: 'Uma ou mais conexões possuem Customer IDs em formato inválido',
          details: invalidConnections.map(conn => ({
            connectionId: conn.id,
            customerId: conn.customerId,
            errors: conn.errors,
          })),
          help: 'Customer ID deve ter exatamente 10 dígitos (ex: "1234567890" ou "123-456-7890")',
        },
        { status: 400 }
      );
    }
    
    console.log(`[Google Sync API] All customer IDs validated successfully [${requestId}]:`, {
      connectionsCount: finalConnections.length,
      customerIds: finalConnections.map(c => c.customer_id),
      timestamp: new Date().toISOString(),
    });

    // Check if any sync is already in progress
    const { data: activeSyncs } = await supabase
      .from('google_ads_sync_logs')
      .select('id, connection_id, sync_type, started_at')
      .in('connection_id', finalConnections.map(c => c.id))
      .is('completed_at', null)
      .gte('started_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()); // Last 30 minutes

    if (activeSyncs && activeSyncs.length > 0) {
      return NextResponse.json(
        { 
          error: 'Sincronização já em andamento',
          message: 'Aguarde a sincronização atual terminar antes de iniciar uma nova',
          activeSyncs: activeSyncs.map(sync => ({
            connectionId: sync.connection_id,
            syncType: sync.sync_type,
            startedAt: sync.started_at,
          })),
        },
        { status: 409 }
      );
    }

    // Initialize sync service
    const syncService = getGoogleSyncService();

    // Start sync for each connection
    const syncResults = [];
    
    for (const connection of finalConnections) {
      try {
        const syncOptions = {
          clientId,
          connectionId: connection.id,
          customerId: connection.customer_id,
          fullSync,
          syncType,
          dateRange: dateFrom && dateTo ? {
            startDate: dateFrom,
            endDate: dateTo,
          } : undefined,
        };

        console.log(`[Google Sync API] Starting sync for connection [${requestId}]:`, {
          ...syncOptions,
          connectionDetails: {
            id: connection.id,
            customerId: connection.customer_id,
            lastSyncAt: connection.last_sync_at,
            status: connection.status,
          },
          timestamp: new Date().toISOString(),
        });

        // Start the sync (this should be async/background)
        const result = await syncService.startSync(syncOptions);

        syncResults.push({
          connectionId: connection.id,
          customerId: connection.customer_id,
          syncId: result.syncId,
          status: result.status,
          estimatedTime: result.estimatedTime,
        });

      } catch (syncError) {
        console.error(`[Google Sync] Error starting sync for connection ${connection.id}:`, {
          error: syncError instanceof Error ? syncError.message : String(syncError),
          errorName: syncError instanceof Error ? syncError.name : 'Unknown',
          errorStack: syncError instanceof Error ? syncError.stack : undefined,
          connectionId: connection.id,
          customerId: connection.customer_id,
          clientId,
          syncOptions,
          requestId,
          timestamp: new Date().toISOString(),
        });
        
        syncResults.push({
          connectionId: connection.id,
          customerId: connection.customer_id,
          error: syncError instanceof Error ? syncError.message : 'Erro desconhecido',
          status: 'failed',
        });
      }
    }

    // Check if any syncs started successfully
    const successfulSyncs = syncResults.filter(r => r.status === 'started' || r.status === 'queued');
    const failedSyncs = syncResults.filter(r => r.status === 'failed');

    if (successfulSyncs.length === 0) {
      return NextResponse.json(
        { 
          error: 'Falha ao iniciar sincronização',
          message: 'Nenhuma sincronização pôde ser iniciada',
          results: syncResults,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Sincronização iniciada para ${successfulSyncs.length} conexão${successfulSyncs.length > 1 ? 'ões' : ''}`,
      clientId,
      syncType,
      fullSync,
      results: syncResults,
      summary: {
        total: finalConnections.length,
        successful: successfulSyncs.length,
        failed: failedSyncs.length,
        estimatedTime: Math.max(...successfulSyncs.map(s => s.estimatedTime || 0)),
      },
    });

  } catch (error) {
    console.error('[Google Sync] Error:', {
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : 'Unknown',
      errorStack: error instanceof Error ? error.stack : undefined,
      errorType: error instanceof z.ZodError ? 'ZodError' : typeof error,
      requestBody: body,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent'),
      origin: request.headers.get('origin'),
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Dados inválidos',
          details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/google/sync (get sync history)
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const connectionId = searchParams.get('connectionId');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID é obrigatório' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Verify user has access to the client through organization
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('org_id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      );
    }

    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', client.org_id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Acesso negado ao cliente especificado' },
        { status: 403 }
      );
    }

    // Build query for sync logs
    let query = supabase
      .from('google_ads_sync_logs')
      .select(`
        id,
        sync_type,
        status,
        campaigns_synced,
        metrics_updated,
        error_message,
        error_code,
        started_at,
        completed_at,
        connection_id,
        google_ads_connections!inner(
          customer_id,
          client_id
        )
      `)
      .eq('google_ads_connections.client_id', clientId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (connectionId) {
      query = query.eq('connection_id', connectionId);
    }

    const { data: syncLogs, error: logsError } = await query;

    if (logsError) {
      console.error('[Google Sync GET] Error fetching sync logs:', {
        error: logsError.message || String(logsError),
        errorCode: (logsError as any).code,
        errorDetails: (logsError as any).details,
        clientId,
        connectionId,
        limit,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(
        { error: 'Erro ao buscar histórico de sincronização' },
        { status: 500 }
      );
    }

    // Get current sync status
    const { data: activeSyncs } = await supabase
      .from('google_ads_sync_logs')
      .select(`
        id,
        sync_type,
        started_at,
        connection_id,
        google_ads_connections!inner(
          customer_id,
          client_id
        )
      `)
      .eq('google_ads_connections.client_id', clientId)
      .is('completed_at', null)
      .gte('started_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());

    return NextResponse.json({
      clientId,
      syncHistory: syncLogs || [],
      activeSyncs: activeSyncs || [],
      hasActiveSyncs: (activeSyncs?.length || 0) > 0,
      totalLogs: syncLogs?.length || 0,
    });

  } catch (error) {
    console.error('[Google Sync GET] Error:', {
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : 'Unknown',
      errorStack: error instanceof Error ? error.stack : undefined,
      clientId: searchParams.get('clientId'),
      connectionId: searchParams.get('connectionId'),
      limit: searchParams.get('limit'),
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}