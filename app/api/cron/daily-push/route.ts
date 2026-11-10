import { send } from '@vercel/queue';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    // Vercel Cron 인증
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('CRON_SECRET 환경변수가 설정되지 않았습니다.');

      return Response.json(
        { success: false, message: 'CRON_SECRET 설정이 필요합니다.' },
        { status: 500 }
      );
    }

    const authorization = request.headers.get('authorization');

    if (authorization !== `Bearer ${cronSecret}`) {
      return Response.json(
        { success: false, message: '인증되지 않은 요청입니다.' },
        { status: 401 }
      );
    }

    // 일일업무 Queue에 메시지 전송
    const result = await send('daily-push', {
      requestedAt: new Date().toISOString(),
      source: 'vercel-cron',
    });

    console.log('일일업무 Queue 메시지 전송 완료:', result.messageId);

    return Response.json({
      success: true,
      message: '일일업무 Queue 실행 요청 완료',
      messageId: result.messageId,
    });
  } catch (error) {
    console.error('일일업무 Queue 실행 요청 실패:', error);

    return Response.json(
      {
        success: false,
        message: 'Queue 메시지 전송에 실패했습니다.',
      },
      { status: 500 }
    );
  }
}