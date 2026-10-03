'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
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
  Info,
  CheckCheck,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';

// Supabase 클라이언트 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 테이블명: 기본적으로 'ships'를 사용하되 Supabase 환경에 맞춰 연동
const TABLE_NAME = 'ships';

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
  'Sound Test 1St': 14,
  'Sound Test 2nd': 28,
  'Nh3 Test': 42,
  'PBGT': 57,
  'B/F SBTT': 71,
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

// Tank 공정 순서: S/T 1ST, S/T 2nd, Pre SBTT, NH3, PBGT, B/F SBTT, A/T SBTT
export const TANK_STEPS = [
  { key: 'st_1st', label: 'S/T 1ST' },
  { key: 'st_2nd', label: 'S/T 2nd' },
  { key: 'pre_sbtt', label: 'Pre SBTT' },
  { key: 'nh3', label: 'NH3' },
  { key: 'pbgt', label: 'PBGT' },
  { key: 'bf_sbtt', label: 'B/F SBTT' },
  { key: 'at_sbtt', label: 'A/T SBTT' },
] as const;

export type TankStepKey = typeof TANK_STEPS[number]['key'];

export interface TankStepDetail {
  date?: string;       // YYYY-MM-DD (일반 공정용)
  startDate?: string;  // PBGT 전용 시작일
  endDate?: string;    // PBGT 전용 종료일
  status: '대기' | '진행중' | '완료';
  value?: string;      // 일반 측정값/검사값 또는 PBGT Ref. 값
  finalValue?: string; // PBGT 전용 Final 값
  text?: string;       // NH3 전용 텍스트/비고
}

export type TankDetail = Record<TankStepKey, TankStepDetail>;

export type ShipTankStatus = Record<TankKey, TankDetail>;

