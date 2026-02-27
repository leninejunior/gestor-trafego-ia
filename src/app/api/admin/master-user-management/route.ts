import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { UserAccessControl } from '@/lib/services/user-access-control';

type AuthUserSummary = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
};

async function listAllAuthUsers(serviceSupabase: ReturnType<typeof createServiceClient>): Promise<AuthUserSummary[]> {
  const perPage = 200;
  let page = 1;
  const allUsers: AuthUserSummary[] = [];

  while (true) {
    const { data, error } = await serviceSupabase.auth.admin.listUsers({
      page,
      perPage
    });

    if (error) {
      throw new Error(`Erro ao listar usuários do Auth: ${error.message}`);
    }

    const users = data?.users ?? [];
    allUsers.push(
      ...users.map((u) => ({
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null
      }))
    );

    if (users.length < perPage) {
      break;
    }

    page += 1;
  }

  return allUsers;
}

// GET - Listar todos os usuários para master users
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const serviceSupabase = createServiceClient();
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar se é master user
    const accessControl = new UserAccessControl();
    const isMaster = await accessControl.isMasterUser(user.id);
    
    if (!isMaster) {
      return NextResponse.json({ error: 'Access denied: Master user required' }, { status: 403 });
    }

    // Buscar todos os usuários do sistema
    const allUsers = await listAllAuthUsers(serviceSupabase);

    // Buscar master users
    const { data: masterUsers, error: masterError } = await serviceSupabase
      .from('master_users')
      .select('user_id')
      .eq('is_active', true);

    if (masterError) throw masterError;

    // Buscar client users
    const { data: clientUsers, error: clientError } = await serviceSupabase
      .from('client_users')
      .select(`
        user_id,
        client_id,
        clients!inner(id, name)
      `)
      .eq('is_active', true);

    if (clientError) throw clientError;

    // Buscar memberships (usuários regulares)
    const { data: memberships, error: membershipError } = await serviceSupabase
      .from('memberships')
      .select(`
        user_id,
        organization_id,
        role,
        organizations!inner(id, name)
      `);

    if (membershipError) throw membershipError;

    // Mapear tipos de usuário
    const masterUserIds = new Set(masterUsers?.map(m => m.user_id) || []);
    const clientUserMap = new Map();
    clientUsers?.forEach(cu => {
      if (!clientUserMap.has(cu.user_id)) {
        clientUserMap.set(cu.user_id, []);
      }
      clientUserMap.get(cu.user_id).push({
        client_id: cu.client_id,
        client_name: cu.clients.name
      });
    });

    const membershipMap = new Map();
    memberships?.forEach(m => {
      if (!membershipMap.has(m.user_id)) {
        membershipMap.set(m.user_id, []);
      }
      membershipMap.get(m.user_id).push({
        organization_id: m.organization_id,
        organization_name: m.organizations.name,
        role: m.role
      });
    });

    // Combinar dados
    const usersWithTypes = allUsers.map(user => ({
      ...user,
      type: masterUserIds.has(user.id) ? 'master' : 
            clientUserMap.has(user.id) ? 'client' : 
            membershipMap.has(user.id) ? 'regular' : 'unassigned',
      client_access: clientUserMap.get(user.id) || [],
      organization_access: membershipMap.get(user.id) || []
    }));

    usersWithTypes.sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return bTime - aTime;
    });

    return NextResponse.json({
      users: usersWithTypes,
      total: usersWithTypes.length,
      master_count: usersWithTypes.filter(u => u.type === 'master').length,
      client_count: usersWithTypes.filter(u => u.type === 'client').length,
      regular_count: usersWithTypes.filter(u => u.type === 'regular').length,
      unassigned_count: usersWithTypes.filter(u => u.type === 'unassigned').length
    });

  } catch (error: any) {
    console.error('Error fetching users for master:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST - Criar novo usuário e dar acesso específico
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar se é master user
    const accessControl = new UserAccessControl();
    const isMaster = await accessControl.isMasterUser(user.id);
    
    if (!isMaster) {
      return NextResponse.json({ error: 'Access denied: Master user required' }, { status: 403 });
    }

    const { email, password, user_type, client_ids, notes } = await request.json();

    if (!email || !password || !user_type) {
      return NextResponse.json({ 
        error: 'Email, password and user_type are required' 
      }, { status: 400 });
    }

    if (!['master', 'client', 'regular'].includes(user_type)) {
      return NextResponse.json({ 
        error: 'Invalid user_type. Must be: master, client, or regular' 
      }, { status: 400 });
    }

    // Criar usuário no Supabase Auth
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (createError) {
      return NextResponse.json({ 
        error: `Failed to create user: ${createError.message}` 
      }, { status: 400 });
    }

    if (!newUser.user) {
      return NextResponse.json({ 
        error: 'User creation failed' 
      }, { status: 500 });
    }

    const newUserId = newUser.user.id;

    // Configurar tipo de usuário
    switch (user_type) {
      case 'master':
        const masterSuccess = await accessControl.createMasterUser(
          newUserId,
          user.id,
          notes || 'Usuário master criado via painel administrativo'
        );
        if (!masterSuccess) {
          throw new Error('Failed to create master user record');
        }
        break;

      case 'client':
        if (!client_ids || !Array.isArray(client_ids) || client_ids.length === 0) {
          return NextResponse.json({ 
            error: 'client_ids array is required for client users' 
          }, { status: 400 });
        }

        // Criar acesso para cada cliente
        for (const clientId of client_ids) {
          const clientSuccess = await accessControl.createClientUser(
            newUserId,
            clientId,
            user.id,
            {
              read_campaigns: true,
              read_reports: true,
              read_insights: true
            },
            notes || `Usuário cliente criado via painel administrativo - Cliente: ${clientId}`
          );
          if (!clientSuccess) {
            console.error(`Failed to create client user record for client ${clientId}`);
          }
        }
        break;

      case 'regular':
        // Para usuários regulares, não fazemos nada especial
        // Eles precisarão ser adicionados a organizações manualmente
        break;
    }

    return NextResponse.json({
      success: true,
      user: {
        id: newUserId,
        email: newUser.user.email,
        type: user_type,
        client_ids: user_type === 'client' ? client_ids : undefined
      },
      message: `Usuário ${user_type} criado com sucesso`
    });

  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create user' },
      { status: 500 }
    );
  }
}
