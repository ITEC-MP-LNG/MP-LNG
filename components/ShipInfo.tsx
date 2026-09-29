'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Anchor, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  X, 
  MapPin, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronRight,
  User,
  Activity,
  Sun,
  Moon,
  Check,
  AlertCircle,
  Calendar,
  Layers,
  Building2,
  Ship,
  Sparkles,
  Info
} from 'lucide-react';

// Supabase 클라이언트 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 진행 상태 타입 정의 (기존 7개 단계)
export type ShipStatus = 
  | 'Sound Test 1St'
  | 'Sound Test 2nd'
  | 'Nh3 Test'
  | 'PBGT'
  | 'B/F SBTT'
  | 'A/T SBTT'
  | 'Gas Trial';

export const STATUS_PROGRESS_MAP: Record<ShipStatus, number | null> = {
  'Sound Test 1St': 17,
  'Sound Test 2nd': 33,
  'Nh3 Test': 50,
  'PBGT': 67,
  'B/F SBTT': 83,
  'A/T SBTT': 100,
  'Gas Trial': null,
};

export const STATUS_LIST: ShipStatus[] = [
  'Sound Test 1St',
  'Sound Test 2nd',
  'Nh3 Test',
  'PBGT',
  'B/F SBTT',
  'A/T SBTT',
  'Gas Trial'
];

// Tank 항목 및 단계 정의
export const TANKS = ['TK1', 'TK2', 'TK3', 'TK4'] as const;
export type TankKey = typeof TANKS[number]; // 'TK1' | 'TK2' | 'TK3' | 'TK4'

export const TANK_STEPS = [
  { key: 'st_1st', label: 'S/T 1ST' },
  { key: 'st_2nd', label: '2nd' },
  { key: 'pre_sbtt', label: 'Pre SBTT' },
  { key: 'nh3', label: 'NH3' },
  { key: 'bf_sbtt', label: 'B/F SBTT' },
  { key: 'at_sbtt', label: 'A/T SBTT' },
] as const;

export type TankStepKey = typeof TANK_STEPS[number]['key'];

export interface TankStepDetail {
  date: string; // YYYY-MM-DD
  status: '대기' | '진행중' | '완료';
}

export type TankDetail = Record<TankStepKey, TankStepDetail>;

export type ShipTankStatus = Record<TankKey, TankDetail>;

export function getDefaultTankStatus(): ShipTankStatus {
  const createEmptySteps = (): TankDetail => ({
    st_1st: { date: '', status: '대기' },
    st_2nd: { date: '', status: '대기' },
    pre_sbtt: { date: '', status: '대기' },
    nh3: { date: '', status: '대기' },
    bf_sbtt: { date: '', status: '대기' },
    at_sbtt: { date: '', status: '대기' },
  });

  return {
    TK1: createEmptySteps(),
    TK2: createEmptySteps(),
    TK3: createEmptySteps(),
    TK4: createEmptySteps(),
  };
}

export interface ShipItem {
  id: string;
  ship_no: string;            // 호선번호 (Hull No.)
  ship_name: string;          // 선종 및 프로젝트명
  shipowner?: string;         // 선주사
  dock: string;               // 호선위치
  launch_date?: string;       // 진수일
  pt_mount_date?: string;     // P/T 탑재일
  dwt?: string;               // DWT
  status: ShipStatus;         // 진행단계현황
  progress: number | null;    // 산출 공정률
  delivery_date: string;      // 인도예정일
  day_shift: string;          // 주간 근무자
  day_shift_user_ids?: string[];
  night_shift: string;        // 야간 근무자
  night_shift_user_ids?: string[];
  tank_status?: ShipTankStatus; // TK1, TK2, TK3, TK4 상세 상태 및 날짜
}

interface ShipInfoProps {
  isAdmin: boolean;
  currentUser?: { name: string };
}

