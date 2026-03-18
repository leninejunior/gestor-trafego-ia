/**
 * Supabase Module Index
 * Exporta todas as funcionalidades do módulo Supabase
 */

export { createClient, createServiceClient } from './server';
export { createClient as createBrowserClient } from './client';

export type {
  // Re-export types from @supabase/supabase-js if needed
  Database,
  SupabaseClient,
  User,
  Session,
  AuthError
} from '@supabase/supabase-js';