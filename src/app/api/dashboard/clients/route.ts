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

    console.log('=== CLIENTS API DEBUG ===')
    console.log('User:', user.email)

    // Verificar se é super admin
    const { data: membership } = await supabase
      .from("memberships")
      .select(`
        role,
        organization_id,
        organizations (name)
      `)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single()

    console.log('Membership:', membership)

    const isSuperAdmin = membership?.role === 'super_admin' || 
                        membership?.role?.includes('super_admin') ||
                        user.email === 'lenine.engrene@gmail.com'

    console.log('Is Super Admin:', isSuperAdmin)

    // Buscar clientes
    let clientsQuery = supabase
      .from('clients')
      .select(`
        id,
        name,
        organizations (
          id,
          name
        )
      `)
      .order('name')

    // Se não for super admin, filtrar apenas clientes da organização do usuário
    if (!isSuperAdmin) {
      clientsQuery = clientsQuery.eq('org_id', membership?.organization_id)
    }

    const { data: clientsData, error: clientsError } = await clientsQuery

    console.log('Clients data:', clientsData)
    console.log('Clients error:', clientsError)

    if (clientsError) {
      console.error('Error fetching clients:', clientsError)
      return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
    }

    // Buscar contagem de campanhas para cada cliente
    const clientIds = (clientsData || []).map(c => c.id)
    let campaignsCounts: Record<string, number> = {}
    
    if (clientIds.length > 0) {
      const { data: campaignsData } = await supabase
        .from('meta_campaigns')
        .select('client_id')
        .in('client_id', clientIds)
      
      // Contar campanhas por cliente
      campaignsData?.forEach(campaign => {
        campaignsCounts[campaign.client_id] = (campaignsCounts[campaign.client_id] || 0) + 1
      })
    }

    // Transformar dados
    const clients = (clientsData || []).map(client => ({
      id: client.id,
      name: client.name,
      organization_name: (client.organizations as any)?.name || 'Sem organização',
      campaigns_count: campaignsCounts[client.id] || 0
    }))

    console.log('Final clients:', clients)

    return NextResponse.json({
      clients,
      isSuperAdmin,
      userOrganization: (membership?.organizations as any)?.name || null,
      hasClients: clients.length > 0
    })

  } catch (error) {
    console.error('Error in clients API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}