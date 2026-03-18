import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { UserAccessControlService, UserType } from '@/lib/services/user-access-control'

/**
 * DELETE /api/admin/users/[userId]/delete
 * Deletar um usuário com cascade de registros relacionados
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

    // Verificar se o usuário alvo existe
    const { data: targetUser, error: targetUserError } = await supabase.auth.admin.getUserById(userId)
    
    if (targetUserError || !targetUser.user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // Não permitir que usuário delete a si mesmo
    if (user.id === userId) {
      return NextResponse.json(
        { error: 'Você não pode deletar sua própria conta' },
        { status: 403 }
      )
    }

    // Verificar se está tentando deletar um super admin
    const targetUserType = await accessControl.getUserType(userId)
    if (targetUserType === UserType.SUPER_ADMIN && userType !== UserType.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Apenas super admins podem deletar outros super admins' },
        { status: 403 }
      )
    }

    // Buscar membership do usuário alvo para verificar permissões
    const { data: membership } = await supabase
      .from('memberships')
      .select(`
        organization_id,
        role,
        organizations!inner (
          name
        )
      `)
      .eq('user_id', userId)
      .single()

    // Para org admins, verificar se podem gerenciar este usuário
    if (userType === UserType.ORG_ADMIN && membership) {
      const isOrgAdmin = await accessControl.isOrgAdmin(user.id, membership.organization_id)
      if (!isOrgAdmin) {
        return NextResponse.json(
          { error: 'Você não tem permissão para deletar este usuário' },
          { status: 403 }
        )
      }
    }

    // Guardar dados para log
    const userData = {
      email: targetUser.user.email,
      name: targetUser.user.user_metadata?.name,
      role: membership?.role,
      organizationName: membership?.organizations?.name
    }

    // Deletar registros relacionados primeiro (cascade cleanup)
    
    // 1. Deletar acessos a clientes
    const { error: clientAccessError } = await supabase
      .from('user_client_access')
      .delete()
      .eq('user_id', userId)

    if (clientAccessError) {
      console.warn('Erro ao deletar acessos a clientes:', clientAccessError)
    }

    // 2. Deletar memberships
    const { error: membershipDeleteError } = await supabase
      .from('memberships')
      .delete()
      .eq('user_id', userId)

    if (membershipDeleteError) {
      console.warn('Erro ao deletar memberships:', membershipDeleteError)
    }

    // 3. Remover de super_admins se aplicável
    if (targetUserType === UserType.SUPER_ADMIN) {
      const { error: superAdminDeleteError } = await supabase
        .from('super_admins')
        .delete()
        .eq('user_id', userId)

      if (superAdminDeleteError) {
        console.warn('Erro ao remover super admin:', superAdminDeleteError)
      }
    }

    // 4. Deletar usuário do Auth (isso também remove referências FK restantes)
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId)
    
    if (authDeleteError) {
      return NextResponse.json(
        { error: `Erro ao deletar usuário: ${authDeleteError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Usuário ${userData.name || userData.email} foi deletado com sucesso`,
      deletedUser: {
        id: userId,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        organizationName: userData.organizationName
      }
    })

  } catch (error) {
    console.error('Erro ao deletar usuário:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}