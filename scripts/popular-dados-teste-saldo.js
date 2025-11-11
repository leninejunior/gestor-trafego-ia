/**
 * Popular banco com dados de teste para Sistema de Alertas de Saldo
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function popularDadosTeste() {
  console.log('=== POPULANDO DADOS DE TESTE ===\n');

  try {
    // 1. Criar organização de teste
    console.log('1. Criando organização de teste...');
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: 'Agência Teste',
        slug: 'agencia-teste'
      })
      .select()
      .single();

    if (orgError) {
      console.error('Erro ao criar organização:', orgError);
      return;
    }
    console.log('✓ Organização criada:', org.name);

    // 2. Criar clientes
    console.log('\n2. Criando clientes...');
    const clientes = [
      { name: 'Cliente A - E-commerce', org_id: org.id },
      { name: 'Cliente B - Serviços', org_id: org.id },
      { name: 'Cliente C - Imobiliária', org_id: org.id }
    ];

    const { data: clientesCriados, error: clientesError } = await supabase
      .from('clients')
      .insert(clientes)
      .select();

    if (clientesError) {
      console.error('Erro ao criar clientes:', clientesError);
      return;
    }
    console.log(`✓ ${clientesCriados.length} clientes criados`);

    // 3. Criar conexões Meta Ads (múltiplas contas por cliente)
    console.log('\n3. Criando conexões Meta Ads...');
    const conexoes = [];
    
    clientesCriados.forEach((cliente, clienteIndex) => {
      // Conta 1
      conexoes.push({
        client_id: cliente.id,
        ad_account_id: `act_12345${clienteIndex}`,
        access_token: `fake_token_${clienteIndex}_1`,
        account_name: `Conta Principal - ${cliente.name}`,
        currency: 'BRL',
        is_active: true
      });
      
      // Conta 2
      conexoes.push({
        client_id: cliente.id,
        ad_account_id: `act_67890${clienteIndex}`,
        access_token: `fake_token_${clienteIndex}_2`,
        account_name: `Conta Secundária - ${cliente.name}`,
        currency: 'BRL',
        is_active: true
      });
    });

    // Conta extra para o primeiro cliente
    conexoes.push({
      client_id: clientesCriados[0].id,
      ad_account_id: 'act_99999',
      access_token: 'fake_token_premium',
      account_name: `Conta Premium - ${clientesCriados[0].name}`,
      currency: 'BRL',
      is_active: true
    });

    const { data: conexoesCriadas, error: conexoesError } = await supabase
      .from('client_meta_connections')
      .insert(conexoes)
      .select();

    if (conexoesError) {
      console.error('Erro ao criar conexões:', conexoesError);
      return;
    }
    console.log(`✓ ${conexoesCriadas.length} conexões Meta criadas`);

    // 4. Criar saldos das contas
    console.log('\n4. Criando saldos das contas...');
    const saldos = [];
    
    clientesCriados.forEach((cliente, clienteIndex) => {
      // Conta 1 - Saldo crítico
      saldos.push({
        client_id: cliente.id,
        ad_account_id: `act_12345${clienteIndex}`,
        ad_account_name: `Conta Principal - ${cliente.name}`,
        currency: 'BRL',
        balance: 45.50 + (clienteIndex * 10), // Saldos baixos variados
        daily_spend: 15.00 + (clienteIndex * 2),
        account_spend_limit: 1000.00,
        status: 'critical',
        last_checked_at: new Date().toISOString()
      });

      // Conta 2 - Saldo warning
      saldos.push({
        client_id: cliente.id,
        ad_account_id: `act_67890${clienteIndex}`,
        ad_account_name: `Conta Secundária - ${cliente.name}`,
        currency: 'BRL',
        balance: 180.00 + (clienteIndex * 50),
        daily_spend: 25.00 + (clienteIndex * 3),
        account_spend_limit: 2000.00,
        status: 'warning',
        last_checked_at: new Date().toISOString()
      });
    });

    // Adicionar uma conta saudável
    saldos.push({
      client_id: clientesCriados[0].id,
      ad_account_id: 'act_99999',
      ad_account_name: `Conta Premium - ${clientesCriados[0].name}`,
      currency: 'BRL',
      balance: 5000.00,
      daily_spend: 50.00,
      account_spend_limit: 10000.00,
      status: 'healthy',
      last_checked_at: new Date().toISOString()
    });

    const { data: saldosCriados, error: saldosError } = await supabase
      .from('ad_account_balances')
      .insert(saldos)
      .select();

    if (saldosError) {
      console.error('Erro ao criar saldos:', saldosError);
      return;
    }
    console.log(`✓ ${saldosCriados.length} saldos criados`);

    // 5. Criar alertas
    console.log('\n5. Criando alertas...');
    const alertas = [];

    saldosCriados.forEach((saldo, index) => {
      alertas.push({
        client_id: saldo.client_id,
        ad_account_id: saldo.ad_account_id,
        threshold_amount: saldo.status === 'critical' ? 50.00 : 200.00,
        alert_type: saldo.status === 'critical' ? 'critical_balance' : 'low_balance',
        is_active: true,
        whatsapp_enabled: index % 2 === 0, // Metade com WhatsApp
        email_enabled: true,
        whatsapp_number: index % 2 === 0 ? '+5511999999999' : null,
        email_address: 'admin@teste.com'
      });
    });

    const { data: alertasCriados, error: alertasError } = await supabase
      .from('balance_alerts')
      .insert(alertas)
      .select();

    if (alertasError) {
      console.error('Erro ao criar alertas:', alertasError);
      return;
    }
    console.log(`✓ ${alertasCriados.length} alertas criados`);

    // 6. Criar histórico de alertas
    console.log('\n6. Criando histórico de alertas...');
    const historico = [];

    alertasCriados.slice(0, 3).forEach((alerta) => {
      // Alerta enviado com sucesso
      historico.push({
        alert_id: alerta.id,
        sent_via: 'email',
        recipient: 'admin@teste.com',
        status: 'sent',
        balance_at_send: 45.50,
        sent_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 horas atrás
      });

      // Alerta via WhatsApp
      if (alerta.whatsapp_enabled) {
        historico.push({
          alert_id: alerta.id,
          sent_via: 'whatsapp',
          recipient: '+5511999999999',
          status: 'sent',
          balance_at_send: 45.50,
          sent_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        });
      }
    });

    const { data: historicoCriado, error: historicoError } = await supabase
      .from('alert_history')
      .insert(historico)
      .select();

    if (historicoError) {
      console.error('Erro ao criar histórico:', historicoError);
      return;
    }
    console.log(`✓ ${historicoCriado.length} registros de histórico criados`);

    // Resumo
    console.log('\n=== RESUMO ===');
    console.log(`✓ 1 organização criada`);
    console.log(`✓ ${clientesCriados.length} clientes criados`);
    console.log(`✓ ${conexoesCriadas.length} conexões Meta criadas`);
    console.log(`✓ ${saldosCriados.length} contas com saldo`);
    console.log(`✓ ${alertasCriados.length} alertas configurados`);
    console.log(`✓ ${historicoCriado.length} registros de histórico`);
    
    console.log('\n📊 Distribuição de Status:');
    const critical = saldosCriados.filter(s => s.status === 'critical').length;
    const warning = saldosCriados.filter(s => s.status === 'warning').length;
    const healthy = saldosCriados.filter(s => s.status === 'healthy').length;
    console.log(`   - Crítico: ${critical} contas`);
    console.log(`   - Atenção: ${warning} contas`);
    console.log(`   - Saudável: ${healthy} contas`);

    console.log('\n✅ Dados de teste populados com sucesso!');
    console.log('\n🌐 Acesse: http://localhost:3000/dashboard/balance-alerts');

  } catch (error) {
    console.error('\n❌ Erro ao popular dados:', error);
  }
}

popularDadosTeste();
