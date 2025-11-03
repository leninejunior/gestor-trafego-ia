import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { checkAdminAuth, createAdminAuthErrorResponse } from '@/lib/middleware/admin-auth-improved';

/**
 * GET /api/admin/subscriptions/audit-history
 * Busca histórico de mudanças manuais em assinaturas
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação de admin
    const authResult = await checkAdminAuth();
    if (!authResult.success) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 Development mode: Continuing despite auth failure for testing');
      } else {
        return createAdminAuthErrorResponse(authResult);
      }
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = createServiceClient();

    // Verificar se a tabela subscription_audit_log existe
    const { error: queryError } = await supabase
      .from('subscription_audit_log')
      .select('*')
      .limit(1);

    if (queryError && queryError.message.includes('does not exist')) {
      // Tabela não existe, retornar dados vazios
      return NextResponse.json({
        success: true,
        data: {
          logs: [],
          pagination: {
            limit,
            offset,
            total: 0,
            hasMore: false
          },
          statistics: {
            total_actions: 0,
            action_types: {},
            admin_activity: {},
            period: {
              start_date: null,
              end_date: null
            }
          }
        },
        message: 'Tabela de auditoria não encontrada. Execute o SQL de criação no Supabase.'
      });
    }

    if (queryError) {
      throw queryError;
    }

    // Se chegou aqui, a tabela existe, fazer query completa
    let query = supabase
      .from('subscription_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: fullAuditLogs, error: fullQueryError } = await query;

    if (fullQueryError) {
      throw fullQueryError;
    }

    // Para cada log, buscar informações da organização separadamente
    const formattedLogs = await Promise.all(
      (fullAuditLogs || []).map(async (log) => {
        // Buscar organização se tiver organization_id
        let organization = null;
        if (log.organization_id) {
          const { data: org } = await supabase
            .from('organizations')
            .select('id, name')
            .eq('id', log.organization_id)
            .single();
          organization = org;
        }

        return {
          id: log.id,
          subscription_id: log.subscription_id,
          organization,
          admin_user: {
            id: log.admin_user_id,
            email: 'admin@example.com', // Placeholder
            full_name: 'Admin User' // Placeholder
          },
          action_type: log.action_type,
          reason: log.reason,
          notes: log.notes,
          previous_data: log.previous_data,
          new_data: log.new_data,
          effective_date: log.effective_date,
          created_at: log.created_at
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        logs: formattedLogs,
        pagination: {
          limit,
          offset,
          total: formattedLogs.length,
          hasMore: formattedLogs.length === limit
        },
        statistics: {
          total_actions: formattedLogs.length,
          action_types: {},
          admin_activity: {},
          period: {
            start_date: null,
            end_date: null
          }
        }
      }
    });

  } catch (error) {
    console.error('Erro ao buscar histórico de auditoria:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Falha ao buscar histórico de auditoria', 
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}