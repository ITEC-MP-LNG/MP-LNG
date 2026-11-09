
import { Schedules } from '@vercel/schedules';
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

// 로그인 및 관리자 권한 확인

type AdminAuthResult =
  | { session: SessionPayload }
  | { error: string; status: number };

async function verifyAdmin(
  request: NextRequest
): Promise<AdminAuthResult> {
  console.log(
    '[Push Settings] Cookie names:',
    request.cookies.getAll().map(cookie => cookie.name)
  );

  const token = request.cookies.get(COOKIE_NAME)?.value;

  console.log('[Push Settings] Token exists:', Boolean(token));

  if (!token) {
    return { error: '로그인이 필요합니다.', status: 401 };
  }

  const session = verifySessionToken(token);

  if (!session) {
    return { error: '로그인 세션이 만료되었습니다.', status: 401 };
  }

  const { data: user, error } = await supabaseAdmin
    .from('app_users')
    .select('role')
    .eq('id', session.sub)
    .maybeSingle();

  if (error) throw error;

  if (!user || String(user.role || '').trim().toUpperCase() !== 'ADMIN') {
    return { error: '관리자 권한이 필요합니다.', status: 403 };
  }

  return { session };
}

// 설정 불러오기
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);

    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('push_notification_settings')
      .select('enabled, send_time, timezone, notification_title, notification_body')
      .eq('id', 1)
      .maybeSingle();

    if (error) throw error;

  
    return NextResponse.json({
      success: true,
      settings: data,
    });
  } catch (error) {
    console.error('[Push Settings GET]', error);

    return NextResponse.json(
      { success: false, error: '푸시 알림 설정을 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}
async function syncDailyPushSchedule(
  enabled: boolean,
  sendTime: string
) {
  // 로컬 npm run dev에서는 실제 예약 작업을 변경하지 않음
  if (process.env.VERCEL !== '1') return;

  const name = 'daily-push-dispatch';

  let existing = null;

  try {
    existing = await Schedules.get({ name });
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String(error.code)
        : '';

    if (code !== 'not_found') {
      throw error;
    }
  }

  if (!enabled) {
    if (existing?.state === 'active') {
      await Schedules.disable({ name });
    }
    return;
  }

  const [hour, minute] = sendTime.split(':');

  const expression = {
    type: 'cron' as const,
    cron: `${Number(minute)} ${Number(hour)} * * *`,
  };

  if (existing) {
    if (existing.source !== 'dynamic') {
      throw new Error('기존 예약 작업이 동적 예약 작업이 아닙니다.');
    }

    await Schedules.update({
      name,
      expression,
      timezone: 'Asia/Seoul',
      jitter: 15,
      target: { topic: 'daily-push' },
    });

    if (existing.state === 'inactive') {
      await Schedules.enable({ name });
    }
  } else {
    await Schedules.create({
      name,
      expression,
      timezone: 'Asia/Seoul',
      jitter: 15,
      target: { topic: 'daily-push' },
      payload: {},
    });
  }
}
// 설정 저장하기
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);

    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();

    const {
      enabled,
      send_time,
      notification_title,
      notification_body,
    } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: '자동 발송 설정값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    if (
      typeof send_time !== 'string' ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(send_time)
    ) {
      return NextResponse.json(
        { success: false, error: '발송 시간이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    if (
      typeof notification_title !== 'string' ||
      !notification_title.trim() ||
      notification_title.length > 100
    ) {
      return NextResponse.json(
        { success: false, error: '알림 제목은 1~100자로 입력해 주세요.' },
        { status: 400 }
      );
    }

    if (
      typeof notification_body !== 'string' ||
      !notification_body.trim() ||
      notification_body.length > 300
    ) {
      return NextResponse.json(
        { success: false, error: '알림 내용은 1~300자로 입력해 주세요.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('push_notification_settings')
      .update({
        enabled,
        send_time,
        notification_title: notification_title.trim(),
        notification_body: notification_body.trim(),
        updated_at: new Date().toISOString(),
        updated_by: auth.session.sub,
      })
      .eq('id', 1)
      .select('enabled, send_time, timezone, notification_title, notification_body')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: '푸시 알림 설정이 저장되었습니다.',
      settings: data,
    });
  } catch (error) {
    console.error('[Push Settings POST]', error);

    return NextResponse.json(
      { success: false, error: '푸시 알림 설정 저장에 실패했습니다.' },
      { status: 500 }
    );
  }
}
