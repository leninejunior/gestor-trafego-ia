/**
 * Dependencies Health Check API
 * 
 * Endpoint específico para verificação de dependências externas
 * Requirements: 8.4 - Verificações de dependências externas
 */

import { NextRequest, NextResponse } from 'next/server'
import HealthCheckService from '@/lib/monitoring/health-check-service'

const healthCheckService = new HealthCheckService()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dependency = searchParams.get('service')

    // Se um serviço específico foi solicitado
    if (dependency) {
      let result
      
      switch (dependency.toLowerCase()) {
        case 'database':
          result = await healthCheckService.checkDatabase()
          break
        case 'iugu':
          result = await healthCheckService.checkIuguConnectivity()
          break
        case 'email':
          result = await healthCheckService.checkEmailService()
          break
        case 'redis':
          result = await healthCheckService.checkRedisCache()
          break
        default:
          return NextResponse.json({
            error: 'Unknown dependency',
            available_services: ['database', 'iugu', 'email', 'redis']
          }, { status: 400 })
      }

      const statusCode = result.status === 'unhealthy' ? 503 : 200

      return NextResponse.json({
        service: dependency,
        status: result.status,
        response_time_ms: result.response_time_ms,
        message: result.error || 'OK',
        details: result.details,
        timestamp: result.timestamp.toISOString()
      }, {
        status: statusCode,
        headers: {
          'X-Service-Status': result.status,
          'X-Response-Time': result.response_time_ms.toString()
        }
      })
    }

    // Verificar todas as dependências externas
    const checks = await Promise.all([
      healthCheckService.checkDatabase(),
      healthCheckService.checkIuguConnectivity(),
      healthCheckService.checkEmailService(),
      healthCheckService.checkRedisCache()
    ])

    const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length
    const degradedCount = checks.filter(c => c.status === 'degraded').length
    
    const overallStatus = unhealthyCount > 0 ? 'unhealthy' :
                         degradedCount > 0 ? 'degraded' : 'healthy'

    const statusCode = overallStatus === 'unhealthy' ? 503 : 200

    return NextResponse.json({
      overall_status: overallStatus,
      dependencies: checks.map(check => ({
        name: check.component,
        status: check.status,
        response_time_ms: check.response_time_ms,
        message: check.error || 'OK',
        details: check.details,
        last_checked: check.timestamp.toISOString()
      })),
      summary: {
        total: checks.length,
        healthy: checks.filter(c => c.status === 'healthy').length,
        degraded: degradedCount,
        unhealthy: unhealthyCount
      },
      timestamp: new Date().toISOString()
    }, {
      status: statusCode,
      headers: {
        'X-Dependencies-Status': overallStatus,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })

  } catch (error) {
    console.error('Dependencies health check failed:', error)
    
    return NextResponse.json({
      overall_status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Dependencies check failed',
      timestamp: new Date().toISOString()
    }, {
      status: 503,
      headers: {
        'X-Dependencies-Status': 'unhealthy'
      }
    })
  }
}