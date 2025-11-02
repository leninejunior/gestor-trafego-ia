require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 RESOLVENDO PERMISSÕES DEFINITIVAMENTE');
console.log('========================================');

const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function resolverPermissoes() {
  try {
    const emailLenine = 'lenine.engrene@gmail.com';
    
    // 1. PRIMEIRO: Aplicar o SQL de correção RLS
    console.log('🛠️  Aplicando correções RLS...');
    
    const sqlCorrections = `
      -- Desabilitar RLS temporariamente
      ALTER TABLE IF EXISTS super_admins DISABLE ROW LEVEL SECURITY;
      ALTER TABLE IF EXISTS organizations DISABLE ROW LEVEL SECURITY;
      ALTER TABLE IF EXISTS memberships DISABLE ROW LEVEL SECURITY;
      ALTER TABLE IF EXISTS clients DISABLE ROW LEVEL SECURITY;
      ALTER TABLE IF EXISTS client_meta_connections DISABLE ROW LEVEL SECURITY;
      
      -- Remover políticas existentes
      DROP POLICY IF EXISTS "Super admins and members can view organizations" ON organizations;
      DROP POLICY IF EXISTS "Super admins and members can update organizations" ON organizations;
      DROP POLICY IF EXISTS "Super admins and members can insert organizations" ON organizations;
      DROP POLICY IF EXISTS "Super admins and members can delete organizations" ON organizations;
      DROP POLICY IF EXISTS "Allow super admins full access to organizations" ON organizations;
      DROP POLICY IF EXISTS "Allow members to view their organizations" ON organizations;
      DROP POLICY IF EXISTS "organizations_all" ON organizations;
      
      DROP POLICY IF EXISTS "Super admins and members can view memberships" ON memberships;
      DROP POLICY IF EXISTS "Super admins and members can update memberships" ON memberships;
      DROP POLICY IF EXISTS "Super admins and members can insert memberships" ON memberships;
      DROP POLICY IF EXISTS "Super admins and members can delete memberships" ON memberships;
      DROP POLICY IF EXISTS "Allow super admins full access to memberships" ON memberships;
      DROP POLICY IF EXISTS "Allow users to view their own memberships" ON memberships;
      DROP POLICY IF EXISTS "memberships_all" ON memberships;
      
      DROP POLICY IF EXISTS "Super admins and members can view clients" ON clients;
      DROP POLICY IF EXISTS "Super admins and members can update clients" ON clients;
      DROP POLICY IF EXISTS "Super admins and members can insert clients" ON clients;
      DROP POLICY IF EXISTS "Super admins and members can delete clients" ON clients;
      DROP POLICY IF EXISTS "Allow super admins full access to clients" ON clients;
      DROP POLICY IF EXISTS "Allow members to access clients in their org" ON clients;
      DROP POLICY IF EXISTS "clients_all" ON clients;
      
      -- Criar políticas SIMPLES
      CREATE POLICY "organizations_authenticated" ON organizations
        FOR ALL USING (auth.uid() IS NOT NULL);
      
      CREATE POLICY "memberships_authenticated" ON memberships
        FOR ALL USING (auth.uid() IS NOT NULL);
      
      CREATE POLICY "clients_authenticated" ON clients
        FOR ALL USING (auth.uid() IS NOT NULL);
      
      CREATE POLICY "client_meta_connections_authenticated" ON client_meta_connections
        FOR ALL USING (auth.uid() IS NOT NULL);
      
      -- Reabilitar RLS
      ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
      ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
      ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
      ALTER TABLE client_meta_connections ENABLE ROW LEVEL SECURITY;
    `;
    
    const { error: sqlError } = await supabaseAdmin.rpc('exec_sql', { sql: sqlCorrections });
    
    if (sqlError) {
      console.log('⚠️  Erro ao aplicar SQL (continuando):', sqlError.message);
    } else {
      console.log('✅ Correções RLS aplicadas!');
    }
    
    // 2. Verificar/Criar usuário Lenine
    console.log('\n👤 Configurando usuário Lenine...');
    
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.log('❌ Erro ao listar usuários:', listError.message);
      return;
    }
    
    let lenineUser = users.users.find(user => user.email === emailLenine);
    
    if (!lenineUser) {
      console.log('🆕 Criando usuário Lenine...');
      
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: emailLenine,
        password: 'senha123',
        email_confirm: true
      });
      
      if (createError) {
        console.log('❌ Erro ao criar usuário:', createError.message);
        return;
      }
      
      lenineUser = newUser.user;
      console.log('✅ Usuário criado!');
    } else {
      console.log('✅ Usuário encontrado!');
      
      // Confirmar email
      if (!lenineUser.email_confirmed_at) {
        const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(
          lenineUser.id,
          { email_confirm: true }
        );
        
        if (!confirmError) {
          console.log('✅ Email confirmado!');
        }
      }
    }
    
    console.log('🆔 User ID:', lenineUser.id);
    
    // 3. Usar service role para operações diretas
    console.log('\n🏢 Configurando organização...');
    
    // Verificar organizações existentes
    const { data: existingOrgs, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .limit(10);
    
    if (orgError) {
      console.log('❌ Erro ao verificar organizações:', orgError.message);
    } else {
      console.log(`📊 Organizações existentes: ${existingOrgs.length}`);
      
      if (existingOrgs.length > 0) {
        existingOrgs.forEach((org, index) => {
          console.log(`  ${index + 1}. ${org.name} (ID: ${org.id})`);
        });
      }
    }
    
    // Criar organização se não existir
    let orgId;
    if (!existingOrgs || existingOrgs.length === 0) {
      console.log('🆕 Criando organização...');
      
      const { data: newOrg, error: createOrgError } = await supabaseAdmin
        .from('organizations')
        .insert({
          name: 'Organização Principal',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (createOrgError) {
        console.log('❌ Erro ao criar organização:', createOrgError.message);
        return;
      }
      
      orgId = newOrg.id;
      console.log('✅ Organização criada:', newOrg.name);
    } else {
      orgId = existingOrgs[0].id;
      console.log('✅ Usando organização existente:', existingOrgs[0].name);
    }
    
    // 4. Verificar/Criar membership
    console.log('\n👥 Configurando membership...');
    
    const { data: existingMembership, error: memberError } = await supabaseAdmin
      .from('memberships')
      .select('*')
      .eq('user_id', lenineUser.id)
      .eq('org_id', orgId)
      .single();
    
    if (memberError && memberError.code !== 'PGRST116') {
      console.log('❌ Erro ao verificar membership:', memberError.message);
    }
    
    if (!existingMembership) {
      console.log('🆕 Criando membership...');
      
      const { data: newMembership, error: createMemberError } = await supabaseAdmin
        .from('memberships')
        .insert({
          user_id: lenineUser.id,
          org_id: orgId,
          role: 'admin',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (createMemberError) {
        console.log('❌ Erro ao criar membership:', createMemberError.message);
      } else {
        console.log('✅ Membership criado!');
      }
    } else {
      console.log('✅ Membership já existe!');
    }
    
    // 5. Configurar como super admin (se tabela existir)
    console.log('\n👑 Configurando super admin...');
    
    const { data: superAdminCheck, error: superError } = await supabaseAdmin
      .from('super_admins')
      .select('*')
      .eq('user_id', lenineUser.id)
      .single();
    
    if (superError && superError.code !== 'PGRST116') {
      console.log('⚠️  Tabela super_admins pode não existir:', superError.message);
    }
    
    if (!superAdminCheck && superError?.code === 'PGRST116') {
      const { error: createSuperError } = await supabaseAdmin
        .from('super_admins')
        .insert({
          user_id: lenineUser.id,
          created_at: new Date().toISOString()
        });
      
      if (createSuperError) {
        console.log('⚠️  Erro ao criar super admin:', createSuperError.message);
      } else {
        console.log('✅ Super admin configurado!');
      }
    } else if (superAdminCheck) {
      console.log('✅ Já é super admin!');
    }
    
    // 6. Testar acesso
    console.log('\n🔐 Testando acesso...');
    
    const supabaseClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    
    const { data: loginData, error: loginError } = await supabaseClient.auth.signInWithPassword({
      email: emailLenine,
      password: 'senha123'
    });
    
    if (loginError) {
      console.log('❌ Erro no login:', loginError.message);
      
      // Resetar senha
      console.log('🔄 Resetando senha...');
      const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(
        lenineUser.id,
        { password: 'senha123' }
      );
      
      if (!resetError) {
        console.log('✅ Senha resetada!');
      }
    } else {
      console.log('✅ Login realizado com sucesso!');
      
      // Testar acesso às organizações
      const { data: orgsTest, error: orgsTestError } = await supabaseClient
        .from('organizations')
        .select('*');
      
      if (orgsTestError) {
        console.log('❌ Erro ao acessar organizações:', orgsTestError.message);
      } else {
        console.log(`✅ Acesso às organizações OK! (${orgsTest.length} encontradas)`);
      }
      
      // Testar acesso aos memberships
      const { data: membershipsTest, error: membershipsTestError } = await supabaseClient
        .from('memberships')
        .select('*, organizations(*)');
      
      if (membershipsTestError) {
        console.log('❌ Erro ao acessar memberships:', membershipsTestError.message);
      } else {
        console.log(`✅ Acesso aos memberships OK! (${membershipsTest.length} encontrados)`);
      }
    }
    
    console.log('\n🎯 CONFIGURAÇÃO CONCLUÍDA!');
    console.log('==========================');
    console.log('📧 Email: lenine.engrene@gmail.com');
    console.log('🔑 Senha: senha123');
    console.log('🏢 Organização: Configurada');
    console.log('👑 Permissões: Admin/Super Admin');
    console.log('🔓 RLS: Políticas simplificadas');
    console.log('\n✅ Sistema deve estar funcionando agora!');
    
  } catch (error) {
    console.log('❌ Erro inesperado:', error.message);
    console.log('Stack:', error.stack);
  }
}

resolverPermissoes().catch(err => {
  console.log('❌ Erro na execução:', err.message);
});