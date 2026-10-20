'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Clock, User, CheckCircle2, Pencil, Trash2, Calendar as CalendarIcon, 
  Plus, X, ChevronLeft, ChevronRight, Bell, Home, Tag, Sun, Moon, 
  LayoutGrid, List, Settings, Eye, AlertCircle, PlayCircle, PlusCircle,
  Users, History, FileSpreadsheet, Layers, FileText, ChevronDown, CalendarDays
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import * as ExcelJS from 'exceljs';

export interface Task {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  time_slot?: string;
  assigned_names?: string[];
  day_workers?: string[];
  night_workers?: string[];
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  task_type: 'DAILY' | 'DAILY_OTHER' | 'WEEKLY' | 'CABIN';
  created_by_id?: string;
  created_by_name?: string;
  category?: string;      // 호선
  cargo_hold?: string;    // 화물창
  remarks?: string;
  remarks_edited_at?: string | null;
  created_at?: string;
  updated_at?: string;
  completed_by_id?: string;
  completed_by_name?: string;
  completed_at?: string;
  completion_pending_review?: boolean;
}

export interface CabinVessel {
  id: string;
  name: string;
}

export interface VehicleItem {
  id: string;
  vehicle_no: string;
}

export interface VehicleUsage {
  id: string;
  vehicle_no: string;
  driver_name: string;
  driver_id?: string;
  time_str?: string;
  destination?: string;
  purpose?: string;
  start_date?: string;
  end_date?: string;
  created_at?: string;
}

export interface PresetTeam {
  id: string;
  name: string;
  department?: string;
  members: string[];
}

export interface AppUser {
  id?: string;
  name: string;
  department?: string;
  position?: string;
  job_title?: string;
  field?: string;
  phone?: string;
  work_status?: '근무중' | '휴무' | string;
  yard_cert_details?: Array<{ name: string; education_date: string; renewal_count: number; renewal_dates: string[] }>;
}

const formatDateToYYYYMMDD = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatToShortDate = (dateStr?: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split(/[-/]/);
  if (parts.length === 3) {
    const yy = parts[0].slice(-2);
    return `${yy}/${parts[1]}/${parts[2]}`;
  }
  return dateStr;
};

const formatShortTimeSlot = (slot?: string) => {
  if (!slot) return '';
  if (slot.includes('오전')) return '오전';
  if (slot.includes('오후')) return '오후';
  if (slot.includes('종일')) return '종일';
  return slot;
};

const getMonday = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
};

function isFormerEmployee(user: AppUser): boolean {
  const values = [user.department, user.position, user.job_title, user.field]
    .map(value => String(value || '').trim().toLowerCase());
  return values.some(value => /퇴사|퇴직|퇴사자|퇴직자/.test(value));
}

