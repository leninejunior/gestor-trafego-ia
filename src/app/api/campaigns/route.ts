import { NextRequest, NextResponse } from 'next/server'
import { createAccessControl, getUserFromAccessContext } from '@/lib/middleware/user-access-middleware'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/campaigns
 * Lista campanhas com controle de acesso baseado no tipo de usuário
 */
async function handleGet(request: NextRequest, context: any) {
  const userInfo = getUserFromAccessContext(context)
  if (!userInfo) {
    return NextResponse.json({ error: 'Contexto de usuário inválido' }, { status: 500 })
  }

  const { user, userType, userLimits, clientId } = userInfo
  const supabase = await createClient()

  try {
    let query = supabase
      .from('meta_campaigns')
      .select(`
        *,
        connection:client_meta_connections(
          id,
          account_name,
          client:clients(id, name)
        )
      `)

    // Aplicar filtros baseados no tipo de usuário
    switch (userType) {
      case 'master':
        // Master users veem todas as campanhas
        break
        
      case 'client':
        // Client users veem apenas campanhas do próprio cliente
        if (!clientId) {
          return NextResponse.json({ error: 'Client ID obrigatório para usuários cliente' }, { status: 400 })
        }
        query = query.eq('connection.client_id', clientId)
        break
        
      case 'regular':
        // Regular users veem campanhas de suas organizações
        const { data: memberships } = await supabase
          .from('memberships')
          .select('organization_id')
          .eq('user_id', user.id)

        if (!memberships || memberships.length === 0) {
          return NextResponse.json({ data: [] })
        }

        const orgIds = memberships.map(m => m.organization_id)
        query = query.in('connection.client.org_id', orgIds)
        break
    }

    // Aplicar limites de dados se necessário
    if (userLimits && !userLimits.unlimited) {
      if (userLimits.data_retention_days) {
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - userLimits.data_retention_days)
        query = query.gte('created_at', cutoffDate.toISOString())
      }
    }

    const { data: campaigns, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar campanhas:', error)
      return NextResponse.json({ error: 'Erro ao buscar campanhas' }, { status: 500 })
    }

    return NextResponse.json({
      data: campaigns || [],
      userType,
      limits: userLimits
    })

  } catch (error) {
    console.error('Erro na API de campanhas:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

/**
 * POST /api/campaigns
 * Cria nova campanha (apenas master e regular users)
 */
async function handlePost(request: NextRequest, context: any) {
  const userInfo = getUserFromAccessContext(context)
  if (!userInfo) {
    return NextResponse.json({ error: 'Contexto de usuário inválido' }, { status: 500 })
  }

  const { user, userType, userLimits } = userInfo

  // Client users não podem criar campanhas
  if (userType === 'client') {
    return NextResponse.json({ 
      error: 'Usuários cliente têm acesso apenas de leitura' 
    }, { status: 403 })
  }

  try {
    const body = await request.json()
    const supabase = await createClient()

    // Verificar limites para regular users
    if (userType === 'regular' && userLimits && !userLimits.unlimited) {
      if (userLimits.max_campaigns) {
        // Contar campanhas existentes do usuário
        const { count } = await supabase
          .from('meta_campaigns')
          .select('*', { count: 'exact', head: true })
          .eq('connection.client.org_id', body.org_id)

        if (count && count >= userLimits.max_campaigns) {
          return NextResponse.json({
            error: 'Limite de campanhas atingido',
            current: count,
            limit: userLimits.max_campaigns,
            upgradeRequired: true
          }, { status: 403 })
        }
      }
    }

    // Criar campanha
    const { data: campaign, error } = await supabase
      .from('meta_campaigns')
      .insert({
        ...body,
        created_by: user.id
      })
      .select()
      .single()

    if (error) {
      console.error('Erro ao criar campanha:', error)
      return NextResponse.json({ error: 'Erro ao criar campanha' }, { status: 500 })
    }

    return NextResponse.json({ data: campaign }, { status: 201 })

  } catch (error) {
    console.error('Erro na criação de campanha:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// Aplicar middleware de controle de acesso

// Exportar handlers com middleware
export const GET = createAccessControl.readCampaigns(false)(handleGet)
export const POST = createAccessControl.writeCampaigns(false)(handlePost)