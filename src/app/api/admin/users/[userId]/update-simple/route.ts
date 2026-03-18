import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/**
 * PUT /api/admin/users/[userId]/update-simple
 * Atualização simples de dados do usuário
 */
export async function PUT(
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

    // Validar dados de entrada
    const body = await request.json()
    console.log('📝 Dados recebidos para atualização:', body)

    // Verificar se o usuário alvo existe (usando service client)
    const { data: targetUser, error: targetUserError } = await serviceSupabase.auth.admin.getUserById(userId)
    
    if (targetUserError || !targetUser.user) {
      console.error('❌ Erro ao buscar usuário:', targetUserError)
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // Preparar dados para atualização
    const metadataUpdate: any = { ...targetUser.user.user_metadata }

    // Atualizar nome nos metadados (aceita ambos os formatos)
    const firstName = body.first_name || body.firstName || targetUser.user.user_metadata?.first_name || ''
    const lastName = body.last_name || body.lastName || targetUser.user.user_metadata?.last_name || ''
    
    if (firstName || lastName) {
      metadataUpdate.name = `${firstName} ${lastName}`.trim()
      metadataUpdate.first_name = firstName
      metadataUpdate.last_name = lastName
    }

    // Atualizar telefone nos metadados
    if (body.phone !== undefined) {
      metadataUpdate.phone = body.phone
    }

    // Preparar dados de atualização
    const updateData: any = {
      user_metadata: metadataUpdate
    }

    // Atualizar email se necessário
    if (body.email && body.email !== targetUser.user.email) {
      updateData.email = body.email
    }

    console.log('🔄 Atualizando usuário com dados:', updateData)

    // Aplicar atualizações no Auth (usando service client)
    const { error: authUpdateError } = await serviceSupabase.auth.admin.updateUserById(
      userId,
      updateData
    )

    if (authUpdateError) {
      console.error('❌ Erro ao atualizar usuário:', authUpdateError)
      return NextResponse.json(
        { error: `Erro ao atualizar dados do usuário: ${authUpdateError.message}` },
        { status: 500 }
      )
    }

    // Atualizar role na membership se especificado
    if (body.role) {
      const { error: roleUpdateError } = await supabase
        .from('memberships')
        .update({ 
          role: body.role,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (roleUpdateError) {
        console.warn('⚠️ Erro ao atualizar role:', roleUpdateError.message)
      }
    }

    // Mover usuário para outra organização se especificado
    const organizationId = body.organization_id || body.organizationId
    if (organizationId) {
      const { error: orgUpdateError } = await supabase
        .from('memberships')
        .update({ 
          organization_id: organizationId,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (orgUpdateError) {
        console.warn('⚠️ Erro ao mover usuário para nova organização:', orgUpdateError.message)
      }
    }

    console.log('✅ Usuário atualizado com sucesso')

    return NextResponse.json({
      success: true,
      message: 'Usuário atualizado com sucesso',
      user: {
        id: userId,
        email: updateData.email || targetUser.user.email,
        firstName: metadataUpdate.first_name,
        lastName: metadataUpdate.last_name,
        phone: metadataUpdate.phone
      }
    })

  } catch (error) {
    console.error('❌ Erro ao atualizar usuário:', error)
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}