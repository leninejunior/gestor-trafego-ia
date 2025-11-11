/**
 * Corrigir Tabela google_ads_connections
 * Adiciona a coluna token_expires_at que está faltando
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function corrigirTabela() {
  console.log('🔧 CORRIGINDO TABELA google_ads_connections');
  console.log('='.repeat(60));
  
  try {
    // 1. Verificar estrutura atual
    console.log('\n1️⃣ VERIFICANDO ESTRUTURA ATUAL...');
    
    const { data: testData, error: testError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .limit(1);
    
    if (testError) {
      console.log('⚠️ Erro ao consultar tabela:', testError.message);
    } else {
      console.log('✅ Tabela existe');
      if (testData && testData.length > 0) {
        console.log('📋 Colunas atuais:', Object.keys(testData[0]));
      }
    }
    
    // 2. SQL para adicionar a coluna
    console.log('\n2️⃣ SQL PARA EXECUTAR NO SUPABASE:');
    console.log('='.repeat(60));
    
    const sql = `
-- Adicionar coluna token_expires_at se não existir
ALTER TABLE google_ads_connections 
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

-- Atualizar conexões existentes com data de expiração padrão (1 hora a partir de agora)
UPDATE google_ads_connections 
SET token_expires_at = NOW() + INTERVAL '1 hour'
WHERE token_expires_at IS NULL;

-- Verificar estrutura
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'google_ads_connections'
ORDER BY ordinal_position;
`;
    
    console.log(sql);
    console.log('='.repeat(60));
    
    console.log('\n📋 INSTRUÇÕES:');
    console.log('1. Copie o SQL acima');
    console.log('2. Vá para o Supabase Dashboard');
    console.log('3. Abra o SQL Editor');
    console.log('4. Cole e execute o SQL');
    console.log('5. Volte aqui e pressione Enter para continuar');
    
    // Aguardar confirmação
    await new Promise(resolve => {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      readline.question('\n✅ Executou o SQL no Supabase? (pressione Enter) ', () => {
        readline.close();
        resolve();
      });
    });
    
    // 3. Verificar se a correção funcionou
    console.log('\n3️⃣ VERIFICANDO CORREÇÃO...');
    
    const { data: verifyData, error: verifyError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .limit(1);
    
    if (verifyError) {
      console.error('❌ Ainda há erro:', verifyError.message);
    } else {
      console.log('✅ Tabela corrigida com sucesso!');
      if (verifyData && verifyData.length > 0) {
        console.log('📋 Colunas após correção:', Object.keys(verifyData[0]));
        
        if (Object.keys(verifyData[0]).includes('token_expires_at')) {
          console.log('✅ Coluna token_expires_at adicionada com sucesso!');
        } else {
          console.log('❌ Coluna token_expires_at ainda não existe');
        }
      }
    }
    
    console.log('\n🎯 PRÓXIMO PASSO:');
    console.log('Faça o OAuth novamente no navegador!');
    console.log('Agora deve funcionar corretamente.');
    
  } catch (error) {
    console.error('❌ ERRO:', error);
  }
}

corrigirTabela().catch(console.error);
