
import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const COOKIE_NAME = 'mp_lng_session';

interface SessionPayload {
  sub: string;
  exp: number;
}

function verifySessionToken(token: string): SessionPayload | null {
  try {
    const secret = process.env.AUTH_SECRET;
    if (!secret) return null;

    const parts = token.split('.');
    if (parts.length !== 2) return null;

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
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. 로그인 쿠키 확인
    const token = request.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const session = verifySessionToken(token);

    if (!session) {
      return NextResponse.json(
        { success: false, error: '로그인 세션이 만료되었습니다.' },
        { status: 401 }
      );
    }
const { data: user, error: userError } = await supabaseAdmin
  .from('app_users')
  .select('id, department,is_suspended')
  .eq('id', session.sub)
  .maybeSingle();

if (
  userError ||
  !user ||
  user.department === '퇴사자' ||
  user.is_suspended === true
) {
  return NextResponse.json(
    { success: false, error: '사용할 수 없는 계정입니다.' },
    { status: 401 }
  );
}
    // 2. 브라우저 구독 정보 확인
    const body = await request.json();
    const subscription = body.subscription;

    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;

    if (
      typeof endpoint !== 'string' ||
      typeof p256dh !== 'string' ||
      typeof auth !== 'string'
    ) {
      return NextResponse.json(
        { success: false, error: '푸시 구독 정보가 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    try {
      if (new URL(endpoint).protocol !== 'https:') {
        throw new Error('Invalid endpoint');
      }
    } catch {
      return NextResponse.json(
        { success: false, error: '푸시 주소가 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    // 3. 기존 구독 주소의 소유자 확인
const { data: existing, error: checkError } = await supabaseAdmin
  .from('push_subscriptions')
  .select('user_id')
  .eq('endpoint', endpoint)
  .maybeSingle();

if (checkError) {
  throw checkError;
}

if (existing && existing.user_id !== session.sub) {
  return NextResponse.json(
    { success: false, error: '다른 계정에 등록된 구독 주소입니다.' },
    { status: 409 }
  );
}

const subscriptionData = {
  user_id: session.sub,
  endpoint,
  p256dh,
  auth,
  updated_at: new Date().toISOString(),
};



// 새 구독 등록 또는 기존 구독 갱신
const { error: insertError } = await supabaseAdmin
  .from('push_subscriptions')
  .upsert(subscriptionData, {
    onConflict: 'endpoint',
  });

if (insertError) {
  throw insertError;
}

// 새 구독 등록 성공 후 같은 직원의 이전 기기 구독 정리
const { error: deleteError } = await supabaseAdmin
  .from('push_subscriptions')
  .delete()
  .eq('user_id', session.sub)
  .neq('endpoint', endpoint);

if (deleteError) {
  throw deleteError;
}


    return NextResponse.json({
      success: true,
      message: '푸시 알림 등록이 완료되었습니다.',
    });
  } catch (error) {
    console.error('[Push Subscribe] 오류 상세:', error);

    const errorMessage =
      error &&
      typeof error === 'object' &&
      'message' in error
        ? String(error.message)
        : error instanceof Error
          ? error.message
          : String(error);

    console.error('[Push Subscribe] 실제 오류 메시지:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        error:
          process.env.NODE_ENV === 'development'
            ? errorMessage
            : '푸시 구독 등록 중 서버 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}