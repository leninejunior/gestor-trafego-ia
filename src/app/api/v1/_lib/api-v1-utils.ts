import { NextRequest, NextResponse } from 'next/server'
import { apiAuthService } from '@/lib/api/auth-service'
import { createServiceClient } from '@/lib/supabase/server'

export type ApiV1AuthContext = {
  organizationId: string
  keyId: string
  permissions: string[]
}

export type ApiV1Warning = {
  code: string
  message: string
}

export type ResolvedDateRange = {
  dateFrom: string
  dateTo: string
  dateDefaultApplied: boolean
  warnings: ApiV1Warning[]
}

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function toDateOnly(date: Date): string {
  return date.toISOString().split('T')[0]
}

function parseDateOnly(value: string): Date | null {
  if (!isDateOnly(value)) {
    return null
  }

  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return toDateOnly(date) === value ? date : null
}

export function createApiError(
  status: number,
  code: string,
  message: string,
  details?: unknown
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details: details ?? null
      }
    },
    { status }
  )
}

export function createApiSuccess<T>(data: T, meta?: Record<string, unknown>) {
  return NextResponse.json({
    data,
    meta: {
      generated_at: new Date().toISOString(),
      ...(meta ?? {})
    }
  })
}

export async function requireApiKey(
  request: NextRequest,
  requiredPermission: string
): Promise<{ ok: true; auth: ApiV1AuthContext } | { ok: false; response: NextResponse }> {
  const auth = await apiAuthService.authenticateApiRequest(request, requiredPermission)

  if (!auth.success || !auth.data) {
    const isPermissionError = auth.error === 'Insufficient permissions'
    return {
      ok: false,
      response: createApiError(
        isPermissionError ? 403 : 401,
        isPermissionError ? 'INSUFFICIENT_PERMISSIONS' : 'INVALID_API_KEY',
        auth.error ?? 'Authentication failed'
      )
    }
  }

  return {
    ok: true,
    auth: {
      organizationId: auth.data.organizationId,
      keyId: auth.data.keyId,
      permissions: auth.data.permissions ?? []
    }
  }
}

export async function validateClientScope(clientId: string, organizationId: string) {
  const supabase = createServiceClient()
  const { data: client, error } = await supabase
    .from('clients')
    .select('id, name, organization_id')
    .eq('id', clientId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!client) {
    return {
      ok: false as const,
      response: createApiError(404, 'CLIENT_NOT_FOUND', 'Client not found')
    }
  }

  if (client.organization_id !== organizationId) {
    return {
      ok: false as const,
      response: createApiError(403, 'CLIENT_SCOPE_DENIED', 'Client does not belong to API key organization')
    }
  }

  return {
    ok: true as const,
    client
  }
}

export function resolveDateRange(searchParams: URLSearchParams): ResolvedDateRange {
  const dateFrom = searchParams.get('date_from')?.trim() ?? ''
  const dateTo = searchParams.get('date_to')?.trim() ?? ''
  const warnings: ApiV1Warning[] = []

  if (!dateFrom && !dateTo) {
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    return {
      dateFrom: toDateOnly(monthStart),
      dateTo: toDateOnly(now),
      dateDefaultApplied: true,
      warnings: [
        {
          code: 'DATE_RANGE_DEFAULTED',
          message: 'date_from/date_to were not provided. Using current month range automatically.'
        }
      ]
    }
  }

  if (!dateFrom || !dateTo) {
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    warnings.push({
      code: 'DATE_RANGE_PARTIAL_DEFAULTED',
      message: 'Incomplete date range provided. Using current month range automatically.'
    })
    return {
      dateFrom: toDateOnly(monthStart),
      dateTo: toDateOnly(now),
      dateDefaultApplied: true,
      warnings
    }
  }

  const fromParsed = parseDateOnly(dateFrom)
  const toParsed = parseDateOnly(dateTo)

  if (!fromParsed || !toParsed) {
    throw new Error('INVALID_DATE_FORMAT')
  }

  if (fromParsed.getTime() > toParsed.getTime()) {
    throw new Error('INVALID_DATE_RANGE')
  }

  return {
    dateFrom,
    dateTo,
    dateDefaultApplied: false,
    warnings
  }
}

export function parsePositiveNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'))
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }

  return null
}

export function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}
