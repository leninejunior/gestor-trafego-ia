require('dotenv').config();

console.log('🧪 TESTANDO TIPOS DE USUÁRIOS');
console.log('=============================');

async function testarTiposUsuarios() {
  try {
    // Testar API simple
    console.log('🌐 Testando API /api/admin/users/simple...');
    
    const response = await fetch('http://localhost:3000/api/admin/users/simple', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API funcionou!');
      console.log(`👥 Total de usuários: ${data.users.length}`);
      
      console.log('\n📋 Lista de usuários com tipos:');
      data.users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email}`);
        console.log(`   Nome: ${user.first_name} ${user.last_name}`);
        console.log(`   Tipo: ${user.user_type}`);
        console.log(`   Memberships: ${user.memberships?.length || 0}`);
        console.log('');
      });
      
      // Contar tipos
      const tiposCounts = {};
      data.users.forEach(user => {
        tiposCounts[user.user_type] = (tiposCounts[user.user_type] || 0) + 1;
      });
      
      console.log('📊 Resumo por tipo:');
      Object.entries(tiposCounts).forEach(([tipo, count]) => {
        const emoji = tipo === 'Super Admin' ? '👑' : 
                     tipo === 'Admin' ? '🛡️' : 
                     tipo === 'Membro' ? '👤' : '👥';
        console.log(`   ${emoji} ${tipo}: ${count}`);
      });
      
    } else {
      console.log('❌ API retornou erro:', response.status);
      const text = await response.text();
      console.log('📄 Resposta:', text);
    }
    
    console.log('\n🎯 TESTE CONCLUÍDO!');
    
  } catch (error) {
    console.log('❌ Erro inesperado:', error.message);
  }
}

testarTiposUsuarios().catch(err => {
  console.log('❌ Erro na execução:', err.message);
});