export default function ShipInfo({ isAdmin }: ShipInfoProps) {
  const [ships, setShips] = useState<ShipItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. 메인 탭 상태: 'INFO'(호선 제원 정보) vs 'STATUS'(공정 현황)
  const [activeMainTab, setActiveMainTab] = useState<'INFO' | 'STATUS'>('INFO');

  // 2. Status 탭 내 Hull No. 서브탭 상태
  const [selectedHullNo, setSelectedHullNo] = useState<string>('');

  // Status 편집 전용 모달 상태
  const [isStatusEditModalOpen, setIsStatusEditModalOpen] = useState(false);
  const [statusModalTankTab, setStatusModalTankTab] = useState<TankKey>('TK1');
  const [statusFormData, setStatusFormData] = useState<{
    ship_no: string;
    ship_name: string;
    shipowner: string;
    tank_status: ShipTankStatus;
  }>({
    ship_no: '',
    ship_name: '',
    shipowner: '',
    tank_status: getDefaultTankStatus(),
  });

  // 호선 기본 정보 Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedShip, setSelectedShip] = useState<ShipItem | null>(null);
  const [editingShip, setEditingShip] = useState<ShipItem | null>(null);
  const [targetDeleteId, setTargetDeleteId] = useState<string | null>(null);

  // 통합 알림(Alert/Notice) 모달 상태 (기존 스타일 통일)
  const [alertInfo, setAlertInfo] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  const showAlert = (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setAlertInfo({ isOpen: true, title, message, type });
  };

  // 호선 제원 Form Field States
  const [formData, setFormData] = useState<Omit<ShipItem, 'id'>>({
    ship_no: '',
    ship_name: '',
    shipowner: '',
    dock: '제1도크',
    launch_date: '',
    pt_mount_date: '',
    dwt: '',
    status: 'Sound Test 1St',
    progress: 17,
    delivery_date: '',
    day_shift: '',
    day_shift_user_ids: [],
    night_shift: '',
    night_shift_user_ids: [],
    tank_status: getDefaultTankStatus(),
  });

  // Supabase 연동 검증 상태
  const [dayCheckStatus, setDayCheckStatus] = useState<{ status: 'idle' | 'checking' | 'valid' | 'invalid'; invalidNames: string[] }>({
    status: 'idle',
    invalidNames: []
  });
  const [nightCheckStatus, setNightCheckStatus] = useState<{ status: 'idle' | 'checking' | 'valid' | 'invalid'; invalidNames: string[] }>({
    status: 'idle',
    invalidNames: []
  });

  // 컴포넌트 마운트 시 Supabase에서 호선 데이터 불러오기
  useEffect(() => {
    fetchShips();
  }, []);

  const normalizeTankStatus = (raw: any): ShipTankStatus => {
    const defaultStatus = getDefaultTankStatus();
    if (!raw || typeof raw !== 'object') return defaultStatus;

    const result = { ...defaultStatus };
    TANKS.forEach((tk) => {
      if (raw[tk] && typeof raw[tk] === 'object') {
        result[tk] = {
          ...defaultStatus[tk],
          ...raw[tk],
        };
      }
    });
    return result;
  };

  const fetchShips = async () => {
    try {
      const { data, error } = await supabase
        .from('ships')
        .select('*')
        .order('ship_no', { ascending: true });

      if (error) {
        console.error('호선 데이터 조회 오류:', error);
      } else if (data) {
        const parsedShips: ShipItem[] = data.map((item: any) => ({
          ...item,
          tank_status: normalizeTankStatus(item.tank_status),
        }));
        setShips(parsedShips);

        // 첫 번째 호선 번호로 서브탭 기본 선택
        if (parsedShips.length > 0 && !selectedHullNo) {
          setSelectedHullNo(parsedShips[0].ship_no);
        }
      }
    } catch (e) {
      console.error('호선 데이터 로딩 실패:', e);
    }
  };

  // 사용자 유효성 검증
  const verifyMultipleUsersInSupabase = async (namesString: string): Promise<{ validUserIds: string[]; invalidNames: string[] }> => {
    const nameArray = namesString.split(',').map(n => n.trim()).filter(Boolean);
    if (nameArray.length === 0) return { validUserIds: [], invalidNames: [] };

    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('id, name')
        .in('name', nameArray);

      if (error || !data) {
        return { validUserIds: [], invalidNames: nameArray };
      }

      const foundNames = data.map(u => u.name);
      const validUserIds = data.map(u => u.id);
      const invalidNames = nameArray.filter(n => !foundNames.includes(n));

      return { validUserIds, invalidNames };
    } catch (e) {
      console.error('Supabase 연동 검증 실패:', e);
      return { validUserIds: [], invalidNames: nameArray };
    }
  };

  const handleDayShiftChange = async (inputText: string) => {
    setFormData(prev => ({ ...prev, day_shift: inputText, day_shift_user_ids: [] }));
    if (!inputText.trim()) {
      setDayCheckStatus({ status: 'idle', invalidNames: [] });
      return;
    }

    setDayCheckStatus({ status: 'checking', invalidNames: [] });
    const { validUserIds, invalidNames } = await verifyMultipleUsersInSupabase(inputText);

    if (invalidNames.length === 0) {
      setDayCheckStatus({ status: 'valid', invalidNames: [] });
      setFormData(prev => ({ ...prev, day_shift_user_ids: validUserIds }));
    } else {
      setDayCheckStatus({ status: 'invalid', invalidNames });
    }
  };

  const handleNightShiftChange = async (inputText: string) => {
    setFormData(prev => ({ ...prev, night_shift: inputText, night_shift_user_ids: [] }));
    if (!inputText.trim()) {
      setNightCheckStatus({ status: 'idle', invalidNames: [] });
      return;
    }

    setNightCheckStatus({ status: 'checking', invalidNames: [] });
    const { validUserIds, invalidNames } = await verifyMultipleUsersInSupabase(inputText);

    if (invalidNames.length === 0) {
      setNightCheckStatus({ status: 'valid', invalidNames: [] });
      setFormData(prev => ({ ...prev, night_shift_user_ids: validUserIds }));
    } else {
      setNightCheckStatus({ status: 'invalid', invalidNames });
    }
  };

  const handleStatusChange = (newStatus: ShipStatus) => {
    const calculatedProgress = STATUS_PROGRESS_MAP[newStatus];
    setFormData(prev => ({
      ...prev,
      status: newStatus,
      progress: calculatedProgress
    }));
  };

  const handleDirectStepChange = async (targetStatus: ShipStatus) => {
    if (!selectedShip) return;
    const calculatedProgress = STATUS_PROGRESS_MAP[targetStatus];

    try {
      const { error } = await supabase
        .from('ships')
        .update({ status: targetStatus, progress: calculatedProgress })
        .eq('id', selectedShip.id);

      if (error) {
        showAlert('단계 변경 오류', '단계 변경 중 오류가 발생했습니다: ' + error.message, 'error');
        return;
      }

      const updated = { ...selectedShip, status: targetStatus, progress: calculatedProgress };
      setShips(prev => prev.map(s => s.id === selectedShip.id ? updated : s));
      setSelectedShip(updated);
      showAlert('완료', `공정 단계가 [${targetStatus}]로 변경되었습니다.`, 'success');
    } catch (e: any) {
      showAlert('오류', '단계 변경에 실패했습니다: ' + e?.message, 'error');
    }
  };

  const filteredShips = ships.filter(s =>
    s.ship_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.ship_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.shipowner && s.shipowner.toLowerCase().includes(searchQuery.toLowerCase())) ||
    s.dock.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.dwt && s.dwt.toLowerCase().includes(searchQuery.toLowerCase())) ||
    s.day_shift.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.night_shift.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 현재 Status 탭에서 활성화된 호선 객체 찾기
  const currentStatusShip = ships.find(s => s.ship_no === selectedHullNo) || ships[0] || null;

  // 신규 호선 등록 모달 열기
  const handleOpenAddModal = () => {
    setEditingShip(null);
    const initialStatus: ShipStatus = 'Sound Test 1St';
    setFormData({
      ship_no: '',
      ship_name: '',
      shipowner: '',
      dock: '제1도크',
      launch_date: '',
      pt_mount_date: '',
      dwt: '',
      status: initialStatus,
      progress: STATUS_PROGRESS_MAP[initialStatus],
      delivery_date: new Date().toISOString().split('T')[0],
      day_shift: '',
      day_shift_user_ids: [],
      night_shift: '',
      night_shift_user_ids: [],
      tank_status: getDefaultTankStatus(),
    });
    setDayCheckStatus({ status: 'idle', invalidNames: [] });
    setNightCheckStatus({ status: 'idle', invalidNames: [] });
    setIsFormModalOpen(true);
  };

  // 호선 제원 정보 수정 모달 열기
  const handleOpenEditModal = (ship: ShipItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingShip(ship);
    setFormData({
      ship_no: ship.ship_no,
      ship_name: ship.ship_name,
      shipowner: ship.shipowner || '',
      dock: ship.dock,
      launch_date: ship.launch_date || '',
      pt_mount_date: ship.pt_mount_date || '',
      dwt: ship.dwt || '',
      status: ship.status,
      progress: ship.progress,
      delivery_date: ship.delivery_date || '',
      day_shift: ship.day_shift || '',
      day_shift_user_ids: ship.day_shift_user_ids || [],
      night_shift: ship.night_shift || '',
      night_shift_user_ids: ship.night_shift_user_ids || [],
      tank_status: ship.tank_status || getDefaultTankStatus(),
    });
    setDayCheckStatus({ status: ship.day_shift ? 'valid' : 'idle', invalidNames: [] });
    setNightCheckStatus({ status: ship.night_shift ? 'valid' : 'idle', invalidNames: [] });
    setIsFormModalOpen(true);
  };

  // Status 탭에서 해당 호선의 Tank 상태 수정 모달 열기
  const handleOpenStatusEditModal = (ship: ShipItem) => {
    setStatusFormData({
      ship_no: ship.ship_no,
      ship_name: ship.ship_name,
      shipowner: ship.shipowner || '',
      tank_status: JSON.parse(JSON.stringify(ship.tank_status || getDefaultTankStatus())),
    });
    setStatusModalTankTab('TK1');
    setIsStatusEditModalOpen(true);
  };

  // 호선 제원 저장 처리
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.ship_no.trim() || !formData.ship_name.trim()) {
      showAlert('입력 확인', '호선 번호와 선종 및 프로젝트명을 입력해주세요.', 'warning');
      return;
    }

    if (formData.day_shift && dayCheckStatus.status === 'invalid') {
      showAlert('근무자 확인', `주간 근무자 중 미등록 인원이 있습니다: [${dayCheckStatus.invalidNames.join(', ')}]\nSupabase에 등록된 사용자만 입력 가능합니다.`, 'warning');
      return;
    }
    if (formData.night_shift && nightCheckStatus.status === 'invalid') {
      showAlert('근무자 확인', `야간 근무자 중 미등록 인원이 있습니다: [${nightCheckStatus.invalidNames.join(', ')}]\nSupabase에 등록된 사용자만 입력 가능합니다.`, 'warning');
      return;
    }

    try {
      if (editingShip) {
        // 수정 (Update)
        const { error } = await supabase
          .from('ships')
          .update(formData)
          .eq('id', editingShip.id);

        if (error) {
          if (error.message.includes('column') && error.message.includes('does not exist')) {
            showAlert(
              '데이터베이스 컬럼 추가 필요', 
              `Supabase 'ships' 테이블에 신규 컬럼이 아직 추가되지 않았습니다.\n제공해 드린 SQL 스크립트를 Supabase SQL Editor에서 실행해 주세요.\n\n오류: ${error.message}`, 
              'error'
            );
          } else {
            showAlert('수정 실패', '수정 중 오류가 발생했습니다: ' + error.message, 'error');
          }
          return;
        }

        const updatedShip = { ...editingShip, ...formData };
        setShips(prev => prev.map(s => s.id === editingShip.id ? updatedShip : s));
        if (selectedShip?.id === editingShip.id) {
          setSelectedShip(updatedShip);
        }
        showAlert('수정 완료', `호선 [${formData.ship_no}] 정보가 성공적으로 수정되었습니다.`, 'success');
      } else {
        // 신규 등록 (Insert)
        const { data, error } = await supabase
          .from('ships')
          .insert([formData])
          .select();

        if (error) {
          if (error.message.includes('column') && error.message.includes('does not exist')) {
            showAlert(
              '데이터베이스 컬럼 추가 필요', 
              `Supabase 'ships' 테이블에 신규 컬럼이 아직 추가되지 않았습니다.\n제공해 드린 SQL 스크립트를 Supabase SQL Editor에서 실행해 주세요.\n\n오류: ${error.message}`, 
              'error'
            );
          } else {
            showAlert('등록 실패', '등록 중 오류가 발생했습니다: ' + error.message, 'error');
          }
          return;
        }

        if (data && data.length > 0) {
          const newShip: ShipItem = {
            ...data[0],
            tank_status: normalizeTankStatus(data[0].tank_status),
          };
          setShips(prev => [newShip, ...prev]);
          setSelectedHullNo(newShip.ship_no);
        }
        showAlert('등록 완료', `신규 호선 [${formData.ship_no}]이(가) 등록되었습니다.`, 'success');
      }

      setIsFormModalOpen(false);
    } catch (e: any) {
      console.error('저장 중 예외 발생:', e);
      showAlert('시스템 오류', '처리 중 오류가 발생했습니다: ' + e?.message, 'error');
    }
  };

  // Status 공정 현황 모달 저장 처리
  const handleSaveStatusModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStatusShip) return;

    try {
      const updatePayload = {
        ship_name: statusFormData.ship_name,
        shipowner: statusFormData.shipowner,
        tank_status: statusFormData.tank_status,
      };

      const { error } = await supabase
        .from('ships')
        .update(updatePayload)
        .eq('id', currentStatusShip.id);

      if (error) {
        if (error.message.includes('column') && error.message.includes('does not exist')) {
          showAlert(
            '데이터베이스 컬럼 추가 필요', 
            `Supabase 'ships' 테이블에 'tank_status' 또는 'shipowner' 컬럼이 아직 생성되지 않았습니다.\n제공해 드린 SQL 스크립트를 Supabase SQL Editor에서 실행해 주세요.`, 
            'error'
          );
        } else {
          showAlert('저장 실패', 'Status 저장 중 오류가 발생했습니다: ' + error.message, 'error');
        }
        return;
      }

      const updated = {
        ...currentStatusShip,
        ...updatePayload,
      };

      setShips(prev => prev.map(s => s.id === currentStatusShip.id ? updated : s));
      setIsStatusEditModalOpen(false);
      showAlert('저장 완료', `[Hull No. ${currentStatusShip.ship_no}]의 Tank 공정 상태 및 일자가 저장되었습니다.`, 'success');
    } catch (e: any) {
      showAlert('오류', '저장에 실패했습니다: ' + e?.message, 'error');
    }
  };

  // 호선 삭제 처리
  const handleConfirmDelete = async () => {
    if (!targetDeleteId) return;

    try {
      const { error } = await supabase
        .from('ships')
        .delete()
        .eq('id', targetDeleteId);

      if (error) {
        showAlert('삭제 오류', '삭제 중 오류가 발생했습니다: ' + error.message, 'error');
        return;
      }

      setShips(prev => {
        const next = prev.filter(s => s.id !== targetDeleteId);
        if (next.length > 0 && !next.some(s => s.ship_no === selectedHullNo)) {
          setSelectedHullNo(next[0].ship_no);
        }
        return next;
      });

      if (selectedShip?.id === targetDeleteId) {
        setSelectedShip(null);
      }
      setTargetDeleteId(null);
      setIsDeleteModalOpen(false);
      showAlert('삭제 완료', '호선 정보가 삭제되었습니다.', 'success');
    } catch (e: any) {
      console.error('삭제 처리 실패:', e);
      showAlert('삭제 실패', '처리 중 오류가 발생했습니다: ' + e?.message, 'error');
    }
  };

  // Tank 전체 공정 완료율 통계 계산 (총 24개 검사 항목)
  const calculateTankStats = (tankStatus?: ShipTankStatus) => {
    if (!tankStatus) return { completed: 0, total: 24, percent: 0 };
    let completed = 0;
    TANKS.forEach(tk => {
      TANK_STEPS.forEach(st => {
        const step = tankStatus[tk]?.[st.key];
        if (step && (step.status === '완료' || step.date)) {
          completed++;
        }
      });
    });
    const percent = Math.round((completed / 24) * 100);
    return { completed, total: 24, percent };
  };

  // 각 Tank별 완료율 계산 (총 6개 검사 항목)
  const calculateSingleTankStats = (tankDetail?: TankDetail) => {
    if (!tankDetail) return { completed: 0, total: 6, percent: 0 };
    let completed = 0;
    TANK_STEPS.forEach(st => {
      const step = tankDetail[st.key];
      if (step && (step.status === '완료' || step.date)) {
        completed++;
      }
    });
    return { completed, total: 6, percent: Math.round((completed / 6) * 100) };
  };

  return (
    <div className="space-y-4 font-sans text-[#1F2937]">
      {/* 0. 대분류 메인 탭 네비게이션 (호선 정보 vs Status 공정 현황) */}
      <div className="bg-white p-2 rounded-xl border border-[#E2E5E9] shadow-2xs flex items-center justify-between gap-2">
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setActiveMainTab('INFO')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeMainTab === 'INFO'
                ? 'bg-[#243B5A] text-white shadow-2xs'
                : 'text-[#64748B] hover:text-[#1F2937] hover:bg-slate-100'
            }`}
          >
            <Anchor className="h-4 w-4" />
            <span>호선 제원 정보</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              activeMainTab === 'INFO' ? 'bg-white/20 text-white' : 'bg-slate-200 text-[#64748B]'
            }`}>
              {ships.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveMainTab('STATUS');
              if (!selectedHullNo && ships.length > 0) {
                setSelectedHullNo(ships[0].ship_no);
              }
            }}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeMainTab === 'STATUS'
                ? 'bg-[#243B5A] text-white shadow-2xs'
                : 'text-[#64748B] hover:text-[#1F2937] hover:bg-slate-100'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Status (탱크별 공정 현황)</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
              TK1~TK4
            </span>
          </button>
        </div>

        {activeMainTab === 'INFO' && isAdmin && (
          <button
            onClick={handleOpenAddModal}
            className="flex items-center space-x-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">신규 호선 등록</span>
            <span className="sm:hidden">등록</span>
          </button>
        )}
      </div>

      {/* ============================================================== */}
      {/* 탭 1: 호선 제원 정보 (기존 탭 + 추가 항목 DWT, 선주사, 진수일, P/T탑재일) */}
      {/* ============================================================== */}
      {activeMainTab === 'INFO' && (
        <>
          {/* 상단 검색 컨트롤 바 */}
          <div className="bg-white p-3.5 rounded-xl border border-[#E2E5E9] shadow-2xs flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
            <div className="flex items-center space-x-2">
              <div className="bg-[#243B5A]/10 p-2 rounded-lg text-[#243B5A]">
                <Ship className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#1F2937]">호선 목록 및 제원 현황</h2>
                <p className="text-[11px] text-[#64748B]">선종, 선주사, 건조위치 및 주요 탑재/인도 일정 관리</p>
              </div>
            </div>

            <div className="relative flex-1 sm:w-64 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#64748B]" />
              <input
                type="text"
                placeholder="호선, 선주사, 도크, DWT, 근무자 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] placeholder-[#64748B]/70 focus:bg-white focus:border-[#243B5A] focus:outline-hidden transition font-medium"
              />
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white border border-[#E2E5E9] rounded-xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F5F6F8] border-b border-[#E2E5E9] text-[#64748B] font-semibold whitespace-nowrap">
                    <th className="py-3 px-3">호선번호</th>
                    <th className="py-3 px-3">선종 및 프로젝트명</th>
                    <th className="py-3 px-3">선주사</th>
                    <th className="py-3 px-3">호선위치</th>
                    <th className="py-3 px-3">진수일</th>
                    <th className="py-3 px-3">P/T 탑재일</th>
                    <th className="py-3 px-3">DWT</th>
                    <th className="py-3 px-3">진행단계현황</th>
                    <th className="py-3 px-3">인도예정일</th>
                    <th className="py-3 px-3">근무자 (주/야)</th>
                    {isAdmin && <th className="py-3 px-3 text-right">관리</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E5E9] text-[#1F2937]">
                  {filteredShips.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 11 : 10} className="text-center py-10 text-[#64748B]">
                        등록되거나 검색 조건에 일치하는 호선 데이터가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredShips.map((ship) => {
                      const currentIdx = STATUS_LIST.indexOf(ship.status);

                      return (
                        <tr 
                          key={ship.id} 
                          onClick={() => setSelectedShip(ship)}
                          className="hover:bg-slate-50 transition cursor-pointer"
                        >
                          <td className="py-3 px-3 font-mono font-bold text-[#243B5A] whitespace-nowrap">
                            {ship.ship_no}
                          </td>
                          <td className="py-3 px-3 font-semibold text-[#1F2937] whitespace-nowrap">
                            {ship.ship_name}
                          </td>
                          <td className="py-3 px-3 text-[#1F2937] whitespace-nowrap">
                            {ship.shipowner || '-'}
                          </td>
                          <td className="py-3 px-3 text-[#64748B] whitespace-nowrap">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-[#243B5A]" />
                              {ship.dock || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-[#64748B] font-mono whitespace-nowrap">
                            {ship.launch_date || '-'}
                          </td>
                          <td className="py-3 px-3 text-[#64748B] font-mono whitespace-nowrap">
                            {ship.pt_mount_date || '-'}
                          </td>
                          <td className="py-3 px-3 text-[#1F2937] font-mono whitespace-nowrap">
                            {ship.dwt || '-'}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-wrap gap-1 max-w-[240px]">
                              {STATUS_LIST.map((step, idx) => {
                                const isCompleted = idx < currentIdx;
                                const isCurrent = idx === currentIdx;

                                return (
                                  <span
                                    key={step}
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition ${
                                      isCurrent
                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                        : isCompleted
                                        ? 'bg-slate-100 text-slate-500 border-slate-200'
                                        : 'bg-white text-slate-300 border-slate-100'
                                    }`}
                                  >
                                    {step}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-[#64748B] font-mono font-medium whitespace-nowrap">
                            {ship.delivery_date || '-'}
                          </td>
                          <td className="py-3 px-3 font-medium text-[#1F2937] whitespace-nowrap">
                            <div className="flex flex-col gap-0.5 text-[10px]">
                              <span className="inline-flex items-center text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded font-semibold w-fit">
                                <Sun className="h-2.5 w-2.5 mr-1 shrink-0" /> 주: {ship.day_shift || '-'}
                              </span>
                              <span className="inline-flex items-center text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-1.5 py-0.5 rounded font-semibold w-fit">
                                <Moon className="h-2.5 w-2.5 mr-1 shrink-0" /> 야: {ship.night_shift || '-'}
                              </span>
                            </div>
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-3 text-right space-x-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => handleOpenEditModal(ship, e)}
                                className="p-1 text-[#64748B] hover:text-[#243B5A] hover:bg-slate-100 rounded transition cursor-pointer"
                                title="수정"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTargetDeleteId(ship.id);
                                  setIsDeleteModalOpen(true);
                                }}
                                className="p-1 text-[#64748B] hover:text-[#DC2626] hover:bg-red-50 rounded transition cursor-pointer"
                                title="삭제"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="block lg:hidden space-y-2.5">
            {filteredShips.map((ship) => {
              const currentIdx = STATUS_LIST.indexOf(ship.status);

              return (
                <div 
                  key={ship.id} 
                  onClick={() => setSelectedShip(ship)}
                  className="bg-white rounded-xl border border-[#E2E5E9] p-3.5 shadow-2xs space-y-2.5 active:bg-slate-50 transition cursor-pointer"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="bg-[#243B5A] text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded">
                          {ship.ship_no}
                        </span>
                        {ship.shipowner && (
                          <span className="text-[10px] bg-slate-100 text-[#475569] px-1.5 py-0.5 rounded font-medium border border-[#E2E5E9]">
                            {ship.shipowner}
                          </span>
                        )}
                      </div>
                      <h3 className="text-xs font-bold text-[#1F2937] mt-1">{ship.ship_name}</h3>
                    </div>
                    <ChevronRight className="h-4 w-4 text-[#64748B]" />
                  </div>

                  <div className="flex flex-wrap gap-1 pt-1">
                    {STATUS_LIST.map((step, idx) => {
                      const isCompleted = idx < currentIdx;
                      const isCurrent = idx === currentIdx;

                      return (
                        <span
                          key={step}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                            isCurrent
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                              : isCompleted
                              ? 'bg-slate-100 text-slate-500 border-slate-200'
                              : 'bg-white text-slate-300 border-slate-100'
                          }`}
                        >
                          {step}
                        </span>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-[#64748B] pt-2 border-t border-[#E2E5E9]">
                    <div>위치: <strong className="text-[#1F2937] font-semibold">{ship.dock || '-'}</strong></div>
                    <div>DWT: <strong className="text-[#1F2937] font-semibold">{ship.dwt || '-'}</strong></div>
                    <div>진수: <span className="font-mono text-[#1F2937]">{ship.launch_date || '-'}</span></div>
                    <div>인도: <span className="font-mono text-[#1F2937]">{ship.delivery_date || '-'}</span></div>
                    <div className="col-span-2 flex flex-col gap-1 pt-1">
                      <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-semibold text-[10px] w-fit">
                        주간: {ship.day_shift || '-'}
                      </span>
                      <span className="text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-semibold text-[10px] w-fit">
                        야간: {ship.night_shift || '-'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ============================================================== */}
      {/* 탭 2: Status (Hull No. 서브탭 + TK1~TK4 공정 및 일자 관리) */}
      {/* ============================================================== */}
      {activeMainTab === 'STATUS' && (
        <div className="space-y-4">
          {/* Hull No. 서브탭 목록 바 */}
          <div className="bg-white p-3 rounded-xl border border-[#E2E5E9] shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1F2937] flex items-center gap-1.5">
                <Ship className="h-3.5 w-3.5 text-[#243B5A]" />
                호선 선택 (Hull No. 서브탭)
              </span>
              <span className="text-[11px] text-[#64748B]">
                호선을 선택하여 각 탱크(TK1~4)별 상세 공정 및 일자를 확인합니다.
              </span>
            </div>

            {ships.length === 0 ? (
              <div className="text-xs text-[#64748B] py-3 text-center">
                등록된 호선이 없습니다. '호선 제원 정보' 탭에서 먼저 신규 호선을 등록하세요.
              </div>
            ) : (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {ships.map((ship) => {
                  const isSelected = (currentStatusShip?.ship_no === ship.ship_no);
                  const stats = calculateTankStats(ship.tank_status);

                  return (
                    <button
                      key={ship.id}
                      onClick={() => setSelectedHullNo(ship.ship_no)}
                      className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold whitespace-nowrap transition cursor-pointer ${
                        isSelected
                          ? 'bg-[#243B5A] text-white shadow-2xs ring-2 ring-[#243B5A]/20'
                          : 'bg-[#F5F6F8] hover:bg-slate-200 text-[#475569] border border-[#E2E5E9]'
                      }`}
                    >
                      <span className="font-bold">Hull {ship.ship_no}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-sans font-bold ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-white text-emerald-700 border border-emerald-200'
                      }`}>
                        {stats.completed}/{stats.total}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 선택된 호선의 Status 대시보드 */}
          {currentStatusShip ? (
            <div className="space-y-4">
              {/* 호선 요약 카드 */}
              <div className="bg-white p-4 rounded-xl border border-[#E2E5E9] shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-[#243B5A] text-white text-xs font-mono font-bold px-2 py-0.5 rounded">
                      Hull #{currentStatusShip.ship_no}
                    </span>
                    <h3 className="text-base font-bold text-[#1F2937]">
                      {currentStatusShip.ship_name}
                    </h3>
                    {currentStatusShip.shipowner && (
                      <span className="text-xs bg-slate-100 text-[#243B5A] font-semibold px-2 py-0.5 rounded border border-[#E2E5E9] flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {currentStatusShip.shipowner}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#64748B] flex-wrap pt-0.5">
                    <span>위치: <strong className="text-[#1F2937]">{currentStatusShip.dock || '-'}</strong></span>
                    <span>•</span>
                    <span>진수일: <strong className="text-[#1F2937]">{currentStatusShip.launch_date || '-'}</strong></span>
                    <span>•</span>
                    <span>인도예정: <strong className="text-[#1F2937]">{currentStatusShip.delivery_date || '-'}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-[#E2E5E9]">
                  {/* 탱크 공정 진행률 바 */}
                  {(() => {
                    const stats = calculateTankStats(currentStatusShip.tank_status);
                    return (
                      <div className="flex flex-col items-end">
                        <div className="text-[11px] font-semibold text-[#64748B]">
                          탱크 공정 달성률: <span className="text-[#243B5A] font-bold text-xs">{stats.completed}/{stats.total}건 ({stats.percent}%)</span>
                        </div>
                        <div className="w-36 h-2 bg-slate-100 rounded-full mt-1 overflow-hidden border border-slate-200">
                          <div 
                            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                            style={{ width: `${stats.percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {isAdmin && (
                    <button
                      onClick={() => handleOpenStatusEditModal(currentStatusShip)}
                      className="flex items-center space-x-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Status 및 날짜 수정</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Tank(TK1, TK2, TK3, TK4) 4분할 개별 카드 뷰 */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {TANKS.map((tkKey) => {
                  const tankDetail = currentStatusShip.tank_status?.[tkKey] || getDefaultTankStatus()[tkKey];
                  const tankStats = calculateSingleTankStats(tankDetail);

                  return (
                    <div 
                      key={tkKey}
                      className="bg-white rounded-xl border border-[#E2E5E9] shadow-2xs overflow-hidden flex flex-col"
                    >
                      {/* 카드 헤더 */}
                      <div className="bg-[#F5F6F8] p-3 border-b border-[#E2E5E9] flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                          <span className="bg-[#243B5A] text-white font-mono font-bold text-xs px-2 py-0.5 rounded">
                            {tkKey}
                          </span>
                          <span className="text-xs font-bold text-[#1F2937]">CARGO TANK</span>
                        </div>
                        <div className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          {tankStats.completed}/{tankStats.total} ({tankStats.percent}%)
                        </div>
                      </div>

                      {/* 6개 공정 항목 목록 */}
                      <div className="p-3 divide-y divide-[#E2E5E9]/60 flex-1 space-y-2">
                        {TANK_STEPS.map((step) => {
                          const stepInfo = tankDetail[step.key] || { date: '', status: '대기' };
                          const isDone = stepInfo.status === '완료';
                          const isInProgress = stepInfo.status === '진행중';

                          return (
                            <div key={step.key} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                              <div className="flex items-center space-x-2">
                                {isDone ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                ) : isInProgress ? (
                                  <Clock className="h-3.5 w-3.5 text-amber-500 animate-pulse shrink-0" />
                                ) : (
                                  <div className="h-3.5 w-3.5 rounded-full border border-slate-300 shrink-0" />
                                )}
                                <span className={`font-semibold ${isDone ? 'text-[#1F2937]' : 'text-[#64748B]'}`}>
                                  {step.label}
                                </span>
                              </div>

                              <div className="flex items-center space-x-1.5">
                                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                                  isDone
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : isInProgress
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-slate-50 text-slate-400 border-slate-200'
                                }`}>
                                  {stepInfo.status || '대기'}
                                </span>

                                <span className="font-mono text-[11px] text-[#475569] flex items-center gap-0.5 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 min-w-[76px] justify-center">
                                  <Calendar className="h-2.5 w-2.5 text-slate-400" />
                                  {stepInfo.date ? stepInfo.date : '-'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 종합 현황 Matrix Table (TK1 ~ TK4 한눈에 보기) */}
              <div className="bg-white rounded-xl border border-[#E2E5E9] shadow-2xs overflow-hidden">
                <div className="p-3 bg-[#F5F6F8] border-b border-[#E2E5E9] flex justify-between items-center">
                  <h4 className="text-xs font-bold text-[#1F2937] flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-[#243B5A]" />
                    Hull #{currentStatusShip.ship_no} 탱크별 공정 일자 종합 비교표
                  </h4>
                  <span className="text-[11px] text-[#64748B]">S/T 1ST, 2nd, Pre SBTT, NH3, B/F SBTT, A/T SBTT</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-[#E2E5E9] text-[#64748B] font-semibold">
                        <th className="py-2.5 px-4 w-1/5">검사 / 시험 공정</th>
                        {TANKS.map(tk => (
                          <th key={tk} className="py-2.5 px-4 text-center font-mono font-bold text-[#243B5A]">
                            {tk}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E5E9] text-[#1F2937]">
                      {TANK_STEPS.map((step) => (
                        <tr key={step.key} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4 font-bold text-[#1F2937] bg-slate-50/40">
                            {step.label}
                          </td>
                          {TANKS.map((tkKey) => {
                            const stepInfo = currentStatusShip.tank_status?.[tkKey]?.[step.key] || { date: '', status: '대기' };
                            const isDone = stepInfo.status === '완료';
                            const isInProgress = stepInfo.status === '진행중';

                            return (
                              <td key={tkKey} className="py-3 px-4 text-center">
                                <div className="inline-flex flex-col items-center gap-1">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                    isDone
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : isInProgress
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-white text-slate-400 border-slate-200'
                                  }`}>
                                    {stepInfo.status}
                                  </span>
                                  <span className="font-mono text-[11px] text-[#64748B]">
                                    {stepInfo.date ? stepInfo.date : '일자 미입력'}
                                  </span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-xl border border-[#E2E5E9] text-center text-xs text-[#64748B]">
              조회할 호선 데이터를 찾을 수 없습니다.
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. 호선 상세 바텀시트 모달 (모든 새 항목 표시) */}
      {/* ============================================================== */}
      {selectedShip && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center z-[99999] transition-all">
          <div 
            className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl p-5 shadow-2xl border border-[#E2E5E9] space-y-4 max-h-[88vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center">
              <div className="w-10 h-1 bg-[#E2E5E9] rounded-full mb-3 sm:hidden" />
              <div className="w-full flex justify-between items-start border-b border-[#E2E5E9] pb-3">
                <div className="flex items-center space-x-2">
                  <span className="bg-[#243B5A] text-white text-xs font-mono font-bold px-2 py-0.5 rounded">
                    {selectedShip.ship_no}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-[#1F2937]">{selectedShip.ship_name}</h3>
                    <p className="text-[11px] text-[#64748B] flex items-center gap-2 mt-0.5">
                      <span><MapPin className="inline h-3 w-3 text-[#243B5A]" /> {selectedShip.dock || '위치 미지정'}</span>
                      {selectedShip.shipowner && <span>• 선주사: {selectedShip.shipowner}</span>}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedShip(null)}
                  className="p-1 text-[#64748B] hover:text-[#1F2937] rounded-lg hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 신규 제원 상세 그리드 (호선번호, 선종, 호선위치, 진수일, P/T 탑재일, DWT, 인도예정일) */}
            <div className="bg-[#F5F6F8] p-3 rounded-lg border border-[#E2E5E9] text-xs space-y-2">
              <span className="text-[11px] font-bold text-[#243B5A] flex items-center gap-1 border-b border-[#E2E5E9] pb-1">
                <Ship className="h-3.5 w-3.5" /> 호선 기본 제원
              </span>
              <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-[11px]">
                <div><span className="text-[#64748B]">선주사:</span> <strong className="text-[#1F2937]">{selectedShip.shipowner || '-'}</strong></div>
                <div><span className="text-[#64748B]">DWT:</span> <strong className="text-[#1F2937]">{selectedShip.dwt || '-'}</strong></div>
                <div><span className="text-[#64748B]">진수일:</span> <span className="font-mono text-[#1F2937]">{selectedShip.launch_date || '-'}</span></div>
                <div><span className="text-[#64748B]">P/T 탑재일:</span> <span className="font-mono text-[#1F2937]">{selectedShip.pt_mount_date || '-'}</span></div>
                <div><span className="text-[#64748B]">인도예정일:</span> <span className="font-mono text-[#1F2937]">{selectedShip.delivery_date || '-'}</span></div>
                <div><span className="text-[#64748B]">도크위치:</span> <strong className="text-[#1F2937]">{selectedShip.dock || '-'}</strong></div>
              </div>
            </div>

            {/* Cabin 근무자 편성 */}
            <div className="bg-[#F5F6F8] p-3 rounded-lg border border-[#E2E5E9] text-xs space-y-1.5">
              <div className="flex items-center space-x-1.5 border-b border-[#E2E5E9] pb-1">
                <User className="h-3.5 w-3.5 text-[#243B5A]" />
                <span className="text-[11px] font-bold text-[#1F2937]">Cabin 근무자 편성 명단</span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex items-start gap-1.5">
                  <span className="text-amber-700 font-bold shrink-0">[주간]:</span>
                  <span className="text-[#1F2937] font-semibold">{selectedShip.day_shift || '미배정'}</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="text-indigo-700 font-bold shrink-0">[야간]:</span>
                  <span className="text-[#1F2937] font-semibold">{selectedShip.night_shift || '미배정'}</span>
                </div>
              </div>
            </div>

            {/* 시운전 공정 단계 현황 */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-[#1F2937] flex items-center gap-1">
                  <Activity className="h-3.5 w-3.5 text-[#243B5A]" /> 시운전 공정 현황 (단계별 조작 가능)
                </h4>
                <span className="text-[11px] font-bold text-[#243B5A]">
                  {selectedShip.status === 'Gas Trial' ? '최종단계' : `공정률 ${selectedShip.progress}%`}
                </span>
              </div>

              <div className="space-y-1.5 pt-1">
                {STATUS_LIST.map((step, idx) => {
                  const currentIdx = STATUS_LIST.indexOf(selectedShip.status);
                  const isCompleted = idx < currentIdx;
                  const isCurrent = idx === currentIdx;

                  return (
                    <div 
                      key={step} 
                      className={`flex items-center justify-between p-2 rounded-lg border text-xs transition ${
                        isCurrent 
                          ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900 font-bold shadow-2xs' 
                          : isCompleted 
                            ? 'bg-slate-100 border-slate-200 text-slate-500' 
                            : 'bg-white border-[#E2E5E9]/60 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        {isCompleted ? (
                          <CheckCircle2 className="h-4 w-4 text-slate-400 shrink-0" />
                        ) : isCurrent ? (
                          <Clock className="h-4 w-4 text-emerald-600 animate-pulse shrink-0" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border border-slate-300 shrink-0" />
                        )}
                        <span>{step}</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        {isCurrent ? (
                          <span className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] rounded-full font-bold shadow-2xs">
                            진행중
                          </span>
                        ) : isCompleted ? (
                          <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] rounded-full font-semibold">
                            완료
                          </span>
                        ) : null}

                        {isAdmin && !isCurrent && (
                          <button
                            onClick={() => handleDirectStepChange(step)}
                            className="px-2 py-0.5 bg-white border border-[#243B5A] text-[#243B5A] hover:bg-[#243B5A] hover:text-white text-[10px] rounded font-semibold transition cursor-pointer ml-1"
                          >
                            변경
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {isAdmin && (
              <div className="flex justify-end space-x-2 pt-2 border-t border-[#E2E5E9]">
                <button
                  onClick={(e) => handleOpenEditModal(selectedShip, e)}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-white border border-[#E2E5E9] hover:bg-slate-50 text-[#1F2937] rounded-lg text-xs font-semibold"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>정보 수정</span>
                </button>
                <button
                  onClick={() => {
                    setTargetDeleteId(selectedShip.id);
                    setIsDeleteModalOpen(true);
                  }}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-red-50 text-[#DC2626] hover:bg-red-100 rounded-lg text-xs font-semibold border border-red-200"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>삭제</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. 신규 등록 및 수정 모달 (요구사항 4번 신규 필드 완벽 반영) */}
      {/* ============================================================== */}
      {isFormModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-[99999]">
          <div className="bg-white border border-[#E2E5E9] rounded-xl p-5 max-w-lg w-full shadow-xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-[#E2E5E9] pb-3">
              <h3 className="text-sm font-bold text-[#1F2937]">
                {editingShip ? '호선 정보 수정' : '신규 호선 등록'}
              </h3>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="p-1 text-[#64748B] hover:text-[#1F2937] rounded-lg hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              {/* 호선 번호 & 선주사 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                    호선 번호 (Hull No.) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="예: 8254"
                    value={formData.ship_no}
                    onChange={(e) => setFormData({ ...formData, ship_no: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                    선주사
                  </label>
                  <input
                    type="text"
                    placeholder="예: 현대LNG해운"
                    value={formData.shipowner || ''}
                    onChange={(e) => setFormData({ ...formData, shipowner: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden"
                  />
                </div>
              </div>

              {/* 선종 및 프로젝트명 */}
              <div>
                <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                  선종 및 프로젝트명 *
                </label>
                <input
                  type="text"
                  required
                  placeholder="예: 174K LNGC"
                  value={formData.ship_name}
                  onChange={(e) => setFormData({ ...formData, ship_name: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden"
                />
              </div>

              {/* 호선 위치 & DWT */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                    호선 위치 (도크)
                  </label>
                  <input
                    type="text"
                    placeholder="예: 제1도크 또는 2A"
                    value={formData.dock}
                    onChange={(e) => setFormData({ ...formData, dock: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                    DWT (재화중량톤수)
                  </label>
                  <input
                    type="text"
                    placeholder="예: 95,000 DWT"
                    value={formData.dwt || ''}
                    onChange={(e) => setFormData({ ...formData, dwt: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              {/* 진수일 & P/T 탑재일 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                    진수일
                  </label>
                  <input
                    type="date"
                    value={formData.launch_date || ''}
                    onChange={(e) => setFormData({ ...formData, launch_date: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                    P/T 탑재일
                  </label>
                  <input
                    type="date"
                    value={formData.pt_mount_date || ''}
                    onChange={(e) => setFormData({ ...formData, pt_mount_date: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              {/* 진행 단계 & 공정률 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                    진행 단계 현황
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleStatusChange(e.target.value as ShipStatus)}
                    className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden font-semibold"
                  >
                    {STATUS_LIST.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                    산출 공정률 (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    disabled={formData.status === 'Gas Trial'}
                    value={formData.progress ?? ''}
                    onChange={(e) => setFormData({ ...formData, progress: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#243B5A] font-bold focus:border-[#243B5A] focus:outline-hidden font-mono disabled:opacity-50"
                  />
                </div>
              </div>

              {/* 인도 예정일 */}
              <div>
                <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                  인도 예정일
                </label>
                <input
                  type="date"
                  value={formData.delivery_date}
                  onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden font-mono"
                />
              </div>

              {/* 주간 근무자 */}
              <div>
                <label className="block text-[11px] font-semibold text-[#1F2937] mb-1 flex items-center justify-between">
                  <span className="flex items-center">
                    <Sun className="h-3 w-3 mr-1 text-amber-600" /> 주간 근무자 (쉼표로 구분)
                  </span>
                  {dayCheckStatus.status === 'valid' && (
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center">
                      <Check className="h-3 w-3 mr-0.5" /> 전원 연동 확인됨
                    </span>
                  )}
                  {dayCheckStatus.status === 'invalid' && (
                    <span className="text-[10px] text-red-600 font-bold flex items-center">
                      <AlertCircle className="h-3 w-3 mr-0.5" /> 미등록: {dayCheckStatus.invalidNames.join(', ')}
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  placeholder="예: 추윤호, 양지훈"
                  value={formData.day_shift}
                  onChange={(e) => handleDayShiftChange(e.target.value)}
                  className={`w-full px-2.5 py-1.5 bg-[#FFFFFF] border rounded-lg text-xs text-[#1F2937] focus:outline-hidden ${
                    dayCheckStatus.status === 'valid' 
                      ? 'border-emerald-500 focus:border-emerald-600' 
                      : dayCheckStatus.status === 'invalid' 
                        ? 'border-red-400 focus:border-red-500 bg-red-50/30' 
                        : 'border-[#E2E5E9] focus:border-[#243B5A]'
                  }`}
                />
              </div>

              {/* 야간 근무자 */}
              <div>
                <label className="block text-[11px] font-semibold text-[#1F2937] mb-1 flex items-center justify-between">
                  <span className="flex items-center">
                    <Moon className="h-3 w-3 mr-1 text-indigo-600" /> 야간 근무자 (쉼표로 구분)
                  </span>
                  {nightCheckStatus.status === 'valid' && (
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center">
                      <Check className="h-3 w-3 mr-0.5" /> 전원 연동 확인됨
                    </span>
                  )}
                  {nightCheckStatus.status === 'invalid' && (
                    <span className="text-[10px] text-red-600 font-bold flex items-center">
                      <AlertCircle className="h-3 w-3 mr-0.5" /> 미등록: {nightCheckStatus.invalidNames.join(', ')}
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  placeholder="예: 이병효, 박진석"
                  value={formData.night_shift}
                  onChange={(e) => handleNightShiftChange(e.target.value)}
                  className={`w-full px-2.5 py-1.5 bg-[#FFFFFF] border rounded-lg text-xs text-[#1F2937] focus:outline-hidden ${
                    nightCheckStatus.status === 'valid' 
                      ? 'border-emerald-500 focus:border-emerald-600' 
                      : nightCheckStatus.status === 'invalid' 
                        ? 'border-red-400 focus:border-red-500 bg-red-50/30' 
                        : 'border-[#E2E5E9] focus:border-[#243B5A]'
                  }`}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-[#E2E5E9]">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-3 py-1.5 bg-white border border-[#E2E5E9] text-[#1F2937] rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white rounded-lg text-xs font-semibold shadow-2xs cursor-pointer"
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. Status 탭 전용: Tank(TK1~4)별 6대 검사 항목 일자 및 상태 등록/수정 모달 */}
      {/* ============================================================== */}
      {isStatusEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-[99999]">
          <div className="bg-white border border-[#E2E5E9] rounded-xl p-5 max-w-xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-[#E2E5E9] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#1F2937] flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-[#243B5A]" />
                  Hull #{statusFormData.ship_no} Status & Tank 공정 일자 설정
                </h3>
                <p className="text-[11px] text-[#64748B]">TK1~TK4 각 탱크별 6개 공정의 날짜 및 상태를 등록/수정합니다.</p>
              </div>
              <button
                onClick={() => setIsStatusEditModalOpen(false)}
                className="p-1 text-[#64748B] hover:text-[#1F2937] rounded-lg hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStatusModal} className="space-y-4">
              {/* 호선명 & 선주사 빠른 확인/수정 */}
              <div className="grid grid-cols-2 gap-3 bg-[#F5F6F8] p-3 rounded-lg border border-[#E2E5E9]">
                <div>
                  <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                    호선명 / 프로젝트명
                  </label>
                  <input
                    type="text"
                    value={statusFormData.ship_name}
                    onChange={(e) => setStatusFormData({ ...statusFormData, ship_name: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                    선주사
                  </label>
                  <input
                    type="text"
                    placeholder="선주사 입력"
                    value={statusFormData.shipowner}
                    onChange={(e) => setStatusFormData({ ...statusFormData, shipowner: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Tank 선택 탭 (TK1, TK2, TK3, TK4) */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#1F2937]">
                  설정할 Tank 선택
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {TANKS.map((tk) => {
                    const isTabActive = (statusModalTankTab === tk);
                    const stats = calculateSingleTankStats(statusFormData.tank_status[tk]);

                    return (
                      <button
                        type="button"
                        key={tk}
                        onClick={() => setStatusModalTankTab(tk)}
                        className={`py-2 px-3 rounded-lg text-xs font-mono font-bold transition flex flex-col items-center gap-0.5 cursor-pointer ${
                          isTabActive
                            ? 'bg-[#243B5A] text-white shadow-2xs ring-2 ring-[#243B5A]/20'
                            : 'bg-[#F5F6F8] hover:bg-slate-200 text-[#475569] border border-[#E2E5E9]'
                        }`}
                      >
                        <span>{tk}</span>
                        <span className={`text-[10px] font-sans font-semibold ${
                          isTabActive ? 'text-white/80' : 'text-emerald-700'
                        }`}>
                          {stats.completed}/{stats.total} 완료
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 선택된 Tank의 6개 항목 리스트 (S/T 1ST, 2nd, Pre SBTT, NH3, B/F SBTT, A/T SBTT) */}
              <div className="bg-slate-50/70 p-3.5 rounded-xl border border-[#E2E5E9] space-y-2.5">
                <div className="flex justify-between items-center border-b border-[#E2E5E9] pb-2">
                  <span className="text-xs font-bold text-[#243B5A] font-mono">
                    [{statusModalTankTab}] 공정 단계 및 날짜 설정
                  </span>
                  <span className="text-[10px] text-[#64748B]">날짜를 입력하면 자동으로 완료/진행중으로 관리 가능</span>
                </div>

                <div className="space-y-2">
                  {TANK_STEPS.map((step) => {
                    const currentStepData = statusFormData.tank_status[statusModalTankTab]?.[step.key] || { date: '', status: '대기' };

                    return (
                      <div 
                        key={step.key} 
                        className="bg-white p-2.5 rounded-lg border border-[#E2E5E9] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shadow-2xs"
                      >
                        <div className="w-28 shrink-0">
                          <span className="text-xs font-bold text-[#1F2937] block">
                            {step.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-1 justify-end">
                          {/* 상태 선택 */}
                          <select
                            value={currentStepData.status}
                            onChange={(e) => {
                              const newStatus = e.target.value as '대기' | '진행중' | '완료';
                              setStatusFormData(prev => ({
                                ...prev,
                                tank_status: {
                                  ...prev.tank_status,
                                  [statusModalTankTab]: {
                                    ...prev.tank_status[statusModalTankTab],
                                    [step.key]: {
                                      ...prev.tank_status[statusModalTankTab][step.key],
                                      status: newStatus,
                                      // 완료로 바꿀 때 날짜가 비어있으면 오늘 날짜 자동 추천
                                      date: (newStatus === '완료' && !currentStepData.date) 
                                        ? new Date().toISOString().split('T')[0] 
                                        : currentStepData.date
                                    }
                                  }
                                }
                              }));
                            }}
                            className={`px-2 py-1 border rounded-lg text-xs font-semibold focus:outline-hidden ${
                              currentStepData.status === '완료' 
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                                : currentStepData.status === '진행중'
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                          >
                            <option value="대기">대기</option>
                            <option value="진행중">진행중</option>
                            <option value="완료">완료</option>
                          </select>

                          {/* 날짜 입력 */}
                          <div className="relative">
                            <input
                              type="date"
                              value={currentStepData.date || ''}
                              onChange={(e) => {
                                const newDate = e.target.value;
                                setStatusFormData(prev => ({
                                  ...prev,
                                  tank_status: {
                                    ...prev.tank_status,
                                    [statusModalTankTab]: {
                                      ...prev.tank_status[statusModalTankTab],
                                      [step.key]: {
                                        ...prev.tank_status[statusModalTankTab][step.key],
                                        date: newDate,
                                        // 날짜가 입력되면 대기였던 상태를 '완료'로 자동 상향 설정
                                        status: (newDate && currentStepData.status === '대기') ? '완료' : currentStepData.status
                                      }
                                    }
                                  }
                                }));
                              }}
                              className="px-2.5 py-1 bg-white border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-[#E2E5E9]">
                <button
                  type="button"
                  onClick={() => setIsStatusEditModalOpen(false)}
                  className="px-3.5 py-1.5 bg-white border border-[#E2E5E9] text-[#1F2937] rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white rounded-lg text-xs font-semibold shadow-2xs cursor-pointer"
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 6. 삭제 확인 모달 */}
      {/* ============================================================== */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-[99999]">
          <div className="bg-white border border-[#E2E5E9] rounded-xl p-5 max-w-sm w-full text-center shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="mx-auto h-10 w-10 bg-red-100 text-[#DC2626] rounded-full flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#1F2937]">호선 정보 삭제</h3>
              <p className="text-xs text-[#64748B]">선택한 호선 및 연계된 모든 Tank 공정 정보가 삭제됩니다. 계속하시겠습니까?</p>
            </div>
            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 py-1.5 bg-white border border-[#E2E5E9] text-[#1F2937] rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-1.5 bg-[#DC2626] hover:bg-red-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 7. 공통 알림(Notice/Alert) 모달 (기존 디자인 스타일 통일) */}
      {/* ============================================================== */}
      {alertInfo.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-[999999]">
          <div className="bg-white border border-[#E2E5E9] rounded-xl p-5 max-w-sm w-full shadow-2xl space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-full shrink-0 ${
                alertInfo.type === 'success' 
                  ? 'bg-emerald-100 text-emerald-600'
                  : alertInfo.type === 'error'
                  ? 'bg-red-100 text-red-600'
                  : alertInfo.type === 'warning'
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-blue-100 text-blue-600'
              }`}>
                {alertInfo.type === 'success' && <CheckCircle2 className="h-5 w-5" />}
                {alertInfo.type === 'error' && <AlertTriangle className="h-5 w-5" />}
                {alertInfo.type === 'warning' && <AlertCircle className="h-5 w-5" />}
                {alertInfo.type === 'info' && <Info className="h-5 w-5" />}
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="text-sm font-bold text-[#1F2937]">{alertInfo.title}</h3>
                <p className="text-xs text-[#64748B] whitespace-pre-line leading-relaxed">{alertInfo.message}</p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setAlertInfo({ ...alertInfo, isOpen: false })}
                className="px-4 py-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white text-xs font-semibold rounded-lg shadow-2xs cursor-pointer"
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
