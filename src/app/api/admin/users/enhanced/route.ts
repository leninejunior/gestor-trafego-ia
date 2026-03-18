import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { UserAccessControlService, UserType } from '@/lib/services/user-access-control'

/**
 * GET /api/admin/users/enhanced
 * API melhorada para listagem de usuários com dados completos
 * Suporta ?userId=xxx para buscar um usuário específico
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 API /api/admin/users/enhanced called')
    
    const supabase = await createClient()
    const serviceSupabase = createServiceClient()
    
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
        { error: 'Usuários comuns não podem listar outros usuários' },
        { status: 403 }
      )
    }

    // Verificar se é busca de usuário específico
    const { searchParams } = new URL(request.url)
    const specificUserId = searchParams.get('userId')

    // Buscar todos os usuários do Auth
    const { data: authUsers, error: authUsersError } = await serviceSupabase.auth.admin.listUsers()
    
    if (authUsersError) {
      throw new Error(`Erro ao buscar usuários: ${authUsersError.message}`)
    }

    // Buscar dados complementares
    const [
      { data: superAdmins },
      { data: memberships },
      { data: organizations }
    ] = await Promise.all([
      supabase
        .from('super_admins')
        .select('user_id')
        .eq('is_active', true),
      supabase
        .from('memberships')
        .select(`
          user_id,
          role,
          organization_id,
          created_at,
          organizations!inner (
            id,
            name
          )
        `),
      supabase
        .from('organizations')
        .select('id, name')
    ])

    const superAdminIds = new Set(superAdmins?.map(sa => sa.user_id) || [])
    const orgMap = new Map(organizations?.map(org => [org.id, org.name]) || [])

    // Processar usuários com dados completos
    const users = authUsers.users.map(authUser => {
      const userMemberships = memberships?.filter(m => m.user_id === authUser.id) || []
      
      // Determinar tipo de usuário corretamente
      let displayUserType = 'regular'
      let badgeVariant = 'secondary'
      
      if (superAdminIds.has(authUser.id)) {
        displayUserType = 'master'
        badgeVariant = 'destructive'
      } else if (userMemberships.some(m => m.role === 'admin')) {
        displayUserType = 'regular'
        badgeVariant = 'default'
      } else if (userMemberships.length > 0) {
        displayUserType = 'client'
        badgeVariant = 'secondary'
      }

      // Extrair dados dos metadados
      const metadata = authUser.user_metadata || {}
      const fullName = metadata.name || authUser.email?.split('@')[0] || 'Usuário'
      const nameParts = fullName.split(' ')
      
      return {
        id: authUser.id,
        email: authUser.email,
        first_name: metadata.first_name || nameParts[0] || 'Usuário',
        last_name: metadata.last_name || nameParts.slice(1).join(' ') || '',
        phone: metadata.phone || '',
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at,
        email_confirmed_at: authUser.email_confirmed_at,
        user_type: displayUserType,
        badge_variant: badgeVariant,
        is_suspended: metadata.is_suspended || false,
        suspended_at: metadata.suspended_at,
        suspended_by: metadata.suspended_by,
        suspension_reason: metadata.suspension_reason,
        user_metadata: metadata,
        memberships: userMemberships.map(membership => ({
          id: `${membership.user_id}_${membership.organization_id}`,
          role: membership.role,
          status: 'active',
          created_at: membership.created_at || authUser.created_at,
          organizations: {
            id: membership.organization_id,
            name: membership.organizations?.name || orgMap.get(membership.organization_id) || 'Organização'
          }
        }))
      }
    })

    // Se foi solicitado um usuário específico, retornar apenas ele
    if (specificUserId) {
      const specificUser = users.find(u => u.id === specificUserId)
      
      if (!specificUser) {
        return NextResponse.json(
          { success: false, error: 'Usuário não encontrado' },
          { status: 404 }
        )
      }

      console.log('✅ Usuário específico encontrado:', specificUser.email)
      
      return NextResponse.json({
        success: true,
        user: specificUser,
        userType,
        canManageUsers: userType === UserType.SUPER_ADMIN || userType === UserType.ORG_ADMIN
      })
    }

    // Calcular estatísticas corretas
    const stats = {
      total: users.length,
      active: users.filter(u => !u.is_suspended && u.memberships.length > 0).length,
      pending: 0, // Implementar lógica de convites pendentes se necessário
      suspended: users.filter(u => u.is_suspended).length,
      superAdmins: users.filter(u => u.user_type === 'master').length
    }

    console.log('✅ Usuários processados:', users.length)
    console.log('📊 Estatísticas:', stats)

    const response: any = {
      users,
      stats,
      userType,
      canManageUsers: userType === UserType.SUPER_ADMIN || userType === UserType.ORG_ADMIN
    }

    // Include debug info only in development
    if (process.env.NODE_ENV === 'development') {
      response.debug = {
        timestamp: new Date().toISOString(),
        totalAuthUsers: authUsers.users.length,
        totalMemberships: memberships?.length || 0,
        totalSuperAdmins: superAdmins?.length || 0
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Erro na API enhanced de usuários:', error)
    const errorResponse: any = {
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    }

    // Include debug info only in development
    if (process.env.NODE_ENV === 'development') {
      errorResponse.debug = {
        timestamp: new Date().toISOString(),
        errorType: error instanceof Error ? error.constructor.name : 'Unknown'
      }
    }

    return NextResponse.json(errorResponse, { status: 500 })
  }
}