import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  AUTH_COOKIE_NAME,
  SESSION_DURATION,
  createSessionToken,
  getSupabaseAdmin,
  hashPassword,
  verifyPassword,
} from '@/lib/authSecurity';

export const runtime = 'nodejs';

function legacyPasswordMatches(input: string, data: any): boolean {
  const candidates = [data.password, data.birth_date, data.birthdate]
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
    .map((value) => String(value).trim());

  const normalizedInput = input.replace(/[^0-9]/g, '');
  return candidates.some((candidate) => {
    if (candidate === input) return true;
    const digits = candidate.replace(/[^0-9]/g, '');
    return digits.length === 8 && digits === normalizedInput;
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userCode = String(body?.userCode || '').trim();
    const password = String(body?.password ?? '');

    if (!userCode || !password.trim()) {
      return NextResponse.json(
        { error: '아이디와 비밀번호를 입력해 주세요.' },
        { status: 400 }
      );
    }
    if (password.length > 256) {
      return NextResponse.json({ error: '비밀번호 형식이 올바르지 않습니다.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    let { data, error } = await supabase
      .from('app_users')
      .select('*')
      .ilike('id', userCode)
      .maybeSingle();

    if (error && error.message?.includes('column')) {
      const retryResult = await supabase
        .from('app_users')
        .select('*')
        .ilike('user_id', userCode)
        .maybeSingle();
      data = retryResult.data;
      error = retryResult.error;
    }

    if (error) {
      console.error('로그인 DB 조회 오류:', error.message);
      return NextResponse.json(
        { error: '로그인 정보를 확인하는 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }
    if (!data) {
      return NextResponse.json({ error: '존재하지 않는 아이디입니다.' }, { status: 401 });
    }
    if (data.department === '퇴사자') {
      return NextResponse.json(
        { error: '퇴사 처리된 계정입니다. 관리자에게 문의해 주세요.' },
        { status: 403 }
      );
    }

    const targetId = data.id !== undefined ? data.id : data.user_id;
    const idColumnName = data.id !== undefined ? 'id' : 'user_id';
    if (!targetId) throw new Error('사용자 ID를 확인할 수 없습니다.');

    let mustChangePassword = Boolean(data.must_change_password);
    let migrationHash: string | null = null;

    if (data.password_hash) {
      const valid = await verifyPassword(password, String(data.password_hash));
      if (!valid) {
        return NextResponse.json({ error: '비밀번호가 일치하지 않습니다.' }, { status: 401 });
      }
    } else {
      // 기존 생년월일 비밀번호는 해시가 없는 계정에 한해 1회 전환 로그인에만 허용합니다.
      if (!legacyPasswordMatches(password, data)) {
        return NextResponse.json({ error: '비밀번호가 일치하지 않습니다.' }, { status: 401 });
      }
      migrationHash = await hashPassword(password);
      mustChangePassword = true;
    }

    const updatePayload: Record<string, any> = {
      last_login_at: new Date().toISOString(),
    };
    if (migrationHash) {
      updatePayload.password_hash = migrationHash;
      updatePayload.must_change_password = true;
      updatePayload.password_migrated_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('app_users')
      .update(updatePayload)
      .eq(idColumnName, targetId);

    if (updateError) {
      console.error('로그인 정보 저장 오류:', updateError.message);
      return NextResponse.json(
        { error: '로그인 정보를 저장하지 못했습니다. 다시 시도해 주세요.' },
        { status: 500 }
      );
    }

    const userInfo = {
      id: String(targetId),
      name: data.name || '사용자',
      role: data.role || 'USER',
      email: data.email || '',
      department: data.department || '',
      job_title: data.job_title || '',
      join_date: data.join_date || '',
      career_start_date: data.career_start_date || '',
      work_status: data.work_status || '',
      must_change_password: mustChangePassword,
    };

    const token = createSessionToken(String(targetId));
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION,
    });

    return NextResponse.json({ success: true, user: userInfo });
  } catch (error) {
    console.error('서버 로그인 오류:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { error: '로그인 중 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    );
  }
}
