/**
 * API para sincronizar dados com o Iugu
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { intent_id } = await request.json();

    // Verificar autenticação e permissões de admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Verificar se é admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    if (!intent_id) {
      return NextResponse.json({ 
        error: 'Intent ID é obrigatório' 
      }, { status: 400 });
    }

    // Buscar dados do intent
    const { data: intent, error: fetchError } = await supabase
      .from('subscription_intents')
      .select('*')
      .eq('id', intent_id)
      .single();

    if (fetchError || !intent) {
      return NextResponse.json({ 
        error: 'Intent não encontrado' 
      }, { status: 404 });
    }

    // Executar sincronização
    const syncResult = await syncWithIugu(supabase, intent, user.id);

    // Log da ação administrativa
    await supabase
      .from('admin_action_logs')
      .insert({
        action_type: 'sync_iugu',
        intent_id: intent_id,
        admin_user_id: user.id,
        reason: 'Manual Iugu synchronization',
        result: syncResult,
        created_at: new Date().toISOString()
      });

    return NextResponse.json({
      success: true,
      message: 'Sincronização com Iugu concluída',
      result: syncResult
    });

  } catch (error) {
    console.error('Error syncing with Iugu:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

async function syncWithIugu(supabase: any, intent: any, adminUserId: string) {
  const result = {
    intent_id: intent.id,
    sync_timestamp: new Date().toISOString(),
    actions_performed: [] as string[],
    iugu_data: {} as any,
    local_updates: {} as any,
    status: 'success'
  };

  try {
    // Verificar configuração do Iugu
    const iuguApiToken = process.env.IUGU_API_TOKEN;
    if (!iuguApiToken) {
      throw new Error('IUGU_API_TOKEN não configurado');
    }

    // Se o intent tem customer_id do Iugu, buscar dados do cliente
    if (intent.iugu_customer_id) {
      const customerData = await fetchIuguCustomer(intent.iugu_customer_id);
      result.iugu_data.customer = customerData;
      result.actions_performed.push('fetch_customer_data');
    }

    // Se o intent tem subscription_id do Iugu, buscar dados da assinatura
    if (intent.iugu_subscription_id) {
      const subscriptionData = await fetchIuguSubscription(intent.iugu_subscription_id);
      result.iugu_data.subscription = subscriptionData;
      result.actions_performed.push('fetch_subscription_data');

      // Verificar se o status local está desatualizado
      if (subscriptionData.status !== intent.status) {
        const newStatus = mapIuguStatusToLocal(subscriptionData.status);
        
        await supabase
          .from('subscription_intents')
          .update({
            status: newStatus,
            updated_at: new Date().toISOString(),
            metadata: {
              ...intent.metadata,
              synced_from_iugu: true,
              sync_timestamp: new Date().toISOString(),
              admin_user_id: adminUserId
            }
          })
          .eq('id', intent.id);

        result.local_updates.status_updated = {
          from: intent.status,
          to: newStatus,
          iugu_status: subscriptionData.status
        };
        result.actions_performed.push('update_local_status');
      }
    }

    // Buscar faturas relacionadas
    if (intent.iugu_subscription_id) {
      const invoices = await fetchIuguInvoices(intent.iugu_subscription_id);
      result.iugu_data.invoices = invoices;
      result.actions_performed.push('fetch_invoices');

      // Verificar se há faturas pagas que não foram processadas
      const paidInvoices = invoices.filter((inv: any) => inv.status === 'paid');
      if (paidInvoices.length > 0 && intent.status !== 'completed') {
        await supabase
          .from('subscription_intents')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', intent.id);

        result.local_updates.completed_from_paid_invoice = true;
        result.actions_performed.push('activate_from_paid_invoice');
      }
    }

    // Verificar se precisa criar recursos no Iugu
    if (!intent.iugu_customer_id) {
      const customerData = await createIuguCustomer({
        email: intent.user_email,
        name: intent.user_name,
        cpf_cnpj: intent.cpf_cnpj
      });

      await supabase
        .from('subscription_intents')
        .update({
          iugu_customer_id: customerData.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', intent.id);

      result.iugu_data.created_customer = customerData;
      result.actions_performed.push('create_iugu_customer');
    }

  } catch (error) {
    result.status = 'error';
    result.error = error instanceof Error ? error.message : 'Erro desconhecido';
  }

  return result;
}

// Simulações das chamadas para a API do Iugu
// Em produção, estas seriam chamadas reais para a API

async function fetchIuguCustomer(customerId: string) {
  // Simular chamada para API do Iugu
  return {
    id: customerId,
    email: 'customer@example.com',
    name: 'Customer Name',
    created_at: new Date().toISOString(),
    status: 'active'
  };
}

async function fetchIuguSubscription(subscriptionId: string) {
  // Simular chamada para API do Iugu
  return {
    id: subscriptionId,
    status: 'active',
    plan_identifier: 'plan_123',
    customer_id: 'customer_123',
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  };
}

async function fetchIuguInvoices(subscriptionId: string) {
  // Simular chamada para API do Iugu
  return [
    {
      id: 'invoice_123',
      status: 'paid',
      total: 9900, // em centavos
      due_date: new Date().toISOString(),
      paid_at: new Date().toISOString(),
      subscription_id: subscriptionId
    }
  ];
}

async function createIuguCustomer(customerData: any) {
  // Simular criação de cliente no Iugu
  return {
    id: `customer_${Date.now()}`,
    email: customerData.email,
    name: customerData.name,
    cpf_cnpj: customerData.cpf_cnpj,
    created_at: new Date().toISOString()
  };
}

function mapIuguStatusToLocal(iuguStatus: string): string {
  const statusMap: { [key: string]: string } = {
    'active': 'completed',
    'suspended': 'failed',
    'cancelled': 'cancelled',
    'pending': 'pending'
  };

  return statusMap[iuguStatus] || 'pending';
}