import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import crypto from 'crypto'

interface ApiKeyValidation {
  isValid: boolean
  organizationId?: string
  permissions?: string[]
  keyId?: string
}

type EnvApiKeyConfig = {
  key: string
  organizationId: string
  permissions: string[]
  keyId: string
}

const MISSING_API_KEYS_TABLE_CODES = new Set(['PGRST205', '42P01'])
let warnedMissingApiKeysTable = false

function parsePermissions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return ['*']
  }

  const normalized = value
    .filter((item) => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim())

  return normalized.length > 0 ? normalized : ['*']
}

function parseFallbackPermissionsFromEnv(): string[] {
  const raw = process.env.API_V1_FALLBACK_PERMISSIONS
  if (!raw) {
    return ['*']
  }

  const permissions = raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

  return permissions.length > 0 ? permissions : ['*']
}

function parseApiV1KeysJson(rawJson: string): unknown {
  try {
    return JSON.parse(rawJson)
  } catch {
    // Accept shell-friendly object notation, e.g. [{key:sk_x,organizationId:org,permissions:[*]}]
    const normalized = rawJson
      .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
      .replace(/:\s*\[\s*\*\s*\]/g, ':["*"]')
      .replace(/:\s*([A-Za-z0-9_.-]+)/g, ':"$1"')

    return JSON.parse(normalized)
  }
}

function getEnvApiKeyConfigs(): EnvApiKeyConfig[] {
  const configs: EnvApiKeyConfig[] = []

  const rawJson = process.env.API_V1_KEYS_JSON?.trim()
  if (rawJson) {
    try {
      const parsed = parseApiV1KeysJson(rawJson)
      if (Array.isArray(parsed)) {
        parsed.forEach((item, index) => {
          if (!item || typeof item !== 'object') {
            return
          }

          const key = typeof item.key === 'string' ? item.key.trim() : ''
          const organizationId =
            typeof item.organizationId === 'string' ? item.organizationId.trim() : ''

          if (!key || !organizationId) {
            return
          }

          configs.push({
            key,
            organizationId,
            permissions: parsePermissions((item as { permissions?: unknown }).permissions),
            keyId:
              typeof item.keyId === 'string' && item.keyId.trim().length > 0
                ? item.keyId.trim()
                : `env_json_${index}`
          })
        })
      }
    } catch {
      console.error('[ApiAuthService] Invalid API_V1_KEYS_JSON format')
    }
  }

  const fallbackKey = process.env.API_V1_FALLBACK_KEY?.trim()
  const fallbackOrganizationId = process.env.API_V1_FALLBACK_ORGANIZATION_ID?.trim()
  if (fallbackKey && fallbackOrganizationId) {
    configs.push({
      key: fallbackKey,
      organizationId: fallbackOrganizationId,
      permissions: parseFallbackPermissionsFromEnv(),
      keyId: 'env_fallback'
    })
  }

  return configs
}

function isMissingApiKeysTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const code = (error as { code?: string }).code
  if (code && MISSING_API_KEYS_TABLE_CODES.has(code)) {
    return true
  }

  const message = (error as { message?: string }).message ?? ''
  return typeof message === 'string' && message.toLowerCase().includes('api_keys')
}

export class ApiAuthService {
  private validateApiKeyFromEnv(apiKey: string): ApiKeyValidation | null {
    const config = getEnvApiKeyConfigs().find((item) => item.key === apiKey)
    if (!config) {
      return null
    }

    return {
      isValid: true,
      organizationId: config.organizationId,
      permissions: config.permissions,
      keyId: `env:${config.keyId}`
    }
  }

  async validateApiKey(request: NextRequest): Promise<ApiKeyValidation> {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { isValid: false }
    }

    const apiKey = authHeader.replace('Bearer ', '')

    if (!apiKey.startsWith('sk_')) {
      return { isValid: false }
    }

    const envValidation = this.validateApiKeyFromEnv(apiKey)
    if (envValidation) {
      return envValidation
    }

    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex')
    const supabase = createServiceClient()

    try {
      const { data: keyData, error } = await supabase
        .from('api_keys')
        .select('id, organization_id, permissions, is_active, expires_at')
        .eq('key_hash', keyHash)
        .single()

      if (error) {
        if (isMissingApiKeysTableError(error) && !warnedMissingApiKeysTable) {
          warnedMissingApiKeysTable = true
          console.warn(
            '[ApiAuthService] api_keys table is unavailable. Configure API_V1_KEYS_JSON or API_V1_FALLBACK_* env vars.'
          )
        }
        return { isValid: false }
      }

      if (!keyData) {
        return { isValid: false }
      }

      if (!keyData.is_active) {
        return { isValid: false }
      }

      if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
        return { isValid: false }
      }

      await supabase
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

  hasPermission(permissions: string[], requiredPermission: string): boolean {
    return permissions.includes('*') || permissions.includes(requiredPermission)
  }

  async logApiUsage(
    keyId: string,
    organizationId: string,
    request: NextRequest,
    statusCode: number,
    responseTimeMs: number
  ): Promise<void> {
    if (keyId.startsWith('env:')) {
      return
    }

    try {
      const supabase = createServiceClient()
      const { error } = await supabase
        .from('api_usage_logs')
        .insert({
          api_key_id: keyId,
          organization_id: organizationId,
          endpoint: request.nextUrl.pathname,
          method: request.method,
          status_code: statusCode,
          response_time_ms: responseTimeMs,
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          user_agent: request.headers.get('user-agent')
        })

      if (error && !isMissingApiKeysTableError(error)) {
        console.error('Error logging API usage:', error)
      }
    } catch (error) {
      console.error('Error logging API usage:', error)
    }
  }

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

      if (requiredPermission && !this.hasPermission(validation.permissions || [], requiredPermission)) {
        return { success: false, error: 'Insufficient permissions' }
      }

      const responseTime = Date.now() - startTime
      await this.logApiUsage(
        validation.keyId || 'unknown',
        validation.organizationId || 'unknown',
        request,
        200,
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

export const apiAuthService = new ApiAuthService()
