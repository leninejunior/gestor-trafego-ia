import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { UserAccessControlService } from '@/lib/services/user-access-control'

/**
 * POST /api/super-admin/access
 * Conceder acesso cross-organização (Requirements 7.3)
 */
async function grantCrossOrgAccessHandler(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Obter dados do request
    const body = await request.json()
    const { userId, clientId, permissions = { read: true, write: false } } = body

    // Validar dados obrigatórios
    if (!userId || !clientId) {
      return NextResponse.json(
        { error: 'userId e clientId são obrigatórios' },
        { status: 400 }
      )
    }

    // Obter usuário atual
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Autenticação necessária' },
        { status: 401 }
      )
    }

    // Verificar se é super admin
    const accessControl = new UserAccessControlService()
    const isSuperAdmin = await accessControl.isSuperAdmin(user.id)
    
    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: 'Acesso restrito a Super Admins' },
        { status: 403 }
      )
    }

    // Verificar se o usuário alvo existe
    const { data: targetUser, error: targetUserError } = await supabase.auth.admin.getUserById(userId)
    if (targetUserError || !targetUser.user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se o cliente existe
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select(`
        id, 
        name, 
        org_id,
        organizations!inner (
          id,
          name
        )
      `)
      .eq('id', clientId)
      .single()

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se o usuário já tem acesso
    const { data: existingAccess } = await supabase
      .from('user_client_access')
      .select('id, is_active')
      .eq('user_id', userId)
      .eq('client_id', clientId)
      .single()

    // Criar ou reativar acesso
    const accessData = {
      user_id: userId,
      client_id: clientId,
      organization_id: client.org_id,
      granted_by: user.id,
      permissions,
      is_active: true,
      notes: `Acesso cross-org concedido por Super Admin ${user.email}`,
      updated_at: new Date().toISOString()
    }

    let result
    if (existingAccess) {
      // Atualizar acesso existente
      const { data, error } = await supabase
        .from('user_client_access')
        .update(accessData)
        .eq('id', existingAccess.id)
        .select()
        .single()

      if (error) {
        throw new Error(`Erro ao atualizar acesso: ${error.message}`)
      }
      result = data
    } else {
      // Criar novo acesso
      const { data, error } = await supabase
        .from('user_client_access')
        .insert(accessData)
        .select()
        .single()

      if (error) {
        throw new Error(`Erro ao criar acesso: ${error.message}`)
      }
      result = data
    }

    return NextResponse.json({
      success: true,
      access: result,
      user: {
        id: targetUser.user.id,
        email: targetUser.user.email,
        name: targetUser.user.user_metadata?.name || targetUser.user.email
      },
      client: {
        id: client.id,
        name: client.name,
        organization: client.organizations.name
      },
      permissions,
      message: `Acesso cross-organização concedido com sucesso`
    })

  } catch (error) {
    console.error('Erro ao conceder acesso cross-org:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Erro interno'
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

export const POST = grantCrossOrgAccessHandler