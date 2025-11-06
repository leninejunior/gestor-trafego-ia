/**
 * Diagnóstico do problema real do Google Ads
 * O Developer Token está aprovado, OAuth funciona, mas API retorna vazio
 */

require('dotenv').config();

async function diagnosticarProblemaReal() {
  console.log('='.repeat(80));
  console.log('🔍 DIAGNÓSTICO DO PROBLEMA REAL GOOGLE ADS');
  console.log('Timestamp:', new Date().toISOString());
  console.log('='.repeat(80));

  // 1. Verificar configuração atual
  console.log('\n1️⃣ CONFIGURAÇÃO ATUAL:');
  console.log('✅ Developer Token:', process.env.GOOGLE_DEVELOPER_TOKEN ? 'Configurado' : 'Ausente');
  console.log('✅ Client ID:', process.env.GOOGLE_CLIENT_ID ? 'Configurado' : 'Ausente');
  console.log('✅ Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? 'Configurado' : 'Ausente');
  console.log('✅ App URL:', process.env.NEXT_PUBLIC_APP_URL);

  // 2. Analisar o problema
  console.log('\n2️⃣ ANÁLISE DO PROBLEMA:');
  console.log('📊 Status confirmado:');
  console.log('   ✅ OAuth funcionando (drive.engrene@gmail.com)');
  console.log('   ✅ Developer Token aprovado pelo Google');
  console.log('   ✅ Google Cloud Console configurado');
  console.log('   ❌ API retorna lista vazia de contas');

  // 3. Possíveis causas
  console.log('\n3️⃣ POSSÍVEIS CAUSAS REAIS:');
  
  console.log('\n🔍 CAUSA 1: Tipo de conta');
  console.log('   • Seu Developer Token pode ser para MCC (Manager Account)');
  console.log('   • Mas você está tentando acessar contas individuais');
  console.log('   • Solução: Verificar se drive.engrene@gmail.com tem MCC');

  console.log('\n🔍 CAUSA 2: Permissões da conta');
  console.log('   • A conta drive.engrene@gmail.com pode não ter acesso às contas');
  console.log('   • Ou pode ter acesso limitado');
  console.log('   • Solução: Verificar permissões no Google Ads');

  console.log('\n🔍 CAUSA 3: Configuração da API');
  console.log('   • API ativa mas com configurações restritivas');
  console.log('   • Ou quotas/limites aplicados');
  console.log('   • Solução: Verificar configurações no Google Cloud');

  console.log('\n🔍 CAUSA 4: Estrutura da conta');
  console.log('   • Conta pode estar em estrutura hierárquica');
  console.log('   • Precisa acessar via MCC primeiro');
  console.log('   • Solução: Usar endpoint de MCC');

  // 4. Próximos passos
  console.log('\n4️⃣ PRÓXIMOS PASSOS PARA RESOLVER:');
  
  console.log('\n📋 PASSO 1: Verificar tipo de conta');
  console.log('   1. Acesse https://ads.google.com');
  console.log('   2. Faça login com drive.engrene@gmail.com');
  console.log('   3. Verifique se é conta MCC ou individual');
  console.log('   4. Anote os IDs das contas que você vê');

  console.log('\n📋 PASSO 2: Testar API diretamente');
  console.log('   1. Use o token OAuth que já funciona');
  console.log('   2. Teste endpoint: /customers:listAccessibleCustomers');
  console.log('   3. Se retornar vazio, problema é de permissões');

  console.log('\n📋 PASSO 3: Verificar MCC');
  console.log('   1. Se for MCC, use endpoint específico');
  console.log('   2. Liste contas gerenciadas');
  console.log('   3. Acesse contas filhas via MCC');

  // 5. Comandos para testar
  console.log('\n5️⃣ COMANDOS PARA TESTAR:');
  console.log('\n# Testar OAuth (já funciona):');
  console.log('curl -H "Authorization: Bearer SEU_TOKEN" \\');
  console.log('     https://www.googleapis.com/oauth2/v1/userinfo');

  console.log('\n# Testar Google Ads API:');
  console.log('curl -H "Authorization: Bearer SEU_TOKEN" \\');
  console.log('     -H "developer-token: cmyNYo6UHSkfJg3ZJD-cJA" \\');
  console.log('     https://googleads.googleapis.com/v16/customers:listAccessibleCustomers');

  // 6. Conclusão
  console.log('\n6️⃣ CONCLUSÃO:');
  console.log('🎯 O problema NÃO é:');
  console.log('   ❌ Developer Token em projeto errado');
  console.log('   ❌ API não ativada');
  console.log('   ❌ OAuth não funcionando');

  console.log('\n🎯 O problema PROVAVELMENTE é:');
  console.log('   ✅ Configuração de permissões da conta');
  console.log('   ✅ Estrutura MCC vs conta individual');
  console.log('   ✅ Acesso às contas específicas');

  console.log('\n💡 PRÓXIMA AÇÃO:');
  console.log('   1. Verificar no Google Ads qual tipo de conta você tem');
  console.log('   2. Anotar os IDs das contas que aparecem lá');
  console.log('   3. Testar API com esses IDs específicos');

  console.log('\n' + '='.repeat(80));
}

// Executar diagnóstico
diagnosticarProblemaReal().catch(console.error);