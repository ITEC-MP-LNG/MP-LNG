import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("⚠️ Supabase 환경변수(URL 또는 Key)가 불러와지지 않았습니다. .env.local을 확인하세요.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// lib/supabase.ts 파일 하단에 추가

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