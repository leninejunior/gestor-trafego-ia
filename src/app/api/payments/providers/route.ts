import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PaymentProvider, PaymentProviderConfig } from '@/lib/types/payments';

// GET /api/payments/providers - Listar provedores da organização
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
      .from('organization_memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 });
    }

    // Buscar provedores da organização
    const { data: providers, error } = await supabase
      .from('payment_providers')
      .select('*')
      .eq('org_id', membership.organization_id)
      .order('priority', { ascending: true });

    if (error) {
      console.error('Erro ao buscar provedores:', error);
      return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }

    return NextResponse.json({ providers });

  } catch (error) {
    console.error('Erro na API de provedores:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST /api/payments/providers - Criar/atualizar provedor
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
      .from('organization_memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const { name, display_name, is_active, is_sandbox, priority, config } = body;

    // Validar dados obrigatórios
    if (!name || !display_name) {
      return NextResponse.json({ 
        error: 'Nome e nome de exibição são obrigatórios' 
      }, { status: 400 });
    }

    // Validar provedor suportado
    const supportedProviders = ['stripe', 'iugu', 'pagseguro', 'mercadopago'];
    if (!supportedProviders.includes(name)) {
      return NextResponse.json({ 
        error: 'Provedor não suportado' 
      }, { status: 400 });
    }

    // Inserir ou atualizar provedor
    const { data: provider, error } = await supabase
      .from('payment_providers')
      .upsert({
        organization_id: membership.organization_id,
        name,
        display_name,
        is_active: is_active ?? true,
        is_sandbox: is_sandbox ?? true,
        priority: priority ?? 1,
        config: config ?? {}
      }, {
        onConflict: 'org_id,name'
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar provedor:', error);
      return NextResponse.json({ error: 'Erro ao salvar provedor' }, { status: 500 });
    }

    // Log de auditoria
    await supabase
      .from('payment_audit_logs')
      .insert({
        organization_id: membership.organization_id,
        user_id: user.id,
        action: 'create_provider',
        entity_type: 'provider',
        entity_id: provider.id,
        new_data: provider,
        metadata: { ip: request.headers.get('x-forwarded-for') }
      });

    return NextResponse.json({ provider });

  } catch (error) {
    console.error('Erro na API de provedores:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}