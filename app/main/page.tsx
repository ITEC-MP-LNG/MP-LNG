```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  LogOut, 
  ShieldCheck, 
  ListTodo, 
  Package, 
  GraduationCap,
  Users,
  Layers,
  Calendar,
  Briefcase,
  Anchor,
  AlertCircle,
  Bell
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import {
  AppUser,
  Task,
  InventoryItem,
  InventoryLog,
  Education,
  EducationRecord
} from '@/lib/types';

import WorkManagement from '@/components/WorkManagement';
import MaterialManagement from '@/components/MaterialManagement';
import EducationManagement from '@/components/EducationManagement';
import HRManagement from '@/components/HRManagement';
import ShipInfo from '@/components/ShipInfo';
import NoticeBoard from '@/components/NoticeBoard';

function calculateCareerDetails(startDateStr?: string) {
  if (!startDateStr) return null;

  const start = new Date(startDateStr);
  const now = new Date();

  if (isNaN(start.getTime())) return null;

  let years = now.getFullYear() - start.getFullYear();

  const isBeforeAnniversary =
    now.getMonth() < start.getMonth() ||
    (now.getMonth() === start.getMonth() && now.getDate() < start.getDate());

  if (isBeforeAnniversary && years > 0) {
    years -= 1;
  }

  const lastAnniversary = new Date(start);
  lastAnniversary.setFullYear(start.getFullYear() + years);

  const remainingDays = Math.floor(
    (now.getTime() - lastAnniversary.getTime()) / (1000 * 60 * 60 * 24)
  );

  return years + '년 ' + remainingDays + '일';
}

interface ExtendedAppUser extends AppUser {
  join_date?: string;
  career_start_date?: string;
}

export default function MainPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<ExtendedAppUser | null>(null);

  const [mainTab, setMainTab] = useState<
    'NOTICE' | 'TASKS' | 'INVENTORY' | 'SHIP' | 'EDUCATION' | 'HR'
  >('NOTICE');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [myPendingTasks, setMyPendingTasks] = useState<Task[]>([]);

  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [showMinStockAlert, setShowMinStockAlert] = useState(false);
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);

  const [educations, setEducations] = useState<Education[]>([]);
  const [eduRecords, setEduRecords] = useState<EducationRecord[]>([]);
  const [loadingEdu, setLoadingEdu] = useState(false);
  const [educationRefreshVersion, setEducationRefreshVersion] = useState(0);

  const [showExitModal, setShowExitModal] = useState(false);

  // 모바일 종 모양 버튼 색상 제어용
  const [hasUnreadNotice, setHasUnreadNotice] = useState(false);
  const [navNewFlags, setNavNewFlags] = useState<Record<string, boolean>>({});

  const isUserEditingRef = useRef(false);
  const refreshPendingRef = useRef(false);
  const lastInputAtRef = useRef(0);

  const normalizedRole = String(currentUser?.role || '').trim().toUpperCase();
  const isAdmin = normalizedRole === 'ADMIN';

  // ============================================================
  // 모바일 뒤로가기 처리
  // ============================================================
  //
  // 현재 화면에서 먼저 자식 컴포넌트에게 뒤로가기를 전달한다.
  //
  // 자식 컴포넌트가 열린 모달/입력창을 처리하면
  // event.detail.handled = true 로 표시한다.
  //
  // 아무것도 처리하지 않았을 때만 메인 페이지 종료 확인창을 띄운다.
  //
  useEffect(() => {
    let lastBackPressTime = 0;

    window.history.pushState(
      { page: 'main', guard: true },
      '',
      window.location.href
    );

    const handlePopState = () => {
      const now = Date.now();

      // 종료 확인창이 이미 열려 있다면 현재 페이지를 유지
      if (showExitModal) {
        window.history.pushState(
          { page: 'main', guard: true },
          '',
          window.location.href
        );
        return;
      }

      // 뒤로가기 이벤트가 발생하면 다시 현재 페이지를 유지
      window.history.pushState(
        { page: 'main', guard: true },
        '',
        window.location.href
      );

      // 자식 컴포넌트에게 뒤로가기 전달
      const backEvent = new CustomEvent('app-back', {
        detail: {
          handled: false
        }
      });

      window.dispatchEvent(backEvent);

      // 자식 컴포넌트가 모달/입력창을 처리했다면 종료하지 않는다.
      if (backEvent.detail?.handled) {
        lastBackPressTime = now;
        return;
      }

      // 아주 짧은 시간 안에 중복 Back 이벤트가 발생하는 경우 방지
      if (now - lastBackPressTime < 500) {
        return;
      }

      lastBackPressTime = now;

      // 실제 메인 화면에서 뒤로가기를 누른 경우
      setShowExitModal(true);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [showExitModal]);

  // 읽지 않은 공지 체크 함수
  const checkUnreadNotices = async (userKey: string) => {
    try {
      const { data, error } = await supabase
        .from('notices')
        .select('id')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const unreadExists = data.some((notice) => {
          const isRead = localStorage.getItem(
            `notice_read_${userKey}_${notice.id}`
          );

          return !isRead;
        });

        setHasUnreadNotice(unreadExists);
      } else {
        setHasUnreadNotice(false);
      }
    } catch (err) {
      console.error('공지 읽음 상태 확인 실패:', err);
    }
  };

  // 인증 및 초기 데이터 로드
  useEffect(() => {
    const initAuthAndData = async () => {
      try {
        const {
          data: { user: authUser }
        } = await supabase.auth.getUser();

        const userJson = localStorage.getItem('currentUser');

        let localUser: ExtendedAppUser | null = userJson
          ? JSON.parse(userJson)
          : null;

        if (!authUser && !localUser) {
          router.replace('/login');
          return;
        }

        let targetUser = localUser;

        const lookupKey = authUser?.id || localUser?.id;
        const lookupEmail = authUser?.email || localUser?.email;

        if (lookupKey || lookupEmail) {
          let query = supabase.from('app_users').select('*');

          const hasKey =
            lookupKey && lookupKey !== 'undefined';

          const hasEmail =
            lookupEmail && lookupEmail !== 'undefined';

          if (hasKey && hasEmail) {
            query = query.or(
              `id.eq.${lookupKey},email.eq.${lookupEmail}`
            );
```
