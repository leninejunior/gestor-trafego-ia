/**
 * Iugu Connectivity Health Check API
 * 
 * Endpoint específico para verificação detalhada da conectividade com Iugu
 * Requirements: 8.4 - Testes de conectividade com Iugu
 */

import { NextRequest, NextResponse } from 'next/server'

interface IuguHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  response_time_ms: number
  api_status: {
    ping: boolean
    authentication: boolean
    rate_limits: {
      remaining?: number
      reset_time?: string
    }
  }
  configuration: {
    api_token_configured: boolean
    account_id_configured: boolean
    webhook_url_configured: boolean
  }
  endpoints_tested: string[]
  error?: string
  timestamp: string
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const result: IuguHealthCheck = {
    status: 'healthy',
    response_time_ms: 0,
    api_status: {
      ping: false,
      authentication: false,
      rate_limits: {}
    },
    configuration: {
      api_token_configured: !!process.env.IUGU_API_TOKEN,
      account_id_configured: !!process.env.IUGU_ACCOUNT_ID,
      webhook_url_configured: !!process.env.IUGU_WEBHOOK_URL
    },
    endpoints_tested: [],
    timestamp: new Date().toISOString()
  }

  try {
    const { searchParams } = new URL(request.url)
    const detailed = searchParams.get('detailed') === 'true'

    // Teste 1: Ping básico da API
    try {
      const pingResponse = await fetch('https://api.iugu.com/v1/ping', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'HealthCheck/1.0'
        },
        signal: AbortSignal.timeout(10000)
      })

      result.endpoints_tested.push('ping')
      result.api_status.ping = pingResponse.ok

      if (!pingResponse.ok) {
        result.status = 'degraded'
        result.error = `Ping failed: HTTP ${pingResponse.status}`
      }
    } catch (error) {
      result.api_status.ping = false
      result.status = 'unhealthy'
      result.error = `Ping failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }

    // Teste 2: Autenticação (se token estiver configurado)
    if (process.env.IUGU_API_TOKEN && detailed) {
      try {
        const authResponse = await fetch('https://api.iugu.com/v1/account', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${process.env.IUGU_API_TOKEN}`,
            'User-Agent': 'HealthCheck/1.0'
          },
          signal: AbortSignal.timeout(10000)
        })

        result.endpoints_tested.push('account')
        result.api_status.authentication = authResponse.ok

        // Verificar rate limits nos headers
        const rateLimitRemaining = authResponse.headers.get('X-RateLimit-Remaining')
        const rateLimitReset = authResponse.headers.get('X-RateLimit-Reset')

        if (rateLimitRemaining) {
          result.api_status.rate_limits.remaining = parseInt(rateLimitRemaining)
        }
        if (rateLimitReset) {
          result.api_status.rate_limits.reset_time = new Date(parseInt(rateLimitReset) * 1000).toISOString()
        }

        if (!authResponse.ok) {
          if (authResponse.status === 401) {
            result.status = 'unhealthy'
            result.error = 'Authentication failed: Invalid API token'
          } else if (authResponse.status === 429) {
            result.status = 'degraded'
            result.error = 'Rate limit exceeded'
          } else {
            result.status = 'degraded'
            result.error = `Authentication test failed: HTTP ${authResponse.status}`
          }
        }
      } catch (error) {
        result.api_status.authentication = false
        if (result.status !== 'unhealthy') {
          result.status = 'degraded'
        }
        result.error = result.error || `Auth test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }

    // Teste 3: Verificar webhook endpoint (se configurado)
    if (process.env.IUGU_WEBHOOK_URL && detailed) {
      try {
        const webhookUrl = new URL(process.env.IUGU_WEBHOOK_URL)
        
        // Verificar se o webhook endpoint está acessível
        const webhookResponse = await fetch(webhookUrl.toString(), {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000)
        })

        result.endpoints_tested.push('webhook')

        // Webhook deve retornar 405 (Method Not Allowed) para HEAD, o que indica que está funcionando
        if (webhookResponse.status !== 405 && !webhookResponse.ok) {
          result.status = 'degraded'
          result.error = result.error || `Webhook endpoint not accessible: HTTP ${webhookResponse.status}`
        }
      } catch (error) {
        if (result.status !== 'unhealthy') {
          result.status = 'degraded'
        }
        result.error = result.error || `Webhook test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }

    result.response_time_ms = Date.now() - startTime

    // Determinar status final baseado na configuração
    if (!result.configuration.api_token_configured) {
      result.status = 'degraded'
      result.error = result.error || 'Iugu API token not configured'
    }

    const statusCode = result.status === 'unhealthy' ? 503 : 200

    return NextResponse.json(result, {
      status: statusCode,
      headers: {
        'X-Iugu-Status': result.status,
        'X-Response-Time': result.response_time_ms.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })

  } catch (error) {
    result.status = 'unhealthy'
    result.response_time_ms = Date.now() - startTime
    result.error = error instanceof Error ? error.message : 'Iugu health check failed'

    return NextResponse.json(result, {
      status: 503,
      headers: {
        'X-Iugu-Status': 'unhealthy'
      }
    })
  }
}

// Endpoint para teste rápido de conectividade
export async function HEAD(request: NextRequest) {
  try {
    const response = await fetch('https://api.iugu.com/v1/ping', {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    })

    const status = response.ok ? 'healthy' : 'degraded'
    const statusCode = response.ok ? 200 : 503

    return new NextResponse(null, {
      status: statusCode,
      headers: {
        'X-Iugu-Status': status,
        'X-Iugu-Response-Code': response.status.toString()
      }
    })
  } catch (error) {
    return new NextResponse(null, {
      status: 503,
      headers: {
        'X-Iugu-Status': 'unhealthy'
      }
    })
  }
}