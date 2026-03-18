import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { UserAccessControlService } from '@/lib/services/user-access-control'
import { UserAccessAuditService } from '@/lib/services/user-access-audit'

/**
 * GET /api/super-admin/audit-stats
 * Obter estatísticas de auditoria (apenas super admins)
 * Requirements: 7.5 - Dashboard de auditoria para super admins
 */
export async function GET(request: NextRequest) {
  try {
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
        { error: 'Acesso negado: apenas super admins podem visualizar estatísticas de auditoria' },
        { status: 403 }
      )
    }

    // Obter parâmetros de query
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || undefined
    
    // Parse dates (default to last 30 days)
    const startDate = searchParams.get('startDate') 
      ? new Date(searchParams.get('startDate')!) 
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const endDate = searchParams.get('endDate') 
      ? new Date(searchParams.get('endDate')!) 
      : new Date()

    // Buscar estatísticas
    const auditService = new UserAccessAuditService()
    const stats = await auditService.getAuditStatistics(organizationId, startDate, endDate)

    if (!stats) {
      return NextResponse.json(
        { error: 'Erro ao obter estatísticas' },
        { status: 500 }
      )
    }

    return NextResponse.json(stats)

  } catch (error) {
    console.error('Erro ao buscar estatísticas de auditoria:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}