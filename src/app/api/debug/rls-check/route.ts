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

    console.log('🔍 [RLS CHECK] Usuário:', user.email)

    // 1. Verificar membership
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select(`
        role,
        organization_id,
        status,
        organizations (name)
      `)
      .eq('user_id', user.id)

    console.log('👥 [RLS CHECK] Membership:', membership)

    // 2. Buscar clientes SEM filtro de organização (para debug)
    const { data: allClients, error: allClientsError } = await supabase
      .from('clients')
      .select('*')

    console.log('🏢 [RLS CHECK] Todos os clientes:', allClients?.length || 0)

    // 3. Buscar clientes COM filtro de organização
    let filteredClients = []
    let filteredClientsError = null
    
    if (membership && membership.length > 0) {
      const orgId = membership[0].organization_id
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('org_id', orgId)

      filteredClients = data || []
      filteredClientsError = error
      
      console.log(`🏢 [RLS CHECK] Clientes da org ${orgId}:`, filteredClients.length)
    }

    // 4. Buscar conexões Meta
    const { data: connections, error: connectionsError } = await supabase
      .from('client_meta_connections')
      .select('*')

    console.log('🔗 [RLS CHECK] Conexões Meta:', connections?.length || 0)

    // 5. Buscar campanhas
    const { data: campaigns, error: campaignsError } = await supabase
      .from('meta_campaigns')
      .select('*')

    console.log('📊 [RLS CHECK] Campanhas:', campaigns?.length || 0)

    // 6. Verificar se é super admin
    const isSuperAdmin = membership?.[0]?.role === 'super_admin' || 
                        membership?.[0]?.role?.includes('super_admin') ||
                        user.email === 'lenine.engrene@gmail.com'

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email
      },
      membership: membership || [],
      isSuperAdmin,
      data: {
        allClients: allClients?.length || 0,
        filteredClients: filteredClients.length,
        connections: connections?.length || 0,
        campaigns: campaigns?.length || 0
      },
      errors: {
        membership: membershipError?.message || null,
        allClients: allClientsError?.message || null,
        filteredClients: filteredClientsError?.message || null,
        connections: connectionsError?.message || null,
        campaigns: campaignsError?.message || null
      },
      rawData: {
        allClients: allClients || [],
        filteredClients,
        connections: connections || [],
        campaigns: campaigns || []
      }
    })

  } catch (error) {
    console.error('💥 [RLS CHECK] Erro:', error)
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}