import { createClient } from '@/lib/supabase/server'
import { createClient as createClientClient } from '@/lib/supabase/client'

/**
 * Verifica se um usuário é super administrador
 */
export async function isSuperAdmin(userId?: string): Promise<boolean> {
  if (!userId) return false;
  
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('super_admins')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();
    
    return !error && !!data;
  } catch (error) {
    console.error('Erro ao verificar super admin:', error);
    return false;
  }
}

/**
 * Verifica se o usuário atual é super administrador (client-side)
 */
export async function isCurrentUserSuperAdmin(): Promise<boolean> {
  try {
    const supabase = createClientClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    
    const { data, error } = await supabase
      .from('super_admins')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();
    
    return !error && !!data;
  } catch (error) {
    console.error('Erro ao verificar super admin atual:', error);
    return false;
  }
}

/**
 * Middleware para verificar se o usuário é super admin
 */
export async function requireSuperAdmin(userId?: string): Promise<boolean> {
  const isSuper = await isSuperAdmin(userId);
  if (!isSuper) {
    throw new Error('Acesso negado: apenas super administradores podem realizar esta ação');
  }
  return true;
}

/**
 * Hook para usar no frontend
 */
export function useSuperAdmin() {
  return {
    isSuperAdmin: isCurrentUserSuperAdmin,
    requireSuperAdmin: () => requireSuperAdmin()
  };
}