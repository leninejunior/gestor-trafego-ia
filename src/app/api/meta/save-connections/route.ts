import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createAccessControl } from '@/lib/middleware/user-access-middleware';

// Requirements: 6.2, 6.4 - Bloquear criação por usuários comuns, 4.1, 4.2, 4.3 - Validar limites
const saveConnections = createAccessControl.createConnection('Usuários comuns não podem criar conexões')

export async function POST(request: NextRequest) {
  return saveConnections(async (request: NextRequest, context: any) => {
    console.log('🔄 [SAVE CONNECTIONS] Iniciando salvamento...');
    
    try {
      const serviceSupabase = createServiceClient();
      const body = await request.json();
      const { client_id, access_token, selected_accounts, selected_pages, ad_accounts } = body;
      const selectedAccounts = Array.isArray(selected_accounts) ? selected_accounts.map(String) : [];
      const adAccounts = Array.isArray(ad_accounts) ? ad_accounts : [];

      console.log('📦 [SAVE CONNECTIONS] Dados recebidos:', {
        client_id,
        selected_accounts: selectedAccounts.length,
        selected_pages: selected_pages?.length || 0,
        ad_accounts: adAccounts.length
      });

      if (!client_id || !access_token || selectedAccounts.length === 0) {
        return NextResponse.json(
          { error: 'Dados inválidos' },
          { status: 400 }
        );
      }

      if (typeof context?.hasClientAccess !== 'function') {
        return NextResponse.json(
          { error: 'Contexto de acesso inválido' },
          { status: 500 }
        );
      }

      // Verificar se o usuário tem acesso ao cliente
      const hasAccess = await context.hasClientAccess(context.user.id, client_id);
      
      if (!hasAccess) {
        return NextResponse.json(
          { 
            error: 'Acesso negado: você não tem permissão para criar conexões para este cliente',
            code: 'CLIENT_ACCESS_DENIED'
          },
          { status: 403 }
        );
      }

      // Verificar se cliente existe
      const { data: clientData, error: clientError } = await serviceSupabase
        .from('clients')
        .select('id')
        .eq('id', client_id)
        .single();

      if (clientError || !clientData) {
        console.error('❌ [SAVE CONNECTIONS] Cliente não encontrado:', clientError);
        return NextResponse.json(
          { error: 'Cliente não encontrado' },
          { status: 404 }
        );
      }

      const uniqueSelectedAccounts = Array.from(new Set(selectedAccounts));
      const nowIso = new Date().toISOString();

      // Limpa conexões anteriores do cliente para manter o estado idêntico ao selecionado no fluxo atual.
      const { error: deleteError } = await serviceSupabase
        .from('client_meta_connections')
        .delete()
        .eq('client_id', client_id);

      if (deleteError) {
        console.error('❌ [SAVE CONNECTIONS] Erro ao limpar conexões antigas:', deleteError);
        return NextResponse.json(
          { error: 'Erro ao limpar conexões antigas' },
          { status: 500 }
        );
      }

      const connections = uniqueSelectedAccounts.map((accountId: string) => {
        const account = adAccounts.find((acc: { id: string; name?: string; currency?: string }) => acc.id === accountId);
        return {
          client_id,
          ad_account_id: accountId,
          account_name: account?.name || 'Unknown',
          access_token,
          currency: account?.currency || 'USD',
          is_active: true,
          updated_at: nowIso
        };
      });

      const { data, error: upsertError } = await serviceSupabase
        .from('client_meta_connections')
        .upsert(connections, {
          onConflict: 'client_id,ad_account_id',
          ignoreDuplicates: false,
        })
        .select('*');

      if (upsertError) {
        console.error('❌ [SAVE CONNECTIONS] Erro ao salvar conexões:', upsertError);
        return NextResponse.json(
          { error: 'Erro ao salvar conexões' },
          { status: 500 }
        );
      }

      const savedConnections = data || [];
      console.log('✅ Conexões salvas com sucesso:', savedConnections.length);

      return NextResponse.json({
        success: true,
        message: `${savedConnections.length} conta(s) conectada(s) com sucesso`,
        connections: savedConnections
      });

    } catch (error: unknown) {
      console.error('💥 Erro no salvamento:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Erro interno' },
        { status: 500 }
      );
    }
  })(request)
}
