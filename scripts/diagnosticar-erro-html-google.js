require('dotenv').config();
const { GoogleAdsApi } = require('google-ads-api');

console.log('🔍 DIAGNOSTICANDO ERRO HTML DO GOOGLE ADS\n');

async function diagnosticar() {
  try {
    console.log('📋 CONFIGURAÇÃO:');
    console.log('Developer Token:', process.env.GOOGLE_DEVELOPER_TOKEN?.substring(0, 10) + '...');
    console.log('Client ID:', process.env.GOOGLE_CLIENT_ID?.substring(0, 20) + '...');
    console.log('Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? '✅ Configurado' : '❌ Faltando');
    console.log('');

    // Simula a chamada que está falhando
    const client = new GoogleAdsApi({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      developer_token: process.env.GOOGLE_DEVELOPER_TOKEN,
    });

    // Usa um refresh token de teste (você precisa substituir por um real)
    const customer = client.Customer({
      customer_id: '123-456-7890', // ID de teste
      refresh_token: 'test_refresh_token', // Você precisa de um token real
    });

    console.log('📡 TENTANDO LISTAR CLIENTES ACESSÍVEIS...');
    
    try {
      const customers = await customer.listAccessibleCustomers();
      console.log('✅ SUCESSO! Clientes:', customers);
    } catch (error) {
      console.error('❌ ERRO NA CHAMADA:', error.message);
      
      // Analisa o erro
      if (error.message.includes('DOCTYPE')) {
        console.log('\n🔍 ANÁLISE DO ERRO:');
        console.log('A API está retornando HTML em vez de JSON.');
        console.log('');
        console.log('📊 POSSÍVEIS CAUSAS:');
        console.log('1. ❌ Developer Token não aprovado para Acesso Standard');
        console.log('2. ❌ Refresh Token inválido ou expirado');
        console.log('3. ❌ Credenciais OAuth incorretas');
        console.log('4. ❌ Conta Google Ads não vinculada ao MCC');
        console.log('');
        console.log('💡 SOLUÇÃO:');
        console.log('1. Solicite Acesso Standard em: https://ads.google.com/aw/apicenter');
        console.log('2. Aguarde aprovação do Google (pode levar alguns dias)');
        console.log('3. Enquanto isso, o sistema funciona com dados mockados');
      }
      
      // Tenta fazer uma chamada HTTP direta para ver a resposta
      console.log('\n🔬 TENTANDO CHAMADA HTTP DIRETA...');
      const https = require('https');
      
      const options = {
        hostname: 'googleads.googleapis.com',
        port: 443,
        path: '/v17/customers:listAccessibleCustomers',
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test_token',
          'developer-token': process.env.GOOGLE_DEVELOPER_TOKEN,
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          console.log('Status:', res.statusCode);
          console.log('Headers:', res.headers);
          console.log('Body (primeiros 500 chars):', data.substring(0, 500));
          
          if (data.includes('<!DOCTYPE')) {
            console.log('\n⚠️ CONFIRMADO: API retorna HTML');
            console.log('Isso indica que o Developer Token não tem permissão suficiente.');
          }
        });
      });

      req.on('error', (error) => {
        console.error('Erro na requisição:', error.message);
      });

      req.end();
    }

  } catch (error) {
    console.error('❌ ERRO CRÍTICO:', error.message);
  }
}

diagnosticar();
