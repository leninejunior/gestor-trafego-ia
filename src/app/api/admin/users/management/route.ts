import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userManagementService, CreateUserData, UpdateUserData } from '@/lib/services/user-management'
import { UserAccessControlService, UserType } from '@/lib/services/user-access-control'

/**
 * API de gerenciamento de usuários
 * Implementa Requirements: 2.1, 2.2, 2.3, 2.4
 */

/**
 * GET /api/admin/users/management
 * Lista usuários da organização com filtros
 * Requirements: 2.1
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Autenticação necessária' },
        { status: 401 }
      )
    }

    // Verificar tipo de usuário
    const accessControl = new UserAccessControlService()
    const userType = await accessControl.getUserType(user.id)
    
    if (userType === UserType.COMMON_USER) {
      return NextResponse.json(
        { error: 'Usuários comuns não podem listar outros usuários' },
        { status: 403 }
      )
    }

    // Parâmetros de filtro
    const organizationId = searchParams.get('organizationId')
    const role = searchParams.get('role') as 'admin' | 'member' | undefined
    const isActive = searchParams.get('isActive')
    
    // Para org admins, organizationId é obrigatório e deve ser da sua organização
    if (userType === UserType.ORG_ADMIN) {
      if (!organizationId) {
        return NextResponse.json(
          { error: 'Organization ID é obrigatório para admins de organização' },
          { status: 400 }
        )
      }

      const isOrgAdmin = await accessControl.isOrgAdmin(user.id, organizationId)
      if (!isOrgAdmin) {
        return NextResponse.json(
          { error: 'Você não tem permissão para listar usuários desta organização' },
          { status: 403 }
        )
      }
    }

    // Para super admins, se não especificaram org, listar todas
    let users
    if (userType === UserType.SUPER_ADMIN && !organizationId) {
      // Buscar todas as organizações e seus usuários
      const { data: organizations, error: orgError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('is_active', true)

      if (orgError) {
        throw new Error(`Erro ao buscar organizações: ${orgError.message}`)
      }

      users = []
      for (const org of organizations || []) {
        try {
          const orgUsers = await userManagementService.listOrganizationUsers(user.id, org.id)
          users.push(...orgUsers)
        } catch (error) {
          console.warn(`Erro ao buscar usuários da organização ${org.id}:`, error)
        }
      }
    } else {
      // Listar usuários de uma organização específica
      const targetOrgId = organizationId || (await getUserOrganization(supabase, user.id))
      
      if (!targetOrgId) {
        return NextResponse.json(
          { error: 'Organização não encontrada' },
          { status: 400 }
        )
      }

      users = await userManagementService.listOrganizationUsers(user.id, targetOrgId)
    }

    // Aplicar filtros adicionais
    let filteredUsers = users

    if (role) {
      filteredUsers = filteredUsers.filter(u => 
        u.organizations.some(org => org.role === role)
      )
    }

    if (isActive !== null && isActive !== undefined) {
      const activeFilter = isActive === 'true'
      filteredUsers = filteredUsers.filter(u => u.isActive === activeFilter)
    }

    // Calcular estatísticas
    const stats = {
      total: users.length,
      active: users.filter(u => u.isActive).length,
      admins: users.filter(u => u.organizations.some(org => org.role === 'admin')).length,
      members: users.filter(u => u.organizations.some(org => org.role === 'member')).length,
      superAdmins: users.filter(u => u.userType === UserType.SUPER_ADMIN).length
    }

    return NextResponse.json({
      users: filteredUsers,
      stats,
      userType,
      canManageUsers: userType === UserType.SUPER_ADMIN || userType === UserType.ORG_ADMIN
    })

  } catch (error) {
    console.error('Erro ao listar usuários:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/users/management
 * Cria novo usuário
 * Requirements: 2.1, 2.2, 10.1
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Autenticação necessária' },
        { status: 401 }
      )
    }

    // Validar dados de entrada
    const { email, name, role, organizationId } = body as CreateUserData
    
    if (!email || !name || !role) {
      return NextResponse.json(
        { error: 'Email, nome e role são obrigatórios' },
        { status: 400 }
      )
    }

    if (!['admin', 'member'].includes(role)) {
      return NextResponse.json(
        { error: 'Role deve ser "admin" ou "member"' },
        { status: 400 }
      )
    }

    // Verificar tipo de usuário
    const accessControl = new UserAccessControlService()
    const userType = await accessControl.getUserType(user.id)
    
    if (userType === UserType.COMMON_USER) {
      return NextResponse.json(
        { error: 'Usuários comuns não podem criar outros usuários' },
        { status: 403 }
      )
    }

    // Para org admins, organizationId é obrigatório
    let targetOrgId = organizationId
    if (userType === UserType.ORG_ADMIN) {
      if (!targetOrgId) {
        // Usar a organização do admin
        targetOrgId = await getUserOrganization(supabase, user.id)
      }
      
      if (!targetOrgId) {
        return NextResponse.json(
          { error: 'Organization ID é obrigatório' },
          { status: 400 }
        )
      }
    }

    // Para super admins, se não especificaram org, usar a primeira disponível
    if (userType === UserType.SUPER_ADMIN && !targetOrgId) {
      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('id')
        .eq('is_active', true)
        .limit(1)

      if (!orgsError && orgs && orgs.length > 0) {
        targetOrgId = orgs[0].id
      } else {
        return NextResponse.json(
          { error: 'Nenhuma organização ativa encontrada' },
          { status: 400 }
        )
      }
    }

    // Criar usuário
    const userData: CreateUserData = {
      email,
      name,
      role,
      organizationId: targetOrgId ?? undefined
    }

    const newUser = await userManagementService.createUser(user.id, userData)

    return NextResponse.json({
      message: 'Usuário criado com sucesso',
      user: newUser
    }, { status: 201 })

  } catch (error) {
    console.error('Erro ao criar usuário:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * Função auxiliar para obter organização do usuário
 */
async function getUserOrganization(supabase: any, userId: string): Promise<string | undefined> {
  try {
    const { data: membership, error } = await supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', userId)
      .single()

    return error ? undefined : membership?.organization_id
  } catch (error) {
    return undefined
  }
}