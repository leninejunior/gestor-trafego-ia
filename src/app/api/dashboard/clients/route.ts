import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type ClientRow = {
  id: string
  name: string
  organizations?: { id?: string; name?: string } | null
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: membership } = await supabase
      .from('memberships')
      .select(
        `
        role,
        organization_id,
        organizations (name)
      `
      )
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    const isSuperAdmin =
      membership?.role === 'super_admin' ||
      membership?.role?.includes('super_admin') ||
      user.email === 'lenine.engrene@gmail.com'

    let clientsQuery = supabase
      .from('clients')
      .select(
        `
        id,
        name,
        organizations (
          id,
          name
        )
      `
      )
      .order('name')

    if (!isSuperAdmin) {
      clientsQuery = clientsQuery.eq('org_id', membership?.organization_id)
    }

    const { data: clientsData, error: clientsError } = await clientsQuery

    if (clientsError) {
      return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
    }

    const typedClientsData: ClientRow[] = Array.isArray(clientsData) ? (clientsData as ClientRow[]) : []
    const clientIds = typedClientsData.map((client) => client.id)
    const campaignsCounts: Record<string, number> = {}

    if (clientIds.length > 0) {
      const { data: campaignsData } = await supabase
        .from('meta_campaigns')
        .select('client_id')
        .in('client_id', clientIds)

      campaignsData?.forEach((campaign) => {
        campaignsCounts[campaign.client_id] = (campaignsCounts[campaign.client_id] || 0) + 1
      })
    }

    const clients = typedClientsData.map((client) => ({
      id: client.id,
      name: client.name,
      organization_id: client.organizations?.id || null,
      organization_name: client.organizations?.name || 'Sem organizacao',
      campaigns_count: campaignsCounts[client.id] || 0
    }))

    const organizationsMap = new Map<string, { id: string; name: string }>()
    for (const client of clients) {
      if (client.organization_id && client.organization_name) {
        organizationsMap.set(client.organization_id, {
          id: client.organization_id,
          name: client.organization_name
        })
      }
    }

    const organizations = Array.from(organizationsMap.values()).sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({
      clients,
      organizations,
      isSuperAdmin,
      organizationId: membership?.organization_id || null,
      userOrganization: (membership?.organizations as { name?: string } | null)?.name || null,
      hasClients: clients.length > 0
    })
  } catch (error) {
    console.error('Error in clients API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
