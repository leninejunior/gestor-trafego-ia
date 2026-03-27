import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { UserAccessControl } from '@/lib/services/user-access-control'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MISSING_API_KEYS_TABLE_CODES = new Set(['PGRST205', '42P01'])

type ApiPermission = '*' | 'balance:read' | 'campaigns:read' | 'campaigns:write'
const ELEVATED_ROLES = new Set(['super_admin', 'owner', 'admin', 'master'])

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value)
}

function isMissingApiKeysTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const candidate = error as { code?: string; message?: string }
  if (candidate.code && MISSING_API_KEYS_TABLE_CODES.has(candidate.code)) {
    return true
  }

  const message = (candidate.message ?? '').toLowerCase()
  return message.includes('api_keys')
}

function isMissingColumnError(error: unknown, columnName: string): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const candidate = error as { code?: string; message?: string }
  if (candidate.code !== '42703') {
    return false
  }

  return (candidate.message ?? '').toLowerCase().includes(columnName.toLowerCase())
}

function normalizePermissions(input: unknown): ApiPermission[] {
  if (typeof input === 'string') {
    return normalizePermissions(
      input
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    )
  }

  if (!Array.isArray(input)) {
    return ['*']
  }

  const allowed = new Set<ApiPermission>(['*', 'balance:read', 'campaigns:read', 'campaigns:write'])
  const normalized = input
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim() as ApiPermission)
    .filter((item) => allowed.has(item))

  if (normalized.includes('*')) {
    return ['*']
  }

  return normalized.length > 0 ? Array.from(new Set(normalized)) : ['*']
}

function toIsoDateOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value !== 'string') {
    throw new Error('expires_at must be a valid ISO date string or null')
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error('expires_at must be a valid date')
  }

  return date.toISOString()
}

function createApiKeyMaterial() {
  const apiKey = `sk_${crypto.randomBytes(24).toString('hex')}`
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex')
  const keyPrefix = apiKey.slice(0, 12)
  return { apiKey, keyHash, keyPrefix }
}

function extractRoleName(value: unknown): string | null {
  if (!value) {
    return null
  }

  if (Array.isArray(value)) {
    const first = value[0]
    if (first && typeof first === 'object' && 'name' in first && typeof first.name === 'string') {
      return first.name
    }
    return null
  }

  if (typeof value === 'object' && 'name' in value && typeof value.name === 'string') {
    return value.name
  }

  return null
}

async function hasElevatedMembershipAccess(userId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('memberships')
    .select(
      `
        role,
        user_roles!memberships_role_id_fkey(name)
      `
    )
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(20)

  if (error || !Array.isArray(data)) {
    return false
  }

  return data.some((membership: any) => {
    const role = typeof membership.role === 'string' ? membership.role.toLowerCase() : ''
    const linkedRoleName = extractRoleName(membership.user_roles)?.toLowerCase() ?? ''
    return ELEVATED_ROLES.has(role) || ELEVATED_ROLES.has(linkedRoleName)
  })
}

