
import { handleCallback } from '@vercel/queue';
import webpush from 'web-push';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

type DailyTask = {
  title: string;
  status: string | null;
  assigned_names: string[] | null;
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
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function getErrorStatus(error: unknown) {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    return Number(error.statusCode);
  }
  return 0;
}

export const POST = handleCallback(async (_message, metadata) => {
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

  // 당일 DAILY 업무만 조회하고 완료된 업무는 제외
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

  if (activeTasks.length === 0) return;

  // 업무에 배정된 직원 이름별로 묶기
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

  if (tasksByName.size === 0) return;

  // 직원 계정 조회
  const { data: users, error: usersError } = await supabaseAdmin
    .from('app_users')
    .select('id, name, is_approved, is_retired, is_suspended, department');

  if (usersError) throw usersError;

  const userByName = new Map<string, AppUser>();

  for (const user of (users || []) as AppUser[]) {
    if (
      user.is_approved === false ||
      user.is_retired === true ||
      user.is_suspended === true ||
      user.department === '퇴사자'
    ) {
      continue;
    }

    userByName.set(String(user.name).trim(), user);
  }

  // 푸시 구독 정보 조회
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

  // 직원별 발송
  for (const [name, titles] of tasksByName) {
    const user = userByName.get(name);
    if (!user) continue;

    const userId = user.id;
    const subscription = subscriptionByUser.get(userId);

    const title =
      settings.notification_title?.trim() || '당일 업무 알림';

    const taskList = titles.map((item) => `• ${item}`).join('\n');
    const intro = settings.notification_body?.trim();

    const body = `${intro ? `${intro}\n` : ''}${taskList}`;

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
