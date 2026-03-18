import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { UserManagementService, CreateUserData } from '@/lib/services/user-management'
import { UserAccessControlService, UserType } from '@/lib/services/user-access-control'
import { requireSuperAdmin } from '@/lib/middleware/user-access-middleware'

/**
 * POST /api/super-admin/users
 * Criar usuários em qualquer organização (Requirements 7.1)
 */
async function createUserHandler(request: NextRequest) {
  try {
    const supabase = await createClient()
    const userManagement = new UserManagementService()
    
    // Obter dados do request
    const body = await request.json()
    const { email, name, role, organizationId } = body

    // Validar dados obrigatórios
    if (!email || !name || !organizationId) {
      return NextResponse.json(
        { error: 'Email, nome e organizationId são obrigatórios' },
        { status: 400 }
      )
    }

    if (!['admin', 'member'].includes(role)) {
      return NextResponse.json(
        { error: 'Role deve ser "admin" ou "member"' },
        { status: 400 }
      )
    }

    // Obter usuário atual
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Autenticação necessária' },
        { status: 401 }
      )
    }

    // Verificar se é super admin
    const accessControl = new UserAccessControlService()
    const isSuperAdmin = await accessControl.isSuperAdmin(user.id)
    
    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: 'Acesso restrito a Super Admins' },
        { status: 403 }
      )
    }

    // Validar se a organização existe
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

    if (!organization.is_active) {
      return NextResponse.json(
        { error: 'Organização está inativa' },
        { status: 400 }
      )
    }

    // Criar usuário
    const userData: CreateUserData = {
      email,
      name,
      role,
      organizationId
    }

    const newUser = await userManagement.createUser(user.id, userData)

    return NextResponse.json({
      success: true,
      user: newUser,
      message: `Usuário criado com sucesso na organização ${organization.name}`
    })

  } catch (error) {
    console.error('Erro ao criar usuário (super admin):', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Erro interno'
    const statusCode = errorMessage.includes('já existe') ? 409 : 500
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
  }
}

export const POST = createUserHandler