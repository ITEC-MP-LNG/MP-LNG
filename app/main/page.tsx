'use client';

import { useEffect, useState } from 'react';
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
  AlertCircle
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
}

export default function MainPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<ExtendedAppUser | null>(null);
  const [mainTab, setMainTab] = useState<'TASKS' | 'INVENTORY' | 'SHIP' | 'EDUCATION' | 'HR'>('TASKS');

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

  const [showExitModal, setShowExitModal] = useState(false);

  const normalizedRole = String(currentUser?.role || '').trim().toUpperCase();
  const isAdmin = normalizedRole === 'ADMIN';

  useEffect(() => {
    let lastBackPressTime = 0;

    window.history.pushState(null, '', window.location.href);

    const handlePopState = (event: PopStateEvent) => {
      event.preventDefault();
      const currentTime = new Date().getTime();

      if (currentTime - lastBackPressTime < 2000) {
        setShowExitModal(false);
        if (window.history.length > 1) {
          window.history.go(-2);
        } else {
          window.close();
        }
      } else {
        lastBackPressTime = currentTime;
        setShowExitModal(true);
        window.history.pushState(null, '', window.location.href);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    const initAuthAndData = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        const userJson = localStorage.getItem('currentUser');
        let localUser: ExtendedAppUser | null = userJson ? JSON.parse(userJson) : null;

        if (!authUser && !localUser) {
          router.push('/login');
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
              career_start_date: appUserData.career_start_date
            } as ExtendedAppUser;
            
            localStorage.setItem('currentUser', JSON.stringify(targetUser));
          }
        }

        if (!targetUser) {
          router.push('/login');
          return;
        }

        setCurrentUser(targetUser);

        await Promise.all([
          fetchTasks(targetUser),
          fetchInventory(),
          fetchInventoryLogs(),
          fetchEducations(),
          fetchEducationRecords()
        ]);

      } catch (e) {
        console.error('세션 및 인증 초기화 실패:', e);
        localStorage.removeItem('currentUser');
        router.push('/login');
      }
    };

    initAuthAndData();
  }, [router]);

  const fetchTasks = async (user: AppUser) => {
    setLoadingTasks(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
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
  };

  const fetchInventory = async () => {
    setLoadingInventory(true);
    try {
      const { data, error } = await supabase.from('inventory').select('*').order('code', { ascending: true });
      if (error) throw error;
      const list: InventoryItem[] = data || [];
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
  };

  const fetchInventoryLogs = async () => {
    try {
      const { data, error } = await supabase.from('inventory_logs').select('*').order('created_at', { ascending: false }).limit(20);
      if (error) throw error;
      setInventoryLogs(data || []);
    } catch (err: any) {
      console.error('이력 목록 불러오기 실패:', err);
    }
  };

  const fetchEducations = async () => {
    try {
      setLoadingEdu(true);
      const { data, error } = await supabase
        .from('educations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
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
  };

  const fetchEducationRecords = async () => {
    try {
      const { data, error } = await supabase.from('education_records').select('*');
      if (error) throw error;
      setEduRecords(data || []);
    } catch (err: any) {
      console.error('교육 이수 기록 불러오기 실패:', err);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('currentUser');
    localStorage.removeItem('login_timestamp');
    router.push('/login');
  };

  // 모달 확인 시 세션 및 로컬스토리지 정리 후 로그인 페이지로 이동
  const confirmExitApp = async () => {
    setShowExitModal(false);
    await supabase.auth.signOut();
    localStorage.removeItem('currentUser');
    localStorage.removeItem('login_timestamp');
    router.push('/login');
  };

  const cancelExitApp = () => {
    setShowExitModal(false);
    window.history.pushState(null, '', window.location.href);
  };

  if (!currentUser) return null;

  const companyCareer = calculateCareerDetails(currentUser.join_date);
  const totalCareer = calculateCareerDetails(currentUser.career_start_date);

  const menuItems = [
    { id: 'TASKS', label: '업무 관리', icon: ListTodo },
    { id: 'INVENTORY', label: '자재/재고 관리', icon: Package },
    { id: 'SHIP', label: '호선 현황', icon: Anchor },
    { id: 'EDUCATION', label: '교육 관리', icon: GraduationCap },
    { id: 'HR', label: '인사 관리', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-[#F5F6F8] text-[#1F2937] flex flex-col pb-20 md:pb-0 font-sans relative">
      <header className="bg-white border-b border-[#E2E5E9] sticky top-0 z-30 shadow-2xs">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="bg-[#243B5A] p-2 rounded-lg text-white shadow-xs">
              <Layers className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-[#1F2937] tracking-tight leading-none">
                통합현장관리 <span className="text-[#243B5A]">SYSTEM</span>
              </h1>
              <span className="text-[10px] text-[#64748B] hidden sm:inline-block">Enterprise Field Management</span>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="hidden lg:flex items-center space-x-2 text-xs">
              {companyCareer && (
                <div className="flex items-center space-x-1.5 bg-[#F5F6F8] text-[#1F2937] px-2.5 py-1 rounded-md border border-[#E2E5E9]">
                  <Calendar className="h-3.5 w-3.5 text-[#243B5A]" />
                  <span>자사근속: <strong className="text-[#243B5A]">{companyCareer}</strong></span>
                </div>
              )}
              {totalCareer && (
                <div className="flex items-center space-x-1.5 bg-[#F5F6F8] text-[#1F2937] px-2.5 py-1 rounded-md border border-[#E2E5E9]">
                  <Briefcase className="h-3.5 w-3.5 text-[#243B5A]" />
                  <span>총 경력: <strong className="text-[#243B5A]">{totalCareer}</strong></span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2 bg-[#F5F6F8] px-3 py-1 rounded-lg border border-[#E2E5E9]">
              <ShieldCheck className="h-4 w-4 text-[#243B5A]" />
              <span className="text-xs font-semibold text-[#1F2937]">{currentUser.name}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                isAdmin ? 'bg-[#243B5A] text-white' : 'bg-[#E2E5E9] text-[#1F2937]'
              }`}>
                {isAdmin ? 'ADMIN' : 'USER'}
              </span>
            </div>
            
            <button
              onClick={handleLogout}
              className="p-1.5 text-[#64748B] hover:text-[#DC2626] hover:bg-red-50 rounded-lg transition border border-transparent hover:border-red-200 cursor-pointer"
              title="로그아웃"
            >
              <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-full w-full mx-auto flex">
        <aside className="hidden md:block w-56 bg-white border-r border-[#E2E5E9] p-3 space-y-1 shrink-0">
          <div className="px-3 py-2 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
            통합 현장관리 Navigation
          </div>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = mainTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setMainTab(item.id as any)}
                className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  isActive
                    ? 'bg-[#243B5A] text-white shadow-2xs font-bold'
                    : 'text-[#64748B] hover:bg-[#F5F6F8] hover:text-[#1F2937]'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-[#64748B]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </aside>

        <main className="flex-1 p-0 overflow-y-auto min-w-0">
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
            />
          )}
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#E2E5E9] z-40 px-2 py-2 flex justify-around items-center shadow-lg">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = mainTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setMainTab(item.id as any)}
              className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg transition ${
                isActive ? 'text-[#243B5A] font-bold' : 'text-[#64748B] font-medium'
              }`}
            >
              <Icon className={`h-5 w-5 mb-1 ${isActive ? 'text-[#243B5A]' : 'text-[#64748B]'}`} />
              <span className="text-[11px] leading-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {showExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-[#E2E5E9] space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-[#243B5A]/10 rounded-xl text-[#243B5A]">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1F2937]">시스템 종료</h3>
                <p className="text-xs text-[#64748B]">시스템을 종료하고 로그아웃 하시겠습니까?</p>
              </div>
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={cancelExitApp}
                className="flex-1 py-2.5 px-4 bg-[#F5F6F8] text-[#1F2937] hover:bg-[#E2E5E9] text-xs font-semibold rounded-lg transition border border-[#E2E5E9] cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmExitApp}
                className="flex-1 py-2.5 px-4 bg-[#243B5A] text-white hover:bg-[#1a2d46] text-xs font-bold rounded-lg transition shadow-xs cursor-pointer"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
