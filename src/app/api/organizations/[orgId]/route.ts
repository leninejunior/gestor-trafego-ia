import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Buscar organização específica
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orgId } = await params

    const { data: organization, error } = await supabase
      .from('organizations')
      .select(`
        *,
        memberships (
          id,
          role,
          user_id
        ),
        clients (count)
      `)
      .eq('id', orgId)
      .single()

    if (error) throw error

    return NextResponse.json({ organization })
  } catch (error: any) {
    console.error('Error fetching organization:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Atualizar organização
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orgId } = await params

    // Verificar se o usuário tem permissão (super_admin ou admin da organização)
    const { data: membership } = await supabase
      .from('organization_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .single()

    // Super admin tem permissão total
    const isSuperAdmin = membership?.role === 'super_admin' || user.email === 'lenine.engrene@gmail.com'
    const isAdmin = membership?.role === 'admin'
    
    const hasPermission = isSuperAdmin || isAdmin

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden - Você não tem permissão para editar esta organização' }, { status: 403 })
    }

    const body = await request.json()
    // Only extract name field from request body
    const { name } = body

    // Comprehensive input validation for name field
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ 
        error: 'Nome é obrigatório e deve ser uma string válida' 
      }, { status: 400 })
    }

    const trimmedName = name.trim()
    
    if (trimmedName.length === 0) {
      return NextResponse.json({ 
        error: 'Nome não pode estar vazio' 
      }, { status: 400 })
    }

    if (trimmedName.length > 100) {
      return NextResponse.json({ 
        error: 'Nome deve ter no máximo 100 caracteres' 
      }, { status: 400 })
    }

    // Update only the name field in database
    // Usar cliente normal - as políticas RLS devem permitir super_admin
    const { data: organization, error } = await supabase
      .from('organizations')
      .update({ name: trimmedName })
      .eq('id', orgId)
      .select()
      .single()

    if (error) {
      console.error('Database error updating organization:', error)
      return NextResponse.json({ 
        error: 'Erro interno do servidor ao atualizar organização' 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      organization,
      message: 'Organização atualizada com sucesso'
    })
  } catch (error: any) {
    console.error('Error updating organization:', error)
    
    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      return NextResponse.json({ 
        error: 'Dados inválidos fornecidos' 
      }, { status: 400 })
    }
    
    // Handle database-specific errors
    if (error.code === 'PGRST116') {
      return NextResponse.json({ 
        error: 'Organização não encontrada' 
      }, { status: 404 })
    }
    
    if (error.code === '23505') {
      return NextResponse.json({ 
        error: 'Nome da organização já existe' 
      }, { status: 409 })
    }
    
    // Generic server error
    return NextResponse.json({ 
      error: 'Erro interno do servidor' 
    }, { status: 500 })
  }
}

// DELETE - Deletar organização
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orgId } = await params

    // Verificar se é super_admin da organização
    const { data: membership } = await supabase
      .from('organization_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .single()

    const isSuperAdmin = membership?.role === 'super_admin' || user.email === 'lenine.engrene@gmail.com'

    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden - Apenas super admin pode deletar organizações' }, { status: 403 })
    }

    // Verificar se há clientes vinculados
    const { data: clients } = await supabase
      .from('clients')
      .select('id')
      .eq('organization_id', orgId)
      .limit(1)

    if (clients && clients.length > 0) {
      return NextResponse.json(
        { error: 'Não é possível deletar organização com clientes ativos' },
        { status: 400 }
      )
    }

    // Deletar membros primeiro
    await supabase
      .from('organization_memberships')
      .delete()
      .eq('org_id', orgId)

    // Deletar organização
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', orgId)

    if (error) throw error

    return NextResponse.json({ 
      success: true,
      message: 'Organização deletada com sucesso'
    })
  } catch (error: any) {
    console.error('Error deleting organization:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
