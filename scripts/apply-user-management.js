const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyUserManagement() {
  try {
    console.log('📝 Aplicando colunas de gerenciamento de usuários...');
    
    // Adicionar colunas de suspensão na tabela user_profiles
    const { error1 } = await supabase.rpc('exec', { 
      sql: `
        ALTER TABLE user_profiles 
        ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES auth.users(id),
        ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);
      `
    });
    
    if (error1) {
      console.log('⚠️ Erro ao adicionar colunas (pode ser normal se já existem):', error1.message);
    } else {
      console.log('✅ Colunas de gerenciamento adicionadas!');
    }
    
    // Sincronizar dados do auth.users
    const { error2 } = await supabase.rpc('exec', { 
      sql: `
        UPDATE user_profiles 
        SET email = au.email,
            created_at = COALESCE(user_profiles.created_at, au.created_at),
            last_sign_in_at = au.last_sign_in_at
        FROM auth.users au
        WHERE user_profiles.user_id = au.id
        AND (user_profiles.email IS NULL OR user_profiles.email != au.email);
      `
    });
    
    if (error2) {
      console.log('⚠️ Erro ao sincronizar dados:', error2.message);
    } else {
      console.log('✅ Dados sincronizados!');
    }
    
    console.log('🎯 Aplicação de gerenciamento de usuários concluída!');
    
  } catch (err) {
    console.error('❌ Erro geral:', err.message);
  }
}

applyUserManagement();