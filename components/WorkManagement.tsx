'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Clock, User, CheckCircle2, Pencil, Trash2, Calendar as CalendarIcon, 
  Plus, X, ChevronLeft, ChevronRight, Bell, Home, Tag, Sun, Moon, 
  LayoutGrid, List, Settings, Eye, AlertCircle, PlayCircle, PlusCircle,
  Users, History, FileSpreadsheet, Layers, FileText, ChevronDown
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
  absence_dates?: string[];
}

const isFormerAppUser = (user?: AppUser | null) => {
  if (!user) return true;
  return [user.department, user.position, user.job_title, user.field].some(value => /퇴사|퇴직|퇴사자|퇴직자/.test(String(value || '')));
};

const C = { navy: '#243B5A', pale: '#F5F6F8', border: '#E2E5E9', text: '#1F2937', muted: '#64748B' };
const inputClass = 'w-full rounded-lg border border-[#E2E5E9] bg-[#F5F6F8] px-3 py-2 text-xs text-[#1F2937] outline-none focus:border-[#243B5A] focus:bg-white transition-colors';

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

function isUserOffOnDate(user: AppUser | undefined, date: string): boolean {
  if (!user || !date) return false;
  // 날짜별 user_day_status 기록만 기준으로 판정합니다.
  // app_users.work_status는 이전 날짜의 값이 남을 수 있으므로 휴무 판정에 사용하지 않습니다.
  return Array.isArray(user.absence_dates) && user.absence_dates.includes(date);
}

function isOperationsOrManagement(user: AppUser): boolean {
  const department = String(user.department || '').replace(/\s/g, '').toLowerCase();
  return department.includes('운영') || department.includes('관리');
}

type VehicleRow = {
  id: string;
  vehicle_number: string;
  created_at?: string;
};
type VehicleUsageRow = {
  id: string;
  vehicle_id: string;
  vehicle_number: string;
  user_id: string | null;
  user_name: string;
  used_at: string;
  mileage: number | null;
  destination: string;
  purpose: string;
  maintenance_start_date: string | null;
  maintenance_end_date: string | null;
  is_parked: boolean;
  parking_remarks: string | null;
  parking_updated_by_id?: string | null;
  parking_updated_by_name?: string | null;
  created_at?: string;
};
type VehicleDriver = { id: string; name: string; yard_cert_details?: Array<{ name?: string }> };

/** cert.tsx 스타일을 참조한 앱 공통 달력 날짜 선택 컴포넌트 */
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
  const today = formatDateToYYYYMMDD(new Date());

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
              <button type="button" onClick={() => { const now = new Date(); const date = formatDateToYYYYMMDD(now); setViewYear(now.getFullYear()); setViewMonth(now.getMonth()); onChange(date); setInputText(date); setIsOpen(false); }} className="rounded-lg px-3 py-2 text-xs font-semibold text-[#243B5A] hover:bg-[#F5F6F8]">오늘</button>
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

/** 앱 공통 달력과 동일한 팝업 스타일의 월 전용 선택기 */
function MonthOnlyPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const parsed = /^\d{4}-\d{2}$/.test(value) ? value.split('-').map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1];
  const [year, setYear] = useState(parsed[0]);
  const [month, setMonth] = useState(parsed[1]);
  useEffect(() => {
    if (/^\d{4}-\d{2}$/.test(value)) {
      const [y, m] = value.split('-').map(Number);
      setYear(y); setMonth(m);
    }
  }, [value]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [open]);
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} className="flex items-center gap-2 rounded-lg border border-[#E2E5E9] bg-[#F5F6F8] px-3 py-2 text-xs font-semibold text-[#243B5A] hover:border-[#243B5A]">
      <CalendarIcon className="h-3.5 w-3.5" />{value.replace('-', '년 ')}월
    </button>
    {open && <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/25 p-4" onClick={() => setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="월 선택" onClick={event => event.stopPropagation()} className="w-[min(320px,calc(100vw-32px))] rounded-2xl border border-[#E2E5E9] bg-white p-3 text-[#1F2937] shadow-[0_12px_32px_rgba(15,23,42,0.18)]">
        <div className="mb-3 flex items-center justify-between border-b border-[#E2E5E9] pb-2">
          <span className="text-sm font-bold text-[#243B5A]">월 선택</span>
          <button type="button" onClick={() => setOpen(false)} aria-label="월 선택 닫기" className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F5F6F8]"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex items-center gap-2">
          <select aria-label="연도 선택" value={year} onChange={event => setYear(Number(event.target.value))} className="min-w-0 flex-1 rounded-lg border border-[#E2E5E9] bg-[#F8FAFC] px-3 py-2 text-sm font-bold text-[#243B5A] outline-none focus:border-[#243B5A]">
            {Array.from({ length: 81 }, (_, i) => new Date().getFullYear() - 60 + i).map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select aria-label="월 선택" value={month} onChange={event => setMonth(Number(event.target.value))} className="min-w-0 flex-1 rounded-lg border border-[#E2E5E9] bg-[#F8FAFC] px-3 py-2 text-sm font-bold text-[#243B5A] outline-none focus:border-[#243B5A]">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
          </select>
        </div>
        <div className="mt-3 flex justify-between border-t border-[#E2E5E9] pt-2">
          <button type="button" onClick={() => { const now = new Date(); setYear(now.getFullYear()); setMonth(now.getMonth() + 1); }} className="rounded-lg px-3 py-2 text-xs font-semibold text-[#243B5A] hover:bg-[#F5F6F8]">이번 달</button>
          <button type="button" onClick={() => { onChange(`${year}-${String(month).padStart(2, '0')}`); setOpen(false); }} className="rounded-lg bg-[#243B5A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1B2F49]">선택</button>
        </div>
      </div>
    </div>}
  </>;
}

type CompactTimeOption = { value: string; label: string };

/** 앱 입력창 스타일을 유지하는 작은 시간 선택 메뉴 */
function CompactTimeSelect({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: string;
  options: CompactTimeOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find(option => option.value === value);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('touchstart', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('touchstart', closeOutside);
      document.removeEventListener('keydown', closeEscape);
    };
  }, [open]);

  return <div ref={rootRef} className="relative min-w-0">
    <button
      type="button"
      aria-label={ariaLabel}
      aria-haspopup="listbox"
      aria-expanded={open}
      onClick={() => setOpen(current => !current)}
      className="flex h-9 w-full min-w-0 items-center justify-between gap-1 rounded-lg border border-[#E2E5E9] bg-[#F5F6F8] px-2.5 text-xs font-semibold tabular-nums text-[#1F2937] outline-none transition-colors hover:border-[#243B5A] focus:border-[#243B5A] focus:bg-white"
    >
      <span className="truncate">{selected?.label || value}</span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#64748B]" />
    </button>
    {open && <div role="listbox" aria-label={ariaLabel} className="absolute left-0 top-[calc(100%+4px)] z-[80] max-h-48 w-full min-w-[76px] overflow-y-auto rounded-lg border border-[#E2E5E9] bg-white p-1 shadow-[0_8px_20px_rgba(15,23,42,0.16)]">
      {options.map(option => <button
        key={option.value}
        type="button"
        role="option"
        aria-selected={option.value === value}
        onClick={() => { onChange(option.value); setOpen(false); }}
        className={`mb-0.5 flex w-full items-center justify-center rounded-md px-2 py-2 text-xs tabular-nums last:mb-0 ${option.value === value ? 'bg-[#243B5A] font-bold text-white' : 'text-[#1F2937] hover:bg-[#F5F6F8]'}`}
      >{option.label}</button>)}
    </div>}
  </div>;
}

type StyledSelectOption = { value: string; label: string };

/** cert.tsx 스타일을 참조한 앱 공통 드롭메뉴 (셀렉트 박스) 컴포넌트 */
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

