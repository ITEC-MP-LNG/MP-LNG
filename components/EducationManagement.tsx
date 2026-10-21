'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  X, 
  GraduationCap, 
  Calendar as CalendarIcon,
  ChevronLeft, 
  ChevronRight, 
  MapPin, 
  Users,
  Clock,
  Bell,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Education, EducationRecord } from '@/lib/types';

// 신규 EVENT 타입 정의
interface EventItem {
  id: number;
  title: string;
  event_date: string;
  time_slot: string;
  location: string;
  description: string;
  created_at: string;
  updated_at: string;
}

interface EducationManagementProps {
  isAdmin: boolean;
  educations: Education[];
  eduRecords: EducationRecord[];
  loadingEdu: boolean;
  fetchEducations: () => Promise<void>;
  fetchEducationRecords: () => Promise<void>;
  currentUser?: { name: string };
}

const getLocalDateString = (d: Date = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const inputClass = 'w-full rounded-lg border border-[#E2E5E9] bg-[#F5F6F8] px-3 py-2 text-xs text-[#1F2937] outline-none focus:border-[#243B5A] focus:bg-white transition-colors';

/** cert.tsx 및 WorkManagement.tsx 스타일을 참조한 앱 공통 달력 날짜 선택 컴포넌트 */
function CalendarDatePicker({
  value,
  onChange,
  className = inputClass,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  label?: string;
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
  const today = getLocalDateString(new Date());

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
    <div ref={rootRef} className="relative w-full min-w-0 space-y-1">
      {label && <label className="block text-[11px] font-semibold text-[#1F2937]">{label}</label>}
      <div className="flex min-w-0 items-center gap-1">
        <input
          type="text"
          inputMode="numeric"
          value={inputText}
          onChange={(event) => setInputText(event.target.value)}
          onBlur={commitTypedDate}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commitTypedDate(); } }}
          placeholder="YYYY-MM-DD 직접 입력"
          aria-label={label ? `${label} 날짜 직접 입력 (YYYY-MM-DD)` : "날짜 직접 입력 (YYYY-MM-DD)"}
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
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E2E5E9] bg-white text-[#243B5A] hover:bg-[#F5F6F8] transition-colors"
          aria-label="달력 열기"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
        >
          <CalendarIcon className="h-4 w-4" />
        </button>
      </div>
      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/25 p-4"
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
              <button type="button" onClick={() => moveMonth(-1)} aria-label="이전 달" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E5E9] bg-[#F8FAFC] text-[#243B5A] hover:bg-[#EEF2F7]"><ChevronLeft className="h-4 w-4" /></button>
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
              <button type="button" onClick={() => moveMonth(1)} aria-label="다음 달" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E5E9] bg-[#F8FAFC] text-[#243B5A] hover:bg-[#EEF2F7]"><ChevronRight className="h-4 w-4" /></button>
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
              <button type="button" onClick={() => { const now = new Date(); const date = getLocalDateString(now); setViewYear(now.getFullYear()); setViewMonth(now.getMonth()); onChange(date); setInputText(date); setIsOpen(false); }} className="rounded-lg px-3 py-2 text-xs font-semibold text-[#243B5A] hover:bg-[#F5F6F8]">오늘</button>
              <div className="flex items-center gap-1">
                {selected && <button type="button" onClick={() => { onChange(''); setInputText(''); setIsOpen(false); }} className="rounded-lg px-3 py-2 text-xs font-semibold text-[#64748B] hover:bg-[#F5F6F8]">지우기</button>}
                <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg bg-[#243B5A] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1B2F49]">닫기</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type StyledSelectOption = { value: string; label: string };

/** cert.tsx 및 WorkManagement.tsx 스타일을 참조한 앱 공통 드롭메뉴 (셀렉트 박스) 컴포넌트 */
function AppStyledSelect({
  value,
  options,
  onChange,
  className = inputClass,
  placeholder = '선택해주세요',
  disabled = false,
  ariaLabel = '항목 선택',
}: {
  value: string;
  options: StyledSelectOption[];
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);
  const selected = options.find(option => option.value === value);
  return <>
    <button
      type="button"
      className={`${className} flex items-center justify-between gap-2 text-left ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-[#243B5A]'}`}
      onClick={() => { if (!disabled) setOpen(true); }}
      aria-label={ariaLabel}
      aria-haspopup="dialog"
      aria-expanded={open}
      disabled={disabled}
    >
      <span className={`min-w-0 flex-1 truncate ${selected ? 'text-[#1F2937]' : 'text-[#94A3B8]'}`}>{selected?.label || placeholder}</span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#64748B]" />
    </button>
    {open && <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/25 p-4" onClick={() => setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label={ariaLabel} onClick={event => event.stopPropagation()} className="w-full max-w-sm overflow-hidden rounded-2xl border border-[#E2E5E9] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.18)]">
        <div className="flex items-center justify-between gap-3 border-b border-[#E2E5E9] bg-[#F8FAFC] px-4 py-3">
          <span className="text-sm font-bold text-[#243B5A]">{ariaLabel}</span>
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#E2E8F0]" aria-label="선택 메뉴 닫기"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[60dvh] overflow-y-auto p-2">
          {options.map(option => <button key={option.value} type="button" onClick={() => { onChange(option.value); setOpen(false); }} className={`mb-1 flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors last:mb-0 ${option.value === value ? 'bg-[#243B5A] font-bold text-white' : 'text-[#1F2937] hover:bg-[#F5F6F8]'}`}>
            <span className="min-w-0 break-words">{option.label}</span>
            {option.value === value && <span aria-hidden="true" className="shrink-0">✓</span>}
          </button>)}
          {options.length === 0 && <p className="px-3 py-4 text-center text-xs text-[#64748B]">선택 가능한 항목이 없습니다.</p>}
        </div>
      </div>
    </div>}
  </>;
}

export default function EducationManagement({
  isAdmin,
  educations,
  loadingEdu,
  fetchEducations,
  currentUser,
}: EducationManagementProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // 커스텀 알림(Alert / Confirm) 상태 관리
  const [alertDialog, setAlertDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'info' | 'error' | 'success';
  }>({
    show: false,
    title: '',
    message: '',
    type: 'info',
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showAlert = (message: string, title = '안내', type: 'info' | 'error' | 'success' = 'info') => {
    setAlertDialog({ show: true, title, message, type });
  };

  const showConfirm = (message: string, onConfirm: () => void, title = '확인 요청') => {
    setConfirmDialog({ show: true, title, message, onConfirm });
  };

  // 상세보기 팝업 상태
  const [selectedEduForDetail, setSelectedEduForDetail] = useState<Education | null>(null);
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<EventItem | null>(null);

  // 교육 당일 배정 알림 팝업 상태
  const [assignedNoticeEdu, setAssignedNoticeEdu] = useState<Education | null>(null);
  const [showNoticeModal, setShowNoticeModal] = useState(false);

  // EVENT 데이터 및 로딩 상태
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // -------------------------------------------------------------
  // 통합 등록 / 수정 모달 상태
  // -------------------------------------------------------------
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleType, setScheduleType] = useState<'education' | 'event'>('education');
  const [editingScheduleId, setEditingScheduleId] = useState<number | string | null>(null);

  // 공통 폼 상태
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState(getLocalDateString());
  const [formTimeSlot, setFormTimeSlot] = useState('10:00~12:00');
  const [formLocation, setFormLocation] = useState('');

  // 교육 전용 폼 상태
  const [assignedWorkersInput, setAssignedWorkersInput] = useState('');
  const [assignedWorkers, setAssignedWorkers] = useState<string[]>([]);

  // EVENT 전용 폼 상태
  const [eventDescription, setEventDescription] = useState('');

  // 일정 N(신규/수정) 표시용 읽음 처리
  const [, setNReadVersion] = useState(0);

  const getScheduleReadKey = (type: 'education' | 'event', id: number | string) => {
    const userKey = currentUser?.name || 'guest';
    return `education_schedule_read_${userKey}_${type}_${id}`;
  };

  const getScheduleChangeTime = (item: any) => {
    const value = item?.updated_at || item?.created_at;
    const time = value ? new Date(value).getTime() : 0;
    return Number.isFinite(time) ? time : 0;
  };

  const isScheduleNew = (type: 'education' | 'event', item: any) => {
    if (typeof window === 'undefined' || !item) return false;

    const changeTime = getScheduleChangeTime(item);
    if (!changeTime) return false;

    const readAt = Number(localStorage.getItem(getScheduleReadKey(type, item.id)) || '0');
    if (readAt > 0) return changeTime > readAt;

    const userKey = currentUser?.name || 'guest';
    let initializedAt = Number(localStorage.getItem(`education_schedule_n_initialized_${userKey}`) || '0');
    if (!initializedAt) {
      initializedAt = Date.now();
      localStorage.setItem(`education_schedule_n_initialized_${userKey}`, String(initializedAt));
      return false;
    }

    return changeTime > initializedAt;
  };

  const markScheduleAsRead = (type: 'education' | 'event', item: any) => {
    if (typeof window === 'undefined' || !item) return;

    const currentScrollY = window.scrollY;

    localStorage.setItem(
      getScheduleReadKey(type, item.id),
      String(Date.now())
    );
    setNReadVersion(prev => prev + 1);

    // N 제거를 위한 재렌더링 후에도 현재 화면 스크롤 위치를 유지
    requestAnimationFrame(() => {
      window.scrollTo(0, currentScrollY);
      requestAnimationFrame(() => {
        window.scrollTo(0, currentScrollY);
      });
    });
  };

  const handleOpenEducationDetail = (edu: Education) => {
    markScheduleAsRead('education', edu);
    setSelectedEduForDetail(edu);
  };

  const handleOpenEventDetail = (ev: EventItem) => {
    markScheduleAsRead('event', ev);
    setSelectedEventForDetail(ev);
  };

  const renderScheduleNewBadge = (type: 'education' | 'event', item: any) => {
    if (!isScheduleNew(type, item)) return null;
    return <span className="text-[10px] font-extrabold text-red-600 ml-1">N</span>;
  };

  // 이벤트 데이터 불러오기 (useCallback 최적화)
  const fetchEvents = useCallback(async () => {
    try {
      setLoadingEvents(true);
      const { data, error } = await supabase
        .from('events')
        // 화면에서 실제 사용하는 필드만 조회해 응답 데이터 크기를 줄입니다.
        .select('id, title, event_date, time_slot, location, description, created_at, updated_at')
        .order('event_date', { ascending: true });
      if (error) throw error;
      setEvents(data || []);
    } catch (err: any) {
      console.error('이벤트 불러오기 실패:', err?.message);
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // 교육 당일 알림 기능 유지
  useEffect(() => {
    if (!currentUser?.name || educations.length === 0) return;

    const todayStr = getLocalDateString();
    const todayEducations = educations.filter((edu) =>
      edu.edu_date === todayStr &&
      edu.assigned_workers &&
      edu.assigned_workers.includes(currentUser.name)
    );

    if (todayEducations.length > 0) {
      const targetEdu = todayEducations[0];
      const hasSeen = sessionStorage.getItem(`edu_notice_seen_${targetEdu.id}_${currentUser.name}`);

      if (!hasSeen) {
        setAssignedNoticeEdu(targetEdu);
        setShowNoticeModal(true);
      }
    }
  }, [currentUser?.name, educations]);

  const handleCloseNoticeModal = () => {
    if (assignedNoticeEdu && currentUser?.name) {
      sessionStorage.setItem(`edu_notice_seen_${assignedNoticeEdu.id}_${currentUser.name}`, 'true');
    }
    setShowNoticeModal(false);
  };

  const handleAddWorkers = () => {
    if (!assignedWorkersInput.trim()) return;
    const names = assignedWorkersInput
      .split(',')
      .map(n => n.trim())
      .filter(n => n.length > 0);

    if (names.length === 0) return;

    setAssignedWorkers(prev => Array.from(new Set([...prev, ...names])));
    setAssignedWorkersInput('');
  };

  const handleRemoveWorker = (nameToRemove: string) => {
    setAssignedWorkers(prev => prev.filter(name => name !== nameToRemove));
  };

  // -------------------------------------------------------------
  // 통합 모달 열기 핸들러
  // -------------------------------------------------------------
  const handleOpenScheduleCreate = (dateStr?: string) => {
    if (!isAdmin) return showAlert('관리자만 일정을 등록할 수 있습니다.', '권한 없음', 'error');
    setEditingScheduleId(null);
    setScheduleType('education');
    setFormTitle('');
    setFormDate(dateStr || getLocalDateString());
    setFormTimeSlot('10:00~12:00');
    setFormLocation('대회의실');
    setAssignedWorkersInput('');
    setAssignedWorkers([]);
    setEventDescription('');
    setShowScheduleModal(true);
  };

  const handleOpenEduEdit = (edu: Education, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return showAlert('관리자만 교육을 수정할 수 있습니다.', '권한 없음', 'error');
    setEditingScheduleId(edu.id);
    setScheduleType('education');
    setFormTitle(edu.title);
    setFormDate(edu.edu_date);
    setFormTimeSlot(edu.time_slot);
    setFormLocation(edu.location);
    setAssignedWorkersInput('');
    setAssignedWorkers(edu.assigned_workers || []);
    setEventDescription('');
    setShowScheduleModal(true);
  };

  const handleOpenEventEdit = (ev: EventItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return showAlert('관리자만 EVENT를 수정할 수 있습니다.', '권한 없음', 'error');
    setEditingScheduleId(ev.id);
    setScheduleType('event');
    setFormTitle(ev.title);
    setFormDate(ev.event_date);
    setFormTimeSlot(ev.time_slot || '');
    setFormLocation(ev.location || '');
    setEventDescription(ev.description || '');
    setAssignedWorkersInput('');
    setAssignedWorkers([]);
    setShowScheduleModal(true);
  };

  // 삭제 핸들러
  const handleDeleteEdu = (id: number | string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return showAlert('삭제 권한이 없습니다.', '권한 없음', 'error');

    showConfirm('정말 이 교육 항목을 삭제하시겠습니까?', async () => {
      try {
        const { error } = await supabase.from('educations').delete().eq('id', id);
        if (error) throw error;

        showAlert('성공적으로 삭제되었습니다.', '삭제 완료', 'success');
        setShowScheduleModal(false);
        setSelectedEduForDetail(null);
        fetchEducations();
      } catch (err: any) {
        showAlert(`삭제 실패: ${err?.message || '오류가 발생했습니다.'}`, '오류 발생', 'error');
      }
    }, '교육 일정 삭제');
  };

  const handleDeleteEvent = (id: number | string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return showAlert('관리자만 EVENT를 삭제할 수 있습니다.', '권한 없음', 'error');

    showConfirm('정말 이 EVENT를 삭제하시겠습니까?', async () => {
      try {
        const { error } = await supabase.from('events').delete().eq('id', id);
        if (error) throw error;

        showAlert('EVENT가 삭제되었습니다.', '삭제 완료', 'success');
        setShowScheduleModal(false);
        setSelectedEventForDetail(null);
        fetchEvents();
      } catch (err: any) {
        showAlert(`EVENT 삭제 실패: ${err?.message || '오류가 발생했습니다.'}`, '오류 발생', 'error');
      }
    }, 'EVENT 삭제');
  };

  // 통합 폼 제출 핸들러 (중복 시도 없이 단일 명확 실행으로 에러 로그 방지)
  const handleSubmitSchedule = async (e: React.FormEvent) => {
    e.preventDefault();

    if (scheduleType === 'education') {
      if (!isAdmin) return showAlert('등록/수정 권한이 없습니다.', '권한 없음', 'error');
      if (!formTitle.trim()) return showAlert('교육명을 입력해주세요.', '입력 항목 누락', 'error');

      try {
        const payload: any = {
          title: formTitle,
          edu_date: formDate,
          time_slot: formTimeSlot,
          location: formLocation,
          assigned_workers: assignedWorkers,
          updated_at: new Date().toISOString()
        };

        if (editingScheduleId) {
          const { error } = await supabase.from('educations').update(payload).eq('id', editingScheduleId);
          if (error) throw error;
          showAlert('교육 일정이 수정되었습니다.', '수정 완료', 'success');
        } else {
          const { error } = await supabase.from('educations').insert([payload]);
          if (error) throw error;
          showAlert('신규 교육 일정이 등록되었습니다.', '등록 완료', 'success');
        }

        setShowScheduleModal(false);
        fetchEducations();
      } catch (err: any) {
        showAlert('교육 저장 실패: ' + (err?.message || '오류가 발생했습니다.'), '저장 오류', 'error');
      }
    } else {
      if (!isAdmin) return showAlert('관리자만 EVENT를 등록/수정할 수 있습니다.', '권한 없음', 'error');
      if (!formTitle.trim()) return showAlert('EVENT 제목을 입력해주세요.', '입력 항목 누락', 'error');

      try {
        const payload = {
          title: formTitle,
          event_date: formDate,
          time_slot: formTimeSlot,
          location: formLocation,
          description: eventDescription,
          updated_at: new Date().toISOString()
        };

        if (editingScheduleId) {
          const { error } = await supabase.from('events').update(payload).eq('id', editingScheduleId);
          if (error) throw error;
          showAlert('EVENT가 수정되었습니다.', '수정 완료', 'success');
        } else {
          const { error } = await supabase.from('events').insert([payload]);
          if (error) throw error;
          showAlert('신규 EVENT가 등록되었습니다.', '등록 완료', 'success');
        }

        setShowScheduleModal(false);
        fetchEvents();
      } catch (err: any) {
        showAlert('EVENT 저장 실패: ' + (err?.message || '오류가 발생했습니다.'), '저장 오류', 'error');
      }
    }
  };

  // 🕒 해당일 18:00 목록 자동 비노출(삭제) 판단 함수
  const isExpired = (dateStr: string) => {
    if (!dateStr) return false;
    const now = new Date();
    const targetCutoff = new Date(`${dateStr}T18:00:00`);
    return now >= targetCutoff;
  };

  const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const visibleEducations = educations.filter(edu =>
    !isExpired(edu.edu_date) && edu.edu_date?.slice(0, 7) === currentMonthKey
  );
  const visibleEvents = events.filter(ev =>
    !isExpired(ev.event_date) && ev.event_date?.slice(0, 7) === currentMonthKey
  );

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = getLocalDateString();

  const calendarDays = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(d);
  }

  return (
    <div className="w-full text-[#1F2937] p-4 sm:p-6 space-y-4 font-sans border-box">
      
      {/* 🚀 상단 타이틀 영역 */}
      <div className="bg-white p-4 rounded-xl border border-[#E2E5E9] shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-xl text-[#243B5A]">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#1F2937]">교육 및 EVENT 통합 캘린더</h1>
            <p className="text-xs text-[#64748B]">사내 정기 교육 및 중요 EVENT 일정 관리</p>
          </div>
        </div>
      </div>

      {/* 캘린더 컨트롤 및 신규 일정 등록 버튼 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-xl border border-[#E2E5E9] shadow-xs gap-3">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            className="p-2 hover:bg-[#F5F6F8] rounded-lg transition text-[#64748B] border border-[#E2E5E9]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="text-sm font-bold text-[#1F2937] px-2">
            {year}년 {month + 1}월
          </h2>
          <button
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            className="p-2 hover:bg-[#F5F6F8] rounded-lg transition text-[#64748B] border border-[#E2E5E9]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="text-xs px-3 py-2 bg-[#F5F6F8] hover:bg-[#E2E5E9] rounded-lg text-[#1F2937] font-semibold border border-[#E2E5E9] transition"
          >
            오늘
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {isAdmin && (
            <button
              onClick={() => handleOpenScheduleCreate()}
              className="flex items-center justify-center space-x-1.5 bg-[#243B5A] text-white px-3.5 py-2 rounded-lg hover:bg-[#1d3049] transition shadow-xs font-medium text-xs"
            >
              <Plus className="h-4 w-4" />
              <span>신규 일정 등록</span>
            </button>
          )}
        </div>
      </div>

      {loadingEdu || loadingEvents ? (
        <div className="bg-white rounded-xl border border-[#E2E5E9] text-center py-12 text-xs text-[#64748B]">일정을 불러오는 중...</div>
      ) : (
        <>
          {/* 통합 달력 뷰 */}
          <div className="bg-white rounded-xl border border-[#E2E5E9] overflow-hidden shadow-xs">
            <div className="grid grid-cols-7 bg-[#F5F6F8] border-b border-[#E2E5E9] text-center py-2.5 text-xs font-bold text-[#64748B]">
              <div className="text-red-600">일</div>
              <div>월</div>
              <div>화</div>
              <div>수</div>
              <div>목</div>
              <div>금</div>
              <div className="text-blue-600">토</div>
            </div>

            <div className="grid grid-cols-7 auto-rows-fr gap-px bg-[#E2E5E9]">
              {calendarDays.map((day, idx) => {
                if (day === null) {
                  return <div key={idx} className="bg-[#F5F6F8]/50 min-h-[110px]" />;
                }

                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayEdus = educations.filter(e => e.edu_date === dateStr);
                const dayEvts = events.filter(ev => ev.event_date === dateStr);
                const isToday = todayStr === dateStr;

                return (
                  <div
                    key={idx}
                    className={`bg-white p-1.5 min-h-[110px] flex flex-col justify-between hover:bg-[#F5F6F8]/50 transition relative ${
                      isToday ? 'bg-blue-50/30' : ''
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          isToday ? 'bg-[#243B5A] text-white' : 'text-[#1F2937]'
                        }`}>
                          {day}
                        </span>
                        
                        {isAdmin && (
                          <button
                            onClick={() => handleOpenScheduleCreate(dateStr)}
                            className="text-[#64748B] hover:text-[#243B5A] p-0.5 rounded"
                            title="이 날짜에 일정 추가"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        )}
                      </div>

                      <div className="space-y-1 max-h-[85px] overflow-y-auto">
                        {dayEdus.map(edu => (
                          <div
                            key={`edu-${edu.id}`}
                            onClick={() => handleOpenEducationDetail(edu)}
                            className="p-1 rounded text-[10px] bg-slate-100 border border-slate-300 text-[#243B5A] cursor-pointer hover:bg-slate-200 transition truncate font-medium flex items-center gap-1"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#243B5A] shrink-0" />
                            <span className="truncate"><strong className="font-semibold">[교육]</strong> {edu.title}{renderScheduleNewBadge('education', edu)}</span>
                          </div>
                        ))}
                        {dayEvts.map(ev => (
                          <div
                            key={`evt-${ev.id}`}
                            onClick={() => handleOpenEventDetail(ev)}
                            className="p-1 rounded text-[10px] bg-teal-50 border border-teal-200 text-teal-900 cursor-pointer hover:bg-teal-100 transition truncate font-medium flex items-center gap-1"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#0D9488] shrink-0" />
                            <span className="truncate"><strong className="font-semibold">[EVENT]</strong> {ev.title}{renderScheduleNewBadge('event', ev)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 하단 전체 목록 영역 */}
          <div className="mt-6 space-y-5">
            {/* 1. 전체 교육 목록 */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
                <GraduationCap className="h-4 w-4 text-[#243B5A]" />
                <span>전체 교육 목록</span>
              </h3>
              {visibleEducations.length === 0 ? (
                <div className="bg-white rounded-xl p-6 text-center border border-[#E2E5E9] text-[#64748B] text-xs">
                  등록된 교육 일정이 없습니다.
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-[#E2E5E9] overflow-hidden shadow-xs">
                  {visibleEducations.map((edu, idx) => (
                    <div
                      key={edu.id}
                      onClick={() => handleOpenEducationDetail(edu)}
                      className={`px-3 py-2.5 flex items-center gap-2.5 cursor-pointer hover:bg-[#F5F6F8] transition ${
                        idx !== visibleEducations.length - 1 ? 'border-b border-[#E2E5E9]' : ''
                      }`}
                    >
                      <span className="shrink-0 text-[10px] font-semibold px-2 py-1 rounded bg-slate-100 text-[#243B5A] border border-slate-200">
                        {edu.edu_date}
                      </span>
                      <span className="min-w-0 flex-1 text-xs font-semibold text-[#1F2937] truncate">
                        {edu.title}{renderScheduleNewBadge('education', edu)}
                      </span>
                      <span className="hidden sm:block shrink-0 text-[10px] text-[#64748B]">
                        {edu.time_slot}
                      </span>
                      {isAdmin && (
                        <div className="flex items-center space-x-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={(e) => handleOpenEduEdit(edu, e)}
                            className="p-1 text-[#64748B] hover:text-[#243B5A] rounded hover:bg-slate-100"
                            title="교육 수정"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteEdu(edu.id, e)}
                            className="p-1 text-[#64748B] hover:text-[#DC2626] rounded hover:bg-slate-100"
                            title="교육 삭제"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. 전체 EVENT 목록 */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
                <CalendarIcon className="h-4 w-4 text-[#0D9488]" />
                <span>전체 EVENT 목록</span>
              </h3>
              {visibleEvents.length === 0 ? (
                <div className="bg-white rounded-xl p-6 text-center border border-[#E2E5E9] text-[#64748B] text-xs">
                  등록된 EVENT가 없습니다.
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-[#E2E5E9] overflow-hidden shadow-xs">
                  {visibleEvents.map((ev, idx) => (
                    <div
                      key={ev.id}
                      onClick={() => handleOpenEventDetail(ev)}
                      className={`px-3 py-2.5 flex items-center gap-2.5 cursor-pointer hover:bg-[#F5F6F8] transition ${
                        idx !== visibleEvents.length - 1 ? 'border-b border-[#E2E5E9]' : ''
                      }`}
                    >
                      <span className="shrink-0 text-[10px] font-semibold px-2 py-1 rounded bg-teal-50 text-teal-800 border border-teal-200">
                        {ev.event_date}
                      </span>
                      <span className="min-w-0 flex-1 text-xs font-semibold text-[#1F2937] truncate">
                        {ev.title}{renderScheduleNewBadge('event', ev)}
                      </span>
                      <span className="hidden sm:block shrink-0 text-[10px] text-[#64748B]">
                        {ev.time_slot || ''}
                      </span>
                      {isAdmin && (
                        <div className="flex items-center space-x-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={(e) => handleOpenEventEdit(ev, e)}
                            className="p-1 text-[#64748B] hover:text-[#0D9488] rounded hover:bg-slate-100"
                            title="EVENT 수정"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteEvent(ev.id, e)}
                            className="p-1 text-[#64748B] hover:text-[#DC2626] rounded hover:bg-slate-100"
                            title="EVENT 삭제"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 🔔 [스타일 공통] 커스텀 Alert 모달 */}
      {alertDialog.show && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white border border-[#E2E5E9] rounded-xl max-w-sm w-full p-5 shadow-xl relative text-[#1F2937]">
            <div className="flex items-center space-x-2 mb-2">
              {alertDialog.type === 'error' && <AlertCircle className="h-5 w-5 text-[#DC2626]" />}
              {alertDialog.type === 'success' && <CheckCircle2 className="h-5 w-5 text-[#0D9488]" />}
              {alertDialog.type === 'info' && <Bell className="h-5 w-5 text-[#243B5A]" />}
              <h3 className="text-xs font-bold text-[#1F2937]">{alertDialog.title}</h3>
            </div>
            <p className="text-xs text-[#64748B] my-3 leading-relaxed">{alertDialog.message}</p>
            <button
              onClick={() => setAlertDialog(prev => ({ ...prev, show: false }))}
              className="w-full py-2 bg-[#243B5A] hover:bg-[#1d3049] text-white font-semibold text-xs rounded-lg transition shadow-2xs"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* ❓ [스타일 공통] 커스텀 Confirm 모달 */}
      {confirmDialog.show && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white border border-[#E2E5E9] rounded-xl max-w-sm w-full p-5 shadow-xl relative text-[#1F2937]">
            <div className="flex items-center space-x-2 mb-2">
              <HelpCircle className="h-5 w-5 text-[#243B5A]" />
              <h3 className="text-xs font-bold text-[#1F2937]">{confirmDialog.title}</h3>
            </div>
            <p className="text-xs text-[#64748B] my-3 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setConfirmDialog(prev => ({ ...prev, show: false }))}
                className="px-3.5 py-1.5 bg-white border border-[#E2E5E9] hover:bg-slate-50 text-[#1F2937] rounded-lg text-xs font-medium transition"
              >
                취소
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(prev => ({ ...prev, show: false }));
                }}
                className="px-3.5 py-1.5 bg-[#DC2626] hover:bg-[#b91c1c] text-white rounded-lg text-xs font-semibold transition"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 접속자 교육 당일 배정 알림 팝업 모달 */}
      {showNoticeModal && assignedNoticeEdu && currentUser?.name && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E2E5E9] rounded-xl max-w-sm w-full p-5 shadow-xl relative text-[#1F2937]">
            <button 
              onClick={handleCloseNoticeModal} 
              className="absolute top-4 right-4 text-[#64748B] hover:text-[#1F2937]"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center space-x-1.5 text-[#2563EB] font-bold text-xs mb-2">
              <Bell className="h-4 w-4" />
              <span>교육 일정 안내</span>
            </div>

            <h3 className="text-xs font-bold text-[#1F2937] mb-1">
              <span className="text-[#243B5A]">{currentUser.name}</span>님, 교육 대상자로 지정되었습니다.
            </h3>

            <p className="text-[11px] text-[#64748B] mb-3">
              배정된 교육 일정을 확인해 주세요.
            </p>

            <div className="bg-slate-50 border border-[#E2E5E9] rounded-lg p-3 space-y-1.5 mb-4 text-xs">
              <div className="font-bold text-[#243B5A] mb-1">
                {assignedNoticeEdu.title}
              </div>
              <div className="flex items-center text-[#64748B] space-x-1.5">
                <Clock className="h-3 w-3 text-[#243B5A] shrink-0" />
                <span>일시: <strong className="text-[#1F2937]">{assignedNoticeEdu.edu_date} ({assignedNoticeEdu.time_slot})</strong></span>
              </div>
              <div className="flex items-center text-[#64748B] space-x-1.5">
                <MapPin className="h-3 w-3 text-[#243B5A] shrink-0" />
                <span>장소: <strong className="text-[#1F2937]">{assignedNoticeEdu.location}</strong></span>
              </div>
            </div>

            <button
              onClick={handleCloseNoticeModal}
              className="w-full py-2 bg-[#243B5A] hover:bg-[#1d3049] text-white font-semibold text-xs rounded-lg transition shadow-2xs"
            >
              확인했습니다
            </button>
          </div>
        </div>
      )}

      {/* 🚀 [통합] 신규 일정 및 수정 등록 모달 */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E2E5E9] rounded-xl max-w-md w-full p-5 shadow-xl relative text-[#1F2937]">
            <button onClick={() => setShowScheduleModal(false)} className="absolute top-4 right-4 text-[#64748B]"><X className="h-4 w-4" /></button>
            <h2 className="text-xs font-bold text-[#1F2937] mb-3">
              {editingScheduleId ? (scheduleType === 'education' ? '교육 일정 수정' : 'EVENT 수정') : '신규 일정 등록'}
            </h2>
            
            <form onSubmit={handleSubmitSchedule} className="space-y-3 text-xs">
              {/* 등록 구분 선택 (AppStyledSelect 대체 적용) */}
              <div>
                <label className="block font-semibold text-[#64748B] mb-1">등록 구분</label>
                <AppStyledSelect
                  ariaLabel="등록 구분"
                  value={scheduleType}
                  onChange={(val) => {
                    if (!editingScheduleId) {
                      setScheduleType(val as 'education' | 'event');
                    }
                  }}
                  disabled={!!editingScheduleId}
                  options={[
                    { value: 'education', label: '교육 일정' },
                    { value: 'event', label: 'EVENT 일정' }
                  ]}
                />
              </div>

              {/* 제목 */}
              <div>
                <label className="block font-semibold text-[#64748B] mb-1">
                  {scheduleType === 'education' ? '교육명' : 'EVENT 제목'}
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-[#E2E5E9] rounded-lg p-2 text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] focus:outline-hidden"
                  placeholder={scheduleType === 'education' ? '예: 상반기 정기 안전교육' : '예: 사내 워크숍'}
                />
              </div>

              {/* 장소 */}
              <div>
                <label className="block font-semibold text-[#64748B] mb-1">장소</label>
                <input
                  type="text"
                  required={scheduleType === 'education'}
                  value={formLocation}
                  onChange={e => setFormLocation(e.target.value)}
                  className="w-full bg-slate-50 border border-[#E2E5E9] rounded-lg p-2 text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] focus:outline-hidden"
                  placeholder="예: 대회의실 또는 강당"
                />
              </div>

              {/* 날짜(CalendarDatePicker 적용) 및 시간 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <CalendarDatePicker
                  label="일자"
                  value={formDate}
                  onChange={date => setFormDate(date)}
                />
                <div>
                  <label className="block font-semibold text-[#64748B] mb-1">시간대</label>
                  <input
                    type="text"
                    required={scheduleType === 'education'}
                    value={formTimeSlot}
                    onChange={e => setFormTimeSlot(e.target.value)}
                    className="w-full bg-slate-50 border border-[#E2E5E9] rounded-lg p-2 text-xs text-[#1F2937]"
                    placeholder="10:00~12:00"
                  />
                </div>
              </div>

              {/* 교육 전용 필드: 대상자 지정 */}
              {scheduleType === 'education' && (
                <div>
                  <label className="block font-semibold text-[#64748B] mb-1">교육 대상자 배정 (쉼표 구분 입력 가능)</label>
                  <div className="flex gap-2 mb-1.5">
                    <input
                      type="text"
                      value={assignedWorkersInput}
                      onChange={e => setAssignedWorkersInput(e.target.value)}
                      className="flex-1 bg-slate-50 border border-[#E2E5E9] rounded-lg p-2 text-xs text-[#1F2937]"
                      placeholder="홍길동, 이순신"
                    />
                    <button
                      type="button"
                      onClick={handleAddWorkers}
                      className="bg-[#243B5A] hover:bg-[#1d3049] text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0"
                    >
                      추가
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1 p-2 bg-slate-50 border border-[#E2E5E9] rounded-lg min-h-[36px] max-h-24 overflow-y-auto">
                    {assignedWorkers.length === 0 ? (
                      <span className="text-[11px] text-[#64748B]">배정된 인원이 없습니다.</span>
                    ) : (
                      assignedWorkers.map((worker, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 bg-white text-[#243B5A] text-[11px] px-2 py-0.5 rounded border border-[#E2E5E9] font-medium">
                          {worker}
                          <button
                            type="button"
                            onClick={() => handleRemoveWorker(worker)}
                            className="hover:text-[#DC2626] rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* EVENT 전용 필드: 상세 내용 */}
              {scheduleType === 'event' && (
                <div>
                  <label className="block font-semibold text-[#64748B] mb-1">EVENT 상세 내용</label>
                  <textarea
                    rows={3}
                    value={eventDescription}
                    onChange={e => setEventDescription(e.target.value)}
                    className="w-full bg-slate-50 border border-[#E2E5E9] rounded-lg p-2 text-xs text-[#1F2937]"
                    placeholder="이벤트 상세 내용을 입력하세요."
                  />
                </div>
              )}

              {/* 하단 푸터 버튼 */}
              <div className="flex items-center justify-between pt-3 border-t border-[#E2E5E9]">
                {editingScheduleId ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (scheduleType === 'education') handleDeleteEdu(editingScheduleId);
                      else handleDeleteEvent(editingScheduleId);
                    }}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium text-[#DC2626] bg-red-50 hover:bg-red-100 border border-red-200"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>삭제</span>
                  </button>
                ) : <div />}

                <div className="flex space-x-2">
                  <button type="button" onClick={() => setShowScheduleModal(false)} className="px-3 py-1.5 bg-white border border-[#E2E5E9] hover:bg-slate-50 rounded-lg text-xs text-[#1F2937]">취소</button>
                  <button
                    type="submit"
                    className={`px-3 py-1.5 text-white rounded-lg text-xs font-semibold ${
                      scheduleType === 'education' ? 'bg-[#243B5A] hover:bg-[#1d3049]' : 'bg-[#0D9488] hover:bg-[#0f766e]'
                    }`}
                  >
                    {editingScheduleId ? '수정 완료' : '등록하기'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 교육 상세보기 팝업 모달 */}
      {selectedEduForDetail && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E2E5E9] rounded-xl max-w-md w-full p-5 shadow-xl relative text-[#1F2937]">
            <button onClick={() => setSelectedEduForDetail(null)} className="absolute top-4 right-4 text-[#64748B] hover:text-[#1F2937]"><X className="h-4 w-4" /></button>
            
            <div className="flex items-center space-x-1.5 text-xs font-bold text-[#243B5A] mb-1">
              <span>[교육] {selectedEduForDetail.edu_date} ({selectedEduForDetail.time_slot})</span>
            </div>

            <h2 className="text-xs font-bold text-[#1F2937] mb-3">{selectedEduForDetail.title}</h2>

            <div className="bg-slate-50 p-3 rounded-lg border border-[#E2E5E9] text-xs space-y-1.5 mb-3">
              <div className="flex items-center space-x-1.5 text-[#64748B]">
                <MapPin className="h-3.5 w-3.5 text-[#243B5A]" />
                <span>장소: <strong className="text-[#1F2937]">{selectedEduForDetail.location}</strong></span>
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-[11px] font-bold text-[#64748B] mb-1.5 flex items-center gap-1">
                <Users className="h-3 w-3 text-[#243B5A]" />
                <span>교육 대상자 목록</span>
              </h3>
              <div className="flex flex-wrap gap-1 p-2.5 bg-slate-50 rounded-lg border border-[#E2E5E9] min-h-[40px] max-h-32 overflow-y-auto">
                {selectedEduForDetail.assigned_workers && selectedEduForDetail.assigned_workers.length > 0 ? (
                  selectedEduForDetail.assigned_workers.map((worker, idx) => (
                    <span key={idx} className="bg-white text-[#243B5A] text-xs px-2 py-0.5 rounded border border-[#E2E5E9] font-medium">
                      {worker}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-[#64748B]">배정된 교육 대상자가 없습니다.</span>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-[#E2E5E9]">
              <div className="flex space-x-1.5">
                {isAdmin && (
                  <>
                    <button
                      onClick={() => {
                        const eduToEdit = selectedEduForDetail;
                        setSelectedEduForDetail(null);
                        handleOpenEduEdit(eduToEdit);
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#1F2937] rounded-lg text-xs font-semibold transition flex items-center space-x-1 border border-[#E2E5E9]"
                    >
                      <Pencil className="h-3 w-3" />
                      <span>수정</span>
                    </button>
                    <button
                      onClick={() => handleDeleteEdu(selectedEduForDetail.id)}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-[#DC2626] rounded-lg text-xs font-semibold transition flex items-center space-x-1 border border-red-200"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>삭제</span>
                    </button>
                  </>
                )}
              </div>

              <button
                onClick={() => setSelectedEduForDetail(null)}
                className="px-4 py-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white rounded-lg text-xs font-semibold transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EVENT 상세보기 팝업 모달 */}
      {selectedEventForDetail && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E2E5E9] rounded-xl max-w-md w-full p-5 shadow-xl relative text-[#1F2937]">
            <button onClick={() => setSelectedEventForDetail(null)} className="absolute top-4 right-4 text-[#64748B] hover:text-[#1F2937]"><X className="h-4 w-4" /></button>
            
            <div className="flex items-center space-x-1.5 text-xs font-bold text-teal-700 mb-1">
              <span>[EVENT] {selectedEventForDetail.event_date} {selectedEventForDetail.time_slot ? `(${selectedEventForDetail.time_slot})` : ''}</span>
            </div>

            <h2 className="text-xs font-bold text-[#1F2937] mb-3">{selectedEventForDetail.title}</h2>

            <div className="bg-slate-50 p-3 rounded-lg border border-[#E2E5E9] text-xs space-y-1.5 mb-3">
              {selectedEventForDetail.location && (
                <div className="flex items-center space-x-1.5 text-[#64748B]">
                  <MapPin className="h-3.5 w-3.5 text-teal-700" />
                  <span>장소: <strong className="text-[#1F2937]">{selectedEventForDetail.location}</strong></span>
                </div>
              )}
            </div>

            <div className="mb-4">
              <h3 className="text-[11px] font-bold text-[#64748B] mb-1.5">EVENT 내용</h3>
              <div className="p-3 bg-slate-50 rounded-lg border border-[#E2E5E9] text-xs text-[#1F2937] min-h-[60px] whitespace-pre-wrap">
                {selectedEventForDetail.description || '작성된 내용이 없습니다.'}
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-[#E2E5E9]">
              <div className="flex space-x-1.5">
                {isAdmin && (
                  <>
                    <button
                      onClick={() => {
                        const evToEdit = selectedEventForDetail;
                        setSelectedEventForDetail(null);
                        handleOpenEventEdit(evToEdit);
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#1F2937] rounded-lg text-xs font-semibold transition flex items-center space-x-1 border border-[#E2E5E9]"
                    >
                      <Pencil className="h-3 w-3" />
                      <span>수정</span>
                    </button>
                    <button
                      onClick={() => handleDeleteEvent(selectedEventForDetail.id)}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-[#DC2626] rounded-lg text-xs font-semibold transition flex items-center space-x-1 border border-red-200"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>삭제</span>
                    </button>
                  </>
                )}
              </div>

              <button
                onClick={() => setSelectedEventForDetail(null)}
                className="px-4 py-1.5 bg-[#0D9488] hover:bg-[#0f766e] text-white rounded-lg text-xs font-semibold transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
