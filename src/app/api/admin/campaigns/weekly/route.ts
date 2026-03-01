/**
 * API para Dados Semanais de Campanhas - Admin
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type WeeklyBucket = {
  weekStart: string
  spend: number
  impressions: number
  clicks: number
  conversions: number
}

type DateRange = {
  since: string
  until: string
  label: string
}

function getWeekStart(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`)
  const day = (date.getDay() + 6) % 7 // Monday-based
  date.setDate(date.getDate() - day)
  return date.toISOString().split('T')[0]
}

function formatWeekRange(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)

  return `${start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} - ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
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
    const supabase = await createClient()
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
      .select('date_start,spend,impressions,clicks,conversions')
      .gte('date_start', range.since)
      .lte('date_start', range.until)

    if (insightsError) {
      return NextResponse.json(
        { error: `Failed to fetch weekly campaign data: ${insightsError.message}` },
        { status: 500 }
      )
    }

    if (!insights || insights.length === 0) {
      return NextResponse.json({
        weekly: [],
        period: {
          start_date: range.since,
          end_date: range.until,
          label: range.label,
          weeks: 0,
        },
      })
    }

    const buckets = new Map<string, WeeklyBucket>()

    insights.forEach((insight: any) => {
      if (!insight?.date_start) {
        return
      }

      const weekStart = getWeekStart(insight.date_start)

      const current = buckets.get(weekStart) || {
        weekStart,
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
      }

      current.spend += parseFloat(insight.spend || '0')
      current.impressions += parseInt(insight.impressions || '0', 10)
      current.clicks += parseInt(insight.clicks || '0', 10)
      current.conversions += parseFloat(insight.conversions || '0')

      buckets.set(weekStart, current)
    })

    const weekly = Array.from(buckets.values())
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
      .map((bucket) => {
        const roas = bucket.spend > 0 ? (bucket.conversions * 50) / bucket.spend : 0

        return {
          week: formatWeekRange(bucket.weekStart),
          spend: Math.round(bucket.spend * 100) / 100,
          impressions: bucket.impressions,
          clicks: bucket.clicks,
          conversions: Math.round(bucket.conversions * 100) / 100,
          roas: Math.round(roas * 100) / 100,
        }
      })

    return NextResponse.json({
      weekly,
      period: {
        start_date: range.since,
        end_date: range.until,
        label: range.label,
        weeks: weekly.length,
      },
    })
  } catch (error) {
    console.error('Error fetching weekly data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
