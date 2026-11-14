import { NextRequest, NextResponse } from 'next/server';
import {
  AUTH_COOKIE_NAME,
  getSupabaseAdmin,
  verifySessionToken,
} from '@/lib/authSecurity';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const session = verifySessionToken(token);
    if (!session) {
      const response = NextResponse.json(
        { success: false, error: '로그인 세션이 만료되었거나 유효하지 않습니다.' },
        { status: 401 }
      );
      response.cookies.delete(AUTH_COOKIE_NAME);
      return response;
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('app_users')
      .select(`
        id,
        name,
        user_name,
        role,
        email,
        department,
        job_title,
        join_date,
        career_start_date,
        work_status,
        must_change_password
      `)
      .eq('id', session.sub)
      .maybeSingle();

    if (error) {
      console.error('사용자 정보 조회 오류:', error.message);
      return NextResponse.json(
        { success: false, error: '사용자 정보를 확인할 수 없습니다.' },
        { status: 500 }
      );
    }

    if (!data || data.department === '퇴사자') {
      const response = NextResponse.json(
        { success: false, error: '사용할 수 없는 계정입니다.' },
        { status: 401 }
      );
      response.cookies.delete(AUTH_COOKIE_NAME);
      return response;
    }

    return NextResponse.json({
      success: true,
      user: {
        id: String(data.id),
        name: data.name || data.user_name || '사용자',
        role: String(data.role || 'USER').trim().toUpperCase(),
        email: data.email || '',
        department: data.department || '',
        job_title: data.job_title || '',
        join_date: data.join_date || '',
        career_start_date: data.career_start_date || '',
        work_status: data.work_status === '휴무' ? '휴무' : '근무중',
        must_change_password: Boolean(data.must_change_password),
      },
    });
  } catch (error) {
    console.error('세션 확인 API 오류:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { success: false, error: '로그인 상태를 확인하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
