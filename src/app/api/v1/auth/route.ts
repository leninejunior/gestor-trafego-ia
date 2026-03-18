/**
 * API Pública v1 - Autenticação
 * Middleware para validar API keys
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

interface ApiKeyValidation {
  isValid: boolean
  organizationId?: string
  permissions?: string[]
  keyId?: string
}

class ApiAuthService {
  private supabase = createClient()

  /**
   * Valida API key do header Authorization
   */
  async validateApiKey(request: NextRequest): Promise<ApiKeyValidation> {
    const authHeader = request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { isValid: false }
    }

    const apiKey = authHeader.replace('Bearer ', '')
    
    if (!apiKey.startsWith('sk_')) {
      return { isValid: false }
    }

    // Hash da chave para busca no banco
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex')

    try {
      const { data: keyData, error } = await this.supabase
        .from('api_keys')
        .select('id, organization_id, permissions, is_active, expires_at')
        .eq('key_hash', keyHash)
        .single()

      if (error || !keyData) {
        return { isValid: false }
      }

      // Verificar se a chave está ativa
      if (!keyData.is_active) {
        return { isValid: false }
      }

      // Verificar expiração
      if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
        return { isValid: false }
      }

      // Atualizar último uso
      await this.supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', keyData.id)

      return {
        isValid: true,
        organizationId: keyData.organization_id,
        permissions: keyData.permissions || [],
        keyId: keyData.id
      }
    } catch (error) {
      console.error('Error validating API key:', error)
      return { isValid: false }
    }
  }

  /**
   * Verifica se a API key tem uma permissão específica
   */
  hasPermission(permissions: string[], requiredPermission: string): boolean {
    return permissions.includes('*') || permissions.includes(requiredPermission)
  }

  /**
   * Registra uso da API
   */
  async logApiUsage(
    keyId: string,
    organizationId: string,
    request: NextRequest,
    statusCode: number,
    responseTimeMs: number,
    requestSize?: number,
    responseSize?: number
  ): Promise<void> {
    try {
      await this.supabase
        .from('api_usage_logs')
        .insert({
          api_key_id: keyId,
          organization_id: organizationId,
          endpoint: request.nextUrl.pathname,
          method: request.method,
          status_code: statusCode,
          response_time_ms: responseTimeMs,
          request_size_bytes: requestSize,
          response_size_bytes: responseSize,
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          user_agent: request.headers.get('user-agent')
        })
    } catch (error) {
      console.error('Error logging API usage:', error)
    }
  }

  /**
   * Middleware para autenticação de API
   */
  async authenticateApiRequest(
    request: NextRequest,
    requiredPermission?: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const startTime = Date.now()
    
    try {
      const validation = await this.validateApiKey(request)
      
      if (!validation.isValid) {
        return { success: false, error: 'Invalid API key' }
      }

      if (requiredPermission && !this.hasPermission(validation.permissions!, requiredPermission)) {
        return { success: false, error: 'Insufficient permissions' }
      }

      // Log da requisição (será completado no response)
      const responseTime = Date.now() - startTime
      await this.logApiUsage(
        validation.keyId!,
        validation.organizationId!,
        request,
        200, // Será atualizado depois
        responseTime
      )

      return {
        success: true,
        data: {
          organizationId: validation.organizationId,
          permissions: validation.permissions,
          keyId: validation.keyId
        }
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Authentication failed' 
      }
    }
  }
}

// Instância singleton
const apiAuthService = new ApiAuthService()

/**
 * Endpoint para testar autenticação
 */
export async function GET(request: NextRequest) {
  const auth = await apiAuthService.authenticateApiRequest(request)
  
  if (!auth.success) {
    return NextResponse.json(
      { error: auth.error },
      { status: 401 }
    )
  }

  return NextResponse.json({
    message: 'Authentication successful',
    organizationId: auth.data?.organizationId,
    permissions: auth.data?.permissions
  })
}