export function getDefaultTankStatus(): ShipTankStatus {
  const createEmptySteps = (): TankDetail => ({
    st_1st: { date: '', status: '대기', value: '' },
    st_2nd: { date: '', status: '대기', value: '' },
    pre_sbtt: { date: '', status: '대기', value: '' },
    nh3: { date: '', status: '대기', value: '', text: '' },
    pbgt: { startDate: '', endDate: '', status: '대기', value: '', finalValue: '' },
    bf_sbtt: { date: '', status: '대기', value: '' },
    at_sbtt: { date: '', status: '대기', value: '' },
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
  sort_order?: number | null;
  ship_no: string;            // 호선번호 (Ship No.)
  ship_name: string;          // 선종 및 프로젝트명
  shipowner?: string;         // 선주사
  dock: string;               // 호선위치
  launch_date?: string | null;       // 진수일
  pt_mount_date?: string | null;     // P/T 탑재일
  dwt?: string | null;        // DWT 일자 (YYYY-MM-DD)
  status: ShipStatus;         // 진행단계현황
  progress: number | null;    // 산출 공정률
  delivery_date: string | null;      // 인도예정일
  day_shift: string;          // 주간 근무자
  day_shift_user_ids?: string[];
  night_shift: string;        // 야간 근무자
  night_shift_user_ids?: string[];
  tank_status: ShipTankStatus; // TK1, TK2, TK3, TK4 상세 상태 및 날짜
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

  // 2. Status 탭 내 Ship No. 서브탭 상태 (선택)
  const [selectedHullNo, setSelectedHullNo] = useState<string>('');

  // Status 신규 등록 모달 상태 (Ship 기반 전체 템플릿)
  const [isStatusCreateModalOpen, setIsStatusCreateModalOpen] = useState(false);
  const [statusCreateTankTab, setStatusCreateTankTab] = useState<TankKey>('TK1');
  const [statusCreateFormData, setStatusCreateFormData] = useState<Omit<ShipItem, 'id'>>({
    ship_no: '',
    ship_name: '',
    shipowner: '',
    dock: '제1도크',
    launch_date: '',
    pt_mount_date: '',
    dwt: '',
    status: 'Sound Test 1St',
    progress: 14,
    delivery_date: new Date().toISOString().split('T')[0],
    day_shift: '',
    day_shift_user_ids: [],
    night_shift: '',
    night_shift_user_ids: [],
    tank_status: getDefaultTankStatus(),
  });

  // Status 수정 모달 상태
  const [isStatusEditModalOpen, setIsStatusEditModalOpen] = useState(false);
  const [statusModalTankTab, setStatusModalTankTab] = useState<TankKey>('TK1');

  // Ship No. 서브탭 제목(Ship No.) 전용 수정 모달
  const [isShipNoTitleEditModalOpen, setIsShipNoTitleEditModalOpen] = useState(false);
  const [shipNoTitleEditId, setShipNoTitleEditId] = useState('');
  const [shipNoTitleEditValue, setShipNoTitleEditValue] = useState('');
  // Status 호선 선택 서브탭 설정 모달 상태
  // Status 선택 방식: 전체 호선 선택 / 선주사별 호선 선택
  const [statusSelectorTab, setStatusSelectorTab] = useState<'SHIP' | 'OWNER'>('SHIP');
  const [isShipSelectionModalOpen, setIsShipSelectionModalOpen] = useState(false);
  const [selectedOwnerFilter, setSelectedOwnerFilter] = useState('');
  const [statusEditFormData, setStatusEditFormData] = useState<{
    id: string;
    ship_no: string;
    ship_name: string;
    shipowner: string;
    dock: string;
    launch_date: string;
    pt_mount_date: string;
    dwt: string;
    delivery_date: string;
    tank_status: ShipTankStatus;
  }>({
    id: '',
    ship_no: '',
    ship_name: '',
    shipowner: '',
    dock: '',
    launch_date: '',
    pt_mount_date: '',
    dwt: '',
    delivery_date: '',
    tank_status: getDefaultTankStatus(),
  });

  // 호선 제원 정보 Modal States (호선 정보 탭 전용)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedShip, setSelectedShip] = useState<ShipItem | null>(null);
  const [editingShip, setEditingShip] = useState<ShipItem | null>(null);
  const [targetDeleteShip, setTargetDeleteShip] = useState<ShipItem | null>(null);

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
    progress: 14,
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
        const tankObj = { ...defaultStatus[tk] };
        TANK_STEPS.forEach(st => {
          if (raw[tk][st.key] && typeof raw[tk][st.key] === 'object') {
            tankObj[st.key] = {
              date: raw[tk][st.key].date || '',
              startDate: raw[tk][st.key].startDate || '',
              endDate: raw[tk][st.key].endDate || '',
              status: raw[tk][st.key].status || '대기',
              value: raw[tk][st.key].value || '',
              finalValue: raw[tk][st.key].finalValue || '',
              text: raw[tk][st.key].text || '',
            };
          }
        });
        result[tk] = tankObj;
      }
    });
    return result;
  };

  const fetchShips = async () => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .order('sort_order', { ascending: true, nullsFirst: false })
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
        .from(TABLE_NAME)
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

  // Status 선택용 선주사 목록 및 현재 선택 선주사
  const shipOwners = Array.from(
    new Set(ships.map(ship => (ship.shipowner || '').trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'ko'));

  const currentStatusOwner = currentStatusShip?.shipowner?.trim() || '';
  const ownerFilteredShips = ships.filter(ship =>
    (ship.shipowner || '').trim() === selectedOwnerFilter
  );

  const openShipSelectionModal = () => {
    setIsShipSelectionModalOpen(true);
  };

  const openOwnerSelectionModal = () => {
    const initialOwner = currentStatusOwner || shipOwners[0] || '';
    setSelectedOwnerFilter(initialOwner);
    setIsShipSelectionModalOpen(true);
  };

  const handleSelectStatusShip = (ship: ShipItem) => {
    setSelectedHullNo(ship.ship_no);
    setIsShipSelectionModalOpen(false);
  };

  // =========================================================================
  // Status 탱크별 공정 일자 종합 비교표 XLSX 다운로드
  // =========================================================================
  const handleDownloadExcel = () => {
    if (!currentStatusShip) {
      showAlert('다운로드 불가', '현재 선택된 호선이 없습니다.', 'warning');
      return;
    }

    try {
      const ship = currentStatusShip;

      // 화면의 "탱크별 공정 일자 종합 비교표"와 동일한 구조로 Excel 표 생성
      const rows: (string | number)[][] = [
        ['Ship No.', ship.ship_no],
        ['호선명 / 프로젝트명', ship.ship_name || ''],
        ['선주사', ship.shipowner || ''],
        ['호선 위치', ship.dock || ''],
        ['DWT', ship.dwt || ''],
        ['진수일', ship.launch_date || ''],
        ['인도예정일', ship.delivery_date || ''],
        [],
        ['검사 / 시험 공정', ...TANKS],
      ];

      TANK_STEPS.forEach((step) => {
        const row: (string | number)[] = [step.label];

        TANKS.forEach((tk) => {
          const stepInfo = ship.tank_status?.[tk]?.[step.key] || { status: '대기' };

          const dateText = step.key === 'pbgt'
            ? (stepInfo.startDate || stepInfo.endDate
              ? `${stepInfo.startDate || '-'} ~ ${stepInfo.endDate || '-'}`
              : '일자 미입력')
            : (stepInfo.date || '일자 미입력');

          let cellText = `상태: ${stepInfo.status || '대기'}\n일자: ${dateText}`;

          if (step.key === 'pbgt') {
            if (stepInfo.value || stepInfo.finalValue) {
              cellText += `\nRef: ${stepInfo.value || '-'}\nFinal: ${stepInfo.finalValue || '-'}`;
            }
          } else if (stepInfo.value) {
            cellText += `\n값: ${stepInfo.value}`;
          }

          if (step.key === 'nh3' && stepInfo.text) {
            cellText += `\nNH3 비고: ${stepInfo.text}`;
          }

          row.push(cellText);
        });

        rows.push(row);
      });

      const worksheet = XLSX.utils.aoa_to_sheet(rows);

      // 화면의 표와 같은 5열 구조 및 가독성 확보
      worksheet['!cols'] = [
        { wch: 22 },
        { wch: 27 },
        { wch: 27 },
        { wch: 27 },
        { wch: 27 },
      ];

      worksheet['!rows'] = rows.map((_, index) => ({
        hpt: index >= 9 ? 55 : 20,
      }));

      worksheet['!freeze'] = { xSplit: 1, ySplit: 9 };

      // 비교표 영역에 테두리/정렬 스타일 적용
      const tableStartRow = 8;
      const tableEndRow = 8 + TANK_STEPS.length;
      for (let r = tableStartRow; r <= tableEndRow; r++) {
        for (let c = 0; c <= TANKS.length; c++) {
          const cellAddress = XLSX.utils.encode_cell({ r, c });
          if (!worksheet[cellAddress]) continue;

          worksheet[cellAddress].s = {
            alignment: {
              vertical: 'center',
              horizontal: c === 0 ? 'left' : 'center',
              wrapText: true,
            },
            border: {
              top: { style: 'thin' },
              bottom: { style: 'thin' },
              left: { style: 'thin' },
              right: { style: 'thin' },
            },
            font: {
              bold: r === tableStartRow || c === 0,
            },
          };
        }
      }

      worksheet['!autofilter'] = {
        ref: `A${tableStartRow + 1}:E${tableEndRow + 1}`,
      };

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '공정일자 종합비교표');

      const safeShipNo = String(ship.ship_no || 'Unknown').replace(/[\\/:*?"<>|]/g, '_');
      XLSX.writeFile(
        workbook,
        `Ship_${safeShipNo}_탱크별_공정일자_종합비교표.xlsx`
      );

      showAlert('다운로드 완료', '탱크별 공정 일자 종합 비교표를 XLSX 파일로 다운로드했습니다.', 'success');
    } catch (error: any) {
      console.error('XLSX 다운로드 실패:', error);
      showAlert('다운로드 실패', `Excel 파일 생성 중 오류가 발생했습니다: ${error?.message || '알 수 없는 오류'}`, 'error');
    }
  };

  // =========================================================================
  // Status 탭 전용 핸들러 (선택, 등록, 수정, 삭제)
  // =========================================================================

  // [등록] Status 탭에서 신규 Ship 등록 모달 열기
  const handleOpenStatusCreateModal = () => {
    if (!isAdmin) {
      showAlert('권한 필요', '신규 등록은 관리자 권한만 가능합니다.', 'warning');
      return;
    }
    const initialStatus: ShipStatus = 'Sound Test 1St';
    setStatusCreateFormData({
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
    setStatusCreateTankTab('TK1');
    setIsStatusCreateModalOpen(true);
  };

  // [등록 처리] Status 탭에서 신규 Ship 생성 저장
  const handleSaveStatusCreateModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    if (!statusCreateFormData.ship_no.trim() || !statusCreateFormData.ship_name.trim()) {
      showAlert('입력 확인', '호선 번호(Ship No.)와 선종 및 프로젝트명을 입력해주세요.', 'warning');
      return;
    }

    // 중복 Ship No 검사
    if (ships.some(s => s.ship_no.trim().toLowerCase() === statusCreateFormData.ship_no.trim().toLowerCase())) {
      showAlert('중복 안내', `이미 존재하는 호선 번호 [${statusCreateFormData.ship_no}] 입니다. 다른 번호를 입력하세요.`, 'warning');
      return;
    }

    try {
      // 날짜 빈 문자열 → null 변환 (Supabase date 타입 오류 방지)
      const sanitizedCreateData = {
        ...statusCreateFormData,
        sort_order: ships.length,
        launch_date: statusCreateFormData.launch_date || null,
        pt_mount_date: statusCreateFormData.pt_mount_date || null,
        dwt: statusCreateFormData.dwt || null,
        delivery_date: statusCreateFormData.delivery_date || null,
      };

      const { data, error } = await supabase
        .from(TABLE_NAME)
        .insert([sanitizedCreateData])
        .select();

      if (error) {
        if (error.message.includes('column') && error.message.includes('does not exist')) {
          showAlert(
            '데이터베이스 컬럼 추가 필요',
            `Supabase '${TABLE_NAME}' 테이블에 신규 컬럼(tank_status 등)이 아직 추가되지 않았습니다.\nSQL Editor에서 컬럼 추가 쿼리를 실행해 주세요.\n\n오류: ${error.message}`,
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
        setShips(prev => [...prev, newShip]);
        setSelectedHullNo(newShip.ship_no); // 새로 만든 Ship 서브탭으로 바로 선택!
      }

      setIsStatusCreateModalOpen(false);
      showAlert('등록 완료', `신규 호선 [Ship #${statusCreateFormData.ship_no}]의 Status가 성공적으로 등록되었습니다.`, 'success');
    } catch (e: any) {
      console.error('신규 Ship 등록 중 예외 발생:', e);
      showAlert('오류', '처리 중 오류가 발생했습니다: ' + e?.message, 'error');
    }
  };

  // [수정] Status 탭에서 선택된 Ship 수정 모달 열기
  const handleOpenStatusEditModal = (ship: ShipItem) => {
    if (!isAdmin) {
      showAlert('권한 필요', '수정은 관리자 권한만 가능합니다.', 'warning');
      return;
    }
    setStatusEditFormData({
      id: ship.id,
      ship_no: ship.ship_no,
      ship_name: ship.ship_name,
      shipowner: ship.shipowner || '',
      dock: ship.dock || '',
      launch_date: ship.launch_date || '',
      pt_mount_date: ship.pt_mount_date || '',
      dwt: ship.dwt || '',
      delivery_date: ship.delivery_date || '',
      tank_status: JSON.parse(JSON.stringify(ship.tank_status || getDefaultTankStatus())),
    });
    setStatusModalTankTab('TK1');
    setIsStatusEditModalOpen(true);
  };

  // Ship No. 서브탭의 TITLE(Ship No.)만 수정
  const handleOpenShipNoTitleEdit = (ship: ShipItem) => {
    if (!isAdmin) {
      showAlert('권한 필요', '수정은 관리자 권한만 가능합니다.', 'warning');
      return;
    }

    setShipNoTitleEditId(ship.id);
    setShipNoTitleEditValue(ship.ship_no);
    setIsShipNoTitleEditModalOpen(true);
  };

  const handleSaveShipNoTitleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !shipNoTitleEditId) return;

    const newShipNo = shipNoTitleEditValue.trim();
    if (!newShipNo) {
      showAlert('입력 확인', 'Ship No.를 입력해주세요.', 'warning');
      return;
    }

    const duplicate = ships.some(
      (ship) =>
        ship.id !== shipNoTitleEditId &&
        ship.ship_no.trim().toLowerCase() === newShipNo.toLowerCase()
    );

    if (duplicate) {
      showAlert('중복 안내', `이미 존재하는 Ship No. [${newShipNo}] 입니다. 다른 번호를 입력하세요.`, 'warning');
      return;
    }

    try {
      const targetShip = ships.find((ship) => ship.id === shipNoTitleEditId);
      if (!targetShip) {
        showAlert('수정 실패', '수정할 호선을 찾을 수 없습니다.', 'error');
        return;
      }

      const { error } = await supabase
        .from(TABLE_NAME)
        .update({ ship_no: newShipNo })
        .eq('id', shipNoTitleEditId);

      if (error) {
        showAlert('수정 실패', 'Ship No. 수정 중 오류가 발생했습니다: ' + error.message, 'error');
        return;
      }

      setShips((prev) =>
        prev.map((ship) =>
          ship.id === shipNoTitleEditId
            ? { ...ship, ship_no: newShipNo }
            : ship
        )
      );

      if (selectedHullNo === targetShip.ship_no) {
        setSelectedHullNo(newShipNo);
      }

      setIsShipNoTitleEditModalOpen(false);
      showAlert('수정 완료', `[Ship #${targetShip.ship_no}]의 Ship No.가 [${newShipNo}]로 수정되었습니다.`, 'success');
    } catch (e: any) {
      showAlert('수정 실패', 'Ship No. 수정 중 오류가 발생했습니다: ' + (e?.message || '알 수 없는 오류'), 'error');
    }
  };

  // [수정 처리] Status 수정 모달 저장
  const handleSaveStatusEditModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !statusEditFormData.id) return;

    try {
      const updatePayload = {
        ship_name: statusEditFormData.ship_name,
        shipowner: statusEditFormData.shipowner,
        dock: statusEditFormData.dock,
        launch_date: statusEditFormData.launch_date || null,
        pt_mount_date: statusEditFormData.pt_mount_date || null,
        dwt: statusEditFormData.dwt || null,
        delivery_date: statusEditFormData.delivery_date || null,
        tank_status: statusEditFormData.tank_status,
      };

      const { error } = await supabase
        .from(TABLE_NAME)
        .update(updatePayload)
        .eq('id', statusEditFormData.id);

      if (error) {
        if (error.message.includes('column') && error.message.includes('does not exist')) {
          showAlert(
            '데이터베이스 컬럼 추가 필요',
            `Supabase '${TABLE_NAME}' 테이블에 'tank_status' 등의 컬럼이 아직 생성되지 않았습니다.\nSQL Editor에서 컬럼 추가 쿼리를 실행해 주세요.`,
            'error'
          );
        } else {
          showAlert('저장 실패', 'Status 저장 중 오류가 발생했습니다: ' + error.message, 'error');
        }
        return;
      }

      const updated = {
        ...currentStatusShip!,
        ...updatePayload,
      };

      setShips(prev => prev.map(s => s.id === statusEditFormData.id ? updated : s));
      setIsStatusEditModalOpen(false);
      showAlert('수정 완료', `[Ship #${statusEditFormData.ship_no}]의 Status 및 Tank 공정 일자가 수정되었습니다.`, 'success');
    } catch (e: any) {
      showAlert('오류', '수정에 실패했습니다: ' + e?.message, 'error');
    }
  };

  // [삭제] Status 탭에서 선택된 Ship 삭제 요청
  const handleRequestDeleteStatusShip = (ship: ShipItem) => {
    if (!isAdmin) {
      showAlert('권한 필요', '삭제는 관리자 권한만 가능합니다.', 'warning');
      return;
    }
    setTargetDeleteShip(ship);
    setIsDeleteModalOpen(true);
  };

  // [삭제 확인 처리]
  const handleConfirmDelete = async () => {
    if (!isAdmin || !targetDeleteShip) return;

    try {
      const { error } = await supabase
        .from(TABLE_NAME)
        .delete()
        .eq('id', targetDeleteShip.id);

      if (error) {
        showAlert('삭제 오류', '삭제 중 오류가 발생했습니다: ' + error.message, 'error');
        return;
      }

      const remainingShips = ships.filter(s => s.id !== targetDeleteShip.id);
      setShips(remainingShips);

      // 삭제된 호선이 현재 서브탭이었을 경우 다른 호선으로 자동 전환
      if (selectedHullNo === targetDeleteShip.ship_no) {
        if (remainingShips.length > 0) {
          setSelectedHullNo(remainingShips[0].ship_no);
        } else {
          setSelectedHullNo('');
        }
      }

      if (selectedShip?.id === targetDeleteShip.id) {
        setSelectedShip(null);
      }

      setIsDeleteModalOpen(false);
      showAlert('삭제 완료', `[Ship #${targetDeleteShip.ship_no}] 호선 및 Status 정보가 삭제되었습니다.`, 'success');
      setTargetDeleteShip(null);
    } catch (e: any) {
      console.error('삭제 처리 실패:', e);
      showAlert('삭제 실패', '처리 중 오류가 발생했습니다: ' + e?.message, 'error');
    }
  };

  // =========================================================================
  // 호선 제원 정보 탭 전용 핸들러 (신규 등록 및 수정)
  // =========================================================================
  const handleOpenAddModal = () => {
    if (!isAdmin) {
      showAlert('권한 필요', '관리자만 등록할 수 있습니다.', 'warning');
      return;
    }
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

  const handleOpenEditModal = (ship: ShipItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!isAdmin) {
      showAlert('권한 필요', '관리자만 수정할 수 있습니다.', 'warning');
      return;
    }
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

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
      // 날짜 빈 문자열 → null 변환 (Supabase date 타입 오류 방지)
      const sanitizedFormData = {
        ...formData,
        launch_date: formData.launch_date || null,
        pt_mount_date: formData.pt_mount_date || null,
        dwt: formData.dwt || null,
        delivery_date: formData.delivery_date || null,
      };

      if (editingShip) {
        // 수정 (Update)
        const { error } = await supabase
          .from(TABLE_NAME)
          .update(sanitizedFormData)
          .eq('id', editingShip.id);

        if (error) {
          showAlert('수정 실패', '수정 중 오류가 발생했습니다: ' + error.message, 'error');
          return;
        }

        const updatedShip = { ...editingShip, ...sanitizedFormData };
        setShips(prev => prev.map(s => s.id === editingShip.id ? updatedShip : s));
        if (selectedShip?.id === editingShip.id) {
          setSelectedShip(updatedShip);
        }
        showAlert('수정 완료', `호선 [${formData.ship_no}] 정보가 수정되었습니다.`, 'success');
      } else {
        // 신규 등록 (Insert)
        const { data, error } = await supabase
          .from(TABLE_NAME)
          .insert([{ ...sanitizedFormData, sort_order: ships.length }])
          .select();

        if (error) {
          showAlert('등록 실패', '등록 중 오류가 발생했습니다: ' + error.message, 'error');
          return;
        }

        if (data && data.length > 0) {
          const newShip: ShipItem = {
            ...data[0],
            tank_status: normalizeTankStatus(data[0].tank_status),
          };
          setShips(prev => [...prev, newShip]);
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

  // Tank 전체 공정 완료율 통계 계산 (총 28개 검사 항목: 4 탱크 * 7 단계)
  const calculateTankStats = (tankStatus?: ShipTankStatus) => {
    if (!tankStatus) return { completed: 0, total: 28, percent: 0 };
    let completed = 0;
    TANKS.forEach(tk => {
      TANK_STEPS.forEach(st => {
        const step = tankStatus[tk]?.[st.key];
        if (step && (step.status === '완료' || step.date || step.startDate)) {
          completed++;
        }
      });
    });
    const percent = Math.round((completed / 28) * 100);
    return { completed, total: 28, percent };
  };

  // 각 Tank별 완료율 계산 (총 7개 검사 항목)
  const calculateSingleTankStats = (tankDetail?: TankDetail) => {
    if (!tankDetail) return { completed: 0, total: 7, percent: 0 };
    let completed = 0;
    TANK_STEPS.forEach(st => {
      const step = tankDetail[st.key];
      if (step && (step.status === '완료' || step.date || step.startDate)) {
        completed++;
      }
    });
    return { completed, total: 7, percent: Math.round((completed / 7) * 100) };
  };

  return (
    <div className="space-y-4 font-sans text-[#1F2937]">
      {/* 알림 Modal */}
      {alertInfo.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-[999999]">
          <div className="bg-white border border-[#E2E5E9] rounded-xl p-5 max-w-sm w-full shadow-2xl space-y-3">
            <div className="flex items-center space-x-2">
              {alertInfo.type === 'error' && <AlertCircle className="h-5 w-5 text-red-600" />}
              {alertInfo.type === 'warning' && <AlertTriangle className="h-5 w-5 text-amber-500" />}
              {alertInfo.type === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
              {alertInfo.type === 'info' && <Info className="h-5 w-5 text-blue-600" />}
              <h4 className="text-sm font-bold text-[#1F2937]">{alertInfo.title}</h4>
            </div>
            <p className="text-xs text-[#475569] whitespace-pre-line leading-relaxed">{alertInfo.message}</p>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setAlertInfo({ ...alertInfo, isOpen: false })}
                className="px-4 py-1.5 bg-[#243B5A] text-white rounded-lg text-xs font-semibold hover:bg-[#1d3049]"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 0. 대분류 메인 탭 네비게이션 (호선 정보 vs Status 공정 현황) */}
      <div className="bg-white p-2 rounded-xl border border-[#E2E5E9] shadow-2xs flex items-center justify-between gap-2">
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setActiveMainTab('INFO')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${activeMainTab === 'INFO'
                ? 'bg-[#243B5A] text-white shadow-2xs'
                : 'text-[#64748B] hover:text-[#1F2937] hover:bg-slate-100'
              }`}
          >
            <Anchor className="h-4 w-4" />
            <span>호선 제원 정보</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeMainTab === 'INFO' ? 'bg-white/20 text-white' : 'bg-slate-200 text-[#64748B]'
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
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${activeMainTab === 'STATUS'
                ? 'bg-[#243B5A] text-white shadow-2xs'
                : 'text-[#64748B] hover:text-[#1F2937] hover:bg-slate-100'
              }`}
          >
            <Layers className="h-4 w-4" />
            <span>Status (공정 현황)</span>
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
      {/* 탭 1: 호선 제원 정보 */}
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
                <p className="text-[11px] text-[#64748B]">선종, 선주사, 호선위치 및 주요 탑재/인도 일정 관리</p>
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
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition ${isCurrent
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
                                  setTargetDeleteShip(ship);
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
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${isCurrent
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
      {/* 탭 2: Status (서브탭 순서 이동, PBGT 추가, DWT 일자 등록 가능) */}
      {/* ============================================================== */}
      {activeMainTab === 'STATUS' && (
        <div className="space-y-4">
          {/* Status 컨트롤 바 (서브탭 순서 변경 및 관리자 등록 버튼) */}
          <div className="bg-white p-3.5 rounded-xl border border-[#E2E5E9] shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div className="flex items-center space-x-2">
                <div className="bg-[#243B5A]/10 p-1.5 rounded-lg text-[#243B5A]">
                  <Ship className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#1F2937] flex items-center gap-1.5">
                    Ship No. 선택 서브탭
                  </h3>
                  <p className="text-[11px] text-[#64748B]">호선을 선택하여 TK1~TK4 공정 및 상세 데이터를 관리합니다. </p>
                </div>
              </div>

              {/* 관리자 전용: Status 신규 등록 버튼 */}
              {isAdmin && (
                <button
                  onClick={handleOpenStatusCreateModal}
                  className="flex items-center space-x-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>신규 Ship 등록</span>
                </button>
              )}
            </div>

            {/* Status 선택 방식: 호선 선택 / 선주사 선택 */}
            <div className="border-t border-[#E2E5E9] pt-3">
              <div className="flex items-center gap-1.5 mb-3">
                <button
                  type="button"
                  onClick={() => setStatusSelectorTab('SHIP')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    statusSelectorTab === 'SHIP'
                      ? 'bg-[#243B5A] text-white border-[#243B5A]'
                      : 'bg-white text-[#64748B] border-[#CBD5E1] hover:bg-slate-50'
                  }`}
                >
                  호선 선택
                </button>
                <button
                  type="button"
                  onClick={() => setStatusSelectorTab('OWNER')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    statusSelectorTab === 'OWNER'
                      ? 'bg-[#243B5A] text-white border-[#243B5A]'
                      : 'bg-white text-[#64748B] border-[#CBD5E1] hover:bg-slate-50'
                  }`}
                >
                  선주사 선택
                </button>
              </div>

              {statusSelectorTab === 'SHIP' ? (
                <div className="flex items-center justify-between gap-3 bg-slate-50 border border-[#E2E5E9] rounded-lg px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-[10px] text-[#64748B] font-semibold mb-0.5">현재 선택된 호선</div>
                    <div className="flex items-center gap-2 min-w-0">
                      {currentStatusShip ? (
                        <>
                          <span className="bg-[#243B5A] text-white text-xs font-mono font-bold px-2 py-0.5 rounded shrink-0">
                            Ship {currentStatusShip.ship_no}
                          </span>
                          <span className="text-xs font-semibold text-[#1F2937] truncate">
                            {currentStatusShip.ship_name || '호선명 미입력'}
                          </span>
                          {currentStatusShip.shipowner && (
                            <span className="text-[10px] bg-white text-[#475569] border border-[#E2E5E9] px-1.5 py-0.5 rounded shrink-0">
                              {currentStatusShip.shipowner}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-[#64748B]">선택된 호선이 없습니다.</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={openShipSelectionModal}
                    className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#243B5A] bg-white text-[#243B5A] hover:bg-[#F1F5F9] transition cursor-pointer shadow-2xs"
                  >
                    <Search className="h-3.5 w-3.5" />
                    <span>목록 보기</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 bg-slate-50 border border-[#E2E5E9] rounded-lg px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-[10px] text-[#64748B] font-semibold mb-0.5">현재 선택된 선주사</div>
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="h-3.5 w-3.5 text-[#243B5A] shrink-0" />
                      <span className="text-xs font-bold text-[#1F2937] truncate">
                        {currentStatusOwner || '선주사 미지정'}
                      </span>
                      {currentStatusShip && currentStatusOwner && (
                        <span className="text-[10px] text-[#64748B] shrink-0">
                          · {currentStatusShip.ship_no} 선택
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={openOwnerSelectionModal}
                    className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#243B5A] bg-white text-[#243B5A] hover:bg-[#F1F5F9] transition cursor-pointer shadow-2xs"
                  >
                    <Search className="h-3.5 w-3.5" />
                    <span>목록 보기</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 선택된 호선의 Status 대시보드 */}
          {currentStatusShip ? (
            <div className="space-y-4">
              {/* 호선 상세 요약 카드 및 관리자 액션 버튼 */}
              <div className="bg-white p-4 rounded-xl border border-[#E2E5E9] shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-[#243B5A] text-white text-xs font-mono font-bold px-2 py-0.5 rounded">
                      Ship #{currentStatusShip.ship_no}
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
                    <span>DWT: <strong className="text-[#1F2937] font-mono">{currentStatusShip.dwt || '-'}</strong></span>
                    <span>•</span>
                    <span>진수일: <strong className="text-[#1F2937]">{currentStatusShip.launch_date || '-'}</strong></span>
                    <span>•</span>
                    <span>인도예정: <strong className="text-[#1F2937]">{currentStatusShip.delivery_date || '-'}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-[#E2E5E9] flex-wrap">
                  {/* 탱크 공정 진행률 바 */}
                  {(() => {
                    const stats = calculateTankStats(currentStatusShip.tank_status);
                    return (
                      <div className="flex flex-col items-end mr-1">
                        <div className="text-[11px] font-semibold text-[#64748B]">
                          공정 달성률: <span className="text-[#243B5A] font-bold text-xs">{stats.completed}/{stats.total}건 ({stats.percent}%)</span>
                        </div>
                        <div className="w-32 sm:w-36 h-2 bg-slate-100 rounded-full mt-1 overflow-hidden border border-slate-200">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                            style={{ width: `${stats.percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {/* 엑셀 다운로드 버튼 */}
                  <button
                    onClick={handleDownloadExcel}
                    className="flex items-center space-x-1 bg-white hover:bg-slate-50 text-[#243B5A] border border-[#243B5A] px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
                    title="Status 엑셀 다운로드"
                  >
                    <span>엑셀 다운로드</span>
                  </button>

                  {/* 관리자 권한 전용 액션: 수정 & 삭제 */}
                  {isAdmin && (
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => handleOpenStatusEditModal(currentStatusShip)}
                        className="flex items-center space-x-1 bg-white hover:bg-slate-50 text-[#243B5A] border border-[#243B5A] px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
                        title="선택 호선 Status 수정"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>수정</span>
                      </button>

                      <button
                        onClick={() => handleRequestDeleteStatusShip(currentStatusShip)}
                        className="flex items-center space-x-1 bg-red-50 hover:bg-red-100 text-[#DC2626] border border-red-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
                        title="선택 호선 Status 삭제"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>삭제</span>
                      </button>
                    </div>
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

                      {/* 7개 공정 항목 목록 (PBGT 포함) */}
                      <div className="p-3 divide-y divide-[#E2E5E9]/60 flex-1 space-y-2.5">
                        {TANK_STEPS.map((step) => {
                          const stepInfo = tankDetail[step.key] || { status: '대기' };
                          const isDone = stepInfo.status === '완료';
                          const isInProgress = stepInfo.status === '진행중';

                          return (
                            <div key={step.key} className="pt-2 first:pt-0 space-y-1">
                              <div className="flex items-center justify-between text-xs">
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

                                <div className="flex items-center space-x-1.5 flex-wrap justify-end gap-y-1">
                                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${isDone
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : isInProgress
                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                        : 'bg-slate-50 text-slate-400 border-slate-200'
                                    }`}>
                                    {stepInfo.status || '대기'}
                                  </span>

                                  {/* 일반 공정 값 */}
                                  {step.key !== 'pbgt' && stepInfo.value && (
                                    <span className="font-mono text-[10px] font-bold text-[#243B5A] bg-blue-50/80 px-1.5 py-0.5 rounded border border-blue-200" title="입력값/측정값">
                                      값: {stepInfo.value}
                                    </span>
                                  )}

                                  {/* 일반 공정 일자 */}
                                  {step.key !== 'pbgt' && (
                                    <span className="font-mono text-[11px] text-[#475569] flex items-center gap-0.5 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 min-w-[76px] justify-center">
                                      <Calendar className="h-2.5 w-2.5 text-slate-400" />
                                      {stepInfo.date ? stepInfo.date : '-'}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* PBGT 공정 전용 UI (시작일/종료일, Ref/Final 2개 값 입력) */}
                              {step.key === 'pbgt' && (
                                <div className="ml-5 text-[10.5px] bg-slate-50 border border-slate-200 rounded p-1.5 space-y-1">
                                  <div className="flex items-center justify-between font-mono text-[#475569]">
                                    <span className="font-semibold text-[#243B5A]">일자:</span>
                                    <span>
                                      {stepInfo.startDate || '-'} ~ {stepInfo.endDate || '-'}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between font-mono">
                                    <span className="bg-blue-50 text-[#243B5A] px-1 py-0.2 rounded border border-blue-200">
                                      Ref: {stepInfo.value || '-'}
                                    </span>
                                    <span className="bg-emerald-50 text-emerald-800 px-1 py-0.2 rounded border border-emerald-200">
                                      Final: {stepInfo.finalValue || '-'}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* NH3 항목 전용 특이사항 / 텍스트 표시 */}
                              {step.key === 'nh3' && stepInfo.text && (
                                <div className="ml-5 text-[10.5px] text-[#334155] bg-amber-50/70 border border-amber-200/80 rounded px-2 py-0.5 flex items-start gap-1">
                                  <span className="font-bold text-amber-800 shrink-0">NH3 비고:</span>
                                  <span className="break-all">{stepInfo.text}</span>
                                </div>
                              )}
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
                    Ship #{currentStatusShip.ship_no} 탱크별 공정 일자 종합 비교표
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="hidden md:inline text-[11px] text-[#64748B]">S/T 1ST, S/T 2nd, Pre SBTT, NH3, PBGT, B/F SBTT, A/T SBTT</span>
                    <button
                      type="button"
                      onClick={handleDownloadExcel}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#243B5A] hover:bg-[#1d3049] text-white text-[11px] font-bold transition cursor-pointer whitespace-nowrap"
                      title="탱크별 공정 일자 종합 비교표를 Excel 파일로 다운로드"
                    >
                      <span className="font-mono">XLSX</span>
                      <span>다운로드</span>
                    </button>
                  </div>
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
                            const stepInfo = currentStatusShip.tank_status?.[tkKey]?.[step.key] || { status: '대기' };
                            const isDone = stepInfo.status === '완료';
                            const isInProgress = stepInfo.status === '진행중';

                            return (
                              <td key={tkKey} className="py-3 px-4 text-center">
                                <div className="inline-flex flex-col items-center gap-1">
                                  <div className="flex items-center gap-1 flex-wrap justify-center">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${isDone
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : isInProgress
                                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                                          : 'bg-white text-slate-400 border-slate-200'
                                      }`}>
                                      {stepInfo.status}
                                    </span>
                                    {step.key !== 'pbgt' && stepInfo.value && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-[#243B5A] border border-blue-200">
                                        {stepInfo.value}
                                      </span>
                                    )}
                                  </div>

                                  {/* 일자 표기 */}
                                  {step.key === 'pbgt' ? (
                                    <span className="font-mono text-[10.5px] text-[#64748B]">
                                      {stepInfo.startDate || stepInfo.endDate ? `${stepInfo.startDate || '-'} ~ ${stepInfo.endDate || '-'}` : '일자 미입력'}
                                    </span>
                                  ) : (
                                    <span className="font-mono text-[11px] text-[#64748B]">
                                      {stepInfo.date ? stepInfo.date : '일자 미입력'}
                                    </span>
                                  )}

                                  {/* PBGT Ref / Final 값 */}
                                  {step.key === 'pbgt' && (stepInfo.value || stepInfo.finalValue) && (
                                    <div className="flex gap-1 text-[9.5px] font-mono font-semibold">
                                      <span className="bg-blue-50 text-[#243B5A] px-1 rounded border border-blue-200">Ref: {stepInfo.value || '-'}</span>
                                      <span className="bg-emerald-50 text-emerald-800 px-1 rounded border border-emerald-200">Final: {stepInfo.finalValue || '-'}</span>
                                    </div>
                                  )}

                                  {/* NH3 비고 */}
                                  {step.key === 'nh3' && stepInfo.text && (
                                    <span className="text-[10px] text-amber-900 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded max-w-[120px] truncate" title={stepInfo.text}>
                                      📝 {stepInfo.text}
                                    </span>
                                  )}
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
      {/* 3. 호선 상세 바텀시트 모달 */}
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

            {/* 호선 기본 제원 */}
            <div className="bg-[#F5F6F8] p-3 rounded-lg border border-[#E2E5E9] text-xs space-y-2">
              <span className="text-[11px] font-bold text-[#243B5A] flex items-center gap-1 border-b border-[#E2E5E9] pb-1">
                <Ship className="h-3.5 w-3.5" /> 호선 기본 제원
              </span>
              <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-[11px]">
                <div><span className="text-[#64748B]">선주사:</span> <strong className="text-[#1F2937]">{selectedShip.shipowner || '-'}</strong></div>
                <div><span className="text-[#64748B]">DWT:</span> <strong className="text-[#1F2937] font-mono">{selectedShip.dwt || '-'}</strong></div>
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
                  <Activity className="h-3.5 w-3.5 text-[#243B5A]" /> 시운전 공정 현황
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
                      className={`flex items-center justify-between p-2 rounded-lg border text-xs transition ${isCurrent
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
                  className="flex items-center space-x-1 px-3 py-1.5 bg-white border border-[#E2E5E9] hover:bg-slate-50 text-[#1F2937] rounded-lg text-xs font-semibold cursor-pointer"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>정보 수정</span>
                </button>
                <button
                  onClick={() => {
                    setTargetDeleteShip(selectedShip);
                    setIsDeleteModalOpen(true);
                  }}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-red-50 text-[#DC2626] hover:bg-red-100 rounded-lg text-xs font-semibold border border-red-200 cursor-pointer"
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
      {/* 4. 호선 정보 탭 전용: 등록 및 수정 모달 (DWT 일자/자유 형식) */}
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                    호선 번호 (Ship No.) *
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                    호선 위치(도크)
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
                    DWT 
                  </label>
                  <input
                    type="date"
                    value={formData.dwt || ''}
                    onChange={(e) => setFormData({ ...formData, dwt: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden font-mono"
                  />
                </div>
              </div>

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

              <div>
                <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                  인도 예정일
                </label>
                <input
                  type="date"
                  value={formData.delivery_date ?? ''}
                  onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden font-mono"
                />
              </div>

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
                  className={`w-full px-2.5 py-1.5 bg-[#FFFFFF] border rounded-lg text-xs text-[#1F2937] focus:outline-hidden ${dayCheckStatus.status === 'valid'
                      ? 'border-emerald-500 focus:border-emerald-600'
                      : dayCheckStatus.status === 'invalid'
                        ? 'border-red-400 focus:border-red-500 bg-red-50/30'
                        : 'border-[#E2E5E9] focus:border-[#243B5A]'
                    }`}
                />
              </div>

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
                  className={`w-full px-2.5 py-1.5 bg-[#FFFFFF] border rounded-lg text-xs text-[#1F2937] focus:outline-hidden ${nightCheckStatus.status === 'valid'
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
      {/* 5. Status 탭 전용 [신규 등록]: Ship 기반 신규 호선 & TK1~4 공정 모달 */}
      {/* ============================================================== */}
      {isStatusCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-[99999]">
          <div className="bg-white border border-[#E2E5E9] rounded-xl p-5 max-w-2xl w-full shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-[#E2E5E9] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#1F2937] flex items-center gap-1.5">
                  <Plus className="h-4 w-4 text-[#243B5A]" />
                  신규 Ship Status 등록 (호선 제원 & Tank 공정)
                </h3>
                <p className="text-[11px] text-[#64748B]">Ship No 및 호선 정보와 함께 TK1~TK4의 초기 공정 상태 및 날짜를 설정합니다.</p>
              </div>
              <button
                onClick={() => setIsStatusCreateModalOpen(false)}
                className="p-1 text-[#64748B] hover:text-[#1F2937] rounded-lg hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStatusCreateModal} className="space-y-4">
              {/* 1. 호선 기본 제원 필드 */}
              <div className="bg-[#F5F6F8] p-3.5 rounded-xl border border-[#E2E5E9] space-y-3">
                <span className="text-xs font-bold text-[#243B5A] flex items-center gap-1">
                  <Ship className="h-3.5 w-3.5" /> 1단계: 호선 기본 제원 입력
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                      Ship No. (호선번호) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="예: 8255"
                      value={statusCreateFormData.ship_no}
                      onChange={(e) => setStatusCreateFormData({ ...statusCreateFormData, ship_no: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E2E5E9] rounded-lg text-xs font-mono font-bold text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                      호선명 / 프로젝트명 *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="예: 174K LNGC"
                      value={statusCreateFormData.ship_name}
                      onChange={(e) => setStatusCreateFormData({ ...statusCreateFormData, ship_name: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                      선주사
                    </label>
                    <input
                      type="text"
                      placeholder="예: 현대LNG해운"
                      value={statusCreateFormData.shipowner || ''}
                      onChange={(e) => setStatusCreateFormData({ ...statusCreateFormData, shipowner: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                      호선 위치 (도크)
                    </label>
                    <input
                      type="text"
                      placeholder="예: 제1도크"
                      value={statusCreateFormData.dock}
                      onChange={(e) => setStatusCreateFormData({ ...statusCreateFormData, dock: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                      DWT 
                    </label>
                    <input
                      type="date"
                      value={statusCreateFormData.dwt || ''}
                      onChange={(e) => setStatusCreateFormData({ ...statusCreateFormData, dwt: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                      진수일
                    </label>
                    <input
                      type="date"
                      value={statusCreateFormData.launch_date || ''}
                      onChange={(e) => setStatusCreateFormData({ ...statusCreateFormData, launch_date: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                      인도 예정일
                    </label>
                    <input
                      type="date"
                      value={statusCreateFormData.delivery_date ?? ''}
                      onChange={(e) => setStatusCreateFormData({ ...statusCreateFormData, delivery_date: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Tank(TK1, TK2, TK3, TK4)별 공정 및 일자 설정 */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-[#243B5A] flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5" /> 2단계: Tank별 공정 상태 및 날짜 설정
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date().toISOString().split('T')[0];
                        setStatusCreateFormData(prev => {
                          const updated = { ...prev.tank_status };
                          TANK_STEPS.forEach(st => {
                            if (st.key === 'pbgt') {
                              updated[statusCreateTankTab][st.key] = { startDate: today, endDate: today, status: '완료' };
                            } else {
                              updated[statusCreateTankTab][st.key] = { date: today, status: '완료' };
                            }
                          });
                          return { ...prev, tank_status: updated };
                        });
                      }}
                      className="text-[11px] text-[#243B5A] hover:underline flex items-center gap-0.5 cursor-pointer font-semibold"
                    >
                      <CheckCheck className="h-3 w-3" />
                      현재 Tank 전 항목 오늘 완료로 설정
                    </button>
                    <span className="text-[#E2E5E9]">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        setStatusCreateFormData(prev => {
                          const updated = { ...prev.tank_status };
                          TANK_STEPS.forEach(st => {
                            updated[statusCreateTankTab][st.key] = { date: '', startDate: '', endDate: '', status: '대기', value: '', finalValue: '', text: '' };
                          });
                          return { ...prev, tank_status: updated };
                        });
                      }}
                      className="text-[11px] text-[#64748B] hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <RotateCcw className="h-3 w-3" />
                      초기화
                    </button>
                  </div>
                </div>

                {/* Tank 탭 선택 (TK1, TK2, TK3, TK4) */}
                <div className="grid grid-cols-4 gap-2">
                  {TANKS.map((tk) => {
                    const isTabActive = (statusCreateTankTab === tk);
                    const stats = calculateSingleTankStats(statusCreateFormData.tank_status[tk]);

                    return (
                      <button
                        type="button"
                        key={tk}
                        onClick={() => setStatusCreateTankTab(tk)}
                        className={`py-2 px-3 rounded-lg text-xs font-mono font-bold transition flex flex-col items-center gap-0.5 cursor-pointer ${isTabActive
                            ? 'bg-[#243B5A] text-white shadow-2xs ring-2 ring-[#243B5A]/20'
                            : 'bg-[#F5F6F8] hover:bg-slate-200 text-[#475569] border border-[#E2E5E9]'
                          }`}
                      >
                        <span>{tk}</span>
                        <span className={`text-[10px] font-sans font-semibold ${isTabActive ? 'text-white/80' : 'text-emerald-700'
                          }`}>
                          {stats.completed}/{stats.total} 완료
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* 선택된 Tank의 7개 항목 리스트 (S/T 1ST, S/T 2nd, Pre SBTT, NH3, PBGT, B/F SBTT, A/T SBTT) */}
                <div className="bg-slate-50/80 p-3 rounded-xl border border-[#E2E5E9] space-y-2">
                  <div className="flex justify-between items-center border-b border-[#E2E5E9] pb-1.5">
                    <span className="text-xs font-bold text-[#1F2937]">
                      [{statusCreateTankTab}] 7대 검사 공정 항목
                    </span>
                    <span className="text-[10px] text-[#64748B]">날짜를 선택하면 자동으로 완료 처리됩니다.</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    {TANK_STEPS.map((step) => {
                      const currentStepData = statusCreateFormData.tank_status[statusCreateTankTab]?.[step.key] || { status: '대기' };

                      return (
                        <div
                          key={step.key}
                          className="bg-white p-2.5 rounded-lg border border-[#E2E5E9] shadow-2xs space-y-2"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="w-24 shrink-0">
                              <span className="text-xs font-bold text-[#1F2937] block">
                                {step.label}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 flex-1 justify-end flex-wrap">
                              {/* 상태 선택 */}
                              <select
                                value={currentStepData.status}
                                onChange={(e) => {
                                  const newStatus = e.target.value as '대기' | '진행중' | '완료';
                                  setStatusCreateFormData(prev => ({
                                    ...prev,
                                    tank_status: {
                                      ...prev.tank_status,
                                      [statusCreateTankTab]: {
                                        ...prev.tank_status[statusCreateTankTab],
                                        [step.key]: {
                                          ...prev.tank_status[statusCreateTankTab][step.key],
                                          status: newStatus,
                                          date: (newStatus === '완료' && step.key !== 'pbgt' && !currentStepData.date)
                                            ? new Date().toISOString().split('T')[0]
                                            : currentStepData.date
                                        }
                                      }
                                    }
                                  }));
                                }}
                                className={`px-2 py-1 border rounded text-[11px] font-semibold focus:outline-hidden shrink-0 ${currentStepData.status === '완료'
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

                              {/* 일반 공정: 단일 날짜 선택 */}
                              {step.key !== 'pbgt' && (
                                <input
                                  type="date"
                                  value={currentStepData.date || ''}
                                  onChange={(e) => {
                                    const newDate = e.target.value;
                                    setStatusCreateFormData(prev => ({
                                      ...prev,
                                      tank_status: {
                                        ...prev.tank_status,
                                        [statusCreateTankTab]: {
                                          ...prev.tank_status[statusCreateTankTab],
                                          [step.key]: {
                                            ...prev.tank_status[statusCreateTankTab][step.key],
                                            date: newDate,
                                            status: (newDate && currentStepData.status === '대기') ? '완료' : currentStepData.status
                                          }
                                        }
                                      }
                                    }));
                                  }}
                                  className="px-2 py-1 bg-white border border-[#E2E5E9] rounded text-[11px] text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden font-mono shrink-0"
                                />
                              )}

                              {/* PBGT 전용: 시작일/종료일 선택 */}
                              {step.key === 'pbgt' && (
                                <div className="flex items-center space-x-1 shrink-0">
                                  <input
                                    type="date"
                                    title="시작일"
                                    value={currentStepData.startDate || ''}
                                    onChange={(e) => {
                                      const sDate = e.target.value;
                                      setStatusCreateFormData(prev => ({
                                        ...prev,
                                        tank_status: {
                                          ...prev.tank_status,
                                          [statusCreateTankTab]: {
                                            ...prev.tank_status[statusCreateTankTab],
                                            pbgt: {
                                              ...prev.tank_status[statusCreateTankTab].pbgt,
                                              startDate: sDate,
                                            }
                                          }
                                        }
                                      }));
                                    }}
                                    className="px-1.5 py-1 bg-white border border-[#E2E5E9] rounded text-[10px] text-[#1F2937] font-mono"
                                  />
                                  <span className="text-[10px] text-slate-400">~</span>
                                  <input
                                    type="date"
                                    title="종료일"
                                    value={currentStepData.endDate || ''}
                                    onChange={(e) => {
                                      const eDate = e.target.value;
                                      setStatusCreateFormData(prev => ({
                                        ...prev,
                                        tank_status: {
                                          ...prev.tank_status,
                                          [statusCreateTankTab]: {
                                            ...prev.tank_status[statusCreateTankTab],
                                            pbgt: {
                                              ...prev.tank_status[statusCreateTankTab].pbgt,
                                              endDate: eDate,
                                            }
                                          }
                                        }
                                      }));
                                    }}
                                    className="px-1.5 py-1 bg-white border border-[#E2E5E9] rounded text-[10px] text-[#1F2937] font-mono"
                                  />
                                </div>
                              )}

                              {/* 값(측정값/검사값 또는 Ref 값) 입력 */}
                              <input
                                type="text"
                                placeholder={step.key === 'pbgt' ? "Ref. 값 입력" : "값 (예: 250 mbar)"}
                                value={currentStepData.value || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setStatusCreateFormData(prev => ({
                                    ...prev,
                                    tank_status: {
                                      ...prev.tank_status,
                                      [statusCreateTankTab]: {
                                        ...prev.tank_status[statusCreateTankTab],
                                        [step.key]: {
                                          ...prev.tank_status[statusCreateTankTab][step.key],
                                          value: val,
                                        }
                                      }
                                    }
                                  }));
                                }}
                                className="w-24 sm:w-28 px-2 py-1 bg-white border border-[#E2E5E9] rounded text-[11px] text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden font-mono"
                              />

                              {/* PBGT 전용: Final 값 입력 */}
                              {step.key === 'pbgt' && (
                                <input
                                  type="text"
                                  placeholder="Final 값 입력"
                                  value={currentStepData.finalValue || ''}
                                  onChange={(e) => {
                                    const fVal = e.target.value;
                                    setStatusCreateFormData(prev => ({
                                      ...prev,
                                      tank_status: {
                                        ...prev.tank_status,
                                        [statusCreateTankTab]: {
                                          ...prev.tank_status[statusCreateTankTab],
                                          pbgt: {
                                            ...prev.tank_status[statusCreateTankTab].pbgt,
                                            finalValue: fVal,
                                          }
                                        }
                                      }
                                    }));
                                  }}
                                  className="w-24 sm:w-28 px-2 py-1 bg-white border border-[#E2E5E9] rounded text-[11px] text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden font-mono"
                                />
                              )}
                            </div>
                          </div>

                          {/* NH3 전용 텍스트 입력창 */}
                          {step.key === 'nh3' && (
                            <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                              <span className="text-[11px] font-bold text-amber-800 shrink-0">
                                📝 NH3 텍스트:
                              </span>
                              <input
                                type="text"
                                placeholder="NH3 검사 내용 / 특이사항 텍스트 입력"
                                value={currentStepData.text || ''}
                                onChange={(e) => {
                                  const newText = e.target.value;
                                  setStatusCreateFormData(prev => ({
                                    ...prev,
                                    tank_status: {
                                      ...prev.tank_status,
                                      [statusCreateTankTab]: {
                                        ...prev.tank_status[statusCreateTankTab],
                                        nh3: {
                                          ...prev.tank_status[statusCreateTankTab].nh3,
                                          text: newText,
                                        }
                                      }
                                    }
                                  }));
                                }}
                                className="flex-1 px-2.5 py-1 bg-amber-50/60 border border-amber-200 rounded text-xs text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-[#E2E5E9]">
                <button
                  type="button"
                  onClick={() => setIsStatusCreateModalOpen(false)}
                  className="px-3 py-1.5 bg-white border border-[#E2E5E9] text-[#1F2937] rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white rounded-lg text-xs font-semibold shadow-2xs cursor-pointer"
                >
                  등록 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 6. Status 탭 전용 [수정]: 기존 호선 정보 & TK1~4 공정 수정 모달 */}
      {/* ============================================================== */}
      {isStatusEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-[99999]">
          <div className="bg-white border border-[#E2E5E9] rounded-xl p-5 max-w-2xl w-full shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-[#E2E5E9] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#1F2937] flex items-center gap-1.5">
                  <Edit3 className="h-4 w-4 text-[#243B5A]" />
                  Ship Status 정보 수정 (Ship #{statusEditFormData.ship_no})
                </h3>
                <p className="text-[11px] text-[#64748B]">선종, DWT 등 기본 제원과 TK1~TK4 탱크별 공정을 수정합니다.</p>
              </div>
              <div className="flex items-center gap-1 mr-2">
                {(() => {
                  const currentIndex = ships.findIndex((ship) => ship.id === statusEditFormData.id);
                  return (
                    <>
                      <button
                        type="button"
                        disabled={currentIndex <= 0}
                        onClick={() => handleMoveShipFromEditModal('left')}
                        className="px-2 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#243B5A] hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold cursor-pointer"
                        title="왼쪽 호선으로 위치 이동"
                      >
                        ◀
                      </button>
                      <button
                        type="button"
                        disabled={currentIndex < 0 || currentIndex >= ships.length - 1}
                        onClick={() => handleMoveShipFromEditModal('right')}
                        className="px-2 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#243B5A] hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold cursor-pointer"
                        title="오른쪽 호선으로 위치 이동"
                      >
                        ▶
                      </button>
                    </>
                  );
                })()}
              </div>
              <button
                onClick={() => setIsStatusEditModalOpen(false)}
                className="p-1 text-[#64748B] hover:text-[#1F2937] rounded-lg hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStatusEditModal} className="space-y-4">
              {/* 호선 기본 정보 수정 */}
              <div className="bg-[#F5F6F8] p-3.5 rounded-xl border border-[#E2E5E9] space-y-3">
                <span className="text-xs font-bold text-[#243B5A] flex items-center gap-1">
                  <Ship className="h-3.5 w-3.5" /> 1단계: 호선 기본 제원 수정
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                      Ship No. (변경 불가)
                    </label>
                    <input
                      type="text"
                      disabled
                      value={statusEditFormData.ship_no}
                      className="w-full px-2.5 py-1.5 bg-slate-200/60 border border-[#E2E5E9] rounded-lg text-xs font-mono font-bold text-[#1F2937]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                      호선명 / 프로젝트명
                    </label>
                    <input
                      type="text"
                      required
                      value={statusEditFormData.ship_name}
                      onChange={(e) => setStatusEditFormData({ ...statusEditFormData, ship_name: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                      선주사
                    </label>
                    <input
                      type="text"
                      value={statusEditFormData.shipowner || ''}
                      onChange={(e) => setStatusEditFormData({ ...statusEditFormData, shipowner: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                      도크 위치
                    </label>
                    <input
                      type="text"
                      value={statusEditFormData.dock}
                      onChange={(e) => setStatusEditFormData({ ...statusEditFormData, dock: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                      DWT 
                    </label>
                    <input
                      type="date"
                      value={statusEditFormData.dwt || ''}
                      onChange={(e) => setStatusEditFormData({ ...statusEditFormData, dwt: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                      진수일
                    </label>
                    <input
                      type="date"
                      value={statusEditFormData.launch_date || ''}
                      onChange={(e) => setStatusEditFormData({ ...statusEditFormData, launch_date: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                      인도 예정일
                    </label>
                    <input
                      type="date"
                      value={statusEditFormData.delivery_date ?? ''}
                      onChange={(e) => setStatusEditFormData({ ...statusEditFormData, delivery_date: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Tank별 공정 수정 */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-[#243B5A] flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5" /> 2단계: Tank별 공정 현황 수정
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {TANKS.map((tk) => {
                    const isTabActive = (statusModalTankTab === tk);
                    const stats = calculateSingleTankStats(statusEditFormData.tank_status[tk]);

                    return (
                      <button
                        type="button"
                        key={tk}
                        onClick={() => setStatusModalTankTab(tk)}
                        className={`py-2 px-3 rounded-lg text-xs font-mono font-bold transition flex flex-col items-center gap-0.5 cursor-pointer ${isTabActive
                            ? 'bg-[#243B5A] text-white shadow-2xs ring-2 ring-[#243B5A]/20'
                            : 'bg-[#F5F6F8] hover:bg-slate-200 text-[#475569] border border-[#E2E5E9]'
                          }`}
                      >
                        <span>{tk}</span>
                        <span className={`text-[10px] font-sans font-semibold ${isTabActive ? 'text-white/80' : 'text-emerald-700'
                          }`}>
                          {stats.completed}/{stats.total} 완료
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="bg-slate-50/80 p-3 rounded-xl border border-[#E2E5E9] space-y-2">
                  <div className="flex justify-between items-center border-b border-[#E2E5E9] pb-1.5">
                    <span className="text-xs font-bold text-[#1F2937]">
                      [{statusModalTankTab}] 검사 공정 항목
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    {TANK_STEPS.map((step) => {
                      const currentStepData = statusEditFormData.tank_status[statusModalTankTab]?.[step.key] || { status: '대기' };

                      return (
                        <div
                          key={step.key}
                          className="bg-white p-2.5 rounded-lg border border-[#E2E5E9] shadow-2xs space-y-2"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="w-24 shrink-0">
                              <span className="text-xs font-bold text-[#1F2937] block">
                                {step.label}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 flex-1 justify-end flex-wrap">
                              <select
                                value={currentStepData.status}
                                onChange={(e) => {
                                  const newStatus = e.target.value as '대기' | '진행중' | '완료';
                                  setStatusEditFormData(prev => ({
                                    ...prev,
                                    tank_status: {
                                      ...prev.tank_status,
                                      [statusModalTankTab]: {
                                        ...prev.tank_status[statusModalTankTab],
                                        [step.key]: {
                                          ...prev.tank_status[statusModalTankTab][step.key],
                                          status: newStatus,
                                          date: (newStatus === '완료' && step.key !== 'pbgt' && !currentStepData.date)
                                            ? new Date().toISOString().split('T')[0]
                                            : currentStepData.date
                                        }
                                      }
                                    }
                                  }));
                                }}
                                className={`px-2 py-1 border rounded text-[11px] font-semibold focus:outline-hidden shrink-0 ${currentStepData.status === '완료'
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

                              {/* 일반 공정 단일 날짜 */}
                              {step.key !== 'pbgt' && (
                                <input
                                  type="date"
                                  value={currentStepData.date || ''}
                                  onChange={(e) => {
                                    const newDate = e.target.value;
                                    setStatusEditFormData(prev => ({
                                      ...prev,
                                      tank_status: {
                                        ...prev.tank_status,
                                        [statusModalTankTab]: {
                                          ...prev.tank_status[statusModalTankTab],
                                          [step.key]: {
                                            ...prev.tank_status[statusModalTankTab][step.key],
                                            date: newDate,
                                            status: (newDate && currentStepData.status === '대기') ? '완료' : currentStepData.status
                                          }
                                        }
                                      }
                                    }));
                                  }}
                                  className="px-2 py-1 bg-white border border-[#E2E5E9] rounded text-[11px] text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden font-mono shrink-0"
                                />
                              )}

                              {/* PBGT 공정 전용 시작일/종료일 */}
                              {step.key === 'pbgt' && (
                                <div className="flex items-center space-x-1 shrink-0">
                                  <input
                                    type="date"
                                    title="시작일"
                                    value={currentStepData.startDate || ''}
                                    onChange={(e) => {
                                      const sDate = e.target.value;
                                      setStatusEditFormData(prev => ({
                                        ...prev,
                                        tank_status: {
                                          ...prev.tank_status,
                                          [statusModalTankTab]: {
                                            ...prev.tank_status[statusModalTankTab],
                                            pbgt: {
                                              ...prev.tank_status[statusModalTankTab].pbgt,
                                              startDate: sDate,
                                            }
                                          }
                                        }
                                      }));
                                    }}
                                    className="px-1.5 py-1 bg-white border border-[#E2E5E9] rounded text-[10px] text-[#1F2937] font-mono"
                                  />
                                  <span className="text-[10px] text-slate-400">~</span>
                                  <input
                                    type="date"
                                    title="종료일"
                                    value={currentStepData.endDate || ''}
                                    onChange={(e) => {
                                      const eDate = e.target.value;
                                      setStatusEditFormData(prev => ({
                                        ...prev,
                                        tank_status: {
                                          ...prev.tank_status,
                                          [statusModalTankTab]: {
                                            ...prev.tank_status[statusModalTankTab],
                                            pbgt: {
                                              ...prev.tank_status[statusModalTankTab].pbgt,
                                              endDate: eDate,
                                            }
                                          }
                                        }
                                      }));
                                    }}
                                    className="px-1.5 py-1 bg-white border border-[#E2E5E9] rounded text-[10px] text-[#1F2937] font-mono"
                                  />
                                </div>
                              )}

                              {/* 값/Ref. 값 입력 */}
                              <input
                                type="text"
                                placeholder={step.key === 'pbgt' ? "Ref. 값" : "값"}
                                value={currentStepData.value || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setStatusEditFormData(prev => ({
                                    ...prev,
                                    tank_status: {
                                      ...prev.tank_status,
                                      [statusModalTankTab]: {
                                        ...prev.tank_status[statusModalTankTab],
                                        [step.key]: {
                                          ...prev.tank_status[statusModalTankTab][step.key],
                                          value: val,
                                        }
                                      }
                                    }
                                  }));
                                }}
                                className="w-24 sm:w-28 px-2 py-1 bg-white border border-[#E2E5E9] rounded text-[11px] text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden font-mono"
                              />

                              {/* PBGT Final 값 입력 */}
                              {step.key === 'pbgt' && (
                                <input
                                  type="text"
                                  placeholder="Final 값"
                                  value={currentStepData.finalValue || ''}
                                  onChange={(e) => {
                                    const fVal = e.target.value;
                                    setStatusEditFormData(prev => ({
                                      ...prev,
                                      tank_status: {
                                        ...prev.tank_status,
                                        [statusModalTankTab]: {
                                          ...prev.tank_status[statusModalTankTab],
                                          pbgt: {
                                            ...prev.tank_status[statusModalTankTab].pbgt,
                                            finalValue: fVal,
                                          }
                                        }
                                      }
                                    }));
                                  }}
                                  className="w-24 sm:w-28 px-2 py-1 bg-white border border-[#E2E5E9] rounded text-[11px] text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden font-mono"
                                />
                              )}
                            </div>
                          </div>

                          {/* NH3 텍스트 */}
                          {step.key === 'nh3' && (
                            <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                              <span className="text-[11px] font-bold text-amber-800 shrink-0">
                                📝 NH3 텍스트:
                              </span>
                              <input
                                type="text"
                                placeholder="NH3 Leak 위치 입력"
                                value={currentStepData.text || ''}
                                onChange={(e) => {
                                  const newText = e.target.value;
                                  setStatusEditFormData(prev => ({
                                    ...prev,
                                    tank_status: {
                                      ...prev.tank_status,
                                      [statusModalTankTab]: {
                                        ...prev.tank_status[statusModalTankTab],
                                        nh3: {
                                          ...prev.tank_status[statusModalTankTab].nh3,
                                          text: newText,
                                        }
                                      }
                                    }
                                  }));
                                }}
                                className="flex-1 px-2.5 py-1 bg-amber-50/60 border border-amber-200 rounded text-xs text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-[#E2E5E9]">
                <button
                  type="button"
                  onClick={() => setIsStatusEditModalOpen(false)}
                  className="px-3 py-1.5 bg-white border border-[#E2E5E9] text-[#1F2937] rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white rounded-lg text-xs font-semibold shadow-2xs cursor-pointer"
                >
                  수정 저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 7. Status 호선/선주사 목록 선택 모달 */}
      {/* ============================================================== */}
      {isShipSelectionModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-[999999]">
          <div className="bg-white border border-[#E2E5E9] rounded-xl p-5 max-w-2xl w-full shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#E2E5E9] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#1F2937] flex items-center gap-1.5">
                  {statusSelectorTab === 'OWNER' ? <Building2 className="h-4 w-4 text-[#243B5A]" /> : <Ship className="h-4 w-4 text-[#243B5A]" />}
                  {statusSelectorTab === 'OWNER' ? '선주사별 호선 선택' : '호선 목록 선택'}
                </h3>
                <p className="text-[11px] text-[#64748B] mt-1">
                  {statusSelectorTab === 'OWNER'
                    ? '선주사를 선택하면 해당 선주사의 호선만 표시됩니다.'
                    : '목록에서 입력할 호선을 선택하세요.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsShipSelectionModalOpen(false)}
                className="p-1 text-[#64748B] hover:text-[#1F2937] rounded-lg hover:bg-slate-100 cursor-pointer"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {statusSelectorTab === 'OWNER' ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {shipOwners.length > 0 ? shipOwners.map((owner) => (
                    <button
                      key={owner}
                      type="button"
                      onClick={() => setSelectedOwnerFilter(owner)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        selectedOwnerFilter === owner
                          ? 'bg-[#243B5A] text-white border-[#243B5A]'
                          : 'bg-white text-[#475569] border-[#CBD5E1] hover:bg-slate-50'
                      }`}
                    >
                      {owner}
                      <span className={`ml-1.5 text-[10px] ${selectedOwnerFilter === owner ? 'text-white/80' : 'text-[#94A3B8]'}`}>
                        {ships.filter(ship => (ship.shipowner || '').trim() === owner).length}
                      </span>
                    </button>
                  )) : (
                    <div className="w-full text-xs text-[#64748B] text-center py-5 border border-dashed border-[#CBD5E1] rounded-lg">
                      등록된 선주사가 없습니다.
                    </div>
                  )}
                </div>

                {selectedOwnerFilter && (
                  <div className="border-t border-[#E2E5E9] pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-bold text-[#1F2937]">
                        {selectedOwnerFilter} <span className="text-[#64748B] font-normal">호선 목록</span>
                      </div>
                      <span className="text-[10px] text-[#64748B]">{ownerFilteredShips.length}척</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {ownerFilteredShips.map((ship) => {
                        const stats = calculateTankStats(ship.tank_status);
                        const isSelected = currentStatusShip?.id === ship.id;
                        return (
                          <button
                            key={ship.id}
                            type="button"
                            onClick={() => handleSelectStatusShip(ship)}
                            className={`text-left p-3 rounded-lg border transition cursor-pointer ${
                              isSelected
                                ? 'bg-[#243B5A]/5 border-[#243B5A]/50 ring-1 ring-[#243B5A]/20'
                                : 'bg-white border-[#E2E5E9] hover:bg-slate-50 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-bold text-[#243B5A]">Ship {ship.ship_no}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                                {stats.completed}/{stats.total}
                              </span>
                            </div>
                            <div className="text-[10px] text-[#64748B] truncate mt-1">{ship.ship_name || '호선명 미입력'}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ships.map((ship) => {
                  const stats = calculateTankStats(ship.tank_status);
                  const isSelected = currentStatusShip?.id === ship.id;
                  return (
                    <button
                      key={ship.id}
                      type="button"
                      onClick={() => handleSelectStatusShip(ship)}
                      className={`text-left p-3 rounded-lg border transition cursor-pointer ${
                        isSelected
                          ? 'bg-[#243B5A]/5 border-[#243B5A]/50 ring-1 ring-[#243B5A]/20'
                          : 'bg-white border-[#E2E5E9] hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-[#243B5A]">Ship {ship.ship_no}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                          {stats.completed}/{stats.total}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#64748B] truncate mt-1">
                        {ship.ship_name || '호선명 미입력'}
                        {ship.shipowner && <span className="ml-1.5 text-[#94A3B8]">· {ship.shipowner}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-[#E2E5E9]">
              <button
                type="button"
                onClick={() => setIsShipSelectionModalOpen(false)}
                className="px-4 py-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white rounded-lg text-xs font-semibold shadow-2xs cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 7. Ship No. TITLE 수정 모달 */}
      {/* ============================================================== */}
      {isShipNoTitleEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-[999999]">
          <form
            onSubmit={handleSaveShipNoTitleEdit}
            className="bg-white border border-[#E2E5E9] rounded-xl p-5 max-w-sm w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#1F2937]">Ship No. TITLE 수정</h3>
                <p className="text-[11px] text-[#64748B] mt-1">
                  서브탭에 표시되는 Ship No.만 수정합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsShipNoTitleEditModalOpen(false)}
                className="p-1 rounded-lg text-[#64748B] hover:bg-slate-100 cursor-pointer"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#475569]">
                Ship No.
              </label>
              <input
                type="text"
                value={shipNoTitleEditValue}
                onChange={(e) => setShipNoTitleEditValue(e.target.value)}
                autoFocus
                className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden"
                placeholder="Ship No. 입력"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E5E9]">
              <button
                type="button"
                onClick={() => setIsShipNoTitleEditModalOpen(false)}
                className="px-3 py-1.5 bg-white border border-[#E2E5E9] text-[#1F2937] rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white rounded-lg text-xs font-semibold shadow-2xs cursor-pointer"
              >
                수정 저장
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ============================================================== */}
      {/* 8. 삭제 확인 모달 */}
      {/* ============================================================== */}
      {isDeleteModalOpen && targetDeleteShip && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-[999999]">
          <div className="bg-white border border-[#E2E5E9] rounded-xl p-5 max-w-sm w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-2 text-red-600">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <h3 className="text-sm font-bold text-[#1F2937]">Ship 삭제 확인</h3>
            </div>
            <p className="text-xs text-[#64748B] leading-relaxed">
              정말로 <strong className="text-[#1F2937]">[Ship #{targetDeleteShip.ship_no}]</strong> 호선 및 관련 Status 공정 데이터를 삭제하시겠습니까? 삭제된 정보는 복구할 수 없습니다.
            </p>
            <div className="flex justify-end space-x-2 pt-2 border-t border-[#E2E5E9]">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-3 py-1.5 bg-white border border-[#E2E5E9] text-[#1F2937] rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-2xs cursor-pointer"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
