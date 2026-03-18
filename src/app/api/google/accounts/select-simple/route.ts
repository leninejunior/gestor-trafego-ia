/**
 * Google Ads Account Selection API Route
 * Salva as contas selecionadas após OAuth
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const SelectAccountsSchema = z.object({
  connectionId: z.string().min(1, 'Connection ID é obrigatório'),
  clientId: z.string().min(1, 'Client ID é obrigatório'),
  selectedAccounts: z.array(z.string()).min(1, 'Selecione pelo menos uma conta'),
});

export async function POST(request: NextRequest) {
  console.log('[Google Account Select] 🚀 INICIANDO SALVAMENTO DE CONTAS');
  
  try {
    const body = await request.json();
    console.log('[Google Account Select] 📊 DADOS RECEBIDOS:', body);
    
    const { connectionId, clientId, selectedAccounts } = SelectAccountsSchema.parse(body);

    // Obter usuário autenticado
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('[Google Account Select] ❌ USUÁRIO NÃO AUTENTICADO');
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      );
    }

    console.log('[Google Account Select] ✅ USUÁRIO AUTENTICADO:', user.id);

    // Validar que a conexão pertence ao cliente
    console.log('[Google Account Select] 🔍 VALIDANDO CONEXÃO...');
    const { data: connection, error: connectionError } = await supabase
      .from('google_ads_connections')
      .select('id, client_id, status')
      .eq('id', connectionId)
      .eq('client_id', clientId)
      .single();

    if (connectionError || !connection) {
      console.error('[Google Account Select] ❌ CONEXÃO NÃO ENCONTRADA');
      return NextResponse.json(
        { error: 'Conexão não encontrada' },
        { status: 404 }
      );
    }

    console.log('[Google Account Select] ✅ CONEXÃO VALIDADA');

    // Validar que o usuário tem acesso ao cliente
    console.log('[Google Account Select] 🔐 VALIDANDO ACESSO AO CLIENTE...');
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('id, org_id')
      .eq('id', clientId)
      .single();

    if (clientError || !clientData) {
      console.error('[Google Account Select] ❌ CLIENTE NÃO ENCONTRADO');
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      );
    }

    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', clientData.org_id)
      .eq('status', 'active')
      .single();

    if (membershipError || !membership) {
      console.error('[Google Account Select] ❌ ACESSO NEGADO');
      return NextResponse.json(
        { error: 'Você não tem acesso a este cliente' },
        { status: 403 }
      );
    }

    console.log('[Google Account Select] ✅ ACESSO VALIDADO');

    // Atualizar conexão com a primeira conta selecionada
    const primaryCustomerId = selectedAccounts[0];
    console.log('[Google Account Select] 💾 ATUALIZANDO CONEXÃO COM CUSTOMER ID:', primaryCustomerId);

    const { error: updateError } = await supabase
      .from('google_ads_connections')
      .update({
        customer_id: primaryCustomerId,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectionId);

    if (updateError) {
      console.error('[Google Account Select] ❌ ERRO AO ATUALIZAR:', updateError.message);
      return NextResponse.json(
        { error: 'Erro ao salvar seleção de contas: ' + updateError.message },
        { status: 500 }
      );
    }

    console.log('[Google Account Select] ✅ CONEXÃO ATUALIZADA COM SUCESSO');

    // Se houver múltiplas contas (MCC), criar conexões adicionais
    const additionalConnections = [];
    if (selectedAccounts.length > 1) {
      console.log('[Google Account Select] 🔗 CRIANDO CONEXÕES ADICIONAIS PARA MCC...');
      
      for (const customerId of selectedAccounts.slice(1)) {
        try {
          const { data: newConnection, error: createError } = await supabase
            .from('google_ads_connections')
            .insert({
              client_id: clientId,
              customer_id: customerId,
              access_token: connection.access_token || 'shared',
              refresh_token: connection.refresh_token || 'shared',
              token_expires_at: new Date(Date.now() + 3600000).toISOString(),
              status: 'active',
            })
            .select('id')
            .single();

          if (!createError && newConnection) {
            additionalConnections.push(newConnection.id);
            console.log('[Google Account Select] ✅ CONEXÃO ADICIONAL CRIADA:', customerId);
          }
        } catch (err) {
          console.warn('[Google Account Select] ⚠️ ERRO AO CRIAR CONEXÃO ADICIONAL:', err);
        }
      }
    }

    console.log('[Google Account Select] ✅ SALVAMENTO CONCLUÍDO');
    console.log('='.repeat(80));

    return NextResponse.json({
      success: true,
      connectionId,
      primaryCustomerId,
      selectedAccounts,
      additionalConnections,
      message: `${selectedAccounts.length} conta${selectedAccounts.length > 1 ? 's' : ''} conectada${selectedAccounts.length > 1 ? 's' : ''} com sucesso`,
    });

  } catch (error: any) {
    console.error('[Google Account Select] ❌ ERRO:', error.message);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Dados inválidos',
          details: error.errors.map(e => e.message),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error.message,
      },
      { status: 500 }
    );
  }
}