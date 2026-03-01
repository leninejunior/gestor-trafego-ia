/**
 * API para Analytics UTM - Admin
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function isMissingTableError(message?: string): boolean {
  if (!message) {
    return false
  }
  return message.includes('does not exist') || message.includes('relation "smart_utms" does not exist')
}

export async function GET(request: NextRequest) {
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

    const { searchParams } = request.nextUrl
    const parsedDays = Number.parseInt(searchParams.get('days') || '30', 10)
    const days = Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : 30
    const source = searchParams.get('source') || 'all'
    const medium = searchParams.get('medium') || 'all'

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    let query = supabase
      .from('smart_utms')
      .select('utm_source,utm_medium,utm_campaign,utm_term,utm_content,clicks,conversions,revenue,created_at')
      .gte('created_at', startDate.toISOString())

    if (source !== 'all') {
      query = query.eq('utm_source', source)
    }

    if (medium !== 'all') {
      query = query.eq('utm_medium', medium)
    }

    const { data, error: analyticsError } = await query

    if (analyticsError) {
      if (isMissingTableError(analyticsError.message)) {
        return NextResponse.json({
          analytics: [],
          summary: {
            total_clicks: 0,
            total_conversions: 0,
            total_spend: 0,
            total_revenue: 0,
            avg_ctr: 0,
            avg_conversion_rate: 0
          },
          filters: { days, source, medium },
          message: 'Tabela smart_utms não encontrada; sem dados reais de UTM para exibir'
        })
      }

      return NextResponse.json(
        { error: `Failed to fetch UTM analytics: ${analyticsError.message}` },
        { status: 500 }
      )
    }

    const analytics = (data || []).map((item: any) => {
      const clicks = Number.parseInt(item.clicks || 0, 10) || 0
      const conversions = Number.parseInt(item.conversions || 0, 10) || 0
      const spend = 0
      const revenue = Number.parseFloat(item.revenue || 0) || 0
      const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0
      const ctr = 0
      const roas = spend > 0 ? revenue / spend : 0

      return {
        utm_source: item.utm_source || 'unknown',
        utm_medium: item.utm_medium || 'unknown',
        utm_campaign: item.utm_campaign || 'unknown',
        utm_term: item.utm_term || '',
        utm_content: item.utm_content || '',
        clicks,
        conversions,
        spend,
        revenue: Math.round(revenue * 100) / 100,
        ctr,
        conversion_rate: Math.round(conversionRate * 100) / 100,
        roas: Math.round(roas * 100) / 100
      }
    })

    const totalClicks = analytics.reduce((sum, item) => sum + item.clicks, 0)
    const totalConversions = analytics.reduce((sum, item) => sum + item.conversions, 0)
    const totalSpend = analytics.reduce((sum, item) => sum + item.spend, 0)
    const totalRevenue = analytics.reduce((sum, item) => sum + item.revenue, 0)
    const avgCTR = analytics.length > 0 ? analytics.reduce((sum, item) => sum + item.ctr, 0) / analytics.length : 0
    const avgConversionRate = analytics.length > 0
      ? analytics.reduce((sum, item) => sum + item.conversion_rate, 0) / analytics.length
      : 0

    return NextResponse.json({
      analytics,
      summary: {
        total_clicks: totalClicks,
        total_conversions: totalConversions,
        total_spend: Math.round(totalSpend * 100) / 100,
        total_revenue: Math.round(totalRevenue * 100) / 100,
        avg_ctr: Math.round(avgCTR * 100) / 100,
        avg_conversion_rate: Math.round(avgConversionRate * 100) / 100
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
