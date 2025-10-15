import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔍 [CHECK REAL CAMPAIGNS] Usuário:', user.email)

    // 1. Buscar todos os clientes
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')

    console.log('👥 [CHECK REAL CAMPAIGNS] Clientes:', clients?.length || 0)

    // 2. Buscar todas as conexões Meta
    const { data: connections, error: connectionsError } = await supabase
      .from('client_meta_connections')
      .select('*')

    console.log('🔗 [CHECK REAL CAMPAIGNS] Conexões:', connections?.length || 0)

    // 3. Buscar todas as campanhas
    const { data: campaigns, error: campaignsError } = await supabase
      .from('meta_campaigns')
      .select('*')

    console.log('📊 [CHECK REAL CAMPAIGNS] Campanhas:', campaigns?.length || 0)

    // 4. Buscar campanhas com JOIN
    const { data: campaignsWithJoin, error: joinError } = await supabase
      .from('meta_campaigns')
      .select(`
        *,
        client_meta_connections!inner(
          client_id,
          account_name,
          ad_account_id,
          clients!inner(name)
        )
      `)

    console.log('📊 [CHECK REAL CAMPAIGNS] Campanhas com JOIN:', campaignsWithJoin?.length || 0)

    // 5. Para cada cliente, verificar campanhas
    const clientCampaigns = {}
    if (clients && connections) {
      for (const client of clients) {
        const clientConnections = connections.filter(c => c.client_id === client.id)
        
        if (clientConnections.length > 0) {
          const { data: clientCampaignsData } = await supabase
            .from('meta_campaigns')
            .select(`
              *,
              client_meta_connections!inner(
                client_id,
                account_name
              )
            `)
            .eq('client_meta_connections.client_id', client.id)

          clientCampaigns[client.name] = {
            connections: clientConnections.length,
            campaigns: clientCampaignsData?.length || 0,
            campaignNames: clientCampaignsData?.map(c => c.name) || []
          }
        }
      }
    }

    return NextResponse.json({
      summary: {
        total_clients: clients?.length || 0,
        total_connections: connections?.length || 0,
        total_campaigns: campaigns?.length || 0,
        campaigns_with_join: campaignsWithJoin?.length || 0
      },
      clients: clients || [],
      connections: connections || [],
      campaigns: campaigns || [],
      campaignsWithJoin: campaignsWithJoin || [],
      clientCampaigns,
      errors: {
        clients: clientsError?.message || null,
        connections: connectionsError?.message || null,
        campaigns: campaignsError?.message || null,
        join: joinError?.message || null
      }
    })

  } catch (error) {
    console.error('💥 [CHECK REAL CAMPAIGNS] Erro:', error)
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}