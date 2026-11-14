import { NextRequest, NextResponse } from 'next/server';
import {
  AUTH_COOKIE_NAME,
  generateTemporaryPassword,
  getSupabaseAdmin,
  hashPassword,
  verifySessionToken,
} from '@/lib/authSecurity';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = token ? verifySessionToken(token) : null;
    if (!session) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: admin, error: adminError } = await supabase
      .from('app_users')
      .select('id,role,department')
      .eq('id', session.sub)
      .maybeSingle();

    if (adminError || !admin || admin.department === '퇴사자') {
      return NextResponse.json({ success: false, error: '관리자 정보를 확인할 수 없습니다.' }, { status: 403 });
    }

    const role = String(admin.role || '').trim().toUpperCase();
    if (!['ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return NextResponse.json({ success: false, error: '관리자만 임시 비밀번호를 발급할 수 있습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const targetUserId = String(body?.targetUserId || '').trim();
    if (!targetUserId) {
      return NextResponse.json({ success: false, error: '대상 직원 아이디가 필요합니다.' }, { status: 400 });
    }

    const { data: target, error: targetError } = await supabase
      .from('app_users')
      .select('id,department')
      .eq('id', targetUserId)
      .maybeSingle();

    if (targetError || !target) {
      return NextResponse.json({ success: false, error: '대상 직원 계정을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (target.department === '퇴사자') {
      return NextResponse.json({ success: false, error: '퇴사 처리된 계정에는 발급할 수 없습니다.' }, { status: 403 });
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const { error: updateError } = await supabase
      .from('app_users')
      .update({
        password_hash: passwordHash,
        must_change_password: true,
        password_migrated_at: new Date().toISOString(),
      })
      .eq('id', targetUserId);

    if (updateError) {
      console.error('임시 비밀번호 저장 오류:', updateError.message);
      return NextResponse.json({ success: false, error: '임시 비밀번호를 저장하지 못했습니다.' }, { status: 500 });
    }

    // 평문 임시 비밀번호는 이 응답에서만 1회 전달하며 DB에는 해시만 저장합니다.
    return NextResponse.json({ success: true, temporaryPassword });
  } catch (error) {
    console.error('관리자 임시 비밀번호 API 오류:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ success: false, error: '임시 비밀번호 발급 중 서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
