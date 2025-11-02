require('dotenv').config();

console.log('🧪 TESTANDO KPIs DOS USUÁRIOS');
console.log('============================');

async function testarKpisUsuarios() {
  try {
    // Testar API simple
    console.log('🌐 Testando KPIs na API /api/admin/users/simple...');
    
    const response = await fetch('http://localhost:3000/api/admin/users/simple', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API funcionou!');
      
      console.log('\n📊 KPIs dos Usuários:');
      console.log(`👥 Total: ${data.stats.total}`);
      console.log(`✅ Ativos: ${data.stats.active}`);
      console.log(`⏳ Pendentes: ${data.stats.pending}`);
      console.log(`🚫 Suspensos: ${data.stats.suspended}`);
      console.log(`👑 Super Admins: ${data.stats.superAdmins}`);
      
      // Verificar se os números batem
      const totalCalculado = data.stats.active + data.stats.pending + data.stats.suspended;
      const superAdminsReais = data.users.filter(u => u.user_type === 'Super Admin').length;
      
      console.log('\n🔍 Verificações:');
      console.log(`✅ Total de usuários: ${data.users.length} (esperado: ${data.stats.total})`);
      console.log(`${totalCalculado === data.stats.total ? '✅' : '❌'} Soma dos status: ${totalCalculado} = ${data.stats.total}`);
      console.log(`${superAdminsReais === data.stats.superAdmins ? '✅' : '❌'} Super Admins: ${superAdminsReais} = ${data.stats.superAdmins}`);
      
      // Listar Super Admins
      const superAdmins = data.users.filter(u => u.user_type === 'Super Admin');
      console.log('\n👑 Super Admins encontrados:');
      superAdmins.forEach((admin, index) => {
        console.log(`  ${index + 1}. ${admin.email}`);
      });
      
      if (data.stats.superAdmins === 2) {
        console.log('\n🎉 CORREÇÃO FUNCIONOU! KPIs estão corretos!');
      } else {
        console.log('\n❌ Ainda há problema na contagem');
      }
      
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

testarKpisUsuarios().catch(err => {
  console.log('❌ Erro na execução:', err.message);
});