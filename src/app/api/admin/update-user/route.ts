import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/admin/update-user
 * Atualização simples de usuário
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
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
    const { userId, firstName, lastName, role, organizationId } = body
    
    console.log('📝 Atualizando usuário:', { userId, firstName, lastName, role, organizationId })

    if (!userId) {
      return NextResponse.json(
        { error: 'ID do usuário é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar se o usuário alvo existe no Auth
    const { data: targetUser, error: targetUserError } = await supabase.auth.admin.getUserById(userId)
    
    if (targetUserError) {
      console.error('❌ Erro ao buscar usuário no Auth:', targetUserError)
      return NextResponse.json(
        { 
          error: 'Usuário não encontrado no sistema de autenticação',
          details: targetUserError.message,
          suggestion: 'Este usuário pode ter sido criado incorretamente. Contate o administrador.'
        },
        { status: 404 }
      )
    }
    
    if (!targetUser.user) {
      console.error('❌ Usuário não existe no Auth:', userId)
      return NextResponse.json(
        { 
          error: 'Usuário não encontrado no sistema de autenticação',
          userId: userId,
          suggestion: 'Este usuário existe no banco de dados mas não no sistema de autenticação. Contate o administrador.'
        },
        { status: 404 }
      )
    }

    console.log('✅ Usuário encontrado no Auth:', targetUser.user.email)

    // Preparar dados para atualização
    const currentMetadata = targetUser.user.user_metadata || {}
    const updatedMetadata = { ...currentMetadata }

    // Atualizar nome nos metadados
    if (firstName !== undefined || lastName !== undefined) {
      const newFirstName = firstName || currentMetadata.first_name || ''
      const newLastName = lastName || currentMetadata.last_name || ''
      
      updatedMetadata.first_name = newFirstName
      updatedMetadata.last_name = newLastName
      updatedMetadata.name = `${newFirstName} ${newLastName}`.trim()
    }

    console.log('🔄 Atualizando metadados:', updatedMetadata)

    // Atualizar usuário no Auth
    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
      userId,
      {
        user_metadata: updatedMetadata
      }
    )

    if (authUpdateError) {
      console.error('❌ Erro ao atualizar usuário no Auth:', authUpdateError)
      return NextResponse.json(
        { 
          error: `Erro ao atualizar usuário: ${authUpdateError.message}`,
          details: authUpdateError
        },
        { status: 500 }
      )
    }

    console.log('✅ Metadados atualizados no Auth')

    // Atualizar role na membership se especificado
    if (role) {
      console.log('🔄 Atualizando role para:', role)
      const { error: roleUpdateError } = await supabase
        .from('memberships')
        .update({ 
          role: role,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (roleUpdateError) {
        console.warn('⚠️ Erro ao atualizar role:', roleUpdateError.message)
        // Não falhar por causa da role, apenas avisar
      } else {
        console.log('✅ Role atualizada para:', role)
      }
    }

    // Mover usuário para outra organização se especificado
    if (organizationId) {
      console.log('🔄 Movendo usuário para organização:', organizationId)
      const { error: orgUpdateError } = await supabase
        .from('memberships')
        .update({ 
          organization_id: organizationId,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (orgUpdateError) {
        console.warn('⚠️ Erro ao mover usuário para nova organização:', orgUpdateError.message)
        // Não falhar por causa da organização, apenas avisar
      } else {
        console.log('✅ Organização atualizada para:', organizationId)
      }
    }

    console.log('✅ Usuário atualizado com sucesso')

    return NextResponse.json({
      success: true,
      message: 'Usuário atualizado com sucesso',
      user: {
        id: userId,
        firstName: updatedMetadata.first_name,
        lastName: updatedMetadata.last_name,
        name: updatedMetadata.name
      }
    })

  } catch (error) {
    console.error('❌ Erro ao atualizar usuário:', error)
    
    // Melhor tratamento de erro
    let errorMessage = 'Erro interno do servidor'
    let errorDetails = null
    
    if (error instanceof Error) {
      errorMessage = error.message
      errorDetails = error.stack
    } else if (typeof error === 'string') {
      errorMessage = error
    } else if (error && typeof error === 'object') {
      errorMessage = 'Erro desconhecido'
      errorDetails = JSON.stringify(error)
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorDetails,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}