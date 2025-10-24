/**
 * Script para testar a API do Iugu e diagnosticar problemas
 */

require('dotenv').config();

const IUGU_API_TOKEN = process.env.IUGU_API_TOKEN;
const IUGU_ACCOUNT_ID = process.env.IUGU_ACCOUNT_ID;

async function testIuguAPI() {
  console.log('🔍 Testando API do Iugu...\n');

  // Verificar variáveis de ambiente
  console.log('1. Verificando variáveis de ambiente:');
  console.log(`   IUGU_API_TOKEN: ${IUGU_API_TOKEN ? '✅ Configurado' : '❌ Não configurado'}`);
  console.log(`   IUGU_ACCOUNT_ID: ${IUGU_ACCOUNT_ID ? '✅ Configurado' : '❌ Não configurado'}`);
  console.log('');

  if (!IUGU_API_TOKEN) {
    console.error('❌ IUGU_API_TOKEN não está configurado!');
    return;
  }

  const auth = Buffer.from(`${IUGU_API_TOKEN}:`).toString('base64');

  // Teste 1: Verificar autenticação
  console.log('2. Testando autenticação...');
  try {
    const response = await fetch('https://api.iugu.com/v1/accounts', {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      }
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('   ✅ Autenticação bem-sucedida');
      console.log(`   Conta: ${data.name || 'N/A'}`);
    } else {
      console.log('   ❌ Erro na autenticação');
      console.log('   Resposta:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log('   ❌ Erro ao conectar:', error.message);
  }
  console.log('');

  // Teste 2: Listar clientes
  console.log('3. Testando listagem de clientes...');
  try {
    const response = await fetch('https://api.iugu.com/v1/customers?limit=1', {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      }
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('   ✅ Listagem de clientes funcionando');
      console.log(`   Total de clientes: ${data.totalItems || 0}`);
    } else {
      console.log('   ❌ Erro ao listar clientes');
      console.log('   Resposta:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log('   ❌ Erro ao conectar:', error.message);
  }
  console.log('');

  // Teste 3: Listar planos
  console.log('4. Testando listagem de planos...');
  try {
    const response = await fetch('https://api.iugu.com/v1/plans?limit=5', {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      }
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('   ✅ Listagem de planos funcionando');
      console.log(`   Total de planos: ${data.totalItems || 0}`);
      if (data.items && data.items.length > 0) {
        console.log('   Planos existentes:');
        data.items.forEach(plan => {
          console.log(`     - ${plan.name} (${plan.identifier})`);
        });
      }
    } else {
      console.log('   ❌ Erro ao listar planos');
      console.log('   Resposta:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log('   ❌ Erro ao conectar:', error.message);
  }
  console.log('');

  // Teste 4: Criar cliente de teste
  console.log('5. Testando criação de cliente...');
  try {
    const testEmail = `test_${Date.now()}@example.com`;
    const response = await fetch('https://api.iugu.com/v1/customers', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail,
        name: 'Cliente Teste',
        custom_variables: [
          { name: 'test', value: 'true' }
        ]
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('   ✅ Criação de cliente funcionando');
      console.log(`   Cliente criado: ${data.id}`);
      
      // Limpar cliente de teste
      await fetch(`https://api.iugu.com/v1/customers/${data.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Basic ${auth}`,
        }
      });
      console.log('   ✅ Cliente de teste removido');
    } else {
      console.log('   ❌ Erro ao criar cliente');
      console.log('   Resposta:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log('   ❌ Erro ao conectar:', error.message);
  }
  console.log('');

  console.log('✅ Diagnóstico concluído!');
}

testIuguAPI().catch(console.error);
