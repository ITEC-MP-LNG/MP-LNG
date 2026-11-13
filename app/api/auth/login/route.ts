
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';

export const runtime = 'nodejs';

const COOKIE_NAME = 'mp_lng_session';
const SESSION_DURATION = 30 * 60; // 30분

function createSessionToken(userId: string) {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error('AUTH_SECRET 환경변수가 설정되지 않았습니다.');
  }

  const payload = {
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_DURATION,
  };

  const encodedPayload = Buffer
    .from(JSON.stringify(payload))
    .toString('base64url');

  const signature = createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const userCode = String(body.userCode || '').trim();
    const password = String(body.password || '').trim();

    if (!userCode || !password) {
      return NextResponse.json(
        { error: '아이디와 비밀번호를 입력해 주세요.' },
        { status: 400 }
      );
    }

    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase 서버 환경변수가 설정되지 않았습니다.');
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 기존 로그인과 동일하게 ID로 조회
    let { data, error } = await supabase
      .from('app_users')
      .select('*')
      .ilike('id', userCode)
      .maybeSingle();

    // id 컬럼이 없는 경우 user_id로 재조회
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
      return NextResponse.json(
        { error: '존재하지 않는 아이디입니다.' },
        { status: 401 }
      );
    }

    if (data.department === '퇴사자') {
      return NextResponse.json(
        { error: '퇴사 처리된 계정입니다. 관리자에게 문의해 주세요.' },
        { status: 403 }
      );
    }
// 계정 정지 여부 확인
if (data.is_suspended === true) {
  return NextResponse.json(
    { error: '정지된 계정입니다. 관리자에게 문의해 주세요.' },
    { status: 403 }
  );
}
    // 기존 로그인 비밀번호 판정 방식 유지
    const userPassword =
      data.password || data.birth_date || data.birthdate || '';

    if (String(userPassword).trim() !== password) {
      return NextResponse.json(
        { error: '비밀번호가 일치하지 않습니다.' },
        { status: 401 }
      );
    }

    const targetId = data.id !== undefined
      ? data.id
      : data.user_id;

    const idColumnName = data.id !== undefined
      ? 'id'
      : 'user_id';

    // 마지막 로그인 시간 저장
    const { error: updateError } = await supabase
      .from('app_users')
      .update({
        last_login_at: new Date().toISOString(),
      })
      .eq(idColumnName, targetId);

    if (updateError) {
      throw new Error(
        '마지막 로그인 시간 저장에 실패했습니다: ' +
        updateError.message
      );
    }

    if (!targetId) {
      throw new Error('사용자 ID를 확인할 수 없습니다.');
    }

    // 비밀번호 등 민감정보는 응답에 포함하지 않음
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
    };

    const token = createSessionToken(String(targetId));

    const cookieStore = await cookies();

    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION,
    });

    return NextResponse.json({
      success: true,
      user: userInfo,
    });

  } catch (error) {
    console.error('서버 로그인 오류:', error);

    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : '로그인 중 알 수 없는 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
