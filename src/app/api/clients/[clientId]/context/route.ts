import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const contextPayloadSchema = z.object({
  companyOverview: z.string().max(8000).optional(),
  productsServices: z.string().max(8000).optional(),
  targetAudience: z.string().max(8000).optional(),
  valueProps: z.string().max(8000).optional(),
  brandVoice: z.string().max(8000).optional(),
  constraints: z.string().max(8000).optional(),
  offers: z.string().max(8000).optional(),
  notes: z.string().max(12000).optional()
})

type AccessContext = {
  organizationId: string
  clientName: string
  isSuperAdmin: boolean
}

async function resolveClientAccess(userId: string, email: string | null, clientId: string): Promise<AccessContext | null> {
  const supabase = await createClient()
  const service = createServiceClient()

  const { data: memberships } = await supabase
    .from('memberships')
    .select('organization_id, role')
    .eq('user_id', userId)
    .eq('status', 'active')

  const membershipRows = Array.isArray(memberships) ? memberships : []
  const isSuperAdmin =
    email === 'lenine.engrene@gmail.com' ||
    membershipRows.some((membership) => {
      const role = typeof membership.role === 'string' ? membership.role : ''
      return role === 'super_admin' || role.includes('super_admin')
    })

  const { data: client, error: clientError } = await service
    .from('clients')
    .select('id, name, org_id')
    .eq('id', clientId)
    .single()

  if (clientError || !client) return null
  const organizationId = typeof client.org_id === 'string' ? client.org_id : ''
  if (!organizationId) return null

  if (!isSuperAdmin) {
    const hasOrgAccess = membershipRows.some(
      (membership) => membership.organization_id === organizationId
    )
    if (!hasOrgAccess) return null
  }

  return {
    organizationId,
    clientName: typeof client.name === 'string' ? client.name : 'Cliente',
    isSuperAdmin
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await context.params
    const supabase = await createClient()
    const service = createServiceClient()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const access = await resolveClientAccess(user.id, user.email ?? null, clientId)
    if (!access) {
      return NextResponse.json({ error: 'Client not found or access denied' }, { status: 404 })
    }

    const { data } = await service
      .schema('campaign_squad')
      .from('client_contexts')
      .select('id, company_overview, products_services, target_audience, value_props, brand_voice, constraints, offers, notes, updated_at')
      .eq('organization_id', access.organizationId)
      .eq('client_id', clientId)
      .maybeSingle()

    return NextResponse.json({
      clientId,
      clientName: access.clientName,
      organizationId: access.organizationId,
      context: {
        id: data?.id || null,
        companyOverview: data?.company_overview || '',
        productsServices: data?.products_services || '',
        targetAudience: data?.target_audience || '',
        valueProps: data?.value_props || '',
        brandVoice: data?.brand_voice || '',
        constraints: data?.constraints || '',
        offers: data?.offers || '',
        notes: data?.notes || '',
        updatedAt: data?.updated_at || null
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await context.params
    const supabase = await createClient()
    const service = createServiceClient()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const access = await resolveClientAccess(user.id, user.email ?? null, clientId)
    if (!access) {
      return NextResponse.json({ error: 'Client not found or access denied' }, { status: 404 })
    }

    const payload = contextPayloadSchema.parse(await request.json())
    const upsertPayload = {
      organization_id: access.organizationId,
      client_id: clientId,
      company_overview: payload.companyOverview || '',
      products_services: payload.productsServices || '',
      target_audience: payload.targetAudience || '',
      value_props: payload.valueProps || '',
      brand_voice: payload.brandVoice || '',
      constraints: payload.constraints || '',
      offers: payload.offers || '',
      notes: payload.notes || ''
    }

    const { data, error } = await service
      .schema('campaign_squad')
      .from('client_contexts')
      .upsert(upsertPayload, { onConflict: 'organization_id,client_id' })
      .select('id, company_overview, products_services, target_audience, value_props, brand_voice, constraints, offers, notes, updated_at')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      clientId,
      clientName: access.clientName,
      organizationId: access.organizationId,
      context: {
        id: data.id,
        companyOverview: data.company_overview || '',
        productsServices: data.products_services || '',
        targetAudience: data.target_audience || '',
        valueProps: data.value_props || '',
        brandVoice: data.brand_voice || '',
        constraints: data.constraints || '',
        offers: data.offers || '',
        notes: data.notes || '',
        updatedAt: data.updated_at || null
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid payload' }, { status: 400 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    )
  }
}
