'use client';

import React, { Fragment, useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx-js-style';
import { 
  Users, 
  Building2, 
  Briefcase, 
  Search, 
  Edit3, 
  Trash2,
  UserPlus, 
  X, 
  Check,
  Phone,
  Layers,
  Settings,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AtSign,
  Network,
  GitCommit,
  Shield,
  CalendarDays,
  ChevronLeft
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { exportHRToExcel, exportHRToPptx } from '@/lib/hrExport';
import CertManagement from './cert';

export interface HRUser {
  id: string;          
  name: string;
  email?: string;
  department?: string; 
  position?: string;   
  job_title?: string;  
  field?: string;      
  role?: string;       
  phone?: string;
  address?: string;
  experience?: string;
  internal_certificates?: string;
  national_certificates?: string; 
  certificates?: string;
  national_cert_details?: Array<{ method: string; kind: string }>;
  yard_cert_details?: Array<{ name: string; education_date: string; renewal_count: number; renewal_dates: string[] }>; 
  ndt_certificates?: Array<{ issuer: string; subject: string; level: string; issue_date: string; expiry_date: string }>; 
  join_date?: string;          
  career_start_date?: string;  
  password?: string;           
  pos_x?: number;              
  pos_y?: number;              
  photo_url?: string | null;
  work_status?: '근무중' | '휴무' | string;
  absence_dates?: string[];
}

interface HRManagementProps {
  isAdmin?: boolean;
  currentUserRole?: string;
  currentUser?: any;
  initialAction?: 'self-edit' | 'my-team' | 'dormitory' | null;
  onInitialActionHandled?: () => void;
  onCurrentUserStatusChange?: (status: '근무중' | '휴무') => void;
}

function normalizeForCompare(value: any): any {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return value.map(normalizeForCompare);
  if (typeof value === 'object') {
    return Object.keys(value).sort().reduce((result: Record<string, any>, key) => {
      result[key] = normalizeForCompare(value[key]);
      return result;
    }, {});
  }
  return value;
}

function valuesEqualForSave(left: any, right: any): boolean {
  return JSON.stringify(normalizeForCompare(left)) === JSON.stringify(normalizeForCompare(right));
}

// 날짜별 휴무는 브라우저의 현지 날짜(한국 시간대 환경 포함)를 기준으로 판정합니다.
function getLocalDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

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

function addYearsToDate(dateStr: string, years: number) {
  if (!dateStr) return '';
  const date = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setFullYear(date.getFullYear() + years);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
            className="relative w-[min(320px,calc(100vw-32px))] max-h-[calc(100dvh-32px))] overflow-y-auto rounded-2xl border border-[#E2E5E9] bg-white p-3 shadow-[0_12px_32px_rgba(15,23,42,0.18)] text-[#1F2937]"
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

const NATIONAL_KINDS = ['기능사', '산업기사', '기사', '기술사', 'RI', 'SRI'];
const DEFAULT_NDT_SUBJECTS = ['LT(BUBBLE)', 'LT(Pressure Change)', 'LT(MST-He)', 'PT'];

function calculateAge(birthStr?: string) {
  if (!birthStr) return null;
  
  let cleanStr = birthStr.replace(/[^0-9]/g, '');
  if (cleanStr.length !== 8) return null;

  const year = parseInt(cleanStr.substring(0, 4), 10);
  const month = parseInt(cleanStr.substring(4, 6), 10) - 1;
  const day = parseInt(cleanStr.substring(6, 8), 10);

  const today = new Date();
  let age = today.getFullYear() - year;
  const m = today.getMonth() - month;
  
  if (m < 0 || (m === 0 && today.getDate() < day)) {
    age--;
  }

  return isNaN(age) ? null : age;
}

type HROrgCategoryOption = { value: string; label: string };

/** CERT 자격관리와 동일한 모달형 드롭다운 스타일 */
function HROrgCategorySelect({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: string;
  options: HROrgCategoryOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const selected = options.find(option => option.value === value);
  const selectClass = 'w-full rounded-lg border border-[#E2E5E9] bg-[#F5F6F8] px-3 py-2 text-xs text-[#1F2937] outline-none focus:border-[#243B5A] focus:bg-white';

  return <>
    <button
      type="button"
      className={`${selectClass} flex items-center justify-between gap-2 text-left hover:border-[#243B5A]`}
      onClick={() => setOpen(true)}
      aria-label={ariaLabel}
      aria-haspopup="dialog"
      aria-expanded={open}
    >
      <span className="min-w-0 flex-1 truncate text-[#1F2937]">{selected?.label || '선택해주세요'}</span>
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

const DEPT_ORDER = ['운영', '관리', '1팀', '2팀', '3팀', '4팀'];

function getNationalCertLabels(user: HRUser): string[] {
  return (Array.isArray(user.national_cert_details) ? user.national_cert_details : [])
    .map((cert) => [String(cert.kind || '').trim(), String(cert.method || '').trim()].filter(Boolean).join(' '))
    .filter(Boolean);
}

function getYardCertLabels(user: HRUser): string[] {
  const raw = user.yard_cert_details as any;
  const list = Array.isArray(raw)
    ? raw
    : (raw && typeof raw === 'object' && typeof raw.names === 'string'
      ? raw.names.split(',').map((name: string) => ({ name: name.trim() }))
      : []);
  return list.map((cert: any) => String(cert?.name || '').trim()).filter(Boolean);
}

const LT_SUBJECTS = [
  { value: 'LT(BUBBLE)', label: 'Bubble', pattern: /LT\s*\(\s*BUBBLE\s*\)/i },
  { value: 'LT(Pressure Change)', label: 'Pressure Change', pattern: /LT\s*\(\s*Pressure\s+Change\s*\)/i },
  { value: 'LT(MST-He)', label: 'MST-He', pattern: /LT\s*\(\s*MST-He\s*\)/i },
];

function isLtCertificateSubject(subject: string): boolean {
  return LT_SUBJECTS.some(item => item.pattern.test(String(subject || '')));
}

function getLtSubjects(subject: string): string[] {
  const raw = String(subject || '');
  return LT_SUBJECTS.filter(item => item.pattern.test(raw)).map(item => item.value);
}

function normalizeNdtCertificates(list: Array<{ issuer: string; subject: string; level: string; issue_date: string; expiry_date: string }> = []) {
  const normalizedList = (Array.isArray(list) ? list : []).map((item: any) => ({
    ...item,
    issue_date: String(item?.issue_date || item?.obtained_date || item?.acquisition_date || item?.certification_date || item?.issued_at || ''),
    expiry_date: String(item?.expiry_date || item?.valid_date || item?.renewal_date || item?.valid_until || item?.expiration_date || ''),
  }));
  const ltRows = normalizedList.filter(item => isLtCertificateSubject(item.subject));
  const otherRows = normalizedList.filter(item => !isLtCertificateSubject(item.subject));
  if (!ltRows.length) return list;
  const subjects = Array.from(new Set(ltRows.flatMap(item => getLtSubjects(item.subject))));
  const base = ltRows[0];
  const combined = {
    issuer: base.issuer || '사내',
    subject: subjects.join(', '),
    level: base.level || 'Level I',
    issue_date: base.issue_date || ltRows.find(item => item.issue_date)?.issue_date || '',
    expiry_date: base.expiry_date || ltRows.find(item => item.expiry_date)?.expiry_date || '',
  };
  return [...otherRows, combined].sort((a, b) => {
    const aLt = isLtCertificateSubject(a.subject) ? 0 : 1;
    const bLt = isLtCertificateSubject(b.subject) ? 0 : 1;
    return aLt - bLt;
  });
}

function getNdtCertLabels(user: HRUser): string[] {
  return normalizeNdtCertificates(Array.isArray(user.ndt_certificates) ? user.ndt_certificates : [])
    .map((cert) => {
      const subject = String(cert.subject || '').trim();
      const level = String(cert.level || '').trim();
      const issuer = String(cert.issuer || '').trim();
      if (isLtCertificateSubject(subject)) {
        const labels = getLtSubjects(subject).map(value => LT_SUBJECTS.find(item => item.value === value)?.label || value);
        return `LT ${level}${labels.length ? ` (${labels.join(', ')})` : ''}`.trim();
      }
      const main = [subject, level].filter(Boolean).join(' ');
      return main || issuer;
    })
    .filter(Boolean);
}

function renderCertText(labels: string[]): string {
  return labels.length ? labels.join(', ') : '없음';
}

function isFormerEmployee(user: HRUser): boolean {
  const values = [user.department, user.position, user.job_title, user.field]
    .map(value => String(value || '').trim().toLowerCase());
  return values.some(value => /퇴사|퇴직|퇴사자|퇴직자/.test(value));
}

const RANK_ORDER: Record<string, number> = {
  '책임': 1,
  '프로': 2,
  '매니저': 3,
  '사원': 4
};

const JOB_TITLE_ORDER_IN_RANK: Record<string, number> = {
  '본부장': 1,
  '소장': 2,
  '팀장': 3,
  '팀원': 4,
  '없음': 5
};

type StyledDropdownProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'children'> & {
  value?: string | number;
  onChange?: (event: { target: { value: string } }) => void;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
};

function StyledDropdown({ value, onChange, children, className = '', disabled = false, ...props }: StyledDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const options = React.Children.toArray(children).filter((child: any) => React.isValidElement(child) && child.type === 'option') as React.ReactElement<any>[];
  const selectedOption = options.find((option) => String(option.props.value ?? option.props.children ?? '') === String(value ?? ''));
  const selectedLabel = selectedOption ? selectedOption.props.children : (value ?? '선택');

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (event: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  const widthClass = className.includes('w-full') ? 'w-full' : '';
  const marginClass = className.split(' ').filter((part: string) => part.startsWith('mt-') || part.startsWith('mb-')).join(' ');
  const handleChoose = (option: React.ReactElement<any>) => {
    if (option.props.disabled) return;
    const nextValue = option.props.value ?? option.props.children ?? '';
    onChange?.({ target: { value: String(nextValue) } });
    setIsOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${widthClass} ${marginClass}`} {...props}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className={`w-full min-h-[34px] flex items-center justify-between gap-2 p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] text-left focus:bg-white focus:border-[#243B5A] focus:outline-none focus:ring-2 focus:ring-[#243B5A]/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className.includes('font-bold') ? 'font-bold' : ''}`}
      >
        <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-[#64748B] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div role="listbox" className="absolute left-0 right-0 top-[calc(100%+4px)] z-[120] max-h-60 overflow-y-auto overscroll-contain rounded-xl border border-[#E2E5E9] bg-white p-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.18)]">
          {options.map((option, index) => {
            const optionValue = option.props.value ?? option.props.children ?? '';
            const isSelected = String(optionValue) === String(value ?? '');
            return (
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                key={option.key ?? `${String(optionValue)}-${index}`}
                disabled={option.props.disabled}
                onClick={() => handleChoose(option)}
                className={`w-full rounded-lg px-3 py-2.5 text-left text-xs transition-colors ${isSelected ? 'bg-[#243B5A] font-bold text-white' : 'text-[#1F2937] hover:bg-[#F1F5F9] active:bg-[#E2E8F0]'} ${option.props.disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
              >
                {option.props.children}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MultiDateCalendar({ value, onChange }: { value: string[]; onChange: (dates: string[]) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    const first = value?.[0];
    return first && /^\d{4}-\d{2}-\d{2}$/.test(first) ? new Date(`${first}T12:00:00`) : new Date();
  });
  const selected = new Set(value || []);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const todayDate = new Date();
  const today = `${todayDate.getFullYear()}-${String(todayDate.getMonth()+1).padStart(2,'0')}-${String(todayDate.getDate()).padStart(2,'0')}`;
  const dateKey = (day: number) => `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  const toggleDate = (date: string) => {
    const next = new Set(selected);
    if (next.has(date)) next.delete(date); else next.add(date);
    onChange(Array.from(next).sort());
  };
  return <div className="space-y-2">
    <button type="button" onClick={() => setIsOpen(true)} className="w-full rounded-lg border border-[#E2E5E9] bg-white px-3 py-2 text-left text-xs font-semibold text-[#243B5A] hover:bg-[#F5F6F8]">
      <span className="inline-flex items-center gap-2"><CalendarDays size={15}/> 휴무 날짜 선택</span>
      <span className="float-right rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">{selected.size}일 선택</span>
    </button>
    {selected.size > 0 && <div className="flex flex-wrap gap-1.5">{Array.from(selected).sort().map(date => <button key={date} type="button" onClick={() => toggleDate(date)} title="눌러서 날짜 해제" className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">{date} ×</button>)}</div>}
    {isOpen && <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40 p-3" onMouseDown={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}>
      <div role="dialog" aria-modal="true" aria-label="휴무 날짜 선택" className="w-full max-w-sm rounded-2xl border border-[#E2E5E9] bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={() => setViewDate(new Date(year, month-1, 1))} className="rounded-lg p-2 hover:bg-[#F5F6F8]" aria-label="이전 달"><ChevronLeft size={18}/></button>
          <div className="text-sm font-extrabold text-[#243B5A]">{year}년 {month+1}월</div>
          <button type="button" onClick={() => setViewDate(new Date(year, month+1, 1))} className="rounded-lg p-2 hover:bg-[#F5F6F8]" aria-label="다음 달"><ChevronRight size={18}/></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[#64748B]">{['일','월','화','수','목','금','토'].map(d => <div key={d} className="py-1">{d}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">{Array.from({length:firstDay}, (_,i) => <div key={`blank-${i}`} />)}{Array.from({length:days}, (_,i) => { const date=dateKey(i+1); const isSelected=selected.has(date); return <button key={date} type="button" onClick={() => toggleDate(date)} className={`aspect-square rounded-lg text-xs font-semibold transition ${isSelected ? 'bg-blue-600 text-white' : date===today ? 'border border-[#243B5A] bg-white text-[#243B5A]' : 'bg-[#F5F6F8] text-[#1F2937] hover:bg-blue-50'}`}>{i+1}</button>; })}</div>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#E2E5E9] pt-3">
          <button type="button" onClick={() => onChange([])} className="rounded-lg px-3 py-2 text-xs font-semibold text-[#64748B] hover:bg-[#F5F6F8]">전체 해제</button>
          <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg bg-[#243B5A] px-4 py-2 text-xs font-bold text-white">선택 완료 ({selected.size}일)</button>
        </div>
      </div>
    </div>}
  </div>;
}

export default function HRManagement({ 
  isAdmin = false, 
  currentUserRole = '',
  currentUser = null,
  initialAction = null,
  onInitialActionHandled,
  onCurrentUserStatusChange
}: HRManagementProps) {
  const [users, setUsers] = useState<HRUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ORG' | 'LIST' | 'CERT'>('ORG');
  const [searchTerm, setSearchTerm] = useState('');

  const [subGroupType, setSubGroupType] = useState<'DEPT' | 'POS' | 'DORM'>('DEPT');
  const [dormitoryLocations, setDormitoryLocations] = useState<string[]>([]);
  const [dormitoryLocationOptions, setDormitoryLocationOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [dormitoryRows, setDormitoryRows] = useState<any[]>([]);
  const [dormitoryLoading, setDormitoryLoading] = useState(false);
  const dormitoryLoadedRef = useRef(false);
  const [dormitoryFilter, setDormitoryFilter] = useState('전체 보기');
  const [dormitoryEditing, setDormitoryEditing] = useState<any | null>(null);
  const [dormitoryForm, setDormitoryForm] = useState({ user_id: '', dormitory_name: '', room: '', move_in_date: '', management_fee_date: '', gas_fee_date: '', condition_note: '' });
  const [dormitorySearch, setDormitorySearch] = useState('');
  const [selectedDormitoryIds, setSelectedDormitoryIds] = useState<string[]>([]);
  const [utilityEditing, setUtilityEditing] = useState<any | null>(null);
  const [utilityForm, setUtilityForm] = useState({ management_fee_date: '', gas_fee_date: '' });
  const [newDormitoryName, setNewDormitoryName] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('ALL');
  const [partManagerOpen, setPartManagerOpen] = useState(false);
  const [partEditTarget, setPartEditTarget] = useState<string | null>(null);
  const [partEditName, setPartEditName] = useState('');
  const [partDeleteTarget, setPartDeleteTarget] = useState<string | null>(null);
  const [newPartName, setNewPartName] = useState('');
  const [newPartMembers, setNewPartMembers] = useState('');
  const [managedPartNames, setManagedPartNames] = useState<string[]>([]);
  useEffect(() => { try { const saved = window.localStorage.getItem('hr_managed_part_names'); if (saved) setManagedPartNames(JSON.parse(saved).filter((name: unknown) => typeof name === 'string')); } catch {} }, []);

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [dormListCollapsed, setDormListCollapsed] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<HRUser | null>(null);
  const [detailAbsenceDates, setDetailAbsenceDates] = useState<string[]>([]);
  const [detailAbsenceDatesOriginal, setDetailAbsenceDatesOriginal] = useState<string[]>([]);
  const [detailAbsenceDatesLoading, setDetailAbsenceDatesLoading] = useState(false);
  const [detailAbsenceDatesSaving, setDetailAbsenceDatesSaving] = useState(false);
  const [selectedUser, setSelectedUser] = useState<HRUser | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [ndtSubjectOptions, setNdtSubjectOptions] = useState<string[]>(DEFAULT_NDT_SUBJECTS);
  const [newNdtSubject, setNewNdtSubject] = useState('');

  const [formData, setFormData] = useState({
    inputId: '',
    name: '',
    email: '',
    department: '운영',
    position: '매니저',
    job_title: '팀원',
    field: '안전',
    role: 'USER',
    work_status: '근무중' as '근무중' | '휴무',
    absence_dates: [] as string[],
    phone: '',
    address: '',
    experience: '',
    internal_certificates: '',
    national_certificates: '',
    national_cert_details: [] as Array<{ method: string; kind: string }>,
    yard_cert_details: [] as Array<{ name: string; education_date: string; renewal_count: number; renewal_dates: string[] }>,
    ndt_certificates: [] as Array<{ issuer: string; subject: string; level: string; issue_date: string; expiry_date: string }>,
    join_date: '',
    career_start_date: '',
    birthDate: ''
  });

  const [notice, setNotice] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
  } | null>(null);
  const [confirmUser, setConfirmUser] = useState<HRUser | null>(null);
  const [callConfirmUser, setCallConfirmUser] = useState<HRUser | null>(null);
  const [absenceDatesLoading, setAbsenceDatesLoading] = useState(false);

  const showNotice = (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info'
  ) => {
    setNotice({ message, type });
  };

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const myRole = currentUserRole || currentUser?.role || '';
  const normalizedRole = String(myRole).toUpperCase();
  const isTeamLeader = ['TEAM_LEADER', 'TEAMLEADER', 'LEADER'].includes(normalizedRole);
  const isSuperAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(normalizedRole);
  const canAssignRoles = isSuperAdmin;

  const isSelf = (targetUser: HRUser) => {
    if (!currentUser) return false;
    if (currentUser.id && targetUser.id && currentUser.id === targetUser.id) return true;
    if (currentUser.name && targetUser.name && currentUser.name.trim() === targetUser.name.trim()) return true;
    return false;
  };

  const canEditUser = (targetUser: HRUser) => {
    return isAdmin || isSelf(targetUser);
  };

  const canManageAbsence = (targetUser: HRUser) => isAdmin || isSuperAdmin || (isTeamLeader && String(targetUser.department || '') === String(currentUser?.department || '')) || isSelf(targetUser);

  const handleQuickStatusChange = async (targetUser: HRUser, status: '근무중' | '휴무') => {
    const today = getLocalDateKey();
    const currentStatus = targetUser.work_status === '휴무' ? '휴무' : '근무중';
    if (currentStatus === status) return;
    if (!canEditUser(targetUser)) {
      showNotice('본인 상태 또는 수정 권한이 있는 구성원만 변경할 수 있습니다.', 'warning');
      return;
    }
    try {
      if (status === '휴무') {
        const { error } = await supabase.from('user_day_status').upsert(
          { user_id: targetUser.id, status_date: today, status: '휴무' },
          { onConflict: 'user_id,status_date' }
        );
        if (error) throw error;
      } else {
        const { error } = await supabase.from('user_day_status').delete()
          .eq('user_id', targetUser.id).eq('status_date', today).eq('status', '휴무');
        if (error) throw error;
      }

      const updatedUser = { ...targetUser, work_status: status };
      setUsers(prev => prev.map(user => user.id === targetUser.id ? updatedUser : user));
      setDetailUser(prev => prev?.id === targetUser.id ? updatedUser : prev);
      setDetailAbsenceDates(prev => status === '휴무'
        ? Array.from(new Set([...prev, today])).sort()
        : prev.filter(date => date !== today));
      setDetailAbsenceDatesOriginal(prev => status === '휴무'
        ? Array.from(new Set([...prev, today])).sort()
        : prev.filter(date => date !== today));
      setFormData(prev => ({ ...prev, work_status: status, absence_dates: status === '휴무'
        ? Array.from(new Set([...prev.absence_dates, today])).sort()
        : prev.absence_dates.filter(date => date !== today) }));

      if (isSelf(targetUser)) {
        onCurrentUserStatusChange?.(status);
        const local = localStorage.getItem('currentUser');
        if (local) {
          try {
            const parsed = JSON.parse(local);
            parsed.work_status = status;
            localStorage.setItem('currentUser', JSON.stringify(parsed));
          } catch {}
        }
      }
      showNotice(`${targetUser.name}님의 오늘 상태가 '${status}'(으)로 변경되었습니다.`, 'success');
    } catch (error: any) {
      console.error('오늘 근무 상태 변경 실패:', error?.message || error);
      showNotice('오늘 근무 상태 저장에 실패했습니다. user_day_status 테이블 권한을 확인해주세요.', 'error');
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadDetailAbsenceDates = async () => {
      if (!detailUser?.id) {
        setDetailAbsenceDates([]);
        setDetailAbsenceDatesOriginal([]);
        return;
      }
      setDetailAbsenceDatesLoading(true);
      try {
        const { data, error } = await supabase
          .from('user_day_status')
          .select('status_date')
          .eq('user_id', detailUser.id)
          .eq('status', '휴무')
          .order('status_date', { ascending: true });
        if (error) throw error;
        if (cancelled) return;
        const dates = (data || []).map((row: any) => String(row.status_date)).filter(Boolean);
        setDetailAbsenceDates(dates);
        setDetailAbsenceDatesOriginal(dates);
      } catch (error: any) {
        if (!cancelled) {
          console.warn('상세정보 창 휴무 날짜 조회 실패:', error?.message || error);
          setDetailAbsenceDates([]);
          setDetailAbsenceDatesOriginal([]);
        }
      } finally {
        if (!cancelled) setDetailAbsenceDatesLoading(false);
      }
    };
    loadDetailAbsenceDates();
    return () => { cancelled = true; };
  }, [detailUser?.id]);

  const handleSaveDetailAbsenceDates = async () => {
    if (!detailUser?.id || !canManageAbsence(detailUser)) {
      showNotice('본인, 소속 팀원(팀장), 또는 관리자만 휴무 날짜를 수정할 수 있습니다.', 'warning');
      return;
    }
    const selectedDates = Array.from(new Set(detailAbsenceDates)).sort();
    const originalDates = Array.from(new Set(detailAbsenceDatesOriginal)).sort();
    if (valuesEqualForSave(selectedDates, originalDates)) {
      showNotice('휴무 날짜에 변경 사항이 없습니다.', 'info');
      return;
    }
    setDetailAbsenceDatesSaving(true);
    try {
      const { data: existingRows, error: readError } = await supabase
        .from('user_day_status')
        .select('status_date')
        .eq('user_id', detailUser.id)
        .eq('status', '휴무');
      if (readError) throw readError;
      const existingDates = (existingRows || []).map((row: any) => String(row.status_date)).filter(Boolean);
      const toAdd = selectedDates.filter(date => !existingDates.includes(date)).map(status_date => ({ user_id: detailUser.id, status_date, status: '휴무' }));
      const toRemove = existingDates.filter(date => !selectedDates.includes(date));
      if (toAdd.length) {
        const { error } = await supabase.from('user_day_status').upsert(toAdd, { onConflict: 'user_id,status_date' });
        if (error) throw error;
      }
      if (toRemove.length) {
        const { error } = await supabase.from('user_day_status').delete().eq('user_id', detailUser.id).eq('status', '휴무').in('status_date', toRemove);
        if (error) throw error;
      }
      setDetailAbsenceDatesOriginal(selectedDates);
      const todayStatus: '근무중' | '휴무' = selectedDates.includes(getLocalDateKey()) ? '휴무' : '근무중';
      const updatedDetailUser = { ...detailUser, work_status: todayStatus };
      setDetailUser(updatedDetailUser);
      setUsers(prev => prev.map(user => user.id === detailUser.id ? { ...user, work_status: todayStatus } : user));
      if (isSelf(detailUser)) onCurrentUserStatusChange?.(todayStatus);
      showNotice(`${detailUser.name}님의 휴무 날짜가 저장되었습니다.`, 'success');
    } catch (error: any) {
      console.error('상세정보 창 휴무 날짜 저장 실패:', error?.message || error);
      showNotice('휴무 날짜 저장에 실패했습니다. 권한과 user_day_status 테이블을 확인해주세요.', 'error');
    } finally {
      setDetailAbsenceDatesSaving(false);
    }
  };

  const canManageDormitories = isAdmin || isSuperAdmin;
  const filteredDormitoryRows = dormitoryRows
    .filter((row) => canManageDormitories || (!!currentUser && String(row.user_id) === String(currentUser.id)))
    .filter((row) => dormitoryFilter === '전체 보기' || row.dormitory_name === dormitoryFilter)
    .filter((row) => {
      const name = users.find((u) => String(u.id) === String(row.user_id))?.name || '';
      const q = dormitorySearch.trim().toLowerCase();
      return !q || [name, row.dormitory_name, row.room].some((v) => String(v || '').toLowerCase().includes(q));
    })
    .sort((a, b) => `${a.dormitory_name}|${a.room}`.localeCompare(`${b.dormitory_name}|${b.room}`, 'ko') || String(a.move_in_date || '').localeCompare(String(b.move_in_date || '')));
  const canEditDormitoryRecord = (row: any) => canManageDormitories || (!!currentUser && String(row.user_id) === String(currentUser.id));

  const loadDormitoryData = useCallback(async () => {
    setDormitoryLoading(true);
    try {
      const [locationsResult, recordsResult] = await Promise.all([
        supabase.from('dormitory_locations').select('id,name,is_active').order('name', { ascending: true }),
        supabase.from('dormitory_records').select('id,user_id,location_id,move_in_date,management_fee_due_date,gas_fee_due_date,note,condition_note,management_fee_updated_by,gas_fee_updated_by,created_by,updated_at').order('move_in_date', { ascending: true })
      ]);
      if (locationsResult.error) throw locationsResult.error;
      if (recordsResult.error) throw recordsResult.error;
      const activeLocations = (locationsResult.data || []).filter((x: any) => x.is_active !== false);
      setDormitoryLocationOptions(activeLocations.map((x: any) => ({ id: Number(x.id), name: String(x.name) })));
      setDormitoryLocations(activeLocations.map((x: any) => String(x.name)).filter(Boolean));
      const locationNameById = new Map((locationsResult.data || []).map((x: any) => [String(x.id), String(x.name)]));
      
      const loadedRows = (recordsResult.data || []).map((row: any) => ({
        ...row,
        dormitory_name: locationNameById.get(String(row.location_id)) || '',
        room: row.room || row.note || '',
        management_fee_date: row.management_fee_due_date || '',
        gas_fee_date: row.gas_fee_due_date || '',
        condition_note: row.condition_note || '',
        updated_by: ''
      }));
      setDormitoryRows(loadedRows);
      dormitoryLoadedRef.current = true;
      return loadedRows;
    } catch (error: any) {
      console.error('기숙사 현황 조회 실패:', error?.message || error);
      showNotice('기숙사 현황을 불러오지 못했습니다. 기숙사 테이블 생성 SQL을 먼저 실행했는지 확인해주세요.', 'error');
      return [];
    } finally {
      setDormitoryLoading(false);
    }
  }, [isAdmin, isSuperAdmin]);

  useEffect(() => {
    if (activeTab === 'ORG' && subGroupType === 'DORM' && !dormitoryLoadedRef.current) void loadDormitoryData();
  }, [activeTab, subGroupType, loadDormitoryData]);

  const openDormitoryEditor = (row?: any) => {
    const fallbackUser = row?.user_id || (currentUser?.id ? String(currentUser.id) : '');
    setDormitoryEditing(row || {});
    setDormitoryForm({
      user_id: fallbackUser,
      dormitory_name: row?.dormitory_name || dormitoryLocations[0] || '',
      room: row?.room || row?.note || '',
      move_in_date: row?.move_in_date || '',
      management_fee_date: row?.management_fee_due_date || row?.management_fee_date || '',
      gas_fee_date: row?.gas_fee_due_date || row?.gas_fee_date || '',
      condition_note: row?.condition_note || ''
    });
  };

  const saveDormitoryRecord = async () => {
    const targetUser = users.find((u) => String(u.id) === String(dormitoryForm.user_id));
    if (!targetUser) { showNotice('구성원을 선택해주세요.', 'warning'); return; }
    if (!canManageDormitories && !isSelf(targetUser)) { showNotice('본인 정보 또는 관리자만 등록·수정할 수 있습니다.', 'warning'); return; }
    if (!dormitoryForm.dormitory_name.trim()) { showNotice('기숙사명을 선택해주세요.', 'warning'); return; }
    const selectedLocation = dormitoryLocationOptions.find((location) => location.name === dormitoryForm.dormitory_name.trim());
    if (!selectedLocation) { showNotice('선택한 기숙사명을 찾을 수 없습니다. 기숙사 목록을 새로고침해주세요.', 'warning'); return; }
    
    // 동일 날짜 방지 체크
    if (dormitoryForm.management_fee_date && dormitoryForm.gas_fee_date && dormitoryForm.management_fee_date === dormitoryForm.gas_fee_date) {
      showNotice('관리비 납부일과 가스비 납부일은 동일한 날짜로 설정할 수 없습니다.', 'warning');
      return;
    }

    const payload: any = {
      user_id: String(targetUser.id),
      location_id: selectedLocation.id,
      move_in_date: dormitoryForm.move_in_date || null,
      management_fee_due_date: dormitoryForm.management_fee_date || null,
      gas_fee_due_date: dormitoryForm.gas_fee_date || null,
      note: dormitoryForm.room.trim() || null,
      condition_note: dormitoryForm.condition_note.trim() || null
    };
    if (dormitoryEditing?.id && dormitoryForm.management_fee_date !== (dormitoryEditing?.management_fee_due_date || dormitoryEditing?.management_fee_date || '')) payload.management_fee_updated_by = dormitoryForm.management_fee_date ? (currentUser?.id ? String(currentUser.id) : null) : null;
    if (dormitoryEditing?.id && dormitoryForm.gas_fee_date !== (dormitoryEditing?.gas_fee_due_date || dormitoryEditing?.gas_fee_date || '')) payload.gas_fee_updated_by = dormitoryForm.gas_fee_date ? (currentUser?.id ? String(currentUser.id) : null) : null;
    try {
      if (dormitoryEditing?.id) {
        const original = {
          user_id: String(dormitoryEditing.user_id || ''),
          location_id: Number(dormitoryEditing.location_id),
          move_in_date: dormitoryEditing.move_in_date || null,
          management_fee_due_date: dormitoryEditing.management_fee_due_date || dormitoryEditing.management_fee_date || null,
          gas_fee_due_date: dormitoryEditing.gas_fee_due_date || dormitoryEditing.gas_fee_date || null,
          note: dormitoryEditing.note || dormitoryEditing.room || null,
          condition_note: dormitoryEditing.condition_note || null
        };
        const comparePayload = { ...payload };
        delete comparePayload.management_fee_updated_by;
        delete comparePayload.gas_fee_updated_by;
        if (valuesEqualForSave(original, comparePayload) && !payload.management_fee_updated_by && !payload.gas_fee_updated_by) {
          setDormitoryEditing(null);
          showNotice('변경된 내용이 없습니다.', 'info');
          return;
        }
        const { error } = await supabase.from('dormitory_records').update(payload).eq('id', dormitoryEditing.id);
        if (error) throw error;
        setDormitoryRows((prev) => prev.map((row: any) => String(row.id) === String(dormitoryEditing.id) ? {
          ...row,
          ...payload,
          dormitory_name: selectedLocation.name,
          room: payload.note || '',
          management_fee_date: payload.management_fee_due_date || '',
          gas_fee_date: payload.gas_fee_due_date || '',
          condition_note: payload.condition_note || ''
        } : row));
      } else {
        payload.created_by = currentUser?.id ? String(currentUser.id) : null;
        if (dormitoryForm.management_fee_date) payload.management_fee_updated_by = currentUser?.id ? String(currentUser.id) : null;
        if (dormitoryForm.gas_fee_date) payload.gas_fee_updated_by = currentUser?.id ? String(currentUser.id) : null;
        const { data, error } = await supabase.from('dormitory_records').insert(payload).select('id').single();
        if (error) throw error;
        setDormitoryRows((prev) => [...prev, {
          ...payload,
          id: data.id,
          dormitory_name: selectedLocation.name,
          room: payload.note || '',
          management_fee_date: payload.management_fee_due_date || '',
          gas_fee_date: payload.gas_fee_due_date || '',
          condition_note: payload.condition_note || ''
        }]);
      }
      setDormitoryEditing(null);
      showNotice('기숙사 현황을 저장했습니다.', 'success');
    } catch (error: any) {
      console.error('기숙사 현황 저장 실패:', error?.message || error);
      showNotice('기숙사 현황 저장에 실패했습니다. 테이블 권한과 RLS 정책을 확인해주세요.', 'error');
    }
  };

  const [confirmDormitoryRow, setConfirmDormitoryRow] = useState<any | null>(null);

  const deleteDormitoryRecord = async (row: any) => {
    if (!canEditDormitoryRecord(row)) { showNotice('본인 정보 또는 관리자만 삭제할 수 있습니다.', 'warning'); return; }
    setConfirmDormitoryRow(row);
  };

  const handleConfirmDeleteDormitory = async () => {
    if (!confirmDormitoryRow) return;
    const row = confirmDormitoryRow;
    setConfirmDormitoryRow(null);
    try {
      const { error } = await supabase.from('dormitory_records').delete().eq('id', row.id);
      if (error) throw error;
      setDormitoryRows((prev) => prev.filter((item: any) => String(item.id) !== String(row.id)));
      setSelectedDormitoryIds((prev) => prev.filter((id) => String(id) !== String(row.id)));
      showNotice('기숙사 현황을 삭제했습니다.', 'success');
    } catch (error: any) {
      console.error('기숙사 현황 삭제 실패:', error?.message || error);
      showNotice('기숙사 현황 삭제에 실패했습니다.', 'error');
    }
  };

  const addDormitoryLocation = async () => {
    const name = newDormitoryName.trim();
    if (!name) { showNotice('추가할 기숙사명을 입력해주세요.', 'warning'); return; }
    if (!canManageDormitories) { showNotice('관리자만 기숙사명을 추가할 수 있습니다.', 'warning'); return; }
    if (dormitoryLocations.some((existing) => existing.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) { showNotice('이미 등록된 기숙사명입니다. 다른 이름을 입력해주세요.', 'warning'); return; }
    try {
      const { data, error } = await supabase.from('dormitory_locations').insert({ name, is_active: true }).select('id,name,is_active').single();
      if (error) throw error;
      setDormitoryLocationOptions((prev) => [...prev, { id: Number(data.id), name: String(data.name) }].sort((a, b) => a.name.localeCompare(b.name, 'ko')));
      setDormitoryLocations((prev) => [...prev, String(data.name)].sort((a, b) => a.localeCompare(b, 'ko')));
      setNewDormitoryName('');
      showNotice('기숙사명을 추가했습니다.', 'success');
    } catch (error: any) {
      const errorMessage = String(error?.message || error?.details || error?.hint || '');
      console.error('기숙사명 추가 실패:', errorMessage || error);
      if (error?.code === '23505' || /duplicate|unique/i.test(errorMessage)) {
        showNotice('이미 등록된 기숙사명입니다. 다른 이름을 입력해주세요.', 'warning');
      } else {
        showNotice(`기숙사명 추가에 실패했습니다${errorMessage ? `: ${errorMessage}` : '. Supabase 테이블 권한과 정책을 확인해주세요.'}`, 'error');
      }
    }
  };

  const deleteDormitoryLocation = async (name: string) => {
    if (!canManageDormitories) return;
    if (dormitoryRows.some((row) => row.dormitory_name === name)) { showNotice('사용 중인 기숙사명은 먼저 해당 현황을 변경하거나 삭제해야 합니다.', 'warning'); return; }
    if (!window.confirm(`기숙사명 '${name}'을 삭제하시겠습니까?`)) return;
    try {
      const { error } = await supabase.from('dormitory_locations').update({ is_active: false }).eq('name', name);
      if (error) throw error;
      setDormitoryLocationOptions((prev) => prev.filter((location) => location.name !== name));
      setDormitoryLocations((prev) => prev.filter((location) => location !== name));
      showNotice('기숙사명을 삭제했습니다.', 'success');
    } catch (error: any) {
      console.error('기숙사명 삭제 실패:', error?.message || error);
      showNotice('기숙사명 삭제에 실패했습니다.', 'error');
    }
  };

  const exportDormitoryExcel = () => {
    const filtered = filteredDormitoryRows;
    const rows: any[][] = [
      ['기숙사 현황', '', '', '', '', '', '', '', ''],
      ['기숙사명', '호실', '성명', '입주날짜', '공과금 납입', '', '', '', '비고'],
      ['', '', '', '', '관리비 납부일', '납부자', '가스비 납부일', '납부자', '']
    ];
    filtered.forEach((row) => {
      const person = users.find((u) => String(u.id) === String(row.user_id));
      const managementEditor = row.management_fee_date ? (users.find((u) => String(u.id) === String(row.management_fee_updated_by))?.name || (String(currentUser?.id || '') === String(row.management_fee_updated_by || '') ? currentUser?.name : '') || '확인 필요') : '미납';
      const gasEditor = row.gas_fee_date ? (users.find((u) => String(u.id) === String(row.gas_fee_updated_by))?.name || (String(currentUser?.id || '') === String(row.gas_fee_updated_by || '') ? currentUser?.name : '') || '확인 필요') : '미납';
      rows.push([row.dormitory_name || '', row.room || '', person?.name || row.user_id || '', row.move_in_date ? String(row.move_in_date).slice(0,10).replace(/-/g,'/') : '', row.management_fee_date ? String(row.management_fee_date).slice(0,10).replace(/-/g,'/') : '', managementEditor, row.gas_fee_date ? String(row.gas_fee_date).slice(0,10).replace(/-/g,'/') : '', gasEditor, row.condition_note || '']);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
      { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } },
      { s: { r: 1, c: 1 }, e: { r: 2, c: 1 } },
      { s: { r: 1, c: 2 }, e: { r: 2, c: 2 } },
      { s: { r: 1, c: 3 }, e: { r: 2, c: 3 } },
      { s: { r: 1, c: 4 }, e: { r: 1, c: 7 } },
      { s: { r: 1, c: 8 }, e: { r: 2, c: 8 } }
    ];
    for (let i = 0; i < filtered.length;) {
      let j = i + 1;
      while (j < filtered.length && filtered[j].dormitory_name === filtered[i].dormitory_name && filtered[j].room === filtered[i].room) j++;
      if (j - i > 1) {
        ws['!merges'].push({ s: { r: i + 3, c: 0 }, e: { r: j + 2, c: 0 } });
        ws['!merges'].push({ s: { r: i + 3, c: 1 }, e: { r: j + 2, c: 1 } });
      }
      i = j;
    }
    ws['!rows'] = [{ hpx: 56 }, { hpx: 30 }, { hpx: 30 }, ...filtered.map(() => ({ hpx: 26 }))];
    ws['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 28 }];
    ws['!autofilter'] = { ref: `A3:I${Math.max(3, rows.length)}` };
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < 9; c++) {
        const address = XLSX.utils.encode_cell({ r, c });
        if (ws[address]) (ws[address] as any).s = {
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          font: { name: r === 0 ? 'HY헤드라인M' : '맑은 고딕', sz: r === 0 ? 20 : 10, bold: r < 3, color: r === 0 ? { rgb: '243B5A' } : { rgb: '1F2937' } },
          fill: r < 3 ? { fgColor: { rgb: r === 0 ? 'E8EEF5' : r === 1 ? 'DCE6F1' : 'F1F5F9' }, patternType: 'solid' } : undefined,
          border: { top: { style: 'thin', color: { rgb: 'CBD5E1' } }, bottom: { style: 'thin', color: { rgb: 'CBD5E1' } }, left: { style: 'thin', color: { rgb: 'CBD5E1' } }, right: { style: 'thin', color: { rgb: 'CBD5E1' } } }
        };
      }
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '기숙사 현황');
    XLSX.writeFile(wb, '기숙사_현황.xlsx');
  };

  const openUtilityEditor = (row: any) => {
    // 같은 기숙사 및 호실에 거주하는 인원의 납부일과 납부자를 동일하게 통일하여 가져옴
    const sameRoomRows = dormitoryRows.filter(r => r.dormitory_name === row.dormitory_name && (r.room || '') === (row.room || ''));
    const sharedMDate = sameRoomRows.find(r => r.management_fee_date)?.management_fee_date || row.management_fee_date || '';
    const sharedGDate = sameRoomRows.find(r => r.gas_fee_date)?.gas_fee_date || row.gas_fee_date || '';

    const mDone = !!sharedMDate;
    const gDone = !!sharedGDate;

    if (!mDone && !gDone) {
      showNotice('관리비와 가스비가 모두 미납입 되었습니다.', 'warning');
    } else if (!mDone) {
      showNotice('관리비가 미납입 되었습니다.', 'warning');
    } else if (!gDone) {
      showNotice('가스비가 미납입 되었습니다.', 'warning');
    } else {
      showNotice('공과금 납입이 완료되었습니다.', 'success');
    }

    setUtilityEditing(row);
    setUtilityForm({ management_fee_date: sharedMDate, gas_fee_date: sharedGDate });
  };

  const saveUtilityDates = async () => {
    if (!utilityEditing?.id) return;

    if (utilityForm.management_fee_date && utilityForm.gas_fee_date && utilityForm.management_fee_date === utilityForm.gas_fee_date) {
      showNotice('관리비 납부일과 가스비 납부일은 동일한 날짜로 설정할 수 없습니다.', 'warning');
      return;
    }

    // 같은 기숙사 및 호실에 거주하는 모든 인원의 ID들을 찾음
    const targetRoomRows = dormitoryRows.filter(r => r.dormitory_name === utilityEditing.dormitory_name && (r.room || '') === (utilityEditing.room || ''));
    const targetIds = targetRoomRows.map(r => r.id);

    const payload: any = {};
    const mDateChanged = utilityForm.management_fee_date !== (utilityEditing.management_fee_date || '');
    const gDateChanged = utilityForm.gas_fee_date !== (utilityEditing.gas_fee_date || '');

    if (mDateChanged) {
      payload.management_fee_due_date = utilityForm.management_fee_date || null;
      payload.management_fee_updated_by = utilityForm.management_fee_date ? (currentUser?.id ? String(currentUser.id) : null) : null;
    }
    if (gDateChanged) {
      payload.gas_fee_due_date = utilityForm.gas_fee_date || null;
      payload.gas_fee_updated_by = utilityForm.gas_fee_date ? (currentUser?.id ? String(currentUser.id) : null) : null;
    }
    if (!Object.keys(payload).length) { setUtilityEditing(null); showNotice('변경된 공과금 납입일이 없습니다.', 'info'); return; }
    
    try {
      // 같은 호실에 거주하는 모든 인원에게 일괄 적용 (업데이트)
      const { error } = await supabase.from('dormitory_records').update(payload).in('id', targetIds);
      if (error) throw error;

      setDormitoryRows((prev) => prev.map((row: any) => targetIds.includes(row.id) ? {
        ...row,
        ...payload,
        management_fee_date: payload.management_fee_due_date !== undefined ? (payload.management_fee_due_date || '') : row.management_fee_date,
        gas_fee_date: payload.gas_fee_due_date !== undefined ? (payload.gas_fee_due_date || '') : row.gas_fee_date,
        management_fee_updated_by: payload.management_fee_updated_by !== undefined ? payload.management_fee_updated_by : row.management_fee_updated_by,
        gas_fee_updated_by: payload.gas_fee_updated_by !== undefined ? payload.gas_fee_updated_by : row.gas_fee_updated_by
      } : row));

      setUtilityEditing(null);
      showNotice('같은 호실 거주 인원들의 공과금 납입일이 공동으로 저장되었습니다.', 'success');
    } catch (error: any) {
      console.error('공과금 납입일 저장 실패:', error?.message || error);
      showNotice(`공과금 납입일 저장에 실패했습니다: ${error?.message || '권한 및 RLS 정책을 확인해주세요.'}`, 'error');
    }
  };

  const deleteSelectedDormitoryRows = async () => {
    const ids = selectedDormitoryIds.filter((id) => filteredDormitoryRows.some((row) => String(row.id) === id));
    if (!ids.length) { showNotice('삭제할 현황을 선택해주세요.', 'warning'); return; }
    if (!canManageDormitories && ids.some((id) => !canEditDormitoryRecord(filteredDormitoryRows.find((row) => String(row.id) === id)))) {
      showNotice('삭제 권한이 없는 항목이 포함되어 있습니다.', 'warning'); return;
    }
    if (!window.confirm(`선택한 ${ids.length}건의 기숙사 현황을 삭제하시겠습니까? 삭제한 데이터는 복구할 수 없습니다.`)) return;
    try {
      const { error } = await supabase.from('dormitory_records').delete().in('id', ids);
      if (error) throw error;
      setDormitoryRows((prev) => prev.filter((row: any) => !ids.some((id) => String(id) === String(row.id))));
      setSelectedDormitoryIds([]);
      showNotice(`${ids.length}건의 기숙사 현황을 삭제했습니다.`, 'success');
    } catch (error: any) {
      console.error('기숙사 현황 일괄 삭제 실패:', error?.message || error);
      showNotice(`선택 삭제에 실패했습니다: ${error?.message || '테이블 권한과 RLS 정책을 확인해주세요.'}`, 'error');
    }
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('id, name, email, department, position, job_title, field, role, phone, address, experience, internal_certificates, national_certificates, national_cert_details, yard_cert_details, ndt_certificates, join_date, career_start_date, password, photo_url, pos_x, pos_y, work_status')
        .order('name', { ascending: true });

      if (error) throw error;

      // 구성원 화면의 상태도 업무현황과 동일하게 오늘 날짜의 휴무 기록으로 판정합니다.
      const today = getLocalDateKey();
      const { data: todayAbsences, error: todayAbsenceError } = await supabase
        .from('user_day_status')
        .select('user_id')
        .eq('status_date', today)
        .eq('status', '휴무');
      if (todayAbsenceError) throw todayAbsenceError;
      const todayAbsenceUserIds = new Set((todayAbsences || []).map((row: any) => String(row.user_id)));

      const formatted = (data || []).map((u: any) => ({
        ...u,
        work_status: todayAbsenceUserIds.has(String(u.id)) ? '휴무' : '근무중',
        national_certificates: u.national_certificates || u.certificates || '',
        national_cert_details: Array.isArray(u.national_cert_details) ? u.national_cert_details : [],
        yard_cert_details: Array.isArray(u.yard_cert_details) ? u.yard_cert_details : (u.yard_cert_details?.names ? u.yard_cert_details.names.split(',').map((name: string) => ({ name: name.trim(), education_date: u.yard_cert_details.education_date || '', renewal_count: Number(u.yard_cert_details.renewal_count || 0), renewal_dates: Array.isArray(u.yard_cert_details.renewal_dates) ? u.yard_cert_details.renewal_dates : [] })).filter((item: any) => item.name) : []),
        ndt_certificates: normalizeNdtCertificates(Array.isArray(u.ndt_certificates) ? u.ndt_certificates : [])
      }));

      setUsers(formatted);
    } catch (err: any) {
      console.error('인사 정보 조회 실패:', err?.message || err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handledInitialActionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialAction || loading || users.length === 0) return;
    if (handledInitialActionRef.current === initialAction) return;
    handledInitialActionRef.current = initialAction;

    if (initialAction === 'self-edit') {
      const self = users.find((user) =>
        (currentUser?.id && user.id === currentUser.id) ||
        (currentUser?.email && user.email?.toLowerCase() === String(currentUser.email).toLowerCase()) ||
        (currentUser?.name && user.name?.trim() === String(currentUser.name).trim())
      );
      setActiveTab('ORG');
      setSubGroupType('DEPT');
      setSelectedSubCategory('ALL');
      if (self) handleOpenEditModal(self);
      else showNotice('로그인한 계정의 구성원 정보를 찾지 못했습니다.', 'warning');
      onInitialActionHandled?.();
    } else if (initialAction === 'my-team') {
      const myDepartment = String(currentUser?.department || '').trim();
      setActiveTab('ORG');
      setSubGroupType('DEPT');
      if (myDepartment && users.some((user) => (user.department || '미지정 파트') === myDepartment)) {
        setSelectedSubCategory(myDepartment);
        setSearchTerm('');
      } else {
        setSelectedSubCategory('ALL');
        showNotice('소속 파트를 확인하지 못해 전체 파트 조직도를 표시합니다.', 'warning');
      }
      onInitialActionHandled?.();
    } else if (initialAction === 'dormitory') {
      setActiveTab('ORG');
      setSubGroupType('DORM');
      
      const processDormitoryAction = async () => {
        let currentRows = dormitoryRows;
        if (!dormitoryLoadedRef.current) {
          currentRows = await loadDormitoryData();
        }
        
        const myUserId = currentUser?.id ? String(currentUser.id).trim() : '';
        const myName = currentUser?.name ? String(currentUser.name).trim() : '';

        const myDormRow = currentRows.find(
          (row) => String(row.user_id).trim() === myUserId || 
                   (myName && users.find(u => String(u.id) === String(row.user_id))?.name?.trim() === myName)
        );

        if (myDormRow) {
          openUtilityEditor(myDormRow);
        } else {
          openDormitoryEditor();
          showNotice('기숙사 현황에 본인 정보가 없습니다. 새로 등록해주세요.', 'info');
        }
        onInitialActionHandled?.();
      };

      void processDormitoryAction();
    }
  }, [initialAction, loading, users, currentUser, dormitoryRows, loadDormitoryData, onInitialActionHandled]);

  useEffect(() => {
    let cancelled = false;
    const loadNdtSubjects = async () => {
      const { data, error } = await supabase.from('ndt_subject_options').select('subject').order('subject', { ascending: true });
      if (error) {
        console.warn('NDT 종목 목록 조회 실패:', error.message);
        return;
      }
      if (!cancelled && data) setNdtSubjectOptions(data.length ? Array.from(new Set(data.map((row: any) => row.subject).filter(Boolean))) : DEFAULT_NDT_SUBJECTS);
    };
    loadNdtSubjects();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setSelectedSubCategory('ALL');
  }, [subGroupType]);

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const toggleAllGroups = (collapse: boolean) => {
    const newStatus: Record<string, boolean> = {};
    availableSubCategories.forEach(cat => {
      newStatus[cat] = collapse;
    });
    setCollapsedGroups(newStatus);
  };

  const validatePhotoFile = (file: File | null) => {
    if (!file) return true;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      showNotice('사진은 JPG, PNG, WebP 형식만 등록할 수 있습니다.', 'warning');
      return false;
    }
    return true;
  };

  const handlePhotoChange = (file: File | null) => {
    if (!file) {
      setPhotoFile(null);
      setPhotoPreview(null);
      return;
    }
    if (!validatePhotoFile(file)) return;
    setPhotoFile(file);
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
  };

  const uploadProfilePhoto = async (userId: string, file: File) => {
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const objectPath = `${userId}/profile.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('profile-photos')
      .upload(objectPath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('profile-photos')
      .getPublicUrl(objectPath);

    if (!data?.publicUrl) {
      throw new Error('프로필 사진 공개 URL을 생성하지 못했습니다.');
    }

    return `${data.publicUrl}?v=${Date.now()}`;
  };

  const handleOpenAddModal = () => {
    if (!isAdmin) {
      showNotice('관리자 권한이 필요합니다.', 'warning');
      return;
    }
    setSelectedUser(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setFormData({
      inputId: '',
      name: '',
      email: '',
      department: '운영',
      position: '매니저',
      job_title: '팀원',
      field: '안전',
      role: 'USER',
      work_status: '근무중',
      absence_dates: [],
      phone: '',
      address: '',
      experience: '',
      internal_certificates: '',
      national_certificates: '',
      national_cert_details: [],
      yard_cert_details: [],
      ndt_certificates: [],
      join_date: new Date().toISOString().split('T')[0],
      career_start_date: new Date().toISOString().split('T')[0],
      birthDate: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: HRUser) => {
    if (!canEditUser(user)) {
      showNotice('본인의 정보 또는 관리자 권한이 있는 경우에만 수정이 가능합니다.', 'warning');
      return;
    }
    setSelectedUser(user);
    setPhotoFile(null);
    setPhotoPreview(user.photo_url || null);
    setFormData({ 
      inputId: user.id || '',
      name: user.name || '',
      email: user.email || '',
      department: user.department || '운영',
      position: user.position || '매니저',
      job_title: user.job_title || '팀원',
      field: user.field || '안전',
      role: user.role || 'USER',
      work_status: user.work_status === '휴무' ? '휴무' : '근무중',
      phone: user.phone || '',
      address: user.address || '',
      experience: user.experience || '',
      internal_certificates: user.internal_certificates || '',
      national_certificates: user.national_certificates || user.certificates || '',
      national_cert_details: Array.isArray(user.national_cert_details) ? user.national_cert_details : [],
      yard_cert_details: Array.isArray(user.yard_cert_details) ? user.yard_cert_details : (user.yard_cert_details && !Array.isArray(user.yard_cert_details) && (user.yard_cert_details as any).names ? (user.yard_cert_details as any).names.split(',').map((name: string) => ({ name: name.trim(), education_date: (user.yard_cert_details as any).education_date || '', renewal_count: Number((user.yard_cert_details as any).renewal_count || 0), renewal_dates: Array.isArray((user.yard_cert_details as any).renewal_dates) ? (user.yard_cert_details as any).renewal_dates : [] })).filter((item: any) => item.name) : []),
      ndt_certificates: normalizeNdtCertificates(Array.isArray(user.ndt_certificates) ? user.ndt_certificates : []),
      join_date: user.join_date || '',
      career_start_date: user.career_start_date || '',
      birthDate: user.password || '',
      absence_dates: []
    });
    setIsModalOpen(true);
    setAbsenceDatesLoading(true);
    supabase.from('user_day_status').select('status_date').eq('user_id', user.id).eq('status', '휴무').order('status_date', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.warn('휴무 날짜 조회 실패:', error.message);
        } else {
          setFormData(prev => ({ ...prev, absence_dates: (data || []).map((row: any) => String(row.status_date)).filter(Boolean) }));
        }
        setAbsenceDatesLoading(false);
      }, (error) => {
        console.warn('휴무 날짜 조회 실패:', error);
        setAbsenceDatesLoading(false);
      });
  };

  const handleConfirmDelete = async () => {
    if (!confirmUser) return;

    const user = confirmUser;
    setConfirmUser(null);

    try {
      const { error } = await supabase
        .from('app_users')
        .delete()
        .eq('id', user.id);

      if (error) throw error;

      setUsers(prev => prev.filter(item => item.id !== user.id));
      showNotice(`${user.name} 님의 정보가 성공적으로 삭제되었습니다.`, 'success');
    } catch (err: any) {
      console.error('삭제 실패:', err);
      showNotice('구성원 삭제 실패: ' + (err.message || '알 수 없는 오류'), 'error');
    }
  };

  const handleCallUser = (user: HRUser) => {
    const phone = user.phone?.trim();

    if (!phone) {
      showNotice(`${user.name}님의 전화번호가 등록되어 있지 않습니다.`, 'warning');
      return;
    }

    setCallConfirmUser(user);
  };

  const handleConfirmCall = () => {
    if (!callConfirmUser?.phone) return;

    const phone = callConfirmUser.phone.replace(/[^0-9+]/g, '');
    setCallConfirmUser(null);
    window.location.href = `tel:${phone}`;
  };

  const handleDeleteUser = async (user: HRUser) => {
    if (!isAdmin) {
      showNotice('관리자만 구성원을 삭제할 수 있습니다.', 'warning');
      return;
    }

    if (currentUser?.id === user.id) {
      showNotice('현재 로그인되어 있는 본인 계정은 삭제할 수 없습니다.', 'warning');
      return;
    }

    setConfirmUser(user);
    return;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedUser && !canEditUser(selectedUser)) {
      showNotice('본인 정보만 수정할 권한이 있습니다.', 'warning');
      return;
    }

    if (!formData.inputId.trim()) {
      showNotice('로그인에 사용할 아이디를 입력해주세요.', 'warning');
      return;
    }

    if (formData.birthDate && formData.birthDate.length !== 8) {
      showNotice('생년월일은 8자리(YYYYMMDD)로 정확히 입력해주세요.', 'warning');
      return;
    }

    try {
      let savedPhotoUrl: string | null = null;
      const payload: any = {
        id: formData.inputId.trim(), 
        name: formData.name,
        email: formData.email,
        department: formData.department,
        position: formData.position,
        job_title: formData.job_title,
        work_status: formData.work_status,
        field: formData.field,
        phone: formData.phone,
        address: formData.address,
        experience: formData.experience,
        internal_certificates: formData.internal_certificates,
        national_certificates: formData.national_cert_details.map(c => `${c.method}${c.kind ? ` ${c.kind}` : ''}`.trim()).filter(Boolean).join(', ') || formData.national_certificates,
        national_cert_details: formData.national_cert_details,
        yard_cert_details: formData.yard_cert_details,
        ndt_certificates: formData.ndt_certificates,
        join_date: formData.join_date || null,
        career_start_date: formData.career_start_date || null,
      };

      if (formData.birthDate) {
        payload.password = formData.birthDate;
      }

      if (photoFile && !validatePhotoFile(photoFile)) {
        return;
      }

      if (canAssignRoles && formData.role) {
        payload.role = formData.role;
      }

      if (selectedUser) {
        const changedPayload = Object.fromEntries(
          Object.entries(payload).filter(([key, value]) =>
            key !== 'id' && !valuesEqualForSave((selectedUser as any)[key], value)
          )
        );

        if (Object.keys(changedPayload).length > 0) {
          const { error } = await supabase
            .from('app_users')
            .update(changedPayload)
            .eq('id', selectedUser.id);
          if (error) throw error;
        }

        if (photoFile) {
          try {
            const photoUrl = await uploadProfilePhoto(selectedUser.id, photoFile);
            const { error: photoUpdateError } = await supabase
              .from('app_users')
              .update({ photo_url: photoUrl })
              .eq('id', selectedUser.id);
            if (photoUpdateError) throw photoUpdateError;
            savedPhotoUrl = photoUrl;
          } catch (photoError: any) {
            console.error('사진 업로드 실패:', photoError);
            showNotice(`인사 정보는 저장되었지만 사진 업로드에 실패했습니다: ${photoError?.message || 'Storage 설정을 확인해주세요.'}`, 'warning');
          }
        }

        showNotice('인사 정보가 성공적으로 수정되었습니다.', 'success');
      } else {
        if (!formData.birthDate) {
          showNotice('비밀번호로 사용할 생년월일 8자리를 입력해주세요.', 'warning');
          return;
        }

        const { error } = await supabase.from('app_users').insert([
          {
            ...payload,
            role: canAssignRoles ? (formData.role || 'USER') : 'USER',
          },
        ]);

        if (error) throw error;

        if (photoFile) {
          try {
            const photoUrl = await uploadProfilePhoto(formData.inputId.trim(), photoFile);
            const { error: photoUpdateError } = await supabase
              .from('app_users')
              .update({ photo_url: photoUrl })
              .eq('id', formData.inputId.trim());
            if (photoUpdateError) throw photoUpdateError;
            savedPhotoUrl = photoUrl;
          } catch (photoError: any) {
            console.error('사진 업로드 실패:', photoError);
            showNotice(`구성원은 등록되었지만 사진 업로드에 실패했습니다: ${photoError?.message || 'Storage 설정을 확인해주세요.'}`, 'warning');
          }
        }

        showNotice('새 구성원이 등록되었습니다.', 'success');
      }

      const savedUser: HRUser = {
        ...(selectedUser || {}),
        ...payload,
        id: formData.inputId.trim(),
        role: payload.role ?? selectedUser?.role ?? (canAssignRoles ? (formData.role || 'USER') : 'USER'),
        photo_url: savedPhotoUrl || selectedUser?.photo_url || null,
        national_certificates: payload.national_certificates || payload.certificates || selectedUser?.national_certificates || '',
        national_cert_details: formData.national_cert_details,
        yard_cert_details: formData.yard_cert_details,
        ndt_certificates: formData.ndt_certificates,
        work_status: formData.absence_dates.includes(getLocalDateKey()) ? '휴무' : '근무중'
      };
      
      if (isSelf(savedUser)) {
        onCurrentUserStatusChange?.(savedUser.work_status === '휴무' ? '휴무' : '근무중');
      }

      const targetUserId = formData.inputId.trim();
      const { data: existingAbsenceRows, error: absenceReadError } = await supabase.from('user_day_status').select('status_date').eq('user_id', targetUserId).eq('status', '휴무');
      if (absenceReadError) throw absenceReadError;
      const existingDates = new Set((existingAbsenceRows || []).map((row: any) => String(row.status_date)));
      const nextDates = new Set(formData.absence_dates);
      const datesToAdd = Array.from(nextDates).filter(date => !existingDates.has(date)).map(status_date => ({ user_id: targetUserId, status_date, status: '휴무' }));
      const datesToRemove = Array.from(existingDates).filter(date => !nextDates.has(date));
      if (datesToAdd.length) { const { error } = await supabase.from('user_day_status').upsert(datesToAdd, { onConflict: 'user_id,status_date' }); if (error) throw error; }
      if (datesToRemove.length) { const { error } = await supabase.from('user_day_status').delete().eq('user_id', targetUserId).in('status_date', datesToRemove); if (error) throw error; }
      
      setUsers(prev => {
        const next = selectedUser
          ? prev.filter(item => item.id !== selectedUser.id).concat(savedUser)
          : prev.concat(savedUser);
        return next.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      });
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('저장 실패:', err);
      showNotice('저장 중 오류가 발생했습니다: ' + (err.message || '알 수 없는 오류'), 'error');
    }
  };

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    return (
      (u.name || '').toLowerCase().includes(term) ||
      (u.id || '').toLowerCase().includes(term) ||
      (u.department || '').toLowerCase().includes(term) ||
      (u.position || '').toLowerCase().includes(term) ||
      (u.job_title || '').toLowerCase().includes(term) ||
      (u.field || '').toLowerCase().includes(term) ||
      (u.phone || '').toLowerCase().includes(term) ||
      getNdtCertLabels(u).join(' ').toLowerCase().includes(term) ||
      getNationalCertLabels(u).join(' ').toLowerCase().includes(term) ||
      getYardCertLabels(u).join(' ').toLowerCase().includes(term)
    );
  });

  const listViewUsers = [...filteredUsers].sort((a, b) => {
    const formerDifference = Number(isFormerEmployee(a)) - Number(isFormerEmployee(b));
    if (formerDifference !== 0) return formerDifference;
    return (a.name || '').localeCompare(b.name || '', 'ko');
  });

  const rawSubCategories = Array.from(
    new Set(
      filteredUsers
        .map((u) => (subGroupType === 'DEPT' ? u.department || '미지정 파트' : u.position || '미지정 직급'))
        .filter(Boolean)
    )
  );

  const availableSubCategories = subGroupType === 'DEPT' 
    ? Array.from(new Set([...rawSubCategories, ...managedPartNames])).sort((a, b) => {
        const indexA = DEPT_ORDER.indexOf(a);
        const indexB = DEPT_ORDER.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
      })
    : rawSubCategories.sort((a, b) => {
        const orderA = RANK_ORDER[a] || 99;
        const orderB = RANK_ORDER[b] || 99;
        return orderA - orderB;
      });

  const displayedCategories = selectedSubCategory === 'ALL' 
    ? availableSubCategories 
    : [selectedSubCategory];

  return (
    <div className="w-full min-h-screen bg-[#F5F6F8] text-[#1F2937] p-2 sm:p-3 space-y-3 font-sans box-border">
      {notice && (
        <div className="fixed top-3 left-3 right-3 sm:top-5 sm:left-auto sm:right-5 z-[160] w-auto sm:w-[min(92vw,420px)] pt-[env(safe-area-inset-top)]">
          <div role="status" aria-live="polite" className={`overflow-hidden rounded-xl border bg-white shadow-[0_12px_32px_rgba(15,23,42,0.16)] ${
            notice.type === 'success' ? 'border-emerald-200' :
            notice.type === 'error' ? 'border-rose-200' :
            notice.type === 'warning' ? 'border-amber-200' : 'border-[#CBD5E1]'
          }`}>
            <div className="flex items-center justify-between bg-[#243B5A] px-3.5 py-2">
              <span className="text-[11px] font-bold tracking-wide text-white">현장관리 알림</span>
              <button type="button" onClick={() => setNotice(null)} aria-label="알림 닫기" className="rounded-md px-1.5 text-lg leading-none text-white/80 hover:bg-white/10 hover:text-white">×</button>
            </div>
            <div className="flex items-start gap-3 px-4 py-3">
              <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white ${
                notice.type === 'success' ? 'bg-emerald-600' :
                notice.type === 'error' ? 'bg-rose-600' :
                notice.type === 'warning' ? 'bg-amber-500' : 'bg-[#64748B]'
              }`}>{notice.type === 'success' ? '✓' : notice.type === 'error' ? '!' : notice.type === 'warning' ? '!' : 'i'}</div>
              <p className="flex-1 pt-0.5 text-sm font-medium leading-5 text-[#1F2937]">{notice.message}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-3 rounded-xl border border-[#E2E5E9] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-xl text-[#243B5A]">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#1F2937]">인사 관리</h1>
            <p className="text-[11px] text-[#64748B]">구성원 정보를 카드와 목록으로 관리합니다.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab !== 'CERT' && (
            <div className="relative flex-1 sm:w-80 sm:min-w-[320px]">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
              <input
                type="text"
                placeholder="이름, 아이디, 파트, 자격 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#E2E5E9] rounded-lg bg-[#F5F6F8] text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none transition"
              />
            </div>
          )}

          <div className="flex bg-[#F5F6F8] border border-[#E2E5E9] p-0.5 rounded-lg">
            <button
              onClick={() => setActiveTab('ORG')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 ${
                activeTab === 'ORG' ? 'bg-[#243B5A] text-white shadow-xs' : 'text-[#64748B] hover:text-[#1F2937]'
              }`}
            >
              <Network className="h-3.5 w-3.5" /> 카드 뷰
            </button>
            <button
              onClick={() => setActiveTab('LIST')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                activeTab === 'LIST' ? 'bg-[#243B5A] text-white shadow-xs' : 'text-[#64748B] hover:text-[#1F2937]'
              }`}
            >
              목록 뷰
            </button>
            <button
              onClick={() => setActiveTab('CERT')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                activeTab === 'CERT' ? 'bg-[#243B5A] text-white shadow-xs' : 'text-[#64748B] hover:text-[#1F2937]'
              }`}
            >
              CERT 자격관리
            </button>
          </div>

          {activeTab !== 'CERT' && <>
          {isAdmin && (
            <button
              onClick={handleOpenAddModal}
              className="flex items-center space-x-1 bg-[#243B5A] hover:bg-[#1d3049] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>구성원 추가</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => exportHRToExcel(users)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[#E2E5E9] bg-white text-[#243B5A] hover:bg-[#F5F6F8] transition"
          >
            Excel 출력
          </button>

          <button
            type="button"
            onClick={() => void exportHRToPptx(users)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[#E2E5E9] bg-white text-[#243B5A] hover:bg-[#F5F6F8] transition"
          >
            PPT 출력
          </button>
          </>}
        </div>
      </div>

      {activeTab === 'CERT' ? (
        <CertManagement
          users={users}
          currentUser={currentUser}
          isAdmin={isAdmin}
          currentUserRole={currentUserRole}
        />
      ) : <>
      {activeTab === 'ORG' && (
        <div className="bg-white border border-[#E2E5E9] rounded-xl p-3 shadow-xs space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E5E9] pb-2.5">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-[#64748B] flex items-center gap-1 mr-1">
                <Layers className="h-3.5 w-3.5 text-[#243B5A]" /> 보기:
              </span>
              <button
                onClick={() => setSubGroupType('DEPT')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition border ${
                  subGroupType === 'DEPT'
                    ? 'bg-[#243B5A] text-white border-[#243B5A] shadow-xs'
                    : 'bg-[#F5F6F8] text-[#64748B] border-[#E2E5E9] hover:bg-[#E2E5E9]'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>파트별 조직도</span>
              </button>
              <button
                onClick={() => setSubGroupType('POS')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition border ${
                  subGroupType === 'POS'
                    ? 'bg-[#243B5A] text-white border-[#243B5A] shadow-xs'
                    : 'bg-[#F5F6F8] text-[#64748B] border-[#E2E5E9] hover:bg-[#E2E5E9]'
                }`}
              >
                <Briefcase className="h-3.5 w-3.5" />
                <span>직급별 조직도</span>
              </button>
              <button
                onClick={() => setSubGroupType('DORM')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition border ${
                  subGroupType === 'DORM'
                    ? 'bg-[#243B5A] text-white border-[#243B5A] shadow-xs'
                    : 'bg-[#F5F6F8] text-[#64748B] border-[#E2E5E9] hover:bg-[#E2E5E9]'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>기숙사 현황</span>
              </button>
              {isAdmin && <button
                type="button"
                onClick={() => setPartManagerOpen(true)}
                title="파트 추가 / 수정 / 삭제"
                aria-label="파트 설정"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E5E9] bg-white text-[#243B5A] transition hover:bg-[#F5F6F8]"
              ><Settings className="h-4 w-4" /></button>}
            </div>

            {subGroupType !== 'DORM' && <div className="flex items-center space-x-2 text-xs">
              <button
                onClick={() => toggleAllGroups(false)}
                className="px-2 py-1 text-[#64748B] bg-[#F5F6F8] hover:bg-[#E2E5E9] border border-[#E2E5E9] rounded-lg font-medium transition text-[11px]"
              >
                모두 펼치기
              </button>
              <button
                onClick={() => toggleAllGroups(true)}
                className="px-2 py-1 text-[#64748B] bg-[#F5F6F8] hover:bg-[#E2E5E9] border border-[#E2E5E9] rounded-lg font-medium transition text-[11px]"
              >
                모두 접기
              </button>
            </div>}
          </div>

          {subGroupType !== 'DORM' && <div className="flex items-center gap-2 py-0.5">
            <span className="shrink-0 flex items-center gap-1 text-xs font-bold text-[#64748B]">
              <ChevronRight className="h-3.5 w-3.5" />
              파트 선택:
            </span>
            <div className="w-full max-w-xs min-w-0">
              <HROrgCategorySelect
                value={selectedSubCategory}
                onChange={setSelectedSubCategory}
                ariaLabel={subGroupType === 'DEPT' ? '파트별 조직도 선택' : '직급별 조직도 선택'}
                options={[
                  { value: 'ALL', label: `전체 보기 (${filteredUsers.length}명)` },
                  ...availableSubCategories.map((subCat) => {
                    const count = filteredUsers.filter((u) =>
                      subGroupType === 'DEPT'
                        ? (u.department || '미지정 파트') === subCat
                        : (u.position || '미지정 직급') === subCat
                    ).length;
                    return { value: subCat, label: `${subCat} (${count}명)` };
                  }),
                ]}
              />
            </div>
          </div>}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-[#E2E5E9] text-center py-16 text-xs text-[#64748B]">인사 정보를 불러오는 중...</div>
      ) : activeTab === 'ORG' ? (
        subGroupType === 'DORM' ? (
          <div className="space-y-3 rounded-xl border border-[#E2E5E9] bg-white p-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-extrabold text-[#243B5A]">기숙사 현황</h2>
                <StyledDropdown
                  value={dormitoryFilter}
                  onChange={(e) => setDormitoryFilter(e.target.value)}
                  className="min-w-[112px]"
                  aria-label="기숙사 필터"
                >
                  <option value="전체 보기">전체 보기</option>
                  {dormitoryLocations.map((name) => <option key={name} value={name}>{name}</option>)}
                </StyledDropdown>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={exportDormitoryExcel} className="rounded-lg border border-[#E2E5E9] bg-white px-3 py-2 text-xs font-bold text-[#243B5A] hover:bg-[#F5F6F8]">Excel 저장</button>
                <button type="button" onClick={() => setSelectedDormitoryIds((prev) => filteredDormitoryRows.length > 0 && filteredDormitoryRows.every((row) => prev.includes(String(row.id))) ? prev.filter((id) => !filteredDormitoryRows.some((row) => String(row.id) === id)) : Array.from(new Set([...prev, ...filteredDormitoryRows.map((row) => String(row.id))])))} className="rounded-lg border border-[#E2E5E9] bg-white px-3 py-2 text-xs font-bold text-[#243B5A]">{filteredDormitoryRows.length > 0 && filteredDormitoryRows.every((row) => selectedDormitoryIds.includes(String(row.id))) ? '전체 선택 해제' : '전체 선택'}</button>
                {selectedDormitoryIds.length > 0 && <button type="button" onClick={() => void deleteSelectedDormitoryRows()} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600">선택 삭제 ({selectedDormitoryIds.length})</button>}
                <button type="button" onClick={() => openDormitoryEditor()} className="rounded-lg bg-[#243B5A] px-3 py-2 text-xs font-bold text-white hover:bg-[#1d3049]">현황 등록</button>
              </div>
            </div>
            {canManageDormitories && <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[#F5F6F8] p-2.5">
              <span className="text-xs font-bold text-[#475569]">기숙사명 관리</span>
              <input value={newDormitoryName} onChange={(e) => setNewDormitoryName(e.target.value)} placeholder="기숙사명 입력" className="min-w-[150px] flex-1 rounded-lg border border-[#E2E5E9] bg-white px-3 py-2 text-xs" />
              <button type="button" onClick={addDormitoryLocation} className="rounded-lg bg-[#243B5A] px-3 py-2 text-xs font-bold text-white">추가</button>
              {dormitoryLocations.map((name) => <span key={name} className="inline-flex items-center gap-1 rounded-full border border-[#E2E5E9] bg-white px-2 py-1 text-[11px]">{name}<button type="button" onClick={() => deleteDormitoryLocation(name)} className="font-bold text-red-600" aria-label={`${name} 삭제`}>×</button></span>)}
            </div>}
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <input value={dormitorySearch} onChange={(e) => setDormitorySearch(e.target.value)} placeholder="성명·기숙사명·호실 검색" aria-label="기숙사 현황 검색" className="w-full rounded-lg border border-[#E2E5E9] bg-[#F5F6F8] py-2 pl-9 pr-3 text-xs outline-none focus:border-[#243B5A] focus:bg-white" />
              </div>
              <button
                type="button"
                onClick={() => setDormListCollapsed((prev) => !prev)}
                className="flex items-center justify-center gap-1 rounded-lg border border-[#E2E5E9] bg-[#F5F6F8] px-3 py-2 text-xs font-bold text-[#243B5A] hover:bg-[#E2E5E9]"
              >
                <span>{dormListCollapsed ? '목록 펼치기' : '목록 접기'}</span>
                {dormListCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </button>
            </div>
            
            {dormitoryLoading ? <div className="py-8 text-center text-xs text-[#64748B]">기숙사 현황을 불러오는 중...</div> : !dormListCollapsed && <>
              <div className="space-y-2 md:hidden">
                {filteredDormitoryRows.map((row) => {
                  const person = users.find((u) => String(u.id) === String(row.user_id));
                  
                  // 같은 기숙사 및 호실 기준으로 공동 납부 정보 추출
                  const sameRoomRows = filteredDormitoryRows.filter(r => r.dormitory_name === row.dormitory_name && (r.room || '') === (row.room || ''));
                  const sharedMRecord = sameRoomRows.find(r => r.management_fee_date) || row;
                  const sharedGRecord = sameRoomRows.find(r => r.gas_fee_date) || row;

                  const feeEditor = (id: string) => users.find((u) => String(u.id) === String(id))?.name || (String(currentUser?.id || '') === String(id || '') ? currentUser?.name : '') || '확인 필요';
                  return <article key={row.id} className="rounded-xl border border-[#E2E5E9] bg-white p-3 shadow-xs">
                    <div className="flex items-start justify-between gap-2 border-b border-[#E2E5E9] pb-2">
                      <div className="flex min-w-0 items-start gap-2"><input type="checkbox" aria-label="기숙사 현황 선택" checked={selectedDormitoryIds.includes(String(row.id))} onChange={(e) => setSelectedDormitoryIds((prev) => e.target.checked ? [...prev, String(row.id)] : prev.filter((id) => id !== String(row.id)))} className="mt-1" /><div className="min-w-0"><div className="text-sm font-extrabold text-[#243B5A]">{person?.name || row.user_id}</div><div className="mt-1 text-xs text-[#64748B]">{row.dormitory_name || '-'} · {row.room || '호실 미입력'}</div></div></div>
                      <div className="flex shrink-0 gap-1">
                        {canEditDormitoryRecord(row) && (
                          <>
                            <button type="button" onClick={() => openUtilityEditor(row)} className="rounded-md border border-emerald-200 px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50">공과금</button>
                            <button type="button" onClick={() => openDormitoryEditor(row)} className="rounded-md border border-[#CBD5E1] px-2 py-1 text-[11px] font-bold text-[#243B5A] hover:bg-[#F5F6F8]">수정</button>
                            <button type="button" onClick={() => void deleteDormitoryRecord(row)} className="rounded-md border border-red-200 px-2 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50">삭제</button>
                          </>
                        )}
                      </div>
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                      <div><dt className="text-[#64748B]">입주날짜</dt><dd className="mt-0.5 font-semibold">{row.move_in_date ? String(row.move_in_date).slice(0,10).replace(/-/g,'/') : '-'}</dd></div>
                      <div><dt className="text-[#64748B]">관리비 납부일</dt><dd className="mt-0.5 font-semibold">{sharedMRecord.management_fee_date ? String(sharedMRecord.management_fee_date).slice(0,10).replace(/-/g,'/') : '-'}</dd><dd className="text-[10px] text-[#64748B]">납부자: {sharedMRecord.management_fee_date ? feeEditor(sharedMRecord.management_fee_updated_by) : '미납'}</dd></div>
                      <div><dt className="text-[#64748B]">가스비 납부일</dt><dd className="mt-0.5 font-semibold">{sharedGRecord.gas_fee_date ? String(sharedGRecord.gas_fee_date).slice(0,10).replace(/-/g,'/') : '-'}</dd><dd className="text-[10px] text-[#64748B]">납부자: {sharedGRecord.gas_fee_date ? feeEditor(sharedGRecord.gas_fee_updated_by) : '미납'}</dd></div>
                      <div className="col-span-2 rounded-lg bg-[#F8FAFC] p-2"><dt className="text-[#64748B]">비고 / 이상유무</dt><dd className="mt-0.5 whitespace-pre-wrap break-words">{row.condition_note || '내용 없음'}</dd></div>
                    </dl>
                  </article>;
                })}
                {filteredDormitoryRows.length === 0 && <div className="rounded-lg border border-[#E2E5E9] p-8 text-center text-xs text-[#64748B]">검색 결과가 없습니다.</div>}
              </div>
              <div className="hidden overflow-x-auto rounded-lg border border-[#E2E5E9] md:block">
                <table className="w-full border-collapse text-center text-xs">
                  <thead className="bg-[#F5F6F8] text-[#243B5A]">
                    <tr>
                      <th rowSpan={2} className="border border-[#CBD5E1] p-2"><input type="checkbox" aria-label="전체 선택" checked={filteredDormitoryRows.length > 0 && filteredDormitoryRows.every((row) => selectedDormitoryIds.includes(String(row.id)))} onChange={(e) => setSelectedDormitoryIds((prev) => e.target.checked ? Array.from(new Set([...prev, ...filteredDormitoryRows.map((row) => String(row.id))])) : prev.filter((id) => !filteredDormitoryRows.some((row) => String(row.id) === id)))} /></th>
                      <th rowSpan={2} className="border border-[#CBD5E1] p-2">기숙사명</th>
                      <th rowSpan={2} className="border border-[#CBD5E1] p-2">호실</th>
                      <th rowSpan={2} className="border border-[#CBD5E1] p-2">성명</th>
                      <th rowSpan={2} className="border border-[#CBD5E1] p-2">입주날짜</th>
                      <th colSpan={2} className="border border-[#CBD5E1] p-2">관리비 납부현황</th>
                      <th colSpan={2} className="border border-[#CBD5E1] p-2">가스비 납부현황</th>
                      <th rowSpan={2} className="border border-[#CBD5E1] p-2">비고 / 이상유무</th>
                      <th rowSpan={2} className="border border-[#CBD5E1] p-2">관리</th>
                    </tr>
                    <tr>
                      <th className="border border-[#CBD5E1] p-2">납부일</th>
                      <th className="border border-[#CBD5E1] p-2">납부자</th>
                      <th className="border border-[#CBD5E1] p-2">납부일</th>
                      <th className="border border-[#CBD5E1] p-2">납부자</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const rows = filteredDormitoryRows;
                      const spanMap: { dormSpan: number[]; roomSpan: number[]; mDateSpan: number[]; mPayerSpan: number[]; gDateSpan: number[]; gPayerSpan: number[]; noteSpan: number[] } = {
                        dormSpan: new Array(rows.length).fill(1),
                        roomSpan: new Array(rows.length).fill(1),
                        mDateSpan: new Array(rows.length).fill(1),
                        mPayerSpan: new Array(rows.length).fill(1),
                        gDateSpan: new Array(rows.length).fill(1),
                        gPayerSpan: new Array(rows.length).fill(1),
                        noteSpan: new Array(rows.length).fill(1),
                      };

                      // 1. 기숙사명 병합 계산
                      for (let i = 0; i < rows.length; ) {
                        let j = i;
                        while (j < rows.length && rows[j].dormitory_name === rows[i].dormitory_name) {
                          j++;
                        }
                        const count = j - i;
                        spanMap.dormSpan[i] = count;
                        for (let k = i + 1; k < j; k++) {
                          spanMap.dormSpan[k] = 0;
                        }
                        i = j;
                      }

                      // 2. 호실, 납부일, 납부자, 비고 병합 계산 (기숙사명과 호실이 같을 때)
                      for (let i = 0; i < rows.length; ) {
                        let j = i;
                        while (
                          j < rows.length &&
                          rows[j].dormitory_name === rows[i].dormitory_name &&
                          (rows[j].room || '') === (rows[i].room || '')
                        ) {
                          j++;
                        }
                        const count = j - i;
                        spanMap.roomSpan[i] = count;
                        spanMap.mDateSpan[i] = count;
                        spanMap.mPayerSpan[i] = count;
                        spanMap.gDateSpan[i] = count;
                        spanMap.gPayerSpan[i] = count;
                        spanMap.noteSpan[i] = count;
                        for (let k = i + 1; k < j; k++) {
                          spanMap.roomSpan[k] = 0;
                          spanMap.mDateSpan[k] = 0;
                          spanMap.mPayerSpan[k] = 0;
                          spanMap.gDateSpan[k] = 0;
                          spanMap.gPayerSpan[k] = 0;
                          spanMap.noteSpan[k] = 0;
                        }
                        i = j;
                      }

                      return rows.map((row, index) => {
                        const person = users.find((u) => String(u.id) === String(row.user_id));
                        
                        // 동일 호실 그룹에서 실제 납부 정보를 가지고 있는 row 탐색 (공동 반영)
                        const roomGroup = rows.filter(
                          r => r.dormitory_name === row.dormitory_name && (r.room || '') === (row.room || '')
                        );
                        const mRecord = roomGroup.find(r => r.management_fee_date) || row;
                        const gRecord = roomGroup.find(r => r.gas_fee_date) || row;

                        const mDateVal = mRecord.management_fee_date ? String(mRecord.management_fee_date).slice(0,10).replace(/-/g,'/') : '-';
                        const gDateVal = gRecord.gas_fee_date ? String(gRecord.gas_fee_date).slice(0,10).replace(/-/g,'/') : '-';

                        const mEditorName = mRecord.management_fee_date ? (users.find((u) => String(u.id) === String(mRecord.management_fee_updated_by))?.name || (String(currentUser?.id || '') === String(mRecord.management_fee_updated_by || '') ? currentUser?.name : '') || '확인 필요') : '미납';
                        const gEditorName = gRecord.gas_fee_date ? (users.find((u) => String(u.id) === String(gRecord.gas_fee_updated_by))?.name || (String(currentUser?.id || '') === String(gRecord.gas_fee_updated_by || '') ? currentUser?.name : '') || '확인 필요') : '미납';

                        const dSpan = spanMap.dormSpan[index];
                        const rSpan = spanMap.roomSpan[index];
                        const mdSpan = spanMap.mDateSpan[index];
                        const mpSpan = spanMap.mPayerSpan[index];
                        const gdSpan = spanMap.gDateSpan[index];
                        const gpSpan = spanMap.gPayerSpan[index];
                        const nSpan = spanMap.noteSpan[index];

                        return (
                          <tr key={row.id} className="hover:bg-blue-50/40">
                            <td className="border border-[#E2E5E9] p-2">
                              <input type="checkbox" aria-label={`${person?.name || row.user_id} 선택`} checked={selectedDormitoryIds.includes(String(row.id))} onChange={(e) => setSelectedDormitoryIds((prev) => e.target.checked ? [...prev, String(row.id)] : prev.filter((id) => id !== String(row.id)))} />
                            </td>
                            {dSpan > 0 && (
                              <td rowSpan={dSpan} className="border border-[#E2E5E9] p-2 font-semibold bg-white align-middle">
                                {row.dormitory_name || '-'}
                              </td>
                            )}
                            
                            {rSpan > 0 && (
                              <td rowSpan={rSpan} className="border border-[#E2E5E9] p-2 bg-white align-middle">
                                {row.room || '-'}
                              </td>
                            )}

                            <td className="border border-[#E2E5E9] p-2">{person?.name || row.user_id}</td>
                            <td className="border border-[#E2E5E9] p-2">{row.move_in_date ? String(row.move_in_date).slice(0,10).replace(/-/g,'/') : '-'}</td>
                            
                            {mdSpan > 0 && (
                              <td rowSpan={mdSpan} className="border border-[#E2E5E9] p-2 bg-white align-middle">
                                {mDateVal}
                              </td>
                            )}

                            {mpSpan > 0 && (
                              <td rowSpan={mpSpan} className="border border-[#E2E5E9] p-2 bg-white align-middle">
                                {mEditorName}
                              </td>
                            )}

                            {gdSpan > 0 && (
                              <td rowSpan={gdSpan} className="border border-[#E2E5E9] p-2 bg-white align-middle">
                                {gDateVal}
                              </td>
                            )}
                            
                            {gpSpan > 0 && (
                              <td rowSpan={gpSpan} className="border border-[#E2E5E9] p-2 bg-white align-middle">
                                {gEditorName}
                              </td>
                            )}

                            {nSpan > 0 && (
                              <td rowSpan={nSpan} className="max-w-[220px] whitespace-pre-wrap break-words border border-[#E2E5E9] p-2 text-left bg-white align-middle">
                                {row.condition_note || '-'}
                              </td>
                            )}

                            <td className="border border-[#E2E5E9] p-2">
                              <div className="flex justify-center gap-1">
                                {canEditDormitoryRecord(row) && (
                                  <>
                                    <button type="button" onClick={() => openUtilityEditor(row)} className="rounded-md border border-emerald-200 px-2 py-1 font-bold text-emerald-700 hover:bg-emerald-50">공과금</button>
                                    <button type="button" onClick={() => openDormitoryEditor(row)} className="rounded-md border border-[#CBD5E1] px-2 py-1 font-bold text-[#243B5A] hover:bg-[#F5F6F8]">수정</button>
                                    <button type="button" onClick={() => void deleteDormitoryRecord(row)} className="rounded-md border border-red-200 px-2 py-1 font-bold text-red-600 hover:bg-red-50">삭제</button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                    {filteredDormitoryRows.length === 0 && <tr><td colSpan={11} className="p-8 text-[#64748B]">검색 결과가 없습니다.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>}
            {utilityEditing && (
              <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/40 p-3 backdrop-blur-xs">
                <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border border-[#E2E5E9] bg-white p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-[#E2E5E9] pb-3">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 bg-[#243B5A] text-white rounded-lg"><Building2 className="h-4 w-4" /></div>
                      <h3 className="text-sm font-extrabold text-[#243B5A]">공과금 납입일 등록</h3>
                    </div>
                    <button type="button" onClick={() => setUtilityEditing(null)} className="rounded-lg p-1 text-[#64748B] hover:bg-[#F5F6F8] transition">✕</button>
                  </div>
                  <p className="text-xs font-semibold text-[#64748B]">
                    {users.find((u) => String(u.id) === String(utilityEditing.user_id))?.name || ''} · {utilityEditing.dormitory_name || ''} {utilityEditing.room || ''} (동일 호실 거주 인원 공동 적용)
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-[#475569] mb-1">관리비 납부일</label>
                      <CalendarDatePicker value={utilityForm.management_fee_date} onChange={(date) => setUtilityForm((f) => ({ ...f, management_fee_date: date }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#475569] mb-1">가스비 납부일</label>
                      <CalendarDatePicker value={utilityForm.gas_fee_date} onChange={(date) => setUtilityForm((f) => ({ ...f, gas_fee_date: date }))} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E5E9]">
                    <button type="button" onClick={() => setUtilityEditing(null)} className="rounded-lg border border-[#E2E5E9] bg-white px-4 py-2 text-xs font-bold text-[#64748B] hover:bg-[#F5F6F8] transition">취소</button>
                    <button type="button" onClick={() => void saveUtilityDates()} className="rounded-lg bg-[#243B5A] px-4 py-2 text-xs font-bold text-white hover:bg-[#1d3049] transition">납입일 저장</button>
                  </div>
                </div>
              </div>
            )}
            {dormitoryEditing !== null && (
              <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 p-3 backdrop-blur-xs">
                <div role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#E2E5E9] bg-white p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-[#E2E5E9] pb-3">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 bg-[#243B5A] text-white rounded-lg"><Building2 className="h-4 w-4" /></div>
                      <h3 className="text-sm font-extrabold text-[#243B5A]">기숙사 현황 {dormitoryEditing?.id ? '수정' : '등록'}</h3>
                    </div>
                    <button type="button" onClick={() => setDormitoryEditing(null)} className="rounded-lg p-1 text-[#64748B] hover:bg-[#F5F6F8] transition">✕</button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="text-xs font-bold text-[#475569]">구성원
                      <StyledDropdown
                        value={dormitoryForm.user_id}
                        onChange={(e) => setDormitoryForm((f) => ({...f,user_id:e.target.value}))}
                        disabled={!canManageDormitories}
                        className="mt-1 w-full"
                        aria-label="구성원 선택"
                      >
                        <option value="">구성원 선택</option>
                        {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.id})</option>)}
                      </StyledDropdown>
                    </label>
                    <label className="text-xs font-bold text-[#475569]">기숙사명
                      <StyledDropdown
                        value={dormitoryForm.dormitory_name}
                        onChange={(e) => setDormitoryForm((f) => ({...f,dormitory_name:e.target.value}))}
                        className="mt-1 w-full"
                        aria-label="기숙사명 선택"
                      >
                        <option value="">기숙사 선택</option>
                        {dormitoryLocations.map((name) => <option key={name} value={name}>{name}</option>)}
                      </StyledDropdown>
                    </label>
                    <label className="text-xs font-bold text-[#475569]">호실
                      <input value={dormitoryForm.room} onChange={(e) => setDormitoryForm((f) => ({...f,room:e.target.value}))} placeholder="예: 302호" className="mt-1 w-full rounded-lg border border-[#E2E5E9] bg-[#F5F6F8] p-2.5 text-xs text-[#1F2937] font-normal outline-none focus:bg-white focus:border-[#243B5A]" />
                    </label>
                    <label className="text-xs font-bold text-[#475569]">입주날짜
                      <div className="mt-1"><CalendarDatePicker value={dormitoryForm.move_in_date} onChange={(date) => setDormitoryForm((f) => ({...f,move_in_date:date}))} /></div>
                    </label>
                    <label className="text-xs font-bold text-[#475569]">관리비 납부일
                      <div className="mt-1"><CalendarDatePicker value={dormitoryForm.management_fee_date} onChange={(date) => setDormitoryForm((f) => ({...f,management_fee_date:date}))} /></div>
                    </label>
                    <label className="text-xs font-bold text-[#475569]">가스비 납부일
                      <div className="mt-1"><CalendarDatePicker value={dormitoryForm.gas_fee_date} onChange={(date) => setDormitoryForm((f) => ({...f,gas_fee_date:date}))} /></div>
                    </label>
                    <label className="text-xs font-bold text-[#475569] sm:col-span-2">비고 / 이상유무
                      <textarea value={dormitoryForm.condition_note} onChange={(e) => setDormitoryForm((f) => ({...f,condition_note:e.target.value}))} rows={3} placeholder="기숙사 상태, 이상유무 등을 입력하세요." className="mt-1 w-full resize-y rounded-lg border border-[#E2E5E9] bg-[#F5F6F8] p-2.5 text-xs text-[#1F2937] font-normal outline-none focus:bg-white focus:border-[#243B5A]" />
                    </label>
                  </div>
                  <div className="mt-4 flex justify-end gap-2 pt-3 border-t border-[#E2E5E9]">
                    <button type="button" onClick={() => setDormitoryEditing(null)} className="rounded-lg border border-[#E2E5E9] bg-white px-4 py-2 text-xs font-bold text-[#64748B] hover:bg-[#F5F6F8] transition">취소</button>
                    <button type="button" onClick={() => void saveDormitoryRecord()} className="rounded-lg bg-[#243B5A] px-4 py-2 text-xs font-bold text-white hover:bg-[#1d3049] transition">저장</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
        <div className="space-y-3">
          {displayedCategories.map((catName) => {
            const groupMembers = filteredUsers.filter((u) =>
              subGroupType === 'DEPT'
                ? (u.department || '미지정 파트') === catName
                : (u.position || '미지정 직급') === catName
            );

            const sortMembers = (a: HRUser, b: HRUser) => {
              if (catName === '책임' || subGroupType === 'POS') {
                const titleOrderA = JOB_TITLE_ORDER_IN_RANK[a.job_title || '팀원'] || 99;
                const titleOrderB = JOB_TITLE_ORDER_IN_RANK[b.job_title || '팀원'] || 99;
                if (titleOrderA !== titleOrderB) {
                  return titleOrderA - titleOrderB;
                }
              }
              const dateA = a.join_date || a.career_start_date || '9999-12-31';
              const dateB = b.join_date || b.career_start_date || '9999-12-31';
              return dateA.localeCompare(dateB);
            };

            const leaders = groupMembers.filter(u => ['본부장', '소장', '팀장'].includes(u.job_title || '')).sort(sortMembers);
            const members = groupMembers.filter(u => !['본부장', '소장', '팀장'].includes(u.job_title || '')).sort(sortMembers);

            const isCollapsed = !!collapsedGroups[catName];

            return (
              <div key={catName} className="bg-white border border-[#E2E5E9] rounded-xl overflow-hidden shadow-xs transition-all">
                <div 
                  onClick={() => toggleGroup(catName)}
                  className="flex items-center justify-between p-3 bg-[#F5F6F8] hover:bg-[#E2E5E9]/50 cursor-pointer border-b border-[#E2E5E9] transition"
                >
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-[#243B5A] text-white rounded-lg">
                      {subGroupType === 'DEPT' ? <Building2 className="h-3.5 w-3.5" /> : <Briefcase className="h-3.5 w-3.5" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-[#1F2937] text-xs flex items-center gap-2">
                        {catName} 
                        <span className="text-[10px] bg-white text-[#243B5A] font-bold px-2 py-0.2 rounded-full border border-[#E2E5E9]">
                          총 {groupMembers.length}명
                        </span>
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button className="text-[#64748B] hover:text-[#1F2937] p-1 flex items-center gap-1 text-xs font-medium">
                      <span>{isCollapsed ? '펼치기' : '접기'}</span>
                      {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="p-3 bg-gradient-to-b from-slate-50/50 to-white space-y-3">
                    {leaders.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1 text-[11px] font-bold text-[#243B5A] px-1">
                          <GitCommit className="h-3.5 w-3.5 text-[#243B5A]" />
                          <span>파트 리더 (본부장/소장/팀장)</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                          {leaders.map((leader) => renderMemberCard(leader, true, setDetailUser, isSelf, handleOpenEditModal, handleDeleteUser, canEditUser, isAdmin, handleCallUser))}
                        </div>
                      </div>
                    )}

                    {leaders.length > 0 && members.length > 0 && (
                      <div className="relative flex justify-center my-1">
                        <div className="h-3 w-0.5 bg-slate-300"></div>
                      </div>
                    )}

                    {members.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1 text-[11px] font-bold text-[#64748B] px-1">
                          <Users className="h-3.5 w-3.5 text-[#64748B]" />
                          <span>소속 구성원 ({members.length}명)</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                          {members.map((member) => renderMemberCard(member, false, setDetailUser, isSelf, handleOpenEditModal, handleDeleteUser, canEditUser, isAdmin, handleCallUser))}
                        </div>
                      </div>
                    )}

                    {groupMembers.length === 0 && (
                      <div className="text-center py-6 text-xs text-[#64748B]">소속된 구성원이 없습니다.</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        )
      ) : (
        <div>
          <div className="block md:hidden space-y-2.5">
            {listViewUsers.map((u, index) => {
              const canEdit = canEditUser(u);
              const joinCareer = calculateCareerDetails(u.join_date);
              const totalCareer = calculateCareerDetails(u.career_start_date);
              const age = calculateAge(u.password);

              const isFirstFormer = isFormerEmployee(u) && (index === 0 || !isFormerEmployee(listViewUsers[index - 1]));
              return (
                <Fragment key={u.id}>
                {isFirstFormer && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">퇴사자</div>}
                <div className={`bg-white p-3 border rounded-xl shadow-xs space-y-2 ${isFormerEmployee(u) ? 'border-amber-200' : 'border-[#E2E5E9]'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-[#1F2937]">{u.name}</span>
                        {age && <span className="text-[10px] text-[#243B5A] font-bold">({age}세)</span>}
                        {u.id && <span className="text-[10px] text-[#64748B] font-mono">({u.id})</span>}
                        {isSelf(u) && (
                          <span className="text-[9px] bg-[#243B5A] text-white font-bold px-1.5 py-0.2 rounded shrink-0">
                            나
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#64748B] flex items-center gap-1 flex-wrap">
                        <span className="px-1.5 py-0.5 bg-[#F5F6F8] font-medium rounded border border-[#E2E5E9]">
                          {u.department || '미지정'} · {u.position || '사원'} {u.job_title && u.job_title !== '없음' ? `(${u.job_title}${u.field ? `/${u.field}` : ''})` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      {canEdit && (
                        <button
                          onClick={() => handleOpenEditModal(u)}
                          className="p-1.5 text-[#243B5A] hover:bg-[#F5F6F8] rounded-lg transition border border-[#E2E5E9]"
                          title="수정"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteUser(u)}
                          className="p-1.5 text-[#DC2626] hover:bg-red-50 rounded-lg transition border border-red-200"
                          title="삭제"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#F5F6F8] p-2 rounded-lg border border-[#E2E5E9]">
                    <div>
                      <span className="text-[#64748B] block text-[10px]">연락처</span>
                      {u.phone ? (
                        <a href={`tel:${u.phone}`} className="font-medium text-[#243B5A] hover:underline flex items-center gap-1 truncate">
                          <Phone className="h-3 w-3 shrink-0" /> <span className="truncate">{u.phone}</span>
                        </a>
                      ) : (
                        <span className="font-medium text-[#1F2937]">-</span>
                      )}
                    </div>
                    <div>
                      <span className="text-[#64748B] block text-[10px]">권한</span>
                      <span className={`font-bold ${u.role === 'ADMIN' ? 'text-[#243B5A]' : 'text-[#64748B]'}`}>
                        {u.role === 'ADMIN' || u.role === 'SUPER_ADMIN' ? '관리자' : ['TEAM_LEADER', 'TEAMLEADER', 'LEADER'].includes(String(u.role || '').toUpperCase()) ? '팀장' : '일반'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block text-[10px]">자사 근속</span>
                      <span className="font-semibold text-[#16A34A]">{joinCareer || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block text-[10px]">비파괴 총 경력</span>
                      <span className="font-semibold text-[#2563EB]">{totalCareer || '-'}</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-[#1F2937] bg-white border border-[#E2E5E9] rounded-lg p-2 space-y-1">
                    <div><span className="font-bold text-[#64748B]">사내자격(NDT Level):</span> {renderCertText(getNdtCertLabels(u))}</div>
                    <div><span className="font-bold text-[#64748B]">국가 자격:</span> {renderCertText(getNationalCertLabels(u))}</div>
                    <div><span className="font-bold text-[#64748B]">YARD 자격:</span> {renderCertText(getYardCertLabels(u))}</div>
                  </div>
                </div>
                </Fragment>
              );
            })}
          </div>

          <div className="hidden md:block bg-white border border-[#E2E5E9] rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F6F8] border-b border-[#E2E5E9] font-bold text-[#64748B]">
                <tr>
                  <th className="p-3">성명 (나이/아이디)</th>
                  <th className="p-3">파트 / 직급(직책/분야)</th>
                  <th className="p-3">연락처 / 주소</th>
                  <th className="p-3">권한</th>
                  <th className="p-3">자사 근속 (입사일)</th>
                  <th className="p-3">비파괴 총 경력 (시작일)</th>
                  <th className="p-3">사내자격(NDT Level)</th>
                  <th className="p-3">국가 자격</th>
                  <th className="p-3">YARD 자격</th>
                  <th className="p-3 text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E5E9]">
                {listViewUsers.map((u, index) => {
                  const canEdit = canEditUser(u);
                  const age = calculateAge(u.password);
                  const isFirstFormer = isFormerEmployee(u) && (index === 0 || !isFormerEmployee(listViewUsers[index - 1]));
                  return (
                    <Fragment key={u.id}>
                    {isFirstFormer && <tr><td colSpan={10} className="border-y border-amber-200 bg-amber-50 px-3 py-2 font-bold text-amber-800">퇴사자</td></tr>}
                    <tr className={`transition ${isFormerEmployee(u) ? 'bg-amber-50/30 hover:bg-amber-50/60' : 'hover:bg-[#F5F6F8]/60'}`}>
                      <td className="p-3 font-bold text-[#1F2937]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{u.name}</span>
                          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${u.work_status === '휴무' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{u.work_status === '휴무' ? '휴무' : '근무중'}</span>
                          {age && <span className="text-xs text-[#243B5A] font-bold">({age}세)</span>}
                          {u.id && <span className="text-[10px] text-[#64748B] font-mono font-normal">({u.id})</span>}
                          {isSelf(u) && (
                            <span className="text-[10px] bg-[#243B5A] text-white font-bold px-1.5 py-0.2 rounded">
                              나
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-[#1F2937]">
                        {u.department} / {u.position} {u.job_title && u.job_title !== '없음' ? `(${u.job_title}${u.field ? `/${u.field}` : ''})` : ''}
                      </td>
                      <td className="p-3 font-medium">
                        <div>
                          {u.phone ? (
                            <a href={`tel:${u.phone}`} className="text-[#243B5A] hover:underline flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {u.phone}
                            </a>
                          ) : '-'}
                        </div>
                        <div className="text-[10px] text-[#64748B] mt-0.5 truncate max-w-[180px]">
                          {u.address || '주소 미등록'}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          u.role === 'ADMIN' ? 'bg-[#243B5A] text-white border-[#243B5A]' : 'bg-[#F5F6F8] text-[#64748B] border-[#E2E5E9]'
                        }`}>
                          {u.role === 'ADMIN' || u.role === 'SUPER_ADMIN' ? '관리자' : ['TEAM_LEADER', 'TEAMLEADER', 'LEADER'].includes(String(u.role || '').toUpperCase()) ? '팀장' : '일반'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="text-[#16A34A] font-semibold">{calculateCareerDetails(u.join_date) || '-'}</div>
                        <div className="text-[10px] text-[#64748B]">{u.join_date || ''}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-[#2563EB] font-semibold">{calculateCareerDetails(u.career_start_date) || '-'}</div>
                        <div className="text-[10px] text-[#64748B]">{u.career_start_date || ''}</div>
                      </td>
                      <td className="p-3 text-[#1F2937] font-medium">{renderCertText(getNdtCertLabels(u))}</td>
                      <td className="p-3 text-[#1F2937] font-medium">{renderCertText(getNationalCertLabels(u))}</td>
                      <td className="p-3 text-[#1F2937] font-medium">{renderCertText(getYardCertLabels(u))}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {canEdit && (
                            <button
                              onClick={() => handleOpenEditModal(u)}
                              className="p-1.5 text-[#243B5A] hover:bg-[#F5F6F8] rounded-lg transition border border-[#E2E5E9]"
                              title="정보 수정"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 text-[#DC2626] hover:bg-red-50 rounded-lg transition border border-red-200"
                              title="삭제"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detailUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-3">
          <div className="bg-white border-t sm:border border-[#E2E5E9] rounded-t-2xl sm:rounded-xl max-w-md w-full p-4 shadow-2xl space-y-3 text-[#1F2937] relative animate-in slide-in-from-bottom duration-200">
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto sm:hidden mb-1"></div>

            <div className="flex items-start justify-between border-b border-[#E2E5E9] pb-2.5">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-full bg-[#243B5A] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {detailUser.name?.[0] || '유'}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-xs font-bold text-[#1F2937]">
                      {detailUser.name} {calculateAge(detailUser.password) ? `(${calculateAge(detailUser.password)}세)` : ''}
                    </h3>
                    {detailUser.id && <span className="text-[10px] text-[#64748B] font-mono">({detailUser.id})</span>}
                    {isSelf(detailUser) && (
                      <span className="text-[10px] bg-[#243B5A] text-white font-bold px-1.5 py-0.2 rounded-full">
                        나
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#64748B] font-medium">
                    {detailUser.department || '미지정 파트'} · {detailUser.position || '사원'} {detailUser.job_title && detailUser.job_title !== '없음' ? `(${detailUser.job_title}${detailUser.field ? `/${detailUser.field}` : ''})` : ''}
                  </p>
                  <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${detailUser.work_status === '휴무' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{detailUser.work_status === '휴무' ? '휴무' : '근무중'}</span>
                </div>
              </div>
              <button 
                onClick={() => setDetailUser(null)} 
                className="text-[#64748B] hover:text-[#1F2937] p-1 rounded-lg hover:bg-[#F5F6F8] transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="bg-[#F5F6F8] p-2.5 rounded-lg space-y-2 border border-[#E2E5E9]">
                {detailUser.id && (
                  <div className="flex items-center justify-between text-[#1F2937] pb-2 border-b border-[#E2E5E9]">
                    <span className="font-semibold text-[#64748B] flex items-center gap-1.5">
                      <AtSign className="h-3.5 w-3.5 text-[#243B5A]" /> 로그인 아이디
                    </span>
                    <span className="font-bold font-mono text-[#243B5A]">{detailUser.id}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-[#1F2937] pb-2 border-b border-[#E2E5E9]">
                  <span className="font-semibold text-[#64748B] flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-[#243B5A]" /> 연락처
                  </span>
                  {detailUser.phone ? (
                    <button
                      type="button"
                      onClick={() => handleCallUser(detailUser)}
                      className="font-bold text-[#243B5A] hover:underline flex items-center gap-1"
                    >
                      {detailUser.phone}
                    </button>
                  ) : (
                    <span className="font-bold text-[#1F2937]">미등록</span>
                  )}
                </div>
                <div className="flex items-start justify-between text-[#1F2937]">
                  <span className="font-semibold text-[#64748B] shrink-0 pt-0.5">주소</span>
                  <span className="font-medium text-right text-[#1F2937]">{detailUser.address || '미등록'}</span>
                </div>
              </div>

              {canEditUser(detailUser) && (
                <div className="rounded-lg border border-[#E2E5E9] p-2.5 space-y-2">
                  <div className="text-[11px] font-bold text-[#475569]">근무 상태 변경</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => handleQuickStatusChange(detailUser, '근무중')} className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${detailUser.work_status !== '휴무' ? 'border-emerald-300 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'border-[#E2E5E9] bg-white text-[#64748B]'}`}>● 근무중</button>
                    <button type="button" onClick={() => handleQuickStatusChange(detailUser, '휴무')} className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${detailUser.work_status === '휴무' ? 'border-blue-300 bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'border-[#E2E5E9] bg-white text-[#64748B]'}`}>● 휴무</button>
                  </div>
                </div>
              )}

              {canManageAbsence(detailUser) && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-bold text-[#243B5A]">휴무 날짜 관리</div>
                    <div className="text-[10px] text-[#64748B]">여러 날짜 선택 가능</div>
                  </div>
                  {detailAbsenceDatesLoading ? (
                    <div className="text-[11px] text-blue-700">등록된 휴무 날짜를 불러오는 중...</div>
                  ) : (
                    <MultiDateCalendar value={detailAbsenceDates} onChange={setDetailAbsenceDates} />
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-[#64748B]">저장 전까지 변경 내용은 반영되지 않습니다.</span>
                    <button
                      type="button"
                      onClick={handleSaveDetailAbsenceDates}
                      disabled={detailAbsenceDatesLoading || detailAbsenceDatesSaving || valuesEqualForSave(detailAbsenceDates, detailAbsenceDatesOriginal)}
                      className="shrink-0 rounded-lg bg-[#243B5A] px-3 py-2 text-[11px] font-bold text-white transition hover:bg-[#1d3049] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {detailAbsenceDatesSaving ? '저장 중...' : '휴무 날짜 저장'}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#F5F6F8] p-2.5 rounded-lg border border-[#E2E5E9]">
                  <span className="text-[10px] text-[#16A34A] font-bold block mb-0.5">자사 근속</span>
                  <span className="text-xs font-extrabold text-[#1F2937] block">
                    {calculateCareerDetails(detailUser.join_date) || '-'}
                  </span>
                </div>

                <div className="bg-[#F5F6F8] p-2.5 rounded-lg border border-[#E2E5E9]">
                  <span className="text-[10px] text-[#2563EB] font-bold block mb-0.5">비파괴 총 경력</span>
                  <span className="text-xs font-extrabold text-[#1F2937] block">
                    {calculateCareerDetails(detailUser.career_start_date) || '-'}
                  </span>
                </div>
              </div>

              <div className="bg-[#F5F6F8] p-2.5 rounded-lg space-y-1 border border-[#E2E5E9]">
                <div className="text-[11px]"><span className="font-bold text-[#64748B]">사내자격(NDT Level):</span> {renderCertText(getNdtCertLabels(detailUser))}</div>
                <div className="text-[11px]"><span className="font-bold text-[#64748B]">국가 자격:</span> {renderCertText(getNationalCertLabels(detailUser))}</div>
                <div className="text-[11px]"><span className="font-bold text-[#64748B]">YARD 자격:</span> {renderCertText(getYardCertLabels(detailUser))}</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2.5 border-t border-[#E2E5E9]">
              {canEditUser(detailUser) ? (
                <button
                  onClick={() => {
                    const target = detailUser;
                    setDetailUser(null);
                    handleOpenEditModal(target);
                  }}
                  className="px-3 py-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white font-bold rounded-lg text-xs transition flex items-center space-x-1"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>정보 수정</span>
                </button>
              ) : <div />}
              
              <button
                onClick={() => setDetailUser(null)}
                className="px-3.5 py-1.5 bg-white border border-[#E2E5E9] hover:bg-[#F5F6F8] text-[#1F2937] font-bold rounded-lg text-xs transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white border border-[#E2E5E9] rounded-xl max-w-lg w-full p-4 shadow-xl space-y-3 max-h-[90vh] overflow-y-auto text-[#1F2937]">
            <div className="flex items-center justify-between border-b border-[#E2E5E9] pb-2.5">
              <h3 className="font-bold text-xs text-[#1F2937]">
                {selectedUser 
                  ? (isSelf(selectedUser) ? '내 인사 정보 수정' : '구성원 정보 수정') 
                  : '신규 구성원 등록'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#64748B] hover:text-[#1F2937] p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-[#64748B] mb-1 flex items-center gap-1">
                    <AtSign className="h-3.5 w-3.5 text-[#243B5A]" /> 로그인 아이디 *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="예: w987654"
                    value={formData.inputId}
                    onChange={(e) => setFormData({ ...formData, inputId: e.target.value })}
                    className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#64748B] mb-1">성명 *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#64748B] mb-1 flex items-center gap-1">
                  생년월일 8자리 (나이 및 비밀번호) *
                </label>
                <input
                  type="text"
                  maxLength={8}
                  placeholder="예: 19950101"
                  value={formData.birthDate}
                  onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                  className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none font-mono"
                />
              </div>

              <div className="rounded-xl border border-[#E2E5E9] bg-[#F8FAFC] p-3">
                <div className="flex items-center gap-3">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="프로필 미리보기"
                      className="h-20 w-20 rounded-xl object-cover border border-[#E2E5E9] bg-white"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-xl bg-slate-200 text-[#243B5A] flex items-center justify-center text-xl font-bold">
                      {formData.name?.[0] || '유'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <label className="block font-bold text-[#64748B] mb-1">사진</label>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                      onChange={(e) => handlePhotoChange(e.target.files?.[0] || null)}
                      className="block w-full text-[11px] text-[#64748B] file:mr-2 file:rounded-lg file:border-0 file:bg-[#243B5A] file:px-2.5 file:py-1.5 file:text-[11px] file:font-semibold file:text-white hover:file:bg-[#1d3049]"
                    />
                    <p className="mt-1 text-[10px] text-[#94A3B8]">JPG, PNG, WebP만 등록할 수 있습니다.</p>
                  </div>
                </div>
              </div>

              {canAssignRoles && (
                <div>
                  <label className="block font-bold text-[#64748B] mb-1 flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5 text-[#243B5A]" /> 시스템 권한 부여
                  </label>
                  <StyledDropdown
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none cursor-pointer font-bold"
                  >
                    <option value="USER">일반 (USER)</option>
                    <option value="TEAM_LEADER">팀장 (TEAM_LEADER)</option>
                    <option value="ADMIN">관리자 (ADMIN)</option>
                  </StyledDropdown>
                </div>
              )}

              <div>
                <label className="block font-bold text-[#64748B] mb-2">근무 상태</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setFormData(prev => ({ ...prev, work_status: '근무중' }))} className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${formData.work_status === '근무중' ? 'border-emerald-300 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'border-[#E2E5E9] bg-white text-[#64748B]'}`}>● 근무중</button>
                  <button type="button" onClick={() => setFormData(prev => ({ ...prev, work_status: '휴무' }))} className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${formData.work_status === '휴무' ? 'border-blue-300 bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'border-[#E2E5E9] bg-white text-[#64748B]'}`}>● 휴무</button>
                </div>
                <p className="mt-1 text-[10px] text-[#64748B]">별도 상태가 등록되지 않은 구성원은 근무중으로 표시됩니다.</p>
                <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/60 p-2.5 space-y-2">
                  <div className="text-[11px] font-bold text-blue-800">날짜별 휴무 (여러 날짜 선택 가능)</div>
                  {absenceDatesLoading ? <div className="text-[11px] text-blue-700">등록된 휴무 날짜를 불러오는 중...</div> : <MultiDateCalendar value={formData.absence_dates} onChange={(dates) => setFormData(prev => ({ ...prev, absence_dates: dates }))} />}
                  <p className="text-[10px] text-blue-700">근무 상태가 ‘근무중’이어도 특정 날짜만 휴무로 등록할 수 있습니다. 선택한 날짜는 업무현황에서 해당 날짜의 휴무자로 처리됩니다.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-[#64748B] mb-1">파트 (부서)</label>
                  <StyledDropdown
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none cursor-pointer"
                  >
                    {Array.from(new Set(['운영', '관리', '1팀', '2팀', '3팀', '4팀', ...users.map(user => String(user.department || '').trim()).filter(Boolean), formData.department].filter(Boolean))).map(part => <option key={part} value={part}>{part}</option>)}
                  </StyledDropdown>
                </div>
                <div>
                  <label className="block font-bold text-[#64748B] mb-1">직급</label>
                  <input
                    type="text"
                    placeholder="예: 책임, 프로 등"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-[#64748B] mb-1">직책</label>
                  <StyledDropdown
                    value={formData.job_title}
                    onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                    className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none cursor-pointer"
                  >
                    <option value="본부장">본부장</option>
                    <option value="소장">소장</option>
                    <option value="팀장">팀장</option>
                    <option value="팀원">팀원</option>
                    <option value="없음">없음</option>
                  </StyledDropdown>
                </div>
                <div>
                  <label className="block font-bold text-[#64748B] mb-1">분야</label>
                  <StyledDropdown
                    value={formData.field}
                    onChange={(e) => setFormData({ ...formData, field: e.target.value })}
                    className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none cursor-pointer"
                  >
                    <option value="안전">안전</option>
                    <option value="캐빈">캐빈</option>
                    <option value="사무">사무</option>
                    <option value="QA">QA</option>
                    <option value="공정 및 스케쥴">공정 및 스케쥴</option>
                    <option value="공정">공정</option>
                  </StyledDropdown>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-[#64748B] mb-1">연락처</label>
                  <input
                    type="text"
                    placeholder="예: 010-0000-0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#64748B] mb-1">주소</label>
                  <input
                    type="text"
                    placeholder="주소 입력"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-[#64748B] mb-1">자사 근속 시작일 (입사일)</label>
                  <CalendarDatePicker value={formData.join_date} onChange={(date) => setFormData(prev => ({ ...prev, join_date: date }))} />
                </div>
                <div>
                  <label className="block font-bold text-[#64748B] mb-1">비파괴 총 경력 시작일</label>
                  <CalendarDatePicker value={formData.career_start_date} onChange={(date) => setFormData(prev => ({ ...prev, career_start_date: date }))} />
                </div>
              </div>

              <details className="rounded-xl border border-[#E2E5E9] p-3" open={false}>
                <summary className="cursor-pointer font-bold text-[#243B5A] flex items-center justify-between">국가 자격 <span className="text-[10px] text-[#64748B] font-normal">{formData.national_cert_details.length}개 · 눌러서 펼치기</span></summary>
                <div className="pt-3 space-y-2.5">
                  <div className="text-[10px] text-[#64748B]">종목은 직접 입력하고, 종류는 메뉴에서 선택합니다.</div>
                  {formData.national_cert_details.map((cert, index) => (
                    <details key={`national-${index}`} className="rounded-lg border border-[#E2E5E9] p-2">
                      <summary className="cursor-pointer font-semibold text-[#1F2937]">국가 자격 {index + 1}: {cert.method || '종목 미입력'} · {cert.kind || '종류 선택'}</summary>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                        <input value={cert.method} placeholder="종목 직접 입력" onChange={(e) => setFormData(prev => ({ ...prev, national_cert_details: prev.national_cert_details.map((item, i) => i === index ? { ...item, method: e.target.value } : item) }))} className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs" />
                        <StyledDropdown value={cert.kind} onChange={(e) => setFormData(prev => ({ ...prev, national_cert_details: prev.national_cert_details.map((item, i) => i === index ? { ...item, kind: e.target.value } : item) }))} className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs">
                          <option value="">종류 선택</option>{NATIONAL_KINDS.map(kind => <option key={kind} value={kind}>{kind}</option>)}
                        </StyledDropdown>
                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, national_cert_details: prev.national_cert_details.filter((_, i) => i !== index) }))} className="text-left text-red-600 font-semibold">이 국가 자격 삭제</button>
                      </div>
                    </details>
                  ))}
                  <button type="button" onClick={() => setFormData(prev => ({ ...prev, national_cert_details: [...prev.national_cert_details, { method: '', kind: '' }] }))} className="px-3 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg font-semibold">+ 국가 자격 추가</button>
                </div>
              </details>

              <details className="rounded-xl border border-[#E2E5E9] p-3">
                <summary className="cursor-pointer font-bold text-[#243B5A] flex items-center justify-between">YARD 자격 <span className="text-[10px] text-[#64748B] font-normal">{formData.yard_cert_details.length}개 · 눌러서 펼치기</span></summary>
                <div className="pt-3 space-y-2.5">
                  <div className="text-[10px] text-[#64748B]">각 교육별로 교육일과 보수일을 따로 관리합니다. 보수일은 교육일 기준 2년 주기로 자동 계산됩니다.</div>
                  {formData.yard_cert_details.map((yard, index) => (
                    <details key={`yard-${index}`} className="rounded-lg border border-[#E2E5E9] p-2">
                      <summary className="cursor-pointer font-semibold text-[#1F2937]">{yard.name || `YARD 교육 ${index + 1}`} · {yard.education_date || '교육일 미입력'}</summary>
                      <div className="pt-2 space-y-2">
                        <label className="block text-[10px] font-bold text-[#64748B]">교육명</label>
                        <input value={yard.name} placeholder="교육명 입력" onChange={(e) => setFormData(prev => ({ ...prev, yard_cert_details: prev.yard_cert_details.map((item, i) => i === index ? { ...item, name: e.target.value } : item) }))} className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs" />
                        <label className="block text-[10px] font-bold text-[#64748B]">교육일</label>
                        <CalendarDatePicker value={yard.education_date} onChange={(date) => setFormData(prev => ({ ...prev, yard_cert_details: prev.yard_cert_details.map((item, i) => i === index ? { ...item, education_date: date, renewal_dates: Array.from({ length: item.renewal_count }, (_, j) => addYearsToDate(date, 2 * (j + 1))) } : item) }))} />
                        <details className="rounded-lg border border-[#E2E5E9] p-2">
                          <summary className="cursor-pointer font-semibold">보수교육 횟수 선택 (현재 {yard.renewal_count}회)</summary>
                          <StyledDropdown value={yard.renewal_count} onChange={(e) => { const count = Number(e.target.value); setFormData(prev => ({ ...prev, yard_cert_details: prev.yard_cert_details.map((item, i) => i === index ? { ...item, renewal_count: count, renewal_dates: Array.from({ length: count }, (_, j) => addYearsToDate(item.education_date, 2 * (j + 1))) } : item) })); }} className="mt-2 w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs"><option value={0}>0회</option><option value={1}>1회</option><option value={2}>2회</option><option value={3}>3회</option><option value={4}>4회</option></StyledDropdown>
                        </details>
                        {yard.renewal_dates.map((date, renewalIndex) => <div key={`yard-${index}-renewal-${renewalIndex}`} className="space-y-1"><label className="block text-[10px] text-[#64748B]">보수교육일 {renewalIndex + 1}회</label><CalendarDatePicker value={date} onChange={(nextDate) => setFormData(prev => ({ ...prev, yard_cert_details: prev.yard_cert_details.map((item, i) => i === index ? { ...item, renewal_dates: item.renewal_dates.map((d, j) => j === renewalIndex ? nextDate : d) } : item) }))} /></div>)}
                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, yard_cert_details: prev.yard_cert_details.filter((_, i) => i !== index) }))} className="text-left text-red-600 font-semibold">이 YARD 교육 삭제</button>
                      </div>
                    </details>
                  ))}
                  <button type="button" onClick={() => setFormData(prev => ({ ...prev, yard_cert_details: [...prev.yard_cert_details, { name: '', education_date: '', renewal_count: 0, renewal_dates: [] }] }))} className="px-3 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg font-semibold">+ YARD 교육 추가</button>
                </div>
              </details>

              <details className="rounded-xl border border-[#E2E5E9] p-3">
                <summary className="cursor-pointer font-bold text-[#243B5A] flex items-center justify-between">사내자격 (NDT Level) <span className="text-[10px] text-[#64748B] font-normal">{formData.ndt_certificates.length}개 · 눌러서 펼치기</span></summary>
                <div className="pt-3 space-y-2.5">
                  <div className="text-[10px] text-[#64748B]">종목은 드롭다운에서 선택합니다. 발행일 기준 5년 후 유효기간이 자동 입력되며, 자격별 유효일을 확인할 수 있습니다.</div>
                  {formData.ndt_certificates.map((cert, index) => {
                    const isLt = isLtCertificateSubject(cert.subject);
                    const selectedLtSubjects = isLt ? getLtSubjects(cert.subject) : [];
                    const updateLt = (nextSubjects: string[], changes: Partial<typeof cert> = {}) => {
                      setFormData(prev => {
                        const next = prev.ndt_certificates.slice();
                        if (nextSubjects.length === 0) return { ...prev, ndt_certificates: next.filter((_, i) => i !== index) };
                        next[index] = { ...next[index], ...changes, subject: nextSubjects.join(', ') };
                        return { ...prev, ndt_certificates: next };
                      });
                    };
                    return (
                    <details key={`ndt-${index}`} className="rounded-lg border border-[#E2E5E9] p-2">
                      <summary className="cursor-pointer font-semibold">{isLt ? `LT ${cert.level || 'Level 선택'} (${selectedLtSubjects.map(value => LT_SUBJECTS.find(item => item.value === value)?.label || value).join(', ') || '서브종목 미선택'})` : `${cert.subject || '종목 미선택'} · ${cert.level || 'Level 선택'}`} · 유효일 {cert.expiry_date || '미입력'}</summary>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                        <div><label className="block text-[10px] text-[#64748B] mb-1">발행형태</label><StyledDropdown value={cert.issuer} onChange={(e) => setFormData(prev => ({ ...prev, ndt_certificates: prev.ndt_certificates.map((item, i) => i === index ? { ...item, issuer: e.target.value } : item) }))} className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs"><option value="사내">사내</option><option value="ASNT/ISO">ASNT/ISO</option></StyledDropdown></div>
                        {isLt ? <div className="sm:col-span-2 rounded-lg bg-[#F8FAFC] border border-[#E2E5E9] p-2"><div className="text-[10px] font-bold text-[#64748B] mb-2">LT 서브종목 선택 (복수 선택 가능)</div><div className="grid grid-cols-1 sm:grid-cols-3 gap-2">{LT_SUBJECTS.map(item => <label key={item.value} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={selectedLtSubjects.includes(item.value)} onChange={(e) => { const next = e.target.checked ? [...selectedLtSubjects, item.value] : selectedLtSubjects.filter(value => value !== item.value); updateLt(next); }} />{item.label}</label>)}</div></div> : <div><label className="block text-[10px] text-[#64748B] mb-1">종목</label><StyledDropdown value={cert.subject} onChange={(e) => setFormData(prev => ({ ...prev, ndt_certificates: prev.ndt_certificates.map((item, i) => i === index ? { ...item, subject: e.target.value } : item) }))} className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs"><option value="">종목 선택</option>{Array.from(new Set([...ndtSubjectOptions.filter(subject => !isLtCertificateSubject(subject)), ...(cert.subject && !ndtSubjectOptions.includes(cert.subject) ? [cert.subject] : [])])).map(subject => <option key={subject} value={subject}>{subject}</option>)}</StyledDropdown></div>}
                        <div><label className="block text-[10px] text-[#64748B] mb-1">종류</label><StyledDropdown value={cert.level} onChange={(e) => setFormData(prev => ({ ...prev, ndt_certificates: prev.ndt_certificates.map((item, i) => i === index ? { ...item, level: e.target.value } : item) }))} className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs"><option value="Level I">Level I</option><option value="Level II">Level II</option><option value="Level III">Level III</option></StyledDropdown></div>
                        <div><label className="block text-[10px] text-[#64748B] mb-1">발행일</label><CalendarDatePicker value={cert.issue_date} onChange={(date) => setFormData(prev => ({ ...prev, ndt_certificates: prev.ndt_certificates.map((item, i) => i === index ? { ...item, issue_date: date, expiry_date: addYearsToDate(date, 5) } : item) }))} /></div>
                        <div><label className="block text-[10px] text-[#64748B] mb-1">유효일 (발행일 + 5년)</label><CalendarDatePicker value={cert.expiry_date} onChange={(date) => setFormData(prev => ({ ...prev, ndt_certificates: prev.ndt_certificates.map((item, i) => i === index ? { ...item, expiry_date: date } : item) }))} /></div>
                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, ndt_certificates: prev.ndt_certificates.filter((_, i) => i !== index) }))} className="text-left text-red-600 font-semibold">이 NDT 자격 삭제</button>
                      </div>
                    </details>
                    );
                  })}
                  {!formData.ndt_certificates.some(cert => isLtCertificateSubject(cert.subject)) && <button type="button" onClick={() => setFormData(prev => ({ ...prev, ndt_certificates: [{ issuer: '사내', subject: LT_SUBJECTS[0].value, level: 'Level I', issue_date: '', expiry_date: '' }, ...prev.ndt_certificates] }))} className="px-3 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg font-semibold">+ LT 자격 추가</button>}
                  <button type="button" onClick={() => setFormData(prev => ({ ...prev, ndt_certificates: [...prev.ndt_certificates, { issuer: '사내', subject: '', level: 'Level I', issue_date: '', expiry_date: '' }] }))} className="px-3 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg font-semibold">+ 기타 NDT 자격 추가</button>
                  {isAdmin && <details className="rounded-lg border border-[#E2E5E9] p-2"><summary className="cursor-pointer font-semibold">종목 목록 관리</summary><div className="pt-2 space-y-2"><div className="flex flex-wrap gap-2">{ndtSubjectOptions.map(subject => <span key={subject} className="inline-flex items-center gap-1 rounded-full bg-[#F5F6F8] border border-[#E2E5E9] px-2 py-1 text-xs">{subject}<button type="button" aria-label={`${subject} 삭제`} onClick={async () => { const { error } = await supabase.from('ndt_subject_options').delete().eq('subject', subject); if (error) { showNotice(`종목 삭제 실패: ${error.message}`, 'error'); return; } setNdtSubjectOptions(prev => prev.filter(item => item !== subject)); showNotice('종목을 삭제했습니다.', 'success'); }} className="text-red-600 font-bold">×</button></span>)}</div><div className="flex gap-2"><input value={newNdtSubject} onChange={e => setNewNdtSubject(e.target.value)} placeholder="추가할 종목명" className="min-w-0 flex-1 p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs"/><button type="button" onClick={async () => { const subject = newNdtSubject.trim(); if (!subject) return; if (ndtSubjectOptions.includes(subject)) { showNotice('이미 등록된 종목입니다.', 'warning'); return; } const { error } = await supabase.from('ndt_subject_options').insert({ subject }); if (error) { showNotice(`종목 추가 실패: ${error.message}`, 'error'); return; } setNdtSubjectOptions(prev => [...prev, subject]); setNewNdtSubject(''); showNotice('종목을 추가했습니다.', 'success'); }} className="px-3 py-2 bg-[#243B5A] text-white rounded-lg text-xs font-semibold">추가</button></div></div></details>}
                </div>
              </details>

              <div className="flex justify-end space-x-2 pt-2.5 border-t border-[#E2E5E9]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 bg-white border border-[#E2E5E9] hover:bg-[#F5F6F8] rounded-lg text-xs text-[#1F2937]"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white rounded-lg text-xs font-semibold flex items-center space-x-1 transition"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>저장</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {callConfirmUser && (
        <div className="fixed inset-0 z-[115] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-[#E2E5E9] p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-extrabold text-[#243B5A]">전화 연결</h3>
            <p className="text-sm text-[#475569] leading-6">
              <span className="font-bold text-[#1F2937]">[{callConfirmUser.name}]</span>님에게 전화 연결하시겠습니까?
              <br />{callConfirmUser.phone}
            </p>
            <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E5E9]">
              <button
                type="button"
                onClick={() => setCallConfirmUser(null)}
                className="px-4 py-2 rounded-lg border border-[#E2E5E9] bg-white text-xs font-bold text-[#64748B] hover:bg-[#F5F6F8] transition"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmCall}
                className="px-4 py-2 rounded-lg bg-[#243B5A] text-white text-xs font-bold hover:bg-[#1d3049] transition"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {partManagerOpen && isAdmin && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 p-3 backdrop-blur-xs sm:p-4" onClick={() => setPartManagerOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="파트 추가 및 관리" className="w-full max-w-lg overflow-hidden rounded-xl border border-[#E2E5E9] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.18)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#E2E5E9] px-4 py-3">
              <div>
                <h3 className="text-sm font-extrabold text-[#1F2937]">파트 추가 / 수정 / 삭제</h3>
                <p className="mt-1 text-[11px] text-[#64748B]">파트명을 관리합니다. 수정·삭제는 해당 파트 소속 직원에게 반영됩니다.</p>
              </div>
              <button type="button" onClick={() => setPartManagerOpen(false)} aria-label="파트 설정 닫기" className="rounded-md p-1.5 text-[#64748B] hover:bg-[#F5F6F8]"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4 p-4">
              <div className="rounded-lg border border-[#E2E5E9] bg-[#F8FAFC] p-3">
                <form className="flex gap-2" onSubmit={async (e) => {
                  e.preventDefault();
                  const partName = newPartName.trim();
                  if (!partName) return;
                  if (availableSubCategories.some(part => part.toLowerCase() === partName.toLowerCase())) { showNotice('이미 존재하는 파트명입니다.', 'warning'); return; }
                  const names = newPartMembers.split(',').map(name => name.trim()).filter(Boolean);
                  const targets = names.length ? users.filter(user => names.some(name => name.toLowerCase() === user.name.trim().toLowerCase())) : [];
                  if (names.length && targets.length !== names.length) { showNotice('직원 이름을 찾을 수 없습니다. 이름을 확인해 주세요.', 'warning'); return; }
                  try {
                    for (const user of targets) {
                      const { error } = await supabase.from('app_users').update({ department: partName }).eq('id', user.id);
                      if (error) throw error;
                    }
                    setUsers(prev => prev.map(user => targets.some(target => target.id === user.id) ? { ...user, department: partName } : user));
                    setManagedPartNames(prev => {
                      const next = Array.from(new Set([...prev, partName]));
                      try { window.localStorage.setItem('hr_managed_part_names', JSON.stringify(next)); } catch {}
                      return next;
                    });
                    setNewPartName('');
                    setNewPartMembers('');
                    showNotice(`'${partName}' 파트가 추가되었습니다.${targets.length ? ` ${targets.length}명의 직원을 배정했습니다.` : ' 직원은 나중에 배정할 수 있습니다.'}`, 'success');
                  } catch (error: any) { showNotice(`파트 추가 실패: ${error?.message || '오류'}`, 'error'); }
                }}>
                  <input value={newPartName} onChange={(e) => setNewPartName(e.target.value)} placeholder="파트명 (예: 5팀)" aria-label="추가할 파트명" className="min-w-0 flex-1 rounded-lg border border-[#D7DDE5] bg-white px-3 py-2 text-xs outline-none focus:border-[#243B5A] focus:ring-2 focus:ring-[#243B5A]/10" />
                  <button type="submit" className="rounded-lg bg-[#243B5A] px-4 py-2 text-xs font-bold text-white hover:bg-[#1D3049]">추가</button>
                </form>
                <div className="mt-2">
                  <label className="mb-1 block text-[10px] font-semibold text-[#475569]">초기 배정 직원 <span className="font-normal text-[#94A3B8]">(선택사항, 쉼표로 구분)</span></label>
                  <input value={newPartMembers} onChange={(e) => setNewPartMembers(e.target.value)} placeholder="예: 홍길동, 김철수 (입력하지 않아도 됩니다)" aria-label="초기 배정 직원 이름" className="w-full rounded-lg border border-[#D7DDE5] bg-white px-3 py-2 text-xs outline-none focus:border-[#243B5A] focus:ring-2 focus:ring-[#243B5A]/10" />
                </div>
                <p className="mt-2 text-[10px] text-[#64748B]">직원은 파트 생성 시 배정하거나 나중에 구성원 정보 수정에서 배정할 수 있습니다.</p>
              </div>
              <div className="max-h-[45vh] space-y-2 overflow-y-auto">
                {availableSubCategories.filter(part => part !== '미지정 파트').map(part => (
                  <div key={part} className="flex items-center justify-between gap-2 rounded-lg border border-[#E2E5E9] bg-[#F8FAFC] px-3 py-2.5">
                    <div className="min-w-0"><div className="text-xs font-bold text-[#243B5A]">{part}</div><div className="mt-0.5 text-[10px] text-[#64748B]">{users.filter(user => (user.department || '') === part).length}명 소속</div></div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button type="button" onClick={() => { setPartEditTarget(part); setPartEditName(part); }} className="rounded-md border border-[#D7DDE5] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#243B5A] hover:bg-slate-100">수정</button>
                      <button type="button" onClick={() => setPartDeleteTarget(part)} className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-100">삭제</button>
                    </div>
                  </div>
                ))}
                {availableSubCategories.filter(part => part !== '미지정 파트').length === 0 && <p className="py-5 text-center text-xs text-[#64748B]">등록된 파트가 없습니다.</p>}
              </div>
            </div>
            <div className="flex justify-end border-t border-[#E2E5E9] bg-[#F8FAFC] px-4 py-3"><button type="button" onClick={() => setPartManagerOpen(false)} className="rounded-lg bg-[#243B5A] px-4 py-2 text-xs font-bold text-white">닫기</button></div>
          </div>
        </div>
      )}

      {partEditTarget && isAdmin && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/40 p-3 backdrop-blur-xs sm:p-4" onClick={() => setPartEditTarget(null)}>
          <div role="dialog" aria-modal="true" aria-label="파트명 수정" className="w-full max-w-sm overflow-hidden rounded-xl border border-[#E2E5E9] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.18)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between bg-[#243B5A] px-3.5 py-2.5"><span className="text-xs font-bold tracking-wide text-white">파트명 수정</span><button type="button" onClick={() => setPartEditTarget(null)} aria-label="닫기" className="rounded-md px-1.5 text-lg leading-none text-white/80 hover:bg-white/10">×</button></div>
            <form className="space-y-4 p-4" onSubmit={async (e) => {
              e.preventDefault();
              const nextName = partEditName.trim();
              if (!nextName) { showNotice('파트명을 입력해 주세요.', 'warning'); return; }
              if (nextName === partEditTarget) { setPartEditTarget(null); return; }
              if (availableSubCategories.some(existing => existing.toLowerCase() === nextName.toLowerCase())) { showNotice('이미 존재하는 파트명입니다.', 'warning'); return; }
              try {
                const oldName = partEditTarget;
                const members = users.filter(user => (user.department || '') === oldName);
                for (const user of members) { const { error } = await supabase.from('app_users').update({ department: nextName }).eq('id', user.id); if (error) throw error; }
                setUsers(prev => prev.map(user => user.department === oldName ? { ...user, department: nextName } : user));
                setManagedPartNames(prev => { const next = prev.map(name => name === oldName ? nextName : name); try { window.localStorage.setItem('hr_managed_part_names', JSON.stringify(next)); } catch {} return next; });
                setSelectedSubCategory('ALL'); setPartEditTarget(null); showNotice(`'${oldName}' 파트명이 '${nextName}'(으)로 수정되었습니다.`, 'success');
              } catch (error: any) { showNotice(`파트 수정 실패: ${error?.message || '오류'}`, 'error'); }
            }}>
              <label className="block text-xs font-semibold text-[#475569]">파트명</label>
              <input autoFocus value={partEditName} onChange={(e) => setPartEditName(e.target.value)} className="mt-1 w-full rounded-lg border border-[#D7DDE5] bg-white px-3 py-2.5 text-sm text-[#1F2937] outline-none focus:border-[#243B5A] focus:ring-2 focus:ring-[#243B5A]/10" />
              <div className="flex justify-end gap-2 border-t border-[#E2E5E9] pt-3"><button type="button" onClick={() => setPartEditTarget(null)} className="rounded-lg border border-[#E2E5E9] bg-white px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-[#F5F6F8]">취소</button><button type="submit" className="rounded-lg bg-[#243B5A] px-4 py-2 text-xs font-bold text-white hover:bg-[#1D3049]">저장</button></div>
            </form>
          </div>
        </div>
      )}

      {partDeleteTarget && isAdmin && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/40 p-3 backdrop-blur-xs sm:p-4" onClick={() => setPartDeleteTarget(null)}>
          <div role="dialog" aria-modal="true" aria-label="파트 삭제 확인" className="w-full max-w-sm overflow-hidden rounded-xl border border-rose-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.18)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between bg-[#243B5A] px-3.5 py-2.5"><span className="text-xs font-bold tracking-wide text-white">현장관리 알림</span><button type="button" onClick={() => setPartDeleteTarget(null)} aria-label="닫기" className="rounded-md px-1.5 text-lg leading-none text-white/80 hover:bg-white/10">×</button></div>
            <div className="flex items-start gap-3 px-4 py-4"><div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-600 text-[11px] font-extrabold text-white">!</div><div><h3 className="text-sm font-bold text-[#1F2937]">파트 삭제 확인</h3><p className="mt-1 text-xs leading-5 text-[#475569]">'{partDeleteTarget}' 파트를 삭제하시겠습니까?<br />소속 직원은 '미지정 파트'로 변경됩니다.</p></div></div>
            <div className="flex justify-end gap-2 border-t border-[#E2E5E9] bg-[#F8FAFC] px-4 py-3"><button type="button" onClick={() => setPartDeleteTarget(null)} className="rounded-lg border border-[#E2E5E9] bg-white px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-[#F5F6F8]">취소</button><button type="button" onClick={async () => {
              const part = partDeleteTarget;
              try {
                const members = users.filter(user => (user.department || '') === part);
                for (const user of members) { const { error } = await supabase.from('app_users').update({ department: null }).eq('id', user.id); if (error) throw error; }
                setUsers(prev => prev.map(user => user.department === part ? { ...user, department: '' } : user));
                setManagedPartNames(prev => { const next = prev.filter(name => name !== part); try { window.localStorage.setItem('hr_managed_part_names', JSON.stringify(next)); } catch {} return next; });
                setSelectedSubCategory('ALL'); setPartDeleteTarget(null); showNotice(`'${part}' 파트가 삭제되었습니다.`, 'success');
              } catch (error: any) { setPartDeleteTarget(null); showNotice(`파트 삭제 실패: ${error?.message || '오류'}`, 'error'); }
            }} className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700">삭제</button></div>
          </div>
        </div>
      )}

      {confirmUser && (
        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-md overflow-hidden rounded-xl border border-rose-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.16)] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between bg-[#243B5A] px-3.5 py-2">
              <span className="text-[11px] font-bold tracking-wide text-white">현장관리 알림</span>
              <button type="button" onClick={() => setConfirmUser(null)} aria-label="알림 닫기" className="rounded-md px-1.5 text-lg leading-none text-white/80 hover:bg-white/10 hover:text-white">×</button>
            </div>
            <div className="flex items-start gap-3 px-4 py-4">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-600 text-[11px] font-extrabold text-white">!</div>
              <div className="flex-1 space-y-1">
                <h3 className="text-sm font-bold text-[#1F2937]">구성원 삭제 확인</h3>
                <p className="text-xs leading-5 text-[#475569]">
                  정말로 <span className="font-bold text-[#1F2937]">[{confirmUser.name}]</span> 님의 인사 정보를 삭제하시겠습니까?
                  <br />삭제된 데이터는 복구할 수 없습니다.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 bg-[#F8FAFC] px-4 py-3 border-t border-[#E2E5E9]">
              <button
                type="button"
                onClick={() => setConfirmUser(null)}
                className="rounded-lg border border-[#E2E5E9] bg-white px-3.5 py-1.5 text-xs font-bold text-[#64748B] hover:bg-[#F5F6F8] transition"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700 transition"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDormitoryRow && (
        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-md overflow-hidden rounded-xl border border-rose-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.16)] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between bg-[#243B5A] px-3.5 py-2">
              <span className="text-[11px] font-bold tracking-wide text-white">현장관리 알림</span>
              <button type="button" onClick={() => setConfirmDormitoryRow(null)} aria-label="알림 닫기" className="rounded-md px-1.5 text-lg leading-none text-white/80 hover:bg-white/10 hover:text-white">×</button>
            </div>
            <div className="flex items-start gap-3 px-4 py-4">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-600 text-[11px] font-extrabold text-white">!</div>
              <div className="flex-1 space-y-1">
                <h3 className="text-sm font-bold text-[#1F2937]">기숙사 현황 삭제 확인</h3>
                <p className="text-xs leading-5 text-[#475569]">
                  해당 기숙사 현황을 삭제하시겠습니까?
                  <br />삭제된 데이터는 복구할 수 없습니다.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 bg-[#F8FAFC] px-4 py-3 border-t border-[#E2E5E9]">
              <button
                type="button"
                onClick={() => setConfirmDormitoryRow(null)}
                className="rounded-lg border border-[#E2E5E9] bg-white px-3.5 py-1.5 text-xs font-bold text-[#64748B] hover:bg-[#F5F6F8] transition"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDormitory}
                className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700 transition"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
      </>}
    </div>
  );
}

function renderMemberCard(
  member: HRUser, 
  isLeader: boolean, 
  setDetailUser: (user: HRUser) => void, 
  isSelf: (user: HRUser) => boolean,
  handleOpenEditModal: (user: HRUser) => void,
  handleDeleteUser: (user: HRUser) => void,
  canEditUser: (user: HRUser) => boolean,
  isAdmin: boolean,
  handleCallUser: (user: HRUser) => void
) {
  const joinCareer = calculateCareerDetails(member.join_date);
  const totalCareer = calculateCareerDetails(member.career_start_date);
  const age = calculateAge(member.password);

  return (
    <div 
      key={member.id} 
      className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between space-y-1.5 group shadow-xs ${
        isLeader 
          ? 'bg-white border-[#243B5A] ring-1 ring-[#243B5A]/20 shadow-sm' 
          : 'bg-white border-[#E2E5E9] hover:border-slate-400 hover:shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between">
        <div 
          onClick={() => setDetailUser(member)}
          className="flex items-center space-x-2 min-w-0 cursor-pointer flex-1"
        >
          {member.photo_url ? (
            <img
              src={member.photo_url}
              alt={`${member.name} 사진`}
              className="w-9 h-9 rounded-full object-cover border border-[#E2E5E9] shrink-0"
            />
          ) : (
            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
              isLeader ? 'bg-[#243B5A] text-white' : 'bg-slate-200 text-[#243B5A]'
            }`}>
              {member.name?.[0] || '유'}
            </div>
          )}
          <div className="truncate">
            <div className="flex items-center space-x-1.5 flex-wrap">
              <span className="font-bold text-xs text-[#1F2937] group-hover:text-[#243B5A] transition-colors">{member.name}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${member.work_status === '휴무' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{member.work_status === '휴무' ? '휴무' : '근무중'}</span>
              {age && <span className="text-[10px] text-[#243B5A] font-bold">({age}세)</span>}
              {isSelf(member) && (
                <span className="text-[9px] bg-[#243B5A] text-white font-bold px-1">
                  나
                </span>
              )}
            </div>
            <div className="text-[10px] text-[#64748B] flex items-center gap-1 pt-0.5">
              <span>{member.position || '사원'}</span>
              {member.job_title && member.job_title !== '없음' && (
                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                  isLeader ? 'bg-[#243B5A] text-white' : 'bg-sky-50 text-sky-700 border border-sky-200'
                }`}>
                  {member.job_title}{member.field ? `/${member.field}` : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1 shrink-0">
          {canEditUser(member) && (
            <button
              onClick={() => handleOpenEditModal(member)}
              className="p-1 text-[#243B5A] hover:bg-slate-100 rounded border border-slate-200"
              title="수정"
            >
              <Edit3 className="h-3 w-3" />
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => handleDeleteUser(member)}
              className="p-1 text-red-600 hover:bg-red-50 rounded border border-red-200"
              title="삭제"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div className="pt-1.5 border-t border-[#E2E5E9] text-[10px] space-y-1">
        <div className="flex items-center justify-between text-[#64748B]">
          {member.phone ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCallUser(member);
              }}
              className="flex items-center gap-1 font-medium text-[#243B5A] hover:underline"
              title="전화 연결"
            >
              <Phone className="h-3 w-3 text-[#243B5A] shrink-0" />
              {member.phone}
            </button>
          ) : (
            <span className="flex items-center gap-1 font-medium">
              <Phone className="h-3 w-3 text-[#94A3B8] shrink-0" />
              -
            </span>
          )}
          <div className="space-x-1.5">
            <span className="font-semibold text-[#16A34A]">근속 {joinCareer || '-'}</span>
            <span className="font-semibold text-[#2563EB]">총경력 {totalCareer || '-'}</span>
          </div>
        </div>
      </div>
      <div className="pt-1 border-t border-[#E2E5E9] text-[9px] text-[#64748B] space-y-0.5">
        <div><span className="font-bold">사내자격(NDT Level):</span> <span className="text-[#1F2937]">{renderCertText(getNdtCertLabels(member))}</span></div>
        <div><span className="font-bold">국가 자격:</span> <span className="text-[#1F2937]">{renderCertText(getNationalCertLabels(member))}</span></div>
        <div><span className="font-bold">YARD 자격:</span> <span className="text-[#1F2937]">{renderCertText(getYardCertLabels(member))}</span></div>
      </div>
    </div>
  );
}
