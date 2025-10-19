import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Buscar organização específica
export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: organization, error } = await supabase
      .from('organizations')
      .select(`
        *,
        memberships (
          id,
          role,
          status,
          users (
            id,
            email
          )
        ),
        clients (count)
      `)
      .eq('id', params.orgId)
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
  { params }: { params: { orgId: string } }
) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verificar se é super admin
    const { data: membership } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', user.id)
      .single()

    const isSuperAdmin = membership?.role === 'super_admin' || user.email === 'lenine.engrene@gmail.com'

    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, slug } = body

    const { data: organization, error } = await supabase
      .from('organizations')
      .update({ name, slug })
      .eq('id', params.orgId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ organization })
  } catch (error: any) {
    console.error('Error updating organization:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Deletar organização
export async function DELETE(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verificar se é super admin
    const { data: membership } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', user.id)
      .single()

    const isSuperAdmin = membership?.role === 'super_admin' || user.email === 'lenine.engrene@gmail.com'

    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verificar se há clientes vinculados
    const { data: clients } = await supabase
      .from('clients')
      .select('id')
      .eq('org_id', params.orgId)
      .limit(1)

    if (clients && clients.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete organization with active clients' },
        { status: 400 }
      )
    }

    // Deletar memberships primeiro
    await supabase
      .from('memberships')
      .delete()
      .eq('organization_id', params.orgId)

    // Deletar organização
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', params.orgId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting organization:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
