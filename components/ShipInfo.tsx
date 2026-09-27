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
  AlertCircle
} from 'lucide-react';

// Supabase 클라이언트 설정 (환경변수 사용)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 진행 상태 타입 정의 (7개 단계)
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

export interface ShipItem {
  id: string;
  ship_no: string;
  ship_name: string;
  dock: string;
  status: ShipStatus;
  progress: number | null;
  delivery_date: string;
  day_shift: string;           
  day_shift_user_ids?: string[];
  night_shift: string;         
  night_shift_user_ids?: string[];
}

interface ShipInfoProps {
  isAdmin: boolean;
  currentUser: { name: string };
}

export default function ShipInfo({ isAdmin }: ShipInfoProps) {
  const [ships, setShips] = useState<ShipItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedShip, setSelectedShip] = useState<ShipItem | null>(null);
  const [editingShip, setEditingShip] = useState<ShipItem | null>(null);
  const [targetDeleteId, setTargetDeleteId] = useState<string | null>(null);

  // Form Field States
  const [formData, setFormData] = useState<Omit<ShipItem, 'id'>>({
    ship_no: '',
    ship_name: '',
    dock: '제1도크',
    status: 'Sound Test 1St',
    progress: 17,
    delivery_date: '',
    day_shift: '',
    day_shift_user_ids: [],
    night_shift: '',
    night_shift_user_ids: [],
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

  const fetchShips = async () => {
    try {
      const { data, error } = await supabase
        .from('ships')
        .select('*')
        .order('ship_no', { ascending: true });

      if (error) {
        console.error('호선 데이터 조회 오류:', error);
      } else if (data) {
        setShips(data);
      }
    } catch (e) {
      console.error('호선 데이터 로딩 실패:', e);
    }
  };

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
        alert('단계 변경 중 오류가 발생했습니다: ' + error.message);
        return;
      }

      const updated = { ...selectedShip, status: targetStatus, progress: calculatedProgress };
      setShips(prev => prev.map(s => s.id === selectedShip.id ? updated : s));
      setSelectedShip(updated);
    } catch (e) {
      console.error('단계 변경 실패:', e);
    }
  };

  const filteredShips = ships.filter(s =>
    s.ship_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.ship_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.dock.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.day_shift.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.night_shift.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenAddModal = () => {
    setEditingShip(null);
    const initialStatus: ShipStatus = 'Sound Test 1St';
    setFormData({
      ship_no: '',
      ship_name: '',
      dock: '제1도크',
      status: initialStatus,
      progress: STATUS_PROGRESS_MAP[initialStatus],
      delivery_date: new Date().toISOString().split('T')[0],
      day_shift: '',
      day_shift_user_ids: [],
      night_shift: '',
      night_shift_user_ids: [],
    });
    setDayCheckStatus({ status: 'idle', invalidNames: [] });
    setNightCheckStatus({ status: 'idle', invalidNames: [] });
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (ship: ShipItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingShip(ship);
    setFormData({
      ship_no: ship.ship_no,
      ship_name: ship.ship_name,
      dock: ship.dock,
      status: ship.status,
      progress: ship.progress,
      delivery_date: ship.delivery_date,
      day_shift: ship.day_shift,
      day_shift_user_ids: ship.day_shift_user_ids || [],
      night_shift: ship.night_shift,
      night_shift_user_ids: ship.night_shift_user_ids || [],
    });
    setDayCheckStatus({ status: ship.day_shift ? 'valid' : 'idle', invalidNames: [] });
    setNightCheckStatus({ status: ship.night_shift ? 'valid' : 'idle', invalidNames: [] });
    setIsFormModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.ship_no.trim() || !formData.ship_name.trim()) {
      alert('호선 번호와 선종명을 입력해주세요.');
      return;
    }

    if (formData.day_shift && dayCheckStatus.status === 'invalid') {
      alert(`주간 근무자 중 미등록 인원이 있습니다: [${dayCheckStatus.invalidNames.join(', ')}]\nSupabase에 등록된 사용자만 입력 가능합니다.`);
      return;
    }
    if (formData.night_shift && nightCheckStatus.status === 'invalid') {
      alert(`야간 근무자 중 미등록 인원이 있습니다: [${nightCheckStatus.invalidNames.join(', ')}]\nSupabase에 등록된 사용자만 입력 가능합니다.`);
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
          alert('수정 중 오류가 발생했습니다: ' + error.message);
          return;
        }

        setShips(prev => prev.map(s => s.id === editingShip.id ? { ...s, ...formData } : s));
        if (selectedShip?.id === editingShip.id) {
          setSelectedShip({ id: editingShip.id, ...formData });
        }
      } else {
        // 신규 등록 (Insert)
        const { data, error } = await supabase
          .from('ships')
          .insert([formData])
          .select();

        if (error) {
          alert('등록 중 오류가 발생했습니다: ' + error.message);
          return;
        }

        if (data && data.length > 0) {
          setShips(prev => [data[0], ...prev]);
        }
      }

      setIsFormModalOpen(false);
    } catch (e) {
      console.error('저장 중 예외 발생:', e);
    }
  };

  // 🔥 Supabase 데이터베이스와 연동하여 삭제 처리하도록 수정
  const handleConfirmDelete = async () => {
    if (!targetDeleteId) return;

    try {
      const { error } = await supabase
        .from('ships')
        .delete()
        .eq('id', targetDeleteId);

      if (error) {
        alert('삭제 중 오류가 발생했습니다: ' + error.message);
        return;
      }

      // 로컬 상태에서도 제거
      setShips(prev => prev.filter(s => s.id !== targetDeleteId));
      if (selectedShip?.id === targetDeleteId) {
        setSelectedShip(null);
      }
      setTargetDeleteId(null);
      setIsDeleteModalOpen(false);
    } catch (e) {
      console.error('삭제 처리 실패:', e);
    }
  };

  return (
    <div className="space-y-4 font-sans text-[#1F2937]">
      {/* 1. 상단 컨트롤 바 */}
      <div className="bg-white p-4 rounded-xl border border-[#E2E5E9] shadow-2xs flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="flex items-center space-x-2">
          <div className="bg-[#243B5A]/10 p-2 rounded-lg text-[#243B5A]">
            <Anchor className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#1F2937]">호선 현황</h2>
          </div>
          <span className="text-xs bg-[#F5F6F8] text-[#64748B] px-2.5 py-0.5 rounded-full border border-[#E2E5E9] font-mono font-semibold ml-2">
            총 {filteredShips.length}건
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#64748B]" />
            <input
              type="text"
              placeholder="호선, 선종, 근무자 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] placeholder-[#64748B]/70 focus:bg-white focus:border-[#243B5A] focus:outline-hidden transition font-medium"
            />
          </div>

          {isAdmin && (
            <button
              onClick={handleOpenAddModal}
              className="flex items-center space-x-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>신규 호선 등록</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Desktop Table */}
      <div className="hidden sm:block bg-white border border-[#E2E5E9] rounded-xl shadow-2xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#F5F6F8] border-b border-[#E2E5E9] text-[#64748B] font-semibold">
              <th className="py-3 px-4">호선 번호</th>
              <th className="py-3 px-4">선종 및 프로젝트명</th>
              <th className="py-3 px-4">건조 위치</th>
              <th className="py-3 px-4">시운전 진행 단계 현황</th>
              <th className="py-3 px-4">인도 예정일</th>
              <th className="py-3 px-4">근무자 (주간 / 야간)</th>
              {isAdmin && <th className="py-3 px-4 text-right">관리</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E5E9] text-[#1F2937]">
            {filteredShips.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-[#64748B]">
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
                    <td className="py-3 px-4 font-mono font-bold text-[#243B5A]">
                      {ship.ship_no}
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#1F2937]">
                      {ship.ship_name}
                    </td>
                    <td className="py-3 px-4 text-[#64748B]">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-[#243B5A]" />
                        {ship.dock}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[280px]">
                        {STATUS_LIST.map((step, idx) => {
                          const isCompleted = idx < currentIdx;
                          const isCurrent = idx === currentIdx;

                          return (
                            <span
                              key={step}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition ${
                                isCurrent
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                  : isCompleted
                                  ? 'bg-slate-100 text-slate-500 border-slate-200'
                                  : 'bg-white text-slate-300 border-slate-100'
                              }`}
                              title={`${step} (${isCurrent ? '진행중' : isCompleted ? '완료' : '대기'})`}
                            >
                              {step}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[#64748B] font-mono font-medium">
                      {ship.delivery_date}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#1F2937]">
                      <div className="flex flex-col gap-1 text-[11px]">
                        <span className="inline-flex items-center text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded font-semibold w-fit">
                          <Sun className="h-3 w-3 mr-1 shrink-0" /> 주간: {ship.day_shift || '-'}
                        </span>
                        <span className="inline-flex items-center text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-1.5 py-0.5 rounded font-semibold w-fit">
                          <Moon className="h-3 w-3 mr-1 shrink-0" /> 야간: {ship.night_shift || '-'}
                        </span>
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-4 text-right space-x-1" onClick={(e) => e.stopPropagation()}>
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

      {/* 3. Mobile Card View */}
      <div className="block sm:hidden space-y-2.5">
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
                  <span className="bg-[#243B5A] text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded">
                    {ship.ship_no}
                  </span>
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

              <div className="grid grid-cols-2 gap-2 text-[11px] text-[#64748B] pt-1.5 border-t border-[#E2E5E9]">
                <div>위치: <strong className="text-[#1F2937] font-semibold">{ship.dock}</strong></div>
                <div>인도일: <strong className="text-[#1F2937] font-semibold">{ship.delivery_date}</strong></div>
                <div className="col-span-2 flex flex-col gap-1">
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

      {/* 4. 바텀시트 모달 */}
      {selectedShip && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center z-[99999] transition-all">
          <div 
            className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl p-5 shadow-2xl border border-[#E2E5E9] space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
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
                    <p className="text-[11px] text-[#64748B] flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3 text-[#243B5A]" /> {selectedShip.dock}
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

            <div className="bg-[#F5F6F8] p-3 rounded-lg border border-[#E2E5E9] text-xs space-y-2">
              <div className="flex items-center space-x-1.5 border-b border-[#E2E5E9] pb-1.5">
                <User className="h-4 w-4 text-[#243B5A]" />
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
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition ${
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

                        <span className="font-mono text-[10px] text-slate-500">
                          {STATUS_PROGRESS_MAP[step] !== null ? `${STATUS_PROGRESS_MAP[step]}%` : ''}
                        </span>
                        
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

      {/* 5. 등록 / 수정 모달 */}
      {isFormModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-[99999]">
          <div className="bg-white border border-[#E2E5E9] rounded-xl p-5 max-w-md w-full shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
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
                    호선 번호 *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="예: S1099"
                    value={formData.ship_no}
                    onChange={(e) => setFormData({ ...formData, ship_no: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                    건조 위치/도크
                  </label>
                  <input
                    type="text"
                    placeholder="예: 제1도크"
                    value={formData.dock}
                    onChange={(e) => setFormData({ ...formData, dock: e.target.value })}
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
                    진행 단계
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
                  placeholder="예: 김철수, 박영희, 이영희"
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
                  placeholder="예: 이영희, 김민수"
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

              <div className="flex justify-end space-x-2 pt-3 border-t border-[#E2E5E9]">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-3 py-1.5 bg-white border border-[#E2E5E9] text-[#1F2937] rounded-lg text-xs font-semibold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white rounded-lg text-xs font-semibold shadow-2xs"
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. 삭제 확인 모달 */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-[99999]">
          <div className="bg-white border border-[#E2E5E9] rounded-xl p-5 max-w-sm w-full text-center shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="mx-auto h-10 w-10 bg-red-100 text-[#DC2626] rounded-full flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#1F2937]">호선 정보 삭제</h3>
              <p className="text-xs text-[#64748B]">선택한 호선 정보를 삭제하시겠습니까?</p>
            </div>
            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 py-1.5 bg-white border border-[#E2E5E9] text-[#1F2937] rounded-lg text-xs font-semibold"
              >
                취소
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-1.5 bg-[#DC2626] hover:bg-red-700 text-white rounded-lg text-xs font-semibold"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}