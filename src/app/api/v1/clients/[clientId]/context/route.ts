import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  createApiError,
  createApiSuccess,
  requireApiKey,
  validateClientScope
} from '@/app/api/v1/_lib/api-v1-utils'

const MISSING_CONTEXT_CODES = new Set(['42P01', '3F000'])

function isMissingContextStorageError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const candidate = error as { code?: string; message?: string }
  if (candidate.code && MISSING_CONTEXT_CODES.has(candidate.code)) {
    return true
  }

  const message = (candidate.message ?? '').toLowerCase()
  return message.includes('campaign_squad') || message.includes('client_contexts')
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const authResult = await requireApiKey(request, 'campaigns:read')
  if (authResult.ok === false) {
    return authResult.response
  }

  const { clientId } = await params
  const normalizedClientId = clientId?.trim()

  if (!normalizedClientId) {
    return createApiError(400, 'MISSING_CLIENT_ID', 'Path parameter clientId is required')
  }

  try {
    const scopedClient = await validateClientScope(normalizedClientId, authResult.auth.organizationId)
    if (!scopedClient.ok) {
      return scopedClient.response
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .schema('campaign_squad')
      .from('client_contexts')
      .select(
        'id, company_overview, products_services, target_audience, value_props, brand_voice, constraints, offers, notes, updated_at'
      )
      .eq('organization_id', authResult.auth.organizationId)
      .eq('client_id', normalizedClientId)
      .maybeSingle()

    if (error) {
      if (isMissingContextStorageError(error)) {
        return createApiError(
          500,
          'CLIENT_CONTEXT_UNAVAILABLE',
          'Client context storage is unavailable. Apply campaign_squad migrations.'
        )
      }

      console.error('[v1/clients/:id/context] fetch error:', error)
      return createApiError(500, 'CLIENT_CONTEXT_FETCH_FAILED', 'Failed to fetch client context')
    }

    return createApiSuccess(
      {
        client_id: normalizedClientId,
        client_name: scopedClient.client.name ?? null,
        organization_id: authResult.auth.organizationId,
        context: {
          id: data?.id ?? null,
          company_overview: data?.company_overview ?? '',
          products_services: data?.products_services ?? '',
          target_audience: data?.target_audience ?? '',
          value_props: data?.value_props ?? '',
          brand_voice: data?.brand_voice ?? '',
          constraints: data?.constraints ?? '',
          offers: data?.offers ?? '',
          notes: data?.notes ?? '',
          updated_at: data?.updated_at ?? null
        }
      },
      { warnings: [] }
    )
  } catch (error) {
    console.error('[v1/clients/:id/context] unexpected error:', error)
    return createApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error')
  }
}
