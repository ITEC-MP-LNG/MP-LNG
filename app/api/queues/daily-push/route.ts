import { handleCallback } from '@vercel/queue';
import webpush from 'web-push';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

type DailyTask = {
  title: string;
  status: string | null;
  assigned_names: string[] | null;
};

type DailyEducation = {
  title: string;
  edu_date: string | null;
  assigned_workers: string[] | null;
};

type AppUser = {
  id: string;
  name: string;
  is_approved: boolean | null;
  is_retired: boolean | null;
  is_suspended: boolean | null;
  department: string | null;
};

type PushSubscription = {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  updated_at: string;
};

function getKoreaDate() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

function getErrorStatus(error: unknown) {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    return Number(error.statusCode);
  }
  return 0;
}

function buildScheduleMessage(params: {
  taskTitles: string[];
  eduTitles: string[];
  fallbackIntro?: string;
}) {
  const { taskTitles, eduTitles, fallbackIntro } = params;
  const hasTask = taskTitles.length > 0;
  const hasEducation = eduTitles.length > 0;

  let guideSentence = '';

  if (hasTask && hasEducation) {
    guideSentence =
      '오늘 배정된 업무와 교육이 있습니다. 앱에서 업무 및 교육일정 확인하세요.';
  } else if (hasTask) {
    guideSentence = '오늘 배정된 업무가 있습니다. 앱에서 업무 확인하세요.';
  } else if (hasEducation) {
    guideSentence = '오늘 배정된 교육이 있습니다. 앱에서 교육 확인하세요.';
  } else {
    return null;
  }

  const lines: string[] = [guideSentence];

  // push_notification_settings에 커스텀 안내 문구가 있으면 함께 표기하려면 아래 주석을 해제해 쓰세요.
  // if (fallbackIntro) lines.push(fallbackIntro);

  if (hasTask) {
    lines.push('');
    lines.push('[업무]');
    for (const item of taskTitles) {
      lines.push(`• ${item}`);
    }
  }

  if (hasEducation) {
    lines.push('');
    lines.push('[교육]');
    for (const item of eduTitles) {
      lines.push(`• ${item}`);
    }
  }

  return lines.join('\n');
}

