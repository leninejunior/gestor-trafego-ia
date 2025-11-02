require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDatabaseStructure() {
  try {
    console.log('🔍 Verificando estrutura do banco de dados...\n');

    // Verificar tabelas existentes
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_table_names');

    if (tablesError) {
      console.log('Tentando método alternativo para listar tabelas...');
      
      // Método alternativo - verificar tabelas específicas
      const tablesToCheck = ['user_profiles', 'memberships', 'user_roles', 'organizations'];
      
      for (const table of tablesToCheck) {
        try {
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .limit(1);
          
          if (error) {
            console.log(`❌ Tabela '${table}': ${error.message}`);
          } else {
            console.log(`✅ Tabela '${table}': existe`);
          }
        } catch (e) {
          console.log(`❌ Tabela '${table}': erro ao verificar`);
        }
      }
    } else {
      console.log('📊 Tabelas encontradas:', tables);
    }

    // Verificar user_profiles
    console.log('\n🔍 Verificando user_profiles...');
    const { data: userProfiles, error: userError } = await supabase
      .from('user_profiles')
      .select('*')
      .limit(5);

    if (userError) {
      console.log('❌ Erro ao buscar user_profiles:', userError.message);
    } else {
      console.log(`✅ user_profiles: ${userProfiles.length} registros encontrados`);
      if (userProfiles.length > 0) {
        console.log('Colunas:', Object.keys(userProfiles[0]));
      }
    }

    // Verificar memberships
    console.log('\n🔍 Verificando memberships...');
    const { data: memberships, error: memberError } = await supabase
      .from('memberships')
      .select('*')
      .limit(5);

    if (memberError) {
      console.log('❌ Erro ao buscar memberships:', memberError.message);
    } else {
      console.log(`✅ memberships: ${memberships.length} registros encontrados`);
      if (memberships.length > 0) {
        console.log('Colunas:', Object.keys(memberships[0]));
      }
    }

    // Verificar user_roles
    console.log('\n🔍 Verificando user_roles...');
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('*')
      .limit(5);

    if (rolesError) {
      console.log('❌ Erro ao buscar user_roles:', rolesError.message);
    } else {
      console.log(`✅ user_roles: ${userRoles.length} registros encontrados`);
      if (userRoles.length > 0) {
        console.log('Colunas:', Object.keys(userRoles[0]));
        console.log('Roles disponíveis:', userRoles.map(r => r.name));
      }
    }

    // Verificar organizations
    console.log('\n🔍 Verificando organizations...');
    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .limit(5);

    if (orgError) {
      console.log('❌ Erro ao buscar organizations:', orgError.message);
    } else {
      console.log(`✅ organizations: ${organizations.length} registros encontrados`);
      if (organizations.length > 0) {
        console.log('Colunas:', Object.keys(organizations[0]));
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

checkDatabaseStructure();