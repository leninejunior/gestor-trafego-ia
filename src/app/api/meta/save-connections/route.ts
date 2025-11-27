import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  console.log('🔄 [SAVE CONNECTIONS] Iniciando salvamento...');
  
  try {
    const body = await request.json();
    const { client_id, access_token, selected_accounts, selected_pages, ad_accounts, pages } = body;

    console.log('📦 [SAVE CONNECTIONS] Dados recebidos:', {
      client_id,
      selected_accounts: selected_accounts?.length || 0,
      selected_pages: selected_pages?.length || 0,
      ad_accounts: ad_accounts?.length || 0
    });

    if (!client_id || !access_token || !selected_accounts || selected_accounts.length === 0) {
      return NextResponse.json(
        { error: 'Dados inválidos' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    // 1. PRIMEIRO: Buscar conexões existentes para análise
    const { data: existingConnections } = await supabase
      .from('client_meta_connections')
      .select('*')
      .eq('client_id', client_id);

    console.log(`🔍 [SAVE] Conexões existentes: ${existingConnections?.length || 0}`);

    // 2. SEGUNDO: Desativar todas as conexões antigas
    const { error: deactivateError } = await supabase
      .from('client_meta_connections')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('client_id', client_id);

    if (deactivateError) {
      console.error('❌ Erro ao desativar conexões antigas:', deactivateError);
    }

    // 3. TERCEIRO: Remover duplicatas antigas (manter apenas 1 por ad_account_id)
    if (existingConnections && existingConnections.length > 0) {
      const accountGroups = existingConnections.reduce((acc, conn) => {
        if (!acc[conn.ad_account_id]) {
          acc[conn.ad_account_id] = [];
        }
        acc[conn.ad_account_id].push(conn);
        return acc;
      }, {} as Record<string, any[]>);

      const idsToDelete: string[] = [];
      
      Object.values(accountGroups).forEach(group => {
        if (group.length > 1) {
          group.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          idsToDelete.push(...group.slice(1).map(c => c.id));
        }
      });

      if (idsToDelete.length > 0) {
        const { error: deleteDupsError } = await supabase
          .from('client_meta_connections')
          .delete()
          .in('id', idsToDelete);

        if (deleteDupsError) {
          console.error('❌ Erro ao deletar duplicatas:', deleteDupsError);
        } else {
          console.log(`🗑️ [SAVE] Removidas ${idsToDelete.length} duplicatas`);
        }
      }
    }

    // 4. QUARTO: Deletar todas as conexões inativas antigas (mais de 7 dias)
    const { error: deleteOldError } = await supabase
      .from('client_meta_connections')
      .delete()
      .eq('client_id', client_id)
      .eq('is_active', false)
      .lt('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (deleteOldError) {
      console.error('❌ Erro ao deletar conexões antigas:', deleteOldError);
    }

    // 5. QUINTO: Salvar novas conexões
    const connections = selected_accounts.map((accountId: string) => {
      const account = ad_accounts.find((acc: any) => acc.id === accountId);
      return {
        client_id,
        ad_account_id: accountId,
        account_name: account?.name || 'Unknown',
        access_token,
        is_active: true
      };
    });

    const { data, error } = await supabase
      .from('client_meta_connections')
      .insert(connections)
      .select();

    if (error) {
      console.error('❌ Erro ao salvar conexões:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Conexões salvas com sucesso:', data?.length || 0);

    return NextResponse.json({
      success: true,
      connections: data
    });

  } catch (error: any) {
    console.error('💥 Erro no salvamento:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
