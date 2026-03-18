import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userManagementService, UpdateUserData } from '@/lib/services/user-management'
import { UserAccessControlService, UserType } from '@/lib/services/user-access-control'

/**
 * API de gerenciamento individual de usuários
 * Implementa Requirements: 2.3, 2.4
 */

/**
 * GET /api/admin/users/management/[userId]
 * Obtém dados de um usuário específico
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = await createClient()
    const { userId } = await params
    
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
      // Usuários comuns só podem ver seus próprios dados
      if (user.id !== userId) {
        return NextResponse.json(
          { error: 'Você só pode visualizar seus próprios dados' },
          { status: 403 }
        )
      }
    }

    // Para org admins, verificar se o usuário pertence à mesma organização
    if (userType === UserType.ORG_ADMIN) {
      const canManage = await canAdminManageUser(supabase, user.id, userId)
      if (!canManage) {
        return NextResponse.json(
          { error: 'Você não tem permissão para visualizar este usuário' },
          { status: 403 }
        )
      }
    }

    // Buscar dados do usuário
    const targetUser = await getUserById(supabase, userId)
    
    if (!targetUser) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // Buscar acessos a clientes se for admin ou super admin
    let clientAccesses: any[] = []
    if (userType !== UserType.COMMON_USER || user.id === userId) {
      try {
        clientAccesses = await userManagementService.listUserClientAccess(user.id, userId)
      } catch (error) {
        console.warn('Erro ao buscar acessos do usuário:', error)
      }
    }

    return NextResponse.json({
      user: targetUser,
      clientAccesses,
      canEdit: userType !== UserType.COMMON_USER && (userType === UserType.SUPER_ADMIN || user.id !== userId)
    })

  } catch (error) {
    console.error('Erro ao buscar usuário:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/users/management/[userId]
 * Atualiza informações de um usuário
 * Requirements: 2.3
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = await createClient()
    const { userId } = await params
    const body = await request.json()
    
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
        { error: 'Usuários comuns não podem atualizar outros usuários' },
        { status: 403 }
      )
    }

    // Validar dados de entrada
    const { name, role, isActive } = body as UpdateUserData
    
    if (role && !['admin', 'member'].includes(role)) {
      return NextResponse.json(
        { error: 'Role deve ser "admin" ou "member"' },
        { status: 400 }
      )
    }

    // Não permitir que usuário desative a si mesmo
    if (user.id === userId && isActive === false) {
      return NextResponse.json(
        { error: 'Você não pode desativar sua própria conta' },
        { status: 400 }
      )
    }

    // Atualizar usuário
    const updates: UpdateUserData = {}
    if (name !== undefined) updates.name = name
    if (role !== undefined) updates.role = role
    if (isActive !== undefined) updates.isActive = isActive

    const updatedUser = await userManagementService.updateUser(user.id, userId, updates)

    return NextResponse.json({
      message: 'Usuário atualizado com sucesso',
      user: updatedUser
    })

  } catch (error) {
    console.error('Erro ao atualizar usuário:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/users/management/[userId]
 * Deleta um usuário com cascade de registros relacionados
 * Requirements: 2.4, 3.5
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = await createClient()
    const { userId } = await params
    
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
        { error: 'Usuários comuns não podem deletar outros usuários' },
        { status: 403 }
      )
    }

    // Não permitir que usuário delete a si mesmo
    if (user.id === userId) {
      return NextResponse.json(
        { error: 'Você não pode deletar sua própria conta' },
        { status: 400 }
      )
    }

    // Verificar se o usuário alvo existe
    const targetUser = await getUserById(supabase, userId)
    if (!targetUser) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se o usuário alvo é super admin (apenas outros super admins podem deletar)
    const targetUserType = await accessControl.getUserType(userId)
    if (targetUserType === UserType.SUPER_ADMIN && userType !== UserType.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Apenas super admins podem deletar outros super admins' },
        { status: 403 }
      )
    }

    // Deletar usuário (com cascade cleanup)
    await userManagementService.deleteUser(user.id, userId)

    return NextResponse.json({
      message: 'Usuário deletado com sucesso'
    })

  } catch (error) {
    console.error('Erro ao deletar usuário:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * Funções auxiliares
 */

/**
 * Busca dados completos de um usuário por ID
 */
async function getUserById(supabase: any, userId: string) {
  try {
    // Buscar dados do Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId)
    
    if (authError || !authUser.user) {
      return null
    }

    // Buscar organizações do usuário
    const { data: memberships, error: membershipError } = await supabase
      .from('memberships')
      .select(`
        role,
        organizations!inner (
          id,
          name
        )
      `)
      .eq('user_id', userId)

    const organizations = membershipError ? [] : memberships.map((m: any) => ({
      id: m.organizations.id,
      name: m.organizations.name,
      role: m.role
    }))

    // Determinar tipo de usuário
    const accessControl = new UserAccessControlService()
    const userType = await accessControl.getUserType(userId)

    return {
      id: authUser.user.id,
      email: authUser.user.email || '',
      name: authUser.user.user_metadata?.name || authUser.user.email || '',
      userType,
      organizations,
      createdAt: new Date(authUser.user.created_at),
      updatedAt: new Date(authUser.user.updated_at || authUser.user.created_at),
      isActive: true // Auth users are active by default
    }
  } catch (error) {
    console.error('Erro ao buscar usuário:', error)
    return null
  }
}

/**
 * Verifica se um admin pode gerenciar um usuário específico
 */
async function canAdminManageUser(supabase: any, adminUserId: string, userId: string): Promise<boolean> {
  try {
    // Buscar organizações do admin
    const { data: adminMemberships, error: adminError } = await supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', adminUserId)
      .eq('role', 'admin')

    if (adminError || !adminMemberships || adminMemberships.length === 0) {
      return false
    }

    // Buscar organizações do usuário alvo
    const { data: userMemberships, error: userError } = await supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', userId)

    if (userError || !userMemberships || userMemberships.length === 0) {
      return false
    }

    // Verificar se há interseção nas organizações
    const adminOrgIds = adminMemberships.map((m: any) => m.organization_id)
    const userOrgIds = userMemberships.map((m: any) => m.organization_id)
    
    return adminOrgIds.some((orgId: string) => userOrgIds.includes(orgId))

  } catch (error) {
    console.error('Erro ao verificar permissão de gerenciamento:', error)
    return false
  }
}