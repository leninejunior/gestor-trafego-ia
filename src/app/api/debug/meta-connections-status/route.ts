import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // 1. Buscar organização do usuário
    const { data: membership } = await supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Usuário sem organização' }, { status: 404 });
    }

    // 2. Buscar clientes da organização
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name')
      .eq('org_id', membership.organization_id);

    // 3. Buscar TODAS as conexões Meta (incluindo duplicatas)
    const { data: allConnections } = await supabase
      .from('client_meta_connections')
      .select('*')
      .in('client_id', clients?.map(c => c.id) || [])
      .order('created_at', { ascending: false });

    // 4. Analisar duplicatas
    const duplicateAnalysis = new Map();
    allConnections?.forEach(conn => {
      const key = `${conn.client_id}-${conn.ad_account_id}`;
      if (!duplicateAnalysis.has(key)) {
        duplicateAnalysis.set(key, []);
      }
      duplicateAnalysis.get(key).push(conn);
    });

    const duplicates = Array.from(duplicateAnalysis.entries())
      .filter(([_, conns]) => conns.length > 1)
      .map(([key, conns]) => ({
        key,
        client_id: conns[0].client_id,
        ad_account_id: conns[0].ad_account_id,
        total_duplicates: conns.length,
        connections: conns.map(c => ({
          id: c.id,
          is_active: c.is_active,
          created_at: c.created_at,
          account_name: c.account_name
        }))
      }));

    // 5. Contar conexões únicas
    const uniqueAccounts = new Set(
      allConnections?.map(c => `${c.client_id}-${c.ad_account_id}`)
    ).size;

    return NextResponse.json({
      user_id: user.id,
      organization_id: membership.organization_id,
      total_clients: clients?.length || 0,
      total_connections: allConnections?.length || 0,
      unique_accounts: uniqueAccounts,
      has_duplicates: duplicates.length > 0,
      duplicates,
      all_connections: allConnections?.map(c => ({
        id: c.id,
        client_id: c.client_id,
        ad_account_id: c.ad_account_id,
        account_name: c.account_name,
        is_active: c.is_active,
        created_at: c.created_at
      }))
    });

  } catch (error: any) {
    console.error('Erro ao diagnosticar conexões Meta:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
