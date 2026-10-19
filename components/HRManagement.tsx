'use client';

import React, { Fragment, useState, useEffect, useCallback, useRef } from 'react';
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
  initialAction?: 'self-edit' | 'my-team' | null;
  onInitialActionHandled?: () => void;
  onCurrentUserStatusChange?: (status: '근무중' | '휴무') => void;
}

// 변경 여부를 비교할 때 객체 키 순서 차이와 undefined/null 차이로 불필요한 UPDATE가 발생하지 않게 합니다.
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

const DEPT_ORDER = ['운영', '관리', '1팀', '2팀', '3팀', '4팀'];

// 자격 표시는 구조화된 자격 상세 데이터만 사용합니다.
// 과거 national_certificates / internal_certificates 문자열에 남아 있는 잘못된 값은
// 화면에 재사용하지 않으며, 기존 DB 문자열 자체는 자동 삭제하지 않습니다.
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

// 예전처럼 LT 하위 종목별로 저장된 자료도 편집 화면에서는 하나의 LT 자격으로 묶습니다.
function normalizeNdtCertificates(list: Array<{ issuer: string; subject: string; level: string; issue_date: string; expiry_date: string }> = []) {
  // 이전 저장 형식의 취득일/유효일 키도 읽어서 현재 UI의 표준 키로 맞춥니다.
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

// 목록뷰에서 퇴사/퇴직으로 표시된 구성원은 별도 구역으로 모아 맨 아래에 표시합니다.
// 현재 조회되는 기존 필드만 검사하며 DB 컬럼이나 기존 데이터를 변경하지 않습니다.
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

/** 앱 공통 스타일 드롭다운: 브라우저/모바일 기본 option 팝업 대신 동일한 디자인의 선택 목록을 표시합니다. */
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

/** 여러 날짜를 선택할 수 있는 달력 모달. 기존 CalendarDatePicker와 동일한 색상 체계를 사용합니다. */
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

  const [subGroupType, setSubGroupType] = useState<'DEPT' | 'POS'>('DEPT');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('ALL');

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

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
  const isSuperAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(myRole.toUpperCase());

  const isSelf = (targetUser: HRUser) => {
    if (!currentUser) return false;
    if (currentUser.id && targetUser.id && currentUser.id === targetUser.id) return true;
    if (currentUser.name && targetUser.name && currentUser.name.trim() === targetUser.name.trim()) return true;
    return false;
  };

  const canEditUser = (targetUser: HRUser) => {
    return isAdmin || isSelf(targetUser);
  };

  const handleQuickStatusChange = async (targetUser: HRUser, status: '근무중' | '휴무') => {
    const currentStatus = targetUser.work_status === '휴무' ? '휴무' : '근무중';
    if (currentStatus === status) return;
    if (!canEditUser(targetUser)) {
      showNotice('본인 상태 또는 수정 권한이 있는 구성원만 변경할 수 있습니다.', 'warning');
      return;
    }
    try {
      const { error } = await supabase
        .from('app_users')
        .update({ work_status: status })
        .eq('id', targetUser.id);
      if (error) throw error;

      const updatedUser = { ...targetUser, work_status: status };
      setUsers(prev => prev.map(user => user.id === targetUser.id ? updatedUser : user));
      setDetailUser(prev => prev?.id === targetUser.id ? updatedUser : prev);
      if (isSelf(targetUser)) onCurrentUserStatusChange?.(status);
      showNotice(`${targetUser.name}님의 상태가 '${status}'(으)로 변경되었습니다.`, 'success');
    } catch (error: any) {
      console.error('근무 상태 변경 실패:', error?.message || error);
      showNotice('근무 상태 저장에 실패했습니다. 권한과 work_status 컬럼을 확인해주세요.', 'error');
    }
  };

  // 구성원 상세정보(간단히 표시되는 팝업)를 열었을 때 해당 구성원의 휴무 날짜를 조회합니다.
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
    if (!detailUser?.id || !canEditUser(detailUser)) {
      showNotice('본인의 정보 또는 관리자 권한이 있는 경우에만 휴무 날짜를 수정할 수 있습니다.', 'warning');
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
      showNotice(`${detailUser.name}님의 휴무 날짜가 저장되었습니다.`, 'success');
    } catch (error: any) {
      console.error('상세정보 창 휴무 날짜 저장 실패:', error?.message || error);
      showNotice('휴무 날짜 저장에 실패했습니다. 권한과 user_day_status 테이블을 확인해주세요.', 'error');
    } finally {
      setDetailAbsenceDatesSaving(false);
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

      const formatted = (data || []).map((u: any) => ({
        ...u,
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
    }
    onInitialActionHandled?.();
  }, [initialAction, loading, users, currentUser, onInitialActionHandled]);

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

      if (isSuperAdmin && formData.role) {
        payload.role = formData.role;
      }

      if (selectedUser) {
        // 실제 변경된 컬럼만 전송합니다. 변경 사항이 없으면 app_users UPDATE를 생략합니다.
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
            role: isSuperAdmin ? (formData.role || 'USER') : 'USER',
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
        role: payload.role ?? selectedUser?.role ?? (isSuperAdmin ? (formData.role || 'USER') : 'USER'),
        photo_url: savedPhotoUrl || selectedUser?.photo_url || null,
        national_certificates: payload.national_certificates || payload.certificates || selectedUser?.national_certificates || '',
        national_cert_details: formData.national_cert_details,
        yard_cert_details: formData.yard_cert_details,
        ndt_certificates: formData.ndt_certificates,
        work_status: formData.work_status === '휴무' ? '휴무' : '근무중'
      };
      if (isSelf(savedUser)) {
        onCurrentUserStatusChange?.(savedUser.work_status === '휴무' ? '휴무' : '근무중');
      }
      // 날짜별 휴무는 별도 테이블에 저장하여 업무현황에서 날짜 기준으로 조회할 수 있게 합니다.
      const targetUserId = formData.inputId.trim();
      const { data: existingAbsenceRows, error: absenceReadError } = await supabase.from('user_day_status').select('status_date').eq('user_id', targetUserId).eq('status', '휴무');
      if (absenceReadError) throw absenceReadError;
      const existingDates = new Set((existingAbsenceRows || []).map((row: any) => String(row.status_date)));
      const nextDates = new Set(formData.work_status === '휴무' ? formData.absence_dates : []);
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

  // 카드뷰 순서는 유지하고, 목록뷰에서만 퇴사자를 별도 그룹으로 맨 아래에 둡니다.
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
    ? rawSubCategories.sort((a, b) => {
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
            </div>

            <div className="flex items-center space-x-2 text-xs">
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
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
            <span className="text-xs font-bold text-[#64748B] shrink-0 flex items-center gap-0.5">
              <ChevronRight className="h-3.5 w-3.5" />
            </span>

            <button
              onClick={() => setSelectedSubCategory('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition border ${
                selectedSubCategory === 'ALL'
                  ? 'bg-[#243B5A] text-white border-[#243B5A]'
                  : 'bg-[#F5F6F8] text-[#64748B] border-[#E2E5E9] hover:bg-[#E2E5E9]'
              }`}
            >
              전체 보기 ({filteredUsers.length}명)
            </button>

            {availableSubCategories.map((subCat) => {
              const count = filteredUsers.filter((u) => 
                subGroupType === 'DEPT' 
                  ? (u.department || '미지정 파트') === subCat 
                  : (u.position || '미지정 직급') === subCat
              ).length;

              return (
                <button
                  key={subCat}
                  onClick={() => setSelectedSubCategory(subCat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition border ${
                    selectedSubCategory === subCat
                      ? 'bg-[#243B5A] text-white border-[#243B5A]'
                      : 'bg-[#F5F6F8] text-[#64748B] border-[#E2E5E9] hover:bg-[#E2E5E9]'
                  }`}
                >
                  {subCat} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-[#E2E5E9] text-center py-16 text-xs text-[#64748B]">인사 정보를 불러오는 중...</div>
      ) : activeTab === 'ORG' ? (
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
                        {u.role === 'ADMIN' ? '관리자' : '일반 사용자'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block text-[10px]">자사 근속</span>
                      <span className="font-semibold text-[#16A34A]">{joinCareer || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block text-[10px]">총 경력</span>
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
                  <th className="p-3">총 경력 (시작일)</th>
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
                          {u.role === 'ADMIN' ? '관리자' : '일반 사용자'}
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

              {canEditUser(detailUser) && (
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
                  <span className="text-[10px] text-[#2563EB] font-bold block mb-0.5">총 경력</span>
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

              {isSuperAdmin && (
                <div>
                  <label className="block font-bold text-[#64748B] mb-1 flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5 text-[#243B5A]" /> 시스템 권한 부여
                  </label>
                  <StyledDropdown
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none cursor-pointer font-bold"
                  >
                    <option value="USER">일반 사용자 (USER)</option>
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
                {formData.work_status === '휴무' && <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/60 p-2.5 space-y-2">
                  <div className="text-[11px] font-bold text-blue-800">휴무 날짜 (여러 날짜 선택 가능)</div>
                  {absenceDatesLoading ? <div className="text-[11px] text-blue-700">등록된 휴무 날짜를 불러오는 중...</div> : <MultiDateCalendar value={formData.absence_dates} onChange={(dates) => setFormData(prev => ({ ...prev, absence_dates: dates }))} />}
                  <p className="text-[10px] text-blue-700">선택한 날짜는 업무현황에서 날짜별 휴무자로 조회할 수 있도록 별도 저장됩니다.</p>
                </div>}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-[#64748B] mb-1">파트 (부서)</label>
                  <StyledDropdown
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none cursor-pointer"
                  >
                    <option value="운영">운영</option>
                    <option value="관리">관리</option>
                    <option value="1팀">1팀</option>
                    <option value="2팀">2팀</option>
                    <option value="3팀">3팀</option>
                    <option value="4팀">4팀</option>
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
                  <label className="block font-bold text-[#64748B] mb-1">총 경력 시작일</label>
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
                        <div><label className="block text-[10px] text-[#64748B] mb-1">발급형태</label><StyledDropdown value={cert.issuer} onChange={(e) => setFormData(prev => ({ ...prev, ndt_certificates: prev.ndt_certificates.map((item, i) => i === index ? { ...item, issuer: e.target.value } : item) }))} className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs"><option value="사내">사내</option><option value="ASNT/ISO">ASNT/ISO</option></StyledDropdown></div>
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

      {notice && (
        <div className="fixed top-3 left-3 right-3 sm:top-5 sm:left-auto sm:right-5 z-[100] w-auto sm:w-[min(92vw,420px)] pt-[env(safe-area-inset-top)]">
          <div role="status" aria-live="polite" className={`rounded-xl border bg-white px-3.5 sm:px-4 py-3 shadow-lg flex items-start gap-3 ${
            notice.type === 'success' ? 'border-green-200' :
            notice.type === 'error' ? 'border-red-200' :
            notice.type === 'warning' ? 'border-amber-200' : 'border-blue-200'
          }`}>
            <div className={`mt-0.5 h-2.5 w-2.5 rounded-full shrink-0 ${
              notice.type === 'success' ? 'bg-green-500' :
              notice.type === 'error' ? 'bg-red-500' :
              notice.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
            }`} />
            <p className="text-sm font-medium text-[#1F2937] flex-1">{notice.message}</p>
            <button onClick={() => setNotice(null)} className="text-[#94A3B8] hover:text-[#475569]">×</button>
          </div>
        </div>
      )}

      {callConfirmUser && (
        <div className="fixed inset-0 z-[115] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-xl bg-white shadow-2xl border border-[#E2E5E9] p-4 sm:p-5">
            <h3 className="text-lg font-bold text-[#1F2937]">전화 연결</h3>
            <p className="mt-2 text-sm text-[#64748B] leading-6">
              <span className="font-bold text-[#1F2937]">[{callConfirmUser.name}]</span>님에게 전화 연결하시겠습니까?
              <br />{callConfirmUser.phone}
            </p>
            <div className="mt-5 flex flex-col-reverse sm:flex-row justify-end gap-2">
              <button
                type="button"
                onClick={() => setCallConfirmUser(null)}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-lg border border-[#CBD5E1] text-sm font-semibold text-[#475569] hover:bg-[#F8FAFC] transition"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmCall}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-lg bg-[#243B5A] text-white text-sm font-semibold hover:bg-[#1d3049] transition"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmUser && (
        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-xl bg-white shadow-2xl border border-[#E2E5E9] p-4 sm:p-5">
            <h3 className="text-lg font-bold text-[#1F2937]">구성원 삭제</h3>
            <p className="mt-2 text-sm text-[#64748B] leading-6">
              정말로 <span className="font-bold text-[#1F2937]">[{confirmUser.name}]</span> 님의 인사 정보를 삭제하시겠습니까?
              <br />삭제 후에는 복구할 수 없습니다.
            </p>
            <div className="mt-5 flex flex-col-reverse sm:flex-row justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmUser(null)}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-lg border border-[#CBD5E1] text-sm font-semibold text-[#475569] hover:bg-[#F8FAFC] transition"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition"
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
