/**
 * API para Funil de Conversão - Admin
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

    // Simular funil de conversão (em produção, calcularia com dados reais)
    const totalImpressions = 500000
    const totalClicks = 12500
    const totalLandingPageViews = 10000
    const totalAddToCarts = 3500
    const totalInitiateCheckouts = 1800
    const totalPurchases = 650

    const funnel = [
      {
        stage: 'Impressões',
        count: totalImpressions,
        percentage: 100,
        color: '#3b82f6'
      },
      {
        stage: 'Cliques',
        count: totalClicks,
        percentage: (totalClicks / totalImpressions) * 100,
        color: '#10b981'
      },
      {
        stage: 'Visualizações da Página',
        count: totalLandingPageViews,
        percentage: (totalLandingPageViews / totalImpressions) * 100,
        color: '#f59e0b'
      },
      {
        stage: 'Adicionar ao Carrinho',
        count: totalAddToCarts,
        percentage: (totalAddToCarts / totalImpressions) * 100,
        color: '#ef4444'
      },
      {
        stage: 'Iniciar Checkout',
        count: totalInitiateCheckouts,
        percentage: (totalInitiateCheckouts / totalImpressions) * 100,
        color: '#8b5cf6'
      },
      {
        stage: 'Compras',
        count: totalPurchases,
        percentage: (totalPurchases / totalImpressions) * 100,
        color: '#06b6d4'
      }
    ]

    // Calcular taxas de conversão entre etapas
    const conversionRates = [
      {
        from: 'Impressões',
        to: 'Cliques',
        rate: (totalClicks / totalImpressions) * 100
      },
      {
        from: 'Cliques',
        to: 'Visualizações',
        rate: (totalLandingPageViews / totalClicks) * 100
      },
      {
        from: 'Visualizações',
        to: 'Carrinho',
        rate: (totalAddToCarts / totalLandingPageViews) * 100
      },
      {
        from: 'Carrinho',
        to: 'Checkout',
        rate: (totalInitiateCheckouts / totalAddToCarts) * 100
      },
      {
        from: 'Checkout',
        to: 'Compra',
        rate: (totalPurchases / totalInitiateCheckouts) * 100
      }
    ]

    return NextResponse.json({
      funnel,
      conversionRates,
      summary: {
        totalImpressions,
        totalPurchases,
        overallConversionRate: (totalPurchases / totalImpressions) * 100,
        period: days
      }
    })

  } catch (error) {
    console.error('Error fetching funnel data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}