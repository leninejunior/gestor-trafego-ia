import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSyncService } from '@/lib/meta/sync-service';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      enabled = true,
      intervalHours = 24,
      syncTypes = ['campaigns', 'insights']
    } = body;

    if (enabled) {
      // Verificar se tem token do Meta
      const { data: metaConnection } = await supabase
        .from('user_meta_tokens')
        .select('access_token')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (!metaConnection?.access_token) {
        return NextResponse.json(
          { error: 'Token do Meta Ads não encontrado. Conecte sua conta primeiro.' },
          { status: 400 }
        );
      }

      // Criar/atualizar configuração de auto-sync
      const { error: upsertError } = await supabase
        .from('sync_schedules')
        .upsert({
          user_id: user.id,
          sync_type: 'meta_ads',
          interval_hours: intervalHours,
          sync_config: JSON.stringify({ syncTypes }),
          is_active: true,
          last_run: null,
          next_run: new Date(Date.now() + intervalHours * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString()
        });

      if (upsertError) {
        throw upsertError;
      }

      return NextResponse.json({
        success: true,
        message: `Auto-sync configurado para cada ${intervalHours} horas`,
        config: {
          enabled: true,
          intervalHours,
          syncTypes,
          nextRun: new Date(Date.now() + intervalHours * 60 * 60 * 1000).toISOString()
        }
      });

    } else {
      // Desabilitar auto-sync
      const { error: updateError } = await supabase
        .from('sync_schedules')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('sync_type', 'meta_ads');

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({
        success: true,
        message: 'Auto-sync desabilitado',
        config: {
          enabled: false
        }
      });
    }

  } catch (error) {
    console.error('Erro na configuração de auto-sync:', error);
    
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Buscar configuração atual
    const { data: schedule } = await supabase
      .from('sync_schedules')
      .select('*')
      .eq('user_id', user.id)
      .eq('sync_type', 'meta_ads')
      .single();

    const config = schedule ? {
      enabled: schedule.is_active,
      intervalHours: schedule.interval_hours,
      syncTypes: schedule.sync_config ? JSON.parse(schedule.sync_config).syncTypes : ['campaigns', 'insights'],
      lastRun: schedule.last_run,
      nextRun: schedule.next_run,
      createdAt: schedule.created_at
    } : {
      enabled: false,
      intervalHours: 24,
      syncTypes: ['campaigns', 'insights'],
      lastRun: null,
      nextRun: null,
      createdAt: null
    };

    return NextResponse.json({
      success: true,
      config
    });

  } catch (error) {
    console.error('Erro ao buscar configuração de auto-sync:', error);
    
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}

// Endpoint para executar auto-sync (chamado por cron job)
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar se é uma chamada interna (cron job)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Não autorizado para execução de cron' },
        { status: 401 }
      );
    }

    console.log('🔄 Executando auto-sync agendado...');

    // Buscar todos os schedules ativos que precisam ser executados
    const now = new Date().toISOString();
    const { data: schedules } = await supabase
      .from('sync_schedules')
      .select(`
        *,
        user_meta_tokens!inner (
          access_token,
          is_active
        )
      `)
      .eq('sync_type', 'meta_ads')
      .eq('is_active', true)
      .lte('next_run', now)
      .eq('user_meta_tokens.is_active', true);

    if (!schedules || schedules.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum auto-sync pendente',
        processed: 0
      });
    }

    const results = [];

    for (const schedule of schedules) {
      try {
        console.log(`🔄 Executando sync para usuário ${schedule.user_id}...`);

        const syncService = createSyncService(schedule.user_meta_tokens.access_token);
        const syncConfig = schedule.sync_config ? JSON.parse(schedule.sync_config) : {};
        
        // Executar sincronização
        const syncResults = await syncService.fullSync(schedule.user_id, {
          syncCampaigns: syncConfig.syncTypes?.includes('campaigns') !== false,
          syncInsights: syncConfig.syncTypes?.includes('insights') !== false,
          dateRange: {
            since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            until: new Date().toISOString().split('T')[0]
          }
        });

        const success = Array.isArray(syncResults) 
          ? syncResults.some(r => r.success)
          : syncResults.success;

        // Atualizar schedule
        const nextRun = new Date(Date.now() + schedule.interval_hours * 60 * 60 * 1000).toISOString();
        
        await supabase
          .from('sync_schedules')
          .update({
            last_run: new Date().toISOString(),
            next_run: nextRun,
            last_status: success ? 'success' : 'error'
          })
          .eq('id', schedule.id);

        // Registrar log
        await supabase
          .from('sync_logs')
          .insert({
            user_id: schedule.user_id,
            sync_type: 'auto_sync',
            status: success ? 'success' : 'error',
            results: JSON.stringify(syncResults),
            created_at: new Date().toISOString()
          });

        results.push({
          userId: schedule.user_id,
          success,
          nextRun,
          results: syncResults
        });

      } catch (error) {
        console.error(`Erro no auto-sync para usuário ${schedule.user_id}:`, error);
        
        // Atualizar schedule com erro
        await supabase
          .from('sync_schedules')
          .update({
            last_run: new Date().toISOString(),
            next_run: new Date(Date.now() + schedule.interval_hours * 60 * 60 * 1000).toISOString(),
            last_status: 'error'
          })
          .eq('id', schedule.id);

        results.push({
          userId: schedule.user_id,
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Auto-sync executado para ${results.length} usuários`,
      processed: results.length,
      results
    });

  } catch (error) {
    console.error('Erro na execução de auto-sync:', error);
    
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}