require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não configuradas');
  process.exit(1);
}

async function checkSuperAdmin(supabase, userId) {
  // Verificar memberships do usuário
  const { data: memberships } = await supabase
    .from("memberships")
    .select(`
      role,
      role_id,
      user_roles (
        name
      )
    `)
    .eq("user_id", userId)
    .eq("status", "active");

  if (!memberships || memberships.length === 0) {
    return false;
  }

  // Verificar se alguma membership tem super_admin
  return memberships.some(membership => 
    membership.role === 'super_admin' || 
    membership.user_roles?.name === 'super_admin'
  );
}

async function testCheckSuperAdminFunction() {
  console.log('🔍 Testando função checkSuperAdmin...\n');
  
  const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);

  // Testar com usuários conhecidos
  const testUsers = [
    { id: '980d1d5f-6bca-4d3f-b756-0fc0999b7658', email: 'lenine.engrene@gmail.com' },
    { id: '5522b698-f20d-4669-853c-cac60e5f7edf', email: 'admin@sistema.com' },
    { id: '9eceeafc-9a92-4287-9b30-2bd05487cac8', email: 'teste@exemplo.co' }
  ];

  for (const testUser of testUsers) {
    console.log(`Testando usuário: ${testUser.email}`);
    
    const { data: memberships } = await serviceSupabase
      .from("memberships")
      .select(`
        role,
        role_id,
        user_roles (
          name
        )
      `)
      .eq("user_id", testUser.id)
      .eq("status", "active");

    console.log('Memberships encontradas:', JSON.stringify(memberships, null, 2));

    const isSuperAdmin = await checkSuperAdmin(serviceSupabase, testUser.id);
    console.log(`${isSuperAdmin ? '✅' : '❌'} É super admin: ${isSuperAdmin}\n`);
  }
}

testCheckSuperAdminFunction();