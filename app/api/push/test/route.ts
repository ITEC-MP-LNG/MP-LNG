
import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import webpush from 'web-push';
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
    // 1. 로그인 세션 확인
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

    // 2. VAPID 환경변수 확인
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;

    if (!publicKey || !privateKey || !subject) {
      throw new Error('VAPID 환경변수가 설정되지 않았습니다.');
    }

    // 3. 현재 로그인 계정의 푸시 구독 정보 조회
    const { data: subscription, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', session.sub)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
