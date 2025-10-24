import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CreatePaymentRequest, CreatePaymentResponse } from '@/lib/types/payments';

// GET /api/payments/transactions - Listar transações
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar organização do usuário
    const { data: membership } = await supabase
      .from('memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 });
    }

    // Parâmetros de consulta
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const client_id = searchParams.get('client_id');
    const provider_id = searchParams.get('provider_id');

    // Construir query
    let query = supabase
      .from('payment_transactions')
      .select(`
        *,
        provider:payment_providers(id, name, display_name),
        client:clients(id, name)
      `)
      .eq('org_id', membership.org_id)
      .order('created_at', { ascending: false });

    // Aplicar filtros
    if (status) {
      query = query.eq('status', status);
    }
    if (client_id) {
      query = query.eq('client_id', client_id);
    }
    if (provider_id) {
      query = query.eq('provider_id', provider_id);
    }

    // Paginação
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: transactions, error, count } = await query;

    if (error) {
      console.error('Erro ao buscar transações:', error);
      return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }

    return NextResponse.json({ 
      transactions,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Erro na API de transações:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST /api/payments/transactions - Criar nova transação
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar organização do usuário
    const { data: membership } = await supabase
      .from('memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 });
    }

    const body: CreatePaymentRequest = await request.json();
    const { 
      client_id, 
      provider_name, 
      amount, 
      currency = 'BRL', 
      description, 
      customer_data, 
      metadata = {} 
    } = body;

    // Validar dados obrigatórios
    if (!amount || amount <= 0) {
      return NextResponse.json({ 
        error: 'Valor deve ser maior que zero' 
      }, { status: 400 });
    }

    if (!customer_data?.name || !customer_data?.email) {
      return NextResponse.json({ 
        error: 'Nome e email do cliente são obrigatórios' 
      }, { status: 400 });
    }

    // Buscar provedor ativo (ou usar o especificado)
    let providerQuery = supabase
      .from('payment_providers')
      .select('*')
      .eq('org_id', membership.org_id)
      .eq('is_active', true);

    if (provider_name) {
      providerQuery = providerQuery.eq('name', provider_name);
    }

    providerQuery = providerQuery.order('priority', { ascending: true }).limit(1);

    const { data: providers, error: providerError } = await providerQuery;

    if (providerError || !providers || providers.length === 0) {
      return NextResponse.json({ 
        error: 'Nenhum provedor de pagamento ativo encontrado' 
      }, { status: 400 });
    }

    const provider = providers[0];

    // Gerar ID de referência único
    const reference_id = `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Criar transação no banco
    const { data: transaction, error: transactionError } = await supabase
      .from('payment_transactions')
      .insert({
        org_id: membership.org_id,
        client_id,
        provider_id: provider.id,
        reference_id,
        amount,
        currency,
        description,
        status: 'pending',
        customer_data,
        metadata: {
          ...metadata,
          created_by: user.id,
          user_agent: request.headers.get('user-agent'),
          ip: request.headers.get('x-forwarded-for')
        }
      })
      .select(`
        *,
        provider:payment_providers(id, name, display_name),
        client:clients(id, name)
      `)
      .single();

    if (transactionError) {
      console.error('Erro ao criar transação:', transactionError);
      return NextResponse.json({ error: 'Erro ao criar transação' }, { status: 500 });
    }

    // Log de auditoria
    await supabase
      .from('payment_audit_logs')
      .insert({
        org_id: membership.org_id,
        user_id: user.id,
        action: 'create_payment',
        entity_type: 'transaction',
        entity_id: transaction.id,
        new_data: transaction,
        metadata: { 
          provider: provider.name,
          amount,
          currency
        }
      });

    // TODO: Aqui seria integrado com o provedor real (Stripe, Iugu, etc)
    // Por enquanto, retornamos a transação criada
    const response: CreatePaymentResponse = {
      transaction,
      payment_url: `${process.env.NEXT_PUBLIC_APP_URL}/payments/${transaction.id}`,
      // qr_code: 'base64_qr_code_here', // Para PIX
      // barcode: 'barcode_here' // Para boleto
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Erro na API de transações:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}