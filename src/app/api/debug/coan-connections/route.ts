import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    console.log('🔍 [DEBUG COAN] Iniciando debug das conexões do cliente Coan...')

    // 1. Buscar o cliente Coan
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .ilike('name', '%coan%')

    console.log('👥 [DEBUG COAN] Clientes encontrados:', clients?.length || 0)

    if (clientsError) {
      console.error('❌ [DEBUG COAN] Erro ao buscar clientes:', clientsError)
      return NextResponse.json({ error: 'Erro ao buscar clientes', details: clientsError })
    }

    if (!clients || clients.length === 0) {
      console.log('⚠️ [DEBUG COAN] Nenhum cliente Coan encontrado')
      return NextResponse.json({ 
        message: 'Nenhum cliente Coan encontrado',
        clients: [],
        connections: [],
        campaigns: []
      })
    }

    const clientIds = clients.map(c => c.id)
    console.log('🆔 [DEBUG COAN] IDs dos clientes:', clientIds)

    // 2. Buscar conexões Meta
    const { data: connections, error: connectionsError } = await supabase
      .from('client_meta_connections')
      .select(`
        *,
        clients!inner(name)
      `)
      .in('client_id', clientIds)

    console.log('🔗 [DEBUG COAN] Conexões encontradas:', connections?.length || 0)

    if (connectionsError) {
      console.error('❌ [DEBUG COAN] Erro ao buscar conexões:', connectionsError)
    }

    // 3. Buscar campanhas sincronizadas
    let campaigns = []
    if (connections && connections.length > 0) {
      const connectionIds = connections.map(c => c.id)
      
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('meta_campaigns')
        .select(`
          *,
          client_meta_connections!inner(
            account_name,
            client_id,
            clients!inner(name)
          )
        `)
        .in('connection_id', connectionIds)

      console.log('📊 [DEBUG COAN] Campanhas encontradas:', campaignsData?.length || 0)

      if (campaignsError) {
        console.error('❌ [DEBUG COAN] Erro ao buscar campanhas:', campaignsError)
      } else {
        campaigns = campaignsData || []
      }
    }

    // 4. Preparar resposta detalhada
    const result = {
      clients: clients.map(c => ({
        id: c.id,
        name: c.name,
        created_at: c.created_at
      })),
      connections: (connections || []).map(c => ({
        id: c.id,
        client_id: c.client_id,
        account_name: c.account_name,
        ad_account_id: c.ad_account_id,
        is_active: c.is_active,
        has_token: !!c.access_token,
        created_at: c.created_at,
        updated_at: c.updated_at
      })),
      campaigns: campaigns.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        objective: c.objective,
        external_id: c.external_id,
        connection_id: c.connection_id,
        created_time: c.created_time,
        updated_at: c.updated_at
      })),
      summary: {
        total_clients: clients.length,
        total_connections: connections?.length || 0,
        active_connections: connections?.filter(c => c.is_active).length || 0,
        total_campaigns: campaigns.length,
        active_campaigns: campaigns.filter(c => c.status === 'ACTIVE').length
      }
    }

    console.log('📋 [DEBUG COAN] Resumo:', result.summary)

    return NextResponse.json(result)

  } catch (error) {
    console.error('💥 [DEBUG COAN] Erro geral:', error)
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}