function CalendarDatePicker({
  value,
  onChange,
  className = "w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const initialDate = value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)))
    : new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [inputText, setInputText] = useState(value || '');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputText(value || '');
  }, [value]);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (event: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const moveMonth = (amount: number) => {
    const next = new Date(viewYear, viewMonth + amount, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const selected = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
  const today = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  })();
  const commitTypedDate = () => {
    const trimmed = inputText.trim();
    if (!trimmed) {
      onChange('');
      setInputText('');
      return;
    }
    const normalizedInput = /^\d{8}$/.test(trimmed)
      ? `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`
      : trimmed;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalizedInput);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const candidate = new Date(year, month - 1, day);
      if (candidate.getFullYear() === year && candidate.getMonth() === month - 1 && candidate.getDate() === day) {
        const normalized = `${match[1]}-${match[2]}-${match[3]}`;
        onChange(normalized);
        setInputText(normalized);
        return;
      }
    }
    setInputText(value || '');
  };
  const chooseDate = (day: number) => {
    const nextValue = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(nextValue);
    setInputText(nextValue);
    setIsOpen(false);
  };

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <div className="flex min-w-0 items-center gap-1">
        <input
          type="text"
          inputMode="numeric"
          value={inputText}
          onChange={(event) => setInputText(event.target.value)}
          onBlur={commitTypedDate}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commitTypedDate(); } }}
          placeholder="YYYY-MM-DD 직접 입력"
          aria-label="날짜 직접 입력 (YYYY-MM-DD)"
          className={`${className} min-w-0 flex-1`}
        />
        <button
          type="button"
          onClick={() => {
            if (!isOpen) {
              const current = selected ? new Date(Number(selected.slice(0, 4)), Number(selected.slice(5, 7)) - 1, Number(selected.slice(8, 10))) : new Date();
              setViewYear(current.getFullYear());
              setViewMonth(current.getMonth());
            }
            setIsOpen(open => !open);
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E2E5E9] bg-[#F5F6F8] text-[#64748B] hover:bg-[#EEF2F7]"
          aria-label="달력 열기"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
        >
          <CalendarDays size={16} />
        </button>
      </div>
      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/10 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="날짜 선택"
            onClick={(event) => event.stopPropagation()}
            className="relative w-[min(320px,calc(100vw-32px))] max-h-[calc(100dvh-32px)] overflow-y-auto rounded-2xl border border-[#E2E5E9] bg-white p-3 shadow-[0_12px_32px_rgba(15,23,42,0.18)] text-[#1F2937]"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <button type="button" onClick={() => moveMonth(-1)} aria-label="이전 달" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E5E9] bg-[#F8FAFC] text-[#243B5A] hover:bg-[#EEF2F7]"><ChevronLeft size={16} /></button>
              <div className="flex min-w-0 items-center gap-1">
                <select
                  aria-label="연도 선택"
                  value={viewYear}
                  onChange={(event) => setViewYear(Number(event.target.value))}
                  className="max-w-[112px] rounded-lg border border-[#E2E5E9] bg-[#F8FAFC] px-2 py-1.5 text-sm font-bold text-[#243B5A] outline-none focus:border-[#243B5A]"
                >
                  {Array.from({ length: Math.max(80, new Date().getFullYear() - 1960 + 21) }, (_, index) => 1960 + index).map((year) => (
                    <option key={year} value={year}>{year}년</option>
                  ))}
                </select>
                <select
                  aria-label="월 선택"
                  value={viewMonth}
                  onChange={(event) => setViewMonth(Number(event.target.value))}
                  className="rounded-lg border border-[#E2E5E9] bg-[#F8FAFC] px-2 py-1.5 text-sm font-bold text-[#243B5A] outline-none focus:border-[#243B5A]"
                >
                  {Array.from({ length: 12 }, (_, month) => <option key={month} value={month}>{month + 1}월</option>)}
                </select>
              </div>
              <button type="button" onClick={() => moveMonth(1)} aria-label="다음 달" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E5E9] bg-[#F8FAFC] text-[#243B5A] hover:bg-[#EEF2F7]"><ChevronRight size={16} /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => <div key={day} className={`py-1 text-[11px] font-semibold ${index === 0 ? 'text-[#DC2626]' : index === 6 ? 'text-[#2563EB]' : 'text-[#64748B]'}`}>{day}</div>)}
              {Array.from({ length: firstDay }, (_, index) => <div key={`empty-${index}`} />)}
              {Array.from({ length: daysInMonth }, (_, index) => {
                const day = index + 1;
                const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isSelected = dateKey === selected;
                const isToday = dateKey === today;
                const weekday = new Date(viewYear, viewMonth, day).getDay();
                return <button key={dateKey} type="button" onClick={() => chooseDate(day)} aria-pressed={isSelected} className={`h-9 rounded-lg text-xs transition-colors ${isSelected ? 'bg-[#243B5A] font-bold text-white shadow-sm' : isToday ? 'border border-[#243B5A] font-bold text-[#243B5A]' : `hover:bg-[#EEF2F7] ${weekday === 0 ? 'text-[#DC2626]' : weekday === 6 ? 'text-[#2563EB]' : 'text-[#1F2937]'}`}`}>{day}</button>;
              })}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-[#E2E5E9] pt-2">
              <button type="button" onClick={() => { const now = new Date(); const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; setViewYear(now.getFullYear()); setViewMonth(now.getMonth()); onChange(date); setInputText(date); setIsOpen(false); }} className="rounded-lg px-3 py-2 text-xs font-semibold text-[#243B5A] hover:bg-[#F5F6F8]">오늘</button>
              <div className="flex items-center gap-1">
                {selected && <button type="button" onClick={() => { onChange(''); setInputText(''); setIsOpen(false); }} className="rounded-lg px-3 py-2 text-xs font-semibold text-[#64748B] hover:bg-[#F5F6F8]">날짜 지우기</button>}
                <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg bg-[#243B5A] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1B2F49]">닫기</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorkManagement({ currentUser }: { currentUser?: { id: string; name: string; role: string } | null }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [vessels, setVessels] = useState<CabinVessel[]>([]);
  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [vehicleUsages, setVehicleUsages] = useState<VehicleUsage[]>([]);
  const [presetTeams, setPresetTeams] = useState<PresetTeam[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [validUserNames, setValidUserNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 차량 사용 내역 일괄 삭제를 위한 선택 ID 상태 추가
  const [selectedVehicleUsageIds, setSelectedVehicleUsageIds] = useState<string[]>([]);

  const isAdmin = useMemo(() => {
    const role = String(currentUser?.role || '').trim().toUpperCase();
    return ['SUPER_ADMIN', 'WORK_ADMIN', 'ADMIN'].includes(role) || currentUser?.role === '관리자';
  }, [currentUser]);
  const currentUserId = currentUser?.id;
  const currentUserNameForFetch = currentUser?.name;

  const canManageTask = useCallback((task: Task) => {
    if (isAdmin) return true;
    if (task.task_type !== 'DAILY_OTHER' || !currentUser) return false;
    if (task.created_by_id && currentUser.id) return task.created_by_id === currentUser.id;
    return Boolean(task.created_by_name && currentUser.name && task.created_by_name.trim().toLowerCase() === currentUser.name.trim().toLowerCase());
  }, [isAdmin, currentUser]);

  const [taskTab, setTaskTab] = useState<'DAILY' | 'WEEKLY' | 'CABIN' | 'VEHICLE'>('DAILY');
  const [dailySubTab, setDailySubTab] = useState<'ACTIVE' | 'OTHER' | 'HISTORY'>('ACTIVE'); 
  const [cabinSubTab, setCabinSubTab] = useState<string>('ALL');
  const [cabinStatusSubTab, setCabinStatusSubTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
  
  const [vehicleSubTab, setVehicleSubTab] = useState<string>('ALL');
  const [isVehicleManagerOpen, setIsVehicleManagerOpen] = useState(false);
  const [newVehicleNo, setNewVehicleNo] = useState('');
  const [editingVehicle, setEditingVehicle] = useState<VehicleItem | null>(null);

  const [isVehicleUsageModalOpen, setIsVehicleUsageModalOpen] = useState(false);
  const [targetVehicleForUsage, setTargetVehicleForUsage] = useState<string>('');
  const [vehicleUsageForm, setVehicleUsageForm] = useState({
    time_str: '',
    destination: '',
    purpose: '',
    start_date: formatDateToYYYYMMDD(new Date()),
    end_date: formatDateToYYYYMMDD(new Date()),
  });

  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  const [tableFilterVessel, setTableFilterVessel] = useState<string>('ALL');
  const [tableFilterCargoHold, setTableFilterCargoHold] = useState<string>('ALL');
  const [tableFilterDate, setTableFilterDate] = useState<string>('ALL');
  const [tableFilterTimeSlot, setTableFilterTimeSlot] = useState<string>('ALL');
  const [tableFilterStatus, setTableFilterStatus] = useState<string>('ALL');

  const [activeFilterDropdown, setActiveFilterDropdown] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [weeklyViewMode, setWeeklyViewMode] = useState<'GRID' | 'LIST'>('GRID');
  const [currentWeekMonday, setCurrentWeekMonday] = useState<Date>(() => getMonday(new Date()));
  const [selectedExportMonth, setSelectedExportMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [isWeeklyImportModalOpen, setIsWeeklyImportModalOpen] = useState(false);
  const [importTargetDate, setImportTargetDate] = useState<string>(() => formatDateToYYYYMMDD(new Date()));
  const [selectedWeeklyIdsToImport, setSelectedWeeklyIdsToImport] = useState<string[]>([]);

  const [isQuickVesselInputOpen, setIsQuickVesselInputOpen] = useState(false);
  const [quickVesselName, setQuickVesselName] = useState('');

  const [customAlert, setCustomAlert] = useState<{ open: boolean; title: string; message: string; type?: 'info' | 'confirm' | 'monthlyDelete'; onConfirm?: () => void; onDownload?: () => void }>({
    open: false,
    title: '',
    message: '',
    type: 'info'
  });

  const showCustomAlert = useCallback((title: string, message: string) => {
    setCustomAlert({ open: true, title, message, type: 'info' });
  }, []);

  const showCustomConfirm = useCallback((title: string, message: string, onConfirm: () => void) => {
    setCustomAlert({ open: true, title, message, type: 'confirm', onConfirm });
  }, []);

  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [myAssignedTasks, setMyAssignedTasks] = useState<Task[]>([]);
  const [isNightWorkAlertOpen, setIsNightWorkAlertOpen] = useState(false);
  const [nightPendingTasks, setNightPendingTasks] = useState<Task[]>([]);
  const nightAlertSeenIds = useRef<Set<string>>(new Set());
  
  const lastTasksFetchStartedAtRef = useRef(0);
  const lastTasksFetchCompletedAtRef = useRef(0);
  const tasksFetchInFlightRef = useRef(false);
  const tasksFetchQueuedRef = useRef(false);

  const [selectedTaskForSheet, setSelectedTaskForSheet] = useState<Task | null>(null);

  const [statusChangeModal, setStatusChangeModal] = useState<{
    open: boolean;
    task: Task | null;
    targetStatus: Task['status'];
    remarks: string;
  }>({
    open: false,
    task: null,
    targetStatus: 'PENDING',
    remarks: ''
  });

  const [isVesselManagerOpen, setIsVesselManagerOpen] = useState(false);
  const [newVesselName, setNewVesselName] = useState('');
  const [editingVessel, setEditingVessel] = useState<CabinVessel | null>(null);

  const [isTeamManagerOpen, setIsTeamManagerOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDept, setNewTeamDept] = useState('');
  const [newTeamMembersText, setNewTeamMembersText] = useState('');
  const [editingTeam, setEditingTeam] = useState<PresetTeam | null>(null);
  const [editTeamMembersText, setEditTeamMembersText] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: formatDateToYYYYMMDD(new Date()),
    end_date: formatDateToYYYYMMDD(new Date()),
    time_slot: '오전(08:00~12:00)',
    task_type: 'DAILY' as 'DAILY' | 'DAILY_OTHER' | 'WEEKLY' | 'CABIN',
    category: '',
    cargo_hold: '',
  });

  const [assignedList, setAssignedList] = useState<string[]>([]);
  const [dayWorkerList, setDayWorkerList] = useState<string[]>([]);
  const [nightWorkerList, setNightWorkerList] = useState<string[]>([]);
  const [singleWorkerInput, setSingleWorkerInput] = useState('');

  const fetchAppUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('app_users').select('id, name, department, position, job_title, field, phone, work_status, yard_cert_details');
      if (error) throw error;
      if (data) {
        setAppUsers(data);
        const names = data.map((u: any) => u.name?.trim()).filter(Boolean);
        setValidUserNames(names);

        const depts = Array.from(
          new Set(data.map((u: any) => u.department?.trim()).filter(Boolean))
        ) as string[];
        setDepartments(depts);
      }
    } catch (err) {
      console.error('app_users 로드 실패:', err);
    }
  }, []);

  const fetchVessels = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('cabin_vessels').select('id, name, created_at').order('created_at', { ascending: true });
      if (error) throw error;
      if (data) {
        setVessels(data);
        if (data.length > 0) {
          setFormData((prev) => prev.category ? prev : ({ ...prev, category: data[0].name }));
        }
      }
    } catch (err) {
      console.error('vessels 로드 실패:', err);
    }
  }, []);

  const fetchVehicles = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('vehicles').select('id, vehicle_no, created_at').order('created_at', { ascending: true });
      if (error) throw error;
      if (data) {
        setVehicles(data);
      }
    } catch (err) {
      console.error('vehicles 로드 실패:', err);
    }
  }, []);

  const fetchVehicleUsages = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('vehicle_usages').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (data) {
        setVehicleUsages(data);
      }
    } catch (err) {
      console.error('vehicle_usages 로드 실패:', err);
    }
  }, []);

  const fetchTeams = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('preset_teams').select('id, name, department, members, created_at').order('created_at', { ascending: true });
      if (error) throw error;
      if (data) {
        setPresetTeams(data);
      }
    } catch (err) {
      console.error('preset_teams 로드 실패:', err);
    }
  }, []);

  const getTaskReadKey = useCallback((taskId: string) => {
    const userKey = currentUser?.id || currentUser?.name || 'guest';
    return `work_task_read_${userKey}_${taskId}`;
  }, [currentUser]);

  const getTaskChangeTime = useCallback((task: Task) => {
    const value = task.updated_at || task.created_at;
    const time = value ? new Date(value).getTime() : 0;
    return Number.isFinite(time) ? time : 0;
  }, []);

  const isTaskNew = useCallback((task: Task) => {
    if (typeof window === 'undefined') return false;
    const changeTime = getTaskChangeTime(task);
    if (!changeTime) return false;

    const readAt = Number(localStorage.getItem(getTaskReadKey(task.id)) || '0');
    if (readAt > 0) return changeTime > readAt;

    const userKey = currentUser?.id || currentUser?.name || 'guest';
    const initializedAt = Number(localStorage.getItem(`work_task_n_initialized_${userKey}`) || '0');
    if (!initializedAt) return true;
    return changeTime > initializedAt;
  }, [currentUser, getTaskChangeTime, getTaskReadKey]);

  const markTaskAsRead = useCallback((task: Task) => {
    if (typeof window === 'undefined') return;
    const scrollY = window.scrollY;
    localStorage.setItem(getTaskReadKey(task.id), String(Date.now()));
    setTasks(prev => [...prev]);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY);
      });
    });
  }, [getTaskReadKey]);

  const handleOpenTaskDetail = useCallback((task: Task) => {
    markTaskAsRead(task);
    setSelectedTaskForSheet(task);
  }, [markTaskAsRead]);

  const renderTaskNewBadge = useCallback((task: Task) => {
    if (!isTaskNew(task)) return null;
    return <span className="text-[10px] font-extrabold text-red-600 ml-1">N</span>;
  }, [isTaskNew]);

  const fetchTasks = useCallback(async () => {
    if (tasksFetchInFlightRef.current) {
      tasksFetchQueuedRef.current = true;
      return;
    }

    tasksFetchInFlightRef.current = true;
    lastTasksFetchStartedAtRef.current = Date.now();
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('tasks').select('id, title, description, start_date, end_date, time_slot, assigned_names, day_workers, night_workers, status, task_type, created_by_id, created_by_name, category, cargo_hold, remarks, remarks_edited_at, created_at, updated_at, completed_by_id, completed_by_name, completed_at, completion_pending_review').order('start_date', { ascending: true });
      if (error) throw error;

      if (data) {
        const formatted: Task[] = data.map((t: any) => ({
          ...t,
          status: t.status || 'PENDING',
          completion_pending_review: t.completion_pending_review === true,
          assigned_names: Array.isArray(t.assigned_names) ? t.assigned_names : (t.assigned_names ? t.assigned_names.split(',').map((s: string) => s.trim()) : []),
          day_workers: Array.isArray(t.day_workers) ? t.day_workers : (t.day_workers ? t.day_workers.split(',').map((s: string) => s.trim()) : []),
          night_workers: Array.isArray(t.night_workers) ? t.night_workers : (t.night_workers ? t.night_workers.split(',').map((s: string) => s.trim()) : []),
        }));

        const userKey = currentUserId || currentUserNameForFetch || 'guest';
        const initializedKey = `work_task_n_initialized_${userKey}`;
        if (!localStorage.getItem(initializedKey)) {
          localStorage.setItem(initializedKey, String(Date.now()));
        }

        setTasks(formatted);

        let targetTasks: Task[] = [];
        if (currentUserNameForFetch) {
          const currentUserName = currentUserNameForFetch.trim().toLowerCase();
          targetTasks = formatted.filter((t) => {
            if (t.status === 'COMPLETED' || t.task_type === 'DAILY_OTHER') return false;
            const isAssigned = (t.assigned_names || []).some(name => name.trim().toLowerCase() === currentUserName);
            const isDayWorker = (t.day_workers || []).some(name => name.trim().toLowerCase() === currentUserName);
            const isNightWorker = (t.night_workers || []).some(name => name.trim().toLowerCase() === currentUserName);
            return isAssigned || isDayWorker || isNightWorker;
          });
        } else {
          targetTasks = formatted.filter((t) => t.status !== 'COMPLETED' && t.task_type !== 'DAILY_OTHER');
        }

        setMyAssignedTasks(targetTasks);
        if (targetTasks.length > 0) setIsAlertOpen(true);

        const pendingNightTasks = isAdmin
          ? formatted.filter((t) => t.task_type === 'DAILY_OTHER' && t.status !== 'COMPLETED')
          : [];
        setNightPendingTasks(pendingNightTasks);
        if (!isAdmin) {
          setIsNightWorkAlertOpen(false);
          nightAlertSeenIds.current.clear();
        } else if (pendingNightTasks.length === 0) {
          setIsNightWorkAlertOpen(false);
        } else {
          const hasNewPendingNightTask = pendingNightTasks.some((t) => !nightAlertSeenIds.current.has(t.id));
          pendingNightTasks.forEach((t) => nightAlertSeenIds.current.add(t.id));
          if (hasNewPendingNightTask) setIsNightWorkAlertOpen(true);
        }
      }
    } catch (err) {
      console.error('tasks 로드 실패:', err);
    } finally {
      lastTasksFetchCompletedAtRef.current = Date.now();
      tasksFetchInFlightRef.current = false;
      setIsLoading(false);

      if (tasksFetchQueuedRef.current) {
        tasksFetchQueuedRef.current = false;
        setTimeout(() => {
          fetchTasksRef.current();
        }, 0);
      }
    }
  }, [currentUserId, currentUserNameForFetch, isAdmin]);

  const fetchTasksRef = useRef(fetchTasks);
  useEffect(() => {
    fetchTasksRef.current = fetchTasks;
  }, [fetchTasks]);

  useEffect(() => {
    fetchAppUsers();
    fetchVessels();
    fetchVehicles();
    fetchVehicleUsages();
    fetchTeams();
  }, [fetchAppUsers, fetchVessels, fetchVehicles, fetchVehicleUsages, fetchTeams]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel('public:tasks')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => {
          const eventAt = Date.now();
          if (refreshTimer) clearTimeout(refreshTimer);
          refreshTimer = setTimeout(() => {
            refreshTimer = null;
            if (lastTasksFetchStartedAtRef.current >= eventAt) return;
            fetchTasksRef.current();
          }, 300);
        }
      )
      .subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  const canModifyTaskStatus = useCallback((task: Task) => {
    if (isAdmin) return true;
    if (task.task_type === 'WEEKLY' || task.task_type === 'CABIN') return false;
    if (!currentUser || !currentUser.name) return false;

    const name = currentUser.name.trim().toLowerCase();
    const assigned = (task.assigned_names || []).map(n => n.trim().toLowerCase());
    const day = (task.day_workers || []).map(n => n.trim().toLowerCase());
    const night = (task.night_workers || []).map(n => n.trim().toLowerCase());

    return assigned.includes(name) || day.includes(name) || night.includes(name);
  }, [isAdmin, currentUser]);

  const wasCompletedHistoryRemarksEdited = useCallback((task: Task) => (
    task.status === 'COMPLETED' &&
    task.completion_pending_review !== true &&
    Boolean(task.remarks_edited_at)
  ), []);

  const handleAddVessel = useCallback(async () => {
    if (!isAdmin) { showCustomAlert('권한 없음', '관리자 권한이 없습니다.'); return; }
    if (!newVesselName.trim()) return;
    try {
      const { error } = await supabase.from('cabin_vessels').insert([{ name: newVesselName.trim() }]);
      if (error) throw error;
      setNewVesselName('');
      fetchVessels();
      showCustomAlert('성공', '호선이 추가되었습니다.');
    } catch (err: any) { showCustomAlert('오류', `호선 추가 실패: ${err.message}`); }
  }, [isAdmin, newVesselName, fetchVessels, showCustomAlert]);

  const handleQuickAddVessel = useCallback(async () => {
    if (!isAdmin) { showCustomAlert('권한 없음', '관리자 권한이 없습니다.'); return; }
    if (!quickVesselName.trim()) return;
    try {
      const { error } = await supabase.from('cabin_vessels').insert([{ name: quickVesselName.trim() }]);
      if (error) throw error;
      const addedName = quickVesselName.trim();
      setQuickVesselName('');
      setIsQuickVesselInputOpen(false);
      await fetchVessels();
      setFormData(prev => ({ ...prev, category: addedName }));
      showCustomAlert('성공', '새 호선이 추가되고 선택되었습니다.');
    } catch (err: any) { showCustomAlert('오류', `호선 추가 실패: ${err.message}`); }
  }, [isAdmin, quickVesselName, fetchVessels, showCustomAlert]);

  const handleUpdateVessel = useCallback(async (id: string, name: string) => {
    if (!isAdmin) { showCustomAlert('권한 없음', '관리자 권한이 없습니다.'); return; }
    if (!name.trim()) return;
    try {
      const { error } = await supabase.from('cabin_vessels').update({ name: name.trim() }).eq('id', id);
      if (error) throw error;
      setEditingVessel(null);
      fetchVessels();
      showCustomAlert('성공', '호선 정보가 수정되었습니다.');
    } catch (err: any) { showCustomAlert('오류', `호선 수정 실패: ${err.message}`); }
  }, [isAdmin, fetchVessels, showCustomAlert]);

  const handleDeleteVessel = useCallback(async (id: string) => {
    if (!isAdmin) { showCustomAlert('권한 없음', '관리자 권한이 없습니다.'); return; }
    showCustomConfirm('호선 삭제', '이 호선을 삭제하시겠습니까?', async () => {
      try {
        const vesselToDelete = vessels.find((v) => v.id === id);
        const { error } = await supabase.from('cabin_vessels').delete().eq('id', id);
        if (error) throw error;
        if (vesselToDelete && cabinSubTab === vesselToDelete.name) setCabinSubTab('ALL');
        if (vesselToDelete && tableFilterVessel === vesselToDelete.name) setTableFilterVessel('ALL');
        await fetchVessels();
        showCustomAlert('완료', '호선이 삭제되었습니다. 기존 업무 기록의 호선명은 유지됩니다.');
      } catch (err: any) { showCustomAlert('오류', `호선 삭제 실패: ${err.message}`); }
    });
  }, [isAdmin, showCustomConfirm, fetchVessels, showCustomAlert, vessels, cabinSubTab, tableFilterVessel]);

  const handleAddVehicle = useCallback(async () => {
    if (!isAdmin) { showCustomAlert('권한 없음', '관리자 권한이 없습니다.'); return; }
    if (!newVehicleNo.trim()) return;
    try {
      const { error } = await supabase.from('vehicles').insert([{ vehicle_no: newVehicleNo.trim() }]);
      if (error) throw error;
      setNewVehicleNo('');
      fetchVehicles();
      showCustomAlert('성공', '차량이 등록되었습니다.');
    } catch (err: any) { showCustomAlert('오류', `차량 등록 실패: ${err.message}`); }
  }, [isAdmin, newVehicleNo, fetchVehicles, showCustomAlert]);

  const handleUpdateVehicle = useCallback(async (id: string, vehicleNo: string) => {
    if (!isAdmin) { showCustomAlert('권한 없음', '관리자 권한이 없습니다.'); return; }
    if (!vehicleNo.trim()) return;
    try {
      const { error } = await supabase.from('vehicles').update({ vehicle_no: vehicleNo.trim() }).eq('id', id);
      if (error) throw error;
      setEditingVehicle(null);
      fetchVehicles();
      showCustomAlert('성공', '차량 정보가 수정되었습니다.');
    } catch (err: any) { showCustomAlert('오류', `차량 수정 실패: ${err.message}`); }
  }, [isAdmin, fetchVehicles, showCustomAlert]);

  const handleDeleteVehicle = useCallback(async (id: string) => {
    if (!isAdmin) { showCustomAlert('권한 없음', '관리자 권한이 없습니다.'); return; }
    showCustomConfirm('차량 삭제', '이 차량을 삭제하시겠습니까?', async () => {
      try {
        const vehicleToDelete = vehicles.find((v) => v.id === id);
        const { error } = await supabase.from('vehicles').delete().eq('id', id);
        if (error) throw error;
        if (vehicleToDelete && vehicleSubTab === vehicleToDelete.vehicle_no) setVehicleSubTab('ALL');
        await fetchVehicles();
        showCustomAlert('완료', '차량이 삭제되었습니다.');
      } catch (err: any) { showCustomAlert('오류', `차량 삭제 실패: ${err.message}`); }
    });
  }, [isAdmin, showCustomConfirm, fetchVehicles, showCustomAlert, vehicles, vehicleSubTab]);

  const handleOpenVehicleUsageModal = useCallback((vehicleNo: string) => {
    if (!currentUser) {
      showCustomAlert('알림', '로그인 후 이용 가능합니다.');
      return;
    }
    const currentUserObj = appUsers.find(u => u.name?.trim().toLowerCase() === currentUser.name?.trim().toLowerCase());
    const yardCerts = currentUserObj?.yard_cert_details || [];
    const hasDrivingCert = yardCerts.some(c => (c.name || '').includes('작업용차량운전자'));

    if (!hasDrivingCert) {
      showCustomAlert('알림', '교육이수가 되지 않은 인원입니다');
      return;
    }

    setTargetVehicleForUsage(vehicleNo);
    setVehicleUsageForm({
      time_str: '08:00',
      destination: '',
      purpose: '',
      start_date: formatDateToYYYYMMDD(new Date()),
      end_date: formatDateToYYYYMMDD(new Date()),
    });
    setIsVehicleUsageModalOpen(true);
  }, [currentUser, appUsers, showCustomAlert]);

  const handleSaveVehicleUsage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.name) return;
    try {
      const payload = {
        vehicle_no: targetVehicleForUsage,
        driver_name: currentUser.name,
        driver_id: currentUser.id || null,
        time_str: vehicleUsageForm.time_str,
        destination: vehicleUsageForm.destination.trim(),
        purpose: vehicleUsageForm.purpose.trim(),
        start_date: vehicleUsageForm.start_date,
        end_date: vehicleUsageForm.end_date,
      };
      const { error } = await supabase.from('vehicle_usages').insert([payload]);
      if (error) throw error;
      setIsVehicleUsageModalOpen(false);
      fetchVehicleUsages();
      showCustomAlert('성공', '차량 사용 신청이 등록되었습니다.');
    } catch (err: any) {
      showCustomAlert('오류', `차량 사용 등록 실패: ${err.message}`);
    }
  }, [currentUser, targetVehicleForUsage, vehicleUsageForm, fetchVehicleUsages, showCustomAlert]);

  const handleAddTeam = useCallback(async () => {
    if (!isAdmin) { showCustomAlert('권한 없음', '관리자 권한이 없습니다.'); return; }
    if (!newTeamName.trim()) { showCustomAlert('입력 오류', 'Team 이름을 입력해주세요.'); return; }
    
    const members = newTeamMembersText.split(',').map(m => m.trim()).filter(Boolean);

    try {
      const { error } = await supabase.from('preset_teams').insert([{ 
        name: newTeamName.trim(), 
        department: newTeamDept.trim() || null,
        members 
      }]);
      if (error) throw error;
      setNewTeamName('');
      setNewTeamDept('');
      setNewTeamMembersText('');
      fetchTeams();
      showCustomAlert('성공', 'Team이 추가되었습니다.');
    } catch (err: any) { showCustomAlert('오류', `Team 추가 실패: ${err.message}`); }
  }, [isAdmin, newTeamName, newTeamMembersText, newTeamDept, fetchTeams, showCustomAlert]);

  const handleUpdateTeam = useCallback(async (id: string) => {
    if (!isAdmin) { showCustomAlert('권한 없음', '관리자 권한이 없습니다.'); return; }
    if (!editingTeam || !editingTeam.name.trim()) return;

    const members = editTeamMembersText.split(',').map(m => m.trim()).filter(Boolean);

    try {
      const { error } = await supabase.from('preset_teams').update({ 
        name: editingTeam.name.trim(), 
        department: editingTeam.department?.trim() || null,
        members 
      }).eq('id', id);
      if (error) throw error;
      setEditingTeam(null);
      setEditTeamMembersText('');
      fetchTeams();
      showCustomAlert('성공', 'Team 정보가 수정되었습니다.');
    } catch (err: any) { showCustomAlert('오류', `Team 수정 실패: ${err.message}`); }
  }, [isAdmin, editingTeam, editTeamMembersText, fetchTeams, showCustomAlert]);

  const handleDeleteTeam = useCallback(async (id: string) => {
    if (!isAdmin) { showCustomAlert('권한 없음', '관리자 권한이 없습니다.'); return; }
    showCustomConfirm('Team 삭제', '해당 Team을 정말 삭제하시겠습니까?', async () => {
      try {
        const { error } = await supabase.from('preset_teams').delete().eq('id', id);
        if (error) throw error;
        fetchTeams();
        showCustomAlert('완료', 'Team이 삭제되었습니다.');
      } catch (err: any) { showCustomAlert('오류', `Team 삭제 실패: ${err.message}`); }
    });
  }, [isAdmin, showCustomConfirm, fetchTeams, showCustomAlert]);

  const handleSelectDepartmentUsersToNewTeam = useCallback((dept: string) => {
    setNewTeamDept(dept);
    const deptMembers = appUsers.filter(u => u.department === dept).map(u => u.name.trim()).filter(Boolean);
    setNewTeamMembersText(deptMembers.join(', '));
  }, [appUsers]);

  const handleCallWorker = useCallback((workerName: string) => {
    const worker = appUsers.find((u) => u.name?.trim().toLowerCase() === workerName.trim().toLowerCase());
    const phone = worker?.phone?.trim();
    if (!phone) {
      showCustomAlert('전화 연결', `${workerName}님의 전화번호가 등록되어 있지 않습니다.`);
      return;
    }
    showCustomConfirm('전화 연결', `${workerName}님에게 전화 연결 하시겠습니까?`, () => {
      window.location.href = `tel:${phone.replace(/[^0-9+]/g, '')}`;
    });
  }, [appUsers, showCustomAlert, showCustomConfirm]);

  const handleNextStatus = useCallback((e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    setStatusChangeModal({
      open: true,
      task: task,
      targetStatus: task.status,
      remarks: task.remarks || ''
    });
  }, []);

  const handleConfirmStatusChange = useCallback(async () => {
    if (!statusChangeModal.task) return;
    const task = statusChangeModal.task;
    const nextStatus = statusChangeModal.targetStatus;
    const remarks = statusChangeModal.remarks;
    const isCompletedHistory = task.status === 'COMPLETED' && task.completion_pending_review !== true;

    if (!canModifyTaskStatus(task)) {
      showCustomAlert('권한 없음', '해당 업무의 당사자 또는 관리자만 변경할 수 있습니다.');
      return;
    }

    if (isCompletedHistory) {
      const previousRemarks = task.remarks || '';
      const nextRemarks = remarks || '';
      if (previousRemarks === nextRemarks) {
        setStatusChangeModal({ open: false, task: null, targetStatus: 'PENDING', remarks: '' });
        return;
      }

      try {
        const remarksEditedAt = new Date().toISOString();
        const { data, error } = await supabase.from('tasks').update({
          remarks: nextRemarks,
          remarks_edited_at: remarksEditedAt,
        }).eq('id', task.id).eq('status', 'COMPLETED')
          .select('id, remarks_edited_at')
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('저장된 업무를 확인할 수 없습니다. 권한 또는 완료 상태를 확인해 주세요.');

        setTasks(prev => prev.map(item => item.id === task.id
          ? { ...item, remarks: nextRemarks, remarks_edited_at: data.remarks_edited_at || remarksEditedAt }
          : item));
        setSelectedTaskForSheet(prev => prev?.id === task.id
          ? { ...prev, remarks: nextRemarks, remarks_edited_at: data.remarks_edited_at || remarksEditedAt }
          : prev);
        setStatusChangeModal({ open: false, task: null, targetStatus: 'PENDING', remarks: '' });
        showCustomAlert('저장 완료', '비고가 수정되었습니다. 완료이력은 그대로 유지됩니다.');
      } catch (err: any) {
        showCustomAlert('오류', `비고 수정 실패: ${err.message}`);
      }
      return;
    }

    if (task.task_type === 'DAILY' && nextStatus === 'COMPLETED') {
      try {
        const { error } = await supabase.from('tasks').update({
          status: 'COMPLETED',
          remarks,
          completion_pending_review: true,
          completed_by_id: null,
          completed_by_name: null,
          completed_at: null,
        }).eq('id', task.id);
        if (error) throw error;
        setStatusChangeModal({ open: false, task: null, targetStatus: 'PENDING', remarks: '' });
        setSelectedTaskForSheet(null);
        setSelectedTaskIds([]);
        await fetchTasks();
        showCustomAlert('완료 확인 대기', '업무가 완료 상태로 저장되었습니다. 관리자 확인 후 완료 이력으로 이동됩니다.');
      } catch (err: any) {
        showCustomAlert('오류', `완료 상태 저장 실패: ${err.message}`);
      }
      return;
    }

    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus, remarks, completion_pending_review: false } : t)));
    if (selectedTaskForSheet?.id === task.id) {
      setSelectedTaskForSheet({ ...selectedTaskForSheet, status: nextStatus, remarks, completion_pending_review: false });
    }

    try {
      const { error } = await supabase.from('tasks').update({
        status: nextStatus,
        remarks,
        ...(task.task_type === 'DAILY' ? { completion_pending_review: false } : {}),
      }).eq('id', task.id);
      if (error) throw error;
      setStatusChangeModal({ open: false, task: null, targetStatus: 'PENDING', remarks: '' });
      fetchTasks();
      showCustomAlert('성공', '업무 상태 및 비고란이 업데이트 되었습니다.');
    } catch (err: any) {
      showCustomAlert('오류', `상태 변경 실패: ${err.message}`);
    }
  }, [statusChangeModal, selectedTaskForSheet, canModifyTaskStatus, fetchTasks, showCustomAlert]);

  const renderStatusBadge = useCallback((task: Task) => {
    const statusConfig = {
      PENDING: { label: '대기', bg: 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200', icon: AlertCircle },
      IN_PROGRESS: { label: '진행중', bg: 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600 shadow-xs', icon: PlayCircle },
      COMPLETED: { label: '완료', bg: 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300', icon: CheckCircle2 },
    };
    const config = statusConfig[task.status] || statusConfig.PENDING;
    const Icon = config.icon;

    if (task.task_type === 'DAILY_OTHER') {
      return (
        <span className={`px-1.5 py-0.5 rounded-full border text-[9px] font-bold flex items-center gap-0.5 shrink-0 ${config.bg}`}>
          <Icon className="h-2.5 w-2.5" />
          <span>{config.label}</span>
        </span>
      );
    }

    return (
      <button
        onClick={(e) => handleNextStatus(e, task)}
        title="클릭 시 상태 및 비고란 변경 모달 호출"
        className={`px-1.5 py-0.5 rounded-full border text-[9px] font-bold flex items-center gap-0.5 transition-all shrink-0 ${config.bg}`}
      >
        <Icon className="h-2.5 w-2.5" />
        <span>{config.label}</span>
      </button>
    );
  }, [handleNextStatus]);

  const handleOpenCreateModal = useCallback((defaultDate?: string, defaultType?: 'DAILY' | 'DAILY_OTHER' | 'WEEKLY' | 'CABIN', defaultCategory?: string) => {
    const requestedType = defaultType || (taskTab === 'VEHICLE' ? 'DAILY' : taskTab);
    if (!isAdmin && requestedType !== 'DAILY_OTHER') { showCustomAlert('권한 제한', '관리자만 해당 업무를 등록할 수 있습니다.'); return; }
    if (requestedType === 'DAILY_OTHER' && !currentUser?.name) { showCustomAlert('등록 제한', '로그인 사용자 정보를 확인할 수 없습니다. 다시 로그인해 주세요.'); return; }
    setEditingTask(null);
    setFormData({
      title: '',
      description: '',
      start_date: defaultDate || formatDateToYYYYMMDD(new Date()),
      end_date: defaultDate || formatDateToYYYYMMDD(new Date()),
      time_slot: '오전(08:00~12:00)',
      task_type: requestedType,
      category: defaultCategory || (vessels.length > 0 ? vessels[0].name : ''),
      cargo_hold: '',
    });
    setAssignedList(requestedType === 'DAILY_OTHER' && currentUser?.name ? [currentUser.name] : []);
    setDayWorkerList([]);
    setNightWorkerList([]);
    setSingleWorkerInput('');
    setIsQuickVesselInputOpen(false);
    setQuickVesselName('');
    setIsModalOpen(true);
  }, [isAdmin, taskTab, vessels, currentUser, showCustomAlert]);

  const handleOpenTaskEdit = useCallback((task: Task) => {
    if (!canManageTask(task)) { showCustomAlert('권한 제한', '야간업무진행는 작성자 본인과 관리자만 수정할 수 있습니다.'); return; }
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      start_date: task.start_date,
      end_date: task.end_date || task.start_date,
      time_slot: task.time_slot || '오전(08:00~12:00)',
      task_type: task.task_type || 'CABIN',
      category: task.category || (vessels.length > 0 ? vessels[0].name : ''),
      cargo_hold: task.cargo_hold || '',
    });
    setAssignedList(task.assigned_names || []);
    setDayWorkerList(task.day_workers || []);
    setNightWorkerList(task.night_workers || []);
    setSingleWorkerInput('');
    setIsQuickVesselInputOpen(false);
    setQuickVesselName('');
    setIsModalOpen(true);
  }, [canManageTask, vessels, showCustomAlert]);

  const handleAddWorkerSingle = useCallback((target: 'ASSIGNED' | 'DAY' | 'NIGHT') => {
    if (!singleWorkerInput.trim()) return;
    const name = singleWorkerInput.trim();
    
    const foundUser = appUsers.find(u => u.name?.trim().toLowerCase() === name.toLowerCase());
    if (foundUser && foundUser.work_status === '휴무') {
      showCustomAlert('업무 등록 제한', `${foundUser.name} 휴무입니다.`);
      return;
    }

    if (formData.task_type === 'DAILY' && target === 'ASSIGNED') {
      for (const t of tasks) {
        if (t.task_type === 'CABIN' && t.status !== 'COMPLETED') {
          const isDay = (t.day_workers || []).some(w => w.trim().toLowerCase() === name.toLowerCase());
          const isNight = (t.night_workers || []).some(w => w.trim().toLowerCase() === name.toLowerCase());
          if (isDay) {
            showCustomAlert('업무 등록 제한', `Cabin 주간 근무 입니다`);
            return;
          }
          if (isNight) {
            showCustomAlert('업무 등록 제한', `Cabin 야간 근무 입니다`);
            return;
          }
        }
      }
    }

    if (target === 'ASSIGNED' && !assignedList.includes(name)) setAssignedList([...assignedList, name]);
    if (target === 'DAY' && !dayWorkerList.includes(name)) setDayWorkerList([...dayWorkerList, name]);
    if (target === 'NIGHT' && !nightWorkerList.includes(name)) setNightWorkerList([...nightWorkerList, name]);
    setSingleWorkerInput('');
  }, [singleWorkerInput, assignedList, dayWorkerList, nightWorkerList, appUsers, showCustomAlert, formData.task_type, tasks]);

  const handleRemoveWorker = useCallback((name: string, target: 'ASSIGNED' | 'DAY' | 'NIGHT') => {
    if (target === 'ASSIGNED') setAssignedList(assignedList.filter(n => n !== name));
    if (target === 'DAY') setDayWorkerList(dayWorkerList.filter(n => n !== name));
    if (target === 'NIGHT') setNightWorkerList(nightWorkerList.filter(n => n !== name));
  }, [assignedList, dayWorkerList, nightWorkerList]);

  const handleSubmitTask = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const isDailyOther = formData.task_type === 'DAILY_OTHER';
    if (editingTask) {
      if (!canManageTask(editingTask)) { showCustomAlert('권한 제한', '야간업무진행는 작성자 본인과 관리자만 수정할 수 있습니다.'); return; }
    } else if (!isAdmin && !isDailyOther) {
      showCustomAlert('권한 제한', '관리자 권한이 없습니다.'); return;
    }
    if (isDailyOther && !currentUser?.name) { showCustomAlert('등록 제한', '로그인 사용자 정보를 확인할 수 없습니다. 다시 로그인해 주세요.'); return; }
    if (!formData.title.trim()) { showCustomAlert('입력 확인', '업무명을 입력해 주세요.'); return; }

    const workersToCheck = formData.task_type === 'CABIN'
      ? [...dayWorkerList, ...nightWorkerList]
      : isDailyOther
        ? [editingTask?.created_by_name || currentUser?.name || '']
        : assignedList;

    for (const wName of workersToCheck) {
      const u = appUsers.find(user => user.name?.trim().toLowerCase() === wName.trim().toLowerCase());
      if (u && u.work_status === '휴무') {
        showCustomAlert('업무 등록 제한', `${u.name} 휴무입니다.`);
        return;
      }
      
      if (formData.task_type === 'DAILY') {
        for (const t of tasks) {
          if (t.task_type === 'CABIN' && t.status !== 'COMPLETED' && (!editingTask || t.id !== editingTask.id)) {
            const isDay = (t.day_workers || []).some(w => w.trim().toLowerCase() === wName.toLowerCase());
            const isNight = (t.night_workers || []).some(w => w.trim().toLowerCase() === wName.toLowerCase());
            if (isDay) {
              showCustomAlert('업무 등록 제한', `Cabin 주간 근무 입니다`);
              return;
            }
            if (isNight) {
              showCustomAlert('업무 등록 제한', `Cabin 야간 근무 입니다`);
              return;
            }
          }
        }
      }
    }

    let payload: any = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      start_date: formData.start_date,
      task_type: formData.task_type,
      status: editingTask ? editingTask.status : 'PENDING',
      category: formData.category || null,
      cargo_hold: formData.cargo_hold || null,
      ...(isDailyOther && !editingTask ? { created_by_id: currentUser?.id || null, created_by_name: currentUser?.name || null } : {}),
    };

    if (formData.task_type === 'CABIN') {
      payload = {
        ...payload,
        end_date: formData.end_date,
        day_workers: dayWorkerList,
        night_workers: nightWorkerList,
        time_slot: null,
        assigned_names: null,
      };
    } else {
      payload = {
        ...payload,
        end_date: formData.start_date,
        time_slot: formData.time_slot.trim(),
        assigned_names: isDailyOther ? [editingTask?.created_by_name || currentUser?.name || ''] : assignedList,
        day_workers: null,
        night_workers: null,
      };
    }

    try {
      if (editingTask) {
        if (editingTask.task_type === 'DAILY_OTHER') {
          delete payload.created_by_id;
          delete payload.created_by_name;
        }
        const { error } = await supabase.from('tasks').update(payload).eq('id', editingTask.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tasks').insert([payload]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      setSelectedTaskForSheet(null);
      fetchTasks();
      showCustomAlert('성공', '업무가 정상적으로 저장되었습니다.');
    } catch (err: any) { showCustomAlert('오류', `저장 중 오류: ${err.message}`); }
  }, [isAdmin, canManageTask, currentUser, formData, editingTask, dayWorkerList, nightWorkerList, assignedList, appUsers, tasks, fetchTasks, showCustomAlert]);

  const handleFinalizeDailyTask = useCallback((task: Task) => {
    if (!isAdmin) { showCustomAlert('권한 제한', '관리자만 최종 완료 처리할 수 있습니다.'); return; }
    if (task.task_type !== 'DAILY' || task.status !== 'COMPLETED' || !task.completion_pending_review) return;

    showCustomConfirm('업무 최종 완료', '업무 내용을 확인하셨습니까? 최종 완료 처리하면 완료이력에 기록됩니다. 현재 화면은 유지됩니다.', async () => {
      try {
        const { error } = await supabase.from('tasks').update({
          status: 'COMPLETED',
          completion_pending_review: false,
          completed_by_id: currentUser?.id || null,
          completed_by_name: currentUser?.name || null,
          completed_at: new Date().toISOString(),
        }).eq('id', task.id).eq('completion_pending_review', true);
        if (error) throw error;
        setSelectedTaskForSheet(null);
        setSelectedTaskIds([]);
        await fetchTasks();
        showCustomAlert('완료', '관리자 최종 확인이 완료되었습니다. 완료이력 탭에서 확인할 수 있습니다.');
      } catch (err: any) {
        showCustomAlert('오류', `최종 완료 처리 실패: ${err.message}`);
      }
    });
  }, [isAdmin, currentUser, showCustomAlert, showCustomConfirm, fetchTasks]);

  const handleCompleteOtherTask = useCallback((task: Task) => {
    if (task.task_type !== 'DAILY_OTHER' || task.status === 'COMPLETED') return;
    if (!isAdmin) { showCustomAlert('권한 제한', '야간업무진행 완료 처리는 관리자만 가능합니다.'); return; }
    showCustomConfirm('업무 완료', '이 업무를 완료 처리하시겠습니까? 완료이력에 기록되며 현재 화면은 유지됩니다.', async () => {
      try {
        const { error } = await supabase.from('tasks').update({
          status: 'COMPLETED',
          completed_by_id: currentUser?.id || null,
          completed_by_name: currentUser?.name || null,
          completed_at: new Date().toISOString(),
          completion_pending_review: false
        }).eq('id', task.id);
        if (error) throw error;
        setSelectedTaskForSheet(null);
        setSelectedTaskIds([]);
        await fetchTasks();
        showCustomAlert('완료', '야간업무진행가 완료 처리되었습니다. 완료이력 탭에서 확인할 수 있습니다.');
      } catch (err: any) {
        showCustomAlert('오류', `완료 처리 실패: ${err.message}`);
      }
    });
  }, [isAdmin, currentUser, showCustomAlert, showCustomConfirm, fetchTasks]);

  const handleDeleteTask = useCallback(async (id: string) => {
    const targetTask = tasks.find((task) => task.id === id);
    if (!targetTask || !canManageTask(targetTask)) { showCustomAlert('권한 제한', '야간업무진행는 작성자 본인과 관리자만 삭제할 수 있습니다.'); return; }
    showCustomConfirm('업무 삭제', '해당 항목을 정말로 삭제하시겠습니까?', async () => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (!error) {
        setSelectedTaskForSheet(null);
        setSelectedTaskIds((prev) => prev.filter((selectedId) => selectedId !== id));
        fetchTasks();
        showCustomAlert('삭제 완료', '성공적으로 삭제되었습니다.');
      } else {
        showCustomAlert('오류', `삭제 실패: ${error.message}`);
      }
    });
  }, [tasks, canManageTask, showCustomConfirm, fetchTasks, showCustomAlert]);

  const handleImportWeeklyToDaily = useCallback(async () => {
    if (!isAdmin) {
      showCustomAlert('권한 제한', '관리자만 주간업무를 일일업무로 불러올 수 있습니다.');
      return;
    }
    if (selectedWeeklyIdsToImport.length === 0) {
      showCustomAlert('선택 확인', '불러올 주간업무를 선택해 주세요.');
      return;
    }
    try {
      const targetWeeklyTasks = tasks.filter(t => selectedWeeklyIdsToImport.includes(t.id));
      const newDailyInserts = targetWeeklyTasks.map(wt => ({
        title: wt.title,
        description: wt.description || '',
        start_date: importTargetDate,
        end_date: importTargetDate,
        time_slot: wt.time_slot || '오전(08:00~12:00)',
        task_type: 'DAILY',
        status: 'PENDING',
        assigned_names: wt.assigned_names || [],
        category: wt.category || null,
        cargo_hold: wt.cargo_hold || null,
      }));

      const { error } = await supabase.from('tasks').insert(newDailyInserts);
      if (error) throw error;
      setIsWeeklyImportModalOpen(false);
      setSelectedWeeklyIdsToImport([]);
      setTaskTab('DAILY');
      setDailySubTab('ACTIVE');
      fetchTasks();
      showCustomAlert('성공', `${importTargetDate} 일자로 선택한 주간업무가 일일업무로 등록되었습니다.`);
    } catch (err: any) {
      showCustomAlert('오류', `불러오기 실패: ${err.message}`);
    }
  }, [isAdmin, selectedWeeklyIdsToImport, tasks, importTargetDate, fetchTasks, showCustomAlert]);

  const handleExportDailyHistoryExcel = useCallback(async () => {
    if (!isAdmin) { showCustomAlert('권한 제한', '관리자만 엑셀 다운로드를 할 수 있습니다.'); return; }
    const historyTasks = tasks.filter((task) => (task.task_type === 'DAILY' || task.task_type === 'DAILY_OTHER') && task.status === 'COMPLETED');
    const selectedHistory = historyTasks.filter((task) => selectedTaskIds.includes(task.id));
    const exportTasks = selectedHistory.length > 0 ? selectedHistory : historyTasks;
    if (exportTasks.length === 0) { showCustomAlert('내보내기', '출력할 완료 이력이 없습니다.'); return; }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('일일업무 완료이력');
    worksheet.columns = [
      { header: '일자', key: 'date', width: 15 },
      { header: '호선', key: 'vessel', width: 15 },
      { header: '화물창', key: 'cargo_hold', width: 12 },
      { header: '업무명', key: 'title', width: 28 },
      { header: '시간대', key: 'time_slot', width: 20 },
      { header: '인원', key: 'names', width: 25 },
      { header: '완료 비고란', key: 'remarks', width: 35 },
    ];
    worksheet.mergeCells('A1:G1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = '일일업무 완료이력';
    titleCell.font = { name: 'HY헤드라인 M', size: 24, bold: true };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 42;
    worksheet.addRow([]);
    worksheet.addRow(worksheet.columns.map((column) => String(column.header || '')));
    worksheet.addRows(exportTasks.map((task) => ({
      date: task.start_date || '',
      vessel: task.category || '',
      cargo_hold: task.cargo_hold || '',
      title: task.title || '',
      time_slot: task.time_slot || '',
      names: (task.assigned_names || []).join(', '),
      remarks: task.remarks || '',
    })));
    worksheet.views = [{ state: 'frozen', ySplit: 3 }];
    worksheet.getRow(3).height = 28;
    worksheet.getRow(3).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF243B5A' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `일일업무_완료이력_${new Date().toISOString().slice(0, 10)}.xlsx`;
    anchor.click();
    URL.revokeObjectURL(url);
    showCustomAlert('엑셀 다운로드', '완료 이력을 엑셀로 내보냈습니다.');
  }, [isAdmin, tasks, selectedTaskIds, showCustomAlert]);

  const handleExportWeeklyExcel = useCallback(async (showMessage = true) => {
    if (!isAdmin) { showCustomAlert('권한 제한', '관리자만 엑셀 다운로드를 할 수 있습니다.'); return; }
    const [yearStr, monthStr] = selectedExportMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);
    const monthlyWeeklyTasks = tasks.filter((task) => {
      if (task.task_type !== 'WEEKLY') return false;
      const date = new Date(`${task.start_date}T00:00:00`);
      return date.getFullYear() === year && date.getMonth() + 1 === month;
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${month}월 업무 달력`);
    worksheet.columns = Array.from({ length: 7 }, () => ({ width: 25 }));
    worksheet.mergeCells('A1:G1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `${year}년 ${month}월 업무 달력`;
    titleCell.font = { name: 'HY헤드라인M', size: 20, bold: false };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 36;

    const weekdayNames = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];
    const weekdayRow = worksheet.addRow(weekdayNames);
    weekdayRow.height = 17.25;
    weekdayRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, color: { argb: colNumber === 6 ? 'FF2563EB' : colNumber === 7 ? 'FFDC2626' : 'FF1F2937' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
    });

    const firstMonday = getMonday(firstDayOfMonth);
    const lastCalendarDay = new Date(lastDayOfMonth);
    const calendarEnd = getMonday(lastCalendarDay);
    calendarEnd.setDate(calendarEnd.getDate() + 6);
    let cursor = new Date(firstMonday);

    while (cursor <= calendarEnd) {
      const dateRow = worksheet.addRow([]);
      const taskRow = worksheet.addRow([]);
      dateRow.height = 23.25;
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const day = new Date(cursor);
        day.setDate(cursor.getDate() + dayIndex);
        const col = dayIndex + 1;
        const inMonth = day.getMonth() + 1 === month;
        const dateCell = dateRow.getCell(col);
        dateCell.value = inMonth ? `${day.getDate()}일` : `(${day.getDate()}일)`;
        dateCell.font = { bold: true, color: { argb: dayIndex === 5 ? 'FF2563EB' : dayIndex === 6 ? 'FFDC2626' : inMonth ? 'FF1F2937' : 'FF9CA3AF' } };
        
        const dateStr = formatDateToYYYYMMDD(day);
        const dayTasks = inMonth ? monthlyWeeklyTasks.filter((task) => task.start_date === dateStr) : [];
        const lines = dayTasks.map((task, index) => {
          const vesselInfo = task.category ? `[${task.category}${task.cargo_hold ? `/${task.cargo_hold}` : ''}] ` : '';
          const names = task.assigned_names?.length ? ` (${task.assigned_names.join(', ')})` : '';
          return `${index + 1}. ${vesselInfo}${task.title}${names}`;
        });
        const taskCell = taskRow.getCell(col);
        taskCell.value = lines.join('\n');
      }
      cursor.setDate(cursor.getDate() + 7);
    }
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `주간업무_달력_${year}_${month}월.xlsx`;
    anchor.click();
    URL.revokeObjectURL(url);
    if (showMessage) showCustomAlert('엑셀 다운로드', `${year}년 ${month}월 업무 달력이 엑셀 파일로 추출되었습니다.`);
  }, [isAdmin, selectedExportMonth, tasks, showCustomAlert]);

  const handleRequestMonthlyWeeklyDelete = useCallback(() => {
    if (!isAdmin) { showCustomAlert('권한 제한', '관리자만 업무를 삭제할 수 있습니다.'); return; }
    if (!/^\d{4}-\d{2}$/.test(selectedExportMonth)) {
      showCustomAlert('월 선택', '삭제할 월을 먼저 선택해 주세요.');
      return;
    }
    const [year, month] = selectedExportMonth.split('-').map(Number);
    setCustomAlert({
      open: true,
      title: '월간 주간업무 삭제',
      message: `${month}월의 업무를 삭제 하시겠습니까? 월간 업무를 내려받기 하신후 삭제 권장합니다.`,
      type: 'monthlyDelete',
      onDownload: () => { void handleExportWeeklyExcel(false); },
      onConfirm: async () => {
        try {
          const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
          const nextMonthStart = `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}-01`;
          const { error } = await supabase.from('tasks').delete()
            .eq('task_type', 'WEEKLY')
            .gte('start_date', monthStart)
            .lt('start_date', nextMonthStart);
          if (error) throw error;
          setSelectedTaskIds([]);
          await fetchTasks();
          showCustomAlert('삭제 완료', `${year}년 ${month}월 주간업무가 삭제되었습니다.`);
        } catch (err: any) {
          showCustomAlert('오류', `월간 업무 삭제 실패: ${err.message}`);
        }
      }
    });
  }, [isAdmin, selectedExportMonth, showCustomAlert, handleExportWeeklyExcel, fetchTasks]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(currentWeekMonday);
      day.setDate(currentWeekMonday.getDate() + i);
      const dateStr = formatDateToYYYYMMDD(day);
      const dayNames = ['월', '화', '수', '목', '금', '토', '일'];
      return {
        label: `${dayNames[i]}요일`,
        dateStr: dateStr,
        displayDate: `${day.getMonth() + 1}/${day.getDate()}`,
        isToday: dateStr === formatDateToYYYYMMDD(new Date()),
      };
    });
  }, [currentWeekMonday]);

  const changeWeek = useCallback((direction: 'prev' | 'next') => {
    const newMonday = new Date(currentWeekMonday);
    newMonday.setDate(currentWeekMonday.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeekMonday(newMonday);
    setSelectedTaskIds([]);
  }, [currentWeekMonday]);

  const filteredTasks = useMemo(() => {
    const list = tasks.filter((t) => {
      if (taskTab === 'DAILY') {
        const isDailyType = t.task_type === 'DAILY' || t.task_type === 'DAILY_OTHER';
        if (!isDailyType) return false;
        if (dailySubTab === 'ACTIVE') {
          if (!(t.task_type === 'DAILY' && (t.status !== 'COMPLETED' || t.completion_pending_review === true))) return false;
          const todayDate = new Date();
          const today = formatDateToYYYYMMDD(todayDate);
          const tomorrowDate = new Date(todayDate);
          tomorrowDate.setDate(tomorrowDate.getDate() + 1);
          const tomorrow = formatDateToYYYYMMDD(tomorrowDate);
          if (!t.start_date || t.start_date < today) return false;
          if (tableFilterDate === 'ALL' && t.start_date > tomorrow) return false;
        } else if (dailySubTab === 'OTHER') {
          if (!(t.task_type === 'DAILY_OTHER' && t.status !== 'COMPLETED')) return false;
          const todayDate = new Date();
          const today = formatDateToYYYYMMDD(todayDate);
          const tomorrowDate = new Date(todayDate);
          tomorrowDate.setDate(tomorrowDate.getDate() + 1);
          const tomorrow = formatDateToYYYYMMDD(tomorrowDate);
          if (!t.start_date || t.start_date < today) return false;
          if (tableFilterDate === 'ALL' && t.start_date > tomorrow) return false;
        } else if (dailySubTab === 'HISTORY') {
          if (!(t.status === 'COMPLETED' && t.completion_pending_review !== true)) return false;
        }
      } else if (taskTab === 'WEEKLY') {
        if ((t.task_type || 'CABIN') !== taskTab) return false;
        const weekStart = formatDateToYYYYMMDD(currentWeekMonday);
        const weekEndDate = new Date(currentWeekMonday);
        weekEndDate.setDate(weekEndDate.getDate() + 6);
        const weekEnd = formatDateToYYYYMMDD(weekEndDate);
        if (t.start_date < weekStart || t.start_date > weekEnd) return false;
      } else if (taskTab === 'CABIN') {
        if ((t.task_type || 'CABIN') !== taskTab) return false;
        if (cabinSubTab !== 'ALL' && t.category !== cabinSubTab) return false;
        if (cabinStatusSubTab === 'ACTIVE' && t.status === 'COMPLETED') return false;
        if (cabinStatusSubTab === 'HISTORY' && t.status !== 'COMPLETED') return false;
      } else if (taskTab === 'VEHICLE') {
        return false;
      }

      if (tableFilterVessel !== 'ALL' && t.category !== tableFilterVessel) return false;
      if (tableFilterCargoHold !== 'ALL' && t.cargo_hold !== tableFilterCargoHold) return false;
      if (!(taskTab === 'DAILY' && dailySubTab === 'HISTORY') && tableFilterDate !== 'ALL' && t.start_date !== tableFilterDate) return false;
      if (tableFilterTimeSlot !== 'ALL') {
        const shortSlot = formatShortTimeSlot(t.time_slot);
        if (shortSlot !== tableFilterTimeSlot) return false;
      }
      if (tableFilterStatus !== 'ALL' && t.status !== tableFilterStatus) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchVessel = (t.category || '').toLowerCase().includes(q);
        const matchHold = (t.cargo_hold || '').toLowerCase().includes(q);
        const matchDate = (t.start_date || '').toLowerCase().includes(q);
        const matchTime = (t.time_slot || '').toLowerCase().includes(q);
        const matchTitle = (t.title || '').toLowerCase().includes(q);
        const matchWorkers = (t.assigned_names || []).some(n => n.toLowerCase().includes(q));
        if (!matchVessel && !matchHold && !matchDate && !matchTime && !matchTitle && !matchWorkers) return false;
      }

      return true;
    });

    const getTimeSlotOrder = (slot?: string) => {
      if (!slot) return 3;
      if (slot.includes('오전')) return 1;
      if (slot.includes('오후')) return 2;
      if (slot.includes('종일')) return 3;
      return 4;
    };

    if (taskTab === 'DAILY' && dailySubTab === 'HISTORY') {
      return [...list].sort((a, b) => (b.start_date || '').localeCompare(a.start_date || '') || (b.completed_at || '').localeCompare(a.completed_at || ''));
    }

    return [...list].sort((a, b) => {
      if (taskTab === 'DAILY') {
        const dateCompare = (a.start_date || '').localeCompare(b.start_date || '');
        if (dateCompare !== 0) return dateCompare;
      }
      const orderA = getTimeSlotOrder(a.time_slot);
      const orderB = getTimeSlotOrder(b.time_slot);
      if (orderA !== orderB) return orderA - orderB;
      return (a.start_date || '').localeCompare(b.start_date || '');
    });
  }, [tasks, taskTab, dailySubTab, cabinSubTab, cabinStatusSubTab, currentWeekMonday, tableFilterVessel, tableFilterCargoHold, tableFilterDate, tableFilterTimeSlot, tableFilterStatus, searchQuery]);

  const toggleTaskSelection = useCallback((id: string, checked: boolean) => {
    setSelectedTaskIds((prev) => checked ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((item) => item !== id));
  }, []);

  const handleSelectAllVisible = useCallback((checked: boolean) => {
    setSelectedTaskIds((prev) => {
      const visibleIds = filteredTasks.map((task) => task.id);
      if (!checked) return prev.filter((id) => !visibleIds.includes(id));
      return Array.from(new Set([...prev, ...visibleIds]));
    });
  }, [filteredTasks]);

  const handleBulkDeleteTasks = useCallback(async () => {
    if (!isAdmin) { showCustomAlert('권한 제한', '관리자만 업무를 삭제할 수 있습니다.'); return; }
    const ids = selectedTaskIds.filter((id) => filteredTasks.some((task) => task.id === id));
    if (ids.length === 0) { showCustomAlert('선택 항목 없음', '삭제할 업무를 먼저 선택해 주세요.'); return; }
    showCustomConfirm('일괄 삭제', `선택한 ${ids.length}개 업무를 삭제하시겠습니까?`, async () => {
      const { error } = await supabase.from('tasks').delete().in('id', ids);
      if (error) {
        showCustomAlert('오류', `일괄 삭제 실패: ${error.message}`);
        return;
      }
      setSelectedTaskIds((prev) => prev.filter((id) => !ids.includes(id)));
      setSelectedTaskForSheet((prev) => prev && ids.includes(prev.id) ? null : prev);
      await fetchTasks();
      showCustomAlert('삭제 완료', `선택한 ${ids.length}개 업무가 삭제되었습니다.`);
    });
  }, [isAdmin, selectedTaskIds, filteredTasks, showCustomAlert, showCustomConfirm, fetchTasks]);

  return (
    <div className="bg-[#F5F6F8] min-h-screen w-full text-[#1F2937] p-0 m-0">
      <div className="w-full bg-white border-b border-[#E2E5E9] p-2.5 sm:p-4 space-y-3">
        
        {/* Header */}
        <div className="flex flex-col gap-2.5 pb-2.5 border-b border-[#E2E5E9]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-[#243B5A]/10 text-[#243B5A] rounded-lg shrink-0">
                <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold">운영 및 근무 관리 시스템</h2>
                <p className="text-[11px] sm:text-xs text-[#64748B]">일일, 주간, CABIN 및 차량 운영 관리</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {isAdmin && taskTab === 'DAILY' && dailySubTab === 'ACTIVE' && (
                <button
                  onClick={() => {
                    setImportTargetDate(formatDateToYYYYMMDD(new Date()));
                    setIsWeeklyImportModalOpen(true);
                  }}
                  className="flex items-center space-x-1 bg-blue-50 text-[#2563EB] border border-blue-200 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg text-xs font-semibold shadow-2xs shrink-0 hover:bg-blue-100 transition"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>주간불러오기</span>
                </button>
              )}

              {(isAdmin || (taskTab === 'DAILY' && dailySubTab === 'OTHER')) && taskTab !== 'VEHICLE' && (
                <button
                  onClick={() => handleOpenCreateModal(undefined, taskTab === 'DAILY' && dailySubTab === 'OTHER' ? 'DAILY_OTHER' : undefined)}
                  className="flex items-center space-x-1 bg-[#243B5A] text-white px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg text-xs font-semibold shadow-xs shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{taskTab === 'DAILY' && dailySubTab === 'OTHER' ? '야간등록' : '등록'}</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 pt-0.5">
            <button
              onClick={() => {
                const pending = tasks.filter(t => t.status !== 'COMPLETED' && t.task_type !== 'DAILY_OTHER');
                setMyAssignedTasks(pending);
                setIsAlertOpen(true);
              }}
              className="col-span-2 sm:col-span-1 flex items-center justify-center space-x-1.5 bg-amber-50 text-amber-900 border border-amber-300 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-amber-100 transition h-8 shrink-0"
            >
              <Bell className="h-3.5 w-3.5 text-amber-600 animate-pulse shrink-0" />
              <span className="truncate">미완료 알림 ({myAssignedTasks.length})</span>
            </button>

            <div className="col-span-2 sm:col-span-auto bg-[#F5F6F8] p-1 rounded-lg border border-[#E2E5E9] grid grid-cols-4 gap-1 h-8 items-center shrink-0">
              <button
                onClick={() => { setTaskTab('DAILY'); setSelectedTaskIds([]); }}
                className={`px-2.5 py-0.5 text-xs font-semibold rounded-md text-center transition ${taskTab === 'DAILY' ? 'bg-[#243B5A] text-white shadow-2xs' : 'text-[#64748B] hover:text-[#1F2937]'}`}
              >
                일일업무
              </button>
              <button
                onClick={() => { setTaskTab('WEEKLY'); setSelectedTaskIds([]); }}
                className={`px-2.5 py-0.5 text-xs font-semibold rounded-md text-center transition ${taskTab === 'WEEKLY' ? 'bg-[#243B5A] text-white shadow-2xs' : 'text-[#64748B] hover:text-[#1F2937]'}`}
              >
                주간업무
              </button>
              <button
                onClick={() => { setTaskTab('CABIN'); setSelectedTaskIds([]); }}
                className={`px-2.5 py-0.5 text-xs font-semibold rounded-md flex items-center justify-center gap-1 transition ${taskTab === 'CABIN' ? 'bg-[#243B5A] text-white shadow-2xs' : 'text-[#64748B] hover:text-[#1F2937]'}`}
              >
                <Home className="h-3 w-3 shrink-0" />
                <span>CABIN</span>
              </button>
              <button
                onClick={() => { setTaskTab('VEHICLE'); setSelectedTaskIds([]); }}
                className={`px-2.5 py-0.5 text-xs font-semibold rounded-md flex items-center justify-center gap-1 transition ${taskTab === 'VEHICLE' ? 'bg-[#243B5A] text-white shadow-2xs' : 'text-[#64748B] hover:text-[#1F2937]'}`}
              >
                <span>차량</span>
              </button>
            </div>
          </div>
        </div>

        {/* 인원 현황 요약 배너 */}
        {taskTab !== 'VEHICLE' && (() => {
          const activeUsers = appUsers.filter(u => !isFormerEmployee(u));
          const workingUsers = activeUsers.filter(u => u.work_status !== '휴무');
          const offUsers = appUsers.filter(u => u.work_status === '휴무');
          
          const activeCabinTasks = tasks.filter(t => t.task_type === 'CABIN' && t.status !== 'COMPLETED');
          const cabinDayWorkers = Array.from(new Set(activeCabinTasks.flatMap(t => t.day_workers || [])));
          const cabinNightWorkers = Array.from(new Set(activeCabinTasks.flatMap(t => t.night_workers || [])));
          
          const cabinAllSet = new Set([...cabinDayWorkers, ...cabinNightWorkers].map(n => n.trim().toLowerCase()));
          const processWorkers = workingUsers.filter(u => !cabinAllSet.has((u.name || '').trim().toLowerCase()));

          return (
            <div className="bg-[#F8FAFC] border border-[#E2E5E9] rounded-xl p-2.5 space-y-2 text-xs shadow-2xs">
              <div className="flex items-center space-x-3 flex-wrap gap-y-1">
                <span className="font-bold text-[#243B5A] flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> 인원 현황:
                </span>
                <span>전체: <strong className="text-[#1F2937]">{activeUsers.length}명</strong></span>
                <span>근무중: <strong className="text-emerald-600">{workingUsers.length}명 (Cabin 주간: {cabinDayWorkers.length}명, Cabin 야간: {cabinNightWorkers.length}명, 공정: {processWorkers.length}명)</strong></span>
                <span>휴무: <strong className="text-blue-600">{offUsers.length}명</strong></span>
              </div>

              <div className="text-[11px] text-[#64748B] flex items-center gap-1 flex-wrap pt-0.5 border-t border-[#E2E5E9]">
                <span className="font-semibold text-[#1F2937]">휴무자 명단:</span>
                {offUsers.length > 0 ? (
                  <span className="text-blue-700 font-medium">{offUsers.map(u => u.name).join(', ')}</span>
                ) : (
                  <span>없음</span>
                )}
              </div>
            </div>
          );
        })()}

        {/* 차량 탭 서브탭 및 차량 등록 관리 */}
        {taskTab === 'VEHICLE' && (
          <div className="flex items-center justify-between bg-[#F5F6F8] p-1.5 rounded-xl border border-[#E2E5E9]">
            <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0 [&::-webkit-scrollbar]:h-1">
              <Tag className="h-3.5 w-3.5 text-[#64748B] ml-1 shrink-0" />
              <span className="text-xs font-bold text-[#1F2937] mr-1 shrink-0">차량:</span>
              <button
                onClick={() => setVehicleSubTab('ALL')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg shrink-0 ${vehicleSubTab === 'ALL' ? 'bg-white border text-[#243B5A] font-bold shadow-2xs' : 'text-[#64748B]'}`}
              >
                전체
              </button>
              {vehicles.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVehicleSubTab(v.vehicle_no)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg shrink-0 flex items-center gap-1 transition ${
                    vehicleSubTab === v.vehicle_no ? 'bg-[#243B5A] text-white font-bold shadow-2xs' : 'bg-white border text-[#243B5A] hover:bg-slate-100'
                  }`}
                >
                  <span>{v.vehicle_no}</span>
                </button>
              ))}
            </div>

            {isAdmin && (
              <button
                onClick={() => setIsVehicleManagerOpen(true)}
                className="flex items-center space-x-1 text-xs text-[#243B5A] font-semibold bg-white border px-2 py-1 rounded-lg shrink-0 hover:bg-slate-50 ml-1"
              >
                <Settings className="h-3 w-3" />
                <span className="hidden sm:inline">차량 등록/관리</span>
              </button>
            )}
          </div>
        )}

        {/* 일일 업무 서브탭 */}
        {taskTab === 'DAILY' && (
          <div className="flex items-center justify-between bg-[#F5F6F8] p-1 rounded-xl border border-[#E2E5E9] overflow-x-auto [&::-webkit-scrollbar]:h-1">
            <div className="flex space-x-1 shrink-0">
              <button
                onClick={() => { setDailySubTab('ACTIVE'); setSelectedTaskIds([]); }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 transition ${dailySubTab === 'ACTIVE' ? 'bg-white text-[#243B5A] font-bold shadow-2xs border' : 'text-[#64748B]'}`}
              >
                <Clock className="h-3 w-3" />
                <span>진행중/대기</span>
              </button>
              <button
                onClick={() => { setDailySubTab('OTHER'); setSelectedTaskIds([]); }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 transition ${dailySubTab === 'OTHER' ? 'bg-white text-[#243B5A] font-bold shadow-2xs border' : 'text-[#64748B]'}`}
              >
                <FileText className="h-3 w-3" />
                <span>야간진행</span>
              </button>
              <button
                onClick={() => { setDailySubTab('HISTORY'); setSelectedTaskIds([]); setTableFilterDate('ALL'); setActiveFilterDropdown(null); }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 transition ${dailySubTab === 'HISTORY' ? 'bg-white text-[#243B5A] font-bold shadow-2xs border' : 'text-[#64748B]'}`}
              >
                <History className="h-3 w-3" />
                <span>완료이력</span>
              </button>
            </div>
          </div>
        )}

        {/* CABIN 호선 서브탭 */}
        {taskTab === 'CABIN' && (
          <div className="flex items-center justify-between bg-[#F5F6F8] p-1.5 rounded-xl border border-[#E2E5E9]">
            <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0 [&::-webkit-scrollbar]:h-1">
              <Tag className="h-3.5 w-3.5 text-[#64748B] ml-1 shrink-0" />
              <span className="text-xs font-bold text-[#1F2937] mr-1 shrink-0">호선:</span>
              <button
                onClick={() => setCabinSubTab('ALL')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg shrink-0 ${cabinSubTab === 'ALL' ? 'bg-white border text-[#243B5A] font-bold shadow-2xs' : 'text-[#64748B]'}`}
              >
                전체
              </button>
              {vessels.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setCabinSubTab(v.name)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg shrink-0 flex items-center gap-1 transition ${
                    cabinSubTab === v.name ? 'bg-[#243B5A] text-white font-bold shadow-2xs' : 'bg-white border text-[#243B5A] hover:bg-slate-100'
                  }`}
                >
                  <span>{v.name}</span>
                </button>
              ))}
            </div>

            {isAdmin && (
              <button
                onClick={() => setIsVesselManagerOpen(true)}
                className="flex items-center space-x-1 text-xs text-[#243B5A] font-semibold bg-white border px-2 py-1 rounded-lg shrink-0 hover:bg-slate-50 ml-1"
              >
                <Settings className="h-3 w-3" />
                <span className="hidden sm:inline">관리</span>
              </button>
            )}
          </div>
        )}

        {taskTab === 'CABIN' && (
          <div className="flex items-center justify-between bg-[#F5F6F8] p-1 rounded-xl border border-[#E2E5E9] overflow-x-auto">
            <div className="flex space-x-1 shrink-0">
              <button onClick={() => { setCabinStatusSubTab('ACTIVE'); setSelectedTaskIds([]); }} className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 ${cabinStatusSubTab === 'ACTIVE' ? 'bg-white text-[#243B5A] font-bold shadow-2xs border' : 'text-[#64748B]'}`}><Clock className="h-3 w-3" /><span>대기/진행</span></button>
              <button onClick={() => { setCabinStatusSubTab('HISTORY'); setSelectedTaskIds([]); }} className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 ${cabinStatusSubTab === 'HISTORY' ? 'bg-white text-[#243B5A] font-bold shadow-2xs border' : 'text-[#64748B]'}`}><History className="h-3 w-3" /><span>완료이력</span></button>
            </div>
            {isAdmin && cabinSubTab !== 'ALL' && (
              <button onClick={() => handleOpenCreateModal(undefined, 'CABIN', cabinSubTab)} className="px-2.5 py-1 bg-[#243B5A] text-white rounded-lg text-xs font-semibold shrink-0 ml-1">
                등록
              </button>
            )}
          </div>
        )}

        {(taskTab === 'WEEKLY' || (taskTab === 'DAILY' && dailySubTab === 'HISTORY') || taskTab === 'CABIN') && isAdmin && (
          <div className="flex flex-wrap items-center gap-2 bg-white border border-[#E2E5E9] rounded-xl p-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-[#243B5A]">
              <input type="checkbox" checked={filteredTasks.length > 0 && filteredTasks.every((task) => selectedTaskIds.includes(task.id))} onChange={(e) => handleSelectAllVisible(e.target.checked)} className="accent-[#243B5A]" />
              전체 선택
            </label>
            <span className="text-xs text-[#64748B]">선택 {selectedTaskIds.filter((id) => filteredTasks.some((task) => task.id === id)).length}개</span>
            <button onClick={handleBulkDeleteTasks} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-600 border border-red-200 flex items-center gap-1"><Trash2 className="h-3 w-3" />삭제</button>
            {taskTab === 'DAILY' && dailySubTab === 'HISTORY' && <button onClick={handleExportDailyHistoryExcel} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 text-white flex items-center gap-1"><FileSpreadsheet className="h-3 w-3" />엑셀</button>}
          </div>
        )}

       {isLoading ? (
          <div className="text-center py-16 text-xs text-[#64748B]">로딩 중...</div>
        ) : taskTab === 'VEHICLE' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white p-3 rounded-xl border shadow-2xs">
              <div>
                <h3 className="text-sm font-bold text-[#243B5A]">차량 운영 및 사용 관리</h3>
                <p className="text-[11px] text-[#64748B]">등록된 차량을 선택하고 '차량 사용' 버튼을 통해 사용 신청을 할 수 있습니다. (작업용차량운전자 교육 이수자 필수)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(vehicleSubTab === 'ALL' ? vehicles : vehicles.filter(v => v.vehicle_no === vehicleSubTab)).map((v) => {
                const usages = vehicleUsages.filter(u => u.vehicle_no === v.vehicle_no);
                const isAllSelected = usages.length > 0 && usages.every(u => selectedVehicleUsageIds.includes(u.id));

                return (
                  <div key={v.id} className="bg-white border rounded-xl p-4 shadow-2xs space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b pb-2 mb-2">
                        <span className="font-bold text-sm text-[#243B5A]">🚗 차량번호: {v.vehicle_no}</span>
                        <button
                          onClick={() => handleOpenVehicleUsageModal(v.vehicle_no)}
                          className="px-3 py-1.5 bg-[#243B5A] text-white text-xs font-bold rounded-lg hover:bg-[#1B2F49] transition shadow-xs"
                        >
                          차량 사용
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#64748B]">사용 내역 ({usages.length}건)</span>
                          {isAdmin && usages.length > 0 && (
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-1 text-[11px] font-semibold text-[#243B5A] cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isAllSelected}
                                  onChange={(e) => {
                                    const ids = usages.map(u => u.id);
                                    if (e.target.checked) {
                                      setSelectedVehicleUsageIds(prev => Array.from(new Set([...prev, ...ids])));
                                    } else {
                                      setSelectedVehicleUsageIds(prev => prev.filter(id => !ids.includes(id)));
                                    }
                                  }}
                                  className="accent-[#243B5A]"
                                />
                                전체선택
                              </label>
                              <button
                                onClick={async () => {
                                  const targetIds = selectedVehicleUsageIds.filter(id => usages.some(u => u.id === id));
                                  if (targetIds.length === 0) {
                                    showCustomAlert('알림', '삭제할 사용 내역을 체크해주세요.');
                                    return;
                                  }
                                  showCustomConfirm('사용 내역 삭제', `선택한 ${targetIds.length}건의 사용 내역을 삭제하시겠습니까?`, async () => {
                                    try {
                                      const { error } = await supabase.from('vehicle_usages').delete().in('id', targetIds);
                                      if (error) throw error;
                                      setSelectedVehicleUsageIds(prev => prev.filter(id => !targetIds.includes(id)));
                                      await fetchVehicleUsages();
                                      showCustomAlert('완료', '선택한 사용 내역이 삭제되었습니다.');
                                    } catch (err: any) {
                                      showCustomAlert('오류', `삭제 실패: ${err.message}`);
                                    }
                                  });
                                }}
                                className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded text-[10px] font-bold hover:bg-red-100"
                              >
                                선택삭제
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                          {usages.length === 0 ? (
                            <div className="text-[11px] text-[#94A3B8] py-2 text-center">사용 내역이 없습니다.</div>
                          ) : (
                            usages.map((u) => {
                              const isChecked = selectedVehicleUsageIds.includes(u.id);
                              return (
                                <div key={u.id} className="bg-[#F5F6F8] p-2 rounded-lg text-[11px] space-y-0.5 border flex items-start gap-2">
                                  {isAdmin && (
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedVehicleUsageIds(prev => [...prev, u.id]);
                                        } else {
                                          setSelectedVehicleUsageIds(prev => prev.filter(id => id !== u.id));
                                        }
                                      }}
                                      className="mt-0.5 accent-[#243B5A]"
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex justify-between font-bold text-[#1F2937]">
                                      <span>운전자: {u.driver_name}</span>
                                      <span className="font-mono text-[#64748B]">{u.time_str || ''}</span>
                                    </div>
                                    <div>목적지: {u.destination || '-'} / 목적: {u.purpose || '-'}</div>
                                    {u.start_date && <div className="text-[10px] text-[#64748B] font-mono">기간: {u.start_date} ~ {u.end_date || u.start_date}</div>}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {vehicles.length === 0 && (
                <div className="col-span-full py-12 text-center text-xs text-[#64748B] bg-white rounded-xl border">
                  등록된 차량이 없습니다. 관리자 계정에서 '차량 등록/관리'를 통해 차량을 등록해 주세요.
                </div>
              )}
            </div>
          </div>
        ) : taskTab === 'DAILY' ? (
          <>
            <div className="md:hidden space-y-2">
              <div className="relative grid grid-cols-2 gap-2 rounded-xl border border-[#E2E5E9] bg-white p-2">
                <button
                  type="button"
                  onClick={() => setActiveFilterDropdown(activeFilterDropdown === 'mobile-vessel' ? null : 'mobile-vessel')}
                  className={`flex min-w-0 items-center justify-between gap-1 rounded-lg bg-[#243B5A] px-2.5 py-2 text-left text-xs font-bold text-white ${dailySubTab === 'HISTORY' ? 'col-span-2' : ''}`}
                >
                  <span className="truncate">▶ 호선 선택: {tableFilterVessel === 'ALL' ? '전체' : tableFilterVessel}</span>
                  <ChevronDown className="h-4 w-4 shrink-0"/>
                </button>
                {dailySubTab !== 'HISTORY' && <button
                  type="button"
                  onClick={() => setActiveFilterDropdown(activeFilterDropdown === 'mobile-date' ? null : 'mobile-date')}
                  className="flex min-w-0 items-center justify-between gap-1 rounded-lg bg-[#243B5A] px-2.5 py-2 text-left text-xs font-bold text-white"
                >
                  <span className="truncate">▶ 일자 선택: {tableFilterDate === 'ALL' ? '전체' : formatToShortDate(tableFilterDate)}</span>
                  <ChevronDown className="h-4 w-4 shrink-0"/>
                </button>}
                {activeFilterDropdown === 'mobile-vessel' && (
                  <div className="absolute left-2 top-full z-50 mt-1 max-h-60 w-[calc(50%-0.5rem)] overflow-y-auto rounded-lg border bg-white p-1.5 text-[#1F2937] shadow-xl">
                    <button type="button" onClick={() => { setTableFilterVessel('ALL'); setActiveFilterDropdown(null); }} className="block w-full rounded px-3 py-2 text-left text-xs font-semibold hover:bg-slate-100">전체 호선</button>
                    {vessels.map(v => <button key={v.id} type="button" onClick={() => { setTableFilterVessel(v.name); setActiveFilterDropdown(null); }} className="block w-full rounded px-3 py-2 text-left text-xs hover:bg-slate-100">{v.name}</button>)}
                  </div>
                )}
                {dailySubTab !== 'HISTORY' && activeFilterDropdown === 'mobile-date' && (
                  <div className="absolute right-2 top-full z-50 mt-1 max-h-60 w-[calc(50%-0.5rem)] overflow-y-auto rounded-lg border bg-white p-1.5 text-[#1F2937] shadow-xl">
                    <button type="button" onClick={() => { setTableFilterDate('ALL'); setActiveFilterDropdown(null); }} className="block w-full rounded px-3 py-2 text-left text-xs font-semibold hover:bg-slate-100">전체 날짜</button>
                    {Array.from(new Set(tasks.filter(t => (t.task_type === 'DAILY' || t.task_type === 'DAILY_OTHER') && Boolean(t.start_date) && t.start_date >= formatDateToYYYYMMDD(new Date())).map(t => t.start_date).filter((d): d is string => Boolean(d)))).sort((a, b) => b.localeCompare(a)).map(dStr => (
                      <button key={dStr} type="button" onClick={() => { setTableFilterDate(dStr); setActiveFilterDropdown(null); }} className="block w-full rounded px-3 py-2 text-left font-mono text-xs hover:bg-slate-100">{formatToShortDate(dStr)}</button>
                    ))}
                  </div>
                )}
                {((dailySubTab !== 'HISTORY' && tableFilterDate !== 'ALL') || tableFilterVessel !== 'ALL') && <button type="button" onClick={() => { setTableFilterDate('ALL'); setTableFilterVessel('ALL'); }} className="col-span-2 rounded-lg border px-2 py-1.5 text-xs text-[#64748B]">필터 전체 해제</button>}
              </div>
              {filteredTasks.length === 0 ? (
                <div className="rounded-xl border bg-white py-10 text-center text-xs text-[#64748B]">
                  {dailySubTab === 'ACTIVE' ? '등록된 진행중/대기 일일 업무가 없습니다.' : dailySubTab === 'OTHER' ? '등록된 야간업무진행가 없습니다.' : '완료 이력이 없습니다.'}
                </div>
              ) : filteredTasks.map((t) => (
                <div key={`mobile-${t.id}`} className="rounded-xl border border-[#E2E5E9] bg-white p-3 shadow-2xs" onClick={() => handleOpenTaskDetail(t)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-1 text-[11px]">
                        <span className="font-bold text-[#243B5A]">{t.category || '호선 미지정'}</span>
                        {t.cargo_hold && <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-semibold text-indigo-700">{t.cargo_hold}</span>}
                        <span className="font-mono text-[#64748B]">{formatToShortDate(t.start_date)}</span>
                        {t.time_slot && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[#2563EB]">{formatShortTimeSlot(t.time_slot)}</span>}
                      </div>
                      <div className="break-words text-sm font-bold text-[#1F2937]">{t.title}{renderTaskNewBadge(t)}{dailySubTab === 'HISTORY' && wasCompletedHistoryRemarksEdited(t) && <span className="ml-1 text-[10px] font-bold text-green-600">비고 수정됨</span>}</div>
                    </div>
                    {isAdmin && dailySubTab === 'HISTORY' && <input type="checkbox" checked={selectedTaskIds.includes(t.id)} onClick={(e) => e.stopPropagation()} onChange={(e) => toggleTaskSelection(t.id, e.target.checked)} className="mt-1 accent-[#243B5A]" aria-label="업무 선택" />}
                  </div>
                  {t.description && <p className="mt-2 whitespace-pre-wrap break-words text-xs text-[#64748B]">{t.description}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {(t.task_type !== 'DAILY_OTHER' || t.status === 'COMPLETED') && renderStatusBadge(t)}
                    {t.task_type === 'DAILY' && t.completion_pending_review === true && <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">관리자 확인 대기</span>}
                    {isAdmin && t.task_type === 'DAILY_OTHER' && t.status !== 'COMPLETED' && <button type="button" onClick={() => handleCompleteOtherTask(t)} className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800">완료</button>}
                  </div>
                  <div className="mt-3 border-t border-slate-100 pt-2" onClick={(e) => e.stopPropagation()}>
                    <div className="mb-1 text-[10px] font-bold text-[#64748B]">인원 ({t.assigned_names?.length || 0}명)</div>
                    {t.assigned_names?.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {t.assigned_names.map((name) => <button key={`${t.id}-mobile-${name}`} type="button" onClick={() => handleCallWorker(name)} className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-[#243B5A] hover:bg-blue-100"><span>📞</span><span>{name}</span></button>)}
                      </div>
                    ) : <div className="text-xs text-[#94A3B8]">미지정</div>}
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    {dailySubTab === 'ACTIVE' && isAdmin && t.task_type === 'DAILY' && t.status === 'COMPLETED' && t.completion_pending_review === true && <button type="button" onClick={() => handleFinalizeDailyTask(t)} className="rounded bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white">최종 완료</button>}
                    {t.task_type === 'DAILY_OTHER' && canManageTask(t) && <><button type="button" onClick={() => handleOpenTaskEdit(t)} className="rounded border px-2 py-1.5 text-xs font-semibold text-[#243B5A]"><Pencil className="mr-1 inline h-3 w-3"/>수정</button><button type="button" onClick={() => handleDeleteTask(t.id)} className="rounded border border-red-200 px-2 py-1.5 text-xs font-semibold text-red-600"><Trash2 className="mr-1 inline h-3 w-3"/>삭제</button></>}
                    {dailySubTab === 'HISTORY' && isAdmin && t.task_type === 'DAILY' && <button type="button" onClick={() => handleDeleteTask(t.id)} className="rounded border border-red-200 px-2 py-1.5 text-xs font-semibold text-red-600"><Trash2 className="mr-1 inline h-3 w-3"/>삭제</button>}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block w-full rounded-xl border bg-white shadow-2xs overflow-visible">
              <table className="w-full text-left border-collapse text-[10px] sm:text-[11px] table-fixed">
                <thead>
                  <tr className="bg-[#243B5A] text-white">
                    {isAdmin && dailySubTab === 'HISTORY' && (
                      <th className="p-1.5 w-6 text-center border-r border-white/20 last:border-r-0">
                        <input type="checkbox" checked={filteredTasks.length > 0 && filteredTasks.every((task) => selectedTaskIds.includes(task.id))} onChange={(e) => handleSelectAllVisible(e.target.checked)} className="accent-white" />
                      </th>
                    )}
                    <th className="p-1 font-bold text-center w-[14%] relative border-r border-white/20 last:border-r-0">
                      <div className="flex items-center justify-center gap-1 cursor-pointer" onClick={() => setActiveFilterDropdown(activeFilterDropdown === 'vessel' ? null : 'vessel')}>
                        <span className="truncate">호선{tableFilterVessel !== 'ALL' ? `(${tableFilterVessel})` : ''}</span>
                        <span className="text-[10px] text-blue-200 font-bold">▶</span>
                      </div>
                      {activeFilterDropdown === 'vessel' && (
                        <div className="absolute top-full left-0 z-50 bg-white text-[#1F2937] border shadow-lg rounded-lg p-1.5 mt-1 min-w-[100px] space-y-1">
                          <div className="font-bold text-[10px] text-[#64748B] border-b pb-1">호선 선택</div>
                          <button onClick={() => { setTableFilterVessel('ALL'); setActiveFilterDropdown(null); }} className="block w-full text-left px-2 py-1 hover:bg-slate-100 rounded text-[11px]">전체</button>
                          {vessels.map(v => (
                            <button key={v.id} onClick={() => { setTableFilterVessel(v.name); setActiveFilterDropdown(null); }} className="block w-full text-left px-2 py-1 hover:bg-slate-100 rounded text-[11px] truncate">{v.name}</button>
                          ))}
                        </div>
                      )}
                    </th>
                    <th className="p-1 font-bold text-center w-[10%] relative border-r border-white/20 last:border-r-0">
                      <div className="flex items-center justify-center gap-1 cursor-pointer" onClick={() => setActiveFilterDropdown(activeFilterDropdown === 'cargo' ? null : 'cargo')}>
                        <span className="truncate">화물창{tableFilterCargoHold !== 'ALL' ? `(${tableFilterCargoHold})` : ''}</span>
                        <span className="text-[10px] text-blue-200 font-bold">▶</span>
                      </div>
                      {activeFilterDropdown === 'cargo' && (
                        <div className="absolute top-full left-0 z-50 bg-white text-[#1F2937] border shadow-lg rounded-lg p-1.5 mt-1 min-w-[100px] space-y-1">
                          <div className="font-bold text-[10px] text-[#64748B] border-b pb-1">화물창 선택</div>
                          <button onClick={() => { setTableFilterCargoHold('ALL'); setActiveFilterDropdown(null); }} className="block w-full text-left px-2 py-1 hover:bg-slate-100 rounded text-[11px]">전체</button>
                          {Array.from(new Set(tasks.map(t => t.cargo_hold).filter(Boolean))).map(hold => (
                            <button key={hold} onClick={() => { setTableFilterCargoHold(hold!); setActiveFilterDropdown(null); }} className="block w-full text-left px-2 py-1 hover:bg-slate-100 rounded text-[11px] truncate">{hold}</button>
                          ))}
                        </div>
                      )}
                    </th>
                    <th className={`p-1 font-bold text-center w-[10%] ${dailySubTab === 'HISTORY' ? '' : 'relative'}`}>
                      {dailySubTab === 'HISTORY' ? (
                        <span>일자</span>
                      ) : (
                        <>
                          <div className="flex items-center justify-center gap-1 cursor-pointer" onClick={() => setActiveFilterDropdown(activeFilterDropdown === 'date' ? null : 'date')}>
                            <span className="truncate">일자{tableFilterDate !== 'ALL' ? `(${formatToShortDate(tableFilterDate)})` : ''}</span>
                            <span className="text-[10px] text-blue-200 font-bold">▶</span>
                          </div>
                          {activeFilterDropdown === 'date' && (
                            <div className="absolute top-full left-0 z-50 bg-white text-[#1F2937] border shadow-lg rounded-lg p-1.5 mt-1 min-w-[110px] max-h-60 overflow-y-auto space-y-1">
                              <div className="font-bold text-[10px] text-[#64748B] border-b pb-1">일자 선택</div>
                              <button onClick={() => { setTableFilterDate('ALL'); setActiveFilterDropdown(null); }} className="block w-full text-left px-2 py-1 hover:bg-slate-100 rounded text-[11px]">전체</button>
                              {Array.from(new Set(tasks.filter(t => (t.task_type === 'DAILY' || t.task_type === 'DAILY_OTHER') && Boolean(t.start_date) && t.start_date >= formatDateToYYYYMMDD(new Date())).map(t => t.start_date).filter((d): d is string => Boolean(d)))).sort((a, b) => b.localeCompare(a)).map(dStr => (
                                <button key={dStr} onClick={() => { setTableFilterDate(dStr); setActiveFilterDropdown(null); }} className="block w-full text-left px-2 py-1 hover:bg-slate-100 rounded text-[11px] font-mono">{formatToShortDate(dStr)}</button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </th>
                    <th className="p-1 font-bold text-center w-[9%] relative border-r border-white/20 last:border-r-0">
                      <div className="flex items-center justify-center gap-1 cursor-pointer" onClick={() => setActiveFilterDropdown(activeFilterDropdown === 'timeslot' ? null : 'timeslot')}>
                        <span className="truncate">시간대{tableFilterTimeSlot !== 'ALL' ? `(${tableFilterTimeSlot})` : ''}</span>
                        <span className="text-[10px] text-blue-200 font-bold">▶</span>
                      </div>
                      {activeFilterDropdown === 'timeslot' && (
                        <div className="absolute top-full left-0 z-50 bg-white text-[#1F2937] border shadow-lg rounded-lg p-1.5 mt-1 min-w-[90px] space-y-1">
                          <div className="font-bold text-[10px] text-[#64748B] border-b pb-1">시간대 선택</div>
                          <button onClick={() => { setTableFilterTimeSlot('ALL'); setActiveFilterDropdown(null); }} className="block w-full text-left px-2 py-1 hover:bg-slate-100 rounded text-[11px]">전체</button>
                          <button onClick={() => { setTableFilterTimeSlot('오전'); setActiveFilterDropdown(null); }} className="block w-full text-left px-2 py-1 hover:bg-slate-100 rounded text-[11px]">오전</button>
                          <button onClick={() => { setTableFilterTimeSlot('오후'); setActiveFilterDropdown(null); }} className="block w-full text-left px-2 py-1 hover:bg-slate-100 rounded text-[11px]">오후</button>
                          <button onClick={() => { setTableFilterTimeSlot('종일'); setActiveFilterDropdown(null); }} className="block w-full text-left px-2 py-1 hover:bg-slate-100 rounded text-[11px]">종일</button>
                        </div>
                      )}
                    </th>
                    <th className="p-1 font-bold text-center w-[12%] relative border-r border-white/20 last:border-r-0">
                      <div className="flex items-center justify-center gap-1 cursor-pointer" onClick={() => setActiveFilterDropdown(activeFilterDropdown === 'status' ? null : 'status')}>
                        <span className="truncate">상태버튼{tableFilterStatus !== 'ALL' ? `(${tableFilterStatus === 'PENDING' ? '대기' : tableFilterStatus === 'IN_PROGRESS' ? '진행중' : '완료'})` : ''}</span>
                        <span className="text-[10px] text-blue-200 font-bold">▶</span>
                      </div>
                      {activeFilterDropdown === 'status' && (
                        <div className="absolute top-full right-0 z-50 bg-white text-[#1F2937] border shadow-lg rounded-lg p-1.5 mt-1 min-w-[90px] space-y-1">
                          <div className="font-bold text-[10px] text-[#64748B] border-b pb-1">상태 선택</div>
                          <button onClick={() => { setTableFilterStatus('ALL'); setActiveFilterDropdown(null); }} className="block w-full text-left px-2 py-1 hover:bg-slate-100 rounded text-[11px]">전체</button>
                          <button onClick={() => { setTableFilterStatus('PENDING'); setActiveFilterDropdown(null); }} className="block w-full text-left px-2 py-1 hover:bg-slate-100 rounded text-[11px]">대기</button>
                          <button onClick={() => { setTableFilterStatus('IN_PROGRESS'); setActiveFilterDropdown(null); }} className="block w-full text-left px-2 py-1 hover:bg-slate-100 rounded text-[11px]">진행중</button>
                          <button onClick={() => { setTableFilterStatus('COMPLETED'); setActiveFilterDropdown(null); }} className="block w-full text-left px-2 py-1 hover:bg-slate-100 rounded text-[11px]">완료</button>
                        </div>
                      )}
                    </th>
                    <th className="p-1 font-bold text-center w-[9%] border-r border-white/20 last:border-r-0">관리</th>
                    <th className="p-1 font-bold w-[36%] border-r border-white/20 last:border-r-0">인원</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-[#64748B]">
                        {dailySubTab === 'ACTIVE' ? '등록된 진행중/대기 일일 업무가 없습니다.' : dailySubTab === 'OTHER' ? '등록된 야간업무진행가 없습니다.' : '완료 이력이 없습니다.'}
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map((t, rowIndex) => {
                      const dateChanged = rowIndex === 0 || filteredTasks[rowIndex - 1]?.start_date !== t.start_date;
                      const dateGroupIndex = filteredTasks.slice(0, rowIndex + 1).reduce((count, item, index, arr) => {
                        return index === 0 || item.start_date !== arr[index - 1]?.start_date ? count + 1 : count;
                      }, 0) - 1;
                      const dateGroupBackground = dateGroupIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50';
                      return (
                        <tr key={t.id} className={`${dateGroupBackground} hover:bg-blue-50 transition cursor-pointer ${dateChanged && rowIndex > 0 ? 'border-t-[3px] border-double border-slate-400' : 'border-t border-[#E2E5E9]'}`} onClick={() => handleOpenTaskDetail(t)}>
                          {isAdmin && dailySubTab === 'HISTORY' && (
                            <td className="p-1.5 text-center border-r border-slate-200 last:border-r-0" onClick={(e) => e.stopPropagation()}>
                              <input type="checkbox" checked={selectedTaskIds.includes(t.id)} onChange={(e) => toggleTaskSelection(t.id, e.target.checked)} className="accent-[#243B5A]" />
                            </td>
                          )}
                          <td className="p-1 font-bold text-[#243B5A] text-center truncate border-r border-slate-200 last:border-r-0" title={t.category || '-'}>{t.category || '-'}</td>
                          <td className="p-1 font-semibold text-indigo-700 text-center truncate border-r border-slate-200 last:border-r-0" title={t.cargo_hold || '-'}>{t.cargo_hold || '-'}</td>
                          <td className="p-1 font-mono text-[#64748B] text-center truncate border-r border-slate-200 last:border-r-0" title={formatToShortDate(t.start_date)}>{formatToShortDate(t.start_date)}</td>
                          <td className="p-1 font-mono text-[#2563EB] text-center truncate border-r border-slate-200 last:border-r-0" title={formatShortTimeSlot(t.time_slot)}>{formatShortTimeSlot(t.time_slot) || '-'}</td>
                          <td className="p-1 text-center truncate border-r border-slate-200 last:border-r-0" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              {(t.task_type !== 'DAILY_OTHER' || t.status === 'COMPLETED') && renderStatusBadge(t)}
                              {dailySubTab === 'HISTORY' && wasCompletedHistoryRemarksEdited(t) && <span className="ml-1 whitespace-nowrap text-[9px] font-bold text-green-600">비고 수정됨</span>}
                              {t.task_type === 'DAILY' && t.completion_pending_review === true && (
                                <span className="px-1 py-0.2 bg-amber-50 text-amber-800 border border-amber-300 rounded text-[9px] font-bold">대기</span>
                              )}
                              {isAdmin && t.task_type === 'DAILY_OTHER' && t.status !== 'COMPLETED' && (
                                <button
                                  type="button"
                                  onClick={() => handleCompleteOtherTask(t)}
                                  className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded text-[9px] font-bold hover:bg-emerald-100"
                                >
                                  완료
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-1 text-center border-r border-slate-200 last:border-r-0" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              {dailySubTab === 'ACTIVE' && isAdmin && t.task_type === 'DAILY' && t.status === 'COMPLETED' && t.completion_pending_review === true && (
                                <button onClick={() => handleFinalizeDailyTask(t)} className="min-w-[42px] px-2 py-1 bg-emerald-600 text-white rounded font-semibold text-[10px] text-center hover:bg-emerald-700">완료</button>
                              )}
                              {t.task_type === 'DAILY_OTHER' && canManageTask(t) && (
                                <>
                                  <button onClick={() => handleOpenTaskEdit(t)} className="inline-flex items-center justify-center p-1 text-[#243B5A] hover:bg-slate-200 rounded"><Pencil className="h-3.5 w-3.5"/></button>
                                  <button onClick={() => handleDeleteTask(t.id)} className="inline-flex items-center justify-center p-1 text-red-600 hover:bg-slate-200 rounded"><Trash2 className="h-3.5 w-3.5"/></button>
                                </>
                              )}
                              {dailySubTab === 'HISTORY' && isAdmin && t.task_type === 'DAILY' && (
                                <button onClick={() => handleDeleteTask(t.id)} className="inline-flex items-center justify-center p-1 text-red-600 hover:bg-slate-200 rounded"><Trash2 className="h-3.5 w-3.5"/></button>
                              )}
                            </div>
                          </td>
                          <td className="p-1 text-[#64748B] align-top whitespace-normal border-r border-slate-200 last:border-r-0" title={t.assigned_names?.join(', ') || '미지정'}>
                            <div className="mb-1 text-[10px] font-bold text-[#64748B]">인원 {t.assigned_names?.length || 0}명</div>
                            {t.assigned_names?.length ? (
                              <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[11px] leading-4">
                                {t.assigned_names.map((name, idx) => (
                                  <span key={`${t.id}-${name}`} className="whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleCallWorker(name); }}
                                      className="font-medium text-[#1F2937] hover:text-[#2563EB] hover:underline"
                                      title="클릭 시 전화 연결"
                                    >
                                      {name}
                                    </button>{idx < (t.assigned_names?.length || 0) - 1 ? ',' : ''}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[11px]">미지정</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : taskTab === 'WEEKLY' ? (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between pb-2.5 border-b gap-2">
              <div className="flex items-center space-x-2">
                <button onClick={() => changeWeek('prev')} className="p-1.5 border rounded-lg"><ChevronLeft className="h-4 w-4"/></button>
                <span className="text-xs sm:text-sm font-bold font-mono">{weekDays[0].displayDate} ~ {weekDays[6].displayDate} 일정</span>
                <button onClick={() => changeWeek('next')} className="p-1.5 border rounded-lg"><ChevronRight className="h-4 w-4"/></button>
                <button onClick={() => { setCurrentWeekMonday(getMonday(new Date())); setSelectedTaskIds([]); }} className="text-xs px-2.5 py-1 bg-[#F5F6F8] border rounded-lg font-semibold ml-2">오늘</button>
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                {isAdmin && (
                  <>
                    <input type="month" value={selectedExportMonth} onChange={(e) => setSelectedExportMonth(e.target.value)} className="px-2 py-1 text-xs border rounded-lg font-mono" />
                    <button onClick={() => { void handleExportWeeklyExcel(); }} className="flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition"><FileSpreadsheet className="h-3.5 w-3.5"/><span>엑셀 저장</span></button>
                    <button onClick={handleRequestMonthlyWeeklyDelete} className="flex items-center space-x-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition"><Trash2 className="h-3.5 w-3.5"/><span>월 삭제</span></button>
                  </>
                )}
                <div className="bg-[#F5F6F8] p-1 rounded-lg border flex space-x-1">
                  <button onClick={() => setWeeklyViewMode('GRID')} className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1 ${weeklyViewMode === 'GRID' ? 'bg-[#243B5A] text-white' : 'text-[#64748B]'}`}><LayoutGrid className="h-3.5 w-3.5"/><span className="hidden sm:inline">가로</span></button>
                  <button onClick={() => setWeeklyViewMode('LIST')} className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1 ${weeklyViewMode === 'LIST' ? 'bg-[#243B5A] text-white' : 'text-[#64748B]'}`}><List className="h-3.5 w-3.5"/><span className="hidden sm:inline">세로</span></button>
                </div>
              </div>
            </div>

            {weeklyViewMode === 'GRID' ? (
              <div className="overflow-x-auto pb-2 [&::-webkit-scrollbar]:h-2">
                <div className="grid grid-cols-7 gap-2 min-w-[900px]">
                  {weekDays.map((day) => {
                    const dayTasks = filteredTasks.filter((t) => t.start_date === day.dateStr);
                    return (
                      <div key={day.dateStr} className={`rounded-xl border p-2 min-h-[420px] flex flex-col ${day.isToday ? 'border-[#243B5A] bg-[#243B5A]/5' : 'bg-white'}`}>
                        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b">
                          <span className="font-bold text-xs">{day.label} <span className="text-[10px] text-[#64748B] font-mono">{day.displayDate}</span></span>
                          {isAdmin && (
                            <button onClick={() => handleOpenCreateModal(day.dateStr, 'WEEKLY')} className="p-0.5 text-[#243B5A] hover:bg-slate-200 rounded"><Plus className="h-3.5 w-3.5"/></button>
                          )}
                        </div>
                        <div className="space-y-2 flex-1 overflow-y-auto">
                          {dayTasks.map((t) => (
                            <div key={t.id} onClick={() => handleOpenTaskDetail(t)} className="bg-white border rounded-lg p-2 text-xs space-y-1 shadow-2xs cursor-pointer hover:border-[#243B5A]">
                              <div className="flex justify-between items-center">
                                {isAdmin && <input type="checkbox" checked={selectedTaskIds.includes(t.id)} onChange={(e) => toggleTaskSelection(t.id, e.target.checked)} onClick={(e) => e.stopPropagation()} className="accent-[#243B5A]" />}
                                {t.category && <span className="text-[9px] font-bold text-[#243B5A] bg-blue-50 px-1.5 py-0.2 rounded">{t.category}{t.cargo_hold ? `/${t.cargo_hold}` : ''}</span>}
                                {renderStatusBadge(t)}
                              </div>
                              <div className="font-bold text-[#1F2937] leading-tight line-clamp-2">{t.title}{renderTaskNewBadge(t)}</div>
                              <div className="text-[10px] text-[#64748B]">{t.assigned_names?.join(', ') || '미지정'}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {weekDays.map((day) => {
                  const dayTasks = filteredTasks.filter((t) => t.start_date === day.dateStr);
                  return (
                    <div key={day.dateStr} className={`rounded-xl border p-3 bg-white ${day.isToday ? 'border-[#243B5A]' : 'border-[#E2E5E9]'}`}>
                      <div className="flex items-center justify-between pb-2 mb-2 border-b">
                        <span className="font-bold text-xs text-[#243B5A]">{day.label} <span className="text-[10px] text-[#64748B] font-mono">{day.displayDate}</span></span>
                        {isAdmin && (
                          <button onClick={() => handleOpenCreateModal(day.dateStr, 'WEEKLY')} className="px-2 py-1 bg-[#243B5A] text-white text-[10px] font-bold rounded">등록</button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {dayTasks.length === 0 ? (
                          <div className="text-[11px] text-[#94A3B8] py-1">등록된 업무가 없습니다.</div>
                        ) : (
                          dayTasks.map((t) => (
                            <div key={t.id} onClick={() => handleOpenTaskDetail(t)} className="bg-[#F5F6F8] border rounded-lg p-2.5 text-xs space-y-1.5 cursor-pointer hover:border-[#243B5A]">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  {isAdmin && <input type="checkbox" checked={selectedTaskIds.includes(t.id)} onChange={(e) => toggleTaskSelection(t.id, e.target.checked)} onClick={(e) => e.stopPropagation()} className="accent-[#243B5A]" />}
                                  {t.category && <span className="text-[10px] font-bold text-[#243B5A] bg-white px-1.5 py-0.5 rounded border">{t.category}{t.cargo_hold ? `/${t.cargo_hold}` : ''}</span>}
                                </div>
                                {renderStatusBadge(t)}
                              </div>
                              <div className="font-bold text-[#1F2937]">{t.title}{renderTaskNewBadge(t)}</div>
                              <div className="text-[11px] text-[#64748B]">담당: {t.assigned_names?.join(', ') || '미지정'}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : taskTab === 'CABIN' ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredTasks.map((t) => (
                <div key={t.id} onClick={() => handleOpenTaskDetail(t)} className="bg-white border rounded-xl p-4 shadow-2xs space-y-3 cursor-pointer hover:border-[#243B5A] flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs bg-[#243B5A] text-white px-2 py-0.5 rounded">{t.category || '호선 미지정'}</span>
                        <span className="font-mono text-xs text-[#64748B]">{t.start_date} ~ {t.end_date || t.start_date}</span>
                      </div>
                      {renderStatusBadge(t)}
                    </div>

                    <div className="font-bold text-sm text-[#1F2937]">{t.title}{renderTaskNewBadge(t)}</div>
                    {t.description && <p className="text-xs text-[#64748B] whitespace-pre-wrap">{t.description}</p>}

                    <div className="space-y-1.5 pt-2 border-t text-xs">
                      <div className="flex items-center justify-between bg-blue-50 p-2 rounded-lg">
                        <span className="font-bold text-[#2563EB] flex items-center gap-1"><Sun className="h-3.5 w-3.5"/> 주간 인원 ({t.day_workers?.length || 0}명)</span>
                        <span className="font-medium text-[#1F2937]">{t.day_workers?.join(', ') || '없음'}</span>
                      </div>
                      <div className="flex items-center justify-between bg-indigo-50 p-2 rounded-lg">
                        <span className="font-bold text-indigo-700 flex items-center gap-1"><Moon className="h-3.5 w-3.5"/> 야간 인원 ({t.night_workers?.length || 0}명)</span>
                        <span className="font-medium text-[#1F2937]">{t.night_workers?.join(', ') || '없음'}</span>
                      </div>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center justify-end gap-1.5 pt-2 border-t mt-2" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => handleOpenTaskEdit(t)} className="px-2.5 py-1 text-xs border rounded-lg font-semibold text-[#243B5A] hover:bg-slate-50"><Pencil className="h-3 w-3 inline mr-1"/>수정</button>
                      <button onClick={() => handleDeleteTask(t.id)} className="px-2.5 py-1 text-xs border border-red-200 text-red-600 rounded-lg font-semibold hover:bg-red-50"><Trash2 className="h-3 w-3 inline mr-1"/>삭제</button>
                    </div>
                  )}
                </div>
              ))}
              {filteredTasks.length === 0 && (
                <div className="col-span-full py-16 text-center text-xs text-[#64748B] bg-white rounded-xl border">
                  등록된 CABIN 업무가 없습니다.
                </div>
              )}
            </div>
          </div>
        ) : null}

      {/* 업무 생성/수정 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-[#243B5A]">
                {editingTask ? '업무 수정' : formData.task_type === 'DAILY_OTHER' ? '야간업무진행 등록' : formData.task_type === 'WEEKLY' ? '주간업무 등록' : formData.task_type === 'CABIN' ? 'CABIN 업무 등록' : '일일업무 등록'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg text-[#64748B] hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={handleSubmitTask} className="space-y-3 text-xs">
              {formData.task_type !== 'WEEKLY' && formData.task_type !== 'CABIN' && (
                <div>
                  <label className="block font-semibold mb-1 text-[#64748B]">호선 선택</label>
                  <div className="flex gap-1.5">
                    <select
                      value={formData.category}
                      onChange={(e) => {
                        if (e.target.value === '__ADD_NEW__') {
                          setIsQuickVesselInputOpen(true);
                        } else {
                          setFormData({ ...formData, category: e.target.value });
                        }
                      }}
                      className="flex-1 p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs font-semibold text-[#1F2937] outline-none"
                    >
                      <option value="">호선 선택</option>
                      {vessels.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
                      {isAdmin && <option value="__ADD_NEW__">+ 새 호선 직접 추가</option>}
                    </select>
                  </div>
                  {isQuickVesselInputOpen && (
                    <div className="flex gap-1 mt-1.5">
                      <input
                        type="text"
                        placeholder="새 호선명 입력"
                        value={quickVesselName}
                        onChange={(e) => setQuickVesselName(e.target.value)}
                        className="flex-1 p-2 border rounded-lg text-xs"
                      />
                      <button type="button" onClick={handleQuickAddVessel} className="px-3 bg-[#243B5A] text-white rounded-lg text-xs font-bold">추가</button>
                      <button type="button" onClick={() => setIsQuickVesselInputOpen(false)} className="px-2 border rounded-lg text-xs">취소</button>
                    </div>
                  )}
                </div>
              )}

              {formData.task_type === 'CABIN' && (
                <div>
                  <label className="block font-semibold mb-1 text-[#64748B]">CABIN 호선</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs font-semibold text-[#1F2937]"
                  >
                    {vessels.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1 text-[#64748B]">화물창</label>
                  <input
                    type="text"
                    placeholder="예: 1호기, C/H 2"
                    value={formData.cargo_hold}
                    onChange={(e) => setFormData({ ...formData, cargo_hold: e.target.value })}
                    className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-[#64748B]">시간대</label>
                  <select
                    value={formData.time_slot}
                    onChange={(e) => setFormData({ ...formData, time_slot: e.target.value })}
                    className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs font-semibold"
                  >
                    <option value="오전(08:00~12:00)">오전 (08:00~12:00)</option>
                    <option value="오후(13:00~17:00)">오후 (13:00~17:00)</option>
                    <option value="종일(08:00~17:00)">종일 (08:00~17:00)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1 text-[#64748B]">{formData.task_type === 'CABIN' ? '시작일자' : '일자'}</label>
                  <CalendarDatePicker value={formData.start_date} onChange={(val) => setFormData({ ...formData, start_date: val })} />
                </div>
                {formData.task_type === 'CABIN' && (
                  <div>
                    <label className="block font-semibold mb-1 text-[#64748B]">종료일자</label>
                    <CalendarDatePicker value={formData.end_date} onChange={(val) => setFormData({ ...formData, end_date: val })} />
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#64748B]">업무명</label>
                <input
                  type="text"
                  required
                  placeholder="업무 제목을 입력해 주세요"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#64748B]">상세 내용</label>
                <textarea
                  rows={3}
                  placeholder="상세 내용을 입력해 주세요"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs resize-none"
                />
              </div>

              {formData.task_type === 'CABIN' ? (
                <div className="space-y-3 pt-2 border-t">
                  <div>
                    <label className="block font-semibold mb-1 text-[#2563EB]">주간 근무 인원</label>
                    <div className="flex gap-1 mb-1.5">
                      <input
                        type="text"
                        list="app-users-list"
                        placeholder="이름 직접 입력 또는 선택"
                        value={singleWorkerInput}
                        onChange={(e) => setSingleWorkerInput(e.target.value)}
                        className="flex-1 p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs"
                      />
                      <button type="button" onClick={() => handleAddWorkerSingle('DAY')} className="px-3 bg-blue-600 text-white rounded-lg text-xs font-bold">추가</button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {dayWorkerList.map((name) => (
                        <span key={name} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-xs font-semibold">
                          <span>{name}</span>
                          <button type="button" onClick={() => handleRemoveWorker(name, 'DAY')} className="hover:text-red-600"><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1 text-indigo-700">야간 근무 인원</label>
                    <div className="flex gap-1 mb-1.5">
                      <input
                        type="text"
                        list="app-users-list"
                        placeholder="이름 직접 입력 또는 선택"
                        value={singleWorkerInput}
                        onChange={(e) => setSingleWorkerInput(e.target.value)}
                        className="flex-1 p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs"
                      />
                      <button type="button" onClick={() => handleAddWorkerSingle('NIGHT')} className="px-3 bg-indigo-600 text-white rounded-lg text-xs font-bold">추가</button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {nightWorkerList.map((name) => (
                        <span key={name} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg text-xs font-semibold">
                          <span>{name}</span>
                          <button type="button" onClick={() => handleRemoveWorker(name, 'NIGHT')} className="hover:text-red-600"><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : formData.task_type !== 'DAILY_OTHER' && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-[#64748B]">담당 인원</label>
                    {presetTeams.length > 0 && (
                      <select
                        onChange={(e) => {
                          const team = presetTeams.find(p => p.id === e.target.value);
                          if (team && team.members) {
                            setAssignedList(Array.from(new Set([...assignedList, ...team.members])));
                          }
                          e.target.value = '';
                        }}
                        className="p-1 bg-[#F5F6F8] border border-[#E2E5E9] rounded text-[11px] font-semibold text-[#243B5A]"
                      >
                        <option value="">+ 프리셋 팀 불러오기</option>
                        {presetTeams.map(p => <option key={p.id} value={p.id}>{p.name} ({p.members?.length || 0}명)</option>)}
                      </select>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      list="app-users-list"
                      placeholder="인원 이름 검색 또는 입력"
                      value={singleWorkerInput}
                      onChange={(e) => setSingleWorkerInput(e.target.value)}
                      className="flex-1 p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs"
                    />
                    <button type="button" onClick={() => handleAddWorkerSingle('ASSIGNED')} className="px-3 bg-[#243B5A] text-white rounded-lg text-xs font-bold">추가</button>
                  </div>
                  <datalist id="app-users-list">
                    {validUserNames.map((name) => <option key={name} value={name} />)}
                  </datalist>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {assignedList.map((name) => (
                      <span key={name} className="inline-flex items-center gap-1 bg-slate-100 text-[#1F2937] px-2 py-1 rounded-lg text-xs font-semibold">
                        <span>{name}</span>
                        <button type="button" onClick={() => handleRemoveWorker(name, 'ASSIGNED')} className="hover:text-red-600"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded-lg text-xs font-semibold text-[#64748B]">취소</button>
                <button type="submit" className="px-4 py-2 bg-[#243B5A] text-white rounded-lg text-xs font-bold">저장하기</button>
              </div>
            </form>
          </div>
        </div>
      )}

    {/* 차량 사용 신청 모달 */}
      {isVehicleUsageModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4" onClick={() => setIsVehicleUsageModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-[#243B5A]">차량 사용 신청 ({targetVehicleForUsage})</h3>
              <button onClick={() => setIsVehicleUsageModalOpen(false)} className="p-1 rounded-lg text-[#64748B] hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={handleSaveVehicleUsage} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-[#64748B]">신청자</label>
                <input type="text" disabled value={currentUser?.name || ''} className="w-full p-2 bg-[#F5F6F8] border rounded-lg text-xs font-bold text-[#1F2937]" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1 text-[#64748B]">시작일자</label>
                  <CalendarDatePicker value={vehicleUsageForm.start_date} onChange={(val) => setVehicleUsageForm({ ...vehicleUsageForm, start_date: val })} />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-[#64748B]">종료일자</label>
                  <CalendarDatePicker value={vehicleUsageForm.end_date} onChange={(val) => setVehicleUsageForm({ ...vehicleUsageForm, end_date: val })} />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1 text-[#64748B]">시간</label>
                <input type="text" placeholder="예: 08:30" value={vehicleUsageForm.time_str} onChange={(e) => setVehicleUsageForm({ ...vehicleUsageForm, time_str: e.target.value })} className="w-full p-2 bg-[#F5F6F8] border rounded-lg text-xs" />
              </div>
              <div>
                <label className="block font-semibold mb-1 text-[#64748B]">목적지</label>
                <input type="text" required placeholder="예: 본관, 자재창고" value={vehicleUsageForm.destination} onChange={(e) => setVehicleUsageForm({ ...vehicleUsageForm, destination: e.target.value })} className="w-full p-2 bg-[#F5F6F8] border rounded-lg text-xs" />
              </div>
              <div>
                <label className="block font-semibold mb-1 text-[#64748B]">사용 목적</label>
                <input type="text" required placeholder="예: 자재 운반 및 이동" value={vehicleUsageForm.purpose} onChange={(e) => setVehicleUsageForm({ ...vehicleUsageForm, purpose: e.target.value })} className="w-full p-2 bg-[#F5F6F8] border rounded-lg text-xs" />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setIsVehicleUsageModalOpen(false)} className="px-4 py-2 border rounded-lg text-xs font-semibold">취소</button>
                <button type="submit" className="px-4 py-2 bg-[#243B5A] text-white rounded-lg text-xs font-bold">신청하기</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 상태 변경 및 비고 입력 모달 */}
      {statusChangeModal.open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4" onClick={() => setStatusChangeModal({ open: false, task: null, targetStatus: 'PENDING', remarks: '' })}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-[#243B5A]">업무 상태 및 비고란 변경</h3>
              <button onClick={() => setStatusChangeModal({ open: false, task: null, targetStatus: 'PENDING', remarks: '' })} className="p-1 rounded-lg text-[#64748B] hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-3 text-xs">
              {!(statusChangeModal.task?.status === 'COMPLETED' && statusChangeModal.task?.completion_pending_review !== true) && (
                <div>
                  <label className="block font-semibold mb-1 text-[#64748B]">상태 선택</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button type="button" onClick={() => setStatusChangeModal({ ...statusChangeModal, targetStatus: 'PENDING' })} className={`p-2 rounded-lg border font-bold ${statusChangeModal.targetStatus === 'PENDING' ? 'bg-amber-100 border-amber-400 text-amber-900' : 'bg-slate-50 text-[#64748B]'}`}>대기</button>
                    <button type="button" onClick={() => setStatusChangeModal({ ...statusChangeModal, targetStatus: 'IN_PROGRESS' })} className={`p-2 rounded-lg border font-bold ${statusChangeModal.targetStatus === 'IN_PROGRESS' ? 'bg-emerald-500 border-emerald-600 text-white' : 'bg-slate-50 text-[#64748B]'}`}>진행중</button>
                    <button type="button" onClick={() => setStatusChangeModal({ ...statusChangeModal, targetStatus: 'COMPLETED' })} className={`p-2 rounded-lg border font-bold ${statusChangeModal.targetStatus === 'COMPLETED' ? 'bg-slate-700 border-slate-800 text-white' : 'bg-slate-50 text-[#64748B]'}`}>완료</button>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold mb-1 text-[#64748B]">비고란 (특이사항)</label>
                <textarea rows={3} placeholder="특이사항이나 비고 내용을 입력하세요" value={statusChangeModal.remarks} onChange={(e) => setStatusChangeModal({ ...statusChangeModal, remarks: e.target.value })} className="w-full p-2 bg-[#F5F6F8] border rounded-lg text-xs resize-none" />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setStatusChangeModal({ open: false, task: null, targetStatus: 'PENDING', remarks: '' })} className="px-4 py-2 border rounded-lg text-xs font-semibold">취소</button>
                <button type="button" onClick={handleConfirmStatusChange} className="px-4 py-2 bg-[#243B5A] text-white rounded-lg text-xs font-bold">저장하기</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 차량 관리자 모달 */}
      {isVehicleManagerOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4" onClick={() => setIsVehicleManagerOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-[#243B5A]">차량 등록 및 관리</h3>
              <button onClick={() => setIsVehicleManagerOpen(false)} className="p-1 rounded-lg text-[#64748B] hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex gap-2">
                <input type="text" placeholder="새 차량번호 입력 (예: 1234)" value={newVehicleNo} onChange={(e) => setNewVehicleNo(e.target.value)} className="flex-1 p-2 bg-[#F5F6F8] border rounded-lg text-xs" />
                <button type="button" onClick={handleAddVehicle} className="px-4 bg-[#243B5A] text-white rounded-lg text-xs font-bold">등록</button>
              </div>

              <div className="space-y-1.5 pt-2 border-t">
                {vehicles.map((v) => (
                  <div key={v.id} className="flex items-center justify-between bg-[#F5F6F8] p-2 rounded-lg">
                    {editingVehicle?.id === v.id ? (
                      <input type="text" value={editingVehicle.vehicle_no} onChange={(e) => setEditingVehicle({ ...editingVehicle, vehicle_no: e.target.value })} className="p-1 bg-white border rounded text-xs flex-1 mr-2" />
                    ) : (
                      <span className="font-bold text-[#1F2937]">{v.vehicle_no}</span>
                    )}

                    <div className="flex items-center gap-1">
                      {editingVehicle?.id === v.id ? (
                        <>
                          <button onClick={() => handleUpdateVehicle(v.id, editingVehicle.vehicle_no)} className="px-2 py-1 bg-emerald-600 text-white rounded text-[11px] font-bold">저장</button>
                          <button onClick={() => setEditingVehicle(null)} className="px-2 py-1 border rounded text-[11px]">취소</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setEditingVehicle(v)} className="p-1 text-[#243B5A] hover:bg-slate-200 rounded"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleDeleteVehicle(v.id)} className="p-1 text-red-600 hover:bg-slate-200 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 호선 관리 모달 */}
      {isVesselManagerOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4" onClick={() => setIsVesselManagerOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-[#243B5A]">호선 관리</h3>
              <button onClick={() => setIsVesselManagerOpen(false)} className="p-1 rounded-lg text-[#64748B] hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex gap-2">
                <input type="text" placeholder="새 호선명 입력" value={newVesselName} onChange={(e) => setNewVesselName(e.target.value)} className="flex-1 p-2 bg-[#F5F6F8] border rounded-lg text-xs" />
                <button type="button" onClick={handleAddVessel} className="px-4 bg-[#243B5A] text-white rounded-lg text-xs font-bold">추가</button>
              </div>

              <div className="space-y-1.5 pt-2 border-t">
                {vessels.map((v) => (
                  <div key={v.id} className="flex items-center justify-between bg-[#F5F6F8] p-2 rounded-lg">
                    {editingVessel?.id === v.id ? (
                      <input type="text" value={editingVessel.name} onChange={(e) => setEditingVessel({ ...editingVessel, name: e.target.value })} className="p-1 bg-white border rounded text-xs flex-1 mr-2" />
                    ) : (
                      <span className="font-bold text-[#1F2937]">{v.name}</span>
                    )}

                    <div className="flex items-center gap-1">
                      {editingVessel?.id === v.id ? (
                        <>
                          <button onClick={() => handleUpdateVessel(v.id, editingVessel.name)} className="px-2 py-1 bg-emerald-600 text-white rounded text-[11px] font-bold">저장</button>
                          <button onClick={() => setEditingVessel(null)} className="px-2 py-1 border rounded text-[11px]">취소</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setEditingVessel(v)} className="p-1 text-[#243B5A] hover:bg-slate-200 rounded"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleDeleteVessel(v.id)} className="p-1 text-red-600 hover:bg-slate-200 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 주간업무 불러오기 모달 */}
      {isWeeklyImportModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4" onClick={() => setIsWeeklyImportModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-[#243B5A]">주간업무를 일일업무로 불러오기</h3>
              <button onClick={() => setIsWeeklyImportModalOpen(false)} className="p-1 rounded-lg text-[#64748B] hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-[#64748B]">적용할 일일업무 일자</label>
                <CalendarDatePicker value={importTargetDate} onChange={(val) => setImportTargetDate(val)} />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between font-bold text-[#64748B] border-b pb-1">
                  <span>이번 주 주간업무 목록</span>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={tasks.filter(t => t.task_type === 'WEEKLY').length > 0 && selectedWeeklyIdsToImport.length === tasks.filter(t => t.task_type === 'WEEKLY').length}
                      onChange={(e) => {
                        const weeklyTasks = tasks.filter(t => t.task_type === 'WEEKLY');
                        setSelectedWeeklyIdsToImport(e.target.checked ? weeklyTasks.map(t => t.id) : []);
                      }}
                      className="accent-[#243B5A]"
                    />
                    전체 선택
                  </label>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {tasks.filter(t => t.task_type === 'WEEKLY').map((t) => (
                    <label key={t.id} className="flex items-center justify-between bg-[#F5F6F8] p-2 rounded-lg cursor-pointer hover:bg-slate-100">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedWeeklyIdsToImport.includes(t.id)}
                          onChange={(e) => {
                            setSelectedWeeklyIdsToImport(prev => e.target.checked ? [...prev, t.id] : prev.filter(id => id !== t.id));
                          }}
                          className="accent-[#243B5A]"
                        />
                        <div>
                          <div className="font-bold text-[#1F2937]">{t.title}</div>
                          <div className="text-[10px] text-[#64748B]">{t.category || ''} {t.start_date}</div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setIsWeeklyImportModalOpen(false)} className="px-4 py-2 border rounded-lg text-xs font-semibold">취소</button>
                <button type="button" onClick={handleImportWeeklyToDaily} className="px-4 py-2 bg-[#243B5A] text-white rounded-lg text-xs font-bold">불러오기</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 커스텀 알림/확인 모달 */}
      {customAlert.open && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 p-4" onClick={() => setCustomAlert({ ...customAlert, open: false })}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#243B5A]">{customAlert.title}</h3>
              <p className="text-xs text-[#64748B] whitespace-pre-wrap">{customAlert.message}</p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              {customAlert.type === 'confirm' ? (
                <>
                  <button type="button" onClick={() => setCustomAlert({ ...customAlert, open: false })} className="px-4 py-2 border rounded-lg text-xs font-semibold">취소</button>
                  <button type="button" onClick={() => { const cb = customAlert.onConfirm; setCustomAlert({ ...customAlert, open: false }); if (cb) cb(); }} className="px-4 py-2 bg-[#243B5A] text-white rounded-lg text-xs font-bold">확인</button>
                </>
              ) : customAlert.type === 'monthlyDelete' ? (
                <div className="flex items-center justify-between w-full">
                  {customAlert.onDownload && (
                    <button type="button" onClick={() => { if (customAlert.onDownload) customAlert.onDownload(); }} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold">엑셀 먼저 다운로드</button>
                  )}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setCustomAlert({ ...customAlert, open: false })} className="px-3 py-2 border rounded-lg text-xs font-semibold">취소</button>
                    <button type="button" onClick={() => { const cb = customAlert.onConfirm; setCustomAlert({ ...customAlert, open: false }); if (cb) cb(); }} className="px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-bold">삭제 진행</button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setCustomAlert({ ...customAlert, open: false })} className="px-4 py-2 bg-[#243B5A] text-white rounded-lg text-xs font-bold">확인</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 미완료 업무 알림 팝업 (모달) */}
      {isAlertOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4" onClick={() => setIsAlertOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-amber-800 flex items-center gap-1.5"><Bell className="h-4 w-4 animate-bounce" /> 미완료 업무 알림 ({myAssignedTasks.length}건)</h3>
              <button onClick={() => setIsAlertOpen(false)} className="p-1 rounded-lg text-[#64748B] hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-2">
              {myAssignedTasks.length === 0 ? (
                <div className="text-xs text-[#64748B] py-6 text-center">확인해야 할 미완료 업무가 없습니다.</div>
              ) : (
                myAssignedTasks.map((t) => (
                  <div key={t.id} onClick={() => { setIsAlertOpen(false); handleOpenTaskDetail(t); }} className="bg-amber-50/60 border border-amber-200 p-3 rounded-xl text-xs space-y-1 cursor-pointer hover:bg-amber-100/60">
                    <div className="flex items-center justify-between font-bold text-amber-900">
                      <span>{t.category || '일반'} {t.cargo_hold ? `(${t.cargo_hold})` : ''}</span>
                      <span className="font-mono text-[10px] text-amber-700">{formatToShortDate(t.start_date)}</span>
                    </div>
                    <div className="font-bold text-[#1F2937]">{t.title}</div>
                    <div className="text-[11px] text-[#64748B]">담당: {t.assigned_names?.join(', ') || '미지정'}</div>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end pt-2 border-t">
              <button onClick={() => setIsAlertOpen(false)} className="px-4 py-2 bg-[#243B5A] text-white rounded-lg text-xs font-bold">확인</button>
            </div>
          </div>
        </div>
      )}

      {/* 업무 상세 보기 시트 (모달) */}
      {selectedTaskForSheet && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedTaskForSheet(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 bg-[#243B5A] text-white font-bold rounded text-xs">{selectedTaskForSheet.category || '호선 미지정'}</span>
                {selectedTaskForSheet.cargo_hold && <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded text-xs">{selectedTaskForSheet.cargo_hold}</span>}
              </div>
              <button onClick={() => setSelectedTaskForSheet(null)} className="p-1 rounded-lg text-[#64748B] hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="text-[10px] font-bold text-[#64748B] uppercase">업무명</div>
                <div className="text-sm font-bold text-[#1F2937] mt-0.5">{selectedTaskForSheet.title}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-[#F5F6F8] p-2.5 rounded-xl">
                <div>
                  <span className="text-[10px] text-[#64748B] block">일자</span>
                  <span className="font-mono font-bold text-[#1F2937]">{formatToShortDate(selectedTaskForSheet.start_date)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#64748B] block">시간대</span>
                  <span className="font-semibold text-[#2563EB]">{formatShortTimeSlot(selectedTaskForSheet.time_slot) || '-'}</span>
                </div>
              </div>

              {selectedTaskForSheet.description && (
                <div>
                  <div className="text-[10px] font-bold text-[#64748B] uppercase">상세 내용</div>
                  <div className="bg-[#F5F6F8] p-3 rounded-xl mt-1 text-[#1F2937] whitespace-pre-wrap">{selectedTaskForSheet.description}</div>
                </div>
              )}

              {selectedTaskForSheet.remarks && (
                <div>
                  <div className="text-[10px] font-bold text-[#64748B] uppercase">비고란 (특이사항)</div>
                  <div className="bg-amber-50/60 border border-amber-200 p-3 rounded-xl mt-1 text-amber-900 whitespace-pre-wrap">{selectedTaskForSheet.remarks}</div>
                </div>
              )}

              <div>
                <div className="text-[10px] font-bold text-[#64748B] uppercase mb-1">담당 인원 ({selectedTaskForSheet.assigned_names?.length || 0}명)</div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTaskForSheet.assigned_names?.length ? (
                    selectedTaskForSheet.assigned_names.map((name) => (
                      <button key={name} type="button" onClick={() => handleCallWorker(name)} className="inline-flex items-center gap-1 bg-blue-50 border border-blue-100 text-[#243B5A] px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-100">
                        <span>📞</span>
                        <span>{name}</span>
                      </button>
                    ))
                  ) : (
                    <span className="text-[#94A3B8]">미지정</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                {canModifyTaskStatus(selectedTaskForSheet) && (
                  <button onClick={() => { const task = selectedTaskForSheet; setSelectedTaskForSheet(null); setStatusChangeModal({ open: true, task, targetStatus: task.status, remarks: task.remarks || '' }); }} className="px-3 py-1.5 bg-[#243B5A] text-white font-bold rounded-lg text-xs">상태/비고 변경</button>
                )}
                <button onClick={() => setSelectedTaskForSheet(null)} className="px-3 py-1.5 border rounded-lg font-semibold text-xs text-[#64748B]">닫기</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
