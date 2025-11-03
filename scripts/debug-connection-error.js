const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 DIAGNÓSTICO DO ERRO DE CONEXÃO');
console.log('================================');

async function debugConnectionError() {
  try {
    // 1. Verificar variáveis de ambiente
    console.log('\n1. VERIFICANDO VARIÁVEIS DE AMBIENTE:');
    console.log('SUPABASE_URL:', supabaseUrl ? '✅ Definida' : '❌ Não definida');
    console.log('SUPABASE_ANON_KEY:', supabaseKey ? '✅ Definida' : '❌ Não definida');
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('❌ Variáveis de ambiente do Supabase não configuradas');
      return;
    }

    // 2. Testar conexão com Supabase
    console.log('\n2. TESTANDO CONEXÃO COM SUPABASE:');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data: authData, error: authError } = await supabase.auth.getUser();
    console.log('Auth status:', authError ? '❌ Erro' : '✅ OK');
    if (authError) console.log('Auth error:', authError.message);

    // 3. Verificar tabelas necessárias
    console.log('\n3. VERIFICANDO TABELAS DO GOOGLE ADS:');
    
    const { data: googleConnections, error: googleError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .limit(1);
    
    console.log('Tabela google_ads_connections:', googleError ? '❌ Erro' : '✅ OK');
    if (googleError) console.log('Erro:', googleError.message);

    // 4. Verificar variáveis do Google
    console.log('\n4. VERIFICANDO CONFIGURAÇÃO DO GOOGLE:');
    console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✅ Definida' : '❌ Não definida');
    console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✅ Definida' : '❌ Não definida');

    // 5. Testar endpoint de auth do Google
    console.log('\n5. TESTANDO ENDPOINT DE AUTH DO GOOGLE:');
    try {
      const response = await fetch('http://localhost:3000/api/google/auth', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Status da resposta:', response.status);
      const responseText = await response.text();
      console.log('Resposta:', responseText.substring(0, 200));
      
    } catch (fetchError) {
      console.log('❌ Erro ao testar endpoint:', fetchError.message);
    }

    // 6. Verificar logs recentes
    console.log('\n6. VERIFICANDO LOGS RECENTES:');
    console.log('Verifique o console do navegador e os logs do servidor para mais detalhes');

  } catch (error) {
    console.error('❌ Erro durante diagnóstico:', error);
  }
}

// Carregar variáveis de ambiente
require('dotenv').config();

debugConnectionError();