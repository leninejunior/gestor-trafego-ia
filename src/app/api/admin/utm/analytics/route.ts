/**
 * API para Analytics UTM - Admin
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

    const { searchParams } = request.nextUrl
    const days = parseInt(searchParams.get('days') || '30')
    const source = searchParams.get('source') || 'all'
    const medium = searchParams.get('medium') || 'all'

    // Simular dados de analytics UTM (em produção, viria do Google Analytics ou sistema de tracking)
    let analytics = [
      {
        utm_source: 'facebook',
        utm_medium: 'cpc',
        utm_campaign: 'black_friday_2024',
        utm_term: '',
        utm_content: 'carousel_produtos',
        clicks: 12500,
        conversions: 285,
        spend: 3200,
        revenue: 14250,
        ctr: 2.8,
        conversion_rate: 2.28,
        roas: 4.45
      },
      {
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'search_brand',
        utm_term: 'marca loja online',
        utm_content: 'ad_text_1',
        clicks: 8900,
        conversions: 198,
        spend: 2100,
        revenue: 9900,
        ctr: 3.2,
        conversion_rate: 2.22,
        roas: 4.71
      },
      {
        utm_source: 'instagram',
        utm_medium: 'social',
        utm_campaign: 'stories_verao',
        utm_term: '',
        utm_content: 'story_video',
        clicks: 6700,
        conversions: 134,
        spend: 1800,
        revenue: 6700,
        ctr: 2.1,
        conversion_rate: 2.0,
        roas: 3.72
      },
      {
        utm_source: 'newsletter',
        utm_medium: 'email',
        utm_campaign: 'weekly_deals',
        utm_term: '',
        utm_content: 'header_banner',
        clicks: 4200,
        conversions: 89,
        spend: 0,
        revenue: 4450,
        ctr: 8.5,
        conversion_rate: 2.12,
        roas: 0 // Email não tem custo direto
      },
      {
        utm_source: 'linkedin',
        utm_medium: 'cpc',
        utm_campaign: 'b2b_software',
        utm_term: 'software empresarial',
        utm_content: 'sponsored_post',
        clicks: 2100,
        conversions: 45,
        spend: 1200,
        revenue: 4500,
        ctr: 1.8,
        conversion_rate: 2.14,
        roas: 3.75
      },
      {
        utm_source: 'youtube',
        utm_medium: 'video',
        utm_campaign: 'tutorial_produto',
        utm_term: '',
        utm_content: 'video_description',
        clicks: 3400,
        conversions: 67,
        spend: 800,
        revenue: 3350,
        ctr: 4.2,
        conversion_rate: 1.97,
        roas: 4.19
      },
      {
        utm_source: 'tiktok',
        utm_medium: 'social',
        utm_campaign: 'viral_challenge',
        utm_term: '',
        utm_content: 'influencer_post',
        clicks: 15600,
        conversions: 234,
        spend: 2800,
        revenue: 11700,
        ctr: 5.8,
        conversion_rate: 1.5,
        roas: 4.18
      }
    ]

    // Aplicar filtros
    if (source !== 'all') {
      analytics = analytics.filter(item => item.utm_source === source)
    }

    if (medium !== 'all') {
      analytics = analytics.filter(item => item.utm_medium === medium)
    }

    // Simular variação baseada no período
    if (days < 30) {
      analytics = analytics.map(item => ({
        ...item,
        clicks: Math.round(item.clicks * (days / 30)),
        conversions: Math.round(item.conversions * (days / 30)),
        spend: Math.round(item.spend * (days / 30) * 100) / 100,
        revenue: Math.round(item.revenue * (days / 30) * 100) / 100
      }))
    }

    return NextResponse.json({
      analytics,
      summary: {
        total_clicks: analytics.reduce((sum, item) => sum + item.clicks, 0),
        total_conversions: analytics.reduce((sum, item) => sum + item.conversions, 0),
        total_spend: analytics.reduce((sum, item) => sum + item.spend, 0),
        total_revenue: analytics.reduce((sum, item) => sum + item.revenue, 0),
        avg_ctr: analytics.length > 0 ? analytics.reduce((sum, item) => sum + item.ctr, 0) / analytics.length : 0,
        avg_conversion_rate: analytics.length > 0 ? analytics.reduce((sum, item) => sum + item.conversion_rate, 0) / analytics.length : 0
      },
      filters: {
        days,
        source,
        medium
      }
    })

  } catch (error) {
    console.error('Error fetching UTM analytics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}