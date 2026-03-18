import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { UserAccessControlService } from '@/lib/services/user-access-control'
import { userManagementService } from '@/lib/services/user-management'

export const dynamic = 'force-dynamic'

/**
 * GET /api/super-admin/organizations/[organizationId]/users
 * Lista usuários de uma organização específica (apenas para super admins)
 * Requirements: 7.1, 7.2
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  try {
    const { organizationId } = await params
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
        { error: 'Acesso negado: apenas super admins podem acessar esta funcionalidade' },
        { status: 403 }
      )
    }

    // Verificar se a organização existe
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, is_active')
      .eq('id', organizationId)
      .single()

    if (orgError || !organization) {
      return NextResponse.json(
        { error: 'Organização não encontrada' },
        { status: 404 }
      )
    }

    // Listar usuários da organização
    const users = await userManagementService.listOrganizationUsers(user.id, organizationId)

    return NextResponse.json({
      users,
      organization: {
        id: organization.id,
        name: organization.name,
        isActive: organization.is_active
      },
      total: users.length
    })

  } catch (error) {
    console.error('Erro na API de usuários da organização:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}