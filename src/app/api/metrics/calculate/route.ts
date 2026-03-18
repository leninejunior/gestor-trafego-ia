import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const calculateMetricSchema = z.object({
  metric_id: z.string().uuid(),
  campaign_data: z.record(z.number()),
  date_range: z.object({
    start: z.string(),
    end: z.string(),
  }),
  campaign_id: z.string().optional(),
  ad_account_id: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = calculateMetricSchema.parse(body);

    // Buscar a métrica personalizada
    const { data: metric, error: metricError } = await supabase
      .from('custom_metrics')
      .select('*')
      .eq('id', validatedData.metric_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (metricError || !metric) {
      return NextResponse.json({ error: 'Métrica não encontrada' }, { status: 404 });
    }

    // Calcular o valor da métrica
    const calculationResult = calculateCustomMetric(
      metric,
      validatedData.campaign_data
    );

    if (!calculationResult.success) {
      return NextResponse.json(
        { error: calculationResult.error },
        { status: 400 }
      );
    }

    // Salvar o valor calculado no cache
    const { data: cachedValue, error: cacheError } = await supabase
      .from('custom_metric_values')
      .insert({
        custom_metric_id: validatedData.metric_id,
        campaign_id: validatedData.campaign_id,
        ad_account_id: validatedData.ad_account_id,
        date_range_start: validatedData.date_range.start,
        date_range_end: validatedData.date_range.end,
        calculated_value: calculationResult.value,
        raw_data: validatedData.campaign_data,
      })
      .select()
      .single();

    return NextResponse.json({
      value: calculationResult.value,
      formatted_value: formatMetricValue(calculationResult.value, metric),
      calculation_steps: calculationResult.steps,
      cached_value: cachedValue,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Erro no cálculo da métrica:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// Função para calcular métricas personalizadas
function calculateCustomMetric(metric: any, campaignData: Record<string, number>) {
  try {
    const steps: any[] = [];
    let formula = metric.formula;

    // Substituir variáveis na fórmula pelos valores reais
    for (const metricKey of metric.base_metrics) {
      const value = campaignData[metricKey];
      
      if (value === undefined || value === null) {
        return {
          success: false,
          error: `Valor não encontrado para a métrica: ${metricKey}`
        };
      }

      steps.push({
        step: steps.length + 1,
        operation: `Substituir ${metricKey}`,
        input_values: { [metricKey]: value },
        result: value,
        description: `${metricKey} = ${value}`
      });

      // Substituir na fórmula usando regex para palavras completas
      formula = formula.replace(new RegExp(`\\b${metricKey}\\b`, 'g'), value.toString());
    }

    steps.push({
      step: steps.length + 1,
      operation: 'Fórmula final',
      input_values: {},
      result: 0,
      description: `Calculando: ${formula}`
    });

    // Avaliar a expressão matemática de forma segura
    const result = evaluateExpression(formula);
    
    if (result === null || isNaN(result)) {
      return {
        success: false,
        error: 'Erro no cálculo da fórmula'
      };
    }

    steps.push({
      step: steps.length + 1,
      operation: 'Resultado final',
      input_values: {},
      result: result,
      description: `Resultado: ${result}`
    });

    return {
      success: true,
      value: result,
      steps: steps
    };
  } catch (error) {
    return {
      success: false,
      error: `Erro no cálculo: ${error}`
    };
  }
}

// Função para avaliar expressões matemáticas de forma segura
function evaluateExpression(expression: string): number | null {
  try {
    // Remove espaços
    expression = expression.replace(/\s/g, '');
    
    // Validar que contém apenas números, operadores e parênteses
    if (!/^[0-9+\-*/.()]+$/.test(expression)) {
      return null;
    }

    // Usar Function constructor para avaliar de forma mais segura que eval
    const result = new Function(`"use strict"; return (${expression})`)();
    
    return typeof result === 'number' && isFinite(result) ? result : null;
  } catch (error) {
    return null;
  }
}

// Função para formatar valores das métricas
function formatMetricValue(value: number, metric: any): string {
  const formattedNumber = value.toFixed(metric.decimal_places || 2);
  
  if (metric.is_percentage) {
    return `${formattedNumber}%`;
  }
  
  return `${metric.display_symbol || ''}${formattedNumber}`;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const metricId = searchParams.get('metric_id');
    const campaignId = searchParams.get('campaign_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (!metricId) {
      return NextResponse.json({ error: 'metric_id é obrigatório' }, { status: 400 });
    }

    // Buscar valores calculados do cache
    let query = supabase
      .from('custom_metric_values')
      .select(`
        *,
        custom_metrics!inner(
          id,
          name,
          display_symbol,
          decimal_places,
          is_percentage,
          user_id
        )
      `)
      .eq('custom_metric_id', metricId)
      .eq('custom_metrics.user_id', user.id);

    if (campaignId) {
      query = query.eq('campaign_id', campaignId);
    }

    if (startDate && endDate) {
      query = query
        .gte('date_range_start', startDate)
        .lte('date_range_end', endDate);
    }

    const { data: cachedValues, error } = await query.order('calculated_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar valores calculados:', error);
      return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }

    // Formatar os valores
    const formattedValues = cachedValues?.map(value => ({
      ...value,
      formatted_value: formatMetricValue(value.calculated_value, value.custom_metrics)
    })) || [];

    return NextResponse.json({ values: formattedValues });
  } catch (error) {
    console.error('Erro na API de valores calculados:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}