'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ChevronDown, ChevronRight, Plus, Edit3, Trash2, X, Download, Award, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';

type Person = {
  id: string; name: string; department?: string; position?: string;
  career_start_date?: string; experience?: string; role?: string;
  yard_certificates?: string; national_certificates?: string; internal_certificates?: string;
  cert_assignments?: Record<string, { level?: string; cert_no?: string; cert_type?: string }>;
};
type Category = 'YARD' | 'NATIONAL' | 'NDT';
type CertRecord = {
  id: string; user_id: string; category: Category; title: string;
  obtained_date: string | null; expiry_date: string | null; method: string | null;
  level: string | null; cert_no: string | null; sticker_no: string | null;
  education_completed: string | null; training_date_1: string | null;
  training_date_2: string | null; training_date_3: string | null; training_date_4: string | null;
  cert_type: string | null; // '사내발급' 또는 'ASNT/ISO'
  detail: Record<string, any> | null;
};
type Holiday = { holiday_date: string; name?: string };
const C = { navy: '#243B5A', pale: '#F5F6F8', border: '#E2E5E9', text: '#1F2937', muted: '#64748B' };
const METHODS = ['PT', 'LT', 'RT', 'UT', 'MT'];
const LT_TYPES = ['Bubble', 'Pressure change', 'Mass Spectrometer'];
const blank = (category: Category, userId = ''): Partial<CertRecord> => ({
  user_id: userId, category, title: '', obtained_date: '', expiry_date: '', method: '',
  level: '', cert_no: '', sticker_no: '', education_completed: '', training_date_1: '',
  training_date_2: '', training_date_3: '', training_date_4: '', cert_type: '사내발급',
  detail: { careerHours: 0, trainingHours: 0, minimumHours: 0, level1ToLevel2Hours: 0, massSpectrometerHours: 0 },
});
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const addYears = (date: string, years: number) => {
  if (!date) return '';
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setFullYear(d.getFullYear() + years);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const splitLegacy = (value?: string) => (value || '').split(/[\n,;、，]+/).map(v => v.trim()).filter(Boolean);

// 국가자격 파싱: 종목(METHOD)이 먼저 나오고 자격종류(기능사/산업기사/기사)가 뒤에 나오도록 정렬 및 처리
const parseNationalLegacy = (value: string) => {
  const type = value.includes('산업기사') ? '산업기사' : value.includes('기능사') ? '기능사' : value.includes('기사') ? '기사' : '';
  if (!type) return { title: '종목', method: value };
  const method = value.replace(type, '').replace(/^[-:：/\s]+|[-:：/\s]+$/g, '').trim();
  return { title: type, method: method || null };
};

const dayDiff = (date: string) => Math.ceil((new Date(`${date}T00:00:00`).getTime() - new Date(`${todayStr()}T00:00:00`).getTime()) / 86400000);
const esc = (v: any) => v == null ? '' : String(v);
const fieldClass = 'w-full rounded-lg border border-[#E2E5E9] bg-[#F5F6F8] px-2.5 py-2 text-xs text-[#1F2937] outline-none focus:border-[#243B5A] focus:bg-white';

export default function CertManagement({ users, currentUser, isAdmin, onUsersChanged, sharedRecords, recordsReady, onRecordsChanged }: {
  users: Person[]; currentUser: any; isAdmin: boolean; onUsersChanged?: (updates: Array<Partial<Person> & {id:string}>) => void;
  sharedRecords?: CertRecord[]; recordsReady?: boolean; onRecordsChanged?: (records: CertRecord[]) => void;
}) {
  const [category, setCategory] = useState<Category>('YARD');
  const [records, setRecords] = useState<CertRecord[]>([]);
  const recordsLoadedRef = useRef(false);
  const syncingSharedRecordsRef = useRef(false);
  const migrationInProgressRef = useRef(false);
  const migratedLegacyKeysRef = useRef<Set<string>>(new Set());
  const legacyInternalImportedRef = useRef<Set<string>>(new Set());
  const legacyNationalImportedRef = useRef<Set<string>>(new Set());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState<{type:'success'|'error'|'warning'; message:string}|null>(null);
  
  // 서브탭 및 펼치기 상태 관리
  const [yardSubTab, setYardSubTab] = useState<string>('ALL');
  const [nationalSubTab, setNationalSubTab] = useState<string>('ALL');
  const [ndtSubTab, setNdtSubTab] = useState<string>('ALL');
  const [expandedSubTabs, setExpandedSubTabs] = useState<Record<string, boolean>>({});

  const [selectedUserId, setSelectedUserId] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CertRecord|null>(null);
  const [form, setForm] = useState<Partial<CertRecord>>(blank('YARD'));
  const [search, setSearch] = useState('');
  const [holidaySyncMessage, setHolidaySyncMessage] = useState('');
  const [holidayDate, setHolidayDate] = useState('');
  const [selectedHolidayYear, setSelectedHolidayYear] = useState(String(new Date().getFullYear()));
  const autoNdtSyncRef = useRef<Set<string>>(new Set());
  const [holidayName, setHolidayName] = useState('');
  const [holidayBusy, setHolidayBusy] = useState(false);
  const [alerts, setAlerts] = useState<CertRecord[]>([]);
  const [activeAlert, setActiveAlert] = useState<CertRecord|null>(null);
  const [alertHidden, setAlertHidden] = useState(false);

  const notify = useCallback((message: string, type: 'success'|'error'|'warning' = 'success') => setNotice({message,type}), []);
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(t);
  }, [notice]);

  const useSharedRecords = sharedRecords !== undefined;
  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const h = await supabase.from('cert_holidays').select('holiday_date,name');
      if (h.error && h.error.code !== '42P01') throw h.error;
      setHolidays((h.data || []) as Holiday[]);
      if (!useSharedRecords) {
        const r = await supabase.from('cert_records').select('*').order('category').order('title');
        if (r.error) throw r.error;
        setRecords((r.data || []) as CertRecord[]);
        recordsLoadedRef.current = true;
      }
    } catch (e: any) {
      setLoadError(e?.message || '자격현황을 불러오지 못했습니다. SQL 설정을 확인해주세요.');
    } finally { setLoading(false); }
  }, [useSharedRecords]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!useSharedRecords || !recordsReady || !sharedRecords) return;
    recordsLoadedRef.current = true;
    syncingSharedRecordsRef.current = true;
    setRecords(sharedRecords);
  }, [useSharedRecords, recordsReady, sharedRecords]);

  useEffect(() => {
    if (!recordsLoadedRef.current) return;
    if (syncingSharedRecordsRef.current) {
      syncingSharedRecordsRef.current = false;
      return;
    }
    onRecordsChanged?.(records);
  }, [records, onRecordsChanged]);

  const personById = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);
  const careerHoursFromMember = useCallback((startDate?: string) => {
    if (!startDate) return 0;
    const start = new Date(`${startDate}T12:00:00`);
    const end = new Date(`${todayStr()}T12:00:00`);
    if (Number.isNaN(start.getTime()) || start > end) return 0;
    const holidaySet = new Set(holidays.map(h => h.holiday_date));
    let hours = 0;
    const cursor = new Date(start);
    let safety = 0;
    while (cursor <= end && safety < 20000) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}-${String(cursor.getDate()).padStart(2,'0')}`;
      const weekday = cursor.getDay();
      if (weekday !== 0 && weekday !== 6 && !holidaySet.has(key)) hours += 8;
      cursor.setDate(cursor.getDate() + 1);
      safety++;
    }
    return hours;
  }, [holidays]);

  const formatCareer = (hours: number) => {
    const totalWorkDays = Math.floor(Math.max(0, hours) / 8);
    const years = Math.floor(totalWorkDays / 260);
    const days = totalWorkDays % 260;
    const remainingHours = Math.max(0, hours) % 8;
    return `${years}년/${days}일/${remainingHours}시간`;
  };

  const autoNdtLevelFor = useCallback((userId: string, method?: string | null, title?: string | null, certType?: string | null): 'Level I' | 'Level II' | null => {
    // ASNT/ISO인 경우 경력시간 판정에서 제외
    if (certType === 'ASNT/ISO') return null;
    const person = users.find(u => u.id === userId);
    const hours = careerHoursFromMember(person?.career_start_date);
    let levelI = 0;
    let levelII = 0;
    if (method === 'PT') { levelI = 130; levelII = 270; }
    else if (method === 'LT' && (title || 'Bubble') === 'Bubble') { levelI = 15; levelII = 80; }
    else if (method === 'LT' && title === 'Pressure change') { levelI = 200; levelII = 530; }
    else if (method === 'LT' && title === 'Mass Spectrometer') { levelI = 530; levelII = 800; }
    else return null;
    return hours >= levelII ? 'Level II' : hours >= levelI ? 'Level I' : null;
  }, [users, careerHoursFromMember]);

  useEffect(() => {
    if (!recordsLoadedRef.current || !users.length) return;
    let cancelled = false;
    const syncAutoNdtRecords = async () => {
      const pending: any[] = [];
      const updateLevels: Array<{id:string; level:string; detail:any}> = [];
      users.forEach(person => {
        const hours = careerHoursFromMember(person.career_start_date);
        const definitions = [
          { method: 'PT', title: 'PT', levelI: 130, levelII: 270 },
          { method: 'LT', title: 'Bubble', levelI: 15, levelII: 80 },
          { method: 'LT', title: 'Pressure change', levelI: 200, levelII: 530 },
        ];
        definitions.forEach(def => {
          const level = hours >= def.levelII ? 'Level II' : hours >= def.levelI ? 'Level I' : '';
          if (!level) return;
          const key = `${person.id}|${def.method}|${def.title}`;
          const existing = records.find(r => r.category === 'NDT' && r.user_id === person.id && r.method === def.method && r.title === def.title && r.cert_type !== 'ASNT/ISO');
          if (!existing) {
            if (autoNdtSyncRef.current.has(key)) return;
            autoNdtSyncRef.current.add(key);
            pending.push({ user_id: person.id, category: 'NDT', title: def.title, obtained_date: null, expiry_date: null, method: def.method, level, cert_no: null, sticker_no: null, education_completed: null, training_date_1: null, training_date_2: null, training_date_3: null, training_date_4: null, cert_type: '사내발급', detail: { autoCareerLevel: true, careerHoursAtRegistration: hours } });
          } else if (existing.detail?.autoCareerLevel && !existing.obtained_date && existing.level !== level) {
            updateLevels.push({ id: existing.id, level, detail: { ...(existing.detail || {}), careerHoursAtRegistration: hours } });
          }
        });
      });
      try {
        for (const item of updateLevels) {
          if (cancelled) return;
          const { error } = await supabase.from('cert_records').update({ level: item.level, detail: item.detail }).eq('id', item.id);
          if (error) throw error;
        }
        if (pending.length && !cancelled) {
          const { data, error } = await supabase.from('cert_records').insert(pending).select('*');
          if (error) throw error;
          if (data?.length) setRecords(prev => {
            const keys = new Set(prev.map(r => `${r.user_id}|${r.category}|${r.method || ''}|${r.title}`));
            return [...prev, ...(data as CertRecord[]).filter(r => !keys.has(`${r.user_id}|${r.category}|${r.method || ''}|${r.title}`))];
          });
        }
        if (updateLevels.length && !cancelled) setRecords(prev => prev.map(r => {
          const update = updateLevels.find(u => u.id === r.id);
          return update ? { ...r, level: update.level, detail: update.detail } : r;
        }));
      } catch (e:any) {
        pending.forEach(r => autoNdtSyncRef.current.delete(`${r.user_id}|${r.method}|${r.title}`));
      }
    };
    void syncAutoNdtRecords();
    return () => { cancelled = true; };
  }, [users, records, careerHoursFromMember]);

  const latestYardRefreshDate = (r: Partial<CertRecord>) => {
    const dates = [r.training_date_1, r.training_date_2, r.training_date_3, r.training_date_4, r.education_completed, r.obtained_date]
      .filter((d): d is string => !!d).sort();
    return dates[dates.length - 1] || '';
  };

  useEffect(() => {
    if (!recordsLoadedRef.current || users.length === 0 || migrationInProgressRef.current) return;
    const migrateLegacyCertificates = async () => {
      try {
        migrationInProgressRef.current = true;
        const pending: any[] = [];
        const pendingKeys: string[] = [];
        const obsoleteLegacyYardIds: string[] = [];
        const nationalUsersToMark: string[] = [];
        const repairedRows: CertRecord[] = [];
        for (const person of users) {
          const personRecords = records.filter(r => r.user_id === person.id);
          for (const row of personRecords) {
            if (row.category !== 'YARD' && row.category !== 'NDT') continue;
            const rowText = `${row.title || ''} ${row.method || ''} ${row.level || ''}`.trim();
            const normalizedRowTitle = row.title.trim().toLowerCase().replace(/\s+/g, ' ');
            const explicitMethodMatch = rowText.match(/\b(PT|UT|RT|MT|LT)\b/i);
            if (!explicitMethodMatch) continue;
            const method = (row.method || explicitMethodMatch[1]).toUpperCase();
            const hasExplicitLevel = /\b(?:NDT\s*)?Level\s*(?:III|II|I|3|2|1)\b/i.test(rowText);
            const internalTitles = new Set(splitLegacy(person.internal_certificates).map(v => v.toLowerCase().replace(/\s+/g, ' ')));
            const wasImportedFromInternal = row.detail?.source === 'internal_certificates' || internalTitles.has(normalizedRowTitle);
            if (row.category === 'YARD' && !(hasExplicitLevel || wasImportedFromInternal || row.detail?.repairedFromMisclassifiedYard)) continue;

            const levelMatch = rowText.match(/Level\s*(III|II|I|3|2|1)/i);
            const levelToken = levelMatch?.[1];
            const parsedLevel = levelToken ? `Level ${/^(III|II|I)$/i.test(levelToken) ? levelToken.toUpperCase() : ({'3':'III','2':'II','1':'I'}[levelToken] || '')}` : (row.level || null);
            const title = method === 'LT'
              ? (/mass\s*spectrometer/i.test(rowText) ? 'Mass Spectrometer' : /pressure\s*change/i.test(rowText) ? 'Pressure change' : /bubble/i.test(rowText) ? 'Bubble' : 'LT')
              : method;
            const needsRepair = row.category !== 'NDT' || row.method !== method || row.title !== title || (row.level || null) !== parsedLevel;
            if (!needsRepair) continue;
            const detail = {
              ...(row.detail || {}),
              ...(row.category === 'YARD' ? { repairedFromMisclassifiedYard: true } : { normalizedNdtLabel: true }),
            };
            const { data: repaired, error: repairError } = await supabase.from('cert_records').update({ category: 'NDT', method, title, level: parsedLevel, detail }).eq('id', row.id).select('*').single();
            if (repairError) throw repairError;
            if (repaired) repairedRows.push(repaired as CertRecord);
          }
        }
        let effectiveRecords = records.map(r => repairedRows.find(x => x.id === r.id) || r);
        const duplicateKey = (r: CertRecord) => [
          r.user_id, r.category, (r.method || '').trim().toUpperCase(), (r.title || '').trim().toLowerCase().replace(/\s+/g, ' '),
          r.level || '', r.obtained_date || '', r.expiry_date || '', r.education_completed || '', r.cert_no || '', r.sticker_no || '',
          r.training_date_1 || '', r.training_date_2 || '', r.training_date_3 || '', r.training_date_4 || ''
        ].join('|');
        const seenDuplicateKeys = new Set<string>();
        const duplicateIds: string[] = [];
        effectiveRecords.forEach(r => {
          const key = duplicateKey(r);
          if (seenDuplicateKeys.has(key)) duplicateIds.push(r.id);
          else seenDuplicateKeys.add(key);
        });
        if (duplicateIds.length) {
          const { error: duplicateDeleteError } = await supabase.from('cert_records').delete().in('id', duplicateIds);
          if (duplicateDeleteError) throw duplicateDeleteError;
          effectiveRecords = effectiveRecords.filter(r => !duplicateIds.includes(r.id));
        }
        if (repairedRows.length || duplicateIds.length) {
          setRecords(effectiveRecords);
        }
        users.forEach(person => {
          const personRecords = effectiveRecords.filter(r => r.user_id === person.id);
          const legacyYardItems = Array.from(new Set(splitLegacy(person.yard_certificates)));
          const legacyYardOriginal = (person.yard_certificates || '').trim();
          if (legacyYardItems.length > 1) {
            personRecords.filter(r => r.category === 'YARD' && r.detail?.legacyImport && r.detail?.source === 'internal_certificates' && r.title.includes(',')).forEach(r => obsoleteLegacyYardIds.push(r.id));
          }
          legacyYardItems.forEach(title => {
            if (/\b(PT|UT|RT|MT|LT)\b/i.test(title) && /\b(?:NDT\s*)?Level\s*(?:III|II|I|3|2|1)\b/i.test(title)) return;
            const key = `${person.id}|YARD|${title}`;
            if (personRecords.some(r => r.category === 'YARD' && r.title.trim() === title) || migratedLegacyKeysRef.current.has(key)) return;
            pendingKeys.push(key);
            pending.push({ user_id: person.id, category: 'YARD', title, obtained_date: null, expiry_date: null, method: null, level: null, cert_no: null, sticker_no: null, education_completed: null, training_date_1: null, training_date_2: null, training_date_3: null, training_date_4: null, cert_type: '사내발급', detail: { legacyImport: true, source: 'yard_certificates', original: legacyYardOriginal } });
          });
          const shouldImportLegacyNational = !legacyNationalImportedRef.current.has(person.id);
          const existingNationalSummary = Array.from(new Set(personRecords.filter(r => r.category === 'NATIONAL').map(r => r.title).filter(Boolean))).sort((a,b) => a.localeCompare(b)).join(', ');
          const nationalTextMatchesSummary = !!existingNationalSummary && (person.national_certificates || '').trim().replace(/\s+/g, ' ') === existingNationalSummary.replace(/\s+/g, ' ');
          if (shouldImportLegacyNational) nationalUsersToMark.push(person.id);
          (shouldImportLegacyNational && !nationalTextMatchesSummary ? splitLegacy(person.national_certificates) : []).forEach(item => {
            const parsed = parseNationalLegacy(item);
            const title = parsed.title;
            const method = parsed.method;
            const key = `${person.id}|NATIONAL|${title}|${method || ''}`;
            if (personRecords.some(r => r.category === 'NATIONAL' && r.title.trim() === title && (r.method || '') === (method || '')) || migratedLegacyKeysRef.current.has(key)) return;
            pendingKeys.push(key);
            pending.push({ user_id: person.id, category: 'NATIONAL', title, obtained_date: null, expiry_date: null, method, level: null, cert_no: null, sticker_no: null, education_completed: null, training_date_1: null, training_date_2: null, training_date_3: null, training_date_4: null, cert_type: '사내발급', detail: { legacyImport: true, source: 'national_certificates', original: item } });
          });
        });
        if (obsoleteLegacyYardIds.length) {
          await supabase.from('cert_records').delete().in('id', obsoleteLegacyYardIds);
          setRecords(prev => prev.filter(r => !obsoleteLegacyYardIds.includes(r.id)));
        }
        if (!pending.length) { nationalUsersToMark.forEach(id => legacyNationalImportedRef.current.add(id)); return; }
        const { data, error } = await supabase.from('cert_records').insert(pending).select('*');
        if (error) throw error;
        nationalUsersToMark.forEach(id => legacyNationalImportedRef.current.add(id));
        pendingKeys.forEach(key => migratedLegacyKeysRef.current.add(key));
        if (data?.length) {
          setRecords(prev => {
            const keys = new Set(prev.map(r => `${r.user_id}|${r.category}|${r.title}|${r.method || ''}`));
            return [...prev, ...(data as CertRecord[]).filter(r => !keys.has(`${r.user_id}|${r.category}|${r.title}|${r.method || ''}`))];
          });
        }
      } catch (e: any) {
        console.error(e);
      } finally { migrationInProgressRef.current = false; }
    };
    void migrateLegacyCertificates();
  }, [users, records]);

  useEffect(() => {
    if (!users.length) return;
    let cancelled = false;
    const syncHolidays = async () => {
      const nowYear = new Date().getFullYear();
      const careerYears = users.map(u => Number((u.career_start_date || '').slice(0, 4))).filter(y => y >= 1990 && y <= nowYear);
      const firstYear = careerYears.length ? Math.min(...careerYears) : nowYear;
      const targetYears = Array.from({ length: Math.min(45, nowYear + 3 - firstYear + 1) }, (_, i) => firstYear + i);
      const cachedYears = new Set<string>();
      try { JSON.parse(window.localStorage.getItem('cert-holiday-api-years') || '[]').forEach((y: string) => cachedYears.add(y)); } catch {}
      const missingYears = targetYears.filter(y => !cachedYears.has(String(y)));
      if (!missingYears.length) return;
      setHolidaySyncMessage('공휴일 달력 자동 동기화 중...');
      const fetched: Holiday[] = [];
      const completed: string[] = [];
      await Promise.all(missingYears.map(async year => {
        try {
          const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/KR`);
          if (!response.ok) return;
          const data = await response.json();
          if (Array.isArray(data)) {
            data.forEach((item: any) => {
              if (item?.date) fetched.push({ holiday_date: item.date, name: item.localName || item.name || '공휴일' });
            });
            completed.push(String(year));
          }
        } catch {}
      }));
      if (cancelled) return;
      if (completed.length) {
        const unique = Array.from(new Map(fetched.map(h => [h.holiday_date, h])).values());
        let saveSucceeded = true;
        if (unique.length) {
          const { error } = await supabase.from('cert_holidays').upsert(unique, { onConflict: 'holiday_date' });
          saveSucceeded = !error;
          if (!error) setHolidays(prev => Array.from(new Map([...prev, ...unique].map(h => [h.holiday_date, h])).values()).sort((a,b)=>a.holiday_date.localeCompare(b.holiday_date)));
        }
        if (saveSucceeded) {
          try { window.localStorage.setItem('cert-holiday-api-years', JSON.stringify([...cachedYears, ...completed])); } catch {}
        }
      }
      setHolidaySyncMessage(completed.length ? `공휴일 자동 반영 완료 (${completed.length}개 연도 확인)` : '');
    };
    void syncHolidays();
    return () => { cancelled = true; };
  }, [users, holidays.length]);

  // 서브탭 목록 추출
  const yardSubTabs = useMemo(() => {
    const list = records.filter(r => r.category === 'YARD');
    const titles = Array.from(new Set(list.map(r => r.title).filter(Boolean)));
    return titles;
  }, [records]);

  const nationalSubTabs = ['기능사', '산업기사', '기사'];
  const ndtSubTabs = ['Level I', 'Level II', 'Level III', 'ASNT/ISO'];

  // 자격현황 데이터 필터링 (서브탭 반영, 전체구성원 삭제 및 검색창 유지)
  const visibleRecords = useMemo(() => {
    return records.filter(r => {
      if (r.category !== category) return false;
      if (selectedUserId !== 'ALL' && r.user_id !== selectedUserId) return false;
      
      // 서브탭 필터링
      if (category === 'YARD' && yardSubTab !== 'ALL' && r.title !== yardSubTab) return false;
      if (category === 'NATIONAL' && nationalSubTab !== 'ALL' && r.title !== nationalSubTab) return false;
      if (category === 'NDT' && ndtSubTab !== 'ALL') {
        if (ndtSubTab === 'ASNT/ISO' && r.cert_type !== 'ASNT/ISO') return false;
        if (ndtSubTab !== 'ASNT/ISO' && (r.level !== ndtSubTab || r.cert_type === 'ASNT/ISO')) return false;
      }

      const p = personById.get(r.user_id);
      const q = search.trim().toLowerCase();
      return !q || [p?.name, p?.id, r.title, r.method, r.level, r.cert_no, r.sticker_no].some(v => esc(v).toLowerCase().includes(q));
    });
  }, [records, category, selectedUserId, search, personById, yardSubTab, nationalSubTab, ndtSubTab]);

  const daysUntil = (d?: string|null) => d ? dayDiff(d) : null;
  const expiryForRecord = (r: CertRecord) => { 
    if (r.category === 'YARD') { 
      const base = r.education_completed || r.obtained_date || ''; 
      const refresh = [r.training_date_1, r.training_date_2, r.training_date_3, r.training_date_4].filter(Boolean).sort().slice(-1)[0] || ''; 
      const latest = latestYardRefreshDate(r); 
      const defaultExpiry = latest ? addYears(latest, 2) : null; 
      if (refresh && refresh > base && !r.detail?.expiryManuallySet) return defaultExpiry; 
      return r.expiry_date || defaultExpiry; 
    } 
    if (r.category === 'NDT') return r.expiry_date || (r.obtained_date ? addYears(r.obtained_date, 5) : null); 
    return null; 
  };
  const isSelfRecord = (r: CertRecord) => (!!currentUser?.id && currentUser.id === r.user_id) || (!!currentUser?.name && personById.get(r.user_id)?.name === currentUser.name);
  const canManageRecord = (r: CertRecord) => isAdmin || isSelfRecord(r);
  
  // 알림 조건: 유효일자 -40일 전 (국가자격 제외, YARD 및 NDT 대상) 해당 인원 및 관리자에게만 알림
  const canSeeRecordAlert = (r: CertRecord) => canManageRecord(r);
  useEffect(() => {
    const eligible = records.filter(r => {
      if (!canSeeRecordAlert(r)) return false;
      if (r.category === 'NATIONAL') return false; // 국가자격 알림 제외
      const warningDays = 40; // 모든 자격 -40일 전 알림
      const dates = r.category === 'YARD'
        ? [r.training_date_1, r.training_date_2, r.training_date_3, r.training_date_4, expiryForRecord(r)]
        : [expiryForRecord(r)];
      return dates.some(d => d && daysUntil(d)! >= 0 && daysUntil(d)! <= warningDays);
    });
    setAlerts(eligible);
    const hiddenKey = `cert-alert-hidden:${currentUser?.id || currentUser?.name || 'guest'}:${todayStr()}`;
    const hidden = typeof window !== 'undefined' && window.localStorage.getItem(hiddenKey) === '1';
    setAlertHidden(hidden);
    setActiveAlert(hidden ? null : eligible[0] || null);
  }, [records, currentUser?.id, currentUser?.name, isAdmin]);

  const hideAlertToday = () => {
    const hiddenKey = `cert-alert-hidden:${currentUser?.id || currentUser?.name || 'guest'}:${todayStr()}`;
    window.localStorage.setItem(hiddenKey, '1'); setAlertHidden(true); setActiveAlert(null);
  };
  const openAdd = () => { setEditing(null); const ownId = currentUser?.id || users.find(u=>u.name===currentUser?.name)?.id || ''; setForm(blank(category, isAdmin ? (selectedUserId === 'ALL' ? (users[0]?.id || '') : selectedUserId) : ownId)); setModalOpen(true); };
  const openEdit = (r: CertRecord) => { setEditing(r); setForm({...r, detail: r.detail || {}}); setModalOpen(true); };
  
  const updateForm = (key: string, value: any) => setForm(prev => {
    const next: Partial<CertRecord> = {...prev, [key]: value};
    if (next.category === 'YARD' && (key === 'obtained_date' || key === 'education_completed' || /^training_date_[1-4]$/.test(key))) {
      const dates = [next.training_date_1, next.training_date_2, next.training_date_3, next.training_date_4, next.education_completed, next.obtained_date].filter(Boolean).sort();
      if (dates.length) next.expiry_date = addYears(dates[dates.length - 1] as string, 2);
      next.detail = { ...(next.detail || {}), expiryManuallySet: false };
    }
    if (key === 'expiry_date') next.detail = { ...(next.detail || {}), expiryManuallySet: true };
    if (next.category === 'NDT' && key === 'obtained_date' && value) next.expiry_date = addYears(value, 5);
    if (next.category === 'NDT' && !editing && ['user_id','method','title','cert_type'].includes(key)) {
      const auto = autoNdtLevelFor(String(next.user_id || ''), next.method, next.title, next.cert_type);
      if (auto) next.level = auto;
    }
    return next;
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.user_id) { notify('구성원을 선택해주세요.', 'warning'); return; }
    if (!isAdmin && form.user_id !== (currentUser?.id || users.find(u=>u.name===currentUser?.name)?.id)) { notify('본인 자격정보만 등록 또는 수정할 수 있습니다.', 'warning'); return; }
    if (!form.title?.trim()) { notify(category === 'YARD' ? '교육명을 입력해주세요.' : '자격종류 또는 Method를 입력해주세요.', 'warning'); return; }
    
    const payload: any = {
      user_id: form.user_id, category, title: form.title.trim(),
      obtained_date: form.obtained_date || null, expiry_date: category === 'NATIONAL' ? null : (form.expiry_date || (category === 'YARD' && latestYardRefreshDate(form) ? addYears(latestYardRefreshDate(form), 2) : category === 'NDT' && form.obtained_date ? addYears(form.obtained_date, 5) : null)),
      method: form.method || null, level: form.level || null, cert_no: form.cert_no || null,
      sticker_no: form.sticker_no || null, education_completed: form.education_completed || null,
      training_date_1: form.training_date_1 || null, training_date_2: form.training_date_2 || null,
      training_date_3: form.training_date_3 || null, training_date_4: form.training_date_4 || null,
      cert_type: form.cert_type || '사내발급',
      detail: form.detail || {},
    };
    try {
      if (editing) {
        const {data,error} = await supabase.from('cert_records').update(payload).eq('id', editing.id).select('*').single();
        if (error) throw error;
        const nextRecords = records.map(r => r.id === editing.id ? data as CertRecord : r);
        setRecords(nextRecords);
        const person = personById.get(form.user_id);
        if (person) onUsersChanged?.([{
          id: person.id,
          ...(category === 'YARD' ? { yard_certificates: nextRecords.filter(r=>r.user_id===person.id && r.category==='YARD').map(r=>r.title).filter(Boolean).join(', ') } : {}),
          ...(category === 'NATIONAL' ? { national_certificates: nextRecords.filter(r=>r.user_id===person.id && r.category==='NATIONAL').map(r=>`${r.method ? `${r.method} ` : ''}${r.title || ''}`.trim()).filter(Boolean).join(', ') } : {}),
          ...(category === 'NDT' ? { cert_assignments: { ...(person.cert_assignments||{}), [data.method || '']: { level: data.level || '', cert_no: data.cert_no || '', cert_type: data.cert_type || '사내발급' } } } : {}),
        }]);
      } else {
        const {data,error} = await supabase.from('cert_records').insert(payload).select('*').single();
        if (error) throw error;
        const nextRecords = [...records, data as CertRecord];
        setRecords(nextRecords);
        const person = personById.get(form.user_id);
        if (person) onUsersChanged?.([{
          id: person.id,
          ...(category === 'YARD' ? { yard_certificates: nextRecords.filter(r=>r.user_id===person.id && r.category==='YARD').map(r=>r.title).filter(Boolean).join(', ') } : {}),
          ...(category === 'NATIONAL' ? { national_certificates: nextRecords.filter(r=>r.user_id===person.id && r.category==='NATIONAL').map(r=>`${r.method ? `${r.method} ` : ''}${r.title || ''}`.trim()).filter(Boolean).join(', ') } : {}),
          ...(category === 'NDT' ? { cert_assignments: { ...(person.cert_assignments||{}), [data.method || '']: { level: data.level || '', cert_no: data.cert_no || '', cert_type: data.cert_type || '사내발급' } } } : {}),
        }]);
      }
      if (editing) { setModalOpen(false); notify('자격정보를 수정했습니다.'); }
      else { const savedUserId = form.user_id || ''; setForm(blank(category, savedUserId)); notify('저장했습니다.'); }
    } catch (e: any) { notify(`저장 실패: ${e?.message || '오류'}`, 'error'); }
  };

  const remove = async (r: CertRecord) => {
    if (!canManageRecord(r)) { notify('본인 자격정보 또는 관리자 권한이 있는 경우에만 삭제할 수 있습니다.', 'warning'); return; }
    if (!window.confirm(`${personById.get(r.user_id)?.name || ''}님의 "${r.title}" 자격정보를 삭제할까요?`)) return;
    const {error} = await supabase.from('cert_records').delete().eq('id', r.id);
    if (error) { notify(`삭제 실패: ${error.message}`, 'error'); return; }
    const nextRecords = records.filter(x => x.id !== r.id);
    setRecords(nextRecords);
    const person = personById.get(r.user_id);
    if (person) onUsersChanged?.([{
      id: person.id,
      ...(r.category === 'YARD' ? { yard_certificates: nextRecords.filter(x=>x.user_id===person.id && x.category==='YARD').map(x=>x.title).filter(Boolean).join(', ') } : {}),
      ...(r.category === 'NATIONAL' ? { national_certificates: nextRecords.filter(x=>x.user_id===person.id && x.category==='NATIONAL').map(x=>`${x.method ? `${x.method} ` : ''}${x.title || ''}`.trim()).filter(Boolean).join(', ') } : {}),
      ...(r.category === 'NDT' ? { cert_assignments: { ...(person.cert_assignments||{}), [r.method || '']: { level: '', cert_no: '' } } } : {}),
    }]);
    notify('자격정보를 삭제했습니다.');
  };

  const exportExcel = () => {
    if (!isAdmin) { notify('엑셀 추출은 관리자 계정만 사용할 수 있습니다.', 'warning'); return; }
    const list = visibleRecords.sort((a,b) => {
      const an = personById.get(a.user_id)?.name || a.user_id;
      const bn = personById.get(b.user_id)?.name || b.user_id;
      return an.localeCompare(bn, 'ko') || a.user_id.localeCompare(b.user_id, 'ko') || a.title.localeCompare(b.title, 'ko');
    });
    const rows: any[][] = [];
    let title = '';
    if (category === 'YARD') {
      title = 'YARD 자격 현황';
      rows.push([title], ['성명','교육명','사번','교육이수','스티커 번호','보수교육 1','보수교육 2','보수교육 3','보수교육 4','유효일자']);
      list.forEach(r => rows.push([personById.get(r.user_id)?.name || '', r.title, r.user_id, r.education_completed || r.obtained_date || '', r.sticker_no || '', r.training_date_1 || '', r.training_date_2 || '', r.training_date_3 || '', r.training_date_4 || '', expiryForRecord(r) || '']));
    } else if (category === 'NATIONAL') {
      title = '국가 자격 취득 현황';
      rows.push([title], ['성명','종목','자격종류','취득일']);
      list.forEach(r => rows.push([personById.get(r.user_id)?.name || '', r.method || '', r.title || '', r.obtained_date || '']));
    } else {
      title = '사내자격 취득 현황';
      rows.push([title], ['성명','발급구분','경력(YY/DD/Hour)','자격종류(Level)','종목','취득일','유효일자']);
      list.forEach(r => {
        const p = personById.get(r.user_id);
        rows.push([p?.name || '', r.cert_type || '사내발급', formatCareer(careerHoursFromMember(p?.career_start_date)), `${r.level || ''}`, r.method === 'LT' ? `LT (${r.title})` : r.method || '', r.obtained_date || '', r.expiry_date || (r.obtained_date ? addYears(r.obtained_date, 5) : '')]);
      });
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!merges'] = [{s:{r:0,c:0}, e:{r:0,c:rows[1].length-1}}];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, category === 'YARD' ? 'YARD 자격' : category === 'NATIONAL' ? '국가 자격' : '사내자격');
    XLSX.writeFile(wb, `${title}_${todayStr()}.xlsx`);
  };

  const ndtStatusForMethod = (userId: string, method: string, title: string, certType?: string | null) => {
    if (certType === 'ASNT/ISO') return { level: 'ASNT/ISO', status: '외주/인증', eligible: true };
    const supported = method === 'PT' || method === 'LT';
    if (!supported) return { level: '', status: '기준 미설정', eligible: false };
    const hours = careerHoursFromMember(personById.get(userId)?.career_start_date);
    const levelIRequirement = method === 'PT' ? 130 : title === 'Bubble' ? 15 : title === 'Pressure change' ? 200 : 530;
    const levelIIRequirement = method === 'PT' ? 270 : title === 'Bubble' ? 80 : title === 'Pressure change' ? 530 : 800;
    const autoLevel: 'Level I' | 'Level II' | null = hours >= levelIIRequirement ? 'Level II' : hours >= levelIRequirement ? 'Level I' : null;
    if (!autoLevel) return { level: '', status: '미발급대상', eligible: false };
    const matched = records.find(x => x.category === 'NDT' && x.user_id === userId && x.method === method && (method !== 'LT' || x.title === title) && x.level === autoLevel);
    return { level: autoLevel, status: matched?.obtained_date ? '발급 완료' : "Cert' 미발급", eligible: true };
  };

  const tabs: {key:Category; label:string}[] = [
    {key:'YARD', label:'YARD 자격'}, {key:'NATIONAL', label:'국가자격'}, {key:'NDT', label:'사내자격(NDT Level)'},
  ];

  return <div className="space-y-3 text-[#1F2937]">
    <div className="rounded-xl border border-[#E2E5E9] bg-white p-3 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><div className="rounded-lg bg-[#F5F6F8] p-2 text-[#243B5A]"><Award className="h-4 w-4"/></div><div><h2 className="text-sm font-bold">자격현황 관리</h2><p className="text-[11px] text-[#64748B]">자격 목록 및 유효일자 관리</p></div></div>
        <div className="flex gap-2">
          {isAdmin && <button onClick={exportExcel} className="flex items-center gap-1 rounded-lg border border-[#E2E5E9] bg-white px-3 py-2 text-xs font-bold text-[#243B5A]"><Download className="h-3.5 w-3.5"/> Excel 추출</button>}
          {(isAdmin || currentUser?.id || currentUser?.name) && <button onClick={openAdd} className="flex items-center gap-1 rounded-lg bg-[#243B5A] px-3 py-2 text-xs font-bold text-white"><Plus className="h-3.5 w-3.5"/> 자격 등록</button>}
        </div>
      </div>

      {/* 메인 탭 */}
      <div className="mt-3 flex flex-wrap gap-2 border-b border-[#E2E5E9] pb-2">
        {tabs.map(t => <button key={t.key} onClick={() => {setCategory(t.key);setSearch('');setSelectedUserId('ALL');}} className={`rounded-lg border px-3 py-2 text-xs font-bold ${category===t.key?'border-[#243B5A] bg-[#243B5A] text-white':'border-[#E2E5E9] bg-[#F5F6F8] text-[#64748B]'}`}>{t.label} ({records.filter(r=>r.category===t.key).length})</button>)}
      </div>

      {/* 서브탭 및 ▼ 펼치기 기능 (관리자만 추가/수정/삭제 가능하도록 권한 제어 혹은 서브탭 관리) */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 bg-[#F8FAFC] p-2 rounded-lg border border-[#E2E5E9]">
        <span className="text-[11px] font-bold text-[#243B5A] mr-1">▼ 서브탭:</span>
        {category === 'YARD' && (
          <>
            <button onClick={() => setYardSubTab('ALL')} className={`px-2.5 py-1 rounded text-xs font-bold ${yardSubTab === 'ALL' ? 'bg-[#243B5A] text-white' : 'bg-white text-[#64748B] border border-[#E2E5E9]'}`}>전체 교육</button>
            {yardSubTabs.map(sub => (
              <button key={sub} onClick={() => setYardSubTab(sub)} className={`px-2.5 py-1 rounded text-xs font-bold ${yardSubTab === sub ? 'bg-[#243B5A] text-white' : 'bg-white text-[#64748B] border border-[#E2E5E9]'}`}>{sub}</button>
            ))}
          </>
        )}
        {category === 'NATIONAL' && (
          <>
            <button onClick={() => setNationalSubTab('ALL')} className={`px-2.5 py-1 rounded text-xs font-bold ${nationalSubTab === 'ALL' ? 'bg-[#243B5A] text-white' : 'bg-white text-[#64748B] border border-[#E2E5E9]'}`}>전체 종류</button>
            {nationalSubTabs.map(sub => (
              <button key={sub} onClick={() => setNationalSubTab(sub)} className={`px-2.5 py-1 rounded text-xs font-bold ${nationalSubTab === sub ? 'bg-[#243B5A] text-white' : 'bg-white text-[#64748B] border border-[#E2E5E9]'}`}>{sub}</button>
            ))}
          </>
        )}
        {category === 'NDT' && (
          <>
            <button onClick={() => setNdtSubTab('ALL')} className={`px-2.5 py-1 rounded text-xs font-bold ${ndtSubTab === 'ALL' ? 'bg-[#243B5A] text-white' : 'bg-white text-[#64748B] border border-[#E2E5E9]'}`}>전체 Level</button>
            {ndtSubTabs.map(sub => (
              <button key={sub} onClick={() => setNdtSubTab(sub)} className={`px-2.5 py-1 rounded text-xs font-bold ${ndtSubTab === sub ? 'bg-[#243B5A] text-white' : 'bg-white text-[#64748B] border border-[#E2E5E9]'}`}>{sub}</button>
            ))}
          </>
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input className={fieldClass} value={search} onChange={e=>setSearch(e.target.value)} placeholder="이름, 사번, 자격 검색"/>
        <select className={fieldClass} value={selectedUserId} onChange={e=>setSelectedUserId(e.target.value)}><option value="ALL">전체 구성원 보기</option>{users.map(u=><option key={u.id} value={u.id}>{u.name} ({u.id})</option>)}</select>
      </div>
    </div>

    {loadError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{loadError}</div>}
    
    {loading ? <div className="rounded-xl border border-[#E2E5E9] bg-white p-10 text-center text-xs text-[#64748B]">자격현황을 불러오는 중...</div> : (
      <div className="bg-white rounded-xl border border-[#E2E5E9] p-3 shadow-xs">
        <div className="text-xs font-bold text-[#243B5A] mb-2">
          {category === 'YARD' ? 'YARD 자격 목록' : category === 'NATIONAL' ? '국가자격 목록' : '사내자격(NDT Level) 목록'} (총 {visibleRecords.length}명/건)
        </div>

        {visibleRecords.length === 0 ? (
          <div className="text-center py-8 text-xs text-[#64748B]">조건에 해당하는 자격 현황이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F6F8] border-b border-[#E2E5E9] text-[#64748B]">
                <tr>
                  <th className="p-2.5">성명 (사번)</th>
                  {category === 'YARD' && <>
                    <th className="p-2.5">교육명</th>
                    <th className="p-2.5">교육이수일</th>
                    <th className="p-2.5">스티커 번호</th>
                    <th className="p-2.5">유효일자</th>
                  </>}
                  {category === 'NATIONAL' && <>
                    <th className="p-2.5">종목 (METHOD)</th>
                    <th className="p-2.5">자격종류</th>
                    <th className="p-2.5">취득일</th>
                  </>}
                  {category === 'NDT' && <>
                    <th className="p-2.5">발급구분</th>
                    <th className="p-2.5">종목</th>
                    <th className="p-2.5">Level</th>
                    <th className="p-2.5">취득일</th>
                    <th className="p-2.5">유효일자</th>
                  </>}
                  <th className="p-2.5 text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E5E9]">
                {visibleRecords.map(r => {
                  const person = personById.get(r.user_id);
                  return (
                    <tr key={r.id} className="hover:bg-[#F5F6F8]/50">
                      <td className="p-2.5 font-bold">{person?.name || r.user_id} <span className="text-[10px] text-[#64748B] font-normal">({r.user_id})</span></td>
                      {category === 'YARD' && <>
                        <td className="p-2.5">{r.title}</td>
                        <td className="p-2.5">{r.education_completed || r.obtained_date || '-'}</td>
                        <td className="p-2.5">{r.sticker_no || '-'}</td>
                        <td className="p-2.5 font-semibold text-[#243B5A]">{expiryForRecord(r) || '-'}</td>
                      </>}
                      {category === 'NATIONAL' && <>
                        {/* 3번 요청 사항: 국가 자격 출력 순서 변경 (종목/METHOD 먼저 나오고 자격종류/자격명이 나옴), 괄호 삭제 및 명칭 변경 */}
                        <td className="p-2.5 font-semibold">{r.method || '-'}</td>
                        <td className="p-2.5">{r.title}</td>
                        <td className="p-2.5">{r.obtained_date || '-'}</td>
                      </>}
                      {category === 'NDT' && <>
                        <td className="p-2.5"><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${r.cert_type === 'ASNT/ISO' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-700'}`}>{r.cert_type || '사내발급'}</span></td>
                        <td className="p-2.5 font-semibold">{r.method === 'LT' ? `LT (${r.title})` : r.method || '-'}</td>
                        <td className="p-2.5">{r.level || '-'}</td>
                        <td className="p-2.5">{r.obtained_date || '-'}</td>
                        <td className="p-2.5 font-semibold text-[#243B5A]">{r.expiry_date || (r.obtained_date ? addYears(r.obtained_date, 5) : '-')}</td>
                      </>}
                      <td className="p-2.5 text-center">
                        {canManageRecord(r) && (
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={()=>openEdit(r)} className="p-1 text-[#243B5A] border border-[#E2E5E9] rounded hover:bg-slate-50"><Edit3 className="h-3 w-3"/></button>
                            <button onClick={()=>void remove(r)} className="p-1 text-red-600 border border-red-200 rounded hover:bg-red-50"><Trash2 className="h-3 w-3"/></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )}

    {/* 모달 창 */}
    {modalOpen && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 p-3">
      <form onSubmit={save} className="max-h-[92vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-xl border border-[#E2E5E9] bg-white p-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E2E5E9] pb-2"><h3 className="text-sm font-bold">{editing?'자격정보 수정':`${tabs.find(t=>t.key===category)?.label} 등록`}</h3><button type="button" onClick={()=>setModalOpen(false)}><X className="h-4 w-4"/></button></div>
        
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="text-[11px] font-bold text-[#64748B]">구성원 *<select className={fieldClass} value={form.user_id||''} onChange={e=>updateForm('user_id',e.target.value)} required><option value="">선택</option>{users.map(u=><option key={u.id} value={u.id}>{u.name} ({u.id})</option>)}</select></label>
          
          {category==='YARD' && <>
            <label className="text-[11px] font-bold text-[#64748B]">교육명 *<input className={fieldClass} value={form.title||''} onChange={e=>updateForm('title',e.target.value)} required/></label>
            <label className="text-[11px] font-bold text-[#64748B]">취득/교육이수일<input type="date" className={fieldClass} value={form.education_completed||form.obtained_date||''} onChange={e=>{updateForm('education_completed',e.target.value);updateForm('obtained_date',e.target.value);}}/></label>
            <label className="text-[11px] font-bold text-[#64748B]">스티커 번호<input className={fieldClass} value={form.sticker_no||''} onChange={e=>updateForm('sticker_no',e.target.value)}/></label>
            {[1,2,3,4].map(n=><label key={n} className="text-[11px] font-bold text-[#64748B]">보수교육 {n}<input type="date" className={fieldClass} value={(form as any)[`training_date_${n}`]||''} onChange={e=>updateForm(`training_date_${n}`,e.target.value)}/></label>)}
            <label className="text-[11px] font-bold text-[#64748B]">유효일자 (기본 2년)<input type="date" className={fieldClass} value={form.expiry_date||''} onChange={e=>updateForm('expiry_date',e.target.value)}/></label>
          </>}

          {category==='NATIONAL' && <>
            <label className="text-[11px] font-bold text-[#64748B]">자격종류 *<select className={fieldClass} value={form.title||''} onChange={e=>updateForm('title',e.target.value)} required><option value="">선택</option><option value="기능사">기능사</option><option value="산업기사">산업기사</option><option value="기사">기사</option></select></label>
            <label className="text-[11px] font-bold text-[#64748B]">종목 (METHOD) *<input className={fieldClass} value={form.method||''} onChange={e=>updateForm('method',e.target.value)} placeholder="예: PT, UT, 지게차 등" required/></label>
            <label className="text-[11px] font-bold text-[#64748B]">취득일<input type="date" className={fieldClass} value={form.obtained_date||''} onChange={e=>updateForm('obtained_date',e.target.value)}/></label>
          </>}

          {category==='NDT' && <>
            <label className="text-[11px] font-bold text-[#64748B]">발급구분 *<select className={fieldClass} value={form.cert_type || '사내발급'} onChange={e=>updateForm('cert_type',e.target.value)}><option value="사내발급">사내발급</option><option value="ASNT/ISO">ASNT/ISO</option></select></label>
            <label className="text-[11px] font-bold text-[#64748B]">종목 (METHOD) *<select className={fieldClass} value={form.method||''} onChange={e=>{updateForm('method',e.target.value); if(e.target.value==='LT') updateForm('title','Bubble'); else updateForm('title',e.target.value);}} required><option value="">선택</option><option>PT</option><option>LT</option><option>RT</option><option>UT</option><option>MT</option></select></label>
            {form.method==='LT' && <label className="text-[11px] font-bold text-[#64748B]">LT 종류 *<select className={fieldClass} value={form.title||'Bubble'} onChange={e=>updateForm('title',e.target.value)}>{LT_TYPES.map(m=><option key={m}>{m}</option>)}</select></label>}
            <label className="text-[11px] font-bold text-[#64748B]">Level *<select className={fieldClass} value={form.level||''} onChange={e=>updateForm('level',e.target.value)} required><option value="">선택</option><option value="Level I">Level I</option><option value="Level II">Level II</option><option value="Level III">Level III</option></select></label>
            <label className="text-[11px] font-bold text-[#64748B]">취득일<input type="date" className={fieldClass} value={form.obtained_date||''} onChange={e=>updateForm('obtained_date',e.target.value)}/></label>
            <label className="text-[11px] font-bold text-[#64748B]">유효날짜 (기본 5년)<input type="date" className={fieldClass} value={form.expiry_date||''} onChange={e=>updateForm('expiry_date',e.target.value)}/></label>
            <label className="text-[11px] font-bold text-[#64748B]">Cert' No<input className={fieldClass} value={form.cert_no||''} onChange={e=>updateForm('cert_no',e.target.value)}/></label>
            <p className="sm:col-span-2 text-[10px] text-[#64748B]">사내발급 선택 시 경력시간에 따른 Level 자동 판정이 적용되며, ASNT/ISO 선택 시 경력시간 판정에서 제외됩니다.</p>
          </>}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#E2E5E9] pt-3"><button type="button" onClick={()=>setModalOpen(false)} className="rounded-lg border border-[#E2E5E9] px-3 py-2 text-xs font-bold">취소</button><button type="submit" className="rounded-lg bg-[#243B5A] px-4 py-2 text-xs font-bold text-white">저장</button></div>
      </form>
    </div>}
    {notice && <div className="fixed right-4 top-4 z-[150] w-[min(92vw,420px)]"><div className={`rounded-xl border bg-white p-3 text-xs font-bold shadow-xl ${notice.type==='error'?'border-red-200 text-red-700':notice.type==='warning'?'border-amber-200 text-amber-700':'border-[#D5DEE9] text-[#243B5A]'}`}>{notice.message}</div></div>}
  </div>;
}