import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { UserAccessControlService } from '@/lib/services/user-access-control'
import { UserAccessAuditService, AuditEventType, AuditEventCategory } from '@/lib/services/user-access-audit'

/**
 * GET /api/super-admin/audit-logs
 * Buscar logs de auditoria (apenas super admins)
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
        { error: 'Acesso negado: apenas super admins podem visualizar logs de auditoria' },
        { status: 403 }
      )
    }

    // Obter parâmetros de query
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId') || undefined
    const actorUserId = searchParams.get('actorUserId') || undefined
    const targetUserId = searchParams.get('targetUserId') || undefined
    const eventType = searchParams.get('eventType') as AuditEventType | undefined
    const eventCategory = searchParams.get('eventCategory') as AuditEventCategory | undefined
    const success = searchParams.get('success') ? searchParams.get('success') === 'true' : undefined
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0
    
    // Parse dates
    const startDate = searchParams.get('startDate') 
      ? new Date(searchParams.get('startDate')!) 
      : undefined
    const endDate = searchParams.get('endDate') 
      ? new Date(searchParams.get('endDate')!) 
      : undefined

    // Buscar logs
    const auditService = new UserAccessAuditService()
    const logs = await auditService.getAuditLogs({
      organizationId,
      actorUserId,
      targetUserId,
      eventType,
      eventCategory,
      startDate,
      endDate,
      success,
      limit,
      offset
    })

    return NextResponse.json({
      logs,
      pagination: {
        limit,
        offset,
        total: logs.length
      }
    })

  } catch (error) {
    console.error('Erro ao buscar logs de auditoria:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
