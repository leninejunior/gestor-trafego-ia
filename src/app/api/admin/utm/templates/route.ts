/**
 * API para Templates UTM - Admin
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function isMissingTableError(message?: string): boolean {
  if (!message) {
    return false
  }
  return message.includes('does not exist') || message.includes('relation "smart_utms" does not exist')
}

function extractBaseUrl(fullUrl: string): string {
  try {
    const parsed = new URL(fullUrl)
    return `${parsed.origin}${parsed.pathname}`
  } catch {
    return fullUrl
  }
}

function buildUtmUrl(baseUrl: string, params: Record<string, string>): string {
  const url = new URL(baseUrl)

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value)
    }
  })

  return url.toString()
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!userRole || userRole.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error: templatesError } = await supabase
      .from('smart_utms')
      .select('id,campaign_name,utm_source,utm_medium,utm_campaign,utm_term,utm_content,full_url,created_at,clicks,is_active')
      .order('created_at', { ascending: false })

    if (templatesError) {
      if (isMissingTableError(templatesError.message)) {
        return NextResponse.json({
          templates: [],
          summary: {
            total_templates: 0,
            active_templates: 0,
            total_usage: 0
          },
          message: 'Tabela smart_utms não encontrada; sem templates reais para exibir'
        })
      }

      return NextResponse.json(
        { error: `Failed to fetch UTM templates: ${templatesError.message}` },
        { status: 500 }
      )
    }

    const templates = (data || []).map((item: any) => ({
      id: item.id,
      name: item.campaign_name || item.utm_campaign || 'Template sem nome',
      description: '',
      utm_source: item.utm_source,
      utm_medium: item.utm_medium,
      utm_campaign: item.utm_campaign,
      utm_term: item.utm_term || '',
      utm_content: item.utm_content || '',
      base_url: extractBaseUrl(item.full_url || ''),
      created_at: item.created_at,
      usage_count: Number.parseInt(item.clicks || 0, 10) || 0,
      is_active: Boolean(item.is_active)
    }))

    return NextResponse.json({
      templates,
      summary: {
        total_templates: templates.length,
        active_templates: templates.filter((t) => t.is_active).length,
        total_usage: templates.reduce((sum, t) => sum + t.usage_count, 0)
      }
    })
  } catch (error) {
    console.error('Error fetching UTM templates:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!userRole || userRole.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      description,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term,
      utm_content,
      base_url
    } = body

    if (!name || !utm_source || !utm_medium || !utm_campaign || !base_url) {
      return NextResponse.json(
        { error: 'Missing required fields: name, utm_source, utm_medium, utm_campaign, base_url' },
        { status: 400 }
      )
    }

    let orgId: string | null = null
    const { data: membership } = await supabase
      .from('memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (membership?.org_id) {
      orgId = membership.org_id
    }

    let fullUrl: string
    try {
      fullUrl = buildUtmUrl(base_url, {
        utm_source,
        utm_medium,
        utm_campaign,
        utm_term: utm_term || '',
        utm_content: utm_content || ''
      })
    } catch {
      return NextResponse.json(
        { error: 'Invalid base_url' },
        { status: 400 }
      )
    }

    const { data: inserted, error: insertError } = await supabase
      .from('smart_utms')
      .insert({
        user_id: user.id,
        organization_id: orgId,
        campaign_name: name,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_term: utm_term || null,
        utm_content: utm_content || null,
        full_url: fullUrl,
        is_active: true
      })
      .select('id,campaign_name,utm_source,utm_medium,utm_campaign,utm_term,utm_content,full_url,created_at,clicks,is_active')
      .single()

    if (insertError) {
      if (isMissingTableError(insertError.message)) {
        return NextResponse.json(
          {
            error: 'Tabela smart_utms não encontrada; criação de template UTM indisponível',
            code: 'NOT_IMPLEMENTED'
          },
          { status: 501 }
        )
      }

      return NextResponse.json(
        { error: `Failed to create UTM template: ${insertError.message}` },
        { status: 500 }
      )
    }

    const template = {
      id: inserted.id,
      name: inserted.campaign_name || inserted.utm_campaign || name,
      description: description || '',
      utm_source: inserted.utm_source,
      utm_medium: inserted.utm_medium,
      utm_campaign: inserted.utm_campaign,
      utm_term: inserted.utm_term || '',
      utm_content: inserted.utm_content || '',
      base_url: extractBaseUrl(inserted.full_url || base_url),
      created_at: inserted.created_at,
      usage_count: Number.parseInt(inserted.clicks || 0, 10) || 0,
      is_active: Boolean(inserted.is_active)
    }

    return NextResponse.json({
      success: true,
      template,
      message: 'Template created successfully'
    })
  } catch (error) {
    console.error('Error creating UTM template:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
