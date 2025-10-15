/**
 * API para Chat com Agente de IA - Admin
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    const { message, campaign_id, analysis_type, context } = body

    // Simular resposta da IA baseada na mensagem
    let response = ''
    let confidence = 0.85

    // Análise da mensagem para gerar resposta contextual
    const lowerMessage = message.toLowerCase()

    if (lowerMessage.includes('performance') || lowerMessage.includes('como está')) {
      response = `📊 **Análise de Performance Atual**

Com base nos dados dos últimos 30 dias, aqui está um resumo da performance das suas campanhas:

**📈 Métricas Gerais:**
• **15 campanhas ativas** com investimento total de R$ 45.200
• **ROAS médio de 4.2x** (23% acima da média do setor)
• **CTR médio de 2.8%** (excelente performance)
• **Taxa de conversão de 2.1%** (dentro do esperado)

**🎯 Destaques:**
• Campanha "Black Friday 2024" está performando 35% acima da meta
• Audiência 25-34 anos apresenta melhor ROAS (5.1x)
• Dispositivos mobile representam 68% das conversões

**⚠️ Pontos de Atenção:**
• 3 campanhas com CTR abaixo de 1.5% precisam de otimização
• Orçamento da conta principal tem apenas 12 dias restantes
• Campanha "Produtos Novos" com CPC 40% acima da média

**💡 Recomendações:**
1. Realoque 20% do orçamento das campanhas de baixa performance para a "Black Friday"
2. Crie variações de anúncio focadas no público 25-34 anos
3. Adicione créditos na conta principal para evitar interrupções`

      confidence = 0.92
    } else if (lowerMessage.includes('otimizar') || lowerMessage.includes('melhorar')) {
      response = `🚀 **Oportunidades de Otimização Identificadas**

Analisei suas campanhas e identifiquei várias oportunidades de melhoria:

**🎯 Otimizações Prioritárias:**

**1. Realocação de Orçamento (Impacto Alto)**
• Mover R$ 2.500 da campanha "Awareness Geral" (ROAS 1.8x) para "Black Friday" (ROAS 5.2x)
• Potencial aumento de 15-20% no ROAS geral

**2. Otimização de Audiência (Impacto Médio)**
• Excluir faixa etária 55+ das campanhas de e-commerce (baixa conversão)
• Expandir targeting para "Interesses similares" na audiência 25-34

**3. Ajuste de Lances (Impacto Alto)**
• Reduzir lance em 15% nas campanhas com CPC > R$ 3,00
• Aumentar lance em 10% nos anúncios com CTR > 3%

**4. Criação de Anúncios (Impacto Médio)**
• Criar 3 novas variações para campanhas com CTR < 1.5%
• Testar formato carrossel vs. imagem única

**📊 Projeção de Resultados:**
• **ROAS esperado:** 4.2x → 5.1x (+21%)
• **Redução de CPC:** R$ 2,80 → R$ 2,35 (-16%)
• **Aumento de conversões:** +35% no próximo mês

Quer que eu detalhe alguma dessas otimizações?`

      confidence = 0.89
    } else if (lowerMessage.includes('saldo') || lowerMessage.includes('orçamento')) {
      response = `💰 **Status de Saldo e Orçamento**

Analisei o status financeiro de todas as suas contas:

**🚨 Alertas Críticos:**
• **Conta Principal:** Apenas R$ 1.200 restantes (12 dias)
• **Conta App Mobile:** Saldo crítico - R$ 450 (3 dias)

**⚠️ Alertas de Atenção:**
• **Conta Sazonal:** R$ 2.800 restantes (18 dias)
• Gasto diário médio aumentou 25% na última semana

**📊 Resumo Geral:**
• **Saldo total:** R$ 8.450 em 5 contas
• **Gasto diário médio:** R$ 680
• **Projeção:** 12 dias de operação restantes

**💡 Recomendações Urgentes:**
1. **Adicionar R$ 10.000** na conta principal hoje
2. **Pausar campanhas** de baixa performance temporariamente
3. **Configurar alertas** automáticos para saldo < 20%
4. **Revisar orçamentos** diários das campanhas ativas

**🔄 Ações Automáticas Sugeridas:**
• Pausar automaticamente campanhas quando saldo < R$ 500
• Reduzir lances em 20% quando saldo < R$ 1.000
• Enviar alerta por email/SMS quando saldo crítico

Quer que eu configure esses alertas automáticos para você?`

      confidence = 0.94
    } else if (lowerMessage.includes('audiência') || lowerMessage.includes('público')) {
      response = `👥 **Análise Detalhada de Audiência**

Aqui está o breakdown completo da performance por audiência:

**🎯 Segmentação Demográfica:**

**Por Idade:**
• **18-24 anos:** 15% do tráfego, ROAS 3.2x, CTR 2.1%
• **25-34 anos:** 35% do tráfego, ROAS 5.1x, CTR 3.2% ⭐
• **35-44 anos:** 28% do tráfego, ROAS 4.0x, CTR 2.8%
• **45-54 anos:** 18% do tráfego, ROAS 2.8x, CTR 1.9%
• **55+ anos:** 4% do tráfego, ROAS 1.5x, CTR 1.2% ⚠️

**Por Gênero:**
• **Feminino:** 58% conversões, ROAS 4.5x, CPC R$ 2,20
• **Masculino:** 42% conversões, ROAS 3.8x, CPC R$ 2,60

**📱 Por Dispositivo:**
• **Mobile:** 68% conversões, ROAS 4.1x
• **Desktop:** 28% conversões, ROAS 4.8x
• **Tablet:** 4% conversões, ROAS 3.2x

**🌍 Por Localização (Top 5):**
1. **São Paulo:** 32% conversões, ROAS 4.6x
2. **Rio de Janeiro:** 18% conversões, ROAS 4.2x
3. **Belo Horizonte:** 12% conversões, ROAS 4.8x
4. **Brasília:** 8% conversões, ROAS 3.9x
5. **Porto Alegre:** 7% conversões, ROAS 4.1x

**💡 Insights Estratégicos:**
• Foco no público 25-34 anos pode aumentar ROAS em 20%
• Campanhas mobile-first têm melhor custo-benefício
• Mulheres convertem mais, mas homens têm tickets maiores
• Interior tem ROAS superior às capitais

**🚀 Recomendações:**
1. Criar campanhas específicas para 25-34 anos
2. Aumentar orçamento para Belo Horizonte (+48% ROAS vs média)
3. Desenvolver criativos mobile-first
4. Testar expansão para cidades do interior`

      confidence = 0.91
    } else if (lowerMessage.includes('relatório') || lowerMessage.includes('report')) {
      response = `📋 **Relatório Executivo - Últimos 30 Dias**

**📊 RESUMO EXECUTIVO**

**Investimento Total:** R$ 45.200
**Receita Gerada:** R$ 189.840
**ROAS Geral:** 4.2x
**Conversões:** 1.247

**📈 PERFORMANCE POR CANAL**

**Meta Ads (Facebook/Instagram):**
• Investimento: R$ 32.400 (72%)
• ROAS: 4.5x
• Conversões: 892
• CTR: 2.8%

**Google Ads:**
• Investimento: R$ 12.800 (28%)
• ROAS: 3.6x
• Conversões: 355
• CTR: 3.1%

**🎯 TOP 5 CAMPANHAS**

1. **Black Friday 2024**
   • ROAS: 5.2x | Gasto: R$ 8.500 | Conv: 285

2. **Produtos Verão**
   • ROAS: 4.8x | Gasto: R$ 6.200 | Conv: 198

3. **Remarketing Carrinho**
   • ROAS: 6.1x | Gasto: R$ 3.800 | Conv: 156

4. **Lookalike Premium**
   • ROAS: 4.2x | Gasto: R$ 5.900 | Conv: 167

5. **Search Brand**
   • ROAS: 4.9x | Gasto: R$ 4.100 | Conv: 134

**⚠️ CAMPANHAS PARA OTIMIZAR**

• **Awareness Geral:** ROAS 1.8x (abaixo da meta)
• **Produtos Novos:** CPC R$ 4,20 (40% acima da média)
• **Interesse Amplo:** CTR 1.2% (precisa de novos criativos)

**💡 PRÓXIMOS PASSOS**

1. **Realocação:** Mover R$ 3.000 para campanhas top
2. **Otimização:** Pausar/ajustar campanhas de baixa performance
3. **Expansão:** Testar novos públicos similares
4. **Criativos:** Desenvolver 5 novas variações

**🎯 META PRÓXIMO MÊS**
• ROAS Target: 4.8x (+14%)
• Conversões Target: 1.450 (+16%)
• CPC Target: R$ 2,50 (-11%)`

      confidence = 0.88
    } else {
      // Resposta genérica para outras perguntas
      response = `🤖 **Assistente de Campanhas**

Olá! Sou seu assistente especializado em análise de campanhas publicitárias. 

Posso ajudar você com:

**📊 Análises:**
• Performance geral das campanhas
• Métricas detalhadas por canal
• Análise de audiência e segmentação
• Comparação temporal de resultados

**🚀 Otimizações:**
• Identificação de oportunidades
• Recomendações de orçamento
• Sugestões de targeting
• Otimização de lances e criativos

**💰 Monitoramento:**
• Status de saldo das contas
• Projeções de gastos
• Alertas de performance
• Controle de orçamento

**📋 Relatórios:**
• Resumos executivos
• Análises comparativas
• Insights estratégicos
• Próximos passos

**Exemplos de perguntas:**
• "Como está a performance das minhas campanhas?"
• "Quais campanhas devo otimizar?"
• "Como está o saldo das minhas contas?"
• "Gere um relatório dos últimos 30 dias"

Como posso ajudar você hoje?`

      confidence = 0.75
    }

    // Simular delay de processamento da IA
    await new Promise(resolve => setTimeout(resolve, 1500))

    return NextResponse.json({
      response,
      confidence,
      analysis_type: analysis_type || 'general',
      timestamp: new Date().toISOString(),
      tokens_used: Math.floor(response.length / 4), // Aproximação de tokens
      processing_time: 1500
    })

  } catch (error) {
    console.error('Error in AI chat:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}