import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createCustomMetricSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
  formula: z.string().min(1, 'Fórmula é obrigatória'),
  base_metrics: z.array(z.string()),
  currency_type: z.enum(['BRL', 'USD', 'EUR', 'POINTS']).default('BRL'),
  display_symbol: z.string().default('R$'),
  decimal_places: z.number().min(0).max(4).default(2),
  is_percentage: z.boolean().default(false),
  category: z.enum(['CPC', 'CTR', 'ROAS', 'CPA', 'CUSTOM']).default('CUSTOM'),
});

const updateCustomMetricSchema = createCustomMetricSchema.partial();

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const active = searchParams.get('active');

    let query = supabase
      .from('custom_metrics')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    if (active !== null) {
      query = query.eq('is_active', active === 'true');
    }

    const { data: metrics, error } = await query;

    if (error) {
      console.error('Erro ao buscar métricas:', error);
      return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }

    return NextResponse.json({ metrics });
  } catch (error) {
    console.error('Erro na API de métricas:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createCustomMetricSchema.parse(body);

    // Verificar se já existe uma métrica com o mesmo nome
    const { data: existingMetric } = await supabase
      .from('custom_metrics')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', validatedData.name)
      .single();

    if (existingMetric) {
      return NextResponse.json(
        { error: 'Já existe uma métrica com este nome' },
        { status: 400 }
      );
    }

    // Validar fórmula
    const formulaValidation = validateFormula(validatedData.formula, validatedData.base_metrics);
    if (!formulaValidation.isValid) {
      return NextResponse.json(
        { error: `Fórmula inválida: ${formulaValidation.error}` },
        { status: 400 }
      );
    }

    // Buscar organização do usuário
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    const { data: metric, error } = await supabase
      .from('custom_metrics')
      .insert({
        ...validatedData,
        user_id: user.id,
        organization_id: membership?.organization_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar métrica:', error);
      return NextResponse.json({ error: 'Erro ao criar métrica' }, { status: 500 });
    }

    return NextResponse.json({ metric }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Erro na API de criação de métrica:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID da métrica é obrigatório' }, { status: 400 });
    }

    const validatedData = updateCustomMetricSchema.parse(updateData);

    // Verificar se a métrica pertence ao usuário
    const { data: existingMetric, error: fetchError } = await supabase
      .from('custom_metrics')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !existingMetric) {
      return NextResponse.json({ error: 'Métrica não encontrada' }, { status: 404 });
    }

    // Validar fórmula se foi alterada
    if (validatedData.formula && validatedData.base_metrics) {
      const formulaValidation = validateFormula(validatedData.formula, validatedData.base_metrics);
      if (!formulaValidation.isValid) {
        return NextResponse.json(
          { error: `Fórmula inválida: ${formulaValidation.error}` },
          { status: 400 }
        );
      }
    }

    const { data: metric, error } = await supabase
      .from('custom_metrics')
      .update({
        ...validatedData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar métrica:', error);
      return NextResponse.json({ error: 'Erro ao atualizar métrica' }, { status: 500 });
    }

    return NextResponse.json({ metric });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Erro na API de atualização de métrica:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID da métrica é obrigatório' }, { status: 400 });
    }

    // Verificar se a métrica pertence ao usuário
    const { data: existingMetric, error: fetchError } = await supabase
      .from('custom_metrics')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !existingMetric) {
      return NextResponse.json({ error: 'Métrica não encontrada' }, { status: 404 });
    }

    // Soft delete - marcar como inativa
    const { error } = await supabase
      .from('custom_metrics')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Erro ao deletar métrica:', error);
      return NextResponse.json({ error: 'Erro ao deletar métrica' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Métrica deletada com sucesso' });
  } catch (error) {
    console.error('Erro na API de deleção de métrica:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// Função auxiliar para validar fórmulas
function validateFormula(formula: string, baseMetrics: string[]) {
  const validOperators = ['+', '-', '*', '/', '(', ')', ' '];
  const validMetrics = [
    'spend', 'impressions', 'clicks', 'conversions', 'revenue', 
    'reach', 'frequency', 'ctr', 'cpc', 'cpm'
  ];

  try {
    // Remove espaços e quebra em tokens
    const tokens = formula.split(/[\s+\-*/()]+/).filter(t => t.length > 0);
    
    // Verifica se todos os tokens são válidos
    for (const token of tokens) {
      const isNumber = /^\d+(\.\d+)?$/.test(token);
      const isValidMetric = validMetrics.includes(token);
      
      if (!isNumber && !isValidMetric) {
        return {
          isValid: false,
          error: `Token inválido: ${token}`
        };
      }
    }

    // Verifica se as métricas usadas estão na lista de métricas base
    const usedMetrics = tokens.filter(t => validMetrics.includes(t));
    const missingMetrics = usedMetrics.filter(m => !baseMetrics.includes(m));
    
    if (missingMetrics.length > 0) {
      return {
        isValid: false,
        error: `Métricas não selecionadas: ${missingMetrics.join(', ')}`
      };
    }

    // Validação básica de sintaxe (parênteses balanceados)
    let parenthesesCount = 0;
    for (const char of formula) {
      if (char === '(') parenthesesCount++;
      if (char === ')') parenthesesCount--;
      if (parenthesesCount < 0) {
        return {
          isValid: false,
          error: 'Parênteses não balanceados'
        };
      }
    }

    if (parenthesesCount !== 0) {
      return {
        isValid: false,
        error: 'Parênteses não balanceados'
      };
    }

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: 'Erro na validação da fórmula'
    };
  }
}


