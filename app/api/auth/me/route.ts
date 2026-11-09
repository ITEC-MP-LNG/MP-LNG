
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';

export const runtime = 'nodejs';

const COOKIE_NAME = 'mp_lng_session';

interface SessionPayload {
  sub: string;
  exp: number;
}

function verifySessionToken(token: string): SessionPayload | null {
  try {
    const secret = process.env.AUTH_SECRET;

    if (!secret) {
      throw new Error('AUTH_SECRET 환경변수가 설정되지 않았습니다.');
    }

    const parts = token.split('.');

    if (parts.length !== 2) {
      return null;
    }

    const [encodedPayload, receivedSignature] = parts;

    const expectedSignature = createHmac('sha256', secret)
      .update(encodedPayload)
      .digest('base64url');

    const receivedBuffer = Buffer.from(receivedSignature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as SessionPayload;

    if (
      !payload.sub ||
      !payload.exp ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error('세션 검증 오류:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;

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

      response.cookies.delete(COOKIE_NAME);
      return response;
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
        work_status
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

      response.cookies.delete(COOKIE_NAME);
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
      },
    });

  } catch (error) {
    console.error('세션 확인 API 오류:', error);

    return NextResponse.json(
      {
        success: false,
        error: '로그인 상태를 확인하는 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
