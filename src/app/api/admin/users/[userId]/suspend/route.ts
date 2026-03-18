import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { UserAccessControlService, UserType } from '@/lib/services/user-access-control'
import { z } from 'zod'

const suspendSchema = z.object({
  reason: z.string().min(1, 'Motivo da suspensão é obrigatório')
})

/**
 * POST /api/admin/users/[userId]/suspend
 * Suspender um usuário
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
        { error: 'Usuários comuns não podem suspender outros usuários' },
        { status: 403 }
      )
    }

    // Validar dados de entrada
    const body = await request.json()
    const { reason } = suspendSchema.parse(body)

    // Verificar se o usuário alvo existe
    const { data: targetUser, error: targetUserError } = await serviceSupabase.auth.admin.getUserById(userId)
    
    if (targetUserError || !targetUser.user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // Não permitir suspender a si mesmo
    if (user.id === userId) {
      return NextResponse.json(
        { error: 'Você não pode suspender sua própria conta' },
        { status: 403 }
      )
    }

    // Verificar se está tentando suspender um super admin
    const targetUserType = await accessControl.getUserType(userId)
    if (targetUserType === UserType.SUPER_ADMIN && userType !== UserType.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Apenas super admins podem suspender outros super admins' },
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
          { error: 'Você não tem permissão para suspender este usuário' },
          { status: 403 }
        )
      }
    }

    // Verificar se o usuário já está suspenso
    const currentMetadata = targetUser.user.user_metadata || {}
    if (currentMetadata.is_suspended) {
      return NextResponse.json(
        { error: 'Usuário já está suspenso' },
        { status: 400 }
      )
    }

    // Suspender usuário atualizando os metadados
    const suspensionData = {
      is_suspended: true,
      suspended_at: new Date().toISOString(),
      suspended_by: user.id,
      suspension_reason: reason
    }

    const { error: suspendError } = await serviceSupabase.auth.admin.updateUserById(
      userId,
      {
        user_metadata: {
          ...currentMetadata,
          ...suspensionData
        }
      }
    )

    if (suspendError) {
      return NextResponse.json(
        { error: `Erro ao suspender usuário: ${suspendError.message}` },
        { status: 500 }
      )
    }

    // Log da auditoria
    await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: 'suspend_user',
        resource_type: 'user',
        resource_id: userId,
        details: {
          target_user_id: userId,
          target_user_email: targetUser.user.email,
          reason: reason,
          suspended_by: user.id,
          suspended_at: suspensionData.suspended_at
        }
      })

    return NextResponse.json({
      success: true,
      message: `Usuário ${targetUser.user.email} foi suspenso com sucesso`,
      suspension: {
        userId,
        reason,
        suspendedAt: suspensionData.suspended_at,
        suspendedBy: user.id
      }
    })

  } catch (error) {
    console.error('Erro ao suspender usuário:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Dados inválidos',
          details: error.errors
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}