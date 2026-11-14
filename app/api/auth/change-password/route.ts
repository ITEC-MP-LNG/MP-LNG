import { NextRequest, NextResponse } from 'next/server';
import {
  AUTH_COOKIE_NAME,
  getSupabaseAdmin,
  hashPassword,
  verifyPassword,
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

    const body = await request.json();
    const currentPassword = String(body?.currentPassword ?? '');
    const newPassword = String(body?.newPassword ?? '');

    if (!currentPassword || newPassword.length < 8 || newPassword.length > 128) {
      return NextResponse.json(
        { success: false, error: '현재 비밀번호를 확인하고 새 비밀번호를 8~128자로 입력해 주세요.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data: user, error: readError } = await supabase
      .from('app_users')
      .select('id,password_hash,must_change_password,department')
      .eq('id', session.sub)
      .maybeSingle();

    if (readError || !user || user.department === '퇴사자') {
      return NextResponse.json({ success: false, error: '사용자 정보를 확인할 수 없습니다.' }, { status: 401 });
    }

    if (!user.password_hash || !(await verifyPassword(currentPassword, String(user.password_hash)))) {
      return NextResponse.json({ success: false, error: '현재 비밀번호가 일치하지 않습니다.' }, { status: 401 });
    }
    if (await verifyPassword(newPassword, String(user.password_hash))) {
      return NextResponse.json({ success: false, error: '현재 비밀번호와 다른 비밀번호를 설정해 주세요.' }, { status: 400 });
    }

    const passwordHash = await hashPassword(newPassword);
    const { error: updateError } = await supabase
      .from('app_users')
      .update({
        password_hash: passwordHash,
        must_change_password: false,
        password_migrated_at: new Date().toISOString(),
      })
      .eq('id', session.sub);

    if (updateError) {
      console.error('비밀번호 변경 저장 오류:', updateError.message);
      return NextResponse.json({ success: false, error: '비밀번호 변경 내용을 저장하지 못했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('비밀번호 변경 API 오류:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ success: false, error: '비밀번호 변경 중 서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
