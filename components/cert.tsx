'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ChevronDown, ChevronRight, ChevronLeft, CalendarDays, Plus, Edit3, Trash2, X, Download, Award, AlertTriangle, Search, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';

type Category = 'YARD' | 'NATIONAL' | 'NDT';
type Person = {
  id: string;
  name: string;
  department?: string;
  position?: string;
  experience?: string;
  career_start_date?: string;
  role?: string;
  national_cert_details?: Array<{ method: string; kind: string }>;
  yard_cert_details?: Array<{ name: string; education_date: string; renewal_count: number; renewal_dates: string[] }>;
  ndt_certificates?: Array<{ issuer: string; subject: string; level: string; issue_date: string; expiry_date: string }>;
};
type CertRecord = {
  id: string;
  user_id: string;
  category: Category;
  title: string;
  obtained_date: string | null;
  expiry_date: string | null;
  method: string | null;
  level: string | null;
  cert_no?: string | null;
  sticker_no: string | null;
  education_completed: string | null;
  training_date_1: string | null;
  training_date_2: string | null;
  training_date_3: string | null;
  training_date_4: string | null;
  source_key?: string | null;
  detail: Record<string, any> | null;
};
type FormData = {
  user_id: string;
  category: Category;
  title: string;
  method: string;
  level: string;
  obtained_date: string;
  expiry_date: string;
  education_completed: string;
  sticker_no: string;
  cert_no: string;
  training_date_1: string;
  training_date_2: string;
  training_date_3: string;
  training_date_4: string;
  issuer: string;
};

const C = { navy: '#243B5A', pale: '#F5F6F8', border: '#E2E5E9', text: '#1F2937', muted: '#64748B' };
const inputClass = 'w-full rounded-lg border border-[#E2E5E9] bg-[#F5F6F8] px-3 py-2 text-xs text-[#1F2937] outline-none focus:border-[#243B5A] focus:bg-white';
const categories: Array<{ key: Category; label: string }> = [
  { key: 'YARD', label: 'YARD 자격' },
  { key: 'NATIONAL', label: '국가 자격' },
  { key: 'NDT', label: '사내자격 (NDT Level)' },
];
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const addYears = (date: string, years: number) => {
  if (!date) return '';
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setFullYear(d.getFullYear() + years);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const daysUntil = (date: string) => Math.ceil((new Date(`${date}T00:00:00`).getTime() - new Date(`${todayStr()}T00:00:00`).getTime()) / 86400000);
const text = (v: unknown) => v == null ? '' : String(v);
const emptyForm = (category: Category, userId = ''): FormData => ({
  user_id: userId, category, title: '', method: '', level: '', obtained_date: '', expiry_date: '',
  education_completed: '', sticker_no: '', cert_no: '', training_date_1: '', training_date_2: '',
  training_date_3: '', training_date_4: '', issuer: '사내',
});
const normalizeArray = <T,>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];

/** 앱 공통 디자인을 사용하는 사용자 정의 날짜 선택 달력 */
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
    // YYYYMMDD 또는 YYYY-MM-DD 형식을 모두 허용합니다.
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
    // 입력 중인 값이 유효한 YYYY-MM-DD 형식이 아니면 기존 저장값으로 되돌립니다.
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


type StyledSelectOption = { value: string; label: string };
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

type RenewalEntry = { record: CertRecord; expiry: string; remaining: number };
type RenewalGroup = { user_id: string; category: 'YARD' | 'NDT'; entries: RenewalEntry[]; earliestExpiry: string };
const groupRenewalEntries = (entries: RenewalEntry[]): RenewalGroup[] => {
  const grouped = new Map<string, RenewalGroup>();
  for (const entry of entries) {
    if (entry.record.category !== 'YARD' && entry.record.category !== 'NDT') continue;
    const category = entry.record.category;
    const user_id = String(entry.record.user_id);
    const key = `${user_id}|${category}`;
    if (!grouped.has(key)) grouped.set(key, { user_id, category, entries: [], earliestExpiry: entry.expiry });
    const group = grouped.get(key)!;
    group.entries.push(entry);
    if (entry.expiry < group.earliestExpiry) group.earliestExpiry = entry.expiry;
  }
  return Array.from(grouped.values()).map(group => ({
    ...group,
    entries: group.entries.slice().sort((a, b) => a.expiry.localeCompare(b.expiry) || a.record.title.localeCompare(b.record.title, 'ko')),
  })).sort((a, b) => a.earliestExpiry.localeCompare(b.earliestExpiry) || a.user_id.localeCompare(b.user_id, 'ko') || a.category.localeCompare(b.category));
};

