/**
 * API para Dashboard de Campanhas - Admin
 * Endpoint principal para dados de campanhas com filtros avançados
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

    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!userRole || userRole.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = request.nextUrl
    const status = searchParams.get('status') || 'all'
    const objective = searchParams.get('objective') || 'all'
    const daysParam = searchParams.get('days') || 'this_month'
    const sortBy = searchParams.get('sort') || 'spend'
    const sortOrder = searchParams.get('order') === 'asc' ? 'asc' : 'desc'

    const range = parseDateRange(daysParam)

    let campaignsQuery = supabase
      .from('meta_campaigns')
      .select(`
        id,
        name,
        status,
        objective,
        created_time,
        updated_time,
        start_time,
        stop_time,
        daily_budget,
        lifetime_budget,
        account_id,
        connection_id,
        client_meta_connections!inner(
          id,
          client_id,
          account_name,
          ad_account_id
        )
      `)

    if (status !== 'all') {
      campaignsQuery = campaignsQuery.eq('status', status.toUpperCase())
    }

    if (objective !== 'all') {
      campaignsQuery = campaignsQuery.eq('objective', objective)
    }

    const { data: campaigns, error: campaignsError } = await campaignsQuery

    if (campaignsError) {
      return NextResponse.json(
        { error: `Failed to fetch campaigns: ${campaignsError.message}` },
        { status: 500 }
      )
    }

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({
        campaigns: [],
        total: 0,
        filters: {
          status,
          objective,
          sortBy,
          sortOrder,
          period: range
        }
      })
    }

    const campaignIds = campaigns.map((campaign: any) => campaign.id)
    const { data: insights, error: insightsError } = await supabase
      .from('meta_campaign_insights')
      .select('campaign_id,impressions,clicks,spend,reach,conversions')
      .in('campaign_id', campaignIds)
      .gte('date_start', range.since)
      .lte('date_start', range.until)

    if (insightsError) {
      return NextResponse.json(
        { error: `Failed to fetch campaign insights: ${insightsError.message}` },
        { status: 500 }
      )
    }

    const campaignsWithMetrics = campaigns.map((campaign: any) => {
      const campaignInsights = (insights || []).filter((item: any) => item.campaign_id === campaign.id)

      const totals = campaignInsights.reduce((acc, insight: any) => {
        acc.impressions += Number.parseInt(insight?.impressions || '0', 10) || 0
        acc.clicks += Number.parseInt(insight?.clicks || '0', 10) || 0
        acc.spend += Number.parseFloat(insight?.spend || '0') || 0
        acc.reach += Number.parseInt(insight?.reach || '0', 10) || 0
        acc.conversions += Number.parseFloat(insight?.conversions || '0') || 0
        return acc
      }, { impressions: 0, clicks: 0, spend: 0, reach: 0, conversions: 0 })

      const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
      const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0
      const frequency = totals.reach > 0 ? totals.impressions / totals.reach : 0
      const roas = totals.spend > 0 ? (totals.conversions * 50) / totals.spend : 0

      return {
        ...campaign,
        account_name: campaign?.client_meta_connections?.account_name || campaign.account_id || 'Conta sem nome',
        spend: Math.round(totals.spend * 100) / 100,
        impressions: totals.impressions,
        clicks: totals.clicks,
        conversions: Math.round(totals.conversions * 100) / 100,
        reach: totals.reach,
        ctr: Math.round(ctr * 100) / 100,
        cpc: Math.round(cpc * 100) / 100,
        frequency: Math.round(frequency * 100) / 100,
        roas: Math.round(roas * 100) / 100
      }
    })

    const sortedCampaigns = campaignsWithMetrics.sort((a: any, b: any) => {
      const aValue = Number(a?.[sortBy] ?? 0)
      const bValue = Number(b?.[sortBy] ?? 0)
      if (sortOrder === 'asc') {
        return aValue - bValue
      }
      return bValue - aValue
    })

    return NextResponse.json({
      campaigns: sortedCampaigns,
      total: sortedCampaigns.length,
      filters: {
        status,
        objective,
        sortBy,
        sortOrder,
        period: range
      }
    })
  } catch (error) {
    console.error('Error in campaigns API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
