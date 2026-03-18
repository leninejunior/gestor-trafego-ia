import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { UserAccessControlService, UserType } from '@/lib/services/user-access-control'
import { z } from 'zod'

const updateUserSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').optional(),
  role: z.enum(['admin', 'member'], { 
    errorMap: () => ({ message: 'Role deve ser "admin" ou "member"' })
  }).optional(),
  isActive: z.boolean().optional()
})

/**
 * PUT /api/admin/users/[userId]/update
 * Atualizar dados de um usuário
 */
export async function PUT(
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
        { error: 'Usuários comuns não podem atualizar outros usuários' },
        { status: 403 }
      )
    }

    // Validar dados de entrada
    const body = await request.json()
    const validatedData = updateUserSchema.parse(body)

    // Verificar se o usuário alvo existe
    const { data: targetUser, error: targetUserError } = await supabase.auth.admin.getUserById(userId)
    
    if (targetUserError || !targetUser.user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // Buscar membership atual do usuário alvo
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('organization_id, role')
      .eq('user_id', userId)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Usuário não possui membership em nenhuma organização' },
        { status: 400 }
      )
    }

    // Para org admins, verificar se podem gerenciar este usuário
    if (userType === UserType.ORG_ADMIN) {
      const isOrgAdmin = await accessControl.isOrgAdmin(user.id, membership.organization_id)
      if (!isOrgAdmin) {
        return NextResponse.json(
          { error: 'Você não tem permissão para gerenciar este usuário' },
          { status: 403 }
        )
      }
    }

    // Não permitir que usuário altere a si mesmo (exceto super admin)
    if (user.id === userId && userType !== UserType.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Você não pode alterar sua própria conta' },
        { status: 403 }
      )
    }

    // Verificar se está tentando alterar um super admin
    const targetUserType = await accessControl.getUserType(userId)
    if (targetUserType === UserType.SUPER_ADMIN && userType !== UserType.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Apenas super admins podem alterar outros super admins' },
        { status: 403 }
      )
    }

    // Atualizar nome no Auth se especificado
    if (validatedData.name) {
      const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
        userId,
        {
          user_metadata: { 
            ...targetUser.user.user_metadata,
            name: validatedData.name 
          }
        }
      )

      if (authUpdateError) {
        return NextResponse.json(
          { error: `Erro ao atualizar nome: ${authUpdateError.message}` },
          { status: 500 }
        )
      }
    }

    // Atualizar role na membership se especificado
    if (validatedData.role && validatedData.role !== membership.role) {
      const { error: roleUpdateError } = await supabase
        .from('memberships')
        .update({ 
          role: validatedData.role,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (roleUpdateError) {
        return NextResponse.json(
          { error: `Erro ao atualizar role: ${roleUpdateError.message}` },
          { status: 500 }
        )
      }
    }

    // Buscar dados atualizados
    const { data: updatedUser } = await supabase.auth.admin.getUserById(userId)
    const { data: updatedMembership } = await supabase
      .from('memberships')
      .select(`
        role,
        organizations!inner (
          id,
          name
        )
      `)
      .eq('user_id', userId)
      .single()

    return NextResponse.json({
      success: true,
      message: 'Usuário atualizado com sucesso',
      user: {
        id: userId,
        email: updatedUser?.user?.email,
        name: updatedUser?.user?.user_metadata?.name,
        role: updatedMembership?.role,
        organizationId: updatedMembership?.organizations?.id,
        organizationName: updatedMembership?.organizations?.name
      }
    })

  } catch (error) {
    console.error('Erro ao atualizar usuário:', error)
    
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