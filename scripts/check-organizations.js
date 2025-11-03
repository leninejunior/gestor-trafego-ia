const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkOrganizations() {
  try {
    console.log('🔍 Verificando organizações...');
    
    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('*');
    
    if (error) {
      console.log('❌ Erro:', error.message);
      return;
    }
    
    console.log('✅ Organizações encontradas:', orgs?.length || 0);
    
    if (orgs && orgs.length > 0) {
      orgs.forEach((org, index) => {
        console.log(`📋 ${index + 1}. ${org.name} (ID: ${org.id})`);
      });
    } else {
      console.log('📝 Criando organização de teste...');
      
      const { data: newOrg, error: createError } = await supabase
        .from('organizations')
        .insert({
          name: 'Organização Teste',
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (createError) {
        console.log('❌ Erro ao criar organização:', createError.message);
      } else {
        console.log('✅ Organização criada:', newOrg.name);
      }
    }
    
  } catch (err) {
    console.log('❌ Erro geral:', err.message);
  }
}

checkOrganizations();