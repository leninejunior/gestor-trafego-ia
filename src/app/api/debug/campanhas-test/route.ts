import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const debug: any = {}

    // 1. Verificar clientes com organizações
    const { data: clients, error: clientsError } = await supabase
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

    debug.clients = {
      data: clients,
      error: clientsError,
      count: clients?.length || 0
    }

    // 2. Verificar conexões Meta com estrutura correta
    const { data: connections, error: connectionsError } = await supabase
      .from('client_meta_connections')
      .select(`
        id,
        client_id,
        account_name,
        ad_account_id,
        is_active
      `)

    debug.connections = {
      data: connections,
      error: connectionsError,
      count: connections?.length || 0
    }

    // 3. Verificar campanhas Meta - estrutura real
    let metaCampaigns = null
    let metaCampaignsError = null
    
    try {
      const { data, error } = await supabase
        .from('meta_campaigns')
        .select('*')
        .limit(5)
      
      metaCampaigns = data
      metaCampaignsError = error
      
      // Se temos dados, mostrar as colunas disponíveis
      if (metaCampaigns && metaCampaigns.length > 0) {
        debug.availableColumns = Object.keys(metaCampaigns[0])
      }
    } catch (error) {
      metaCampaignsError = error
    }

    debug.metaCampaigns = {
      data: metaCampaigns,
      error: metaCampaignsError,
      count: metaCampaigns?.length || 0,
      exists: metaCampaigns !== null
    }

    // 4. Verificar organizações
    const { data: organizations, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name')

    debug.organizations = {
      data: organizations,
      error: orgsError,
      count: organizations?.length || 0
    }

    // 5. Verificar memberships
    const { data: memberships, error: membershipsError } = await supabase
      .from('memberships')
      .select(`
        id,
        user_id,
        role,
        status,
        organization_id,
        organizations (name)
      `)

    debug.memberships = {
      data: memberships,
      error: membershipsError,
      count: memberships?.length || 0
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