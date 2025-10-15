import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    // Usar service role para bypass da autenticação
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    console.log('🔍 [RAW DATA] Verificando dados brutos...')

    // Buscar todos os clientes
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })

    console.log('👥 [RAW DATA] Clientes encontrados:', clients?.length || 0)

    // Buscar todas as conexões Meta
    const { data: connections, error: connectionsError } = await supabase
      .from('client_meta_connections')
      .select('*')
      .order('created_at', { ascending: false })

    console.log('🔗 [RAW DATA] Conexões encontradas:', connections?.length || 0)

    // Buscar todas as campanhas
    const { data: campaigns, error: campaignsError } = await supabase
      .from('meta_campaigns')
      .select('*')
      .order('updated_at', { ascending: false })

    console.log('📊 [RAW DATA] Campanhas encontradas:', campaigns?.length || 0)

    // Buscar usuários
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, role, created_at')
      .order('created_at', { ascending: false })

    console.log('👤 [RAW DATA] Usuários encontrados:', users?.length || 0)

    return NextResponse.json({
      clients: clients || [],
      connections: connections || [],
      campaigns: campaigns || [],
      users: users || [],
      errors: {
        clients: clientsError?.message || null,
        connections: connectionsError?.message || null,
        campaigns: campaignsError?.message || null,
        users: usersError?.message || null
      },
      summary: {
        total_clients: clients?.length || 0,
        total_connections: connections?.length || 0,
        active_connections: connections?.filter(c => c.is_active).length || 0,
        total_campaigns: campaigns?.length || 0,
        active_campaigns: campaigns?.filter(c => c.status === 'ACTIVE').length || 0,
        total_users: users?.length || 0
      }
    })

  } catch (error) {
    console.error('💥 [RAW DATA] Erro:', error)
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}