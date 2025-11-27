/**
 * Diagnóstico do Erro 403 - Google Ads API
 * 
 * Este script diagnostica por que estamos recebendo erro 403
 * "The caller does not have permission" da API do Google Ads
 */

require('dotenv').config();

// ============================================================================
// Configuração
// ============================================================================

const CUSTOMER_ID = '8938635478';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_DEVELOPER_TOKEN = process.env.GOOGLE_DEVELOPER_TOKEN;

console.log('\n========================================');
console.log('🔍 Diagnóstico Google Ads API - Erro 403');
console.log('========================================\n');

// ============================================================================
// Verificação de Variáveis de Ambiente
// ============================================================================

console.log('1️⃣ Verificando variáveis de ambiente...\n');

const checks = {
  'GOOGLE_CLIENT_ID': GOOGLE_CLIENT_ID,
  'GOOGLE_CLIENT_SECRET': GOOGLE_CLIENT_SECRET,
  'GOOGLE_DEVELOPER_TOKEN': GOOGLE_DEVELOPER_TOKEN,
};

let hasAllVars = true;

for (const [key, value] of Object.entries(checks)) {
  if (!value) {
    console.log(`❌ ${key}: NÃO DEFINIDA`);
    hasAllVars = false;
  } else {
    const masked = value.substring(0, 10) + '...';
    console.log(`✅ ${key}: ${masked}`);
  }
}

if (!hasAllVars) {
  console.log('\n⚠️ Algumas variáveis de ambiente estão faltando!');
  console.log('Verifique seu arquivo .env\n');
  process.exit(1);
}

// ============================================================================
// Verificação do Developer Token
// ============================================================================

console.log('\n2️⃣ Analisando Developer Token...\n');

if (GOOGLE_DEVELOPER_TOKEN) {
  // Developer tokens geralmente começam com letras e números
  const tokenPattern = /^[A-Za-z0-9_-]+$/;
  
  if (tokenPattern.test(GOOGLE_DEVELOPER_TOKEN)) {
    console.log('✅ Formato do Developer Token parece válido');
  } else {
    console.log('⚠️ Formato do Developer Token pode estar incorreto');
  }
  
  // Verificar se é um token de teste
  if (GOOGLE_DEVELOPER_TOKEN.includes('test') || GOOGLE_DEVELOPER_TOKEN.length < 20) {
    console.log('⚠️ Este parece ser um token de teste');
    console.log('   Tokens de teste têm limitações de acesso');
  }
  
  console.log(`   Comprimento: ${GOOGLE_DEVELOPER_TOKEN.length} caracteres`);
}

// ============================================================================
// Possíveis Causas do Erro 403
// ============================================================================

console.log('\n3️⃣ Possíveis causas do erro 403:\n');

const possibleCauses = [
  {
    title: 'Developer Token não aprovado',
    description: 'O token precisa ser aprovado pelo Google para acesso completo',
    solution: 'Acesse Google Ads API Center e verifique o status do token',
    url: 'https://ads.google.com/aw/apicenter',
  },
  {
    title: 'Conta sem permissões adequadas',
    description: 'O usuário OAuth não tem permissão de leitura na conta',
    solution: 'Verifique permissões em Ferramentas > Acesso e segurança',
    url: 'https://ads.google.com',
  },
  {
    title: 'Login Customer ID necessário',
    description: 'Conta gerenciada por MCC precisa do ID da conta gerenciadora',
    solution: 'Adicione login-customer-id no header da requisição',
    url: null,
  },
  {
    title: 'Token OAuth expirado ou inválido',
    description: 'O access token pode estar expirado ou revogado',
    solution: 'Verifique se o refresh token está funcionando',
    url: null,
  },
  {
    title: 'Conta suspensa ou desativada',
    description: 'A conta Google Ads pode estar suspensa',
    solution: 'Verifique o status da conta no Google Ads',
    url: 'https://ads.google.com',
  },
];

possibleCauses.forEach((cause, index) => {
  console.log(`${index + 1}. ${cause.title}`);
  console.log(`   📝 ${cause.description}`);
  console.log(`   💡 ${cause.solution}`);
  if (cause.url) {
    console.log(`   🔗 ${cause.url}`);
  }
  console.log('');
});

// ============================================================================
// Verificação de Estrutura do Customer ID
// ============================================================================

