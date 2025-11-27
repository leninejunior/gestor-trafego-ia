import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user's organization memberships
    const { data: memberships, error: membershipError } = await supabase
      .from('memberships')
      .select('organization_id, status')
      .eq('user_id', user.id);

    if (membershipError) {
      return Response.json({ error: membershipError.message }, { status: 500 });
    }

    // Get user's clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, org_id')
      .in('org_id', memberships?.map(m => m.organization_id) || []);

    if (clientsError) {
      return Response.json({ error: clientsError.message }, { status: 500 });
    }

    // Get Google Ads connections WITH RLS applied
    const { data: connections, error: connectionsError } = await supabase
      .from('google_ads_connections')
      .select('id, client_id, customer_id, status');

    if (connectionsError) {
      return Response.json({ error: connectionsError.message }, { status: 500 });
    }

    // Get ALL Google Ads connections (bypass RLS - admin only)
    const { data: allConnections, error: allError } = await supabase
      .rpc('get_all_google_connections');

    return Response.json({
      user_id: user.id,
      user_email: user.email,
      memberships: memberships?.length || 0,
      organization_ids: memberships?.map(m => m.organization_id),
      clients_count: clients?.length || 0,
      clients: clients,
      connections_with_rls: connections?.length || 0,
      connections_with_rls_data: connections,
      all_connections_count: allConnections?.length || 0,
      all_connections: allConnections,
      rls_working: (connections?.length || 0) < (allConnections?.length || 0),
      message: (connections?.length || 0) < (allConnections?.length || 0) 
        ? '✅ RLS is working - you see fewer connections than exist'
        : '❌ RLS might not be working - you see all connections'
    });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
