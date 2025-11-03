const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugMembershipAccess() {
  console.log('🔍 Debugando acesso de memberships...\n');

  try {
    // 1. Buscar um cliente e sua organização
    const { data: client } = await supabase
      .from('clients')
      .select('id, name, org_id')
      .limit(1)
      .single();

    console.log(`Cliente: ${client.name} (${client.id})`);
    console.log(`Organização: ${client.org_id}`);

    // 2. Buscar todos os memberships desta organização
    console.log('\n📋 Memberships desta organização:');
    const { data: memberships, error: memberError } = await supabase
      .from('memberships')
      .select('*')
      .eq('organization_id', client.org_id);

    if (memberError) {
      console.error('❌ Erro ao buscar memberships:', memberError);
      return;
    }

    console.log(`Encontrados ${memberships.length} memberships:`);
    memberships.forEach((member, index) => {
      console.log(`\n${index + 1}. User: ${member.user_id}`);
      console.log(`   Org: ${member.organization_id}`);
      console.log(`   Role: ${member.role}`);
      console.log(`   Status: ${member.status}`);
      console.log(`   Created: ${member.created_at}`);
      console.log(`   Accepted: ${member.accepted_at}`);
    });

    // 3. Testar acesso para cada usuário
    console.log('\n🧪 Testando acesso para cada usuário:');
    
    for (const member of memberships) {
      console.log(`\nTestando usuário: ${member.user_id}`);
      
      // Teste 1: Buscar membership direto
      const { data: directMember, error: directError } = await supabase
        .from('memberships')
        .select('organization_id')
        .eq('user_id', member.user_id)
        .eq('organization_id', client.org_id)
        .single();

      if (directError) {
        console.log(`   ❌ Erro no acesso direto: ${directError.message}`);
      } else {
        console.log(`   ✅ Acesso direto OK: org ${directMember.organization_id}`);
      }

      // Teste 2: Verificar se há múltiplos memberships
      const { data: allMemberships, error: allError } = await supabase
        .from('memberships')
        .select('organization_id')
        .eq('user_id', member.user_id);

      if (allError) {
        console.log(`   ❌ Erro ao buscar todos: ${allError.message}`);
      } else {
        console.log(`   📊 Total de orgs do usuário: ${allMemberships.length}`);
        allMemberships.forEach(m => {
          console.log(`      - Org: ${m.organization_id}`);
        });
      }
    }

    // 4. Verificar se há problema com org_id vs organization_id
    console.log('\n🔍 Verificando campos de organização:');
    
    const { data: sampleMember } = await supabase
      .from('memberships')
      .select('*')
      .limit(1)
      .single();

    if (sampleMember) {
      console.log('Campos disponíveis no membership:');
      Object.keys(sampleMember).forEach(key => {
        if (key.includes('org')) {
          console.log(`   - ${key}: ${sampleMember[key]}`);
        }
      });
    }

    // 5. Verificar se o cliente usa org_id ou organization_id
    console.log('\n🔍 Verificando campos de organização no cliente:');
    console.log('Campos do cliente:');
    Object.keys(client).forEach(key => {
      if (key.includes('org')) {
        console.log(`   - ${key}: ${client[key]}`);
      }
    });

    // 6. Testar com ambos os campos
    if (memberships.length > 0) {
      const testUser = memberships[0].user_id;
      console.log(`\n🧪 Testando acesso com ambos os campos para usuário: ${testUser}`);
      
      // Teste com organization_id
      const { data: test1, error: error1 } = await supabase
        .from('memberships')
        .select('organization_id')
        .eq('user_id', testUser)
        .eq('organization_id', client.org_id)
        .single();

      console.log(`Teste organization_id: ${error1 ? '❌ ' + error1.message : '✅ OK'}`);

      // Teste com org_id (se existir)
      if (sampleMember.org_id) {
        const { data: test2, error: error2 } = await supabase
          .from('memberships')
          .select('org_id')
          .eq('user_id', testUser)
          .eq('org_id', client.org_id)
          .single();

        console.log(`Teste org_id: ${error2 ? '❌ ' + error2.message : '✅ OK'}`);
      }
    }

  } catch (error) {
    console.error('❌ Erro durante debug:', error);
  }
}

debugMembershipAccess();