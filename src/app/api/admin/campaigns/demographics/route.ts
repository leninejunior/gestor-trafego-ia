/**
 * API para Dados Demográficos de Campanhas - Admin
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type DateRange = {
  since: string
  until: string
  label: string
}

type DemographicMetric = {
  age_range: string
  gender: string
  impressions: number
  clicks: number
  spend: number
  conversions: number
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

function extractConversions(actions: any[] | undefined): number {
  if (!Array.isArray(actions)) {
    return 0
  }

  const purchase = actions.find((a: any) => a?.action_type === 'purchase')?.value
  const lead = actions.find((a: any) => a?.action_type === 'lead')?.value
  const raw = purchase ?? lead ?? 0
  const parsed = Number.parseFloat(String(raw))

  return Number.isFinite(parsed) ? parsed : 0
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

    const { data: connections, error: connectionsError } = await supabase
      .from('client_meta_connections')
      .select('id,ad_account_id,access_token')
      .eq('is_active', true)

    if (connectionsError) {
      return NextResponse.json(
        { error: `Failed to fetch active Meta connections: ${connectionsError.message}` },
        { status: 500 }
      )
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json({
        demographics: [],
        total: 0,
        message: 'Nenhuma conexão Meta ativa encontrada',
        period: {
          start_date: range.since,
          end_date: range.until,
          label: range.label
        }
      })
    }

    const allRows = await Promise.all(
      connections.map(async (connection: any): Promise<DemographicMetric[]> => {
        if (!connection?.ad_account_id || !connection?.access_token) {
          return []
        }

        try {
          const url = new URL(`https://graph.facebook.com/v18.0/${connection.ad_account_id}/insights`)
          url.searchParams.set('access_token', connection.access_token)
          url.searchParams.set('fields', 'spend,impressions,clicks,actions')
          url.searchParams.set('breakdowns', 'age,gender')
          url.searchParams.set('time_range', JSON.stringify({ since: range.since, until: range.until }))
          url.searchParams.set('limit', '500')

          const response = await fetch(url.toString())
          const payload = await response.json()

          if (!response.ok || payload?.error || !Array.isArray(payload?.data)) {
            console.warn('[ADMIN DEMOGRAPHICS] Meta API returned no data for connection', {
              connectionId: connection.id,
              status: response.status,
              error: payload?.error?.message
            })
            return []
          }

          return payload.data.map((item: any) => ({
            age_range: item?.age || 'unknown',
            gender: item?.gender || 'unknown',
            impressions: Number.parseInt(item?.impressions || '0', 10) || 0,
            clicks: Number.parseInt(item?.clicks || '0', 10) || 0,
            spend: Number.parseFloat(item?.spend || '0') || 0,
            conversions: extractConversions(item?.actions)
          }))
        } catch (metaError) {
          console.warn('[ADMIN DEMOGRAPHICS] Meta API request failed', {
            connectionId: connection.id,
            error: metaError instanceof Error ? metaError.message : String(metaError)
          })
          return []
        }
      })
    )

    const aggregated = new Map<string, DemographicMetric>()

    allRows.flat().forEach((row) => {
      const key = `${row.age_range}::${row.gender}`
      const current = aggregated.get(key) || {
        age_range: row.age_range,
        gender: row.gender,
        impressions: 0,
        clicks: 0,
        spend: 0,
        conversions: 0
      }

      current.impressions += row.impressions
      current.clicks += row.clicks
      current.spend += row.spend
      current.conversions += row.conversions

      aggregated.set(key, current)
    })

    const demographics = Array.from(aggregated.values())
      .sort((a, b) => b.impressions - a.impressions)
      .map((row) => ({
        ...row,
        spend: Math.round(row.spend * 100) / 100,
        conversions: Math.round(row.conversions * 100) / 100
      }))

    return NextResponse.json({
      demographics,
      total: demographics.length,
      period: {
        start_date: range.since,
        end_date: range.until,
        label: range.label
      },
      source: 'meta_api'
    })

  } catch (error) {
    console.error('Error fetching demographics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
