const { default: fetch } = require('node-fetch');

async function testFinalAPIs() {
  try {
    console.log('🔍 Testando APIs de gerenciamento de assinatura...\n');
    
    // Teste 1: API de Organizações
    console.log('1. Testando API de Organizações...');
    const orgsResponse = await fetch('http://localhost:3000/api/admin/subscription-management/organizations');
    const orgsData = await orgsResponse.json();
    
    if (orgsResponse.ok && orgsData.success) {
      console.log('✅ API de Organizações funcionando');
      console.log(`📊 Organizações encontradas: ${orgsData.organizations?.length || 0}`);
      if (orgsData.organizations && orgsData.organizations.length > 0) {
        console.log(`📋 Primeira organização: ${orgsData.organizations[0].name}`);
        console.log(`💳 Tem assinatura: ${orgsData.organizations[0].subscription ? 'Sim' : 'Não'}`);
      }
    } else {
      console.log('❌ API de Organizações com erro:', orgsData.error);
    }
    
    // Teste 2: API de Histórico de Auditoria
    console.log('\n2. Testando API de Histórico de Auditoria...');
    const auditResponse = await fetch('http://localhost:3000/api/admin/subscriptions/audit-history?limit=50');
    const auditData = await auditResponse.json();
    
    if (auditResponse.ok && auditData.success) {
      console.log('✅ API de Histórico de Auditoria funcionando');
      console.log(`📊 Logs encontrados: ${auditData.data?.logs?.length || 0}`);
    } else {
      console.log('❌ API de Histórico de Auditoria com erro:', auditData.error);
    }
    
    // Teste 3: API de Planos
    console.log('\n3. Testando API de Planos...');
    const plansResponse = await fetch('http://localhost:3000/api/admin/plans');
    const plansData = await plansResponse.json();
    
    if (plansResponse.ok && plansData.success) {
      console.log('✅ API de Planos funcionando');
      console.log(`📊 Planos encontrados: ${plansData.plans?.length || 0}`);
    } else {
      console.log('❌ API de Planos com erro:', plansData.error);
    }
    
    console.log('\n🎉 Teste das APIs concluído!');
    
  } catch (error) {
    console.log('❌ Erro no teste:', error.message);
  }
}

testFinalAPIs();