function VehicleManagementPanel({ currentUser, isAdmin, showCustomAlert, showCustomConfirm }: {
  currentUser?: { id: string; name: string; role: string } | null;
  isAdmin: boolean;
  showCustomAlert: (title: string, message: string) => void;
  showCustomConfirm: (title: string, message: string, onConfirm: () => void) => void;
}) {
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [usageRows, setUsageRows] = useState<VehicleUsageRow[]>([]);
  const [drivers, setDrivers] = useState<VehicleDriver[]>([]);
  const [activeVehicleId, setActiveVehicleId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedUsageIds, setSelectedUsageIds] = useState<string[]>([]);
  const [managerOpen, setManagerOpen] = useState(false);
  const [vehicleInput, setVehicleInput] = useState('');
  const [editingVehicleId, setEditingVehicleId] = useState('');
  const [usageModalOpen, setUsageModalOpen] = useState(false);
  const [parkingRow, setParkingRow] = useState<VehicleUsageRow | null>(null);
  const [parkingRemarks, setParkingRemarks] = useState('');
  const [notice, setNotice] = useState<{type:'success'|'error'|'warning'; message:string}|null>(null);
  const [usageForm, setUsageForm] = useState({
    used_at: `${formatDateToYYYYMMDD(new Date())}T${String(new Date().getHours()).padStart(2,'0')}:${String(new Date().getMinutes()).padStart(2,'0')}`,
    mileage: '', destination: '', purpose: '', maintenance_start_date: '', maintenance_end_date: ''
  });
  const currentId = String(currentUser?.id || '');
  const currentName = String(currentUser?.name || '').trim();
  const notify = useCallback((message: string, type: 'success'|'error'|'warning' = 'success') => setNotice({message,type}), []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const loadVehicleData = useCallback(async () => {
    setLoading(true);
    try {
      const [vehicleResult, usageResult, driverResult] = await Promise.all([
        supabase.from('work_vehicles').select('id, vehicle_number, created_at').order('vehicle_number', {ascending:true}),
        supabase.from('work_vehicle_usage').select('id, vehicle_id, vehicle_number, user_id, user_name, used_at, mileage, destination, purpose, maintenance_start_date, maintenance_end_date, is_parked, parking_remarks, parking_updated_by_id, parking_updated_by_name, created_at').order('used_at', {ascending:false}),
        supabase.from('app_users').select('id, name, yard_cert_details')
      ]);
      if (vehicleResult.error) throw vehicleResult.error;
      if (usageResult.error) throw usageResult.error;
      if (driverResult.error) throw driverResult.error;
      const vehicleList = (vehicleResult.data || []) as VehicleRow[];
      setVehicles(vehicleList);
      setUsageRows((usageResult.data || []) as VehicleUsageRow[]);
      setDrivers(((driverResult.data || []) as any[]).map(d => ({...d, id:String(d.id), name:String(d.name || ''), yard_cert_details:Array.isArray(d.yard_cert_details) ? d.yard_cert_details : []})));
      setActiveVehicleId(prev => vehicleList.some(v => v.id === prev) ? prev : (vehicleList[0]?.id || ''));
    } catch (error: any) {
      showCustomAlert('차량 정보 조회 오류', `차량 정보를 불러오지 못했습니다. Supabase SQL 및 권한을 확인해주세요.\n${error?.message || ''}`);
    } finally { setLoading(false); }
  }, [showCustomAlert]);

  useEffect(() => { void loadVehicleData(); }, [loadVehicleData]);

  const selectedVehicle = vehicles.find(v => v.id === activeVehicleId);
  const visibleUsage = useMemo(() => [...usageRows].sort((a,b)=>String(b.used_at).localeCompare(String(a.used_at))), [usageRows]);
  const eligibleDrivers = useMemo(() => drivers.filter(d => (d.yard_cert_details || []).some(cert => String(cert?.name || '').replace(/\s/g,'').includes('작업용차량운전자교육'))), [drivers]);
  const currentIsEligible = eligibleDrivers.some(d => (currentId && d.id === currentId) || (currentName && d.name.trim() === currentName));
  const canEditParking = useCallback((row: VehicleUsageRow) => isAdmin || (!!currentName && row.user_name.trim() === currentName) || (!!currentId && String(row.user_id || '') === currentId), [isAdmin, currentName, currentId]);

  const saveVehicle = async () => {
    if (!isAdmin) { showCustomAlert('권한 제한','관리자만 차량을 등록하거나 수정할 수 있습니다.'); return; }
    const number = vehicleInput.trim().toUpperCase();
    if (!number) { notify('차량번호를 입력해주세요.','warning'); return; }
    setSaving(true);
    try {
      if (editingVehicleId) {
        const {data,error} = await supabase.from('work_vehicles').update({vehicle_number:number,updated_at:new Date().toISOString()}).eq('id',editingVehicleId).select('id,vehicle_number,created_at').single();
        if (error) throw error;
        setVehicles(prev=>prev.map(v=>v.id===editingVehicleId?data as VehicleRow:v).sort((a,b)=>a.vehicle_number.localeCompare(b.vehicle_number,'ko')));
        setEditingVehicleId(''); notify('차량번호를 수정했습니다.');
      } else {
        const {data,error} = await supabase.from('work_vehicles').insert({vehicle_number:number}).select('id,vehicle_number,created_at').single();
        if (error) throw error;
        setVehicles(prev=>[...prev,data as VehicleRow].sort((a,b)=>a.vehicle_number.localeCompare(b.vehicle_number,'ko')));
        setActiveVehicleId((data as VehicleRow).id); notify('차량을 등록했습니다.');
      }
      setVehicleInput('');
    } catch (error:any) { showCustomAlert('차량 저장 오류', `차량 저장에 실패했습니다.\n${error?.message || ''}`); }
    finally { setSaving(false); }
  };

  const deleteVehicle = (vehicle: VehicleRow) => {
    if (!isAdmin) { showCustomAlert('권한 제한','관리자만 차량을 삭제할 수 있습니다.'); return; }
    if (usageRows.some(row=>row.vehicle_id===vehicle.id)) { showCustomAlert('차량 삭제 제한','이 차량의 사용 이력이 남아 있습니다. 이력 삭제 후 차량을 삭제할 수 있습니다.'); return; }
    showCustomConfirm('차량 삭제', `${vehicle.vehicle_number} 차량을 삭제하시겠습니까?`, async () => {
      const {error} = await supabase.from('work_vehicles').delete().eq('id',vehicle.id);
      if (error) { showCustomAlert('삭제 오류',error.message); return; }
      setVehicles(prev=>prev.filter(v=>v.id!==vehicle.id));
      setActiveVehicleId(prev=>prev===vehicle.id?'':prev);
      notify('차량을 삭제했습니다.');
    });
  };

  const openUsage = () => {
    if (vehicles.length === 0) { showCustomAlert('차량 선택','먼저 관리자에게 차량 등록을 요청해주세요.'); return; }
    if (!currentIsEligible) { showCustomAlert('차량 사용 제한','CERT의 YARD 자격에 작업용차량운전자교육이 등록된 인원만 차량을 사용할 수 있습니다.'); return; }
    if (!currentName) { showCustomAlert('사용자 확인','로그인 사용자 이름을 확인할 수 없습니다.'); return; }
    const now = new Date();
    setUsageForm({used_at:`${formatDateToYYYYMMDD(now)}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`,mileage:'',destination:'',purpose:'',maintenance_start_date:'',maintenance_end_date:''});
    setUsageModalOpen(true);
  };

  const saveUsage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedVehicle || !currentUser) { notify('사용창에서 차량번호를 선택해주세요.','warning'); return; }
    if (!currentIsEligible) { showCustomAlert('차량 사용 제한','작업용차량운전자교육 자격이 확인되지 않습니다.'); return; }
    if (!usageForm.used_at || !usageForm.destination.trim() || !usageForm.purpose.trim()) { notify('사용시간, 이동장소, 사용목적을 입력해주세요.','warning'); return; }
    const maintenance = /정비|수리/.test(usageForm.purpose);
    const hasAnyPeriod = !!(usageForm.maintenance_start_date || usageForm.maintenance_end_date);
    if ((maintenance || hasAnyPeriod) && (!usageForm.maintenance_start_date || !usageForm.maintenance_end_date)) { notify('기간을 입력할 경우 시작일과 종료일을 모두 선택해주세요. 정비 또는 수리 목적이면 기간 입력이 필수입니다.','warning'); return; }
    if (usageForm.maintenance_start_date && usageForm.maintenance_end_date && usageForm.maintenance_end_date < usageForm.maintenance_start_date) { notify('기간 종료일은 시작일보다 빠를 수 없습니다.','warning'); return; }
    setSaving(true);
    try {
      const payload = {
        vehicle_id:selectedVehicle.id, vehicle_number:selectedVehicle.vehicle_number,
        user_id:currentId || null, user_name:currentName,
        used_at:new Date(usageForm.used_at).toISOString(),
        mileage:usageForm.mileage.trim()===''?null:Number(usageForm.mileage),
        destination:usageForm.destination.trim(), purpose:usageForm.purpose.trim(),
        maintenance_start_date:usageForm.maintenance_start_date || null,
        maintenance_end_date:usageForm.maintenance_end_date || null,
        is_parked:false, parking_remarks:null
      };
      const {data,error} = await supabase.from('work_vehicle_usage').insert(payload).select('id, vehicle_id, vehicle_number, user_id, user_name, used_at, mileage, destination, purpose, maintenance_start_date, maintenance_end_date, is_parked, parking_remarks, parking_updated_by_id, parking_updated_by_name, created_at').single();
      if (error) throw error;
      setUsageRows(prev=>[data as VehicleUsageRow,...prev]);
      setUsageModalOpen(false); notify('차량 사용 내역을 등록했습니다.');
    } catch (error:any) { showCustomAlert('차량 사용 등록 오류',`저장에 실패했습니다.\n${error?.message || ''}`); }
    finally { setSaving(false); }
  };

  const deleteUsageSelected = () => {
    if (!isAdmin) { showCustomAlert('권한 제한','관리자만 사용 이력을 삭제할 수 있습니다.'); return; }
    const ids = visibleUsage.filter(row=>selectedUsageIds.includes(row.id)).map(row=>row.id);
    if (!ids.length) { notify('삭제할 사용 이력을 선택해주세요.','warning'); return; }
    showCustomConfirm('사용 이력 일괄 삭제',`선택한 ${ids.length}건의 차량 사용 이력을 삭제하시겠습니까?`,async()=>{
      const {error} = await supabase.from('work_vehicle_usage').delete().in('id',ids);
      if (error) {showCustomAlert('이력 삭제 오류',error.message);return;}
      setUsageRows(prev=>prev.filter(row=>!ids.includes(row.id))); setSelectedUsageIds(prev=>prev.filter(id=>!ids.includes(id)));
      notify(`선택한 ${ids.length}건을 삭제했습니다.`);
    });
  };

  const saveParking = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!parkingRow) return;
    if (!canEditParking(parkingRow)) { showCustomAlert('권한 제한','해당 차량 사용 당사자 또는 관리자만 주차 비고를 등록·수정할 수 있습니다.'); return; }
    setSaving(true);
    try {
      const patch = {is_parked:true, parking_remarks:parkingRemarks.trim() || null, parking_updated_by_id:currentId || null, parking_updated_by_name:currentName || null, updated_at:new Date().toISOString()};
      const {data,error} = await supabase.from('work_vehicle_usage').update(patch).eq('id',parkingRow.id).select('id, vehicle_id, vehicle_number, user_id, user_name, used_at, mileage, destination, purpose, maintenance_start_date, maintenance_end_date, is_parked, parking_remarks, parking_updated_by_id, parking_updated_by_name, created_at').single();
      if (error) throw error;
      setUsageRows(prev=>prev.map(row=>row.id===parkingRow.id?data as VehicleUsageRow:row));
      setParkingRow(null); setParkingRemarks(''); notify('주차 상태와 비고를 저장했습니다.');
    } catch (error:any) {showCustomAlert('주차 비고 저장 오류',`저장에 실패했습니다.\n${error?.message || ''}`);}
    finally {setSaving(false);}
  };

  return <div className="space-y-3 p-2 sm:p-3">
    {notice && <div role="status" className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-xs ${notice.type==='error'?'border-red-200 bg-red-50 text-red-700':notice.type==='warning'?'border-amber-200 bg-amber-50 text-amber-800':'border-emerald-200 bg-emerald-50 text-emerald-700'}`}><span className="whitespace-pre-wrap">{notice.message}</span><button type="button" onClick={()=>setNotice(null)} aria-label="알림 닫기"><X className="h-3.5 w-3.5"/></button></div>}
    <div className="rounded-xl border border-[#E2E5E9] bg-white p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="text-sm font-bold text-[#243B5A]">차량 관리</h3><p className="mt-0.5 text-[11px] text-[#64748B]">차량번호별 사용 이력과 주차 비고를 관리합니다.</p></div>
        {isAdmin && <button type="button" onClick={()=>setManagerOpen(true)} className="flex items-center gap-1 rounded-lg border border-[#E2E5E9] bg-[#F5F6F8] px-3 py-2 text-xs font-bold text-[#243B5A] hover:bg-[#EEF2F7] transition-colors"><Settings className="h-3.5 w-3.5"/> 차량 등록·수정·삭제</button>}
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#E2E5E9] bg-[#F5F6F8] p-2">
        <span className="shrink-0 text-xs font-bold text-[#64748B]">차량번호</span>
        {vehicles.map(vehicle=><button key={vehicle.id} type="button" onClick={()=>{setActiveVehicleId(vehicle.id);setSelectedUsageIds([]);}} className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${activeVehicleId===vehicle.id?'border-[#243B5A] bg-[#243B5A] text-white':'border-[#E2E5E9] bg-white text-[#243B5A] hover:bg-[#EEF2F7]'}`}>{vehicle.vehicle_number}</button>)}
        {vehicles.length===0 && <span className="text-xs text-[#64748B]">등록된 차량이 없습니다. 관리자에게 차량 등록을 요청해주세요.</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={!selectedVehicle || !currentIsEligible || saving} onClick={openUsage} className="flex items-center gap-1.5 rounded-lg bg-[#243B5A] px-3.5 py-2 text-xs font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[#1B2F49]"><Plus className="h-3.5 w-3.5"/> 차량 사용</button>
        <span className={`text-[11px] ${currentIsEligible?'text-emerald-700 font-medium':'text-[#64748B]'}`}>{currentIsEligible?'작업용차량운전자교육 확인됨':'CERT YARD 자격에 작업용차량운전자교육이 있어야 사용 가능'}</span>
        <button type="button" onClick={()=>void loadVehicleData()} disabled={loading} className="ml-auto rounded-lg border border-[#E2E5E9] bg-white px-3 py-2 text-xs font-semibold text-[#243B5A] hover:bg-[#F5F6F8] transition-colors disabled:opacity-50"><span className="inline-flex items-center gap-1"><CalendarIcon className="h-3.5 w-3.5"/> {loading?'조회 중':'새로고침'}</span></button>
      </div>
    </div>
    <div className="rounded-xl border border-[#E2E5E9] bg-white p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="text-sm font-bold text-[#243B5A]">최근 사용 내역 · 전체 차량</h3><p className="text-[11px] text-[#64748B]">모든 차량의 사용 내역을 날짜순으로 함께 표시합니다. 주차 버튼을 누르면 비고를 등록할 수 있습니다.</p></div>
        {isAdmin && <div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-1.5 text-xs font-semibold text-[#243B5A] cursor-pointer"><input type="checkbox" checked={visibleUsage.length>0 && visibleUsage.every(row=>selectedUsageIds.includes(row.id))} onChange={e=>setSelectedUsageIds(prev=>e.target.checked?Array.from(new Set([...prev,...visibleUsage.map(r=>r.id)])):prev.filter(id=>!visibleUsage.some(r=>r.id===id)))} className="accent-[#243B5A]"/> 전체 선택</label><span className="text-xs text-[#64748B]">{selectedUsageIds.filter(id=>visibleUsage.some(r=>r.id===id)).length}건 선택</span><button type="button" onClick={deleteUsageSelected} className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors"><Trash2 className="h-3.5 w-3.5"/> 선택 삭제</button></div>}
      </div>
      {loading ? <div className="py-10 text-center text-xs text-[#64748B]">차량 정보를 불러오는 중...</div> : visibleUsage.length===0 ? <div className="rounded-lg border border-dashed border-[#E2E5E9] py-10 text-center text-xs text-[#64748B]">최근 사용 내역이 없습니다.</div> :
        <div className="space-y-2">
          {visibleUsage.map(row=><div key={row.id} className="rounded-xl border border-[#E2E5E9] bg-[#FCFCFD] p-3">
            <div className="flex items-start gap-2">
              {isAdmin && <input type="checkbox" checked={selectedUsageIds.includes(row.id)} onChange={e=>setSelectedUsageIds(prev=>e.target.checked?[...prev,row.id]:prev.filter(id=>id!==row.id))} className="mt-1 accent-[#243B5A]" aria-label={`${row.user_name} 사용 이력 선택`}/>}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-[#EEF2F7] px-2 py-0.5 text-[10px] font-bold text-[#243B5A]">{row.vehicle_number}</span><span className="text-xs font-bold text-[#243B5A]">{row.user_name}</span><span className="text-[11px] text-[#64748B]">{new Date(row.used_at).toLocaleString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</span><span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${row.is_parked?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-800'}`}>{row.is_parked?'주차 등록':'주차 미등록'}</span></div>
                <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                  <div><span className="text-[#64748B]">이동장소: </span><span className="font-medium">{row.destination}</span></div>
                  <div><span className="text-[#64748B]">사용목적: </span><span className="font-medium">{row.purpose}</span></div>
                  <div><span className="text-[#64748B]">운행거리: </span><span>{row.mileage==null?'미입력':`${row.mileage} km`}</span></div>
                  {(row.maintenance_start_date || row.maintenance_end_date) && <div><span className="text-[#64748B]">정비/수리 기간: </span><span>{row.maintenance_start_date || '-'} ~ {row.maintenance_end_date || '-'}</span></div>}
                </div>
                {row.parking_remarks && <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/70 px-2.5 py-2 text-xs"><span className="font-bold text-amber-900">주차 비고: </span><span className="whitespace-pre-wrap break-words">{row.parking_remarks}</span>{row.parking_updated_by_name && <div className="mt-1 text-[10px] text-amber-800">작성: {row.parking_updated_by_name}</div>}</div>}
              </div>
              <button type="button" onClick={()=>{setParkingRow(row);setParkingRemarks(row.parking_remarks||'');}} disabled={!canEditParking(row)} className="shrink-0 rounded-lg border border-[#E2E5E9] bg-white px-2.5 py-2 text-xs font-bold text-[#243B5A] hover:bg-[#F5F6F8] transition-colors disabled:cursor-not-allowed disabled:opacity-40">주차 / 비고</button>
            </div>
          </div>)}
        </div>}
    </div>

    {managerOpen && isAdmin && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/25 p-4" onClick={()=>setManagerOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="차량 관리" onClick={e=>e.stopPropagation()} className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#E2E5E9] bg-white p-4 shadow-[0_12px_32px_rgba(15,23,42,0.18)] space-y-4">
        <div className="flex items-center justify-between border-b border-[#E2E5E9] pb-3"><h3 className="text-sm font-bold text-[#243B5A]">차량 등록 · 수정 · 삭제</h3><button type="button" onClick={()=>setManagerOpen(false)} className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F5F6F8]"><X className="h-4 w-4"/></button></div>
        <div className="flex gap-2"><input value={vehicleInput} onChange={e=>setVehicleInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void saveVehicle();}}} placeholder="차량번호 입력 (예: 12가3456)" className={inputClass}/><button type="button" disabled={saving} onClick={()=>void saveVehicle()} className="rounded-lg bg-[#243B5A] px-3 py-2 text-xs font-bold text-white hover:bg-[#1B2F49] transition-colors disabled:opacity-50">{editingVehicleId?'수정 저장':'차량 추가'}</button>{editingVehicleId && <button type="button" onClick={()=>{setEditingVehicleId('');setVehicleInput('');}} className="rounded-lg border px-3 py-2 text-xs hover:bg-[#F5F6F8]">취소</button>}</div>
        <div className="space-y-2">{vehicles.map(vehicle=><div key={vehicle.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#E2E5E9] px-3 py-2"><span className="text-xs font-bold text-[#1F2937]">{vehicle.vehicle_number}</span><div className="flex gap-1"><button type="button" onClick={()=>{setEditingVehicleId(vehicle.id);setVehicleInput(vehicle.vehicle_number);}} className="rounded-lg border border-[#E2E5E9] p-2 text-[#243B5A] hover:bg-[#F5F6F8]" aria-label={`${vehicle.vehicle_number} 수정`}><Pencil className="h-3.5 w-3.5"/></button><button type="button" onClick={()=>deleteVehicle(vehicle)} className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50" aria-label={`${vehicle.vehicle_number} 삭제`}><Trash2 className="h-3.5 w-3.5"/></button></div></div>)}</div>
      </div>
    </div>}

    {usageModalOpen && vehicles.length > 0 && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/25 p-4" onClick={()=>setUsageModalOpen(false)}>
      <form onSubmit={saveUsage} onClick={e=>e.stopPropagation()} className="max-h-[90dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-[#E2E5E9] bg-white p-4 shadow-[0_12px_32px_rgba(15,23,42,0.18)] text-[#1F2937]">
        <div className="flex items-center justify-between border-b border-[#E2E5E9] pb-3"><div><h3 className="text-sm font-bold text-[#243B5A]">차량 사용 등록</h3><p className="mt-0.5 text-[11px] text-[#64748B]">사용자: {currentName}</p></div><button type="button" onClick={()=>setUsageModalOpen(false)} className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F5F6F8]"><X className="h-4 w-4"/></button></div>
        <div className="space-y-1">
          <label className="block text-[11px] font-semibold text-[#1F2937]">차량번호 선택</label>
          <AppStyledSelect
            ariaLabel="차량번호 선택"
            value={activeVehicleId}
            onChange={(val) => setActiveVehicleId(val)}
            placeholder="차량을 선택해주세요"
            options={vehicles.map(v => ({ value: v.id, label: v.vehicle_number }))}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CalendarDatePicker
            label="사용 날짜"
            value={usageForm.used_at ? usageForm.used_at.split('T')[0] : ''}
            onChange={date => setUsageForm(p => {
              const time = p.used_at.split('T')[1] || '09:00';
              return { ...p, used_at: date ? `${date}T${time}` : '' };
            })}
          />
          <div className="space-y-1 min-w-0">
            <label className="block text-[11px] font-semibold text-[#1F2937]">사용 시간</label>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
              <CompactTimeSelect
                ariaLabel="사용 시간 시"
                value={(usageForm.used_at && usageForm.used_at.includes('T') ? usageForm.used_at.split('T')[1] : '09:00').split(':')[0] || '09'}
                options={Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0')).map(hour => ({ value: hour, label: `${hour}시` }))}
                onChange={hour => setUsageForm(p => {
                  const date = p.used_at.split('T')[0] || formatDateToYYYYMMDD(new Date());
                  const currentTime = p.used_at.split('T')[1] || '09:00';
                  const minute = currentTime.split(':')[1] || '00';
                  return { ...p, used_at: `${date}T${hour}:${minute}` };
                })}
              />
              <span className="text-sm font-bold text-[#64748B]">:</span>
              <CompactTimeSelect
                ariaLabel="사용 시간 분"
                value={(usageForm.used_at && usageForm.used_at.includes('T') ? usageForm.used_at.split('T')[1] : '09:00').split(':')[1] || '00'}
                options={Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0')).map(minute => ({ value: minute, label: `${minute}분` }))}
                onChange={minute => setUsageForm(p => {
                  const date = p.used_at.split('T')[0] || formatDateToYYYYMMDD(new Date());
                  const currentTime = p.used_at.split('T')[1] || '09:00';
                  const hour = currentTime.split(':')[0] || '09';
                  return { ...p, used_at: `${date}T${hour}:${minute}` };
                })}
              />
            </div>
            <p className="text-[10px] text-[#64748B]">시와 분을 선택하세요.</p>
          </div>
        </div>
        <div className="space-y-1"><label className="block text-[11px] font-semibold text-[#1F2937]">운행거리 (km, 선택 입력)</label><input type="number" min="0" step="0.1" value={usageForm.mileage} onChange={e=>setUsageForm(p=>({...p,mileage:e.target.value}))} placeholder="입력하지 않아도 됩니다" className={inputClass}/></div>
        <div className="space-y-1"><label className="block text-[11px] font-semibold text-[#1F2937]">이동장소</label><input value={usageForm.destination} onChange={e=>setUsageForm(p=>({...p,destination:e.target.value}))} required placeholder="이동 장소를 입력해주세요" className={inputClass}/></div>
        <div className="space-y-1"><label className="block text-[11px] font-semibold text-[#1F2937]">사용목적</label><input value={usageForm.purpose} onChange={e=>setUsageForm(p=>({...p,purpose:e.target.value}))} required placeholder="예: 현장 이동, 정비, 수리" className={inputClass}/></div>
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-[#E2E5E9] bg-[#FCFCFD] p-3 sm:grid-cols-2"><CalendarDatePicker label="기간 시작일" value={usageForm.maintenance_start_date} onChange={v=>setUsageForm(p=>({...p,maintenance_start_date:v}))}/><CalendarDatePicker label="기간 종료일" value={usageForm.maintenance_end_date} onChange={v=>setUsageForm(p=>({...p,maintenance_end_date:v}))}/><p className="text-[10px] text-[#64748B] sm:col-span-2">기간은 선택 입력입니다. 사용목적에 정비 또는 수리가 포함되면 반드시 입력해야 합니다.</p></div>
        <div className="flex justify-end gap-2 border-t border-[#E2E5E9] pt-3"><button type="button" onClick={()=>setUsageModalOpen(false)} className="rounded-lg border border-[#E2E5E9] px-3 py-2 text-xs font-semibold hover:bg-[#F5F6F8]">취소</button><button type="submit" disabled={saving} className="rounded-lg bg-[#243B5A] px-4 py-2 text-xs font-bold text-white hover:bg-[#1B2F49] transition-colors disabled:opacity-50">{saving?'저장 중...':'사용 등록'}</button></div>
      </form>
    </div>}

    {parkingRow && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/25 p-4" onClick={()=>setParkingRow(null)}>
      <form onSubmit={saveParking} onClick={e=>e.stopPropagation()} className="w-full max-w-md space-y-4 rounded-2xl border border-[#E2E5E9] bg-white p-4 shadow-[0_12px_32px_rgba(15,23,42,0.18)]">
        <div className="flex items-center justify-between border-b border-[#E2E5E9] pb-3"><div><h3 className="text-sm font-bold text-[#243B5A]">주차 상태 및 비고</h3><p className="mt-0.5 text-[11px] text-[#64748B]">{parkingRow.vehicle_number} · {parkingRow.user_name}</p></div><button type="button" onClick={()=>setParkingRow(null)} className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F5F6F8]"><X className="h-4 w-4"/></button></div>
        <div className="rounded-lg border border-[#E2E5E9] bg-[#F5F6F8] p-3 text-xs"><span className="font-bold text-[#243B5A]">사용 일시: </span>{new Date(parkingRow.used_at).toLocaleString('ko-KR')}</div>
        <div className="space-y-1"><label className="block text-[11px] font-semibold text-[#1F2937]">주차 비고</label><textarea rows={4} value={parkingRemarks} onChange={e=>setParkingRemarks(e.target.value)} placeholder="주차 위치, 차량 상태 등 비고를 입력해주세요." className="w-full resize-y p-3 border border-[#E2E5E9] rounded-lg text-xs bg-[#F5F6F8] outline-none focus:border-[#243B5A] focus:bg-white transition-colors"/></div>
        <div className="flex justify-end gap-2 border-t border-[#E2E5E9] pt-3"><button type="button" onClick={()=>setParkingRow(null)} className="rounded-lg border border-[#E2E5E9] px-3 py-2 text-xs font-semibold hover:bg-[#F5F6F8]">취소</button><button type="submit" disabled={saving || !canEditParking(parkingRow)} className="rounded-lg bg-[#243B5A] px-4 py-2 text-xs font-bold text-white hover:bg-[#1B2F49] transition-colors disabled:opacity-50">{saving?'저장 중...':'주차 비고 저장'}</button></div>
      </form>
    </div>}
  </div>;
}


export default function WorkManagement({ currentUser }: { currentUser?: { id: string; name: string; role: string } | null }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [vessels, setVessels] = useState<CabinVessel[]>([]);
  const [presetTeams, setPresetTeams] = useState<PresetTeam[]>([]);
  const [selectedPresetTeamId, setSelectedPresetTeamId] = useState('');
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [absenceStatusLoaded, setAbsenceStatusLoaded] = useState(false);
  const absenceReconcileInFlightRef = useRef(false);
  const [departments, setDepartments] = useState<string[]>([]);
  const [validUserNames, setValidUserNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
  const [isOffUserModalOpen, setIsOffUserModalOpen] = useState(false);
  const [offUserViewMode, setOffUserViewMode] = useState<'TODAY_TOMORROW' | 'TODAY' | 'TOMORROW' | 'DAY_AFTER_TOMORROW' | 'CUSTOM' | 'RANGE'>('TODAY_TOMORROW');
  const [offUserSelectedDate, setOffUserSelectedDate] = useState<string>(() => formatDateToYYYYMMDD(new Date()));
  const [offUserRangeStartDate, setOffUserRangeStartDate] = useState<string>(() => { const date = new Date(); date.setDate(date.getDate() + 1); return formatDateToYYYYMMDD(date); });
  const [offUserRangeEndDate, setOffUserRangeEndDate] = useState<string>(() => { const date = new Date(); date.setDate(date.getDate() + 2); return formatDateToYYYYMMDD(date); });

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
      const { data, error } = await supabase.from('app_users').select('id, name, department, position, job_title, field, phone, work_status');
      if (error) throw error;
      if (data) {
        const today = formatDateToYYYYMMDD(new Date());
        let absenceRows: any[] = [];
        try {
          const { data: statusData, error: statusError } = await supabase
            .from('user_day_status')
            .select('user_id, status_date')
            .gte('status_date', today);
          if (statusError) throw statusError;
          absenceRows = statusData || [];
        } catch (statusError) {
          console.warn('날짜별 휴무 조회 실패:', statusError);
        }

        const absenceByUser = new Map<string, string[]>();
        absenceRows.forEach((row: any) => {
          const key = String(row.user_id || '');
          const date = String(row.status_date || '').slice(0, 10);
          if (!key || !date) return;
          const dates = absenceByUser.get(key) || [];
          dates.push(date);
          absenceByUser.set(key, dates);
        });
        const usersWithAbsences = data.map((user: any) => ({
          ...user,
          absence_dates: absenceByUser.get(String(user.id || '')) || [],
        }));
        setAppUsers(usersWithAbsences);
        setAbsenceStatusLoaded(true);
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

  const getCurrentTeamMembers = useCallback((team: PresetTeam) => {
    const department = String(team.department || team.name || '').trim().toLowerCase();
    const departmentMembers = appUsers.filter(user => !isFormerAppUser(user) && String(user.department || '').trim().toLowerCase() === department && user.name?.trim());
    if (departmentMembers.length) return Array.from(new Set(departmentMembers.map(user => user.name.trim())));
    return Array.from(new Set((team.members || []).map(name => String(name || '').trim()).filter(Boolean)))
      .filter(name => appUsers.some(user => !isFormerAppUser(user) && user.name.trim().toLowerCase() === name.toLowerCase()));
  }, [appUsers]);

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

  const activeUsers = useMemo(() => appUsers.filter(u => !isFormerEmployee(u)), [appUsers]);
  const todayForUserStatus = formatDateToYYYYMMDD(new Date());
  const workingUsers = useMemo(() => activeUsers.filter(u => !isUserOffOnDate(u, todayForUserStatus)), [activeUsers, todayForUserStatus]);
  const offUsers = useMemo(() => activeUsers.filter(u => isUserOffOnDate(u, todayForUserStatus)), [activeUsers, todayForUserStatus]);
  const activeCabinTasks = useMemo(
    () => tasks.filter(t => t.task_type === 'CABIN' && t.status !== 'COMPLETED'),
    [tasks]
  );
  const cabinDayWorkers = useMemo(
    () => Array.from(new Set(activeCabinTasks.flatMap(t => t.day_workers || []).map(n => n.trim()).filter(Boolean))),
    [activeCabinTasks]
  );
  const cabinNightWorkers = useMemo(
    () => Array.from(new Set(activeCabinTasks.flatMap(t => t.night_workers || []).map(n => n.trim()).filter(Boolean))),
    [activeCabinTasks]
  );
  const cabinAllSet = useMemo(
    () => new Set([...cabinDayWorkers, ...cabinNightWorkers].map(n => n.trim().toLowerCase())),
    [cabinDayWorkers, cabinNightWorkers]
  );
  const processWorkers = useMemo(
    () => workingUsers.filter(u =>
      !cabinAllSet.has((u.name || '').trim().toLowerCase()) &&
      !isOperationsOrManagement(u)
    ),
    [workingUsers, cabinAllSet]
  );
  const unassignedWorkersForForm = useMemo(() => {
    if (formData.task_type !== 'DAILY') return [];
    const date = formData.start_date;
    const slot = formatShortTimeSlot(formData.time_slot);
    const occupied = new Set<string>();
    tasks.forEach(task => {
      if (task.task_type !== 'DAILY' || task.status === 'COMPLETED' || task.start_date !== date) return;
      if (editingTask && task.id === editingTask.id) return;
      const existingSlot = formatShortTimeSlot(task.time_slot);
      if (!(slot === '종일' || existingSlot === '종일' || slot === existingSlot)) return;
      (task.assigned_names || []).forEach(name => occupied.add(name.trim().toLowerCase()));
    });
    return processWorkers.map(user => user.name.trim()).filter(name =>
      name && !occupied.has(name.toLowerCase()) &&
      !assignedList.some(assigned => assigned.trim().toLowerCase() === name.toLowerCase())
    );
  }, [formData.task_type, formData.start_date, formData.time_slot, tasks, editingTask, processWorkers, assignedList]);

  useEffect(() => {
    fetchAppUsers();
    fetchVessels();
    fetchTeams();
  }, [fetchAppUsers, fetchVessels, fetchTeams]);

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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_day_status' },
        () => {
          void fetchAppUsers();
        }
      )
      .subscribe();

    const refreshAbsencesWhenVisible = () => {
      if (document.visibilityState === 'visible') void fetchAppUsers();
    };
    window.addEventListener('focus', refreshAbsencesWhenVisible);
    document.addEventListener('visibilitychange', refreshAbsencesWhenVisible);

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      window.removeEventListener('focus', refreshAbsencesWhenVisible);
      document.removeEventListener('visibilitychange', refreshAbsencesWhenVisible);
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!absenceStatusLoaded || isLoading || absenceReconcileInFlightRef.current) return;
    const today = formatDateToYYYYMMDD(new Date());
    const candidates = tasks.filter(task =>
      task.task_type === 'DAILY' &&
      task.status !== 'COMPLETED' &&
      task.start_date >= today &&
      (task.assigned_names || []).some(name => {
        const user = appUsers.find(item => item.name?.trim().toLowerCase() === name.trim().toLowerCase());
        return isUserOffOnDate(user, task.start_date);
      })
    );
    if (!candidates.length) return;

    absenceReconcileInFlightRef.current = true;
    void (async () => {
      const changedTasks: Task[] = [];
      const excludedNames = new Set<string>();
      try {
        for (const task of candidates) {
          const originalNames = task.assigned_names || [];
          const removedNames = originalNames.filter(name => {
            const user = appUsers.find(item => item.name?.trim().toLowerCase() === name.trim().toLowerCase());
            return isUserOffOnDate(user, task.start_date);
          });
          const nextNames = originalNames.filter(name => {
            const user = appUsers.find(item => item.name?.trim().toLowerCase() === name.trim().toLowerCase());
            return !isUserOffOnDate(user, task.start_date);
          });
          if (nextNames.length === originalNames.length) continue;
          const { error } = await supabase.from('tasks').update({ assigned_names: nextNames }).eq('id', task.id).neq('status', 'COMPLETED');
          if (error) {
            console.error('휴무자 업무 배정 자동 제외 실패:', task.id, error);
            continue;
          }
          removedNames.forEach(name => excludedNames.add(name));
          changedTasks.push({ ...task, assigned_names: nextNames });
        }
        if (changedTasks.length) {
          setTasks(prev => prev.map(task => changedTasks.find(changed => changed.id === task.id) || task));
          showCustomAlert('휴무자 자동 제외', `${Array.from(excludedNames).join(', ')}는 휴무자로 업무에서 제외되었습니다.`);
        }
      } finally {
        absenceReconcileInFlightRef.current = false;
      }
    })();
  }, [absenceStatusLoaded, isLoading, tasks, appUsers, showCustomAlert]);

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
    const requestedType: 'DAILY' | 'DAILY_OTHER' | 'WEEKLY' | 'CABIN' = defaultType || (taskTab === 'VEHICLE' ? 'DAILY' : taskTab);
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
    const names = Array.from(new Set(singleWorkerInput.split(',').map(name => name.trim()).filter(Boolean)));
    if (names.length === 0) return;

    const accepted: string[] = [];
    const rejected: string[] = [];

    for (const name of names) {
      const alreadyAdded = target === 'ASSIGNED' ? assignedList.includes(name)
        : target === 'DAY' ? dayWorkerList.includes(name) : nightWorkerList.includes(name);
      if (alreadyAdded) continue;

      const foundUser = appUsers.find(u => u.name?.trim().toLowerCase() === name.toLowerCase());
      if (isUserOffOnDate(foundUser, formData.start_date)) {
        rejected.push(`${name}(휴무)`);
        continue;
      }

      let cabinConflict = '';
      if (formData.task_type === 'DAILY' && target === 'ASSIGNED') {
        for (const task of tasks) {
          const cabinDateMatches = formData.start_date >= task.start_date && formData.start_date <= (task.end_date || task.start_date);
          if (task.task_type === 'CABIN' && task.status !== 'COMPLETED' && cabinDateMatches) {
            const isDay = (task.day_workers || []).some(worker => worker.trim().toLowerCase() === name.toLowerCase());
            const isNight = (task.night_workers || []).some(worker => worker.trim().toLowerCase() === name.toLowerCase());
            if (isDay) { cabinConflict = 'CABIN 주간'; break; }
            if (isNight) { cabinConflict = 'CABIN 야간'; break; }
          }
        }
      }
      if (cabinConflict) {
        showCustomConfirm('CABIN 근무자 확인', `${name} 는 Cabin 근무자 입니다. 일일업무에 등록하시겠습니까?`, () => {
          setAssignedList(prev => Array.from(new Set([...prev, name])));
        });
        continue;
      }
      accepted.push(name);
    }

    if (target === 'ASSIGNED' && accepted.length) setAssignedList(prev => Array.from(new Set([...prev, ...accepted])));
    if (target === 'DAY' && accepted.length) setDayWorkerList(prev => Array.from(new Set([...prev, ...accepted])));
    if (target === 'NIGHT' && accepted.length) setNightWorkerList(prev => Array.from(new Set([...prev, ...accepted])));
    setSingleWorkerInput('');
    if (rejected.length) showCustomAlert('일부 인원 제외', `다음 인원은 추가하지 않았습니다: ${rejected.join(', ')}`);
  }, [singleWorkerInput, assignedList, dayWorkerList, nightWorkerList, appUsers, showCustomAlert, showCustomConfirm, formData.task_type, formData.start_date, tasks]);

  const handleAddPresetTeamToTask = useCallback(() => {
    const team = presetTeams.find(item => item.id === selectedPresetTeamId);
    if (!team) {
      showCustomAlert('Team 선택', '추가할 Team을 먼저 선택해주세요.');
      return;
    }
    const names = getCurrentTeamMembers(team);
    if (!names.length) {
      showCustomAlert('Team 인원 없음', `“${team.name}”에 등록된 구성원이 없습니다.`);
      return;
    }

    const accepted: string[] = [];
    const rejected: string[] = [];
    for (const name of names) {
      if (assignedList.some(existing => existing.toLowerCase() === name.toLowerCase()) || accepted.some(existing => existing.toLowerCase() === name.toLowerCase())) continue;
      const foundUser = appUsers.find(user => user.name?.trim().toLowerCase() === name.toLowerCase());
      if (isUserOffOnDate(foundUser, formData.start_date)) {
        rejected.push(`${name}(휴무)`);
        continue;
      }
      let cabinConflict = '';
      if (formData.task_type === 'DAILY') {
        for (const task of tasks) {
          const cabinDateMatches = formData.start_date >= task.start_date && formData.start_date <= (task.end_date || task.start_date);
          if (task.task_type === 'CABIN' && task.status !== 'COMPLETED' && cabinDateMatches) {
            if ((task.day_workers || []).some(worker => worker.trim().toLowerCase() === name.toLowerCase())) { cabinConflict = 'CABIN 주간'; break; }
            if ((task.night_workers || []).some(worker => worker.trim().toLowerCase() === name.toLowerCase())) { cabinConflict = 'CABIN 야간'; break; }
          }
        }
      }
      if (cabinConflict) {
        showCustomConfirm('CABIN 근무자 확인', `${name} 는 Cabin 근무자 입니다. 일일업무에 등록하시겠습니까?`, () => {
          setAssignedList(prev => Array.from(new Set([...prev, name])));
        });
        continue;
      }
      accepted.push(name);
    }
    if (accepted.length) setAssignedList(prev => Array.from(new Set([...prev, ...accepted])));
    setSelectedPresetTeamId('');
    if (rejected.length) showCustomAlert('Team 추가 완료', `Team “${team.name}”의 ${accepted.length}명이 추가되었습니다.`);
    else if (accepted.length) showCustomAlert('Team 추가 완료', `Team “${team.name}”의 ${accepted.length}명이 추가되었습니다.`);
    else showCustomAlert('추가할 인원 없음', '선택한 Team의 구성원은 이미 모두 추가되어 있습니다.');
  }, [presetTeams, selectedPresetTeamId, assignedList, appUsers, formData.task_type, formData.start_date, tasks, showCustomAlert, showCustomConfirm, getCurrentTeamMembers]);

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
      if (u !== undefined && isUserOffOnDate(u, formData.start_date)) {
        showCustomAlert('업무 등록 제한', `${u?.name || wName} 휴무입니다.`);
        return;
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
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= 3) return;
      row.eachCell((cell) => {
        cell.font = { ...(cell.font || {}), size: 9 };
        cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
      });
    });
    worksheet.columns.forEach((column) => {
      let maxLength = String(column.header || '').length;
      column.eachCell?.({ includeEmpty: true }, (cell: any) => {
        const text = String(cell.value ?? '');
        maxLength = Math.max(maxLength, ...text.split('\\n').map(part => part.length));
      });
      column.width = Math.min(60, Math.max(10, maxLength + 2));
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
        dateCell.font = { bold: true, color: { argb: dayIndex === 5 ? 'FF1D4ED8' : dayIndex === 6 ? 'FFDC2626' : inMonth ? 'FF1F2937' : 'FF9CA3AF' } };
        dateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
        dateCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        
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
    worksheet.eachRow((row, rowNumber) => {
      // 날짜 행은 연한 파란색 채우기를 유지하고, 업무 내용 행은 9pt/위쪽·왼쪽 정렬로 적용
      if (rowNumber <= 2 || rowNumber % 2 !== 0) return;
      row.eachCell((cell) => {
        if (cell.value !== null && cell.value !== undefined && String(cell.value).trim() !== '') {
          cell.font = { ...(cell.font || {}), size: 9 };
          cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
        }
      });
    });
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

  const handleBulkDeleteTasks = useCallback(() => {
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
                <p className="text-[11px] sm:text-xs text-[#64748B]">일일 · 주간 · CABIN 업무 및 차량 관리</p>
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

              {taskTab !== 'VEHICLE' && (isAdmin || (taskTab === 'DAILY' && dailySubTab === 'OTHER')) && (
                <button
                  onClick={() => handleOpenCreateModal(undefined, taskTab === 'DAILY' && dailySubTab === 'OTHER' ? 'DAILY_OTHER' : undefined)}
                  className="flex items-center space-x-1 bg-[#243B5A] text-white px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg text-xs font-semibold shadow-xs shrink-0 hover:bg-[#1B2F49] transition-colors"
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

        {taskTab === 'VEHICLE' ? (
          <VehicleManagementPanel currentUser={currentUser} isAdmin={isAdmin} showCustomAlert={showCustomAlert} showCustomConfirm={showCustomConfirm} />
        ) : (
          <>
        {(() => {
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

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E2E5E9] pt-1.5">
                <div className="flex min-w-0 flex-wrap items-center gap-1 text-[11px] text-[#64748B]">
                  <span className="font-semibold text-[#1F2937]">휴무자 명단:</span>
                  {offUsers.length > 0 ? (
                    <span className="text-blue-700 font-medium">{offUsers.map(u => u.name).join(', ')}</span>
                  ) : (
                    <span>없음</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setOffUserViewMode('TODAY_TOMORROW'); setOffUserSelectedDate(todayForUserStatus); setIsOffUserModalOpen(true); }}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#243B5A] bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#243B5A] transition-colors hover:bg-[#F5F6F8]"
                >
                  <CalendarIcon className="h-3.5 w-3.5" /> 휴무자 조회
                </button>
              </div>
            </div>
          );
        })()}

        {isOffUserModalOpen && (() => {
          const today = todayForUserStatus;
          const tomorrowDate = new Date();
          tomorrowDate.setDate(tomorrowDate.getDate() + 1);
          const tomorrow = formatDateToYYYYMMDD(tomorrowDate);
          const dayAfterTomorrowDate = new Date();
          dayAfterTomorrowDate.setDate(dayAfterTomorrowDate.getDate() + 2);
          const dayAfterTomorrow = formatDateToYYYYMMDD(dayAfterTomorrowDate);
          const datesToShow = offUserViewMode === 'TODAY_TOMORROW'
            ? [tomorrow, dayAfterTomorrow]
            : offUserViewMode === 'TODAY'
              ? [today]
              : offUserViewMode === 'TOMORROW'
                ? [tomorrow]
                : offUserViewMode === 'DAY_AFTER_TOMORROW'
                  ? [dayAfterTomorrow]
                  : offUserViewMode === 'RANGE'
                    ? (() => {
                        if (!offUserRangeStartDate || !offUserRangeEndDate || offUserRangeStartDate > offUserRangeEndDate) return [];
                        const dates: string[] = [];
                        const cursor = new Date(`${offUserRangeStartDate}T00:00:00`);
                        const end = new Date(`${offUserRangeEndDate}T00:00:00`);
                        while (cursor <= end && dates.length < 366) {
                          dates.push(formatDateToYYYYMMDD(cursor));
                          cursor.setDate(cursor.getDate() + 1);
                        }
                        return dates;
                      })()
                    : offUserSelectedDate
                      ? [offUserSelectedDate]
                      : [];
          const formatKoreanDate = (date: string) => {
            const parsed = new Date(`${date}T00:00:00`);
            const weekday = ['일', '월', '화', '수', '목', '금', '토'][parsed.getDay()];
            return `${parsed.getFullYear()}년 ${parsed.getMonth() + 1}월 ${parsed.getDate()}일 (${weekday})`;
          };
          return (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/30 p-3 sm:p-4" onClick={() => setIsOffUserModalOpen(false)}>
              <div role="dialog" aria-modal="true" aria-label="휴무자 조회" onClick={event => event.stopPropagation()} className="flex max-h-[min(88dvh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#E2E5E9] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.2)]">
                <div className="flex items-center justify-between gap-3 border-b border-[#E2E5E9] bg-[#F8FAFC] px-4 py-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#243B5A]">휴무자 조회</h3>
                    <p className="mt-0.5 text-[11px] text-[#64748B]">날짜별로 휴무 등록된 인원을 확인합니다.</p>
                  </div>
                  <button type="button" onClick={() => setIsOffUserModalOpen(false)} className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#E2E8F0]" aria-label="휴무자 조회 닫기"><X className="h-4 w-4" /></button>
                </div>
                <div className="space-y-3 overflow-y-auto p-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="min-w-0 space-y-1">
                      <label className="block text-[11px] font-semibold text-[#1F2937]">조회 범위</label>
                      <AppStyledSelect
                        ariaLabel="휴무자 조회 범위 선택"
                        value={offUserViewMode}
                        onChange={(value) => setOffUserViewMode(value as 'TODAY_TOMORROW' | 'TODAY' | 'TOMORROW' | 'DAY_AFTER_TOMORROW' | 'CUSTOM' | 'RANGE')}
                        options={[
                          { value: 'TODAY_TOMORROW', label: '내일 + 모레' },
                          { value: 'TODAY', label: '오늘 휴무자' },
                          { value: 'TOMORROW', label: '내일 휴무자' },
                          { value: 'DAY_AFTER_TOMORROW', label: '모레 휴무자' },
                          { value: 'CUSTOM', label: '하루 날짜 선택' },
                          { value: 'RANGE', label: '기간 선택 (시작일 ~ 종료일)' },
                        ]}
                        className="h-9 w-full rounded-lg border border-[#E2E5E9] bg-white px-3 text-xs font-semibold text-[#243B5A] outline-none transition-colors focus:border-[#243B5A]"
                      />
                    </div>
                    {offUserViewMode === 'RANGE' ? (
                      <>
                        <div className="min-w-0">
                          <CalendarDatePicker
                            label="시작일"
                            value={offUserRangeStartDate}
                            onChange={setOffUserRangeStartDate}
                            className="h-9 rounded-lg border border-[#E2E5E9] bg-white px-3 text-xs text-[#1F2937] outline-none focus:border-[#243B5A]"
                          />
                        </div>
                        <div className="min-w-0">
                          <CalendarDatePicker
                            label="종료일"
                            value={offUserRangeEndDate}
                            onChange={setOffUserRangeEndDate}
                            className="h-9 rounded-lg border border-[#E2E5E9] bg-white px-3 text-xs text-[#1F2937] outline-none focus:border-[#243B5A]"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="min-w-0">
                        <CalendarDatePicker
                          label="조회 날짜"
                          value={offUserSelectedDate}
                          onChange={(date) => { setOffUserSelectedDate(date); setOffUserViewMode('CUSTOM'); }}
                          className="h-9 rounded-lg border border-[#E2E5E9] bg-white px-3 text-xs text-[#1F2937] outline-none focus:border-[#243B5A]"
                        />
                      </div>
                    )}
                  </div>
                  {offUserViewMode === 'RANGE' && offUserRangeStartDate > offUserRangeEndDate && (
                    <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">종료일은 시작일보다 빠를 수 없습니다.</p>
                  )}
                  {offUserViewMode === 'RANGE' && datesToShow.length === 0 && offUserRangeStartDate <= offUserRangeEndDate && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">조회할 기간을 선택해 주세요.</p>
                  )}
                  {datesToShow.map(date => {
                    const people = activeUsers.filter(user => isUserOffOnDate(user, date)).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
                    const dateLabel = date === today ? '오늘' : date === tomorrow ? '내일' : date === dayAfterTomorrow ? '모레' : '조회 날짜';
                    return (
                      <section key={date} className="overflow-hidden rounded-xl border border-[#E2E5E9]">
                        <div className="flex items-center justify-between gap-2 bg-[#F8FAFC] px-3 py-2">
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#243B5A]">{dateLabel} · {formatKoreanDate(date)}</div>
                          </div>
                          <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">{people.length}명</span>
                        </div>
                        <div className="p-3">
                          {people.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {people.map(user => <span key={user.id || user.name} className="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-800">{user.name}</span>)}
                            </div>
                          ) : <p className="text-xs text-[#64748B]">등록된 휴무자가 없습니다.</p>}
                        </div>
                      </section>
                    );
                  })}
                </div>
                <div className="flex justify-end border-t border-[#E2E5E9] bg-white px-4 py-3">
                  <button type="button" onClick={() => setIsOffUserModalOpen(false)} className="rounded-lg bg-[#243B5A] px-4 py-2 text-xs font-bold text-white hover:bg-[#1B2F49]">닫기</button>
                </div>
              </div>
            </div>
          );
        })()}

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

        {taskTab === 'CABIN' && (
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-[#E2E5E9] bg-[#F5F6F8] p-2">
            <Tag className="h-3.5 w-3.5 shrink-0 text-[#64748B]" />
            <label htmlFor="cabin-vessel-filter" className="shrink-0 text-xs font-bold text-[#1F2937]">호선</label>
            <div className="min-w-0 flex-1">
              <AppStyledSelect
                ariaLabel="CABIN 호선 선택"
                value={cabinSubTab}
                onChange={setCabinSubTab}
                options={[{ value: 'ALL', label: '전체 호선' }, ...vessels.map(v => ({ value: v.name, label: v.name }))]}
                className="h-9 w-full rounded-lg border border-[#E2E5E9] bg-white px-3 text-xs font-semibold text-[#243B5A] outline-none transition-colors focus:border-[#243B5A]"
              />
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsVesselManagerOpen(true)}
                className="flex h-9 shrink-0 items-center gap-1 rounded-lg border border-[#E2E5E9] bg-white px-2.5 text-xs font-semibold text-[#243B5A] transition-colors hover:bg-slate-50"
              >
                <Settings className="h-3.5 w-3.5" />
                <span>호선 관리</span>
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
              <button onClick={() => handleOpenCreateModal(undefined, 'CABIN', cabinSubTab)} className="px-2.5 py-1 bg-[#243B5A] text-white rounded-lg text-xs font-semibold shrink-0 ml-1 hover:bg-[#1B2F49] transition-colors">
                등록
              </button>
            )}
          </div>
        )}

        {(taskTab === 'WEEKLY' || (taskTab === 'DAILY' && dailySubTab === 'HISTORY') || taskTab === 'CABIN') && isAdmin && (
          <div className="flex flex-wrap items-center gap-2 bg-white border border-[#E2E5E9] rounded-xl p-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-[#243B5A] cursor-pointer">
              <input type="checkbox" checked={filteredTasks.length > 0 && filteredTasks.every((task) => selectedTaskIds.includes(task.id))} onChange={(e) => handleSelectAllVisible(e.target.checked)} className="accent-[#243B5A]" />
              전체 선택
            </label>
            <span className="text-xs text-[#64748B]">선택 {selectedTaskIds.filter((id) => filteredTasks.some((task) => task.id === id)).length}개</span>
            <button onClick={handleBulkDeleteTasks} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-600 border border-red-200 flex items-center gap-1 hover:bg-red-100 transition-colors"><Trash2 className="h-3 w-3" />삭제</button>
            {taskTab === 'DAILY' && dailySubTab === 'HISTORY' && <button onClick={handleExportDailyHistoryExcel} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 text-white flex items-center gap-1 hover:bg-emerald-700 transition-colors"><FileSpreadsheet className="h-3 w-3" />Excel 내려받기</button>}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-16 text-xs text-[#64748B]">로딩 중...</div>
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
                <ChevronDown className="h-4 w-4 shrink-0" />
              </button>
              {dailySubTab !== 'HISTORY' && <button
                type="button"
                onClick={() => setActiveFilterDropdown(activeFilterDropdown === 'mobile-date' ? null : 'mobile-date')}
                className="flex min-w-0 items-center justify-between gap-1 rounded-lg bg-[#243B5A] px-2.5 py-2 text-left text-xs font-bold text-white"
              >
                <span className="truncate">▶ 일자 선택: {tableFilterDate === 'ALL' ? '전체' : formatToShortDate(tableFilterDate)}</span>
                <ChevronDown className="h-4 w-4 shrink-0" />
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
              {((dailySubTab !== 'HISTORY' && tableFilterDate !== 'ALL') || tableFilterVessel !== 'ALL') && <button type="button" onClick={() => { setTableFilterDate('ALL'); setTableFilterVessel('ALL'); }} className="col-span-2 rounded-lg border px-2 py-1.5 text-xs text-[#64748B] hover:bg-[#F5F6F8]">필터 전체 해제</button>}
            </div>
            {filteredTasks.length === 0 ? (
              <div className="rounded-xl border bg-white py-10 text-center text-xs text-[#64748B]">
                {dailySubTab === 'ACTIVE' ? '등록된 진행중/대기 일일 업무가 없습니다.' : dailySubTab === 'OTHER' ? '등록된 야간업무진행가 없습니다.' : '완료 이력이 없습니다.'}
              </div>
            ) : filteredTasks.map((t) => (
              <div key={`mobile-${t.id}`} className="rounded-xl border border-[#E2E5E9] bg-white p-3 shadow-2xs hover:border-[#243B5A] transition-colors" onClick={() => handleOpenTaskDetail(t)}>
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
                  {isAdmin && t.task_type === 'DAILY_OTHER' && t.status !== 'COMPLETED' && <button type="button" onClick={() => handleCompleteOtherTask(t)} className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800 hover:bg-emerald-100">완료</button>}
                </div>
                <div className="mt-3 border-t border-slate-100 pt-2" onClick={(e) => e.stopPropagation()}>
                  <div className="mb-1 text-[10px] font-bold text-[#64748B]">인원 ({t.assigned_names?.length || 0}명)</div>
                  {t.assigned_names?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {t.assigned_names.map((name) => <button key={`${t.id}-mobile-${name}`} type="button" onClick={() => handleCallWorker(name)} className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-[#243B5A] hover:bg-blue-100 transition-colors"><span>📞</span><span>{name}</span></button>)}
                    </div>
                  ) : <div className="text-xs text-[#94A3B8]">미지정</div>}
                </div>
                <div className="mt-2 flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                  {dailySubTab === 'ACTIVE' && isAdmin && t.task_type === 'DAILY' && t.status === 'COMPLETED' && t.completion_pending_review === true && <button type="button" onClick={() => handleFinalizeDailyTask(t)} className="rounded bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors">최종 완료</button>}
                  {t.task_type === 'DAILY_OTHER' && canManageTask(t) && <><button type="button" onClick={() => handleOpenTaskEdit(t)} className="rounded border px-2 py-1.5 text-xs font-semibold text-[#243B5A] hover:bg-[#F5F6F8]"><Pencil className="mr-1 inline h-3 w-3" />수정</button><button type="button" onClick={() => handleDeleteTask(t.id)} className="rounded border border-red-200 px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"><Trash2 className="mr-1 inline h-3 w-3" />삭제</button></>}
                  {dailySubTab === 'HISTORY' && isAdmin && t.task_type === 'DAILY' && <button type="button" onClick={() => handleDeleteTask(t.id)} className="rounded border border-red-200 px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"><Trash2 className="mr-1 inline h-3 w-3" />삭제</button>}
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
                      <input type="checkbox" checked={filteredTasks.length > 0 && filteredTasks.every((task) => selectedTaskIds.includes(task.id))} onChange={(e) => handleSelectAllVisible(e.target.checked)} className="accent-white cursor-pointer" />
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
                              <button onClick={() => handleOpenTaskEdit(t)} className="inline-flex items-center justify-center p-1 text-[#243B5A] hover:bg-slate-200 rounded"><Pencil className="h-3.5 w-3.5" /></button>
                              <button onClick={() => handleDeleteTask(t.id)} className="inline-flex items-center justify-center p-1 text-red-600 hover:bg-slate-200 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                            </>
                          )}
                          {dailySubTab === 'HISTORY' && isAdmin && t.task_type === 'DAILY' && (
                            <button onClick={() => handleDeleteTask(t.id)} className="inline-flex items-center justify-center p-1 text-red-600 hover:bg-slate-200 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
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
                <button onClick={() => changeWeek('prev')} className="p-1.5 border rounded-lg hover:bg-[#F5F6F8] transition-colors"><ChevronLeft className="h-4 w-4" /></button>
                <span className="text-xs sm:text-sm font-bold font-mono">{weekDays[0].displayDate} ~ {weekDays[6].displayDate} 일정</span>
                <button onClick={() => changeWeek('next')} className="p-1.5 border rounded-lg hover:bg-[#F5F6F8] transition-colors"><ChevronRight className="h-4 w-4" /></button>
                <button onClick={() => { setCurrentWeekMonday(getMonday(new Date())); setSelectedTaskIds([]); }} className="text-xs px-2.5 py-1 bg-[#F5F6F8] border rounded-lg font-semibold ml-2 hover:bg-[#EEF2F7] transition-colors">오늘</button>
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                {isAdmin && (
                  <>
                    <MonthOnlyPicker value={selectedExportMonth} onChange={setSelectedExportMonth} />
                    <button onClick={() => { void handleExportWeeklyExcel(); }} className="flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition"><FileSpreadsheet className="h-3.5 w-3.5" /><span>Excel 내려받기</span></button>
                    <button onClick={handleRequestMonthlyWeeklyDelete} className="flex items-center space-x-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition"><Trash2 className="h-3.5 w-3.5" /><span>월 삭제</span></button>
                  </>
                )}
                <div className="bg-[#F5F6F8] p-1 rounded-lg border flex space-x-1">
                  <button onClick={() => setWeeklyViewMode('GRID')} className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1 ${weeklyViewMode === 'GRID' ? 'bg-[#243B5A] text-white' : 'text-[#64748B]'}`}><LayoutGrid className="h-3.5 w-3.5" /><span className="hidden sm:inline">가로</span></button>
                  <button onClick={() => setWeeklyViewMode('LIST')} className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1 ${weeklyViewMode === 'LIST' ? 'bg-[#243B5A] text-white' : 'text-[#64748B]'}`}><List className="h-3.5 w-3.5" /><span className="hidden sm:inline">세로</span></button>
                </div>
              </div>
            </div>

            {weeklyViewMode === 'GRID' ? (
              <div className="overflow-x-auto pb-2 [&::-webkit-scrollbar]:h-2">
                <div className="grid grid-cols-7 gap-2 min-w-[900px]">
                  {weekDays.map((day) => {
                    const dayTasks = filteredTasks.filter((t) => t.start_date === day.dateStr);
                    return (
                      <div key={day.dateStr} className={`rounded-lg border p-1 sm:p-2 min-h-[260px] sm:min-h-[360px] min-w-0 flex flex-col ${day.isToday ? 'border-[#243B5A] bg-[#243B5A]/5' : 'bg-white'}`}>
                        <div className="flex items-center justify-between gap-0.5 pb-1 mb-1 border-b min-w-0">
                          <span className="font-bold text-[9px] sm:text-xs truncate">{day.label} <span className="text-[10px] text-[#64748B] font-mono">{day.displayDate}</span></span>
                          {isAdmin && (
                            <button onClick={() => handleOpenCreateModal(day.dateStr, 'WEEKLY')} className="p-0.5 text-[#243B5A] hover:bg-slate-200 rounded"><Plus className="h-3.5 w-3.5" /></button>
                          )}
                        </div>
                        <div className="space-y-1 sm:space-y-2 flex-1 min-w-0">
                          {dayTasks.map((t) => (
                            <div key={t.id} onClick={() => handleOpenTaskDetail(t)} className="bg-white border rounded-md p-1 sm:p-2 text-[9px] sm:text-xs space-y-1 min-w-0 break-words shadow-2xs cursor-pointer hover:border-[#243B5A] transition-colors">
                              <div className="flex justify-between items-center">
                                {isAdmin && <input type="checkbox" checked={selectedTaskIds.includes(t.id)} onChange={(e) => toggleTaskSelection(t.id, e.target.checked)} onClick={(e) => e.stopPropagation()} className="accent-[#243B5A]" />}
                                {t.category && <span className="text-[9px] font-bold text-[#243B5A] bg-blue-50 px-1.5 py-0.2 rounded">{t.category}{t.cargo_hold ? `/${t.cargo_hold}` : ''}</span>}
                                {renderStatusBadge(t)}
                              </div>
                              <div className="font-bold text-[#1F2937] leading-tight line-clamp-2">{t.title}{renderTaskNewBadge(t)}</div>
                              <div className="text-[8px] sm:text-[10px] text-[#64748B] break-words">{t.assigned_names?.join(', ') || '미지정'}</div>
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
                        <span className="font-bold text-[9px] sm:text-xs truncate">{day.label} ({day.displayDate})</span>
                        {isAdmin && (
                          <button onClick={() => handleOpenCreateModal(day.dateStr, 'WEEKLY')} className="flex items-center gap-1 text-xs text-[#243B5A] font-semibold hover:underline"><Plus className="h-3.5 w-3.5" /><span>추가</span></button>
                        )}
                      </div>
                      {dayTasks.length === 0 ? (
                        <div className="text-xs text-[#64748B] py-1">등록된 일정이 없습니다.</div>
                      ) : (
                        <div className="space-y-2">
                          {dayTasks.map((t) => (
                            <div key={t.id} onClick={() => handleOpenTaskDetail(t)} className="flex items-center justify-between bg-white border rounded-lg p-2.5 text-xs cursor-pointer hover:border-[#243B5A] transition-colors">
                              <div className="space-y-1">
                                <div className="flex items-center space-x-2">
                                  {isAdmin && <input type="checkbox" checked={selectedTaskIds.includes(t.id)} onChange={(e) => toggleTaskSelection(t.id, e.target.checked)} onClick={(e) => e.stopPropagation()} className="accent-[#243B5A]" />}
                                  {t.category && <span className="text-[10px] font-bold text-[#243B5A] bg-blue-50 px-1.5 py-0.5 rounded">{t.category}{t.cargo_hold ? `/${t.cargo_hold}` : ''}</span>}
                                  <div className="font-bold text-[#1F2937]">{t.title}{renderTaskNewBadge(t)}</div>
                                  {renderStatusBadge(t)}
                                </div>
                                <div className="text-[11px] text-[#64748B]">인원: {t.assigned_names?.join(', ') || '미지정'}</div>
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
          <>
          <div className="md:hidden space-y-2">
            {filteredTasks.length === 0 ? (
              <div className="rounded-xl border bg-white py-10 text-center text-xs text-[#64748B]">등록된 CABIN 편성이 없습니다.</div>
            ) : filteredTasks.map((t) => {
              return (
                <div key={`cabin-mobile-${t.id}`} className="rounded-xl border border-[#E2E5E9] bg-white p-3 shadow-2xs hover:border-[#243B5A] transition-colors" onClick={() => handleOpenTaskDetail(t)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-1 text-[11px]">
                        <span className="font-bold text-[#243B5A]">{t.category || '호선 미지정'}</span>
                        {t.cargo_hold && <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-semibold text-indigo-700">{t.cargo_hold}</span>}
                        <span className="font-mono text-[#64748B]">{formatToShortDate(t.start_date)}{t.end_date && t.end_date !== t.start_date ? ` ~ ${formatToShortDate(t.end_date)}` : ''}</span>
                      </div>
                      <div className="break-words text-sm font-bold text-[#1F2937]">{t.title}{renderTaskNewBadge(t)}</div>
                    </div>
                    {isAdmin && <input type="checkbox" checked={selectedTaskIds.includes(t.id)} onClick={(e) => e.stopPropagation()} onChange={(e) => toggleTaskSelection(t.id, e.target.checked)} className="mt-1 accent-[#243B5A]" aria-label="CABIN 업무 선택" />}
                  </div>
                  <div className="mt-2" onClick={(e) => e.stopPropagation()}>{renderStatusBadge(t)}</div>
                  <div className="mt-3 space-y-2 border-t border-slate-100 pt-2" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <div className="mb-1 text-[10px] font-bold text-[#64748B]">주간 인원 ({t.day_workers?.length || 0}명)</div>
                      {t.day_workers?.length ? <div className="flex flex-wrap gap-1.5">{t.day_workers.map((name) => <button key={`${t.id}-day-${name}`} type="button" onClick={() => handleCallWorker(name)} className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-[#243B5A] hover:bg-blue-100 transition-colors"><span>📞</span><span>{name}</span></button>)}</div> : <div className="text-xs text-[#94A3B8]">미지정</div>}
                    </div>
                    <div>
                      <div className="mb-1 text-[10px] font-bold text-[#64748B]">야간 인원 ({t.night_workers?.length || 0}명)</div>
                      {t.night_workers?.length ? <div className="flex flex-wrap gap-1.5">{t.night_workers.map((name) => <button key={`${t.id}-night-${name}`} type="button" onClick={() => handleCallWorker(name)} className="inline-flex items-center gap-1 rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-[#243B5A] hover:bg-violet-100 transition-colors"><span>📞</span><span>{name}</span></button>)}</div> : <div className="text-xs text-[#94A3B8]">미지정</div>}
                    </div>
                    {!t.day_workers?.length && !t.night_workers?.length && <div className="text-xs text-[#94A3B8]">등록된 인원이 없습니다.</div>}
                  </div>
                  {isAdmin && <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-2" onClick={(e) => e.stopPropagation()}><button type="button" onClick={() => handleOpenTaskEdit(t)} className="rounded border px-2.5 py-1.5 text-xs font-semibold text-[#243B5A] hover:bg-[#F5F6F8]"><Pencil className="mr-1 inline h-3 w-3" />수정</button><button type="button" onClick={() => handleDeleteTask(t.id)} className="rounded border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"><Trash2 className="mr-1 inline h-3 w-3" />삭제</button></div>}
                </div>
              );
            })}
          </div>

          <div className="hidden md:block w-full rounded-xl border bg-white shadow-2xs overflow-hidden">
            <table className="w-full text-left border-collapse text-[11px] sm:text-xs table-fixed">
              <thead>
                <tr className="bg-[#243B5A] text-white">
                  {isAdmin && (
                    <th className="p-1.5 w-6 text-center">
                      <input type="checkbox" checked={filteredTasks.length > 0 && filteredTasks.every((task) => selectedTaskIds.includes(task.id))} onChange={(e) => handleSelectAllVisible(e.target.checked)} className="accent-white cursor-pointer" />
                    </th>
                  )}
                  <th className="p-1.5 font-bold w-[12%]">호선</th>
                  <th className="p-1.5 font-bold w-[9%]">화물창</th>
                  <th className="p-1.5 font-bold w-[17%]">근무명</th>
                  <th className="p-1.5 font-bold w-[22%]">주간 근무자</th>
                  <th className="p-1.5 font-bold w-[22%]">야간 근무자</th>
                  <th className="p-1.5 font-bold w-[10%]">상태</th>
                  <th className="p-1.5 font-bold text-right w-[8%]">관리</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 8 : 7} className="text-center py-12 text-[#64748B]">
                      등록된 CABIN 편성이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition cursor-pointer" onClick={() => handleOpenTaskDetail(t)}>
                      {isAdmin && (
                        <td className="p-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedTaskIds.includes(t.id)} onChange={(e) => toggleTaskSelection(t.id, e.target.checked)} className="accent-[#243B5A]" />
                        </td>
                      )}
                      <td className="p-1.5 font-bold text-[#243B5A] truncate" title={t.category || '-'}>{t.category || '-'}</td>
                      <td className="p-1.5 font-semibold text-indigo-700 truncate" title={t.cargo_hold || '-'}>{t.cargo_hold || '-'}</td>
                      <td className="p-1.5 font-bold text-[#1F2937] break-words" title={t.title}>{t.title}{renderTaskNewBadge(t)}</td>
                      <td className="p-1.5 align-top" onClick={(e) => e.stopPropagation()}>
                        <div className="mb-1 text-[10px] font-bold text-[#64748B]">주간 ({t.day_workers?.length || 0}명)</div>
                        {t.day_workers?.length ? <div className="flex flex-wrap gap-1">{t.day_workers.map((name) => <button key={`${t.id}-desktop-day-${name}`} type="button" onClick={() => handleCallWorker(name)} className="rounded-full border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-[#243B5A] hover:bg-blue-100 transition-colors" title={`${name} 전화 연결`}>📞 {name}</button>)}</div> : <span className="text-[10px] text-[#94A3B8]">미지정</span>}
                      </td>
                      <td className="p-1.5 align-top" onClick={(e) => e.stopPropagation()}>
                        <div className="mb-1 text-[10px] font-bold text-[#64748B]">야간 ({t.night_workers?.length || 0}명)</div>
                        {t.night_workers?.length ? <div className="flex flex-wrap gap-1">{t.night_workers.map((name) => <button key={`${t.id}-desktop-night-${name}`} type="button" onClick={() => handleCallWorker(name)} className="rounded-full border border-violet-100 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-[#243B5A] hover:bg-violet-100 transition-colors" title={`${name} 전화 연결`}>📞 {name}</button>)}</div> : <span className="text-[10px] text-[#94A3B8]">미지정</span>}
                      </td>
                      <td className="p-1.5 text-center" onClick={(e) => e.stopPropagation()}>{renderStatusBadge(t)}</td>
                      <td className="p-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                        {isAdmin && (
                          <div className="flex items-center justify-end gap-0.5">
                            <button onClick={() => handleOpenTaskEdit(t)} className="p-0.5 text-[#243B5A] hover:bg-slate-200 rounded"><Pencil className="h-3 w-3" /></button>
                            <button onClick={() => handleDeleteTask(t.id)} className="p-0.5 text-red-600 hover:bg-slate-200 rounded"><Trash2 className="h-3 w-3" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </>
        )}

          </>
        )}

        {isWeeklyImportModalOpen && isAdmin && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/25 p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-5 shadow-[0_12px_32px_rgba(15,23,42,0.18)] space-y-4 border border-[#E2E5E9] max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-[#E2E5E9] pb-3">
                <h3 className="text-sm font-bold text-[#243B5A]">주간업무에서 일일업무로 불러오기</h3>
                <button onClick={() => setIsWeeklyImportModalOpen(false)} className="p-1 text-[#64748B] hover:bg-[#F5F6F8] rounded-lg"><X className="h-4 w-4" /></button>
              </div>

              <div className="space-y-1.5">
                <CalendarDatePicker
                  label="불러올 일자 선택 (해당일)"
                  value={importTargetDate}
                  onChange={(date) => {
                    if (date) {
                      setImportTargetDate(date);
                      setSelectedWeeklyIdsToImport([]);
                    }
                  }}
                />
                <p className="text-[10px] text-[#64748B]">선택한 날짜에 해당하는 주간업무 항목들을 일일업무로 등록합니다.</p>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-[#64748B]">
                  선택 {selectedWeeklyIdsToImport.filter(id => tasks.some(t => t.id === id && t.task_type === 'WEEKLY' && t.start_date === importTargetDate)).length}개
                  / 전체 {tasks.filter(t => t.task_type === 'WEEKLY' && t.start_date === importTargetDate).length}개
                </span>
                {tasks.some(t => t.task_type === 'WEEKLY' && t.start_date === importTargetDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      const availableIds = tasks.filter(t => t.task_type === 'WEEKLY' && t.start_date === importTargetDate).map(t => t.id);
                      const allSelected = availableIds.length > 0 && availableIds.every(id => selectedWeeklyIdsToImport.includes(id));
                      setSelectedWeeklyIdsToImport(prev => allSelected ? prev.filter(id => !availableIds.includes(id)) : Array.from(new Set([...prev, ...availableIds])));
                    }}
                    className="px-3 py-1.5 border border-[#243B5A] rounded-lg text-xs font-semibold text-[#243B5A] hover:bg-blue-50 transition-colors"
                  >
                    {tasks.filter(t => t.task_type === 'WEEKLY' && t.start_date === importTargetDate).every(t => selectedWeeklyIdsToImport.includes(t.id)) ? '전체 해제' : '전체 선택'}
                  </button>
                )}
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 border border-[#E2E5E9] p-2 rounded-xl bg-[#F5F6F8]">
                {tasks.filter(t => t.task_type === 'WEEKLY' && t.start_date === importTargetDate).length === 0 ? (
                  <div className="text-center py-6 text-xs text-[#64748B]">선택한 일자({importTargetDate})에 등록된 주간업무가 없습니다.</div>
                ) : (
                  tasks.filter(t => t.task_type === 'WEEKLY' && t.start_date === importTargetDate).map(wt => (
                    <label key={wt.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-[#E2E5E9] text-xs hover:border-[#243B5A] cursor-pointer transition-colors">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedWeeklyIdsToImport.includes(wt.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedWeeklyIdsToImport([...selectedWeeklyIdsToImport, wt.id]);
                            else setSelectedWeeklyIdsToImport(selectedWeeklyIdsToImport.filter(id => id !== wt.id));
                          }}
                          className="accent-[#243B5A]"
                        />
                        <div>
                          <div className="font-bold text-[#1F2937]">{wt.title}</div>
                          <div className="text-[10px] text-[#64748B]">{wt.start_date} {wt.category ? `[${wt.category}]` : ''}</div>
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-[#E2E5E9] text-xs">
                <button onClick={() => setIsWeeklyImportModalOpen(false)} className="px-3 py-1.5 border border-[#E2E5E9] rounded-lg font-semibold hover:bg-[#F5F6F8]">취소</button>
                <button onClick={handleImportWeeklyToDaily} className="px-4 py-1.5 bg-[#243B5A] text-white font-semibold rounded-lg hover:bg-[#1B2F49] transition-colors">선택 업무 일일등록</button>
              </div>
            </div>
          </div>
        )}

        {customAlert.open && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/25 p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-4 shadow-[0_12px_32px_rgba(15,23,42,0.18)] space-y-3 border border-[#E2E5E9]">
              <div className="flex items-center justify-between border-b border-[#E2E5E9] pb-2">
                <h3 className="text-sm font-bold text-[#243B5A]">{customAlert.title}</h3>
                <button onClick={() => setCustomAlert({ ...customAlert, open: false })} className="p-1 text-[#64748B] hover:bg-[#F5F6F8] rounded-lg"><X className="h-4 w-4" /></button>
              </div>
              <p className="text-xs text-[#1F2937] leading-relaxed">{customAlert.message}</p>
              <div className="flex justify-end space-x-2 pt-2 border-t border-[#E2E5E9] text-xs">
                {customAlert.type === 'monthlyDelete' ? (
                  <>
                    <button onClick={() => setCustomAlert({ ...customAlert, open: false })} className="px-3 py-1.5 border rounded-lg font-semibold hover:bg-[#F5F6F8]">취소</button>
                    <button onClick={() => { if (customAlert.onDownload) customAlert.onDownload(); }} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors">내려받기</button>
                    <button onClick={() => { const confirmAction = customAlert.onConfirm; setCustomAlert({ ...customAlert, open: false }); if (confirmAction) confirmAction(); }} className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors">확인</button>
                  </>
                ) : customAlert.type === 'confirm' ? (
                  <>
                    <button onClick={() => setCustomAlert({ ...customAlert, open: false })} className="px-3 py-1.5 border rounded-lg font-semibold hover:bg-[#F5F6F8]">취소</button>
                    <button onClick={() => { const confirmAction = customAlert.onConfirm; setCustomAlert({ ...customAlert, open: false }); if (confirmAction) confirmAction(); }} className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors">확인</button>
                  </>
                ) : (
                  <button onClick={() => setCustomAlert({ ...customAlert, open: false })} className="px-4 py-1.5 bg-[#243B5A] text-white rounded-lg font-semibold hover:bg-[#1B2F49] transition-colors">확인</button>
                )}
              </div>
            </div>
          </div>
        )}

        {isAlertOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-5 shadow-[0_12px_32px_rgba(15,23,42,0.18)] space-y-4 border border-[#E2E5E9]">
              <div className="flex items-center justify-between border-b border-[#E2E5E9] pb-3">
                <div className="flex items-center space-x-2 text-[#243B5A]">
                  <Bell className="h-5 w-5 text-amber-500 animate-bounce" />
                  <h3 className="text-sm font-bold">배정된 미완료 알림 안내</h3>
                </div>
                <button onClick={() => setIsAlertOpen(false)} className="p-1 text-[#64748B] hover:bg-[#F5F6F8] rounded-lg"><X className="h-4 w-4" /></button>
              </div>
              <p className="text-xs text-[#64748B]">현재 미완료 상태인 업무가 총 <span className="font-bold text-red-600">{myAssignedTasks.length}건</span> 있습니다.</p>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {myAssignedTasks.length === 0 ? (
                  <div className="text-center py-6 text-xs text-[#64748B]">미완료된 업무가 없습니다!</div>
                ) : (
                  myAssignedTasks.map((t) => (
                    <div key={t.id} className="p-2.5 bg-[#F5F6F8] rounded-lg text-xs space-y-1 border border-[#E2E5E9] flex items-center justify-between">
                      <div>
                        <div className="font-bold text-[#1F2937]">{t.title}{renderTaskNewBadge(t)}</div>
                        <div className="text-[11px] text-[#64748B] font-mono">{t.start_date} ({formatShortTimeSlot(t.time_slot)})</div>
                      </div>
                      {renderStatusBadge(t)}
                    </div>
                  ))
                )}
              </div>
              <div className="flex justify-end pt-3 border-t border-[#E2E5E9] text-xs">
                <button onClick={() => setIsAlertOpen(false)} className="px-4 py-1.5 bg-[#243B5A] text-white rounded-lg font-semibold hover:bg-[#1B2F49] transition-colors">닫기</button>
              </div>
            </div>
          </div>
        )}

        {statusChangeModal.open && statusChangeModal.task && (() => {
          const isAllowedUser = canModifyTaskStatus(statusChangeModal.task);
          return (
            <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-900/25 p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-5 shadow-[0_12px_32px_rgba(15,23,42,0.18)] space-y-4 border border-[#E2E5E9]">
                <div className="flex items-center justify-between border-b border-[#E2E5E9] pb-3">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-[#243B5A]" />
                    <h3 className="text-sm font-bold text-[#1F2937]">상세보기 및 상태 변경</h3>
                  </div>
                  <button onClick={() => setStatusChangeModal({ open: false, task: null, targetStatus: 'PENDING', remarks: '' })} className="p-1 text-[#64748B] hover:bg-[#F5F6F8] rounded-lg"><X className="h-4 w-4" /></button>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-[#F5F6F8] rounded-lg border border-[#E2E5E9] space-y-2">
                    <div className="font-bold text-sm text-[#1F2937]">{statusChangeModal.task.title}</div>
                    <div className="text-[#64748B] font-mono">
                      일시: {statusChangeModal.task.start_date} {statusChangeModal.task.time_slot ? `(${formatShortTimeSlot(statusChangeModal.task.time_slot)})` : ''}
                    </div>
                    {statusChangeModal.task.category && <div className="text-[#64748B]">호선/화물창: {statusChangeModal.task.category} {statusChangeModal.task.cargo_hold ? `(${statusChangeModal.task.cargo_hold})` : ''}</div>}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1F2937] mb-1.5">상태 선택</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button type="button" disabled={!isAllowedUser} onClick={() => setStatusChangeModal({ ...statusChangeModal, targetStatus: 'PENDING' })} className={`py-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1 transition-colors ${statusChangeModal.targetStatus === 'PENDING' ? 'bg-amber-500 text-white border-amber-600' : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'}`}>대기</button>
                      <button type="button" disabled={!isAllowedUser} onClick={() => setStatusChangeModal({ ...statusChangeModal, targetStatus: 'IN_PROGRESS' })} className={`py-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1 transition-colors ${statusChangeModal.targetStatus === 'IN_PROGRESS' ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'}`}>진행중</button>
                      <button type="button" disabled={!isAllowedUser} onClick={() => setStatusChangeModal({ ...statusChangeModal, targetStatus: 'COMPLETED' })} className={`py-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1 transition-colors ${statusChangeModal.targetStatus === 'COMPLETED' ? 'bg-slate-700 text-white border-slate-800' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'}`}>완료</button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1F2937] mb-1">비고란 (최대 10줄 이상 스크롤)</label>
                    <textarea
                      rows={10}
                      disabled={!isAllowedUser}
                      placeholder="비고 사항을 입력해주세요..."
                      value={statusChangeModal.remarks}
                      onChange={(e) => setStatusChangeModal({ ...statusChangeModal, remarks: e.target.value })}
                      className={`w-full px-3 py-2 border border-[#E2E5E9] bg-[#F5F6F8] rounded-lg text-xs resize-y max-h-64 outline-none transition-colors ${!isAllowedUser ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'focus:border-[#243B5A] focus:bg-white'}`}
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-3 border-t border-[#E2E5E9] text-xs">
                  <button onClick={() => setStatusChangeModal({ open: false, task: null, targetStatus: 'PENDING', remarks: '' })} className="px-3.5 py-1.5 border border-[#E2E5E9] rounded-lg font-semibold hover:bg-[#F5F6F8]">닫기</button>
                  {isAllowedUser && <button onClick={handleConfirmStatusChange} className="px-4 py-1.5 bg-[#243B5A] text-white rounded-lg font-semibold hover:bg-[#1B2F49] transition-colors">저장</button>}
                </div>
              </div>
            </div>
          );
        })()}

        {selectedTaskForSheet && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/25">
            <div className="bg-white rounded-t-2xl max-w-xl w-full p-4 sm:p-6 shadow-[0_-12px_32px_rgba(15,23,42,0.18)] space-y-4 border-t border-[#E2E5E9]">
              <div className="flex items-center justify-between border-b border-[#E2E5E9] pb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded font-mono">
                    {selectedTaskForSheet.start_date} {selectedTaskForSheet.time_slot ? `(${formatShortTimeSlot(selectedTaskForSheet.time_slot)})` : ''}
                  </span>
                  {renderStatusBadge(selectedTaskForSheet)}
                </div>
                <button onClick={() => setSelectedTaskForSheet(null)} className="p-1 text-[#64748B] hover:bg-[#F5F6F8] rounded-lg"><X className="h-5 w-5" /></button>
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-bold text-[#1F2937]">{selectedTaskForSheet.title}{renderTaskNewBadge(selectedTaskForSheet)}</h3>
                {selectedTaskForSheet.category && (
                  <div className="text-xs text-[#243B5A] font-semibold">호선: {selectedTaskForSheet.category} {selectedTaskForSheet.cargo_hold ? `(화물창: ${selectedTaskForSheet.cargo_hold})` : ''}</div>
                )}
                {selectedTaskForSheet.description && (
                  <p className="text-xs text-[#64748B] bg-[#F5F6F8] p-3 rounded-lg border border-[#E2E5E9]">{selectedTaskForSheet.description}</p>
                )}
                {selectedTaskForSheet.remarks && (
                  <div className="text-xs text-[#1F2937] bg-amber-50/50 p-2.5 rounded-lg border border-amber-200">
                    <span className="font-bold text-amber-900">비고: </span>{selectedTaskForSheet.remarks}
                  </div>
                )}
              </div>

              <div className="space-y-1 text-xs">
                <div className="font-bold text-[#1F2937]">인원 목록:</div>
                <div className="text-[#64748B]">
                  {selectedTaskForSheet.assigned_names?.map((name) => (
                    <button
                      key={`sheet-${name}`}
                      type="button"
                      onClick={() => handleCallWorker(name)}
                      className="text-[#2563EB] hover:underline font-medium mr-2 inline-block bg-blue-50 px-1.5 py-0.5 rounded my-0.5"
                    >
                      📞 {name}
                    </button>
                  )) || 
                   [...(selectedTaskForSheet.day_workers || []), ...(selectedTaskForSheet.night_workers || [])].join(', ') || 
                   '지정 안됨'}
                </div>
              </div>

              {canManageTask(selectedTaskForSheet) && (
                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#E2E5E9]">
                  <button onClick={() => { handleOpenTaskEdit(selectedTaskForSheet); setSelectedTaskForSheet(null); }} className="px-3 py-1.5 text-xs font-semibold border border-[#E2E5E9] rounded-lg text-[#243B5A] hover:bg-[#F5F6F8]">수정</button>
                  <button onClick={() => handleDeleteTask(selectedTaskForSheet.id)} className="px-3 py-1.5 text-xs font-semibold border rounded-lg text-red-600 border-red-200 hover:bg-red-50">삭제</button>
                </div>
              )}
            </div>
          </div>
        )}

        {isVesselManagerOpen && isAdmin && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/25 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-5 shadow-[0_12px_32px_rgba(15,23,42,0.18)] space-y-4 border border-[#E2E5E9]">
              <div className="flex items-center justify-between border-b border-[#E2E5E9] pb-3">
                <h3 className="text-sm font-bold text-[#243B5A]">호선 추가 / 수정 / 삭제</h3>
                <button onClick={() => setIsVesselManagerOpen(false)} className="p-1 text-[#64748B] hover:bg-[#F5F6F8] rounded-lg"><X className="h-4 w-4" /></button>
              </div>
              <div className="flex space-x-2">
                <input type="text" placeholder="신규 호선명 입력" value={newVesselName} onChange={(e) => setNewVesselName(e.target.value)} className={inputClass} />
                <button onClick={handleAddVessel} className="px-3 py-1.5 bg-[#243B5A] text-white text-xs font-semibold rounded-lg shrink-0 hover:bg-[#1B2F49] transition-colors">추가</button>
              </div>
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {vessels.map((v) => (
                  <div key={v.id} className="flex items-center justify-between p-2.5 border border-[#E2E5E9] rounded-lg text-xs">
                    {editingVessel?.id === v.id ? (
                      <input type="text" defaultValue={v.name} onBlur={(e) => handleUpdateVessel(v.id, e.target.value)} className="px-2 py-0.5 border rounded text-xs" autoFocus />
                    ) : (
                      <span className="font-bold text-[#1F2937]">{v.name}</span>
                    )}
                    <div className="flex items-center space-x-1.5">
                      <button onClick={() => setEditingVessel(v)} className="p-1 text-[#64748B] hover:text-[#243B5A]"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => handleDeleteVessel(v.id)} className="p-1 text-[#64748B] hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {isTeamManagerOpen && isAdmin && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/25 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-5 shadow-[0_12px_32px_rgba(15,23,42,0.18)] space-y-4 border border-[#E2E5E9] max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-[#E2E5E9] pb-3">
                <div className="flex items-center space-x-1.5 text-[#243B5A]">
                  <Layers className="h-4 w-4" />
                  <h3 className="text-sm font-bold">Team 그룹 관리</h3>
                </div>
                <button onClick={() => setIsTeamManagerOpen(false)} className="p-1 text-[#64748B] hover:bg-[#F5F6F8] rounded-lg"><X className="h-4 w-4" /></button>
              </div>

              <div className="space-y-2 bg-[#F5F6F8] p-3 rounded-xl border border-[#E2E5E9]">
                <span className="text-xs font-bold text-[#243B5A]">신규 Team 추가</span>
                <input type="text" placeholder="Team 이름" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} className={inputClass} />
                <select value={newTeamDept} onChange={(e) => handleSelectDepartmentUsersToNewTeam(e.target.value)} className={inputClass}>
                  <option value="">-- 부서 선택 (인원 자동입력) --</option>
                  {departments.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
                </select>
                <input type="text" placeholder="구성원 이름 (쉼표 구분)" value={newTeamMembersText} onChange={(e) => setNewTeamMembersText(e.target.value)} className={inputClass} />
                <button onClick={handleAddTeam} className="w-full py-2 bg-[#243B5A] text-white text-xs font-semibold rounded-lg hover:bg-[#1B2F49] transition-colors">Team 생성</button>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-[#1F2937]">등록된 Team 목록</span>
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {presetTeams.map((team) => (
                    <div key={team.id} className="p-2.5 border border-[#E2E5E9] rounded-lg text-xs bg-white flex items-center justify-between">
                      <div>
                        <div className="font-bold text-[#243B5A]">{team.name}</div>
                        <div className="text-[11px] text-[#64748B]">{team.members?.join(', ')}</div>
                      </div>
                      <button onClick={() => handleDeleteTeam(team.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {isModalOpen && (isAdmin || formData.task_type === 'DAILY_OTHER') && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-5 shadow-[0_12px_32px_rgba(15,23,42,0.18)] space-y-4 border border-[#E2E5E9] max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-[#E2E5E9] pb-3">
                <h3 className="text-sm font-bold text-[#243B5A]">
                  {formData.task_type === 'CABIN' ? `CABIN 근무 등록/수정 (${formData.category || '호선미정'})` : '업무 등록/수정'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-1 text-[#64748B] hover:bg-[#F5F6F8] rounded-lg"><X className="h-4 w-4" /></button>
              </div>

              <form onSubmit={handleSubmitTask} className="space-y-3.5">
                {formData.task_type !== 'DAILY_OTHER' && (
                <div>
                  <label className="block text-[11px] font-semibold mb-1 text-[#1F2937]">구분</label>
                  <div className="grid grid-cols-3 gap-1.5 bg-[#F5F6F8] p-1 rounded-lg border border-[#E2E5E9]">
                    <button type="button" onClick={() => setFormData({ ...formData, task_type: 'DAILY' })} className={`py-1 text-xs font-semibold rounded-md transition-colors ${formData.task_type === 'DAILY' ? 'bg-[#243B5A] text-white shadow-2xs' : 'text-[#64748B]'}`}>일일 업무</button>
                    <button type="button" onClick={() => setFormData({ ...formData, task_type: 'WEEKLY' })} className={`py-1 text-xs font-semibold rounded-md transition-colors ${formData.task_type === 'WEEKLY' ? 'bg-[#243B5A] text-white shadow-2xs' : 'text-[#64748B]'}`}>주간 업무</button>
                    <button type="button" onClick={() => setFormData({ ...formData, task_type: 'CABIN' })} className={`py-1 text-xs font-semibold rounded-md transition-colors ${formData.task_type === 'CABIN' ? 'bg-[#243B5A] text-white shadow-2xs' : 'text-[#64748B]'}`}>CABIN</button>
                  </div>
                </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-[11px] font-semibold text-[#1F2937]">호선</label>
                      {isAdmin && (
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => setIsVesselManagerOpen(true)} className="text-[10px] text-red-600 hover:underline font-semibold">호선 삭제/관리</button>
                          <button
                            type="button"
                            onClick={() => setIsQuickVesselInputOpen(!isQuickVesselInputOpen)}
                            className="text-[10px] text-[#2563EB] hover:underline font-semibold"
                          >
                            {isQuickVesselInputOpen ? '닫기' : '+ 호선 추가'}
                          </button>
                        </div>
                      )}
                    </div>

                    {isQuickVesselInputOpen ? (
                      <div className="flex gap-1.5 mb-1">
                        <input
                          type="text"
                          placeholder="신규 호선명 입력"
                          value={quickVesselName}
                          onChange={(e) => setQuickVesselName(e.target.value)}
                          className={inputClass}
                        />
                        <button
                          type="button"
                          onClick={handleQuickAddVessel}
                          className="px-2.5 py-1.5 bg-[#243B5A] text-white text-xs font-semibold rounded-lg shrink-0 hover:bg-[#1B2F49] transition-colors"
                        >
                          등록
                        </button>
                      </div>
                    ) : null}

                    <AppStyledSelect
                      ariaLabel="호선 선택"
                      value={formData.category}
                      onChange={(val) => setFormData({ ...formData, category: val })}
                      options={[{ value: '', label: '호선 선택' }, ...vessels.map(v => ({ value: v.name, label: v.name }))]}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold mb-1 text-[#1F2937]">화물창</label>
                    <input
                      type="text"
                      placeholder="예) Cargo Hold #1"
                      value={formData.cargo_hold}
                      onChange={(e) => setFormData({ ...formData, cargo_hold: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>

                {formData.task_type === 'CABIN' ? (
                  <>
                    <div>
                      <label className="block text-[11px] font-semibold mb-1 text-[#1F2937]">근무/점검명</label>
                      <input type="text" required placeholder="예) 메인 캐빈 정기 점검" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className={inputClass} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <CalendarDatePicker
                        label="시작일"
                        value={formData.start_date}
                        onChange={(date) => { if (date) setFormData({ ...formData, start_date: date }); }}
                      />
                      <CalendarDatePicker
                        label="종료일"
                        value={formData.end_date}
                        onChange={(date) => { if (date) setFormData({ ...formData, end_date: date }); }}
                      />
                    </div>
                    <div className="space-y-3 rounded-xl border border-[#E2E5E9] bg-[#FCFCFD] p-3">
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-semibold text-[#1F2937]">주간 근무자 ({dayWorkerList.length}명)</label>
                        <div className="flex gap-2">
                          <input type="text" placeholder="주간 근무자 이름 입력" value={singleWorkerInput} onChange={(e) => setSingleWorkerInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddWorkerSingle('DAY'); } }} className={inputClass} />
                          <button type="button" onClick={() => handleAddWorkerSingle('DAY')} className="px-3 py-1.5 bg-[#243B5A] text-white text-xs font-semibold rounded-lg hover:bg-[#1B2F49] transition-colors">추가</button>
                        </div>
                        <div className="flex flex-wrap gap-1 pt-1">{dayWorkerList.length ? dayWorkerList.map(name => <span key={`day-${name}`} className="bg-blue-50 text-[#1F2937] border border-blue-100 text-[11px] px-2 py-1 rounded-full flex items-center gap-1">{name}<button type="button" onClick={() => handleRemoveWorker(name, 'DAY')} aria-label={`${name} 주간 근무자 삭제`}><X className="h-3 w-3" /></button></span>) : <span className="text-[11px] text-[#64748B]">주간 근무자가 지정되지 않았습니다.</span>}</div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-semibold text-[#1F2937]">야간 근무자 ({nightWorkerList.length}명)</label>
                        <div className="flex gap-2">
                          <input type="text" placeholder="야간 근무자 이름 입력" value={singleWorkerInput} onChange={(e) => setSingleWorkerInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddWorkerSingle('NIGHT'); } }} className={inputClass} />
                          <button type="button" onClick={() => handleAddWorkerSingle('NIGHT')} className="px-3 py-1.5 bg-violet-700 text-white text-xs font-semibold rounded-lg hover:bg-violet-800 transition-colors">추가</button>
                        </div>
                        <div className="flex flex-wrap gap-1 pt-1">{nightWorkerList.length ? nightWorkerList.map(name => <span key={`night-${name}`} className="bg-violet-50 text-[#1F2937] border border-violet-100 text-[11px] px-2 py-1 rounded-full flex items-center gap-1">{name}<button type="button" onClick={() => handleRemoveWorker(name, 'NIGHT')} aria-label={`${name} 야간 근무자 삭제`}><X className="h-3 w-3" /></button></span>) : <span className="text-[11px] text-[#64748B]">야간 근무자가 지정되지 않았습니다.</span>}</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-[11px] font-semibold mb-1 text-[#1F2937]">업무명</label>
                      <input type="text" required placeholder="예) 시설 정기 점검" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className={inputClass} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <CalendarDatePicker
                        label="일자"
                        value={formData.start_date}
                        onChange={(date) => { if (date) setFormData({ ...formData, start_date: date }); }}
                      />
                      <div>
                        <label className="block text-[11px] font-semibold mb-1 text-[#1F2937]">시간대</label>
                        <AppStyledSelect
                          ariaLabel="시간대 선택"
                          value={formData.time_slot}
                          onChange={(val) => setFormData({ ...formData, time_slot: val })}
                          options={[
                            { value: '오전(08:00~12:00)', label: '오전(08:00~12:00)' },
                            { value: '오후(13:00~17:00)', label: '오후(13:00~17:00)' },
                            { value: '종일(08:00~)', label: '종일(08:00~)' }
                          ]}
                        />
                      </div>
                    </div>

                    {formData.task_type === 'DAILY_OTHER' ? (
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-semibold text-[#1F2937]">인원 (작성자 본인)</label>
                        <div className="inline-flex items-center gap-2 bg-[#EEF2F7] text-[#243B5A] border border-[#E2E5E9] text-xs font-semibold px-3 py-2 rounded-lg">
                          <User className="h-3.5 w-3.5" /> {editingTask?.created_by_name || currentUser?.name || '로그인 사용자'}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center gap-2">
                          <label className="block text-[11px] font-semibold text-[#1F2937]">인원 추가</label>
                          <button type="button" onClick={() => setIsTeamManagerOpen(true)} className="rounded-md px-2 py-1 text-[10px] text-[#243B5A] hover:bg-[#EEF2F7] font-semibold transition-colors">Team 관리</button>
                        </div>
                        <div className="flex gap-2">
                          <input type="text" placeholder="이름 입력 (여러 명은 쉼표로 구분)" value={singleWorkerInput} onChange={(e) => setSingleWorkerInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddWorkerSingle('ASSIGNED'); } }} className={inputClass} />
                          <button type="button" onClick={() => handleAddWorkerSingle('ASSIGNED')} className="rounded-lg bg-[#243B5A] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1B2F49]">추가</button>
                        </div>
                        <div className="flex gap-2 rounded-xl border border-[#E2E5E9] bg-[#FCFCFD] p-2">
                          <div className="min-w-0 flex-1">
                            <AppStyledSelect
                              ariaLabel="Team 선택"
                              value={selectedPresetTeamId}
                              onChange={(val) => setSelectedPresetTeamId(val)}
                              placeholder={presetTeams.length ? 'Team 선택 후 인원 추가' : '등록된 Team이 없습니다'}
                              options={presetTeams.map(team => ({ value: team.id, label: `${team.name} (${getCurrentTeamMembers(team).length}명)` }))}
                            />
                          </div>
                          <button type="button" onClick={handleAddPresetTeamToTask} className="shrink-0 rounded-lg border border-[#243B5A] bg-white px-3 py-2 text-xs font-semibold text-[#243B5A] transition-colors hover:bg-[#EEF2F7]">Team 추가</button>
                        </div>
                        <div className="flex flex-wrap gap-1 pt-1">
                          {assignedList.length === 0 ? (
                            <span className="text-[11px] text-[#64748B]">지정된 인원이 없습니다.</span>
                          ) : (
                            assignedList.map(name => (
                              <span key={name} className="bg-slate-100 text-[#1F2937] border border-[#E2E5E9] text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1">
                                {name}
                                <button type="button" onClick={() => handleRemoveWorker(name, 'ASSIGNED')} aria-label={`${name} 인원 삭제`}><X className="h-3 w-3" /></button>
                              </span>
                            ))
                          )}
                        </div>
                        {formData.task_type === 'DAILY' && (
                          <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50/70 p-2.5">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                              {formatShortTimeSlot(formData.time_slot)} 미배정 공정인원 ({unassignedWorkersForForm.length}명)
                            </div>
                            <p className="mt-1 text-[10px] leading-relaxed text-amber-800">
                              선택한 날짜·시간대에 다른 일일업무로 배정되지 않은 공정인원입니다. 운영·관리 파트, 휴무자 및 CABIN 주간·야간 인원은 제외합니다. 종일 업무는 오전·오후 모두 배정된 것으로 계산합니다.
                            </p>
                            <div className="mt-1.5 text-[11px] leading-relaxed text-[#1F2937] break-words">
                              {unassignedWorkersForForm.length > 0 ? unassignedWorkersForForm.join(', ') : '미배정 공정인원이 없습니다.'}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                <div>
                  <label className="block text-[11px] font-semibold mb-1 text-[#1F2937]">상세 설명 / 업무 내용</label>
                  <textarea rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full rounded-lg border border-[#E2E5E9] bg-[#F5F6F8] px-3 py-2 text-xs text-[#1F2937] outline-none transition-colors focus:border-[#243B5A] focus:bg-white resize-none" />
                </div>

                <div className="flex justify-end space-x-2 pt-3 border-t border-[#E2E5E9]">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-3.5 py-1.5 text-xs border border-[#E2E5E9] rounded-lg font-semibold hover:bg-[#F5F6F8]">취소</button>
                  <button type="submit" className="px-4 py-1.5 text-xs bg-[#243B5A] text-white rounded-lg font-semibold hover:bg-[#1B2F49] transition-colors">저장</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
