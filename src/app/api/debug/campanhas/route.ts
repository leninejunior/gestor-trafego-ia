import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const debug: any = {
      user: {
        id: user.id,
        email: user.email
      }
    }

    // 1. Verificar memberships
    const { data: memberships } = await supabase
      .from('memberships')
      .select(`
        id,
        role,
        status,
        organization_id,
        organizations (
          id,
          name
        )
      `)
      .eq('user_id', user.id)

    debug.memberships = memberships

    // 2. Verificar clientes
    const { data: clients } = await supabase
      .from('clients')
      .select(`
        id,
        name,
        org_id,
        organizations (
          id,
          name
        )
      `)

    debug.clients = clients

    // 3. Verificar conexões Meta
    const { data: connections } = await supabase
      .from('client_meta_connections')
      .select(`
        id,
        client_id,
        account_name,
        account_id,
        is_active,
        clients (
          id,
          name
        )
      `)

    debug.connections = connections

    // 4. Verificar se tabela meta_campaigns existe
    let metaCampaigns = null
    let metaCampaignsError = null
    
    try {
      const { data, error } = await supabase
        .from('meta_campaigns')
        .select('*')
        .limit(5)
      
      metaCampaigns = data
      metaCampaignsError = error
    } catch (error) {
      metaCampaignsError = error
    }

    debug.metaCampaigns = {
      data: metaCampaigns,
      error: metaCampaignsError,
      exists: metaCampaigns !== null
    }

    // 5. Verificar permissões do usuário
    const isSuperAdmin = memberships?.some(m => 
      m.role === 'super_admin' || 
      m.role?.includes('super_admin')
    ) || user.email === 'lenine.engrene@gmail.com'

    debug.permissions = {
      isSuperAdmin,
      userOrganizations: memberships?.map(m => m.organizations?.name).filter(Boolean)
    }

    return NextResponse.json(debug)

  } catch (error) {
    console.error('Error in debug API:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}