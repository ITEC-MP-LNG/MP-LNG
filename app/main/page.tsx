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

  return `${years}년 ${remainingDays}일`;
}

interface ExtendedAppUser extends AppUser {
  join_date?: string;
  career_start_date?: string;
}

export default function MainPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<ExtendedAppUser | null>(null);
  const [mainTab, setMainTab] = useState<'NOTICE' | 'TASKS' | 'INVENTORY' | 'SHIP' | 'EDUCATION' | 'HR'>('NOTICE');

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

  // 모바일 종 모양 버튼 색상 제어용 (읽지 않은 새 공지 유무)
  const [hasUnreadNotice, setHasUnreadNotice] = useState(false);
  const [navNewFlags, setNavNewFlags] = useState<Record<string, boolean>>({});
  const isUserEditingRef = useRef(false);
  const refreshPendingRef = useRef(false);
  const lastInputAtRef = useRef(0);

  const normalizedRole = String(currentUser?.role || '').trim().toUpperCase();
  const isAdmin = normalizedRole === 'ADMIN';

  // ============================================================
  // 모바일 뒤로가기 관련
  // ============================================================
  //
  // 동작 순서:
  // 1. 자식 컴포넌트에 "뒤로가기" 이벤트를 먼저 전달
  // 2. 자식 컴포넌트에서 열린 모달/입력창을 닫을 수 있으면 닫음
  // 3. 열린
```
