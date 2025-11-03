const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMetaTables() {
  console.log('🔍 Verificando estrutura das tabelas Meta...\n');

  try {
    // 1. Verificar tabelas relacionadas ao Meta
    const tables = [
      'meta_campaigns',
      'client_meta_connections',
      'meta_ads',
      'meta_adsets',
      'campaigns'
    ];

    for (const table of tables) {
      console.log(`📋 Verificando tabela: ${table}`);
      
      try {
        const { data, error, count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (error) {
          console.log(`   ❌ Erro: ${error.message}`);
        } else {
          console.log(`   ✅ Existe - ${count || 0} registros`);
          
          // Se tem registros, mostrar estrutura
          if (count > 0) {
            const { data: sample } = await supabase
              .from(table)
              .select('*')
              .limit(1);
            
            if (sample && sample.length > 0) {
              console.log('   📝 Campos:');
              Object.keys(sample[0]).forEach(key => {
                console.log(`      - ${key}`);
              });
            }
          }
        }
      } catch (err) {
        console.log(`   ❌ Erro: ${err.message}`);
      }
      
      console.log('');
    }

    // 2. Verificar memberships com mais detalhes
    console.log('👥 Verificando memberships:');
    const { data: memberships, error: memberError } = await supabase
      .from('organization_memberships')
      .select(`
        user_id,
        organization_id,
        role,
        status,
        created_at
      `)
      .limit(5);

    if (memberError) {
      console.error('❌ Erro ao buscar memberships:', memberError);
    } else {
      console.log(`✅ Encontrados ${memberships.length} memberships:`);
      memberships.forEach(member => {
        console.log(`   - User: ${member.user_id}`);
        console.log(`     Org: ${member.organization_id}`);
        console.log(`     Role: ${member.role || 'não definido'}`);
        console.log(`     Status: ${member.status || 'não definido'}`);
        console.log('');
      });
    }

    // 3. Verificar se existe tabela memberships (nome alternativo)
    console.log('🔍 Verificando tabela memberships alternativa:');
    try {
      const { data, error, count } = await supabase
        .from('memberships')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`   ❌ Tabela 'memberships' não existe: ${error.message}`);
      } else {
        console.log(`   ✅ Tabela 'memberships' existe - ${count || 0} registros`);
        
        if (count > 0) {
          const { data: sample } = await supabase
            .from('memberships')
            .select('*')
            .limit(1);
          
          if (sample && sample.length > 0) {
            console.log('   📝 Campos:');
            Object.keys(sample[0]).forEach(key => {
              console.log(`      - ${key}`);
            });
          }
        }
      }
    } catch (err) {
      console.log(`   ❌ Erro: ${err.message}`);
    }

  } catch (error) {
    console.error('❌ Erro durante verificação:', error);
  }
}

checkMetaTables();