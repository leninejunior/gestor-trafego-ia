require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function corrigirAssinaturaPlano() {
  console.log('🔧 Corrigindo assinatura do plano...\n');

  try {
    // 1. Buscar plano Pro ativo
    console.log('1. Buscando plano Pro ativo...');
    const { data: proPlano, error: proError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('name', 'Pro')
      .eq('is_active', true)
      .single();

    if (proError) {
      console.log('❌ Erro ao buscar plano Pro ativo:', proError);
      return;
    }

    console.log('✅ Plano Pro ativo encontrado:', proPlano.id);

    // 2. Buscar assinatura que está usando plano inativo
    console.log('\n2. Buscando assinaturas com plano inativo...');
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select(`
        *,
        subscription_plans (name, is_active)
      `)
      .eq('status', 'active');

    if (subError) {
      console.log('❌ Erro ao buscar assinaturas:', subError);
      return;
    }

    console.log('✅ Assinaturas encontradas:', subscriptions?.length || 0);

    // Encontrar assinaturas com planos inativos
    const problematicSubscriptions = subscriptions?.filter(sub => 
      sub.subscription_plans && !sub.subscription_plans.is_active
    ) || [];

    console.log('⚠️  Assinaturas com planos inativos:', problematicSubscriptions.length);

    // 3. Corrigir assinaturas problemáticas
    for (const subscription of problematicSubscriptions) {
      console.log(`\n🔧 Corrigindo assinatura ${subscription.id}:`);
      console.log(`   Plano atual: ${subscription.subscription_plans.name} (inativo)`);
      console.log(`   Mudando para: Pro (ativo)`);

      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({ plan_id: proPlano.id })
        .eq('id', subscription.id);

      if (updateError) {
        console.log(`   ❌ Erro ao atualizar assinatura:`, updateError);
      } else {
        console.log(`   ✅ Assinatura atualizada com sucesso`);
      }
    }

    // 4. Verificar resultado final
    console.log('\n4. Verificando resultado final...');
    const { data: finalSubs, error: finalError } = await supabase
      .from('subscriptions')
      .select(`
        id,
        status,
        organization_id,
        subscription_plans (name, is_active)
      `)
      .eq('status', 'active');

    if (finalError) {
      console.log('❌ Erro ao verificar resultado:', finalError);
    } else {
      console.log('✅ Assinaturas ativas finais:');
      finalSubs?.forEach(sub => {
        console.log(`   - Org: ${sub.organization_id}, Plano: ${sub.subscription_plans?.name} (${sub.subscription_plans?.is_active ? 'Ativo' : 'Inativo'})`);
      });
    }

    console.log('\n🎉 Correção concluída!');

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

corrigirAssinaturaPlano();