const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('🔍 VERIFICANDO TABELA ADMIN_USERS\n');

  // Tentar buscar dados da tabela
  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .limit(1);

  console.log('Data:', data);
  console.log('Error:', error);

  // Se a tabela não existir, vamos criar
  if (error && error.code === 'PGRST106') {
    console.log('\n📝 Tabela admin_users não existe. Criando...');
    
    // Criar tabela via SQL
    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS admin_users (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          role TEXT NOT NULL DEFAULT 'admin',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id)
        );
        
        -- Criar RLS
        ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
        
        -- Policy para admins
        CREATE POLICY "Admin users can manage admin_users" ON admin_users
          FOR ALL USING (
            EXISTS (
              SELECT 1 FROM admin_users au 
              WHERE au.user_id = auth.uid() 
              AND au.role IN ('super_admin', 'admin')
            )
          );
      `
    });

    if (createError) {
      console.error('❌ Erro ao criar tabela:', createError);
    } else {
      console.log('✅ Tabela admin_users criada!');
    }
  }

  // Verificar usuário atual
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users[0];
  
  // Inserir admin user
  const { error: insertError } = await supabase
    .from('admin_users')
    .insert({
      user_id: user.id,
      role: 'super_admin'
    });

  if (insertError) {
    console.error('❌ Erro ao inserir admin:', insertError);
  } else {
    console.log('✅ Admin user criado!');
  }
}

main().catch(console.error);