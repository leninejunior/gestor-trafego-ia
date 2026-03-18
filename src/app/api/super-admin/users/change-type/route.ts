import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { UserAccessControlService, UserType } from '@/lib/services/user-access-control'

export const dynamic = 'force-dynamic'

/**
 * POST /api/super-admin/users/change-type
 * Altera o tipo de um usuário (apenas para super admins)
 * Requirements: 7.4
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    // Verificar se é super admin
    const accessControl = new UserAccessControlService()
    const isSuperAdmin = await accessControl.isSuperAdmin(user.id)
    
    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: 'Acesso negado: apenas super admins podem alterar tipos de usuário' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { targetUserId, newType, adminUserId } = body

    // Validar campos obrigatórios
    if (!targetUserId || !newType) {
      return NextResponse.json(
        { error: 'Campos targetUserId e newType são obrigatórios' },
        { status: 400 }
      )
    }

    // Validar tipo de usuário
    if (!Object.values(UserType).includes(newType)) {
      return NextResponse.json(
        { error: 'Tipo de usuário inválido' },
        { status: 400 }
      )
    }

    // Não permitir que o usuário altere seu próprio tipo
    if (targetUserId === user.id) {
      return NextResponse.json(
        { error: 'Você não pode alterar seu próprio tipo de usuário' },
        { status: 400 }
      )
    }

    // Verificar se o usuário alvo existe
    const { data: targetUser, error: targetUserError } = await supabase.auth.admin.getUserById(targetUserId)
    if (targetUserError || !targetUser.user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // Obter tipo atual do usuário
    const currentType = await accessControl.getUserType(targetUserId)

    // Se já é do tipo desejado, não fazer nada
    if (currentType === newType) {
      return NextResponse.json({
        success: true,
        message: 'Usuário já possui o tipo especificado',
        currentType,
        newType
      })
    }

    let operationDetails = ''
    let success = true
    let errorMessage = ''

    try {
      // Executar mudança baseada no tipo desejado
      switch (newType) {
        case UserType.SUPER_ADMIN:
          // Adicionar à tabela super_admins
          const { error: superAdminError } = await supabase
            .from('super_admins')
            .upsert({
              user_id: targetUserId,
              created_by: user.id,
              is_active: true,
              notes: `Promovido a super admin por ${user.email}`
            })

          if (superAdminError) throw superAdminError
          operationDetails = `Usuário promovido a Super Admin`
          break

        case UserType.ORG_ADMIN:
          // Remover de super_admins se existir
          if (currentType === UserType.SUPER_ADMIN) {
            await supabase
              .from('super_admins')
              .update({ is_active: false })
              .eq('user_id', targetUserId)
          }

          // Atualizar role nas memberships para admin
          const { error: membershipError } = await supabase
            .from('memberships')
            .update({ role: 'admin' })
            .eq('user_id', targetUserId)

          if (membershipError) throw membershipError
          operationDetails = `Usuário alterado para Admin de Organização`
          break

        case UserType.COMMON_USER:
          // Remover de super_admins se existir
          if (currentType === UserType.SUPER_ADMIN) {
            await supabase
              .from('super_admins')
              .update({ is_active: false })
              .eq('user_id', targetUserId)
          }

          // Atualizar role nas memberships para member
          const { error: commonUserError } = await supabase
            .from('memberships')
            .update({ role: 'member' })
            .eq('user_id', targetUserId)

          if (commonUserError) throw commonUserError
          operationDetails = `Usuário alterado para Usuário Comum`
          break

        default:
          throw new Error('Tipo de usuário não suportado')
      }

    } catch (error) {
      success = false
      errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      console.error('Erro ao alterar tipo de usuário:', error)
    }

    // Registrar log de auditoria
    try {
      await fetch(`${request.nextUrl.origin}/api/super-admin/audit-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'change_user_type',
          targetUserId,
          organizationId: null, // Cross-org operation
          details: `${operationDetails}. Tipo anterior: ${currentType}, Novo tipo: ${newType}`,
          success,
          errorMessage
        })
      })
    } catch (auditError) {
      console.error('Erro ao registrar log de auditoria:', auditError)
    }

    if (!success) {
      return NextResponse.json(
        { error: `Erro ao alterar tipo de usuário: ${errorMessage}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Tipo de usuário alterado com sucesso',
      previousType: currentType,
      newType,
      targetUserId,
      details: operationDetails
    })

  } catch (error) {
    console.error('Erro na API de alteração de tipo de usuário:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}