'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  LogOut, 
  ShieldCheck,
  ChevronDown,
  UserRoundPen, 
  ListTodo, 
  Package, 
  GraduationCap,
  Users,
  Layers,
  Calendar,
  Briefcase,
  Anchor,
  AlertCircle,
  Bell,
  Home
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

// shadcn/ui 컴포넌트 임포트
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

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

  return `${years}년 ${remainingDays}일`;
}

interface ExtendedAppUser extends AppUser {
  join_date?: string;
  career_start_date?: string;
  work_status?: '근무중' | '휴무' | string;
}

export default function MainPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<ExtendedAppUser | null>(null);
  const noticeBoardUser = useMemo(() => {
    if (!currentUser) return undefined;
    return { id: currentUser.id, name: currentUser.name, email: currentUser.email };
  }, [currentUser?.id, currentUser?.name, currentUser?.email]);
  const [mainTab, setMainTab] = useState<'NOTICE' | 'TASKS' | 'INVENTORY' | 'SHIP' | 'EDUCATION' | 'HR'>('NOTICE');
  const mainTabRef = useRef(mainTab);
  mainTabRef.current = mainTab;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
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

  const hasLoadedInventoryRef = useRef(false);
  const hasLoadedEducationRef = useRef(false);

  const [showExitModal, setShowExitModal] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [hrLaunchAction, setHrLaunchAction] = useState<'self-edit' | 'my-team' | 'dormitory' | null>(null);

  // 기숙사 현황 등록 여부 상태 (Supabase 호출 최소화를 위해 로그인 직후 1회만 체크)
  const [isDormitoryUser, setIsDormitoryUser] = useState(false);

  const [hasUnreadNotice, setHasUnreadNotice] = useState(false);
  const [navNewFlags, setNavNewFlags] = useState<Record<string, boolean>>({});

  const normalizedRole = String(currentUser?.role || '').trim().toUpperCase();
  const isAdmin = normalizedRole === 'ADMIN';

  const isInitializedRef = useRef(false);

  const checkUnreadNotices = useCallback(async (userKey: string) => {
    try {
      const { data, error } = await supabase
        .from('notices')
        .select('id')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const unreadExists = data.some((notice) => {
          const isRead = localStorage.getItem(`notice_read_${userKey}_${notice.id}`);
          return !isRead;
        });
        setHasUnreadNotice(unreadExists);
      } else {
        setHasUnreadNotice(false);
      }
    } catch (err) {
      console.error('공지 읽음 상태 확인 실패:', err);
    }
  }, []);

  // 로그인한 사용자가 기숙사 현황에 등록되어 있는지 확인하는 함수 (Supabase 호출 최소화)
  const checkDormitoryMembership = useCallback(async (userId: string) => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('dormitory_records')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        setIsDormitoryUser(true);
      } else {
        setIsDormitoryUser(false);
      }
    } catch (err) {
      console.error('기숙사 멤버십 확인 실패:', err);
      setIsDormitoryUser(false);
    }
  }, []);

  const fetchTasks = useCallback(async (user: AppUser) => {
    setLoadingTasks(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, description, task_type, status, assigned_names, assigned_name, time_slot, start_date, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      
      const formattedTasks: Task[] = (data || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        task_type: t.task_type,
        status: t.status,
        assigned_names: Array.isArray(t.assigned_names) 
          ? t.assigned_names 
          : (t.assigned_name ? [t.assigned_name] : ['홍길동']),
        time_slot: t.time_slot || '09:00~',
        start_date: t.start_date || new Date().toISOString().split('T')[0],
      }));

      setTasks(formattedTasks);

      const pending = formattedTasks.filter(t => t.assigned_names.includes(user.name) && t.status !== 'COMPLETED');
      if (pending.length > 0) {
        setMyPendingTasks(pending);
        setShowNoticeModal(true);
      }
    } catch (err: any) {
      console.error('업무 목록 불러오기 실패:', err);
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  const fetchInventory = useCallback(async () => {
    setLoadingInventory(true);
    try {
      const { data, error } = await supabase.from('inventory').select('*').order('code', { ascending: true });
      if (error) throw error;
      const list: InventoryItem[] = data || [];
      hasLoadedInventoryRef.current = true;
      setInventoryList(list);

      const lows = list.filter(i => i.type === '소모성' && i.quantity <= i.min_quantity);
      if (lows.length > 0) {
        setLowStockItems(lows);
        setShowMinStockAlert(true);
      }
    } catch (err: any) {
      console.error('자재 목록 불러오기 실패:', err);
    } finally {
      setLoadingInventory(false);
    }
  }, []);

  const fetchInventoryLogs = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('inventory_logs').select('*').order('created_at', { ascending: false }).limit(20);
      if (error) throw error;
      setInventoryLogs(data || []);
    } catch (err: any) {
      console.error('이력 목록 불러오기 실패:', err);
    }
  }, []);

  const fetchEducations = useCallback(async () => {
    try {
      setLoadingEdu(true);
      const { data, error } = await supabase
        .from('educations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      hasLoadedEducationRef.current = true;
      const list = (data || []).map((e: any) => ({
        ...e,
        edu_date: e.edu_date || e.created_at?.split('T')[0] || new Date().toISOString().split('T')[0]
      }));
      
      setEducations(list);
    } catch (err: any) {
      console.error('교육 목록 불러오기 실패:', err);
    } finally {
      setLoadingEdu(false);
    }
  }, []);

  const fetchEducationRecords = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('education_records').select('*');
      if (error) throw error;
      setEduRecords(data || []);
    } catch (err: any) {
      console.error('교육 이수 기록 불러오기 실패:', err);
    }
  }, []);

  useEffect(() => {
    let lastBackPressTime = 0;

    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      const currentTime = new Date().getTime();

      if (showExitModal) {
        window.history.pushState(null, '', window.location.href);
        return;
      }

      window.history.pushState(null, '', window.location.href);

      const backEvent = new CustomEvent('app-back', {
        detail: { handled: false }
      });

      window.dispatchEvent(backEvent);

      if (backEvent.detail?.handled) {
        lastBackPressTime = currentTime;
        return;
      }

      if (currentTime - lastBackPressTime < 500) {
        return;
      }

      lastBackPressTime = currentTime;
      setShowExitModal(true);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [showExitModal]);

  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const initAuthAndData = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        const userJson = localStorage.getItem('currentUser');
        let localUser: ExtendedAppUser | null = userJson ? JSON.parse(userJson) : null;

        if (!authUser && !localUser) {
          router.replace('/login');
          return;
        }

        let targetUser = localUser;
        const lookupKey = authUser?.id || localUser?.id;
        const lookupEmail = authUser?.email || localUser?.email;

        if (lookupKey || lookupEmail) {
          let query = supabase.from('app_users').select('*');

          const hasKey = lookupKey && lookupKey !== 'undefined';
          const hasEmail = lookupEmail && lookupEmail !== 'undefined';

          if (hasKey && hasEmail) {
            query = query.or(`id.eq.${lookupKey},email.eq.${lookupEmail}`);
          } else if (hasKey) {
            query = query.eq('id', lookupKey);
          } else if (hasEmail) {
            query = query.eq('email', lookupEmail);
          }

          const { data: appUserData } = await query.maybeSingle();

          if (appUserData) {
            targetUser = {
              id: appUserData.id,
              name: appUserData.name || appUserData.user_name || localUser?.name || '사용자',
              role: String(appUserData.role || localUser?.role || 'USER').trim().toUpperCase(),
              email: appUserData.email || authUser?.email,
              join_date: appUserData.join_date,
              career_start_date: appUserData.career_start_date,
              work_status: appUserData.work_status === '휴무' ? '휴무' : '근무중',
              department: appUserData.department,
              job_title: appUserData.job_title
            } as ExtendedAppUser;
            
            localStorage.setItem('currentUser', JSON.stringify(targetUser));
          }
        }

        if (!targetUser) {
          router.replace('/login');
          return;
        }

        setCurrentUser(targetUser);

        const userKey = targetUser.id || targetUser.email || targetUser.name || 'guest';
        await checkUnreadNotices(String(userKey));
        await checkDormitoryMembership(String(targetUser.id));
        await fetchTasks(targetUser);

      } catch (e) {
        console.error('세션 및 인증 초기화 실패:', e);
        localStorage.removeItem('currentUser');
        router.replace('/login');
      }
    };

    initAuthAndData();
  }, [router, checkUnreadNotices, checkDormitoryMembership, fetchTasks]);

  useEffect(() => {
    if (!currentUser) return;

    if (mainTab === 'INVENTORY' && !hasLoadedInventoryRef.current) {
      fetchInventory();
      fetchInventoryLogs();
    } else if (mainTab === 'EDUCATION' && !hasLoadedEducationRef.current) {
      fetchEducations();
      fetchEducationRecords();
    }
  }, [mainTab, currentUser, fetchInventory, fetchInventoryLogs, fetchEducations, fetchEducationRecords]);

  useEffect(() => {
    if (!currentUser) return;

    const userKey = currentUser.id || currentUser.email || currentUser.name || 'guest';
    let noticeCheckTimer: ReturnType<typeof setTimeout> | null = null;
    let tasksRefreshTimer: ReturnType<typeof setTimeout> | null = null;
    let inventoryRefreshTimer: ReturnType<typeof setTimeout> | null = null;
    let educationRefreshTimer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (
      timer: ReturnType<typeof setTimeout> | null,
      callback: () => void
    ) => {
      if (timer) clearTimeout(timer);
      return setTimeout(callback, 300);
    };

    const scheduleUnreadCheck = () => {
      noticeCheckTimer = schedule(noticeCheckTimer, () => {
        if (!document.hidden) checkUnreadNotices(String(userKey));
      });
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) scheduleUnreadCheck();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const globalChannel = supabase
      .channel('app-global-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, () => {
        if (document.hidden) return;
        setNavNewFlags(prev => ({ ...prev, NOTICE: true }));
        scheduleUnreadCheck();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        if (document.hidden) return;
        setNavNewFlags(prev => ({ ...prev, TASKS: true }));
        if (mainTabRef.current === 'TASKS') {
          tasksRefreshTimer = schedule(tasksRefreshTimer, () => fetchTasks(currentUser));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
        if (document.hidden) return;
        setNavNewFlags(prev => ({ ...prev, INVENTORY: true }));
        if (mainTabRef.current === 'INVENTORY') {
          inventoryRefreshTimer = schedule(inventoryRefreshTimer, () => fetchInventory());
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'educations' }, () => {
        if (document.hidden) return;
        setNavNewFlags(prev => ({ ...prev, EDUCATION: true }));
        if (mainTabRef.current === 'EDUCATION') {
          educationRefreshTimer = schedule(educationRefreshTimer, () => fetchEducations());
        }
      })
      .subscribe();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (noticeCheckTimer) clearTimeout(noticeCheckTimer);
      if (tasksRefreshTimer) clearTimeout(tasksRefreshTimer);
      if (inventoryRefreshTimer) clearTimeout(inventoryRefreshTimer);
      if (educationRefreshTimer) clearTimeout(educationRefreshTimer);
      supabase.removeChannel(globalChannel);
    };
  }, [currentUser, checkUnreadNotices, fetchTasks, fetchInventory, fetchEducations]);

  const markNavigationAsRead = (tabId: string) => {
    setNavNewFlags((prev) => ({ ...prev, [tabId]: false }));
  };

  const openHrAction = (action: 'self-edit' | 'my-team' | 'dormitory') => {
    setAccountMenuOpen(false);
    setHrLaunchAction(action);
    setMainTab('HR');
  };

  const handleLogout = async () => {
    setAccountMenuOpen(false);
    await supabase.auth.signOut();
    localStorage.removeItem('currentUser');
    localStorage.removeItem('login_timestamp');
    router.replace('/login');
  };

  const confirmExitApp = async () => {
    setShowExitModal(false);
    await supabase.auth.signOut();
    localStorage.removeItem('currentUser');
    localStorage.removeItem('login_timestamp');
    router.replace('/login');
  };

  const cancelExitApp = () => {
    setShowExitModal(false);
    window.history.pushState(null, '', window.location.href);
  };

  const handleOwnWorkStatusChange = async (status: '근무중' | '휴무') => {
    if (!currentUser) return;

    const currentStatus = currentUser.work_status === '휴무' ? '휴무' : '근무중';
    if (currentStatus === status) {
      setAccountMenuOpen(false);
      return;
    }

    try {
      let updateQuery = supabase
        .from('app_users')
        .update({ work_status: status })
        .eq('id', currentUser.id);

      const { data, error } = await updateQuery.select('id, work_status').maybeSingle();
      if (error) throw error;

      if (!data && currentUser.email) {
        const retry = await supabase
          .from('app_users')
          .update({ work_status: status })
          .eq('email', currentUser.email)
          .select('id, work_status')
          .maybeSingle();
        if (retry.error) throw retry.error;
        if (!retry.data) {
          throw new Error('업데이트된 구성원 행을 찾을 수 없습니다.');
        }
      }

      setCurrentUser((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, work_status: status };
        localStorage.setItem('currentUser', JSON.stringify(updated));
        return updated;
      });
      setAccountMenuOpen(false);
    } catch (error: any) {
      console.error('근무 상태 변경 실패:', error?.message || error);
      window.alert(`근무 상태를 저장하지 못했습니다.\n${error?.message || 'app_users 권한 및 work_status 컬럼을 확인해주세요.'}`);
    }
  };

  if (!currentUser) return null;

  const companyCareer = calculateCareerDetails(currentUser.join_date);
  const totalCareer = calculateCareerDetails(currentUser.career_start_date);

  const menuItems = [
    { id: 'NOTICE', label: '게시판', icon: Bell },
    { id: 'TASKS', label: '업무 현황', icon: ListTodo },
    { id: 'INVENTORY', label: '자재/소모성', icon: Package },
    { id: 'SHIP', label: '호선 현황', icon: Anchor },
    { id: 'EDUCATION', label: '교육 & EVENT', icon: GraduationCap },
    { id: 'HR', label: '인사 관리', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col pb-20 md:pb-0 font-sans relative">
      <header className="bg-card border-b sticky top-0 z-30 shadow-sm">
        <div className="max-w-full mx-auto px-2 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="bg-primary p-2 rounded-lg text-primary-foreground shadow-sm">
              <Layers className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold tracking-tight leading-none">
                통합현장관리 <span className="text-primary">SYSTEM</span>
              </h1>
              <span className="text-[10px] text-muted-foreground hidden sm:inline-block">Enterprise Field Management</span>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-3">
            <div className="hidden lg:flex items-center space-x-2 text-xs">
              {companyCareer && (
                <div className="flex items-center space-x-1.5 bg-muted text-foreground px-2.5 py-1 rounded-md border">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  <span>자사근속: <strong className="text-primary">{companyCareer}</strong></span>
                </div>
              )}
              {totalCareer && (
                <div className="flex items-center space-x-1.5 bg-muted text-foreground px-2.5 py-1 rounded-md border">
                  <Briefcase className="h-3.5 w-3.5 text-primary" />
                  <span>총 경력: <strong className="text-primary">{totalCareer}</strong></span>
                </div>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setMainTab('NOTICE')}
              className={`md:hidden shrink-0 ${
                hasUnreadNotice 
                  ? 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20' 
                  : 'bg-sky-50 text-sky-500 border-sky-200 hover:bg-sky-100'
              }`}
              title={hasUnreadNotice ? '읽지 않은 새 공지가 있습니다.' : '모든 공지를 확인했습니다.'}
              aria-label="게시판"
            >
              <Bell className="h-4 w-4" />
            </Button>

            <div className="relative shrink-0">
              <DropdownMenu open={accountMenuOpen} onOpenChange={setAccountMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center space-x-1.5 sm:space-x-2 bg-muted px-2 sm:px-3 py-1.5 h-auto rounded-lg max-w-[170px] sm:max-w-none hover:bg-muted/80">
                    <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary shrink-0" />
                    <span className="text-xs font-semibold truncate">{currentUser.name}</span>
                    <Badge variant={currentUser.work_status === '휴무' ? 'secondary' : 'default'} className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 shrink-0">
                      {currentUser.work_status === '휴무' ? '휴무' : '근무중'}
                    </Badge>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${accountMenuOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 p-1.5">
                  <div className="px-3 pt-2 pb-1 text-[10px] font-bold text-muted-foreground">내 근무 상태 변경</div>
                  <div className="grid grid-cols-2 gap-1 px-1 pb-2">
                    <Button 
                      type="button" 
                      variant={currentUser.work_status !== '휴무' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleOwnWorkStatusChange('근무중')} 
                      className="h-10 text-[11px] font-bold"
                    >
                      ● 근무중
                    </Button>
                    <Button 
                      type="button" 
                      variant={currentUser.work_status === '휴무' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleOwnWorkStatusChange('휴무')} 
                      className="h-10 text-[11px] font-bold"
                    >
                      ● 휴무
                    </Button>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
                    <LogOut className="h-4 w-4 mr-2" /> 로그아웃
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openHrAction('self-edit')} className="cursor-pointer">
                    <UserRoundPen className="h-4 w-4 mr-2 text-primary" /> 개인정보 수정
                  </DropdownMenuItem>
                  
                  {isDormitoryUser && (
                    <DropdownMenuItem onClick={() => openHrAction('dormitory')} className="cursor-pointer">
                      <Home className="h-4 w-4 mr-2 text-primary" /> 공과금 납입 (기숙사)
                    </DropdownMenuItem>
                  )}

                  {String((currentUser as any).job_title || '').includes('팀장') && (
                    <DropdownMenuItem onClick={() => openHrAction('my-team')} className="cursor-pointer">
                      <Users className="h-4 w-4 mr-2 text-primary" /> 팀원 관리
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-full w-full mx-auto flex">
        <aside className="hidden md:block w-56 bg-card border-r p-3 space-y-1 shrink-0">
          <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            통합 현장관리 Navigation
          </div>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = mainTab === item.id;
            return (
              <Button
                key={item.id}
                variant={isActive ? 'default' : 'ghost'}
                onClick={() => { setMainTab(item.id as any); markNavigationAsRead(item.id); }}
                className={`w-full justify-start space-x-2.5 px-3 py-2.5 h-auto text-xs font-semibold cursor-pointer ${
                  isActive
                    ? 'shadow-sm font-bold'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                <span className="flex items-center gap-1.5">
                  <span>{item.label}</span>
                  {navNewFlags[item.id] && <span className="text-[9px] font-black text-destructive leading-none">N</span>}
                </span>
              </Button>
            );
          })}
        </aside>

        <main className="flex-1 p-0 overflow-y-auto min-w-0">
          {mainTab === 'NOTICE' && (
            <NoticeBoard
              isAdmin={isAdmin}
              currentUser={noticeBoardUser}
            />
          )}

          {mainTab === 'TASKS' && (
            <WorkManagement
              currentUser={currentUser}
            />
          )}

          {mainTab === 'INVENTORY' && (
            <MaterialManagement
              currentUser={currentUser}
              isAdmin={isAdmin}
              inventoryList={inventoryList}
              inventoryLogs={inventoryLogs}
              loadingInventory={loadingInventory}
              showMinStockAlert={showMinStockAlert}
              setShowMinStockAlert={setShowMinStockAlert}
              lowStockItems={lowStockItems}
              fetchInventory={fetchInventory}
              fetchInventoryLogs={fetchInventoryLogs}
            />
          )}

          {mainTab === 'SHIP' && (
            <ShipInfo
              isAdmin={isAdmin}
              currentUser={{ name: currentUser.name }}
            />
          )}

          {mainTab === 'EDUCATION' && (
            <EducationManagement
              key={`education-${educationRefreshVersion}`}
              isAdmin={isAdmin}
              educations={educations}
              eduRecords={eduRecords}
              loadingEdu={loadingEdu}
              fetchEducations={fetchEducations}
              fetchEducationRecords={fetchEducationRecords}
              currentUser={{ name: currentUser.name }}
            />
          )}

          {mainTab === 'HR' && (
            <HRManagement 
              isAdmin={isAdmin} 
              currentUserRole={currentUser.role}
              currentUser={currentUser}
              initialAction={hrLaunchAction}
              onInitialActionHandled={() => setHrLaunchAction(null)}
              onCurrentUserStatusChange={(status) => {
                setCurrentUser((prev) => {
                  if (!prev) return prev;
                  const updated = { ...prev, work_status: status };
                  localStorage.setItem('currentUser', JSON.stringify(updated));
                  return updated;
                });
              }}
            />
          )}
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-40 px-1 py-1.5 flex justify-between items-center shadow-lg">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = mainTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { setMainTab(item.id as any); markNavigationAsRead(item.id); }}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg transition min-w-0 ${
                isActive ? 'text-primary font-bold' : 'text-muted-foreground font-medium'
              }`}
            >
              <Icon className={`h-5 w-5 mb-1 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="text-[10px] sm:text-[11px] leading-tight tracking-tight truncate w-full text-center">
                <span className="flex items-center justify-center gap-1">
                  <span>{item.label}</span>
                  {navNewFlags[item.id] && <span className="text-[8px] font-black text-destructive leading-none">N</span>}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      <Dialog open={showExitModal} onOpenChange={setShowExitModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold">시스템 종료</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">시스템을 종료하고 로그아웃 하시겠습니까?</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="flex space-x-2 pt-2 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              onClick={cancelExitApp}
              className="flex-1 text-xs font-semibold"
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={confirmExitApp}
              className="flex-1 text-xs font-bold"
            >
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
