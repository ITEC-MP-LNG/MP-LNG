import { createClient } from '@supabase/supabase-js';
import { supabase as localSupabase } from '@/lib/localSupabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const hasSupabaseConfig = Boolean(
  supabaseUrl && supabaseAnonKey && /^https?:\/\//i.test(supabaseUrl)
);

export const supabase = (() => {
  if (!hasSupabaseConfig || !supabaseUrl || !supabaseAnonKey) {
    return localSupabase;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
})();

export function getRoleLabel(role: string): string {
  switch (role) {
    case 'TOP_ADMIN':
      return '최고 관리자';
    case 'SUPER_ADMIN':
      return '총 관리자';
    case 'WORK_ADMIN':
      return '업무 관리자';
    case 'USER':
    default:
      return '일반 직원';
  }
}
