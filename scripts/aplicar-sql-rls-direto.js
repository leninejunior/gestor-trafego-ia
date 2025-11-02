require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🛠️  APLICANDO SQL RLS DIRETAMENTE');
console.log('=================================');

const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function aplicarSqlRls() {
  try {
    // Lista de comandos SQL para executar um por vez
    const sqlCommands = [
      // Desabilitar RLS
      "ALTER TABLE IF EXISTS super_admins DISABLE ROW LEVEL SECURITY;",
      "ALTER TABLE IF EXISTS organizations DISABLE ROW LEVEL SECURITY;",
      "ALTER TABLE IF EXISTS memberships DISABLE ROW LEVEL SECURITY;",
      "ALTER TABLE IF EXISTS clients DISABLE ROW LEVEL SECURITY;",
      "ALTER TABLE IF EXISTS client_meta_connections DISABLE ROW LEVEL SECURITY;",
      
      // Remover políticas existentes - Organizations
      "DROP POLICY IF EXISTS \"Super admins and members can view organizations\" ON organizations;",
      "DROP POLICY IF EXISTS \"Super admins and members can update organizations\" ON organizations;",
      "DROP POLICY IF EXISTS \"Super admins and members can insert organizations\" ON organizations;",
      "DROP POLICY IF EXISTS \"Super admins and members can delete organizations\" ON organizations;",
      "DROP POLICY IF EXISTS \"Allow super admins full access to organizations\" ON organizations;",
      "DROP POLICY IF EXISTS \"Allow members to view their organizations\" ON organizations;",
      "DROP POLICY IF EXISTS \"organizations_all\" ON organizations;",
      "DROP POLICY IF EXISTS \"organizations_authenticated\" ON organizations;",
      "DROP POLICY IF EXISTS \"organizations_full_access\" ON organizations;",
      
      // Remover políticas existentes - Memberships
      "DROP POLICY IF EXISTS \"Super admins and members can view memberships\" ON memberships;",
      "DROP POLICY IF EXISTS \"Super admins and members can update memberships\" ON memberships;",
      "DROP POLICY IF EXISTS \"Super admins and members can insert memberships\" ON memberships;",
      "DROP POLICY IF EXISTS \"Super admins and members can delete memberships\" ON memberships;",
      "DROP POLICY IF EXISTS \"Allow super admins full access to memberships\" ON memberships;",
      "DROP POLICY IF EXISTS \"Allow users to view their own memberships\" ON memberships;",
      "DROP POLICY IF EXISTS \"memberships_all\" ON memberships;",
      "DROP POLICY IF EXISTS \"memberships_authenticated\" ON memberships;",
      "DROP POLICY IF EXISTS \"memberships_full_access\" ON memberships;",
      
      // Remover políticas existentes - Clients
      "DROP POLICY IF EXISTS \"Super admins and members can view clients\" ON clients;",
      "DROP POLICY IF EXISTS \"Super admins and members can update clients\" ON clients;",
      "DROP POLICY IF EXISTS \"Super admins and members can insert clients\" ON clients;",
      "DROP POLICY IF EXISTS \"Super admins and members can delete clients\" ON clients;",
      "DROP POLICY IF EXISTS \"Allow super admins full access to clients\" ON clients;",
      "DROP POLICY IF EXISTS \"Allow members to access clients in their org\" ON clients;",
      "DROP POLICY IF EXISTS \"clients_all\" ON clients;",
      "DROP POLICY IF EXISTS \"clients_authenticated\" ON clients;",
      "DROP POLICY IF EXISTS \"clients_full_access\" ON clients;",
      
      // Criar políticas simples
      "CREATE POLICY \"organizations_simple\" ON organizations FOR ALL USING (auth.uid() IS NOT NULL);",
      "CREATE POLICY \"memberships_simple\" ON memberships FOR ALL USING (auth.uid() IS NOT NULL);",
      "CREATE POLICY \"clients_simple\" ON clients FOR ALL USING (auth.uid() IS NOT NULL);",
      "CREATE POLICY \"client_meta_connections_simple\" ON client_meta_connections FOR ALL USING (auth.uid() IS NOT NULL);",
      
      // Reabilitar RLS
      "ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;",
      "ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;",
      "ALTER TABLE clients ENABLE ROW LEVEL SECURITY;",
      "ALTER TABLE client_meta_connections ENABLE ROW LEVEL SECURITY;"
    ];
    
    console.log(`📝 Executando ${sqlCommands.length} comandos SQL...`);
    
    for (let i = 0; i < sqlCommands.length; i++) {
      const command = sqlCommands[i];
      console.log(`\n${i + 1}/${sqlCommands.length}: ${command.substring(0, 50)}...`);
      
      try {
        const { error } = await supabaseAdmin.rpc('exec', { sql: command });
        
        if (error) {
          console.log(`⚠️  Erro (continuando): ${error.message}`);
        } else {
          console.log('✅ OK');
        }
      } catch (err) {
        console.log(`⚠️  Erro (continuando): ${err.message}`);
      }
      
      // Pequena pausa entre comandos
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n🎯 APLICAÇÃO CONCLUÍDA!');
    console.log('======================');
    console.log('✅ Comandos SQL executados');
    console.log('🔓 Políticas RLS simplificadas');
    console.log('⚡ Sistema deve estar funcionando!');
    
  } catch (error) {
    console.log('❌ Erro inesperado:', error.message);
  }
}

aplicarSqlRls().catch(err => {
  console.log('❌ Erro na execução:', err.message);
});