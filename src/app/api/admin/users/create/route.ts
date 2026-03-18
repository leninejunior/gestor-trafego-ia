import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { UserAccessControlService, UserType } from '@/lib/services/user-access-control'
import { z } from 'zod'

const createUserSchema = z.object({
  email: z.string().email('Email inválido'),
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  role: z.enum(['admin', 'member'], { 
    errorMap: () => ({ message: 'Role deve ser "admin" ou "member"' })
  }),
  organizationId: z.string().uuid('ID da organização inválido').optional()
})

/**
 * POST /api/admin/users/create
 * Criar novo usuário com validação completa
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

    // Verificar tipo de usuário
    const accessControl = new UserAccessControlService()
    const userType = await accessControl.getUserType(user.id)
    
    if (userType === UserType.COMMON_USER) {
      return NextResponse.json(
        { error: 'Usuários comuns não podem criar outros usuários' },
        { status: 403 }
      )
    }

    // Validar dados de entrada
    const body = await request.json()
    const validatedData = createUserSchema.parse(body)

    // Para org admins, organizationId é obrigatório e deve ser da sua organização
    let targetOrgId = validatedData.organizationId
    
    if (userType === UserType.ORG_ADMIN) {
      if (!targetOrgId) {
        // Buscar organização do admin
        const { data: membership } = await supabase
          .from('memberships')
          .select('organization_id')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .single()
        
        if (!membership) {
          return NextResponse.json(
            { error: 'Admin deve pertencer a uma organização' },
            { status: 400 }
          )
        }
        
        targetOrgId = membership.organization_id
      } else {
        // Verificar se o admin tem permissão nesta organização
        const isOrgAdmin = await accessControl.isOrgAdmin(user.id, targetOrgId)
        if (!isOrgAdmin) {
          return NextResponse.json(
            { error: 'Você não tem permissão para criar usuários nesta organização' },
            { status: 403 }
          )
        }
      }
    }

    // Para super admins, se não especificaram org, usar a primeira disponível
    if (userType === UserType.SUPER_ADMIN && !targetOrgId) {
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id')
        .eq('is_active', true)
        .limit(1)

      if (orgs && orgs.length > 0) {
        targetOrgId = orgs[0].id
      } else {
        return NextResponse.json(
          { error: 'Nenhuma organização ativa encontrada' },
          { status: 400 }
        )
      }
    }

    if (!targetOrgId) {
      return NextResponse.json(
        { error: 'ID da organização é obrigatório' },
        { status: 400 }
      )
    }

    // Validar se a organização existe e está ativa
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, is_active')
      .eq('id', targetOrgId)
      .single()

    if (orgError || !organization || !organization.is_active) {
      return NextResponse.json(
        { error: 'Organização não encontrada ou inativa' },
        { status: 404 }
      )
    }

    // Verificar se email já existe
    const { data: existingUser } = await supabase.auth.admin.listUsers()
    const emailExists = existingUser.users.some(u => u.email === validatedData.email)
    
    if (emailExists) {
      return NextResponse.json(
        { error: 'Email já está em uso' },
        { status: 409 }
      )
    }

    // Validar limites do plano para org admins
    if (userType === UserType.ORG_ADMIN) {
      const limitValidation = await accessControl.validateActionAgainstLimits(
        targetOrgId,
        'create_user'
      )
      
      if (!limitValidation.valid) {
        return NextResponse.json(
          { 
            error: limitValidation.reason || 'Limite de usuários atingido',
            details: {
              currentUsage: limitValidation.currentUsage,
              limit: limitValidation.limit
            }
          },
          { status: 400 }
        )
      }
    }

    // Criar usuário no Supabase Auth
    const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
      email: validatedData.email,
      email_confirm: true,
      user_metadata: {
        name: validatedData.name
      }
    })

    if (createError || !authUser.user) {
      return NextResponse.json(
        { error: `Erro ao criar usuário: ${createError?.message}` },
        { status: 500 }
      )
    }

    // Criar membership na organização
    const { error: membershipError } = await supabase
      .from('memberships')
      .insert({
        user_id: authUser.user.id,
        organization_id: targetOrgId,
        role: validatedData.role,
        created_by: user.id
      })

    if (membershipError) {
      // Rollback: deletar usuário criado
      await supabase.auth.admin.deleteUser(authUser.user.id)
      return NextResponse.json(
        { error: `Erro ao criar membership: ${membershipError.message}` },
        { status: 500 }
      )
    }

    // Retornar sucesso
    return NextResponse.json({
      success: true,
      message: `Usuário ${validatedData.name} criado com sucesso na organização ${organization.name}`,
      user: {
        id: authUser.user.id,
        email: validatedData.email,
        name: validatedData.name,
        role: validatedData.role,
        organizationId: targetOrgId,
        organizationName: organization.name
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Erro ao criar usuário:', error)
    
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