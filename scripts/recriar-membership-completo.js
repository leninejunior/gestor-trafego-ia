const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function recriar() {
  console.log('🔧 RECRIANDO MEMBERSHIP COMPLETO\n');

  // 1. Usuário
  const { data: users } = await supabase.auth.admin.listUsers();
  const lenine = users.users.find(u => u.email === 'lenine.engrene@gmail.com');
  
  console.log('✅ Usuário:', lenine.id);
  console.log('   Email:', lenine.email);

  // 2. Org
  const orgId = '01bdaa04-1873-427f-8caa-b79bc7dd2fa2';
  console.log('\n✅ Org:', orgId);

  // 3. Criar membership
  console.log('\n🔧 Criando membership...');
  const { data: newMembership, error: insertError } = await supabase
    .from('memberships')
    .insert({
      user_id: lenine.id,
      org_id: orgId,
      role: 'owner',
      status: 'active',
      accepted_at: new Date().toISOString()
    })
    .select();

  if (insertError) {
    console.error('❌ Erro ao criar:', insertError);
    return;
  }

  console.log('✅ Membership criada:', newMembership);

  // 4. Verifica