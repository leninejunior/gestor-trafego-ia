/**
 * Script para testar o fluxo completo de checkout do Iugu
 */

require('dotenv').config();

const IUGU_API_TOKEN = process.env.IUGU_API_TOKEN;

async function testCheckoutFlow() {
  console.log('🧪 Testando fluxo de checkout do Iugu...\n');

  const auth = Buffer.from(`${IUGU_API_TOKEN}:`).toString('base64');
  const testEmail = `test_checkout_${Date.now()}@example.com`;

  try {
    // 1. Criar cliente
    console.log('1. Criando cliente de teste...');
    const customerResponse = await fetch('https://api.iugu.com/v1/customers', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail,
        name: 'Cliente Teste Checkout',
        custom_variables: [
          { name: 'organization_id', value: 'test_org_123' },
          { name: 'test', value: 'true' }
        ]
      })
    });

    const customer = await customerResponse.json();
    if (!customerResponse.ok) {
      console.error('❌ Erro ao criar cliente:', customer);
      return;
    }
    console.log('✅ Cliente criado:', customer.id);
    console.log('');

    // 2. Criar plano
    console.log('2. Criando plano de teste...');
    const planIdentifier = `test_plan_${Date.now()}`;
    const planResponse = await fetch('https://api.iugu.com/v1/plans', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Plano Teste',
        identifier: planIdentifier,
        interval: 1,
        interval_type: 'months',
        value_cents: 9900,
        currency: 'BRL',
        payable_with: 'all'
      })
    });

    const plan = await planResponse.json();
    if (!planResponse.ok) {
      console.error('❌ Erro ao criar plano:', plan);
      return;
    }
    console.log('✅ Plano criado:', plan.identifier);
    console.log('');

    // 3. Criar assinatura
    console.log('3. Criando assinatura...');
    const subscriptionResponse = await fetch('https://api.iugu.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer_id: customer.id,
        plan_identifier: planIdentifier,
        only_on_charge_success: false,
        payable_with: 'all',
        custom_variables: [
          { name: 'organization_id', value: 'test_org_123' },
          { name: 'plan_id', value: 'test_plan_id' }
        ]
      })
    });

    const subscription = await subscriptionResponse.json();
    if (!subscriptionResponse.ok) {
      console.error('❌ Erro ao criar assinatura:', subscription);
      return;
    }
    console.log('✅ Assinatura criada:', subscription.id);
    console.log('   Status:', subscription.active ? 'Ativa' : 'Inativa');
    console.log('   Suspensa:', subscription.suspended ? 'Sim' : 'Não');
    console.log('   Faturas recentes:', subscription.recent_invoices?.length || 0);
    console.log('');

    // 4. Verificar faturas
    if (subscription.recent_invoices && subscription.recent_invoices.length > 0) {
      console.log('4. Faturas encontradas:');
      subscription.recent_invoices.forEach((invoice, index) => {
        console.log(`   Fatura ${index + 1}:`);
        console.log(`     ID: ${invoice.id}`);
        console.log(`     Status: ${invoice.status}`);
        console.log(`     Valor: R$ ${(invoice.total_cents / 100).toFixed(2)}`);
        console.log(`     URL: ${invoice.secure_url || `https://faturas.iugu.com/${invoice.secure_id}`}`);
      });
    } else {
      console.log('4. ⚠️  Nenhuma fatura encontrada imediatamente');
      console.log('   Aguardando 3 segundos...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Buscar assinatura novamente
      const updatedSubResponse = await fetch(`https://api.iugu.com/v1/subscriptions/${subscription.id}`, {
        headers: {
          'Authorization': `Basic ${auth}`,
        }
      });
      
      const updatedSub = await updatedSubResponse.json();
      if (updatedSub.recent_invoices && updatedSub.recent_invoices.length > 0) {
        console.log('   ✅ Faturas encontradas após aguardar:');
        updatedSub.recent_invoices.forEach((invoice, index) => {
          console.log(`     Fatura ${index + 1}:`);
          console.log(`       ID: ${invoice.id}`);
          console.log(`       Status: ${invoice.status}`);
          console.log(`       URL: ${invoice.secure_url || `https://faturas.iugu.com/${invoice.secure_id}`}`);
        });
      } else {
        console.log('   ❌ Ainda sem faturas');
      }
    }
    console.log('');

    // Limpeza
    console.log('5. Limpando dados de teste...');
    
    // Cancelar assinatura
    await fetch(`https://api.iugu.com/v1/subscriptions/${subscription.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${auth}`,
      }
    });
    console.log('   ✅ Assinatura cancelada');

    // Deletar plano
    await fetch(`https://api.iugu.com/v1/plans/${plan.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${auth}`,
      }
    });
    console.log('   ✅ Plano deletado');

    // Deletar cliente
    await fetch(`https://api.iugu.com/v1/customers/${customer.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${auth}`,
      }
    });
    console.log('   ✅ Cliente deletado');

    console.log('\n✅ Teste concluído com sucesso!');

  } catch (error) {
    console.error('\n❌ Erro durante o teste:', error.message);
    console.error(error);
  }
}

testCheckoutFlow().catch(console.error);
