/**
 * API para Funil de Conversão - Admin
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type DateRange = {
  since: string
  until: string
  label: string
}

function toDateOnly(date: Date): string {
  return date.toISOString().split('T')[0]
}

function parseDateRange(daysParam: string): DateRange {
  const now = new Date()

  if (daysParam.startsWith('custom:')) {
    const [, since, until] = daysParam.split(':')
    if (since && until) {
      return { since, until, label: 'custom' }
    }
  }

  switch (daysParam) {
    case 'this_week': {
      const start = new Date(now)
      const mondayOffset = (now.getDay() + 6) % 7
      start.setDate(now.getDate() - mondayOffset)
      return { since: toDateOnly(start), until: toDateOnly(now), label: 'this_week' }
    }
    case 'last_week': {
      const end = new Date(now)
      const mondayOffset = (now.getDay() + 6) % 7
      end.setDate(now.getDate() - mondayOffset - 1)
      const start = new Date(end)
      start.setDate(end.getDate() - 6)
      return { since: toDateOnly(start), until: toDateOnly(end), label: 'last_week' }
    }
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return { since: toDateOnly(start), until: toDateOnly(now), label: 'this_month' }
    }
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return { since: toDateOnly(start), until: toDateOnly(end), label: 'last_month' }
    }
    default: {
      const numericDays = Number.parseInt(daysParam, 10)
      const safeDays = Number.isFinite(numericDays) && numericDays > 0 ? numericDays : 30
      const start = new Date(now)
      start.setDate(now.getDate() - safeDays)
      return { since: toDateOnly(start), until: toDateOnly(now), label: `${safeDays}_days` }
    }
  }
}

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
    const daysParam = searchParams.get('days') || 'this_month'
    const range = parseDateRange(daysParam)

    const { data: insights, error: insightsError } = await supabase
      .from('meta_campaign_insights')
      .select('impressions,clicks,conversions,date_start')
      .gte('date_start', range.since)
      .lte('date_start', range.until)

    if (insightsError) {
      return NextResponse.json(
        { error: `Failed to fetch funnel data: ${insightsError.message}` },
        { status: 500 }
      )
    }

    const totals = (insights || []).reduce(
      (acc: { impressions: number; clicks: number; conversions: number }, row: any) => {
        acc.impressions += Number.parseInt(row?.impressions || '0', 10) || 0
        acc.clicks += Number.parseInt(row?.clicks || '0', 10) || 0
        acc.conversions += Number.parseFloat(row?.conversions || '0') || 0
        return acc
      },
      { impressions: 0, clicks: 0, conversions: 0 }
    )

    const conversionCount = Math.round(totals.conversions * 100) / 100
    const base = totals.impressions > 0 ? totals.impressions : 1

    const funnel = [
      {
        stage: 'Impressões',
        count: totals.impressions,
        percentage: totals.impressions > 0 ? 100 : 0,
        color: '#3b82f6'
      },
      {
        stage: 'Cliques',
        count: totals.clicks,
        percentage: (totals.clicks / base) * 100,
        color: '#10b981'
      },
      {
        stage: 'Conversões',
        count: conversionCount,
        percentage: (conversionCount / base) * 100,
        color: '#06b6d4'
      }
    ]

    const conversionRates = [
      {
        from: 'Impressões',
        to: 'Cliques',
        rate: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
      },
      {
        from: 'Cliques',
        to: 'Conversões',
        rate: totals.clicks > 0 ? (conversionCount / totals.clicks) * 100 : 0
      }
    ]

    return NextResponse.json({
      funnel,
      conversionRates,
      summary: {
        totalImpressions: totals.impressions,
        totalPurchases: conversionCount,
        overallConversionRate: totals.impressions > 0 ? (conversionCount / totals.impressions) * 100 : 0,
        period: {
          start_date: range.since,
          end_date: range.until,
          label: range.label
        }
      }
    })

  } catch (error) {
    console.error('Error fetching funnel data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
