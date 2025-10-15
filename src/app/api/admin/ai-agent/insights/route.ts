/**
 * API para Insights do Agente de IA - Admin
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

    // Simular insights gerados pela IA
    const insights = [
      {
        id: 'insight_1',
        type: 'optimization',
        title: 'Oportunidade de Realocação de Orçamento',
        description: 'A campanha "Black Friday 2024" está performando 35% acima da média com ROAS de 5.2x, enquanto "Awareness Geral" tem ROAS de apenas 1.8x.',
        campaign_id: 'camp_bf2024',
        campaign_name: 'Black Friday 2024',
        recommendation: 'Realoque R$ 2.500 da campanha "Awareness Geral" para "Black Friday 2024" para maximizar o retorno sobre investimento.',
        expected_improvement: '+20% ROAS geral',
        confidence: 0.92,
        impact: 'high',
        created_at: '2024-12-15T10:30:00Z'
      },
      {
        id: 'insight_2',
        type: 'warning',
        title: 'Saldo Crítico Detectado',
        description: 'A conta principal tem apenas R$ 1.200 restantes, o que representa aproximadamente 12 dias de operação com o gasto atual.',
        campaign_id: null,
        campaign_name: null,
        recommendation: 'Adicione créditos imediatamente ou configure alertas automáticos para pausar campanhas quando o saldo atingir R$ 500.',
        expected_improvement: 'Evitar interrupção das campanhas',
        confidence: 0.98,
        impact: 'high',
        created_at: '2024-12-15T09:15:00Z'
      },
      {
        id: 'insight_3',
        type: 'opportunity',
        title: 'Audiência 25-34 Anos com Alto Potencial',
        description: 'O segmento de 25-34 anos apresenta ROAS de 5.1x, significativamente superior à média geral de 4.2x, mas representa apenas 35% do tráfego.',
        campaign_id: 'camp_lookalike',
        campaign_name: 'Lookalike Premium',
        recommendation: 'Crie campanhas específicas para este segmento e aumente o orçamento em 30% para maximizar o alcance nesta audiência.',
        expected_improvement: '+25% conversões',
        confidence: 0.87,
        impact: 'medium',
        created_at: '2024-12-15T08:45:00Z'
      },
      {
        id: 'insight_4',
        type: 'prediction',
        title: 'Previsão de Performance para Próxima Semana',
        description: 'Com base nos padrões históricos e tendências atuais, prevejo um aumento de 15% nas conversões na próxima semana devido ao período pré-natalino.',
        campaign_id: null,
        campaign_name: null,
        recommendation: 'Aumente os orçamentos das campanhas de melhor performance em 20% para capitalizar sobre o aumento esperado na demanda.',
        expected_improvement: '+15% conversões',
        confidence: 0.78,
        impact: 'medium',
        created_at: '2024-12-15T07:20:00Z'
      },
      {
        id: 'insight_5',
        type: 'optimization',
        title: 'CPC Elevado em Campanhas de Produtos Novos',
        description: 'A campanha "Produtos Novos" apresenta CPC de R$ 4,20, que é 40% superior à média das outras campanhas (R$ 3,00).',
        campaign_id: 'camp_novos',
        campaign_name: 'Produtos Novos',
        recommendation: 'Reduza os lances em 15% e teste novos criativos com foco em benefícios específicos dos produtos para melhorar a relevância.',
        expected_improvement: '-25% CPC',
        confidence: 0.84,
        impact: 'medium',
        created_at: '2024-12-15T06:10:00Z'
      },
      {
        id: 'insight_6',
        type: 'warning',
        title: 'CTR Baixo em Campanhas de Awareness',
        description: 'Três campanhas de awareness apresentam CTR abaixo de 1.5%, indicando possível fadiga de anúncios ou baixa relevância dos criativos.',
        campaign_id: 'camp_awareness',
        campaign_name: 'Awareness Geral',
        recommendation: 'Desenvolva 3-5 novos criativos com abordagens diferentes e pause os anúncios com pior performance por 7 dias.',
        expected_improvement: '+40% CTR',
        confidence: 0.81,
        impact: 'medium',
        created_at: '2024-12-14T16:30:00Z'
      },
      {
        id: 'insight_7',
        type: 'opportunity',
        title: 'Remarketing com Alta Performance',
        description: 'A campanha de remarketing de carrinho abandonado tem ROAS de 6.1x, o mais alto de todas as campanhas, mas orçamento limitado.',
        campaign_id: 'camp_remarketing',
        campaign_name: 'Remarketing Carrinho',
        recommendation: 'Aumente o orçamento desta campanha em 50% e crie variações para remarketing de visualização de produto.',
        expected_improvement: '+30% receita',
        confidence: 0.89,
        impact: 'high',
        created_at: '2024-12-14T14:15:00Z'
      },
      {
        id: 'insight_8',
        type: 'prediction',
        title: 'Tendência de Aumento no Mobile',
        description: 'Dispositivos mobile representam 68% das conversões e a tendência está crescendo 3% ao mês. Desktop está em declínio.',
        campaign_id: null,
        campaign_name: null,
        recommendation: 'Desenvolva criativos mobile-first e considere ajustar lances com +20% para mobile e -10% para desktop.',
        expected_improvement: '+12% conversões mobile',
        confidence: 0.76,
        impact: 'low',
        created_at: '2024-12-14T11:45:00Z'
      }
    ]

    return NextResponse.json({
      insights,
      summary: {
        total_insights: insights.length,
        by_type: {
          optimization: insights.filter(i => i.type === 'optimization').length,
          warning: insights.filter(i => i.type === 'warning').length,
          opportunity: insights.filter(i => i.type === 'opportunity').length,
          prediction: insights.filter(i => i.type === 'prediction').length
        },
        by_impact: {
          high: insights.filter(i => i.impact === 'high').length,
          medium: insights.filter(i => i.impact === 'medium').length,
          low: insights.filter(i => i.impact === 'low').length
        },
        avg_confidence: insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length
      }
    })

  } catch (error) {
    console.error('Error fetching AI insights:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}