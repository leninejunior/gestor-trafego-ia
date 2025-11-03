console.log('🔍 Debug detalhado do Google Callback...\n');

console.log('✅ ANÁLISE DO PROBLEMA:');
console.log('   - OAuth funcionou (redirecionou para Google e voltou)');
console.log('   - Erro acontece na criação da conexão no callback');
console.log('   - Mensagem: "Erro ao criar conexão"');
console.log('   - Isso indica que o INSERT na tabela google_ads_connections falhou\n');

console.log('🔍 POSSÍVEIS CAUSAS:');
console.log('');
console.log('1️⃣ PROBLEMA COM createServiceClient:');
console.log('   - Função pode não existir ou estar mal importada');
console.log('   - Verificar se está definida em src/lib/supabase/server.ts');
console.log('');
console.log('2️⃣ PROBLEMA COM A TABELA:');
console.log('   - Tabela google_ads_connections pode não existir');
console.log('   - Campos obrigatórios podem estar faltando');
console.log('   - Constraints podem estar bloqueando inserção');
console.log('');
console.log('3️⃣ PROBLEMA COM RLS:');
console.log('   - Mesmo usando service client, RLS pode estar ativo');
console.log('   - Política pode estar mal configurada');
console.log('');
console.log('4️⃣ PROBLEMA COM DADOS:');
console.log('   - clientId pode ser inválido');
console.log('   - customerId "pending" pode não ser aceito');
console.log('   - refresh_token "temp" pode não ser aceito');
console.log('');

console.log('🔧 SOLUÇÕES PARA TESTAR:');
console.log('');
console.log('SOLUÇÃO 1 - Verificar createServiceClient:');
console.log('   - Confirmar se função existe e está exportada');
console.log('   - Testar se service client funciona');
console.log('');
console.log('SOLUÇÃO 2 - Simplificar ainda mais:');
console.log('   - Usar supabase normal em vez de service client');
console.log('   - Desabilitar RLS temporariamente');
console.log('');
console.log('SOLUÇÃO 3 - Adicionar logs detalhados:');
console.log('   - Logar todos os dados antes do INSERT');
console.log('   - Logar erro específico do Supabase');
console.log('');

console.log('📋 PRÓXIMOS PASSOS:');
console.log('');
console.log('1. Vou verificar se createServiceClient existe');
console.log('2. Vou adicionar logs mais detalhados no callback');
console.log('3. Vou simplificar a criação da conexão');
console.log('4. Vou testar novamente');
console.log('');

console.log('⚠️  IMPORTANTE:');
console.log('   O OAuth está funcionando perfeitamente!');
console.log('   O problema é só na criação da conexão no banco.');
console.log('   Isso é mais fácil de resolver.');