export const POST = handleCallback(async (_message, _metadata) => {
  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('push_notification_settings')
    .select('enabled, notification_title, notification_body')
    .eq('id', 1)
    .maybeSingle();

  if (settingsError) throw settingsError;
  if (!settings?.enabled) return;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new Error('VAPID 환경변수가 설정되지 않았습니다.');
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  const today = getKoreaDate();

  // 1. 당일 DAILY 업무 조회 (완료 제외)
  const { data: tasks, error: tasksError } = await supabaseAdmin
    .from('tasks')
    .select('title, status, assigned_names')
    .eq('task_type', 'DAILY')
    .eq('start_date', today);

  if (tasksError) throw tasksError;

  const activeTasks = ((tasks || []) as DailyTask[]).filter(
    (task) =>
      String(task.status || '').toUpperCase() !== 'COMPLETED' &&
      Array.isArray(task.assigned_names) &&
      task.assigned_names.length > 0
  );

  const tasksByName = new Map<string, string[]>();

  for (const task of activeTasks) {
    for (const rawName of task.assigned_names || []) {
      const name = String(rawName).trim();
      if (!name) continue;

      const titles = tasksByName.get(name) || [];
      if (!titles.includes(task.title)) titles.push(task.title);
      tasksByName.set(name, titles);
    }
  }

  // 2. 당일 교육 조회 (educations 테이블의 edu_date + assigned_workers 기준)
  const { data: educations, error: eduError } = await supabaseAdmin
    .from('educations')
    .select('title, edu_date, assigned_workers')
    .eq('edu_date', today);

  if (eduError) throw eduError;

  const educationsByName = new Map<string, string[]>();

  for (const edu of (educations || []) as DailyEducation[]) {
    if (!Array.isArray(edu.assigned_workers) || edu.assigned_workers.length === 0) {
      continue;
    }

    for (const rawWorker of edu.assigned_workers) {
      const name = String(rawWorker).trim();
      if (!name) continue;

      const titles = educationsByName.get(name) || [];
      if (!titles.includes(edu.title)) titles.push(edu.title);
      educationsByName.set(name, titles);
    }
  }

  // 업무와 교육 모두 배정된 인원이 없으면 종료
  const targetNames = new Set<string>([
    ...tasksByName.keys(),
    ...educationsByName.keys(),
  ]);

  if (targetNames.size === 0) return;

  // 3. 직원 계정 조회
  const { data: users, error: usersError } = await supabaseAdmin
    .from('app_users')
    .select('id, name, is_approved, is_retired, is_suspended, department');

  if (usersError) throw usersError;

  const userByName = new Map<string, AppUser>();

  for (const user of (users || []) as AppUser[]) {
    if (
      user.is_retired === true ||
      user.is_suspended === true ||
      user.department === '퇴사자'
    ) {
      continue;
    }

    userByName.set(String(user.name).trim(), user);
  }

  // 4. 푸시 구독 정보 조회
  const { data: subscriptions, error: subscriptionsError } =
    await supabaseAdmin
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh, auth, updated_at')
      .order('updated_at', { ascending: false });

  if (subscriptionsError) throw subscriptionsError;

  const subscriptionByUser = new Map<string, PushSubscription>();

  for (const sub of (subscriptions || []) as PushSubscription[]) {
    if (!subscriptionByUser.has(sub.user_id)) {
      subscriptionByUser.set(sub.user_id, sub);
    }
  }

  // 5. 인원별 발송
  for (const name of targetNames) {
    const user = userByName.get(name);
    if (!user) continue;

    const taskTitles = tasksByName.get(name) || [];
    const eduTitles = educationsByName.get(name) || [];

    const body = buildScheduleMessage({
      taskTitles,
      eduTitles,
      fallbackIntro: settings.notification_body?.trim(),
    });

    if (!body) continue;

    const userId = user.id;
    const subscription = subscriptionByUser.get(userId);

    const title = settings.notification_title?.trim() || '당일 일정 알림';

    // 푸시 미구독 직원은 내부 알림으로 저장
    if (!subscription) {
      const { error } = await supabaseAdmin
        .from('daily_work_notifications')
        .upsert(
          {
            user_id: userId,
            notification_date: today,
            title,
            body,
            delivery_method: 'in_app',
            delivery_status: 'sent',
          },
          {
            onConflict: 'user_id,notification_date',
            ignoreDuplicates: true,
          }
        );

      if (error) throw error;
      continue;
    }

    // 직원별·날짜별 발송 기록 생성
    const { error: insertError } = await supabaseAdmin
      .from('daily_work_notifications')
      .upsert(
        {
          user_id: userId,
          notification_date: today,
          title,
          body,
          delivery_method: 'push',
          delivery_status: 'pending',
        },
        {
          onConflict: 'user_id,notification_date',
          ignoreDuplicates: true,
        }
      );

    if (insertError) throw insertError;

    const { data: record, error: recordError } = await supabaseAdmin
      .from('daily_work_notifications')
      .select('id, delivery_method, push_sent_at')
      .eq('user_id', userId)
      .eq('notification_date', today)
      .maybeSingle();

    if (recordError) throw recordError;
    if (!record || record.delivery_method !== 'push') continue;
    if (record.push_sent_at) continue;

    // 발송 중복 방지용 원자적 선점
    const claimedAt = new Date().toISOString();

    const { data: claimed, error: claimError } = await supabaseAdmin
      .from('daily_work_notifications')
      .update({
        push_sent_at: claimedAt,
        delivery_status: 'sending',
      })
      .eq('id', record.id)
      .is('push_sent_at', null)
      .select('id')
      .maybeSingle();

    if (claimError) throw claimError;
    if (!claimed) continue;

    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        JSON.stringify({
          title,
          body: body.slice(0, 3000),
          url: '/',
          tag: `daily-work-${today}`,
        })
      );

      const { error: updateError } = await supabaseAdmin
        .from('daily_work_notifications')
        .update({ delivery_status: 'sent' })
        .eq('id', record.id);

      if (updateError) throw updateError;
    } catch (error) {
      const status = getErrorStatus(error);

      if (status === 404 || status === 410) {
        await supabaseAdmin
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', subscription.endpoint);

        const { error: fallbackError } = await supabaseAdmin
          .from('daily_work_notifications')
          .update({
            delivery_method: 'in_app',
            delivery_status: 'sent',
            push_sent_at: null,
          })
          .eq('id', record.id);

        if (fallbackError) throw fallbackError;
        continue;
      }

      // 일시적인 발송 오류는 재시도할 수 있도록 선점 해제
      const { error: resetError } = await supabaseAdmin
        .from('daily_work_notifications')
        .update({
          push_sent_at: null,
          delivery_status: 'failed',
        })
        .eq('id', record.id);

      if (resetError) throw resetError;
      throw error;
    }
  }
});
