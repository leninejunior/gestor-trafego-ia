/**
 * Fix Google OAuth Callback URI
 * 
 * Corrige o URI de callback do Google OAuth para usar o endpoint principal
 * ao invés do callback-simple
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Corrigindo URI de callback do Google OAuth...\n');

// Arquivo a ser modificado
const oauthFilePath = path.join(__dirname, '..', 'src', 'lib', 'google', 'oauth.ts');

try {
  // Ler o arquivo atual
  let content = fs.readFileSync(oauthFilePath, 'utf8');
  
  console.log('📖 Lendo arquivo oauth.ts...');
  
  // Verificar o callback atual
  const currentCallbackMatch = content.match(/redirectUri: config\?.redirectUri \|\| `\${process\.env\.NEXT_PUBLIC_APP_URL}\/api\/google\/([^`]+)`/);
  
  if (currentCallbackMatch) {
    const currentCallback = currentCallbackMatch[1];
    console.log(`📍 Callback atual: /api/google/${currentCallback}`);
    
    if (currentCallback === 'callback-simple') {
      console.log('🔄 Alterando para callback principal...');
      
      // Substituir callback-simple por callback
      content = content.replace(
        '/api/google/callback-simple',
        '/api/google/callback'
      );
      
      // Escrever o arquivo modificado
      fs.writeFileSync(oauthFilePath, content, 'utf8');
      
      console.log('✅ Callback URI corrigido com sucesso!');
      console.log('📝 Novo callback: /api/google/callback');
      
    } else if (currentCallback === 'callback') {
      console.log('✅ Callback já está correto: /api/google/callback');
    } else {
      console.log(`⚠️  Callback desconhecido: ${currentCallback}`);
    }
  } else {
    console.log('❌ Não foi possível encontrar o padrão de callback no arquivo');
  }
  
  console.log('\n📋 PRÓXIMOS PASSOS:');
  console.log('1. Acesse o Google Cloud Console');
  console.log('2. Vá para APIs & Services > Credentials');
  console.log('3. Edite seu OAuth 2.0 Client ID');
  console.log('4. Adicione este URI de redirecionamento autorizado:');
  console.log('   https://gestor.engrene.com/api/google/callback');
  console.log('5. Salve as alterações');
  console.log('\n🔗 Link direto: https://console.cloud.google.com/apis/credentials');
  
} catch (error) {
  console.error('❌ Erro ao corrigir callback URI:', error.message);
  process.exit(1);
}