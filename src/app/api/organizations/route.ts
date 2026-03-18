import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/super-admin'

// GET - Listar organizações (apenas super admins podem ver todas)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verificar se é super admin
    const isSuper = await isSuperAdmin(user.id)

    if (!isSuper) {
      return NextResponse.json({ error: 'Acesso negado: apenas super administradores podem listar todas as organizações' }, { status: 403 })
    }

    // Usar service client para garantir acesso total às organizações
    const serviceSupabase = createServiceClient()
    
    const { data: organizations, error } = await serviceSupabase
      .from('organizations')
      .select('*')
      .order('name')

    if (error) throw error

    // Buscar contagem de membros para cada organização
    const orgsWithCounts = await Promise.all(
      (organizations || []).map(async (org) => {
        const { count } = await serviceSupabase
          .from('memberships')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', org.id)
        
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

// POST - Criar nova organização (apenas super admins)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verificar se é super admin
    const isSuper = await isSuperAdmin(user.id)

    if (!isSuper) {
      return NextResponse.json({ error: 'Acesso negado: apenas super administradores podem criar organizações' }, { status: 403 })
    }

    const body = await request.json()
    const { name } = body

    if (!name) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    // Criar organização
    const { data: organization, error } = await supabase
      .from('organizations')
      .insert({ name })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ organization }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating organization:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