console.log('4️⃣ Verificando Customer ID...\n');

if (CUSTOMER_ID) {
  const cleanId = CUSTOMER_ID.replace(/-/g, '');
  
  console.log(`   Original: ${CUSTOMER_ID}`);
  console.log(`   Limpo: ${cleanId}`);
  console.log(`   Comprimento: ${cleanId.length} dígitos`);
  
  if (cleanId.length === 10) {
    console.log('   ✅ Formato correto (10 dígitos)');
  } else {
    console.log('   ⚠️ Formato pode estar incorreto (esperado: 10 dígitos)');
  }
}

// ============================================================================
// Teste de Conectividade com Google OAuth
// ============================================================================

console.log('\n5️⃣ Testando conectividade com Google OAuth...\n');

async function testGoogleOAuth() {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: 'invalid_token_for_test',
      }),
    });
    
    const data = await response.json();
    
    if (response.status === 400 && data.error === 'invalid_grant') {
      console.log('✅ Conectividade com Google OAuth OK');
      console.log('   (Erro esperado: invalid_grant com token de teste)');
      return true;
    } else if (response.status === 401 && data.error === 'invalid_client') {
      console.log('❌ Client ID ou Client Secret inválidos');
      return false;
    } else {
      console.log(`⚠️ Resposta inesperada: ${response.status}`);
      console.log(JSON.stringify(data, null, 2));
      return false;
    }
  } catch (error) {
    console.log('❌ Erro ao conectar com Google OAuth:');
    console.log(`   ${error.message}`);
    return false;
  }
}

// ============================================================================
// Recomendações
// ============================================================================

async function showRecommendations() {
  console.log('\n6️⃣ Recomendações para resolver o erro 403:\n');
  
  const recommendations = [
    {
      priority: 'ALTA',
      action: 'Verificar status do Developer Token',
      steps: [
        '1. Acesse https://ads.google.com/aw/apicenter',
        '2. Verifique se o token está "Aprovado"',
        '3. Se estiver "Pendente", solicite aprovação',
        '4. Se estiver "Rejeitado", crie um novo token',
      ],
    },
    {
      priority: 'ALTA',
      action: 'Verificar permissões do usuário OAuth',
      steps: [
        '1. Acesse https://ads.google.com',
        '2. Vá em Ferramentas > Acesso e segurança',
        '3. Verifique se o email OAuth tem permissão "Padrão" ou "Admin"',
        '4. Se não tiver, adicione o usuário com permissões adequadas',
      ],
    },
    {
      priority: 'MÉDIA',
      action: 'Testar com Login Customer ID',
      steps: [
        '1. Identifique se a conta é gerenciada por uma MCC',
        '2. Se sim, obtenha o Customer ID da conta MCC',
        '3. Adicione header "login-customer-id" nas requisições',
        '4. Teste novamente',
      ],
    },
    {
      priority: 'MÉDIA',
      action: 'Verificar status da conta Google Ads',
      steps: [
        '1. Acesse https://ads.google.com',
        '2. Verifique se a conta está ativa',
        '3. Verifique se não há suspensões ou avisos',
        '4. Verifique se a conta tem campanhas ativas',
      ],
    },
    {
      priority: 'BAIXA',
      action: 'Reconectar conta OAuth',
      steps: [
        '1. Desconecte a conta no sistema',
        '2. Revogue o acesso em https://myaccount.google.com/permissions',
        '3. Reconecte a conta com OAuth',
        '4. Teste novamente',
      ],
    },
  ];
  
  recommendations.forEach((rec, index) => {
    console.log(`${index + 1}. [${rec.priority}] ${rec.action}`);
    rec.steps.forEach(step => {
      console.log(`   ${step}`);
    });
    console.log('');
  });
}

// ============================================================================
// Execução
// ============================================================================

(async () => {
  await testGoogleOAuth();
  await showRecommendations();
  
  console.log('========================================');
  console.log('✅ Diagnóstico concluído');
  console.log('========================================\n');
  
  console.log('📋 Próximos passos:');
  console.log('1. Aplicar migração de schema (APLICAR_MIGRACAO_SCHEMA_RELOAD.md)');
  console.log('2. Seguir recomendações acima para resolver erro 403');
  console.log('3. Testar novamente com: node scripts/test-google-health-check.js\n');
})();