async function requireMasterAccess() {
  const supabase = await createClient()
  const {
    data: { user },
    error
  } = await supabase.auth.getUser()

  if (error || !user) {
    return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const accessControl = new UserAccessControl()
  const [isMaster, hasElevatedMembership] = await Promise.all([
    accessControl.isMasterUser(user.id),
    hasElevatedMembershipAccess(user.id)
  ])

  if (!isMaster && !hasElevatedMembership) {
    return { ok: false as const, response: NextResponse.json({ error: 'Access denied' }, { status: 403 }) }
  }

  return { ok: true as const, user }
}

function parseApiKeyRow(row: any) {
  return {
    id: row.id,
    organization_id: row.organization_id,
    organization_name:
      row.organizations && typeof row.organizations === 'object' ? (row.organizations.name ?? null) : null,
    name: row.name,
    key_prefix: row.key_prefix,
    permissions: normalizePermissions(row.permissions),
    is_active: Boolean(row.is_active),
    last_used_at: row.last_used_at ?? null,
    expires_at: row.expires_at ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireMasterAccess()
    if (!auth.ok) {
      return auth.response
    }

    const supabase = createServiceClient()
    const organizationId = request.nextUrl.searchParams.get('organization_id')?.trim()

    let keysQuery = supabase
      .from('api_keys')
      .select(
        `
          id,
          organization_id,
          name,
          key_prefix,
          permissions,
          is_active,
          last_used_at,
          expires_at,
          created_at,
          updated_at,
          organizations(name)
        `
      )
      .order('created_at', { ascending: false })
      .limit(500)

    if (organizationId) {
      if (!isUuid(organizationId)) {
        return NextResponse.json({ error: 'organization_id must be a valid UUID' }, { status: 400 })
      }
      keysQuery = keysQuery.eq('organization_id', organizationId)
    }

    const { data: keysData, error: keysError } = await keysQuery

    if (keysError) {
      if (isMissingApiKeysTableError(keysError)) {
        return NextResponse.json(
          { error: 'api_keys table not found. Apply migration 15-create-api-v1-auth-tables.sql first.' },
          { status: 500 }
        )
      }

      throw keysError
    }

    let organizations: Array<{ id: string; name: string; is_active?: boolean }> | null = null
    let orgError: unknown = null

    const primaryOrganizationsQuery = await supabase
      .from('organizations')
      .select('id, name, is_active')
      .order('name', { ascending: true })
      .limit(1000)

    if (primaryOrganizationsQuery.error && isMissingColumnError(primaryOrganizationsQuery.error, 'is_active')) {
      const fallbackOrganizationsQuery = await supabase
        .from('organizations')
        .select('id, name')
        .order('name', { ascending: true })
        .limit(1000)

      organizations = (fallbackOrganizationsQuery.data ?? []).map((org: any) => ({
        id: org.id,
        name: org.name,
        is_active: true
      }))
      orgError = fallbackOrganizationsQuery.error
    } else {
      organizations = primaryOrganizationsQuery.data ?? []
      orgError = primaryOrganizationsQuery.error
    }

    if (orgError) {
      throw orgError
    }

    return NextResponse.json({
      success: true,
      data: {
        keys: (keysData ?? []).map(parseApiKeyRow),
        organizations: organizations ?? []
      }
    })
  } catch (error) {
    console.error('[admin/api-keys][GET] error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireMasterAccess()
    if (!auth.ok) {
      return auth.response
    }

    const body = (await request.json()) as Record<string, unknown>
    const organizationId = typeof body.organization_id === 'string' ? body.organization_id.trim() : ''
    const customName =
      typeof body.name === 'string' && body.name.trim().length > 0 ? body.name.trim().slice(0, 120) : null
    const permissions = normalizePermissions(body.permissions)
    const expiresAt = toIsoDateOrNull(body.expires_at)

    if (!organizationId || !isUuid(organizationId)) {
      return NextResponse.json({ error: 'organization_id must be a valid UUID' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', organizationId)
      .maybeSingle()

    if (orgError) {
      throw orgError
    }

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    let created:
      | {
          apiKey: string
          keyHash: string
          keyPrefix: string
        }
      | null = null
    let insertError: unknown = null

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const candidate = createApiKeyMaterial()
      const keyName = customName ?? `IA Key ${new Date().toISOString().slice(0, 10)}`

      const { error } = await supabase.from('api_keys').insert({
        organization_id: organizationId,
        name: keyName,
        key_hash: candidate.keyHash,
        key_prefix: candidate.keyPrefix,
        permissions,
        is_active: true,
        expires_at: expiresAt,
        created_by: auth.user.id
      } as never)

      if (!error) {
        created = candidate
        insertError = null
        break
      }

      insertError = error

      const duplicateKeyHash = (error as { code?: string }).code === '23505'
      if (!duplicateKeyHash) {
        break
      }
    }

    if (!created) {
      if (isMissingApiKeysTableError(insertError)) {
        return NextResponse.json(
          { error: 'api_keys table not found. Apply migration 15-create-api-v1-auth-tables.sql first.' },
          { status: 500 }
        )
      }

      const message =
        insertError && typeof insertError === 'object' && 'message' in insertError
          ? String((insertError as { message?: unknown }).message ?? 'Failed to create API key')
          : 'Failed to create API key'

      return NextResponse.json({ error: message }, { status: 500 })
    }

    const { data: inserted, error: insertedError } = await supabase
      .from('api_keys')
      .select(
        `
          id,
          organization_id,
          name,
          key_prefix,
          permissions,
          is_active,
          last_used_at,
          expires_at,
          created_at,
          updated_at,
          organizations(name)
        `
      )
      .eq('key_hash', created.keyHash)
      .maybeSingle()

    if (insertedError) {
      throw insertedError
    }

    return NextResponse.json({
      success: true,
      data: inserted ? parseApiKeyRow(inserted) : null,
      api_key: created.apiKey,
      warning: 'Store this key securely. It will not be shown again.'
    })
  } catch (error) {
    console.error('[admin/api-keys][POST] error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireMasterAccess()
    if (!auth.ok) {
      return auth.response
    }

    const body = (await request.json()) as Record<string, unknown>
    const id = typeof body.id === 'string' ? body.id.trim() : ''

    if (!id || !isUuid(id)) {
      return NextResponse.json({ error: 'id must be a valid UUID' }, { status: 400 })
    }

    const updatePayload: Record<string, unknown> = {}

    if (typeof body.name === 'string') {
      const name = body.name.trim()
      if (!name) {
        return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
      }
      updatePayload.name = name.slice(0, 120)
    }

    if (body.permissions !== undefined) {
      updatePayload.permissions = normalizePermissions(body.permissions)
    }

    if (body.is_active !== undefined) {
      if (typeof body.is_active !== 'boolean') {
        return NextResponse.json({ error: 'is_active must be boolean' }, { status: 400 })
      }
      updatePayload.is_active = body.is_active
    }

    if (body.expires_at !== undefined) {
      updatePayload.expires_at = toIsoDateOrNull(body.expires_at)
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided for update' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('api_keys')
      .update(updatePayload as never)
      .eq('id', id)
      .select(
        `
          id,
          organization_id,
          name,
          key_prefix,
          permissions,
          is_active,
          last_used_at,
          expires_at,
          created_at,
          updated_at,
          organizations(name)
        `
      )
      .maybeSingle()

    if (error) {
      if (isMissingApiKeysTableError(error)) {
        return NextResponse.json(
          { error: 'api_keys table not found. Apply migration 15-create-api-v1-auth-tables.sql first.' },
          { status: 500 }
        )
      }
      throw error
    }

    if (!data) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: parseApiKeyRow(data)
    })
  } catch (error) {
    console.error('[admin/api-keys][PATCH] error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}
