import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { UserAccessControlService, UserType } from '@/lib/services/user-access-control'

/**
 * GET /api/admin/organizations
 * Lista organizações disponíveis para admins
 */
export async function GET(request: NextRequest) {
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

    // Verificar tipo de usuário
    const accessControl = new UserAccessControlService()
    const userType = await accessControl.getUserType(user.id)
    
    if (userType === UserType.COMMON_USER) {
      return NextResponse.json(
        { error: 'Usuários comuns não podem listar organizações' },
        { status: 403 }
      )
    }

    let organizations = []

    if (userType === UserType.SUPER_ADMIN) {
      // Super admins veem todas as organizações
      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('id, name')
        .order('name')

      if (orgsError) {
        console.error('❌ Erro ao buscar organizações:', orgsError)
        throw new Error(`Erro ao buscar organizações: ${orgsError.message}`)
      }

      organizations = orgs || []
    } else if (userType === UserType.ORG_ADMIN) {
      // Org admins veem apenas suas organizações
      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select(`
          id,
          name,
          memberships!inner (
            user_id
          )
        `)
        .eq('memberships.user_id', user.id)
        .eq('memberships.role', 'admin')
        .order('name')

      if (orgsError) {
        throw new Error(`Erro ao buscar organizações: ${orgsError.message}`)
      }

      organizations = orgs?.map(org => ({
        id: org.id,
        name: org.name
      })) || []
    }

    return NextResponse.json({
      organizations,
      userType,
      canManageAllOrgs: userType === UserType.SUPER_ADMIN
    })

  } catch (error) {
    console.error('Erro ao listar organizações:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}