import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { UserAccessControlService, UserType } from '@/lib/services/user-access-control'

/**
 * PUT /api/super-admin/users/[userId]/type
 * Alterar tipo de usuário (Requirements 7.2)
 */
async function changeUserTypeHandler(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const supabase = await createClient()
    
    // Obter dados do request
    const body = await request.json()
    const { userType, organizationId } = body

    // Validar tipo de usuário
    if (!Object.values(UserType).includes(userType)) {
      return NextResponse.json(
        { error: 'Tipo de usuário inválido. Use: super_admin, org_admin, ou common_user' },
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

    // Não permitir que super admin altere seu próprio tipo
    if (user.id === userId) {
      return NextResponse.json(
        { error: 'Você não pode alterar seu próprio tipo de usuário' },
        { status: 400 }
      )
    }

    // Obter tipo atual do usuário
    const currentUserType = await accessControl.getUserType(userId)

    // Processar mudança de tipo
    switch (userType) {
      case UserType.SUPER_ADMIN:
        // Adicionar à tabela super_admins
        if (currentUserType !== UserType.SUPER_ADMIN) {
          const { error: superAdminError } = await supabase
            .from('super_admins')
            .upsert({
              user_id: userId,
              created_by: user.id,
              is_active: true,
              notes: `Promovido a Super Admin por ${user.email}`
            })

          if (superAdminError) {
            throw new Error(`Erro ao promover a Super Admin: ${superAdminError.message}`)
          }
        }
        break

      case UserType.ORG_ADMIN:
        // Remover de super_admins se necessário
        if (currentUserType === UserType.SUPER_ADMIN) {
          await supabase
            .from('super_admins')
            .update({ is_active: false })
            .eq('user_id', userId)
        }

        // Garantir que tem membership como admin
        if (organizationId) {
          // Validar organização
          const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('id, name')
            .eq('id', organizationId)
            .single()

          if (orgError || !org) {
            return NextResponse.json(
              { error: 'Organização não encontrada' },
              { status: 404 }
            )
          }

          // Atualizar ou criar membership
          const { error: membershipError } = await supabase
            .from('memberships')
            .upsert({
              user_id: userId,
              organization_id: organizationId,
              role: 'admin'
            })

          if (membershipError) {
            throw new Error(`Erro ao atualizar membership: ${membershipError.message}`)
          }
        }
        break

      case UserType.COMMON_USER:
        // Remover de super_admins se necessário
        if (currentUserType === UserType.SUPER_ADMIN) {
          await supabase
            .from('super_admins')
            .update({ is_active: false })
            .eq('user_id', userId)
        }

        // Atualizar role para member se tem membership
        if (organizationId) {
          const { error: membershipError } = await supabase
            .from('memberships')
            .update({ role: 'member' })
            .eq('user_id', userId)
            .eq('organization_id', organizationId)

          if (membershipError) {
            throw new Error(`Erro ao atualizar role: ${membershipError.message}`)
          }
        }
        break
    }

    // Obter dados atualizados do usuário
    const newUserType = await accessControl.getUserType(userId)

    return NextResponse.json({
      success: true,
      userId,
      previousType: currentUserType,
      newType: newUserType,
      message: `Tipo de usuário alterado de ${currentUserType} para ${newUserType}`
    })

  } catch (error) {
    console.error('Erro ao alterar tipo de usuário:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Erro interno'
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

export const PUT = changeUserTypeHandler