export default function CertManagement({ users = [], currentUser = null, isAdmin = false }: {
  users?: Person[];
  currentUser?: any;
  isAdmin?: boolean;
  currentUserRole?: string;
  onUsersChanged?: (updates: Array<Partial<Person> & { id: string }>) => void;
  sharedRecords?: CertRecord[];
  recordsReady?: boolean;
  onRecordsChanged?: (records: CertRecord[]) => void;
}) {
  const role = String(currentUser?.role || currentUser?.user_role || '').toUpperCase();
  const admin = isAdmin || ['ADMIN', 'SUPER_ADMIN', 'WORK_ADMIN'].includes(role);
  const [people, setPeople] = useState<Person[]>(users);
  const [records, setRecords] = useState<CertRecord[]>([]);
  // HRManagement의 사용자 정보가 바뀔 때마다 자격 테이블을 다시 SELECT하지 않도록 메모리에 유지합니다.
  const recordsRef = useRef<CertRecord[]>([]);
  const recordsLoadedRef = useRef(false);
  const [category, setCategory] = useState<Category>('YARD');
  const [subTab, setSubTab] = useState('ALL');
  const [allQualificationListOpen, setAllQualificationListOpen] = useState(false);
  const [expandedPeople, setExpandedPeople] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CertRecord | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm('YARD'));
  const [activeAlert, setActiveAlert] = useState<CertRecord[] | null>(null);
  const [alertHidden, setAlertHidden] = useState(false);
  const [renewalSummaryOpen, setRenewalSummaryOpen] = useState(false);
  const [excelMenuOpen, setExcelMenuOpen] = useState(false);

  const notify = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'success') => setNotice({ message, type }), []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    recordsRef.current = records;
  }, [records]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      // HRManagement의 자격 상세를 읽기만 합니다. 이 컴포넌트에서는 app_users를 수정하지 않습니다.
      // HRManagement에서 사용자 목록을 전달받았다면 app_users를 중복 조회하지 않습니다.
      // 독립 렌더링 등으로 목록이 비어 있는 경우에만 DB에서 사용자 정보를 가져옵니다.
      const [personResult, recordResult] = await Promise.all([
        users.length
          ? Promise.resolve({ data: users as any[], error: null })
          : supabase.from('app_users').select('id, name, department, position, experience, career_start_date, role, national_cert_details, yard_cert_details, ndt_certificates').order('name', { ascending: true }),
        recordsLoadedRef.current
          ? Promise.resolve({ data: recordsRef.current, error: null })
          : supabase.from('cert_management_records').select('*').order('category').order('title'),
      ]);
      if (personResult.error) throw new Error(`HRManagement 자격정보 조회 실패: ${personResult.error.message}`);
      if (recordResult.error) throw new Error(`Cert 자격정보 조회 실패: ${recordResult.error.message}`);

      const parentPeople = (personResult.data || []).map((p: any) => ({
        ...p,
        id: String(p.id),
        national_cert_details: normalizeArray<{ method: string; kind: string }>(p.national_cert_details),
        yard_cert_details: normalizeArray<{ name: string; education_date: string; renewal_count: number; renewal_dates: string[] }>(p.yard_cert_details),
        ndt_certificates: normalizeArray<{ issuer: string; subject: string; level: string; issue_date: string; expiry_date: string }>(p.ndt_certificates),
      })) as Person[];
      // 전달된 HR 목록의 전화번호 등 기타 정보는 건드리지 않고, 자격/경력 데이터는 DB의 부모 원본을 사용합니다.
      const propMap = new Map(users.map(p => [String(p.id), p]));
      const mergedPeople = parentPeople.map(p => ({ ...propMap.get(p.id), ...p }));
      setPeople(mergedPeople);

      // Cert No.는 테이블 컬럼 유무와 무관하게 detail JSONB를 기준으로 복원합니다.
      let rows = ((recordResult.data || []) as CertRecord[]).map((r: any) => ({
        ...r, cert_no: r.cert_no ?? r.detail?.cert_no ?? null,
      }));
      recordsLoadedRef.current = true;
      recordsRef.current = rows;
      const bySourceKey = new Map(rows.filter(r => r.source_key).map(r => [String(r.source_key), r]));
      const inserts: any[] = [];
      const updates: Array<{ id: string; values: any }> = [];
      const validSourceKeys = new Set<string>();
      const sourceSnapshot = (category: Category, personId: string, index: number, payload: any) => JSON.stringify({ category, personId, index, payload });
      const makeSourceRecord = (person: Person, cat: Category, index: number, payload: any) => {
        const sourceKey = `${cat}:${person.id}:${index}`;
        const snapshot = sourceSnapshot(cat, person.id, index, payload);
        const base = {
          // cert_management_records.id 컬럼에 기본값이 없는 환경에서도 신규 동기화가 실패하지 않도록
          // 브라우저에서 UUID를 생성합니다. 기존 레코드의 id는 업데이트 시 그대로 유지됩니다.
          id: crypto.randomUUID(),
          user_id: person.id, category: cat, source_key: sourceKey,
          title: '', obtained_date: null, expiry_date: null, method: null, level: null,
          sticker_no: null, education_completed: null,
          training_date_1: null, training_date_2: null, training_date_3: null, training_date_4: null,
          detail: { source: 'hrmanagement', sourceSnapshot: snapshot, localModified: false },
        };
        if (cat === 'YARD') {
          const dates = normalizeArray<string>(payload.renewal_dates);
          return { ...base, title: text(payload.name).trim() || 'YARD 교육', obtained_date: text(payload.education_date) || null,
            education_completed: text(payload.education_date) || null,
            training_date_1: dates[0] || null, training_date_2: dates[1] || null, training_date_3: dates[2] || null, training_date_4: dates[3] || null,
            expiry_date: addYears(dates.filter(Boolean).sort().slice(-1)[0] || text(payload.education_date), 2) || null,
            detail: { ...base.detail, sourceSnapshot: snapshot, sourceEducationName: text(payload.name) } };
        }
        if (cat === 'NATIONAL') {
          return { ...base, title: text(payload.kind).trim() || '국가 자격', method: text(payload.method).trim() || null,
            detail: { ...base.detail, sourceSnapshot: snapshot } };
        }
        const ndtSubject = text(payload.subject).trim();
        // 이전 버전에서 날짜 키가 다르게 저장된 자료도 자격현황에 표시합니다.
        const issueDate = text(payload.issue_date || payload.obtained_date || payload.acquisition_date || payload.certification_date || payload.issued_at);
        const validDate = text(payload.expiry_date || payload.valid_date || payload.renewal_date || payload.valid_until || payload.expiration_date);
        const ltLabels = [
          { value: 'LT(BUBBLE)', label: 'Bubble', pattern: /LT\s*\(\s*BUBBLE\s*\)/i },
          { value: 'LT(Pressure Change)', label: 'Pressure Change', pattern: /LT\s*\(\s*Pressure\s+Change\s*\)/i },
          { value: 'LT(MST-He)', label: 'MST-He', pattern: /LT\s*\(\s*MST-He\s*\)/i },
        ].filter(item => item.pattern.test(ndtSubject)).map(item => item.label);
        const ndtTitle = ltLabels.length ? `LT (${ltLabels.join(', ')})` : ndtSubject || 'NDT';
        return { ...base, title: ndtTitle, method: text(payload.issuer).trim() || null,
          level: text(payload.level).trim() || null, obtained_date: issueDate || null,
          expiry_date: validDate || (issueDate ? addYears(issueDate, 5) : null),
          detail: { ...base.detail, sourceSnapshot: snapshot, issuer: text(payload.issuer) } };
      };

      for (const person of mergedPeople) {
        const sourceLists: Array<{ category: Category; list: any[] }> = [
          { category: 'YARD', list: normalizeArray(person.yard_cert_details) },
          { category: 'NATIONAL', list: normalizeArray(person.national_cert_details) },
          { category: 'NDT', list: normalizeArray(person.ndt_certificates) },
        ];
        for (const sourceList of sourceLists) {
          sourceList.list.forEach((payload, index) => {
            const candidate = makeSourceRecord(person, sourceList.category, index, payload);
            validSourceKeys.add(candidate.source_key);
            const existing = bySourceKey.get(candidate.source_key);
            if (!existing) {
              inserts.push(candidate);
            } else if (existing.detail?.source === 'hrmanagement' && existing.detail?.sourceSnapshot !== candidate.detail.sourceSnapshot) {
              // HRManagement가 자격 원본입니다. CERT에서 한 번 수정한 이력이 있어도
              // HRManagement의 취득일/유효일 변경이 막히지 않도록 원본값을 다시 반영합니다.
              // CERT에만 있는 Cert No. 등 추가 detail 값은 유지합니다.
              updates.push({ id: existing.id, values: {
                ...candidate,
                detail: { ...(existing.detail || {}), ...candidate.detail,
                  cert_no: existing.detail?.cert_no ?? null,
                  sourceSnapshot: candidate.detail.sourceSnapshot,
                  localModified: false,
                },
              } });
            }
          });
        }
      }
      // 신규 등록과 변경된 기존 기록을 한 번의 요청으로 저장해 자격별 UPDATE 반복을 방지합니다.
      // 기존 기록은 id를 포함해 upsert하므로, 변경이 감지된 행만 전송됩니다.
      const syncWrites = [
        ...inserts,
        ...updates.map(update => ({ ...update.values, id: update.id })),
      ];
      if (syncWrites.length) {
        const { data, error } = await supabase
          .from('cert_management_records')
          .upsert(syncWrites, { onConflict: 'id' })
          .select('*');
        if (error) throw new Error(`HRManagement 자격 동기화 실패: ${error.message}`);
        const savedRows = (data || []) as CertRecord[];
        const savedById = new Map(savedRows.filter(r => r.id).map(r => [String(r.id), r]));
        const insertedRows = savedRows.filter(r => !rows.some(old => String(old.id) === String(r.id)));
        rows = [
          ...rows.map(old => savedById.has(String(old.id)) ? { ...old, ...savedById.get(String(old.id)) } : old),
          ...insertedRows,
        ];
      }
      // HRManagement에서 종목을 통합해 더 이상 존재하지 않는 이전 원본 행은 화면에서 제외합니다.
      // Cert 화면에서 별도 수정(localModified)한 기록은 보존합니다.
      const visibleRows = rows.filter((row: any) => !(row.detail?.source === 'hrmanagement' && !row.detail?.localModified && row.source_key && !validSourceKeys.has(String(row.source_key))));
      recordsRef.current = visibleRows;
      setRecords(visibleRows);
    } catch (e: any) {
      setLoadError(e?.message || '자격현황을 불러오지 못했습니다. Supabase SQL 설정을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }, [users]);

  useEffect(() => { void loadData(); }, [loadData]);

  const personById = useMemo(() => new Map(people.map(p => [String(p.id), p])), [people]);
  const selfPerson = useMemo(() => {
    const id = currentUser?.id == null ? '' : String(currentUser.id);
    const byId = id ? personById.get(id) : undefined;
    if (byId) return byId;
    const name = String(currentUser?.name || currentUser?.user_name || '').trim();
    return name ? people.find(p => p.name?.trim() === name) : undefined;
  }, [currentUser, personById, people]);
  const isSelf = (record: CertRecord) => !!selfPerson && String(record.user_id) === String(selfPerson.id);
  const canEdit = (record: CertRecord) => admin || isSelf(record);
  const expiryFor = (r: CertRecord) => {
    if (r.category === 'NDT') return r.expiry_date || (r.obtained_date ? addYears(r.obtained_date, 5) : '');
    if (r.category === 'YARD') {
      const dates = [r.training_date_1, r.training_date_2, r.training_date_3, r.training_date_4, r.education_completed, r.obtained_date].filter(Boolean) as string[];
      return addYears(dates.sort().slice(-1)[0] || '', 2);
    }
    return '';
  };
  const activeRecords = useMemo(() => records.filter(r => !r.detail?.deleted), [records]);
  const renewalSummaryRecords = useMemo(() => activeRecords
    .filter(record => record.category === 'YARD' || record.category === 'NDT')
    .map(record => ({ record, expiry: expiryFor(record) }))
    .filter(item => !!item.expiry && daysUntil(item.expiry) <= 40)
    .sort((a, b) => (a.expiry || '').localeCompare(b.expiry || '') || a.record.title.localeCompare(b.record.title, 'ko')),
    [activeRecords]);
  const renewalSummaryGroups = useMemo(() => groupRenewalEntries(renewalSummaryRecords.map(item => ({
    record: item.record, expiry: item.expiry!, remaining: daysUntil(item.expiry!),
  }))), [renewalSummaryRecords]);
  const renewalSummaryPeopleCount = useMemo(() => new Set(renewalSummaryRecords.map(item => String(item.record.user_id))).size, [renewalSummaryRecords]);
  const activeAlertGroups = useMemo(() => groupRenewalEntries(
    (activeAlert || []).map(record => ({ record, expiry: expiryFor(record), remaining: daysUntil(expiryFor(record)) }))
      .filter(item => !!item.expiry)
  ), [activeAlert, activeRecords]);
  const subTabs = useMemo(() => {
    const relevant = activeRecords.filter(r => r.category === category);
    const names = Array.from(new Set(relevant.map(r => category === 'NATIONAL' ? (r.method || r.title) : r.title).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko'));
    return names;
  }, [activeRecords, category]);
  useEffect(() => {
    if (subTab !== 'ALL' && !subTabs.includes(subTab)) setSubTab('ALL');
  }, [subTabs, subTab]);
  const selectedSubtabPeopleCount = useMemo(() => {
    const matching = activeRecords.filter(r => {
      if (r.category !== category) return false;
      if (subTab === 'ALL') return true;
      const subName = category === 'NATIONAL' ? (r.method || r.title) : r.title;
      return subName === subTab;
    });
    return new Set(matching.map(r => String(r.user_id))).size;
  }, [activeRecords, category, subTab]);

  const visibleRecords = useMemo(() => activeRecords.filter(r => {
    if (r.category !== category) return false;
    const p = personById.get(String(r.user_id));
    const subName = category === 'NATIONAL' ? (r.method || r.title) : r.title;
    if (subTab !== 'ALL' && subName !== subTab) return false;
    const q = search.trim().toLocaleLowerCase();
    if (!q) return true;
    return [p?.name, p?.id, r.title, r.method, r.level, r.cert_no, r.detail?.cert_no, r.sticker_no, r.detail?.issuer]
      .some(v => text(v).toLocaleLowerCase().includes(q));
  }).sort((a, b) => {
    const nameA = personById.get(String(a.user_id))?.name || '';
    const nameB = personById.get(String(b.user_id))?.name || '';
    return nameA.localeCompare(nameB, 'ko') || a.title.localeCompare(b.title, 'ko');
  }), [activeRecords, category, subTab, search, personById]);

  const visibleGroups = useMemo(() => {
    const groups = new Map<string, { user_id: string; person?: Person; records: CertRecord[] }>();
    for (const record of visibleRecords) {
      const userId = String(record.user_id);
      if (!groups.has(userId)) groups.set(userId, { user_id: userId, person: personById.get(userId), records: [] });
      groups.get(userId)!.records.push(record);
    }
    return Array.from(groups.values());
  }, [visibleRecords, personById]);

  const setField = (key: keyof FormData, value: string) => {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      if (next.category === 'YARD' && (key === 'education_completed' || key === 'obtained_date')) {
        const base = value;
        next.education_completed = base;
        next.obtained_date = base;
        if (!next.expiry_date || prev.expiry_date === addYears(prev.education_completed || prev.obtained_date, 2)) next.expiry_date = addYears(base, 2);
      }
      if (next.category === 'NDT' && key === 'obtained_date') next.expiry_date = addYears(value, 5);
      return next;
    });
  };
  const openCreate = () => {
    if (!admin && !selfPerson) { notify('로그인 사용자 정보를 확인할 수 없습니다.', 'warning'); return; }
    setEditing(null);
    setForm(emptyForm(category, admin ? (selfPerson?.id || '') : String(selfPerson!.id)));
    setModalOpen(true);
  };
  const openEdit = (record: CertRecord) => {
    if (!canEdit(record)) { notify('본인 자격 또는 관리자만 수정할 수 있습니다.', 'warning'); return; }
    setEditing(record);
    setForm({
      user_id: String(record.user_id), category: record.category, title: record.title || '', method: record.method || '', level: record.level || '',
      obtained_date: record.obtained_date || '', expiry_date: record.expiry_date || '', education_completed: record.education_completed || '',
      sticker_no: record.sticker_no || '', cert_no: record.cert_no || text(record.detail?.cert_no) || '', training_date_1: record.training_date_1 || '',
      training_date_2: record.training_date_2 || '', training_date_3: record.training_date_3 || '', training_date_4: record.training_date_4 || '',
      issuer: String(record.detail?.issuer || record.method || '사내'),
    });
    setModalOpen(true);
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.user_id) { notify('구성원을 선택해주세요.', 'warning'); return; }
    if (!admin && String(form.user_id) !== String(selfPerson?.id || '')) { notify('본인 자격만 등록할 수 있습니다.', 'warning'); return; }
    if (!form.title.trim()) { notify(category === 'YARD' ? '교육명을 입력해주세요.' : category === 'NATIONAL' ? '자격종류를 입력해주세요.' : '종목을 입력해주세요.', 'warning'); return; }
    setSaving(true);
    const oldDetail = editing?.detail || {};
    const values: any = {
      user_id: String(form.user_id), category: form.category, title: form.title.trim(),
      method: form.category === 'NDT' ? (form.issuer.trim() || null) : (form.method.trim() || null),
      level: form.level.trim() || null,
      obtained_date: form.category === 'YARD' ? (form.education_completed || form.obtained_date || null) : (form.obtained_date || null),
      education_completed: form.category === 'YARD' ? (form.education_completed || form.obtained_date || null) : null,
      // PostgreSQL date 컬럼에는 빈 문자열을 보낼 수 없으므로, 계산 결과까지 포함해 항상 날짜 또는 null로 저장합니다.
      expiry_date: (form.expiry_date || (form.category === 'YARD' ? addYears(form.training_date_4 || form.training_date_3 || form.training_date_2 || form.training_date_1 || form.education_completed || form.obtained_date, 2) : form.category === 'NDT' ? addYears(form.obtained_date, 5) : null)) || null,
      sticker_no: form.category === 'YARD' ? (form.sticker_no.trim() || null) : null,
      // Cert No.는 아래 detail.cert_no(JSONB)에 저장하므로 별도 cert_no 컬럼에 의존하지 않습니다.
      training_date_1: form.category === 'YARD' ? (form.training_date_1 || null) : null,
      training_date_2: form.category === 'YARD' ? (form.training_date_2 || null) : null,
      training_date_3: form.category === 'YARD' ? (form.training_date_3 || null) : null,
      training_date_4: form.category === 'YARD' ? (form.training_date_4 || null) : null,
      detail: { ...oldDetail, issuer: form.issuer, cert_no: form.category === 'NDT' ? form.cert_no.trim() : null, localModified: true, editedInCert: true },
    };
    try {
      // Cert No.는 cert_management_records.detail(JSONB)에 저장합니다.
      // 따라서 cert_no 별도 컬럼의 존재 여부나 PostgREST 스키마 캐시에 영향을 받지 않습니다.
      const { cert_no: _unusedCertNo, ...dbValues } = values;
      if (editing) {
        const { data, error } = await supabase.from('cert_management_records')
          .update(dbValues).eq('id', editing.id).select('*').single();
        if (error) throw error;
        const savedRecord = { ...(data as CertRecord), cert_no: form.category === 'NDT' ? (form.cert_no.trim() || null) : null };
        setRecords(prev => prev.map(r => r.id === editing.id ? savedRecord : r));
        notify('자격정보를 수정했습니다. HRManagement 원본에는 변경사항을 보내지 않았습니다.');
      } else {
        const { data, error } = await supabase.from('cert_management_records')
          .insert({ ...dbValues, id: crypto.randomUUID(), source_key: null }).select('*').single();
        if (error) throw error;
        const savedRecord = { ...(data as CertRecord), cert_no: form.category === 'NDT' ? (form.cert_no.trim() || null) : null };
        setRecords(prev => [...prev, savedRecord]);
        notify('자격정보를 등록했습니다. HRManagement 원본에는 변경사항을 보내지 않았습니다.');
      }
      if (editing) {
        setModalOpen(false);
      } else {
        // 등록 화면을 유지해 자격 구분을 바꾸며 연속 등록할 수 있게 합니다.
        setForm(emptyForm(form.category, admin ? form.user_id : String(selfPerson?.id || '')));
      }
    } catch (e: any) {
      notify(`저장 실패: ${e?.message || '오류가 발생했습니다.'}`, 'error');
    } finally { setSaving(false); }
  };
  const removeRecord = async (record: CertRecord) => {
    if (!admin) { notify('삭제는 관리자 계정만 가능합니다.', 'warning'); return; }
    if (!window.confirm(`${personById.get(String(record.user_id))?.name || ''} · ${record.title} 자격을 삭제하시겠습니까?`)) return;
    try {
      // HRManagement에서 가져온 원본 행은 삭제 표시만 남겨 두어 다음 동기화 때 재생성되지 않게 합니다.
      const detail = { ...(record.detail || {}), deleted: true, deletedAt: new Date().toISOString() };
      const { error } = await supabase.from('cert_management_records').update({ detail }).eq('id', record.id);
      if (error) throw error;
      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, detail } : r));
      notify('자격정보를 삭제했습니다. HRManagement 원본은 변경하지 않았습니다.');
    } catch (e: any) { notify(`삭제 실패: ${e?.message || '오류가 발생했습니다.'}`, 'error'); }
  };

  const alerts = useMemo(() => activeRecords.filter(r => {
    if (r.category === 'NATIONAL') return false;
    if (!admin && !isSelf(r)) return false;
    const expiry = expiryFor(r);
    if (!expiry) return false;
    const remaining = daysUntil(expiry);
    return remaining <= 40;
  }).sort((a, b) => (expiryFor(a) || '').localeCompare(expiryFor(b) || '')), [activeRecords, admin, selfPerson]);
  useEffect(() => {
    const userKey = selfPerson?.id || currentUser?.id || currentUser?.name || 'guest';
    const key = `cert-management-alert-last-shown:${userKey}`;
    let lastShown = 0;
    try { lastShown = Number(window.localStorage.getItem(key) || 0); } catch { /* storage unavailable */ }
    const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
    const canShow = !lastShown || Date.now() - lastShown >= fiveDaysMs;
    if (alerts.length && canShow) {
      setActiveAlert(alerts);
      setAlertHidden(false);
      try { window.localStorage.setItem(key, String(Date.now())); } catch { /* storage unavailable */ }
    } else {
      setActiveAlert(null);
      setAlertHidden(true);
    }
  }, [alerts, selfPerson?.id, currentUser?.id, currentUser?.name]);
  const hideAlertForFiveDays = () => {
    const userKey = selfPerson?.id || currentUser?.id || currentUser?.name || 'guest';
    const key = `cert-management-alert-last-shown:${userKey}`;
    try { window.localStorage.setItem(key, String(Date.now())); } catch { /* storage unavailable */ }
    setAlertHidden(true); setActiveAlert(null);
  };

  const exportExcel = (target: 'ALL' | Category = category) => {
    const wb = XLSX.utils.book_new();
    const categoriesToExport: Category[] = target === 'ALL' ? ['YARD', 'NATIONAL', 'NDT'] : [target];

    const makeWorksheet = (sheetCategory: Category) => {
      const list = activeRecords.filter(r => r.category === sheetCategory).slice().sort((a, b) => {
        const aPerson = personById.get(String(a.user_id));
        const bPerson = personById.get(String(b.user_id));
        const byName = (aPerson?.name || '').localeCompare(bPerson?.name || '', 'ko');
        return byName || String(a.user_id).localeCompare(String(b.user_id), 'ko') || a.title.localeCompare(b.title, 'ko');
      });
      const title = sheetCategory === 'YARD' ? 'YARD 자격 현황' : sheetCategory === 'NATIONAL' ? '국가 자격 취득 현황' : '사내자격 취득 현황';
      let headers: string[];
      let rows: any[][];
      const nameColumn = 0;
      const employeeIdColumn = 1;
      if (sheetCategory === 'YARD') {
        headers = ['성명', '사번', '교육명', '교육일', '스티커 번호', '보수교육 1', '보수교육 2', '보수교육 3', '보수교육 4'];
        rows = list.map(r => [personById.get(String(r.user_id))?.name || '', String(r.user_id), r.title || '', r.education_completed || r.obtained_date || '', r.sticker_no || '', r.training_date_1 || '', r.training_date_2 || '', r.training_date_3 || '', r.training_date_4 || '']);
      } else if (sheetCategory === 'NATIONAL') {
        headers = ['성명', '자격종류', '종목', '취득일'];
        rows = list.map(r => [personById.get(String(r.user_id))?.name || '', r.title || '', r.method || '', r.obtained_date || '']);
      } else {
        headers = ['성명', '경력', '자격종류(Level)', '종목', '취득일', '유효일'];
        rows = list.map(r => [personById.get(String(r.user_id))?.name || '', personById.get(String(r.user_id))?.experience || '', r.level || '', r.title || '', r.obtained_date || '', r.expiry_date || (r.obtained_date ? addYears(r.obtained_date, 5) : '')]);
      }
      const sheetRows: any[][] = [[title], headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(sheetRows);
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
      // 동일 구성원의 이름 셀은 세로 병합합니다. YARD에서는 사번도 함께 병합합니다.
      let groupStart = 0;
      while (groupStart < list.length) {
        let groupEnd = groupStart + 1;
        while (groupEnd < list.length && String(list[groupEnd].user_id) === String(list[groupStart].user_id)) groupEnd++;
        if (groupEnd - groupStart > 1) {
          ws['!merges'].push({ s: { r: groupStart + 2, c: nameColumn }, e: { r: groupEnd + 1, c: nameColumn } });
          if (sheetCategory === 'YARD') {
            ws['!merges'].push({ s: { r: groupStart + 2, c: employeeIdColumn }, e: { r: groupEnd + 1, c: employeeIdColumn } });
          }
        }
        groupStart = groupEnd;
      }
      ws['!rows'] = [{ hpt: 42 }, { hpt: 24 }, ...rows.map(() => ({ hpt: 21 }))];
      ws['!cols'] = headers.map((header, col) => {
        const visibleWidth = (value: unknown) => Array.from(String(value ?? '')).reduce((width, char) => width + (char.charCodeAt(0) > 255 ? 2 : 1), 0);
        const maxLength = Math.max(visibleWidth(header), ...rows.map(row => visibleWidth(row[col])));
        if (sheetCategory === 'YARD' && col === 2) return { wch: Math.max(maxLength + 3, 12) };
        return { wch: Math.min(Math.max(maxLength + 3, 12), 42) };
      });
      const lastCol = XLSX.utils.encode_col(headers.length - 1);
      const lastRow = Math.max(2, sheetRows.length - 1);
      ws['!autofilter'] = { ref: `A2:${lastCol}${lastRow + 1}` };
      for (let r = 0; r < sheetRows.length; r++) {
        for (let c = 0; c < headers.length; c++) {
          const address = XLSX.utils.encode_cell({ r, c });
          if (!ws[address]) ws[address] = { t: 's', v: '' };
          ws[address].s = r === 0
            ? { font: { name: 'HY헤드라인M', sz: 20, bold: true }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } }
            : r === 1
              ? { font: { name: '맑은 고딕', sz: 9, bold: true }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, fill: { fgColor: { rgb: 'E8EDF3' } }, border: { bottom: { style: 'thin', color: { rgb: 'B8C2CC' } } } }
              : { font: { name: '맑은 고딕', sz: 9 }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: { bottom: { style: 'thin', color: { rgb: 'E2E5E9' } } } };
        }
      }
      return ws;
    };

    for (const sheetCategory of categoriesToExport) {
      const ws = makeWorksheet(sheetCategory);
      const sheetName = sheetCategory === 'YARD' ? 'YARD 자격 현황' : sheetCategory === 'NATIONAL' ? '국가 자격' : '사내자격 NDT';
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
    const filename = target === 'ALL' ? `자격현황_전체_${todayStr()}.xlsx`
      : `${target === 'YARD' ? 'YARD 자격 현황' : target === 'NATIONAL' ? '국가 자격 취득 현황' : '사내자격 취득 현황'}_${todayStr()}.xlsx`;
    XLSX.writeFile(wb, filename);
    setExcelMenuOpen(false);
  };

  const selectedPeople = admin ? people : people.filter(p => selfPerson && String(p.id) === String(selfPerson.id));
  const changeCategory = (next: Category) => { setCategory(next); setSubTab('ALL'); };

  return <div className="space-y-3 text-[#1F2937]">
    {notice && <div className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-xs ${notice.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : notice.type === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`} role="status"><span>{notice.message}</span><button type="button" onClick={() => setNotice(null)} aria-label="알림 닫기"><X className="h-3.5 w-3.5" /></button></div>}
    <div className="rounded-xl border border-[#E2E5E9] bg-white p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><Award className="h-5 w-5 text-[#243B5A]"/><div><h2 className="text-sm font-bold text-[#243B5A]">자격현황 관리</h2><p className="mt-0.5 text-[10px] text-[#64748B]">HRManagement에서 자격을 가져옵니다. Cert에서 변경한 내용은 HRManagement 원본에 반영되지 않습니다.</p></div></div>
      </div>
      <div className="overflow-hidden rounded-lg border border-red-200 bg-white">
        <button type="button" onClick={() => setRenewalSummaryOpen(value => !value)} aria-expanded={renewalSummaryOpen} className="flex w-full items-center gap-2 bg-red-50 px-3 py-2 text-left hover:bg-red-100">
          {renewalSummaryOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-red-600"/> : <ChevronRight className="h-4 w-4 shrink-0 text-red-600"/>}
          <span className="text-xs font-bold text-red-700">자격갱신 대상</span>
          <span className="text-[10px] text-red-700">인원 {renewalSummaryPeopleCount}명 · 갱신 항목 {renewalSummaryRecords.length}건</span>
          <span className="ml-auto text-[10px] text-red-600">{renewalSummaryOpen ? '접기' : '펼쳐보기'}</span>
        </button>
        {renewalSummaryOpen && <div className="max-h-72 space-y-2 overflow-y-auto p-3">
          {renewalSummaryGroups.length === 0 ? <p className="text-xs text-[#64748B]">현재 갱신 대상 자격이 없습니다.</p> : renewalSummaryGroups.map(group => {
            const person = personById.get(String(group.user_id));
            return <div key={`${group.user_id}-${group.category}`} className="rounded-lg border border-[#E2E5E9] bg-[#F8FAFC] px-3 py-2.5 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-[#243B5A]">{person?.name || group.user_id}</span>
                <span className="text-[#64748B]">({group.user_id})</span>
                <span className={`ml-auto rounded-md px-2 py-1 text-[10px] font-bold ${group.category === 'YARD' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'}`}>{group.category === 'YARD' ? 'YARD 자격' : 'NDT Level'}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {group.entries.map(({ record, expiry, remaining }) => <div key={record.id} className="max-w-full rounded-md border border-red-100 bg-white px-2 py-1.5">
                  <div className="break-words font-semibold text-[#1F2937]">{record.title}{record.category === 'NDT' && record.level ? ` · ${record.level}` : ''}</div>
                  <div className="mt-0.5 text-[10px] text-[#64748B]">유효기간 {expiry} · {remaining < 0 ? `${Math.abs(remaining)}일 경과` : remaining === 0 ? '오늘 만료' : `${remaining}일 남음`}</div>
                </div>)}
              </div>
            </div>;
          })}
        </div>}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => void loadData()} disabled={loading} className="flex items-center gap-1 rounded-lg border border-[#E2E5E9] bg-white px-3 py-2 text-xs font-bold text-[#243B5A] disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}/> 새로고침</button>
        {admin && <div className="relative">
          <button type="button" onClick={() => setExcelMenuOpen(value => !value)} aria-expanded={excelMenuOpen} className="flex items-center gap-1 rounded-lg border border-[#E2E5E9] bg-white px-3 py-2 text-xs font-bold text-[#243B5A]"><Download className="h-3.5 w-3.5"/> Excel 저장 <ChevronDown className="h-3.5 w-3.5"/></button>
          {excelMenuOpen && <div className="absolute right-0 top-full z-50 mt-1 min-w-[190px] overflow-hidden rounded-lg border border-[#E2E5E9] bg-white p-1 shadow-lg">
            {([{ key: 'ALL', label: '전체 내려받기' }, { key: 'YARD', label: 'YARD 자격' }, { key: 'NATIONAL', label: '국가자격' }, { key: 'NDT', label: '사내자격(NDT Level)' }] as Array<{ key: 'ALL' | Category; label: string }>).map(item => <button key={item.key} type="button" onClick={() => exportExcel(item.key)} className="block w-full rounded-md px-3 py-2 text-left text-xs font-semibold text-[#243B5A] hover:bg-[#F5F6F8]">{item.label}</button>)}
          </div>}
        </div>}
        <button type="button" onClick={openCreate} className="flex items-center gap-1 rounded-lg bg-[#243B5A] px-3 py-2 text-xs font-bold text-white"><Plus className="h-3.5 w-3.5"/> 자격 등록</button>
      </div>
    </div>

    <div className="flex flex-wrap gap-2 rounded-xl border border-[#E2E5E9] bg-white p-2">
      {categories.map(item => <button key={item.key} type="button" onClick={() => changeCategory(item.key)} className={`rounded-lg border px-3 py-2 text-xs font-bold ${category === item.key ? 'border-[#243B5A] bg-[#243B5A] text-white' : 'border-[#E2E5E9] bg-[#F5F6F8] text-[#64748B] hover:text-[#243B5A]'}`}>{item.label}</button>)}
    </div>

    <div className="rounded-xl border border-[#E2E5E9] bg-white p-3 space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(180px,1fr)_minmax(180px,2fr)]">
        <label className="block text-[10px] font-bold text-[#64748B]">교육명 / 종목 서브탭<AppStyledSelect className={`${inputClass} mt-1`} ariaLabel="교육명 / 종목 선택" value={subTab} onChange={setSubTab} options={[{ value: 'ALL', label: '전체 자격' }, ...subTabs.map(name => ({ value: name, label: name }))]} /><span className="mt-1 block text-[11px] font-bold text-[#243B5A]">{subTab === 'ALL' ? '전체' : subTab} 인원: {selectedSubtabPeopleCount}명</span></label>
        <label className="text-[10px] font-bold text-[#64748B]">이름 · 사번 · 자격명 검색<div className="relative mt-1"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]"/><input className={`${inputClass} pl-8`} value={search} onChange={e => setSearch(e.target.value)} placeholder="이름, 로그인 아이디(사번), 교육명 또는 종목" /></div></label>
      </div>
      {loadError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700"><b>불러오기 실패</b><p className="mt-1 break-words">{loadError}</p><p className="mt-1">먼저 제공된 Supabase SQL을 실행했는지 확인해주세요.</p></div>}
      {loading ? <div className="py-12 text-center text-xs text-[#64748B]">자격정보를 불러오는 중...</div> : visibleGroups.length === 0 ? <div className="rounded-lg border border-dashed border-[#E2E5E9] bg-[#F5F6F8] p-8 text-center text-xs text-[#64748B]">표시할 자격이 없습니다. HRManagement에 등록된 자격이 있으면 새로고침을 눌러 가져올 수 있습니다.</div> : <div className="overflow-hidden rounded-lg border border-[#E2E5E9] bg-white">
        <button type="button" disabled={subTab !== 'ALL'} onClick={() => setAllQualificationListOpen(value => !value)} aria-expanded={subTab !== 'ALL' || allQualificationListOpen} className={`flex w-full items-center gap-2 px-3 py-2 text-left ${subTab === 'ALL' ? 'bg-[#F5F6F8] hover:bg-[#EDF1F5]' : 'cursor-default bg-[#F8FAFC]'}`}>
          {(subTab !== 'ALL' || allQualificationListOpen) ? <ChevronDown className="h-4 w-4 shrink-0 text-[#64748B]"/> : <ChevronRight className="h-4 w-4 shrink-0 text-[#64748B]"/>}
          <span className="text-xs font-bold text-[#243B5A]">자격 목록</span>
          <span className="text-[10px] text-[#64748B]">{subTab === 'ALL' ? '전체 자격' : subTab} · {visibleGroups.length}명</span>
          <span className="ml-auto text-[10px] text-[#64748B]">{subTab !== 'ALL' ? '선택한 항목 펼침' : allQualificationListOpen ? '접기' : '펼쳐보기'}</span>
        </button>
        {(subTab !== 'ALL' || allQualificationListOpen) && <div className="space-y-2 border-t border-[#E2E5E9] bg-white p-2">
        {visibleGroups.map(group => {
          const refreshRecords = group.records;
          const renewalRecords = refreshRecords.filter(record => {
            if (record.category === 'NATIONAL') return false;
            const expiry = expiryFor(record);
            if (!expiry) return false;
            const remaining = daysUntil(expiry);
            return remaining <= 40;
          });
          const personOpen = !!expandedPeople[group.user_id];
          return <div key={group.user_id} className="overflow-hidden rounded-lg border border-[#E2E5E9] bg-white">
            <button type="button" onClick={() => setExpandedPeople(current => ({ ...current, [group.user_id]: !current[group.user_id] }))} aria-expanded={personOpen} className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left hover:bg-[#F8FAFC]">
              <span className="flex min-w-0 flex-1 items-start gap-2"><span className="mt-0.5 shrink-0 text-[#64748B]">{personOpen ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}</span><span className="min-w-0 flex-1"><span className="block text-xs font-bold text-[#243B5A]">{group.person?.name || group.user_id} <span className="font-normal text-[#64748B]">({group.user_id})</span></span><span className="mt-1 flex flex-wrap gap-1.5">{refreshRecords.map(record => <span key={record.id} className="rounded-md border border-[#E2E5E9] bg-[#F5F6F8] px-2 py-1 text-[10px] text-[#1F2937]">{category === 'NDT' ? `${record.title}${record.level ? ` · ${record.level}` : ''}` : category === 'NATIONAL' ? `${record.title}${record.method ? ` · ${record.method}` : ''}` : record.title}</span>)}</span></span></span>
              <span className="flex shrink-0 flex-col items-end gap-1 text-right">{renewalRecords.length > 0 && <span className="rounded-md bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600">자격갱신</span>}<span className="text-[10px] text-[#64748B]">자격 {refreshRecords.length}건</span></span>
            </button>
            {personOpen && <div className="space-y-2 border-t border-[#E2E5E9] bg-[#F8FAFC] p-3">
              {refreshRecords.map(record => {
                const person = group.person;
                const expiry = expiryFor(record);
                const remaining = expiry ? daysUntil(expiry) : null;
                const needsRenewal = record.category !== 'NATIONAL' && remaining !== null && remaining <= 40;
                return <div key={record.id} className="rounded-lg border border-[#E2E5E9] bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2"><div><div className="text-xs font-bold text-[#243B5A]">{category === 'NDT' ? `${record.title}${record.level ? ` · ${record.level}` : ''}` : category === 'NATIONAL' ? `${record.title}${record.method ? ` · ${record.method}` : ''}` : record.title}</div><div className="mt-1 text-[10px] text-[#64748B]">{category === 'YARD' ? `교육일 ${record.education_completed || record.obtained_date || '미입력'} · 유효기간 ${expiry || '미입력'}` : category === 'NATIONAL' ? `취득일 ${record.obtained_date || '미입력'}` : `취득일 ${record.obtained_date || '미입력'} · 유효일 ${expiry || '미입력'}`}</div></div>{needsRenewal && <span className="rounded-md bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600">자격갱신{remaining !== null ? (remaining < 0 ? ` · ${Math.abs(remaining)}일 경과` : remaining === 0 ? ' · 오늘 만료' : ` · ${remaining}일 남음`) : ''}</span>}</div>
                  <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2 lg:grid-cols-3">
                    {category === 'YARD' && <><div><span className="font-bold text-[#64748B]">스티커 번호</span><p className="mt-1">{record.sticker_no || '-'}</p></div>{[1,2,3,4].map(n => <div key={n}><span className="font-bold text-[#64748B]">보수교육 {n}</span><p className="mt-1">{(record as any)[`training_date_${n}`] || '-'}</p></div>)} </>}
                    {category === 'NATIONAL' && <><div><span className="font-bold text-[#64748B]">자격종류</span><p className="mt-1">{record.title || '-'}</p></div><div><span className="font-bold text-[#64748B]">종목</span><p className="mt-1">{record.method || '-'}</p></div></>}
                    {category === 'NDT' && <><div><span className="font-bold text-[#64748B]">경력</span><p className="mt-1">{person?.experience || '-'}</p></div><div><span className="font-bold text-[#64748B]">발급형태</span><p className="mt-1">{record.detail?.issuer || record.method || '-'}</p></div><div><span className="font-bold text-[#64748B]">Cert No.</span><p className="mt-1">{record.cert_no || text(record.detail?.cert_no) || '-'}</p></div></>}
                  </div>
                  <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-[#E2E5E9] pt-3">{canEdit(record) && <button type="button" onClick={() => openEdit(record)} className="flex items-center gap-1 rounded-lg border border-[#E2E5E9] bg-white px-3 py-2 text-[11px] font-bold text-[#243B5A]"><Edit3 className="h-3.5 w-3.5"/> 수정</button>}{admin && <button type="button" onClick={() => void removeRecord(record)} className="flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-2 text-[11px] font-bold text-red-600"><Trash2 className="h-3.5 w-3.5"/> 삭제</button>}</div>
                </div>;
              })}
            </div>}
          </div>;
        })}
        </div>}
      </div>}
    </div>

    {activeAlert && !alertHidden && activeAlert.length > 0 && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 p-3">
      <div className="w-full max-w-xl space-y-3 rounded-xl border border-[#E2E5E9] bg-white p-4 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-[#E2E5E9] pb-2"><AlertTriangle className="h-5 w-5 text-red-600"/><h3 className="text-sm font-bold text-[#243B5A]">자격갱신 알림</h3><span className="ml-auto rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600">{activeAlert.length}건</span></div>
        <p className="text-xs text-[#64748B]">YARD 및 사내자격(NDT Level)의 유효기간이 40일 이내이거나 이미 지난 자격입니다. 알림은 5일 간격으로 표시됩니다.</p>
        <div className="max-h-[55vh] space-y-2 overflow-y-auto rounded-lg bg-[#F5F6F8] p-2">{activeAlertGroups.map(group => {
          const person = personById.get(String(group.user_id));
          return <div key={`${group.user_id}-${group.category}`} className="rounded-lg border border-[#E2E5E9] bg-white p-3 text-xs">
            <div className="flex flex-wrap items-center gap-2"><div><b className="text-[#243B5A]">{person?.name || group.user_id}</b><span className="ml-1 text-[#64748B]">({group.user_id})</span></div><span className={`rounded-md px-2 py-1 font-bold ${group.category === 'YARD' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'}`}>{group.category === 'YARD' ? 'YARD 자격' : 'NDT Level'}</span><span className="ml-auto rounded-md bg-red-50 px-2 py-1 font-bold text-red-600">자격갱신</span></div>
            <div className="mt-2 flex flex-wrap gap-1.5">{group.entries.map(({ record, expiry, remaining }) => <div key={record.id} className="rounded-md border border-[#E2E5E9] bg-[#F8FAFC] px-2 py-1.5"><div className="font-semibold text-[#1F2937]">{record.title}{record.category === 'NDT' && record.level ? ` · ${record.level}` : ''}</div><div className="mt-0.5 text-[10px] text-[#64748B]">유효기간 {expiry} · {remaining < 0 ? `${Math.abs(remaining)}일 경과` : remaining === 0 ? '오늘 만료' : `${remaining}일 남음`}</div></div>)}</div>
          </div>;
        })}</div>
        <div className="flex justify-end gap-2"><button type="button" onClick={hideAlertForFiveDays} className="rounded-lg border border-[#E2E5E9] px-3 py-2 text-xs font-bold text-[#64748B]">5일간 보지 않기</button><button type="button" onClick={() => { setAlertHidden(true); setActiveAlert(null); }} className="rounded-lg bg-[#243B5A] px-4 py-2 text-xs font-bold text-white">닫기</button></div>
      </div>
    </div>}

    {modalOpen && <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/40 p-3">
      <form onSubmit={save} className="max-h-[92vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-xl border border-[#E2E5E9] bg-white p-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E2E5E9] pb-2"><h3 className="text-sm font-bold text-[#243B5A]">{editing ? '자격정보 수정' : `${categories.find(c => c.key === category)?.label} 등록`}</h3><button type="button" onClick={() => setModalOpen(false)} aria-label="닫기"><X className="h-4 w-4"/></button></div>
        {!editing && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><label className="block text-[11px] font-bold text-[#64748B]">자격 구분<AppStyledSelect className={`${inputClass} mt-1`} ariaLabel="자격 구분 선택" value={form.category} onChange={value => { const next = value as Category; setForm(emptyForm(next, admin ? form.user_id : String(selfPerson?.id || ''))); setCategory(next); setSubTab('ALL'); }} options={[{ value: 'YARD', label: 'YARD 자격' }, { value: 'NATIONAL', label: '국가 자격' }, { value: 'NDT', label: '사내자격 (NDT Level)' }]} /></label><label className="block text-[11px] font-bold text-[#64748B]">성명 / 사번<AppStyledSelect className={`${inputClass} mt-1`} ariaLabel="구성원 선택" value={form.user_id} onChange={value => setField('user_id', value)} placeholder="구성원 선택" disabled={!admin} options={[{ value: '', label: '구성원 선택' }, ...selectedPeople.map(p => ({ value: String(p.id), label: `${p.name} (${p.id})` }))]} /></label></div>}
        {editing && <div className="rounded-lg bg-[#F5F6F8] p-2 text-[11px] text-[#64748B]">대상: {personById.get(String(form.user_id))?.name || form.user_id} ({form.user_id}) · {form.category}</div>}
        {form.category === 'YARD' && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><label className="text-[11px] font-bold text-[#64748B]">교육명 *<input className={`${inputClass} mt-1`} value={form.title} onChange={e => setField('title', e.target.value)} required /></label><label className="text-[11px] font-bold text-[#64748B]">교육일<CalendarDatePicker className={`${inputClass} mt-1`} value={form.education_completed || form.obtained_date || ''} onChange={date => { setField('education_completed', date); }} /></label><label className="text-[11px] font-bold text-[#64748B]">스티커 번호<input className={`${inputClass} mt-1`} value={form.sticker_no} onChange={e => setField('sticker_no', e.target.value)} /></label>{[1,2,3,4].map(n => <label key={n} className="text-[11px] font-bold text-[#64748B]">보수교육 {n}<CalendarDatePicker className={`${inputClass} mt-1`} value={(form as any)[`training_date_${n}`] || ''} onChange={date => setField((`training_date_${n}`) as keyof FormData, date)} /></label>)}<label className="text-[11px] font-bold text-[#64748B]">유효기간<CalendarDatePicker className={`${inputClass} mt-1`} value={form.expiry_date || addYears(form.training_date_4 || form.training_date_3 || form.training_date_2 || form.training_date_1 || form.education_completed, 2)} onChange={date => setField('expiry_date', date)} /></label></div>}
        {form.category === 'NATIONAL' && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><label className="block text-[11px] font-bold text-[#64748B]">자격종류 *<AppStyledSelect className={`${inputClass} mt-1`} ariaLabel="국가자격 종류 선택" value={form.title} onChange={value => setField('title', value)} placeholder="선택" options={[{ value: '', label: '선택' }, ...['기사','산업기사','기능사','기술사','RI','SRI'].map(v => ({ value: v, label: v }))]} /></label><label className="text-[11px] font-bold text-[#64748B]">종목<input className={`${inputClass} mt-1`} value={form.method} onChange={e => setField('method', e.target.value)} placeholder="예: UT 기능사, 지게차 등" /></label><label className="text-[11px] font-bold text-[#64748B]">취득일<CalendarDatePicker className={`${inputClass} mt-1`} value={form.obtained_date || ''} onChange={date => setField('obtained_date', date)} /></label></div>}
        {form.category === 'NDT' && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><label className="block text-[11px] font-bold text-[#64748B]">발급형태<AppStyledSelect className={`${inputClass} mt-1`} ariaLabel="발급형태 선택" value={form.issuer} onChange={value => setField('issuer', value)} options={[{ value: '사내', label: '사내' }, { value: 'ASNT/ISO', label: 'ASNT/ISO' }]} /></label><label className="text-[11px] font-bold text-[#64748B]">종목 *<input className={`${inputClass} mt-1`} value={form.title} onChange={e => setField('title', e.target.value)} placeholder="예: LT(BUBBLE), PT" required /></label><label className="block text-[11px] font-bold text-[#64748B]">자격종류(Level)<AppStyledSelect className={`${inputClass} mt-1`} ariaLabel="NDT Level 선택" value={form.level} onChange={value => setField('level', value)} placeholder="선택" options={[{ value: '', label: '선택' }, { value: 'Level I', label: 'Level I' }, { value: 'Level II', label: 'Level II' }, { value: 'Level III', label: 'Level III' }]} /></label><label className="text-[11px] font-bold text-[#64748B]">취득일<CalendarDatePicker className={`${inputClass} mt-1`} value={form.obtained_date || ''} onChange={date => setField('obtained_date', date)} /></label><label className="text-[11px] font-bold text-[#64748B]">유효일<CalendarDatePicker className={`${inputClass} mt-1`} value={form.expiry_date || addYears(form.obtained_date, 5)} onChange={date => setField('expiry_date', date)} /></label><label className="text-[11px] font-bold text-[#64748B]">Cert No.<input className={`${inputClass} mt-1`} value={form.cert_no} onChange={e => setField('cert_no', e.target.value)} /></label></div>}
        <div className="flex justify-end gap-2 border-t border-[#E2E5E9] pt-3"><button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-[#E2E5E9] px-3 py-2 text-xs font-bold text-[#64748B]">취소</button><button type="submit" disabled={saving} className="rounded-lg bg-[#243B5A] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? '저장 중...' : '저장'}</button></div>
      </form>
    </div>}
  </div>;
}
