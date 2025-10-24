#!/usr/bin/env node

/**
 * Script para testar o endpoint de signup e ver o erro completo
 */

const testSignup = async () => {
  try {
    console.log('🧪 Testando endpoint de signup...\n');

    const response = await fetch('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'teste@exemplo.com',
        password: 'senha123',
        name: 'Usuário Teste',
        organization_name: 'Organização Teste'
      })
    });

    const data = await response.json();

    console.log('📊 Status:', response.status);
    console.log('📦 Resposta completa:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.log('\n❌ Erro detectado!');
      console.log('Mensagem:', data.error);
      if (data.details) {
        console.log('Detalhes:', JSON.stringify(data.details, null, 2));
      }
    } else {
      console.log('\n✅ Signup realizado com sucesso!');
    }

  } catch (error) {
    console.error('❌ Erro ao testar:', error.message);
  }
};

testSignup();
