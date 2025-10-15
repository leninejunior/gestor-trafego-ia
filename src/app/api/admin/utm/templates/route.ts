/**
 * API para Templates UTM - Admin
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verificar se é super admin
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!userRole || userRole.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Simular templates UTM (em produção, viria do banco)
    const templates = [
      {
        id: 'template_1',
        name: 'Facebook Ads - E-commerce',
        description: 'Template padrão para campanhas de e-commerce no Facebook',
        utm_source: 'facebook',
        utm_medium: 'cpc',
        utm_campaign: 'ecommerce_{{season}}',
        utm_term: '',
        utm_content: 'carousel_{{product}}',
        base_url: 'https://loja.com',
        created_at: '2024-11-01T10:00:00Z',
        usage_count: 45,
        is_active: true
      },
      {
        id: 'template_2',
        name: 'Google Ads - Lead Generation',
        description: 'Template para campanhas de geração de leads no Google',
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'leadgen_{{vertical}}',
        utm_term: '{{keyword}}',
        utm_content: 'ad_{{variation}}',
        base_url: 'https://landing.com',
        created_at: '2024-10-15T14:30:00Z',
        usage_count: 32,
        is_active: true
      },
      {
        id: 'template_3',
        name: 'Email Marketing - Newsletter',
        description: 'Template para links em newsletters',
        utm_source: 'newsletter',
        utm_medium: 'email',
        utm_campaign: 'weekly_{{week}}',
        utm_term: '',
        utm_content: '{{section}}_{{position}}',
        base_url: 'https://blog.com',
        created_at: '2024-09-20T09:15:00Z',
        usage_count: 78,
        is_active: true
      },
      {
        id: 'template_4',
        name: 'Instagram Stories - Promoção',
        description: 'Template para stories promocionais no Instagram',
        utm_source: 'instagram',
        utm_medium: 'social',
        utm_campaign: 'promo_{{month}}',
        utm_term: '',
        utm_content: 'story_{{type}}',
        base_url: 'https://promo.com',
        created_at: '2024-12-01T16:45:00Z',
        usage_count: 23,
        is_active: true
      },
      {
        id: 'template_5',
        name: 'LinkedIn Ads - B2B',
        description: 'Template para campanhas B2B no LinkedIn',
        utm_source: 'linkedin',
        utm_medium: 'cpc',
        utm_campaign: 'b2b_{{quarter}}',
        utm_term: '{{industry}}',
        utm_content: 'sponsored_{{format}}',
        base_url: 'https://b2b.com',
        created_at: '2024-08-10T11:20:00Z',
        usage_count: 19,
        is_active: false
      }
    ]

    return NextResponse.json({
      templates,
      summary: {
        total_templates: templates.length,
        active_templates: templates.filter(t => t.is_active).length,
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

    // Verificar se é super admin
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

    // Validação
    if (!name || !utm_source || !utm_medium || !utm_campaign || !base_url) {
      return NextResponse.json(
        { error: 'Missing required fields: name, utm_source, utm_medium, utm_campaign, base_url' },
        { status: 400 }
      )
    }

    // Simular criação do template (em produção, salvaria no banco)
    const newTemplate = {
      id: `template_${Date.now()}`,
      name,
      description: description || '',
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term: utm_term || '',
      utm_content: utm_content || '',
      base_url,
      created_at: new Date().toISOString(),
      usage_count: 0,
      is_active: true,
      created_by: user.id
    }

    console.log('Created UTM template:', newTemplate)

    return NextResponse.json({
      success: true,
      template: newTemplate,
      message: 'Template created successfully'
    })

  } catch (error) {
    console.error('Error creating UTM template:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}