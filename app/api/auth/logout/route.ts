
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const COOKIE_NAME = 'mp_lng_session';

export async function POST() {
  try {
    const response = NextResponse.json({
      success: true,
      message: '로그아웃되었습니다.',
    });

    response.cookies.set(COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      expires: new Date(0),
    });

    return response;

  } catch (error) {
    console.error('로그아웃 API 오류:', error);

    return NextResponse.json(
      {
        success: false,
        error: '로그아웃 처리 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
