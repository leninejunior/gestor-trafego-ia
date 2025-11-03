require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function limparPlanosDuplicados() {
  console.log('🧹 Limpando planos duplicados...\n');

  try {
    // 1. Verificar planos existentes
    console.log('1. Verificando planos existentes...');
    const { data: plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('created_at', { ascending: true });

    if (plansError) {
      console.log('❌ Erro ao buscar planos:', plansError);
      return;
    }

    console.log('✅ Planos encontrados:', plans?.length || 0);
    
    // Agrupar por nome
    const plansByName = {};
    plans?.forEach(plan => {
      if (!plansByName[plan.name]) {
        plansByName[plan.name] = [];
      }
      plansByName[plan.name].push(plan);
    });

    // Mostrar duplicatas
    console.log('\n2. Analisando duplicatas...');
    for (const [name, planList] of Object.entries(plansByName)) {
      if (planList.length > 1) {
        console.log(`❌ Plano "${name}" tem ${planList.length} duplicatas:`);
        planList.forEach((plan, index) => {
          console.log(`   ${index + 1}. ID: ${plan.id}, Criado: ${plan.created_at}, Ativo: ${plan.is_active}`);
        });
      } else {
        console.log(`✅ Plano "${name}" - único`);
      }
    }

    // 3. Manter apenas os primeiros de cada nome e desativar/deletar duplicatas
    console.log('\n3. Removendo duplicatas...');
    
    for (const [name, planList] of Object.entries(plansByName)) {
      if (planList.length > 1) {
        // Manter o primeiro (mais antigo)
        const keepPlan = planList[0];
        const duplicates = planList.slice(1);
        
        console.log(`\n📋 Processando plano "${name}":`);
        console.log(`   ✅ Mantendo: ${keepPlan.id} (${keepPlan.created_at})`);
        
        // Verificar se alguma duplicata está sendo usada
        for (const duplicate of duplicates) {
          const { data: subscriptions, error: subError } = await supabase
            .from('subscriptions')
            .select('id')
            .eq('plan_id', duplicate.id);

          if (subError) {
            console.log(`   ❌ Erro ao verificar uso do plano ${duplicate.id}:`, subError);
            continue;
          }

          if (subscriptions && subscriptions.length > 0) {
            // Se está sendo usado, apenas desativar
            console.log(`   ⚠️  Plano ${duplicate.id} está sendo usado por ${subscriptions.length} assinatura(s) - desativando`);
            
            const { error: updateError } = await supabase
              .from('subscription_plans')
              .update({ is_active: false })
              .eq('id', duplicate.id);

            if (updateError) {
              console.log(`   ❌ Erro ao desativar plano ${duplicate.id}:`, updateError);
            } else {
              console.log(`   ✅ Plano ${duplicate.id} desativado`);
            }
          } else {
            // Se não está sendo usado, deletar
            console.log(`   🗑️  Plano ${duplicate.id} não está sendo usado - deletando`);
            
            const { error: deleteError } = await supabase
              .from('subscription_plans')
              .delete()
              .eq('id', duplicate.id);

            if (deleteError) {
              console.log(`   ❌ Erro ao deletar plano ${duplicate.id}:`, deleteError);
            } else {
              console.log(`   ✅ Plano ${duplicate.id} deletado`);
            }
          }
        }
      }
    }

    // 4. Verificar resultado final
    console.log('\n4. Verificando resultado final...');
    const { data: finalPlans, error: finalError } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('name');

    if (finalError) {
      console.log('❌ Erro ao verificar resultado:', finalError);
    } else {
      console.log('✅ Planos finais:');
      finalPlans?.forEach(plan => {
        console.log(`   - ${plan.name}: ${plan.is_active ? 'Ativo' : 'Inativo'} (ID: ${plan.id})`);
      });
    }

    console.log('\n🎉 Limpeza concluída!');

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

limparPlanosDuplicados();