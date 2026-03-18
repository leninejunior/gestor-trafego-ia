import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { UserAccessControlService, UserType } from '@/lib/services/user-access-control'
import { z } from 'zod'

const updateCompleteSchema = z.object({
  firstName: z.string().min(1, 'Nome é obrigatório').optional(),
  lastName: z.string().optional(),
  email: z.string().email('Email inválido').optional(),
  phone: z.string().optional(),
  role: z.enum(['admin', 'member'], { 
    errorMap: () => ({ message: 'Role deve ser "admin" ou "member"' })
  }).optional(),
  organizationId: z.string().uuid('ID da organização inválido').optional(),
  userType: z.enum(['master', 'regular', 'client'], {
    errorMap: () => ({ message: 'Tipo de usuário deve ser "master", "regular" ou "client"' })
  }).optional()
})

/**
 * PUT /api/admin/users/[userId]/update-complete
 * Atualização completa de dados do usuário
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = await createClient()
    const serviceSupabase = createServiceClient()
    const { userId } = await params
    
    console.log('🔧 API update-complete chamada para userId:', userId)
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Autenticação necessária' },
        { status: 401 }
      )
    }

    // Verificar tipo de usuário atual
    const accessControl = new UserAccessControlService()
    const currentUserType = await accessControl.getUserType(user.id)
    
    // Apenas super admins podem atualizar outros usuários
    if (currentUserType !== UserType.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Apenas usuários Master podem atualizar outros usuários' },
        { status: 403 }
      )
    }

    // Validar dados de entrada
    const body = await request.json()
    console.log('📦 Dados recebidos:', body)
    const validatedData = updateCompleteSchema.parse(body)
    console.log('✅ Dados validados:', validatedData)

    // Verificar se o usuário alvo existe
    const { data: targetUser, error: targetUserError } = await serviceSupabase.auth.admin.getUserById(userId)
    
    if (targetUserError || !targetUser.user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // Buscar membership atual do usuário alvo
    const { data: membership, error: membershipError } = await serviceSupabase
      .from('memberships')
      .select('organization_id, role, user_type')
      .eq('user_id', userId)
      .single()

    console.log('👤 Membership encontrada:', membership)

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Usuário não possui membership em nenhuma organização' },
        { status: 400 }
      )
    }

    // Verificar se está tentando alterar um usuário master
    const targetUserType = await accessControl.getUserType(userId)
    if (targetUserType === UserType.SUPER_ADMIN && currentUserType !== UserType.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Apenas usuários Master podem alterar outros usuários Master' },
        { status: 403 }
      )
    }

    // Verificar se email já existe (se está sendo alterado)
    if (validatedData.email && validatedData.email !== targetUser.user.email) {
      const { data: existingUsers } = await serviceSupabase.auth.admin.listUsers()
      const emailExists = existingUsers.users.some(u => u.email === validatedData.email && u.id !== userId)
      
      if (emailExists) {
        return NextResponse.json(
          { error: 'Este email já está em uso por outro usuário' },
          { status: 409 }
        )
      }
    }

    // Preparar dados para atualização
    const updateData: any = {}
    const metadataUpdate: any = { ...targetUser.user.user_metadata }

    // Atualizar nome nos metadados
    if (validatedData.firstName !== undefined || validatedData.lastName !== undefined) {
      const firstName = validatedData.firstName || targetUser.user.user_metadata?.first_name || ''
      const lastName = validatedData.lastName || targetUser.user.user_metadata?.last_name || ''
      metadataUpdate.name = `${firstName} ${lastName}`.trim()
      metadataUpdate.first_name = firstName
      metadataUpdate.last_name = lastName
    }

    // Atualizar telefone nos metadados
    if (validatedData.phone !== undefined) {
      metadataUpdate.phone = validatedData.phone
    }

    // Atualizar email se necessário
    if (validatedData.email && validatedData.email !== targetUser.user.email) {
      updateData.email = validatedData.email
    }

    // Aplicar atualizações no Auth se houver mudanças
    if (Object.keys(updateData).length > 0 || Object.keys(metadataUpdate).length > 0) {
      const authUpdateData: any = { ...updateData }
      if (Object.keys(metadataUpdate).length > 0) {
        authUpdateData.user_metadata = metadataUpdate
      }

      console.log('🔄 Atualizando Auth com:', authUpdateData)

      const { error: authUpdateError } = await serviceSupabase.auth.admin.updateUserById(
        userId,
        authUpdateData
      )

      if (authUpdateError) {
        return NextResponse.json(
          { error: `Erro ao atualizar dados do usuário: ${authUpdateError.message}` },
          { status: 500 }
        )
      }
    }

    // Atualizar role na membership se especificado
    if (validatedData.role && validatedData.role !== membership.role) {
      console.log('🔄 Atualizando role de', membership.role, 'para', validatedData.role)
      const { error: roleUpdateError } = await serviceSupabase
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

    // Atualizar tipo de usuário se especificado
    if (validatedData.userType && validatedData.userType !== membership.user_type) {
      console.log('🔄 Atualizando user_type de', membership.user_type, 'para', validatedData.userType)
      // Atualizar na tabela memberships
      const { error: userTypeUpdateError } = await serviceSupabase
        .from('memberships')
        .update({ 
          user_type: validatedData.userType,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (userTypeUpdateError) {
        return NextResponse.json(
          { error: `Erro ao atualizar tipo de usuário: ${userTypeUpdateError.message}` },
          { status: 500 }
        )
      }

      // Se mudando para master, adicionar na tabela master_users
      if (validatedData.userType === 'master') {
        console.log('👑 Adicionando usuário como master')
        const { error: masterUserError } = await serviceSupabase
          .from('master_users')
          .upsert({
            user_id: userId,
            created_by: user.id,
            is_active: true,
            notes: `Promovido a Master por ${user.email} em ${new Date().toISOString()}`
          })

        if (masterUserError) {
          console.error('Erro ao adicionar master user:', masterUserError)
        }
      }

      // Se mudando para client, adicionar na tabela client_users
      if (validatedData.userType === 'client' && membership.organization_id) {
        console.log('👤 Adicionando usuário como client')
        // Buscar primeiro cliente da organização
        const { data: firstClient } = await serviceSupabase
          .from('clients')
          .select('id')
          .eq('org_id', membership.organization_id)
          .limit(1)
          .single()

        if (firstClient) {
          const { error: clientUserError } = await serviceSupabase
            .from('client_users')
            .upsert({
              user_id: userId,
              client_id: firstClient.id,
              created_by: user.id,
              is_active: true,
              notes: `Convertido para usuário cliente por ${user.email} em ${new Date().toISOString()}`
            })

          if (clientUserError) {
            console.error('Erro ao adicionar client user:', clientUserError)
          }
        }
      }
    }
    if (validatedData.organizationId && validatedData.organizationId !== membership.organization_id) {
      console.log('🏢 Mudando organização de', membership.organization_id, 'para', validatedData.organizationId)
      // Verificar se a nova organização existe
      const { data: newOrg, error: newOrgError } = await serviceSupabase
        .from('organizations')
        .select('id, name')
        .eq('id', validatedData.organizationId)
        .single()

      if (newOrgError || !newOrg) {
        console.error('❌ Erro ao buscar organização:', newOrgError)
        return NextResponse.json(
          { error: 'Nova organização não encontrada' },
          { status: 404 }
        )
      }
      
      console.log('✅ Organização encontrada:', newOrg.name)

      // Para org admins, verificar se podem adicionar usuários na nova organização
      // (Removido pois agora apenas masters podem atualizar usuários)

      // Atualizar organização na membership
      const { error: orgUpdateError } = await serviceSupabase
        .from('memberships')
        .update({ 
          organization_id: validatedData.organizationId,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (orgUpdateError) {
        console.error('❌ Erro ao atualizar organização:', orgUpdateError)
        return NextResponse.json(
          { error: `Erro ao mover usuário para nova organização: ${orgUpdateError.message}` },
          { status: 500 }
        )
      }
      
      console.log('✅ Organização atualizada com sucesso')
    }

    // Buscar dados atualizados
    console.log('🔄 Buscando dados atualizados...')
    const { data: updatedUser } = await serviceSupabase.auth.admin.getUserById(userId)
    const { data: updatedMembership } = await serviceSupabase
      .from('memberships')
      .select(`
        role,
        user_type,
        organizations (
          id,
          name
        )
      `)
      .eq('user_id', userId)
      .single()

    console.log('✅ Usuário atualizado com sucesso!')
    console.log('📊 Dados finais:', {
      email: updatedUser?.user?.email,
      role: updatedMembership?.role,
      userType: updatedMembership?.user_type,
      org: (updatedMembership?.organizations as any)?.name
    })

    return NextResponse.json({
      success: true,
      message: 'Usuário atualizado com sucesso',
      user: {
        id: userId,
        email: updatedUser?.user?.email,
        firstName: updatedUser?.user?.user_metadata?.first_name,
        lastName: updatedUser?.user?.user_metadata?.last_name,
        phone: updatedUser?.user?.user_metadata?.phone,
        role: updatedMembership?.role,
        userType: updatedMembership?.user_type,
        organizationId: (updatedMembership?.organizations as any)?.id,
        organizationName: (updatedMembership?.organizations as any)?.name
      }
    })

  } catch (error) {
    console.error('Erro ao atualizar usuário completo:', error)
    
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