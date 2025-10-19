import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Listar organizações
export async function GET(request: NextRequest) {
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

    // Buscar todas as organizações
    const { data: organizations, error } = await supabase
      .from('organizations')
      .select('*')
      .order('name')

    if (error) throw error

    // Buscar contagem de membros para cada organização
    const orgsWithCounts = await Promise.all(
      (organizations || []).map(async (org) => {
        const { count } = await supabase
          .from('memberships')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', org.id)
        
        return {
          ...org,
          memberships: [{ count: count || 0 }]
        }
      })
    )

    return NextResponse.json({ organizations: orgsWithCounts })
  } catch (error: any) {
    console.error('Error fetching organizations:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Criar nova organização
export async function POST(request: NextRequest) {
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

    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 })
    }

    // Criar organização
    const { data: organization, error } = await supabase
      .from('organizations')
      .insert({
        name,
        slug,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ organization }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating organization:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
