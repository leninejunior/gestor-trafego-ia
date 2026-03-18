import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/admin/users/simple-test
 * API simplificada para testar listagem de usuários
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 API /api/admin/users/simple-test called')
    
    const serviceSupabase = createServiceClient()
    
    // Buscar usuários do Auth
    const { data: authUsers, error: authUsersError } = await serviceSupabase.auth.admin.listUsers()
    
    if (authUsersError) {
      console.error('❌ Erro ao buscar usuários:', authUsersError)
      return NextResponse.json(
        { error: `Erro ao buscar usuários: ${authUsersError.message}` },
        { status: 500 }
      )
    }

    console.log('✅ Usuários encontrados:', authUsers.users.length)

    // Buscar dados das tabelas de controle de acesso
    const { data: masterUsers, error: masterError } = await serviceSupabase
      .from('master_users')
      .select('user_id')

    const { data: clientUsers, error: clientError } = await serviceSupabase
      .from('client_users')
      .select('user_id')

    console.log('📊 Master users:', masterUsers?.length || 0)
    console.log('📊 Client users:', clientUsers?.length || 0)

    const masterUserIds = new Set(masterUsers?.map(m => m.user_id) || [])
    const clientUserIds = new Set(clientUsers?.map(c => c.user_id) || [])

    // Processar usuários
    const users = authUsers.users.map(authUser => {
      let userType = 'regular'
      if (masterUserIds.has(authUser.id)) {
        userType = 'master'
      } else if (clientUserIds.has(authUser.id)) {
        userType = 'client'
      }

      const metadata = authUser.user_metadata || {}
      const fullName = metadata.name || authUser.email?.split('@')[0] || 'Usuário'
      const nameParts = fullName.split(' ')
      
      return {
        id: authUser.id,
        email: authUser.email,
        first_name: metadata.first_name || nameParts[0] || 'Usuário',
        last_name: metadata.last_name || nameParts.slice(1).join(' ') || '',
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at,
        user_type: userType,
        is_suspended: metadata.is_suspended || false,
        suspended_at: metadata.suspended_at,
        suspended_by: metadata.suspended_by,
        suspension_reason: metadata.suspension_reason,
        user_metadata: metadata,
        memberships: [{
          id: `${authUser.id}_default`,
          role: userType === 'master' ? 'admin' : 'member',
          status: 'active',
          user_type: userType,
          organizations: {
            name: 'Sistema'
          }
        }]
      }
    })

    const stats = {
      total: users.length,
      active: users.filter(u => !u.is_suspended).length,
      pending: users.filter(u => u.is_suspended).length, // Usar suspensos como "pendentes" para manter compatibilidade
      superAdmins: users.filter(u => u.user_type === 'master').length
    }

    console.log('✅ Processamento concluído:', {
      totalUsers: users.length,
      masterUsers: users.filter(u => u.user_type === 'master').length,
      clientUsers: users.filter(u => u.user_type === 'client').length,
      regularUsers: users.filter(u => u.user_type === 'regular').length
    })

    const response: any = {
      users,
      stats
    }

    // Include debug info only in development
    if (process.env.NODE_ENV === 'development') {
      response.debug = {
        timestamp: new Date().toISOString(),
        totalAuthUsers: authUsers.users.length,
        masterUsersFound: masterUsers?.length || 0,
        clientUsersFound: clientUsers?.length || 0,
        masterError: masterError?.message,
        clientError: clientError?.message
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Erro na API simple-test:', error)
    const errorResponse: any = {
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    }

    // Include debug info only in development
    if (process.env.NODE_ENV === 'development') {
      errorResponse.debug = {
        timestamp: new Date().toISOString(),
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined
      }
    }
  }
}