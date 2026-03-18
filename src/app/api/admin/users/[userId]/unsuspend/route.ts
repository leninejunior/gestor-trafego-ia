import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { UserAccessControlService, UserType } from '@/lib/services/user-access-control'

/**
 * POST /api/admin/users/[userId]/unsuspend
 * Reativar um usuário suspenso
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = await createClient()
    const serviceSupabase = createServiceClient()
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
        { error: 'Usuários comuns não podem reativar outros usuários' },
        { status: 403 }
      )
    }

    // Verificar se o usuário alvo existe
    const { data: targetUser, error: targetUserError } = await serviceSupabase.auth.admin.getUserById(userId)
    
    if (targetUserError || !targetUser.user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se está tentando reativar um super admin
    const targetUserType = await accessControl.getUserType(userId)
    if (targetUserType === UserType.SUPER_ADMIN && userType !== UserType.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Apenas super admins podem reativar outros super admins' },
        { status: 403 }
      )
    }

    // Buscar membership do usuário alvo para verificar permissões
    const { data: membership } = await supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', userId)
      .single()

    // Para org admins, verificar se podem gerenciar este usuário
    if (userType === UserType.ORG_ADMIN && membership) {
      const isOrgAdmin = await accessControl.isOrgAdmin(user.id, membership.organization_id)
      if (!isOrgAdmin) {
        return NextResponse.json(
          { error: 'Você não tem permissão para reativar este usuário' },
          { status: 403 }
        )
      }
    }

    // Verificar se o usuário está realmente suspenso
    const currentMetadata = targetUser.user.user_metadata || {}
    console.log('📋 Metadados atuais:', currentMetadata)
    console.log('🔍 is_suspended:', currentMetadata.is_suspended)
    
    if (!currentMetadata.is_suspended) {
      return NextResponse.json(
        { error: 'Usuário não está suspenso' },
        { status: 400 }
      )
    }

    // Reativar usuário removendo dados de suspensão dos metadados
    const { 
      is_suspended, 
      suspended_at, 
      suspended_by, 
      suspension_reason, 
      ...cleanMetadata 
    } = currentMetadata

    const reactivationData = {
      ...cleanMetadata,
      is_suspended: false,
      reactivated_at: new Date().toISOString(),
      reactivated_by: user.id
    }

    console.log('🔄 Dados de reativação:', reactivationData)

    const { error: unsuspendError } = await serviceSupabase.auth.admin.updateUserById(
      userId,
      {
        user_metadata: reactivationData
      }
    )

    if (unsuspendError) {
      console.error('❌ Erro ao reativar:', unsuspendError)
      return NextResponse.json(
        { error: `Erro ao reativar usuário: ${unsuspendError.message}` },
        { status: 500 }
      )
    }

    console.log('✅ Usuário reativado com sucesso')

    // Log da auditoria
    await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: 'unsuspend_user',
        resource_type: 'user',
        resource_id: userId,
        details: {
          target_user_id: userId,
          target_user_email: targetUser.user.email,
          reactivated_by: user.id,
          reactivated_at: reactivationData.reactivated_at,
          previous_suspension: {
            reason: suspension_reason,
            suspended_at: suspended_at,
            suspended_by: suspended_by
          }
        }
      })

    return NextResponse.json({
      success: true,
      message: `Usuário ${targetUser.user.email} foi reativado com sucesso`,
      reactivation: {
        userId,
        reactivatedAt: reactivationData.reactivated_at,
        reactivatedBy: user.id
      }
    })

  } catch (error) {
    console.error('Erro ao reativar usuário:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}