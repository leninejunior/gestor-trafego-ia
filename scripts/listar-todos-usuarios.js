require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listar() {
  console.log('👥 LISTANDO TODOS OS USUÁRIOS\n');

  try {
    const { data: users, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.error('❌ Erro:', error);
      return;
    }

    if (!users || users.users.length === 0) {
      console.log('⚠️  Nenhum usuário encontrado!');
      return;
    }

    console.log(`✅ Total de usuários: ${users.users.length}\n`);

    for (const user of users.users) {
      console.log('─'.repeat(60));
      console.log(`📧 Email: ${user.email}`);
      console.log(`🆔 ID: ${user.id}`);
      console.log(`✉️  Confirmado: ${user.email_confirmed_at ? 'Sim' : 'Não'}`);
      console.log(`📅 Criado: ${new Date(user.created_at).toLocaleString('pt-BR')}`);
      console.log(`🔐 Último login: ${user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('pt-BR') : 'Nunca'}`);

      // Verificar super_admin
      const { data: sa } = await supabase
        .from('super_admins')
        .select('*')
        .eq('user_id', user.id)
        .single();

      console.log(`👑 Super Admin: ${sa ? 'SIM' : 'Não'}`);

      // Verificar memberships
      const { data: memberships } = await supabase
        .from('memberships')
        .select('*, organizations(name)')
        .eq('user_id', user.id);

      if (memberships && memberships.length > 0) {
        console.log(`🏢 Organizações: ${memberships.length}`);
        memberships.forEach(m => {
          console.log(`   - ${m.organizations?.name || 'N/A'} (${m.role})`);
        });
      } else {
        console.log(`🏢 Organizações: Nenhuma`);
      }
    }

    console.log('─'.repeat(60));

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

listar();
