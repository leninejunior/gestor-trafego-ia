console.log('🔍 Diagnóstico Específico - Erro 403 Google Auth\n');

console.log('✅ PROBLEMA IDENTIFICADO:');
console.log('   O erro 403 (Forbidden) na API Google Auth pode ocorrer em dois pontos:\n');

console.log('1️⃣ ERRO: "Usuário não possui organização"');
console.log('   - Causa: Usuário não tem registro na tabela organization_memberships');
console.log('   - Local: Linha ~70 da API Google Auth');
console.log('   - Status: 403\n');

console.log('2️⃣ ERRO: "Acesso negado ao cliente especificado"');
console.log('   - Causa: Cliente não pertence à organização do usuário');
console.log('   - Local: Linha ~87 da API Google Auth');
console.log('   - Status: 403\n');

console.log('🔧 SOLUÇÕES RECOMENDADAS:\n');

console.log('📋 SOLUÇÃO 1 - Verificar Membership do Usuário:');
console.log('   1. Faça login no sistema');
console.log('   2. Vá para um cliente REAL no dashboard (não fictício)');
console.log('   3. Tente conectar Google Ads novamente');
console.log('   4. Se persistir, o usuário pode não ter organização\n');

console.log('📋 SOLUÇÃO 2 - Verificar Cliente Real:');
console.log('   1. Certifique-se de estar usando um cliente real do sistema');
console.log('   2. Não use UUIDs fictícios para teste');
console.log('   3. O cliente deve pertencer à organização do usuário logado\n');

console.log('📋 SOLUÇÃO 3 - Verificar Banco de Dados:');
console.log('   1. Verificar se existem registros em organization_memberships');
console.log('   2. Verificar se o cliente existe na tabela clients');
console.log('   3. Verificar se org_id do cliente corresponde ao do usuário\n');

console.log('🎯 TESTE PRÁTICO:');
console.log('');
console.log('Para confirmar qual é o problema exato:');
console.log('');
console.log('1. Acesse: http://localhost:3000/dashboard');
console.log('2. Faça login com suas credenciais');
console.log('3. Vá para a página de um cliente específico');
console.log('4. Abra o DevTools (F12) > Console');
console.log('5. Clique em "Conectar Google Ads"');
console.log('6. Veja a mensagem de erro específica no console');
console.log('');
console.log('Se aparecer:');
console.log('- "Usuário não possui organização" → Problema de membership');
console.log('- "Acesso negado ao cliente" → Problema de permissão do cliente');
console.log('- Outro erro → Problema diferente');
console.log('');

console.log('⚠️  IMPORTANTE:');
console.log('   - O erro 403 só aparece quando o usuário ESTÁ logado');
console.log('   - Se não estivesse logado, seria erro 401');
console.log('   - Isso confirma que a autenticação está funcionando');
console.log('   - O problema é de autorização/permissões');
console.log('');

console.log('🎉 PROGRESSO:');
console.log('   ✅ Variáveis Google carregadas (não é mais 503)');
console.log('   ✅ Usuário consegue se autenticar (não é 401)');
console.log('   ❌ Problema de permissões (erro 403)');
console.log('');
console.log('O sistema está quase funcionando! Só falta resolver as permissões.');