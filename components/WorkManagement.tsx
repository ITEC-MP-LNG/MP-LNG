'use client';

import React, { useState, useEffect } from 'react';
import { 
  Clock, User, CheckCircle2, Pencil, Trash2, Calendar as CalendarIcon, 
  Plus, X, ChevronLeft, ChevronRight, Bell, Home, Tag, Sun, Moon, 
  LayoutGrid, List, Settings, Eye, Check, AlertCircle, PlayCircle, PlusCircle,
  Download, Users, History, FileSpreadsheet, Layers, FileText
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  task_type: 'DAILY' | 'WEEKLY' | 'CABIN';
  category?: string;
  remarks?: string;
}

export interface CabinVessel {
  id: string;
  name: string;
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
  phone?: string;
}

const formatDateToYYYYMMDD = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMonday = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
};

export default function WorkManagement({ currentUser }: { currentUser?: { id: string; name: string; role: string } | null }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [vessels, setVessels] = useState<CabinVessel[]>([]);
  const [presetTeams, setPresetTeams] = useState<PresetTeam[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [validUserNames, setValidUserNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 관리자 권한 여부 확인
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'admin' || currentUser?.role === '관리자';

  // 탭 및 서브탭 상태
  const [taskTab, setTaskTab] = useState<'DAILY' | 'WEEKLY' | 'CABIN'>('DAILY');
  const [dailySubTab, setDailySubTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE'); 
  const [cabinSubTab, setCabinSubTab] = useState<string>('ALL');

  // 주간 업무 뷰 & 월 선택 (엑셀 추출용)
  const [weeklyViewMode, setWeeklyViewMode] = useState<'GRID' | 'LIST'>('GRID');
  const [currentWeekMonday, setCurrentWeekMonday] = useState<Date>(() => getMonday(new Date()));
  const [selectedExportMonth, setSelectedExportMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // 커스텀 통일 알림 모달 상태
  const [customAlert, setCustomAlert] = useState<{ open: boolean; title: string; message: string; type?: 'info' | 'confirm'; onConfirm?: () => void; confirmLabel?: string; cancelLabel?: string }>({
    open: false,
    title: '',
    message: '',
    type: 'info',
    confirmLabel: '확인',
    cancelLabel: '취소'
  });

  const showCustomAlert = (title: string, message: string) => {
    setCustomAlert({ open: true, title, message, type: 'info' });
  };

  const showCustomConfirm = (title: string, message: string, onConfirm: () => void, confirmLabel = '확인', cancelLabel = '취소') => {
    setCustomAlert({ open: true, title, message, type: 'confirm', onConfirm, confirmLabel, cancelLabel });
  };

  // 팝업 미완료 알림 상태
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [myAssignedTasks, setMyAssignedTasks] = useState<Task[]>([]);

  // 바텀시트 모달 (상세보기)
  const [selectedTaskForSheet, setSelectedTaskForSheet] = useState<Task | null>(null);

  // 상태 변경 모달 (상세보기, 버튼 직접 선택 및 비고 수정)
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

  // 호선 관리 모달
  const [isVesselManagerOpen, setIsVesselManagerOpen] = useState(false);
  const [newVesselName, setNewVesselName] = useState('');
  const [editingVessel, setEditingVessel] = useState<CabinVessel | null>(null);

  // Team 관리 모달
  const [isTeamManagerOpen, setIsTeamManagerOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDept, setNewTeamDept] = useState('');
  const [newTeamMembersText, setNewTeamMembersText] = useState('');
  const [editingTeam, setEditingTeam] = useState<PresetTeam | null>(null);
  const [editTeamMembersText, setEditTeamMembersText] = useState('');

  // 업무 등록/수정 모달 & 인원 개별 및 그룹 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: formatDateToYYYYMMDD(new Date()),
    end_date: formatDateToYYYYMMDD(new Date()),
    time_slot: '09:00 - 18:00',
    task_type: 'DAILY' as 'DAILY' | 'WEEKLY' | 'CABIN',
    category: '',
    remarks: '',
  });

  // 개별 인원 목록 관리
  const [assignedList, setAssignedList] = useState<string[]>([]);
  const [dayWorkerList, setDayWorkerList] = useState<string[]>([]);
  const [nightWorkerList, setNightWorkerList] = useState<string[]>([]);
  const [singleWorkerInput, setSingleWorkerInput] = useState('');

  // ── 모바일 뒤로가기: 열려 있는 모달을 우선 닫는다 ──
  useEffect(() => {
    const handleAppBack = (e: Event) => {
      const event = e as CustomEvent<{ handled: boolean }>;
      if (event.detail?.handled) return;

      if (isModalOpen)          { setIsModalOpen(false);          event.detail.handled = true; return; }
      if (isVesselManagerOpen)  { setIsVesselManagerOpen(false);  event.detail.handled = true; return; }
      if (isTeamManagerOpen)    { setIsTeamManagerOpen(false);    event.detail.handled = true; return; }
      if (isAlertOpen)          { setIsAlertOpen(false);          event.detail.handled = true; return; }
    };
    window.addEventListener('app-back', handleAppBack);
    return () => window.removeEventListener('app-back', handleAppBack);
  }, [isModalOpen, isVesselManagerOpen, isTeamManagerOpen, isAlertOpen]);

  // app_users 인원 및 부서(department) 불러오기
  const fetchAppUsers = async () => {
    try {
      const { data, error } = await supabase.from('app_users').select('name, department, phone');
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
  };

  // CABIN 호선 목록 조회
  const fetchVessels = async () => {
    try {
      const { data, error } = await supabase.from('cabin_vessels').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      if (data) {
        setVessels(data);
        if (data.length > 0 && !formData.category) {
          setFormData((prev) => ({ ...prev, category: data[0].name }));
        }
      }
    } catch (err) {
      console.error('vessels 로드 실패:', err);
    }
  };

  // Preset Teams 조회
  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase.from('preset_teams').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      if (data) {
        setPresetTeams(data);
      }
    } catch (err) {
      console.error('preset_teams 로드 실패:', err);
    }
  };

  // 전체 업무 데이터 및 팝업 알림 체크
  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('tasks').select('*').order('start_date', { ascending: true });
      if (error) throw error;

      if (data) {
        const formatted: Task[] = data.map((t: any) => ({
          ...t,
          status: t.status || 'PENDING',
          assigned_names: Array.isArray(t.assigned_names) ? t.assigned_names : (t.assigned_names ? t.assigned_names.split(',').map((s: string) => s.trim()) : []),
          day_workers: Array.isArray(t.day_workers) ? t.day_workers : (t.day_workers ? t.day_workers.split(',').map((s: string) => s.trim()) : []),
          night_workers: Array.isArray(t.night_workers) ? t.night_workers : (t.night_workers ? t.night_workers.split(',').map((s: string) => s.trim()) : []),
        }));

        setTasks(formatted);

        let targetTasks: Task[] = [];
        if (currentUser && currentUser.name) {
          const currentUserName = currentUser.name.trim().toLowerCase();
          targetTasks = formatted.filter((t) => {
            if (t.status === 'COMPLETED') return false;
            const isAssigned = (t.assigned_names || []).some(name => name.trim().toLowerCase() === currentUserName);
            const isDayWorker = (t.day_workers || []).some(name => name.trim().toLowerCase() === currentUserName);
            const isNightWorker = (t.night_workers || []).some(name => name.trim().toLowerCase() === currentUserName);
            return isAssigned || isDayWorker || isNightWorker;
          });
        } else {
          targetTasks = formatted.filter((t) => t.status !== 'COMPLETED');
        }

        setMyAssignedTasks(targetTasks);
        if (targetTasks.length > 0) setIsAlertOpen(true);
      }
    } catch (err) {
      console.error('tasks 로드 실패:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAppUsers();
    fetchVessels();
    fetchTeams();
    fetchTasks();
  }, [currentUser]);

  // 해당 업무 변경 권한 확인 (현재 로직 그대로 유지)
  const canModifyTaskStatus = (task: Task) => {
    if (isAdmin) return true;
    if (task.task_type === 'WEEKLY' || task.task_type === 'CABIN') return false;
    if (!currentUser || !currentUser.name) return false;

    const name = currentUser.name.trim().toLowerCase();
    const assigned = (task.assigned_names || []).map(n => n.trim().toLowerCase());
    const day = (task.day_workers || []).map(n => n.trim().toLowerCase());
    const night = (task.night_workers || []).map(n => n.trim().toLowerCase());

    return assigned.includes(name) || day.includes(name) || night.includes(name);
  };

  // 호선 관리 관련
  const handleAddVessel = async () => {
    if (!isAdmin) { showCustomAlert('권한 없음', '관리자 권한이 없습니다.'); return; }
    if (!newVesselName.trim()) return;
    try {
      const { error } = await supabase.from('cabin_vessels').insert([{ name: newVesselName.trim() }]);
      if (error) throw error;
      setNewVesselName('');
      fetchVessels();
      showCustomAlert('성공', '호선이 추가되었습니다.');
    } catch (err: any) { showCustomAlert('오류', `호선 추가 실패: ${err.message}`); }
  };

  const handleUpdateVessel = async (id: string, name: string) => {
    if (!isAdmin) { showCustomAlert('권한 없음', '관리자 권한이 없습니다.'); return; }
    if (!name.trim()) return;
    try {
      const { error } = await supabase.from('cabin_vessels').update({ name: name.trim() }).eq('id', id);
      if (error) throw error;
      setEditingVessel(null);
      fetchVessels();
      showCustomAlert('성공', '호선 정보가 수정되었습니다.');
    } catch (err: any) { showCustomAlert('오류', `호선 수정 실패: ${err.message}`); }
  };

  const handleDeleteVessel = async (id: string) => {
    if (!isAdmin) { showCustomAlert('권한 없음', '관리자 권한이 없습니다.'); return; }
    showCustomConfirm('호선 삭제', '이 호선을 삭제하시겠습니까?', async () => {
      try {
        const { error } = await supabase.from('cabin_vessels').delete().eq('id', id);
        if (error) throw error;
        fetchVessels();
        showCustomAlert('완료', '호선이 삭제되었습니다.');
      } catch (err: any) { showCustomAlert('오류', `호선 삭제 실패: ${err.message}`); }
    });
  };

  // Team 관리 관련
  const handleAddTeam = async () => {
    if (!isAdmin) { showCustomAlert('권한 없음', '관리자 권한이 없습니다.'); return; }
    if (!newTeamName.trim()) { showCustomAlert('입력 오류', 'Team 이름을 입력해주세요.'); return; }
    
    const members = newTeamMembersText
      .split(',')
      .map(m => m.trim())
      .filter(Boolean);

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
  };

  const handleUpdateTeam = async (id: string) => {
    if (!isAdmin) { showCustomAlert('권한 없음', '관리자 권한이 없습니다.'); return; }
    if (!editingTeam || !editingTeam.name.trim()) return;

    const members = editTeamMembersText
      .split(',')
      .map(m => m.trim())
      .filter(Boolean);

    try {
      const { error } = await supabase
        .from('preset_teams')
        .update({ 
          name: editingTeam.name.trim(), 
          department: editingTeam.department?.trim() || null,
          members 
        })
        .eq('id', id);
      if (error) throw error;
      setEditingTeam(null);
      setEditTeamMembersText('');
      fetchTeams();
      showCustomAlert('성공', 'Team 정보가 수정되었습니다.');
    } catch (err: any) { showCustomAlert('오류', `Team 수정 실패: ${err.message}`); }
  };

  const handleDeleteTeam = async (id: string) => {
    if (!isAdmin) { showCustomAlert('권한 없음', '관리자 권한이 없습니다.'); return; }
    showCustomConfirm('Team 삭제', '해당 Team을 정말 삭제하시겠습니까?', async () => {
      try {
        const { error } = await supabase.from('preset_teams').delete().eq('id', id);
        if (error) throw error;
        fetchTeams();
        showCustomAlert('완료', 'Team이 삭제되었습니다.');
      } catch (err: any) { showCustomAlert('오류', `Team 삭제 실패: ${err.message}`); }
    });
  };

  const handleSelectDepartmentUsersToNewTeam = (dept: string) => {
    setNewTeamDept(dept);
    const deptMembers = appUsers
      .filter(u => u.department === dept)
      .map(u => u.name.trim())
      .filter(Boolean);
    
    setNewTeamMembersText(deptMembers.join(', '));
  };

  // 일일업무 담당자 전화 연결
  const handleCallWorker = (workerName: string) => {
    const worker = appUsers.find(
      (u) => u.name?.trim().toLowerCase() === workerName.trim().toLowerCase()
    );
    const phone = worker?.phone?.trim();

    if (!phone) {
      showCustomAlert('전화 연결', `${workerName}님의 전화번호가 등록되어 있지 않습니다.`);
      return;
    }

    showCustomConfirm(
      '전화 연결',
      `${workerName}님에게 전화 연결 하시겠습니까?`,
      () => {
        window.location.href = `tel:${phone.replace(/[^0-9+]/g, '')}`;
      },
      '예',
      '아니오'
    );
  };

  // 상태 변경 버튼 클릭 시 (상세보기 및 비고 입력 모달 호출)
  const handleNextStatus = (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();

    if (!canModifyTaskStatus(task)) {
      if (task.task_type === 'WEEKLY' || task.task_type === 'CABIN') {
        showCustomAlert('권한 없음', '주간 업무 및 CABIN 업무의 상태는 관리자만 변경할 수 있습니다.');
      } else {
        showCustomAlert('권한 없음', '해당 업무를 진행하는 인원만 상태 변경이 가능합니다.');
      }
      return;
    }

    setStatusChangeModal({
      open: true,
      task: task,
      targetStatus: task.status,
      remarks: task.remarks || ''
    });
  };

  // 상태 및 비고 정보 최종 저장 처리
  const handleConfirmStatusChange = async () => {
    if (!statusChangeModal.task) return;
    const task = statusChangeModal.task;
    const nextStatus = statusChangeModal.targetStatus;
    const remarks = statusChangeModal.remarks;

    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus, remarks } : t)));
    if (selectedTaskForSheet?.id === task.id) {
      setSelectedTaskForSheet({ ...selectedTaskForSheet, status: nextStatus, remarks });
    }

    try {
      const { error } = await supabase.from('tasks').update({ status: nextStatus, remarks }).eq('id', task.id);
      if (error) throw error;
      setStatusChangeModal({ open: false, task: null, targetStatus: 'PENDING', remarks: '' });
      fetchTasks();
      showCustomAlert('성공', '업무 상태 및 비고란이 업데이트 되었습니다.');
    } catch (err: any) {
      showCustomAlert('오류', `상태 변경 실패: ${err.message}`);
    }
  };

  const renderStatusBadge = (task: Task) => {
    const statusConfig = {
      PENDING: { label: '대기', bg: 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200', icon: AlertCircle },
      IN_PROGRESS: { label: '진행중', bg: 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600 shadow-xs', icon: PlayCircle },
      COMPLETED: { label: '완료', bg: 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300', icon: CheckCircle2 },
    };
    const config = statusConfig[task.status] || statusConfig.PENDING;
    const Icon = config.icon;

    return (
      <button
        onClick={(e) => handleNextStatus(e, task)}
        title="클릭 시 상태 및 비고란 변경 모달 호출"
        className={`px-2.5 py-1 rounded-full border text-[11px] font-bold flex items-center gap-1 transition-all shrink-0 ${config.bg}`}
      >
        <Icon className="h-3.5 w-3.5" />
        <span>{config.label}</span>
      </button>
    );
  };

  // 모달 열기 (등록)
  const handleOpenCreateModal = (defaultDate?: string, defaultType?: 'DAILY' | 'WEEKLY' | 'CABIN', defaultCategory?: string) => {
    if (!isAdmin) { showCustomAlert('권한 제한', '관리자만 업무를 등록할 수 있습니다.'); return; }
    setEditingTask(null);
    setFormData({
      title: '',
      description: '',
      start_date: defaultDate || formatDateToYYYYMMDD(new Date()),
      end_date: defaultDate || formatDateToYYYYMMDD(new Date()),
      time_slot: '09:00 - 18:00',
      task_type: defaultType || taskTab,
      category: defaultCategory || (vessels.length > 0 ? vessels[0].name : ''),
      remarks: '',
    });
    setAssignedList([]);
    setDayWorkerList([]);
    setNightWorkerList([]);
    setSingleWorkerInput('');
    setIsModalOpen(true);
  };

  // 모달 열기 (수정)
  const handleOpenTaskEdit = (task: Task) => {
    if (!isAdmin) { showCustomAlert('권한 제한', '관리자만 업무를 수정할 수 있습니다.'); return; }
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      start_date: task.start_date,
      end_date: task.end_date || task.start_date,
      time_slot: task.time_slot || '09:00 - 18:00',
      task_type: task.task_type || 'CABIN',
      category: task.category || (vessels.length > 0 ? vessels[0].name : ''),
      remarks: task.remarks || '',
    });
    setAssignedList(task.assigned_names || []);
    setDayWorkerList(task.day_workers || []);
    setNightWorkerList(task.night_workers || []);
    setSingleWorkerInput('');
    setIsModalOpen(true);
  };

  // 인원 1명씩 추가 / Team 불러오기 반영 핸들러
  const handleAddWorkerSingle = (target: 'ASSIGNED' | 'DAY' | 'NIGHT') => {
    if (!singleWorkerInput.trim()) return;
    const name = singleWorkerInput.trim();
    if (target === 'ASSIGNED' && !assignedList.includes(name)) setAssignedList([...assignedList, name]);
    if (target === 'DAY' && !dayWorkerList.includes(name)) setDayWorkerList([...dayWorkerList, name]);
    if (target === 'NIGHT' && !nightWorkerList.includes(name)) setNightWorkerList([...nightWorkerList, name]);
    setSingleWorkerInput('');
  };

  const handleApplyTeamOrDept = (value: string, target: 'ASSIGNED' | 'DAY' | 'NIGHT') => {
    if (!value) return;
    
    let selectedMembers: string[] = [];

    if (value.startsWith('TEAM_')) {
      const teamId = value.replace('TEAM_', '');
      const targetTeam = presetTeams.find(t => t.id === teamId);
      if (targetTeam) selectedMembers = targetTeam.members || [];
    } else if (value.startsWith('DEPT_')) {
      const deptName = value.replace('DEPT_', '');
      selectedMembers = appUsers
        .filter(u => u.department === deptName)
        .map(u => u.name.trim())
        .filter(Boolean);
    }

    if (selectedMembers.length === 0) return;

    if (target === 'ASSIGNED') setAssignedList(Array.from(new Set([...assignedList, ...selectedMembers])));
    if (target === 'DAY') setDayWorkerList(Array.from(new Set([...dayWorkerList, ...selectedMembers])));
    if (target === 'NIGHT') setNightWorkerList(Array.from(new Set([...nightWorkerList, ...selectedMembers])));
  };

  const handleRemoveWorker = (name: string, target: 'ASSIGNED' | 'DAY' | 'NIGHT') => {
    if (target === 'ASSIGNED') setAssignedList(assignedList.filter(n => n !== name));
    if (target === 'DAY') setDayWorkerList(dayWorkerList.filter(n => n !== name));
    if (target === 'NIGHT') setNightWorkerList(nightWorkerList.filter(n => n !== name));
  };

  // 업무 저장
  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) { showCustomAlert('권한 제한', '관리자 권한이 없습니다.'); return; }
    if (!formData.title.trim()) return;

    try {
      if (formData.task_type === 'WEEKLY' && !editingTask) {
        const start = new Date(formData.start_date);
        const end = new Date(formData.end_date);

        if (start > end) {
          showCustomAlert('입력 오류', '종료일은 시작일보다 이전일 수 없습니다.');
          return;
        }

        const insertPayloads = [];
        const current = new Date(start);

        while (current <= end) {
          const dateStr = formatDateToYYYYMMDD(current);
          insertPayloads.push({
            title: formData.title.trim(),
            description: formData.description.trim(),
            start_date: dateStr,
            end_date: dateStr,
            time_slot: formData.time_slot.trim(),
            task_type: 'WEEKLY',
            status: 'PENDING',
            assigned_names: assignedList,
            remarks: formData.remarks.trim(),
            category: null,
            day_workers: null,
            night_workers: null,
          });
          current.setDate(current.getDate() + 1);
        }

        const { error } = await supabase.from('tasks').insert(insertPayloads);
        if (error) throw error;
      } else {
        let payload: any = {
          title: formData.title.trim(),
          description: formData.description.trim(),
          start_date: formData.start_date,
          task_type: formData.task_type,
          status: editingTask ? editingTask.status : 'PENDING',
          remarks: formData.remarks.trim(),
        };

        if (formData.task_type === 'CABIN') {
          payload = {
            ...payload,
            end_date: formData.end_date,
            day_workers: dayWorkerList,
            night_workers: nightWorkerList,
            category: formData.category,
            time_slot: null,
            assigned_names: null,
          };
        } else {
          payload = {
            ...payload,
            end_date: formData.task_type === 'WEEKLY' ? formData.end_date : formData.start_date,
            time_slot: formData.time_slot.trim(),
            assigned_names: assignedList,
            category: null,
            day_workers: null,
            night_workers: null,
          };
        }

        if (editingTask) {
          const { error } = await supabase.from('tasks').update(payload).eq('id', editingTask.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('tasks').insert([payload]);
          if (error) throw error;
        }
      }

      setIsModalOpen(false);
      setSelectedTaskForSheet(null);
      fetchTasks();
      showCustomAlert('성공', '업무가 정상적으로 저장되었습니다.');
    } catch (err: any) { showCustomAlert('오류', `저장 중 오류: ${err.message}`); }
  };

  // 업무 삭제
  const handleDeleteTask = async (id: string) => {
    if (!isAdmin) { showCustomAlert('권한 제한', '관리자만 업무를 삭제할 수 있습니다.'); return; }
    showCustomConfirm('업무 삭제', '해당 항목을 정말로 삭제하시겠습니까?', async () => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (!error) {
        setSelectedTaskForSheet(null);
        fetchTasks();
        showCustomAlert('삭제 완료', '성공적으로 삭제되었습니다.');
      } else {
        showCustomAlert('오류', `삭제 실패: ${error.message}`);
      }
    });
  };

  // 달력 형식 주간 업무 엑셀 다운로드
  const handleExportWeeklyExcel = () => {
    const [yearStr, monthStr] = selectedExportMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);

    const monthlyWeeklyTasks = tasks.filter(t => {
      if (t.task_type !== 'WEEKLY') return false;
      const d = new Date(t.start_date);
      return d.getFullYear() === year && (d.getMonth() + 1) === month;
    });

    const excelData: any[] = [];
    excelData.push([`${year}년 ${month}월 주간 업무 달력`]);
    excelData.push([]);
    excelData.push(['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일']);

    let currentDayIter = getMonday(firstDayOfMonth);
    const endIter = new Date(lastDayOfMonth);
    
    while (currentDayIter <= endIter || currentDayIter.getDay() !== 1) {
      const weekRowDates: string[] = [];
      const weekRowTasksText: string[] = [];

      for (let i = 0; i < 7; i++) {
        const dateStr = formatDateToYYYYMMDD(currentDayIter);
        const dayNum = currentDayIter.getDate();
        const isCurrentMonth = currentDayIter.getMonth() + 1 === month;

        weekRowDates.push(isCurrentMonth ? `${dayNum}일` : `(${dayNum}일)`);

        if (isCurrentMonth) {
          const matchedTasks = monthlyWeeklyTasks.filter(t => t.start_date === dateStr);
          if (matchedTasks.length > 0) {
            const taskText = matchedTasks.map((t, idx) => {
              const statusStr = t.status === 'COMPLETED' ? '완료' : t.status === 'IN_PROGRESS' ? '진행중' : '대기';
              const assignees = t.assigned_names?.length ? `[${t.assigned_names.join(', ')}]` : '';
              const timeSlotStr = t.time_slot ? `(${t.time_slot}) ` : '';
              const remarksStr = t.remarks ? ` [비고: ${t.remarks}]` : '';
              return `${idx + 1}. ${timeSlotStr}${t.title} ${assignees} - ${statusStr}${remarksStr}`;
            }).join('\n');
            weekRowTasksText.push(taskText);
          } else {
            weekRowTasksText.push('-');
          }
        } else {
          weekRowTasksText.push('');
        }

        currentDayIter.setDate(currentDayIter.getDate() + 1);
      }

      excelData.push(weekRowDates);
      excelData.push(weekRowTasksText);
      excelData.push([]);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(excelData);
    
    worksheet['!cols'] = [
      { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${month}월 달력 업무`);
    XLSX.writeFile(workbook, `주간업무_달력_${year}_${month}월.xlsx`);
    showCustomAlert('엑셀 다운로드', `${year}년 ${month}월 주간 업무 달력이 엑셀 파일로 추출되었습니다.`);
  };

  // 주간 날짜 계산
  const weekDays = Array.from({ length: 7 }, (_, i) => {
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

  const changeWeek = (direction: 'prev' | 'next') => {
    const newMonday = new Date(currentWeekMonday);
    newMonday.setDate(currentWeekMonday.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeekMonday(newMonday);
  };

  // 필터링된 업무 목록
  const filteredTasks = tasks.filter((t) => {
    if ((t.task_type || 'CABIN') !== taskTab) return false;
    
    if (taskTab === 'DAILY') {
      if (dailySubTab === 'ACTIVE') return t.status !== 'COMPLETED';
      if (dailySubTab === 'HISTORY') return t.status === 'COMPLETED';
    }

    if (taskTab === 'CABIN' && cabinSubTab !== 'ALL') return t.category === cabinSubTab;
    return true;
  });

  return (
    <div className="bg-[#F5F6F8] min-h-screen w-full text-[#1F2937] p-0 m-0">
      <div className="w-full bg-white border-b border-[#E2E5E9] space-y-4">
        
        {/* Header */}
        <div className="flex flex-col gap-3 pb-3 border-b border-[#E2E5E9]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-[#243B5A]/10 text-[#243B5A] rounded-lg shrink-0">
                <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold">운영 및 근무 관리 시스템</h2>
                <p className="text-[11px] sm:text-xs text-[#64748B]">일일, 주간 및 CABIN 업무 편성</p>
              </div>
            </div>

            {isAdmin && (
              <button
                onClick={() => handleOpenCreateModal()}
                className="hidden sm:flex items-center space-x-1 bg-[#243B5A] text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs shrink-0"
              >
                <Plus className="h-4 w-4" />
                <span>등록</span>
              </button>
            )}
          </div>

          {/* 컨트롤바 */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 pt-1">
            <button
              onClick={() => {
                const pending = tasks.filter(t => t.status !== 'COMPLETED');
                setMyAssignedTasks(pending);
                setIsAlertOpen(true);
              }}
              className="col-span-2 sm:col-span-1 flex items-center justify-center space-x-1.5 bg-amber-50 text-amber-900 border border-amber-300 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-amber-100 transition h-9 shrink-0"
            >
              <Bell className="h-3.5 w-3.5 text-amber-600 animate-pulse shrink-0" />
              <span className="truncate">미완료 알림 ({myAssignedTasks.length})</span>
            </button>

            <div className="col-span-2 sm:col-span-auto bg-[#F5F6F8] p-1 rounded-lg border border-[#E2E5E9] grid grid-cols-3 gap-1 h-9 items-center shrink-0">
              <button
                onClick={() => setTaskTab('DAILY')}
                className={`px-3 py-1 text-xs font-semibold rounded-md text-center transition ${taskTab === 'DAILY' ? 'bg-[#243B5A] text-white shadow-2xs' : 'text-[#64748B] hover:text-[#1F2937]'}`}
              >
                일일업무
              </button>
              <button
                onClick={() => setTaskTab('WEEKLY')}
                className={`px-3 py-1 text-xs font-semibold rounded-md text-center transition ${taskTab === 'WEEKLY' ? 'bg-[#243B5A] text-white shadow-2xs' : 'text-[#64748B] hover:text-[#1F2937]'}`}
              >
                주간업무
              </button>
              <button
                onClick={() => setTaskTab('CABIN')}
                className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center justify-center gap-1 transition ${taskTab === 'CABIN' ? 'bg-[#243B5A] text-white shadow-2xs' : 'text-[#64748B] hover:text-[#1F2937]'}`}
              >
                <Home className="h-3 w-3 shrink-0" />
                <span>CABIN</span>
              </button>
            </div>

            {isAdmin && (
              <button
                onClick={() => handleOpenCreateModal()}
                className="col-span-2 sm:hidden flex items-center justify-center space-x-1 bg-[#243B5A] text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-xs h-9"
              >
                <Plus className="h-4 w-4" />
                <span>업무 등록</span>
              </button>
            )}
          </div>
        </div>

        {/* 일일 업무 서브탭 */}
        {taskTab === 'DAILY' && (
          <div className="flex items-center justify-between bg-[#F5F6F8] p-1.5 rounded-xl border border-[#E2E5E9]">
            <div className="flex space-x-1">
              <button
                onClick={() => setDailySubTab('ACTIVE')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1 transition ${dailySubTab === 'ACTIVE' ? 'bg-white text-[#243B5A] font-bold shadow-2xs border' : 'text-[#64748B]'}`}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>진행중 / 대기 업무</span>
              </button>
              <button
                onClick={() => setDailySubTab('HISTORY')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1 transition ${dailySubTab === 'HISTORY' ? 'bg-white text-[#243B5A] font-bold shadow-2xs border' : 'text-[#64748B]'}`}
              >
                <History className="h-3.5 w-3.5" />
                <span>완료 이력 보기 (매주 일요일 23시 초기화)</span>
              </button>
            </div>
          </div>
        )}

        {/* CABIN 호선 선택 서브탭 */}
        {taskTab === 'CABIN' && (
          <div className="flex items-center justify-between bg-[#F5F6F8] p-2 rounded-xl border border-[#E2E5E9]">
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0 [&::-webkit-scrollbar]:h-1">
              <Tag className="h-4 w-4 text-[#64748B] ml-1 shrink-0" />
              <span className="text-xs font-bold text-[#1F2937] mr-1 shrink-0">호선:</span>
              <button
                onClick={() => setCabinSubTab('ALL')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg shrink-0 ${cabinSubTab === 'ALL' ? 'bg-white border text-[#243B5A] font-bold shadow-2xs' : 'text-[#64748B]'}`}
              >
                전체
              </button>
              {vessels.map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    setCabinSubTab(v.name);
                    if (v.name !== 'ALL' && isAdmin) handleOpenCreateModal(undefined, 'CABIN', v.name);
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg shrink-0 flex items-center gap-1 transition ${
                    cabinSubTab === v.name ? 'bg-[#243B5A] text-white font-bold shadow-2xs' : 'bg-white border text-[#243B5A] hover:bg-slate-100'
                  }`}
                >
                  <span>{v.name}</span>
                  {isAdmin && <PlusCircle className="h-3 w-3 opacity-70" />}
                </button>
              ))}
            </div>

            {isAdmin && (
              <button
                onClick={() => setIsVesselManagerOpen(true)}
                className="flex items-center space-x-1 text-xs text-[#243B5A] font-semibold bg-white border px-2.5 py-1.5 rounded-lg shrink-0 hover:bg-slate-50 ml-2"
              >
                <Settings className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">호선 관리</span>
              </button>
            )}
          </div>
        )}

        {/* 컨텐츠 구역 */}
        {isLoading ? (
          <div className="text-center py-16 text-xs text-[#64748B]">로딩 중...</div>
        ) : taskTab === 'DAILY' ? (
          <div className="space-y-2.5">
            {filteredTasks.length === 0 ? (
              <div className="text-center py-12 text-xs text-[#64748B] border border-dashed rounded-xl">
                {dailySubTab === 'ACTIVE' ? '등록된 진행중/대기 일일 업무가 없습니다.' : '완료 이력이 없습니다.'}
              </div>
            ) : (
              filteredTasks.map((t) => (
                <div key={t.id} className="border border-[#E2E5E9] rounded-xl p-3 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-[#243B5A]/40 transition">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-semibold text-[#2563EB] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded font-mono flex items-center gap-1">
                        <Clock className="h-3 w-3 text-[#2563EB]" />
                        {t.time_slot || '시간 미정'}
                      </span>
                      <span className="text-xs text-[#64748B] font-mono">({t.start_date})</span>
                      {renderStatusBadge(t)}
                    </div>
                    <h4 className="font-bold text-sm text-[#1F2937] cursor-pointer hover:underline" onClick={() => setSelectedTaskForSheet(t)}>
                      {t.title}
                    </h4>
                    {t.remarks && (
                      <p className="text-xs text-[#243B5A] bg-blue-50/60 border border-blue-100 px-2.5 py-1 rounded-md mt-1 font-medium">
                        <span className="font-bold">비고:</span> {t.remarks}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between md:justify-end space-x-3">
                    <div className="flex items-center space-x-1.5 text-xs text-[#64748B] bg-[#F5F6F8] px-2.5 py-1 rounded-md border">
                      <User className="h-3.5 w-3.5 shrink-0" />
                      <div className="flex flex-wrap items-center gap-1">
                        {t.assigned_names?.length ? (
                          t.assigned_names.map((name) => (
                            <button
                              key={`${t.id}-${name}`}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (dailySubTab === 'ACTIVE') handleCallWorker(name);
                              }}
                              className={`font-medium text-[#1F2937] rounded px-1.5 py-0.5 transition ${
                                dailySubTab === 'ACTIVE'
                                  ? 'hover:bg-white hover:text-[#2563EB] hover:underline cursor-pointer'
                                  : 'cursor-default'
                              }`}
                            >
                              {name}
                            </button>
                          ))
                        ) : (
                          <span className="font-medium text-[#1F2937]">미지정</span>
                        )}
                      </div>
                    </div>

                    {dailySubTab === 'HISTORY' && isAdmin && (
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleDeleteTask(t.id)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-600 border border-red-200 flex items-center gap-1 hover:bg-red-100 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>삭제</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : taskTab === 'WEEKLY' ? (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between pb-2.5 border-b gap-2">
              <div className="flex items-center space-x-2">
                <button onClick={() => changeWeek('prev')} className="p-1.5 border rounded-lg"><ChevronLeft className="h-4 w-4" /></button>
                <span className="text-xs sm:text-sm font-bold font-mono">{weekDays[0].displayDate} ~ {weekDays[6].displayDate} 일정</span>
                <button onClick={() => changeWeek('next')} className="p-1.5 border rounded-lg"><ChevronRight className="h-4 w-4" /></button>
                <button onClick={() => setCurrentWeekMonday(getMonday(new Date()))} className="text-xs px-2.5 py-1 bg-[#F5F6F8] border rounded-lg font-semibold ml-2">오늘</button>
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                <input
                  type="month"
                  value={selectedExportMonth}
                  onChange={(e) => setSelectedExportMonth(e.target.value)}
                  className="px-2 py-1 text-xs border rounded-lg font-mono"
                />
                <button
                  onClick={handleExportWeeklyExcel}
                  className="flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>달력 엑셀 저장</span>
                </button>

                <div className="bg-[#F5F6F8] p-1 rounded-lg border flex space-x-1">
                  <button
                    onClick={() => setWeeklyViewMode('GRID')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1 ${weeklyViewMode === 'GRID' ? 'bg-[#243B5A] text-white' : 'text-[#64748B]'}`}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">가로</span>
                  </button>
                  <button
                    onClick={() => setWeeklyViewMode('LIST')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1 ${weeklyViewMode === 'LIST' ? 'bg-[#243B5A] text-white' : 'text-[#64748B]'}`}
                  >
                    <List className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">세로</span>
                  </button>
                </div>
              </div>
            </div>

            {weeklyViewMode === 'GRID' ? (
              <div className="overflow-x-auto pb-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:bg-slate-300/50 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                <div className="grid grid-cols-7 gap-2 min-w-[900px]">
                  {weekDays.map((day) => {
                    const dayTasks = filteredTasks.filter((t) => t.start_date === day.dateStr);
                    return (
                      <div key={day.dateStr} className={`rounded-xl border p-2 min-h-[420px] flex flex-col ${day.isToday ? 'border-[#243B5A] bg-[#243B5A]/5' : 'bg-white'}`}>
                        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b">
                          <span className="font-bold text-xs">{day.label} <span className="text-[10px] text-[#64748B] font-mono">{day.displayDate}</span></span>
                          {isAdmin && (
                            <button onClick={() => handleOpenCreateModal(day.dateStr, 'WEEKLY')} className="p-0.5 text-[#243B5A] hover:bg-slate-200 rounded">
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="space-y-2 flex-1 overflow-y-auto">
                          {dayTasks.map((t) => (
                            <div
                              key={t.id}
                              onClick={() => setSelectedTaskForSheet(t)}
                              className="bg-white border rounded-lg p-2 text-xs space-y-1 shadow-2xs cursor-pointer hover:border-[#243B5A]"
                            >
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] text-[#2563EB] font-mono">{t.time_slot || '시간미정'}</span>
                                {renderStatusBadge(t)}
                              </div>
                              <div className="font-bold text-[#1F2937] leading-tight line-clamp-2">{t.title}</div>
                              {t.remarks && (
                                <div className="text-[10px] text-[#243B5A] bg-blue-50/80 px-1.5 py-0.5 rounded truncate">
                                  비고: {t.remarks}
                                </div>
                              )}
                              <div className="text-[10px] text-[#64748B] truncate">{t.assigned_names?.join(', ') || '미지정'}</div>
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
                    <div key={day.dateStr} className={`border rounded-xl p-3 ${day.isToday ? 'border-[#243B5A] bg-[#243B5A]/5' : 'bg-white'}`}>
                      <div className="flex items-center justify-between pb-2 mb-2 border-b">
                        <span className="font-bold text-xs">{day.label} ({day.displayDate})</span>
                        {isAdmin && (
                          <button onClick={() => handleOpenCreateModal(day.dateStr, 'WEEKLY')} className="flex items-center gap-1 text-xs text-[#243B5A] font-semibold">
                            <Plus className="h-3.5 w-3.5" />
                            <span>추가</span>
                          </button>
                        )}
                      </div>

                      {dayTasks.length === 0 ? (
                        <div className="text-xs text-[#64748B] py-1">등록된 일정이 없습니다.</div>
                      ) : (
                        <div className="space-y-2">
                          {dayTasks.map((t) => (
                            <div key={t.id} onClick={() => setSelectedTaskForSheet(t)} className="flex items-center justify-between bg-white border rounded-lg p-2.5 text-xs cursor-pointer hover:border-[#243B5A]">
                              <div className="space-y-1">
                                <div className="flex items-center space-x-2">
                                  <div className="font-bold text-[#1F2937]">{t.title}</div>
                                  {renderStatusBadge(t)}
                                </div>
                                <div className="text-[11px] text-[#64748B]">
                                  시간: {t.time_slot || '시간미정'} | 인원: {t.assigned_names?.join(', ') || '미지정'}
                                </div>
                                {t.remarks && (
                                  <div className="text-[11px] text-[#243B5A] font-medium">비고: {t.remarks}</div>
                                )}
                              </div>
                              <Eye className="h-4 w-4 text-[#64748B]" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredTasks.length === 0 ? (
              <div className="text-center py-12 text-xs text-[#64748B] border border-dashed rounded-xl space-y-2">
                <div>등록된 CABIN 편성이 없습니다.</div>
                {cabinSubTab !== 'ALL' && isAdmin && (
                  <button
                    onClick={() => handleOpenCreateModal(undefined, 'CABIN', cabinSubTab)}
                    className="px-3 py-1 bg-[#243B5A] text-white rounded-lg text-xs font-semibold"
                  >
                    [{cabinSubTab}] 업무 바로 등록하기
                  </button>
                )}
              </div>
            ) : (
              filteredTasks.map((t) => (
                <div key={t.id} className="border border-[#E2E5E9] rounded-xl p-3 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-[#243B5A]/40 transition">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      {t.category && <span className="text-[11px] font-bold text-[#243B5A] bg-[#243B5A]/10 px-2 py-0.5 rounded">{t.category}</span>}
                      <span className="text-xs font-mono font-semibold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                        {t.start_date} ~ {t.end_date || t.start_date}
                      </span>
                      {renderStatusBadge(t)}
                    </div>
                    <h4 className="font-bold text-sm text-[#1F2937]">{t.title}</h4>
                    {t.description && <p className="text-xs text-[#64748B]">{t.description}</p>}
                    {t.remarks && (
                      <p className="text-xs text-[#243B5A] bg-blue-50/60 border border-blue-100 px-2.5 py-1 rounded-md mt-1 font-medium">
                        <span className="font-bold">비고:</span> {t.remarks}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center space-x-1.5 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg text-xs">
                      <Sun className="h-3.5 w-3.5 text-amber-600" />
                      <span className="font-bold text-amber-900">주간:</span>
                      <div className="flex flex-wrap items-center gap-1">
                        {t.day_workers?.length ? (
                          t.day_workers.map((name) => (
                            <button
                              key={`${t.id}-day-${name}`}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (t.status !== 'COMPLETED') handleCallWorker(name);
                              }}
                              className={`font-medium text-amber-800 rounded px-1 transition ${
                                t.status !== 'COMPLETED'
                                  ? 'hover:bg-white hover:text-[#2563EB] hover:underline cursor-pointer'
                                  : 'cursor-default'
                              }`}
                            >
                              {name}
                            </button>
                          ))
                        ) : (
                          <span className="text-amber-800 font-medium">없음</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg text-xs">
                      <Moon className="h-3.5 w-3.5 text-indigo-600" />
                      <span className="font-bold text-indigo-900">야간:</span>
                      <div className="flex flex-wrap items-center gap-1">
                        {t.night_workers?.length ? (
                          t.night_workers.map((name) => (
                            <button
                              key={`${t.id}-night-${name}`}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (t.status !== 'COMPLETED') handleCallWorker(name);
                              }}
                              className={`font-medium text-indigo-800 rounded px-1 transition ${
                                t.status !== 'COMPLETED'
                                  ? 'hover:bg-white hover:text-[#2563EB] hover:underline cursor-pointer'
                                  : 'cursor-default'
                              }`}
                            >
                              {name}
                            </button>
                          ))
                        ) : (
                          <span className="text-indigo-800 font-medium">없음</span>
                        )}
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center space-x-1 border-l pl-2 border-[#E2E5E9]">
                        <button onClick={() => handleOpenTaskEdit(t)} className="p-1 text-[#64748B] hover:text-[#243B5A]"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => handleDeleteTask(t.id)} className="p-1 text-[#64748B] hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 커스텀 알림/확인 모달 */}
        {customAlert.open && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-xl max-w-sm w-full p-4 shadow-2xl space-y-3 border animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-sm font-bold text-[#243B5A]">{customAlert.title}</h3>
                <button onClick={() => setCustomAlert({ ...customAlert, open: false })} className="p-1 text-[#64748B] hover:bg-slate-100 rounded-lg"><X className="h-4 w-4" /></button>
              </div>
              <p className="text-xs text-[#1F2937] leading-relaxed">{customAlert.message}</p>
              <div className="flex justify-end space-x-2 pt-2 border-t text-xs">
                {customAlert.type === 'confirm' ? (
                  <>
                    <button onClick={() => setCustomAlert({ ...customAlert, open: false })} className="px-3 py-1.5 border rounded-lg">{customAlert.cancelLabel || '취소'}</button>
                    <button
                      onClick={() => {
                        setCustomAlert({ ...customAlert, open: false });
                        if (customAlert.onConfirm) customAlert.onConfirm();
                      }}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-semibold"
                    >
                      {customAlert.confirmLabel || '확인'}
                    </button>
                  </>
                ) : (
                  <button onClick={() => setCustomAlert({ ...customAlert, open: false })} className="px-4 py-1.5 bg-[#243B5A] text-white rounded-lg font-semibold">확인</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 미완료 팝업 알림 창 */}
        {isAlertOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-4 sm:p-5 shadow-2xl space-y-4 border animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center space-x-2 text-[#243B5A]">
                  <Bell className="h-5 w-5 text-amber-500 animate-bounce" />
                  <h3 className="text-sm font-bold">배정된 미완료 알림 안내</h3>
                </div>
                <button onClick={() => setIsAlertOpen(false)} className="p-1 text-[#64748B] hover:bg-slate-100 rounded-lg"><X className="h-4 w-4" /></button>
              </div>

              <p className="text-xs text-[#64748B]">
                현재 미완료 상태인 업무가 총 <span className="font-bold text-red-600">{myAssignedTasks.length}건</span> 있습니다.
              </p>

              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {myAssignedTasks.length === 0 ? (
                  <div className="text-center py-6 text-xs text-[#64748B]">미완료된 업무가 없습니다!</div>
                ) : (
                  myAssignedTasks.map((t) => (
                    <div key={t.id} className="p-2.5 bg-[#F5F6F8] rounded-lg text-xs space-y-1 border flex items-center justify-between">
                      <div>
                        <div className="font-bold text-[#1F2937]">{t.title}</div>
                        <div className="text-[11px] text-[#64748B] font-mono">
                          {t.task_type === 'CABIN' ? `${t.start_date} ~ ${t.end_date}` : `${t.start_date} (${t.time_slot || ''})`}
                        </div>
                      </div>
                      {renderStatusBadge(t)}
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t text-xs">
                <button
                  onClick={() => {
                    localStorage.setItem('cabin_alert_hide_until', formatDateToYYYYMMDD(new Date()));
                    setIsAlertOpen(false);
                  }}
                  className="text-[#64748B] hover:underline font-medium"
                >
                  오늘 하루 보지 않기
                </button>
                <button onClick={() => setIsAlertOpen(false)} className="px-4 py-1.5 bg-[#243B5A] text-white rounded-lg font-semibold">닫기</button>
              </div>
            </div>
          </div>
        )}

        {/* 상태 변경 및 비고 입력 모달 (버튼 직접 선택 구현) */}
        {statusChangeModal.open && statusChangeModal.task && (
          <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-4 sm:p-5 shadow-2xl space-y-4 border animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-[#243B5A]" />
                  <h3 className="text-sm font-bold text-[#1F2937]">상세보기 및 상태 변경</h3>
                </div>
                <button onClick={() => setStatusChangeModal({ open: false, task: null, targetStatus: 'PENDING', remarks: '' })} className="p-1 text-[#64748B] hover:bg-slate-100 rounded-lg">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-[#F5F6F8] rounded-lg border space-y-2">
                  <div className="font-bold text-sm text-[#1F2937]">{statusChangeModal.task.title}</div>
                  <div className="text-[#64748B] font-mono">
                    일시: {statusChangeModal.task.start_date} {statusChangeModal.task.time_slot ? `(${statusChangeModal.task.time_slot})` : ''}
                  </div>
                  {statusChangeModal.task.description && (
                    <div className="text-[#64748B]">설명: {statusChangeModal.task.description}</div>
                  )}
                  <div className="text-[#64748B]">
                    담당자: {statusChangeModal.task.assigned_names?.join(', ') || 
                            [...(statusChangeModal.task.day_workers || []), ...(statusChangeModal.task.night_workers || [])].join(', ') || 
                            '지정 안됨'}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1F2937] mb-1.5">상태 선택</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setStatusChangeModal({ ...statusChangeModal, targetStatus: 'PENDING' })}
                      className={`py-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1 transition ${
                        statusChangeModal.targetStatus === 'PENDING'
                          ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                          : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                      }`}
                    >
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span>대기</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusChangeModal({ ...statusChangeModal, targetStatus: 'IN_PROGRESS' })}
                      className={`py-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1 transition ${
                        statusChangeModal.targetStatus === 'IN_PROGRESS'
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      <span>진행중</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusChangeModal({ ...statusChangeModal, targetStatus: 'COMPLETED' })}
                      className={`py-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1 transition ${
                        statusChangeModal.targetStatus === 'COMPLETED'
                          ? 'bg-slate-700 text-white border-slate-800 shadow-xs'
                          : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>완료</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1F2937] mb-1">비고란 (내용 작성)</label>
                  <textarea
                    rows={3}
                    placeholder="작업 관련 비고 사항을 작성해주세요..."
                    value={statusChangeModal.remarks}
                    onChange={(e) => setStatusChangeModal({ ...statusChangeModal, remarks: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-xs resize-none focus:outline-none focus:border-[#243B5A]"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t text-xs">
                <button
                  onClick={() => setStatusChangeModal({ open: false, task: null, targetStatus: 'PENDING', remarks: '' })}
                  className="px-3.5 py-1.5 border rounded-lg hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  onClick={handleConfirmStatusChange}
                  className="px-4 py-1.5 bg-[#243B5A] text-white rounded-lg font-semibold hover:bg-[#1b2c44]"
                >
                  상태 변경 및 저장
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 상세 바텀시트 */}
        {selectedTaskForSheet && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-xs">
            <div className="bg-white rounded-t-2xl max-w-xl w-full p-4 sm:p-6 shadow-2xl space-y-4 border-t">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded font-mono">
                    {selectedTaskForSheet.start_date} {selectedTaskForSheet.time_slot ? `(${selectedTaskForSheet.time_slot})` : ''}
                  </span>
                  {renderStatusBadge(selectedTaskForSheet)}
                </div>
                <button onClick={() => setSelectedTaskForSheet(null)} className="p-1 text-[#64748B] hover:bg-slate-100 rounded-lg"><X className="h-5 w-5" /></button>
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-bold text-[#1F2937]">{selectedTaskForSheet.title}</h3>
                {selectedTaskForSheet.description && (
                  <p className="text-xs text-[#64748B] bg-[#F5F6F8] p-3 rounded-lg border">{selectedTaskForSheet.description}</p>
                )}
              </div>

              {selectedTaskForSheet.remarks && (
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-[#1F2937]">비고:</div>
                  <div className="text-[#243B5A] bg-blue-50/70 p-2.5 rounded-lg border border-blue-100">
                    {selectedTaskForSheet.remarks}
                  </div>
                </div>
              )}

              <div className="space-y-1 text-xs">
                <div className="font-bold text-[#1F2937]">인원 목록:</div>
                <div className="text-[#64748B]">
                  {selectedTaskForSheet.assigned_names?.join(', ') || 
                   [...(selectedTaskForSheet.day_workers || []), ...(selectedTaskForSheet.night_workers || [])].join(', ') || 
                   '지정 안됨'}
                </div>
              </div>

              {isAdmin && (
                <div className="flex items-center justify-end space-x-2 pt-3 border-t">
                  <button
                    onClick={() => {
                      handleOpenTaskEdit(selectedTaskForSheet);
                      setSelectedTaskForSheet(null);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold border rounded-lg text-[#243B5A]"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => handleDeleteTask(selectedTaskForSheet.id)}
                    className="px-3 py-1.5 text-xs font-semibold border rounded-lg text-red-600 border-red-200"
                  >
                    삭제
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 호선 관리 모달 */}
        {isVesselManagerOpen && isAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-4 sm:p-5 shadow-2xl space-y-4 border">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-sm font-bold text-[#243B5A]">CABIN 호선 관리</h3>
                <button onClick={() => setIsVesselManagerOpen(false)} className="p-1 text-[#64748B] hover:bg-slate-100 rounded-lg"><X className="h-4 w-4" /></button>
              </div>

              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="신규 호선명 입력 (예: 3호선)"
                  value={newVesselName}
                  onChange={(e) => setNewVesselName(e.target.value)}
                  className="flex-1 px-3 py-1.5 border rounded-lg text-xs"
                />
                <button onClick={handleAddVessel} className="px-3 py-1.5 bg-[#243B5A] text-white text-xs font-semibold rounded-lg shrink-0">추가</button>
              </div>

              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {vessels.map((v) => (
                  <div key={v.id} className="flex items-center justify-between p-2.5 border rounded-lg text-xs hover:border-[#243B5A]">
                    {editingVessel?.id === v.id ? (
                      <input
                        type="text"
                        defaultValue={v.name}
                        onBlur={(e) => handleUpdateVessel(v.id, e.target.value)}
                        className="px-2 py-0.5 border rounded text-xs"
                        autoFocus
                      />
                    ) : (
                      <span className="font-bold text-[#1F2937]">{v.name}</span>
                    )}

                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => {
                          setIsVesselManagerOpen(false);
                          handleOpenCreateModal(undefined, 'CABIN', v.name);
                        }}
                        className="px-2 py-1 bg-blue-50 text-[#2563EB] border border-blue-200 rounded text-[11px] font-semibold hover:bg-blue-100"
                      >
                        + 업무등록
                      </button>
                      <button onClick={() => setEditingVessel(v)} className="p-1 text-[#64748B] hover:text-[#243B5A]"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => handleDeleteVessel(v.id)} className="p-1 text-[#64748B] hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Team 그룹 관리 모달 */}
        {isTeamManagerOpen && isAdmin && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-4 sm:p-5 shadow-2xl space-y-4 border max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center space-x-1.5 text-[#243B5A]">
                  <Layers className="h-4 w-4" />
                  <h3 className="text-sm font-bold">Team 그룹 관리</h3>
                </div>
                <button onClick={() => setIsTeamManagerOpen(false)} className="p-1 text-[#64748B] hover:bg-slate-100 rounded-lg"><X className="h-4 w-4" /></button>
              </div>

              {/* 신규 Team 추가 */}
              <div className="space-y-2 bg-[#F5F6F8] p-3 rounded-lg border">
                <span className="text-xs font-bold text-[#243B5A]">신규 Team 추가</span>
                
                <input
                  type="text"
                  placeholder="Team 이름 (예: C조)"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white"
                />

                <div className="space-y-1">
                  <label className="text-[10px] text-[#64748B] font-semibold">부서 선택 및 인원 불러오기</label>
                  <select
                    value={newTeamDept}
                    onChange={(e) => handleSelectDepartmentUsersToNewTeam(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white font-medium"
                  >
                    <option value="">-- 부서 선택 (선택 시 해당 부서 전체 인원 자동입력) --</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                <input
                  type="text"
                  placeholder="구성원 이름 (쉼표 구분: 홍길동, 김철수)"
                  value={newTeamMembersText}
                  onChange={(e) => setNewTeamMembersText(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white"
                />

                <button
                  onClick={handleAddTeam}
                  className="w-full py-1.5 bg-[#243B5A] text-white text-xs font-semibold rounded-lg hover:bg-[#1a2b42] transition"
                >
                  Team 생성
                </button>
              </div>

              {/* Team 목록 */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#1F2937]">등록된 Team 목록 ({presetTeams.length})</span>
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {presetTeams.length === 0 ? (
                    <div className="text-center py-6 text-xs text-[#64748B]">등록된 Team이 없습니다.</div>
                  ) : (
                    presetTeams.map((team) => (
                      <div key={team.id} className="p-2.5 border rounded-lg text-xs bg-white space-y-1.5">
                        {editingTeam?.id === team.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editingTeam.name}
                              onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
                              className="w-full px-2 py-1 border rounded text-xs font-bold"
                            />
                            <select
                              value={editingTeam.department || ''}
                              onChange={(e) => setEditingTeam({ ...editingTeam, department: e.target.value })}
                              className="w-full px-2 py-1 border rounded text-xs"
                            >
                              <option value="">부서 미지정</option>
                              {departments.map((dept) => (
                                <option key={dept} value={dept}>{dept}</option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={editTeamMembersText}
                              onChange={(e) => setEditTeamMembersText(e.target.value)}
                              placeholder="인원 (쉼표로 구분)"
                              className="w-full px-2 py-1 border rounded text-xs"
                            />
                            <div className="flex justify-end space-x-1 pt-1">
                              <button
                                onClick={() => setEditingTeam(null)}
                                className="px-2 py-1 border rounded text-[11px]"
                              >
                                취소
                              </button>
                              <button
                                onClick={() => handleUpdateTeam(team.id)}
                                className="px-2 py-1 bg-blue-600 text-white rounded text-[11px] font-semibold"
                              >
                                저장
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-bold text-[#243B5A] flex items-center gap-1.5">
                                <span>{team.name}</span>
                                {team.department && (
                                  <span className="text-[10px] bg-blue-50 text-blue-700 font-normal px-1.5 py-0.2 rounded border border-blue-200">
                                    {team.department}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-[#64748B] flex flex-wrap gap-1 mt-0.5">
                                {team.members && team.members.length > 0 ? (
                                  team.members.map((m) => (
                                    <span key={m} className="bg-slate-100 border px-1.5 py-0.2 rounded text-[10px]">
                                      {m}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-slate-400 italic">인원 없음</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-1 shrink-0">
                              <button
                                onClick={() => {
                                  setEditingTeam(team);
                                  setEditTeamMembersText(team.members ? team.members.join(', ') : '');
                                }}
                                className="p-1 text-[#64748B] hover:text-[#243B5A]"
                                title="Team 수정"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteTeam(team.id)}
                                className="p-1 text-[#64748B] hover:text-red-600"
                                title="Team 삭제"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 업무 생성 및 수정 모달 */}
        {isModalOpen && isAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-xl max-w-lg w-full p-4 sm:p-5 shadow-2xl space-y-4 border max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-sm font-bold">
                  {formData.task_type === 'CABIN' ? `CABIN 근무 등록/수정 (${formData.category || '호선미정'})` : '업무 등록/수정'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-1 text-[#64748B] hover:bg-slate-100 rounded-lg"><X className="h-4 w-4" /></button>
              </div>

              <form onSubmit={handleSubmitTask} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold mb-1">구분</label>
                  <div className="grid grid-cols-3 gap-1.5 bg-[#F5F6F8] p-1 rounded-lg border">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, task_type: 'DAILY' })}
                      className={`py-1 text-xs font-semibold rounded-md ${formData.task_type === 'DAILY' ? 'bg-[#243B5A] text-white' : 'text-[#64748B]'}`}
                    >
                      일일 업무
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, task_type: 'WEEKLY' })}
                      className={`py-1 text-xs font-semibold rounded-md ${formData.task_type === 'WEEKLY' ? 'bg-[#243B5A] text-white' : 'text-[#64748B]'}`}
                    >
                      주간 업무
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, task_type: 'CABIN' })}
                      className={`py-1 text-xs font-semibold rounded-md ${formData.task_type === 'CABIN' ? 'bg-[#243B5A] text-white' : 'text-[#64748B]'}`}
                    >
                      CABIN
                    </button>
                  </div>
                </div>

                {formData.task_type === 'CABIN' ? (
                  <>
                    <div>
                      <label className="block text-[11px] font-semibold mb-1">선택된 호선</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-3 py-1.5 border rounded-lg text-xs font-bold text-[#243B5A]"
                      >
                        {vessels.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold mb-1">근무/점검명</label>
                      <input
                        type="text"
                        required
                        placeholder="예) 메인 캐빈 정기 점검"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-3 py-1.5 border rounded-lg text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold mb-1">시작일</label>
                        <input
                          type="date"
                          required
                          value={formData.start_date}
                          onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                          className="w-full px-3 py-1.5 border rounded-lg text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1">종료일</label>
                        <input
                          type="date"
                          required
                          value={formData.end_date}
                          onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                          className="w-full px-3 py-1.5 border rounded-lg text-xs font-mono"
                        />
                      </div>
                    </div>

                    {/* CABIN 주간/야간 인원 선택 */}
                    <div className="space-y-3 pt-2">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-[11px] font-semibold text-amber-800">주간 인원 선택</label>
                          <select
                            onChange={(e) => {
                              if (e.target.value) handleApplyTeamOrDept(e.target.value, 'DAY');
                              e.target.value = '';
                            }}
                            className="text-[10px] bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5"
                          >
                            <option value="">+ Team 불러오기</option>
                            {presetTeams.map(team => (
                              <option key={team.id} value={`TEAM_${team.id}`}>{team.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex gap-2 mb-1.5">
                          <input
                            type="text"
                            placeholder="이름 입력 후 추가"
                            value={singleWorkerInput}
                            onChange={(e) => setSingleWorkerInput(e.target.value)}
                            className="flex-1 px-2.5 py-1 border rounded-lg text-xs"
                          />
                          <button type="button" onClick={() => handleAddWorkerSingle('DAY')} className="px-2.5 py-1 bg-amber-600 text-white text-xs rounded-lg">추가</button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {dayWorkerList.map(name => (
                            <span key={name} className="bg-amber-100 text-amber-900 border border-amber-300 text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1">
                              {name}
                              <button type="button" onClick={() => handleRemoveWorker(name, 'DAY')}><X className="h-3 w-3" /></button>
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-[11px] font-semibold text-indigo-800">야간 인원 선택</label>
                          <select
                            onChange={(e) => {
                              if (e.target.value) handleApplyTeamOrDept(e.target.value, 'NIGHT');
                              e.target.value = '';
                            }}
                            className="text-[10px] bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5"
                          >
                            <option value="">+ Team 불러오기</option>
                            {presetTeams.map(team => (
                              <option key={team.id} value={`TEAM_${team.id}`}>{team.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex gap-2 mb-1.5">
                          <input
                            type="text"
                            placeholder="이름 입력 후 추가"
                            value={singleWorkerInput}
                            onChange={(e) => setSingleWorkerInput(e.target.value)}
                            className="flex-1 px-2.5 py-1 border rounded-lg text-xs"
                          />
                          <button type="button" onClick={() => handleAddWorkerSingle('NIGHT')} className="px-2.5 py-1 bg-indigo-600 text-white text-xs rounded-lg">추가</button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {nightWorkerList.map(name => (
                            <span key={name} className="bg-indigo-100 text-indigo-900 border border-indigo-300 text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1">
                              {name}
                              <button type="button" onClick={() => handleRemoveWorker(name, 'NIGHT')}><X className="h-3 w-3" /></button>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-[11px] font-semibold mb-1">업무명</label>
                      <input
                        type="text"
                        required
                        placeholder="예) 시설 정기 점검"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-3 py-1.5 border rounded-lg text-xs"
                      />
                    </div>

                    {formData.task_type === 'WEEKLY' ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold mb-1">시작일</label>
                          <input
                            type="date"
                            required
                            value={formData.start_date}
                            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                            className="w-full px-3 py-1.5 border rounded-lg text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold mb-1">종료일</label>
                          <input
                            type="date"
                            required
                            value={formData.end_date}
                            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                            className="w-full px-3 py-1.5 border rounded-lg text-xs font-mono"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold mb-1">일자</label>
                          <input
                            type="date"
                            required
                            value={formData.start_date}
                            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                            className="w-full px-3 py-1.5 border rounded-lg text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold mb-1">시간대</label>
                          <input
                            type="text"
                            placeholder="예) 09:00 - 18:00"
                            value={formData.time_slot}
                            onChange={(e) => setFormData({ ...formData, time_slot: e.target.value })}
                            className="w-full px-3 py-1.5 border rounded-lg text-xs font-mono"
                          />
                        </div>
                      </div>
                    )}

                    {formData.task_type === 'WEEKLY' && (
                      <div>
                        <label className="block text-[11px] font-semibold mb-1">시간대</label>
                        <input
                          type="text"
                          placeholder="예) 09:00 - 18:00"
                          value={formData.time_slot}
                          onChange={(e) => setFormData({ ...formData, time_slot: e.target.value })}
                          className="w-full px-3 py-1.5 border rounded-lg text-xs font-mono"
                        />
                      </div>
                    )}

                    {/* 인원 추가 & Team 불러오기 */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="block text-[11px] font-semibold">인원 추가 (1명씩 또는 그룹)</label>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setIsTeamManagerOpen(true)}
                            className="text-[10px] text-[#243B5A] hover:underline font-semibold flex items-center gap-0.5"
                          >
                            <Settings className="h-3 w-3" />
                            Team 관리
                          </button>
                          <select
                            onChange={(e) => {
                              if (e.target.value) handleApplyTeamOrDept(e.target.value, 'ASSIGNED');
                              e.target.value = '';
                            }}
                            className="text-[10px] bg-slate-100 border rounded px-1.5 py-0.5"
                          >
                            <option value="">+ Team 불러오기</option>
                            {presetTeams.map(team => (
                              <option key={team.id} value={`TEAM_${team.id}`}>{team.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="인원 이름 입력 후 [추가]"
                          value={singleWorkerInput}
                          onChange={(e) => setSingleWorkerInput(e.target.value)}
                          className="flex-1 px-3 py-1.5 border rounded-lg text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddWorkerSingle('ASSIGNED')}
                          className="px-3 py-1.5 bg-[#243B5A] text-white text-xs font-semibold rounded-lg shrink-0"
                        >
                          추가
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1 pt-1">
                        {assignedList.length === 0 ? (
                          <span className="text-[11px] text-[#64748B]">지정된 인원이 없습니다.</span>
                        ) : (
                          assignedList.map(name => (
                            <span key={name} className="bg-slate-100 text-[#1F2937] border text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1">
                              {name}
                              <button type="button" onClick={() => handleRemoveWorker(name, 'ASSIGNED')} className="hover:text-red-600"><X className="h-3 w-3" /></button>
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-[11px] font-semibold mb-1">상세 설명</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded-lg text-xs resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold mb-1">비고란</label>
                  <input
                    type="text"
                    placeholder="비고 사항 입력 (선택)"
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded-lg text-xs"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-3 border-t">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-3.5 py-1.5 text-xs border rounded-lg">취소</button>
                  <button type="submit" className="px-4 py-1.5 text-xs bg-[#243B5A] text-white rounded-lg font-semibold">저장</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
