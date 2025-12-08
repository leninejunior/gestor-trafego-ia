import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/super-admin'

/**
 * Middleware que permite super admins acessarem qualquer recurso
 */
export async function superAdminMiddleware(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    
    // Verificar se é super admin
    const isSuper = await isSuperAdmin(user.id)
    
    if (isSuper) {
      // Super admin tem acesso total - adicionar header especial
      const response = NextResponse.next()
      response.headers.set('X-Super-Admin', 'true')
      response.headers.set('X-User-Id', user.id)
      return response
    }
    
    // Usuário normal - continuar com verificações normais
    return NextResponse.next()
    
  } catch (error) {
    console.error('Erro no super admin middleware:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * Função para verificar se a requisição é de um super admin
 */
export function isSuperAdminRequest(request: NextRequest): boolean {
  return request.headers.get('X-Super-Admin') === 'true'
}

/**
 * Função para obter dados sem restrições de RLS para super admins
 */
export async function getDataForSuperAdmin<T>(
  tableName: string,
  userId: string,
  selectQuery: string = '*'
): Promise<T[]> {
  const supabase = await createClient()
  
  // Verificar se é super admin
  const isSuper = await isSuperAdmin(userId)
  
  if (isSuper) {
    // Super admin - buscar todos os dados sem filtros
    const { data, error } = await supabase
      .from(tableName)
      .select(selectQuery)
    
    if (error) {
      throw new Error(`Erro ao buscar dados: ${error.message}`)
    }
    
    return data || []
  } else {
    // Usuário normal - aplicar filtros de organização
    const { data: memberships } = await supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', userId)
    
    if (!memberships || memberships.length === 0) {
      return []
    }
    
    const orgIds = memberships.map(m => m.organization_id)
    
    const { data, error } = await supabase
      .from(tableName)
      .select(selectQuery)
      .in('org_id', orgIds)
    
    if (error) {
      throw new Error(`Erro ao buscar dados: ${error.message}`)
    }
    
    return data || []
  }
}