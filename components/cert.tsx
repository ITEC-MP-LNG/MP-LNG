'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ChevronDown, ChevronRight, Plus, Edit3, Trash2, X, Download, Award, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';

type Person = {
  id: string; name: string; department?: string; position?: string;
  career_start_date?: string; experience?: string; role?: string;
  yard_certificates?: string; national_certificates?: string; internal_certificates?: string;
  cert_assignments?: Record<string, { level?: string; cert_no?: string }>;
};
type Category = 'YARD' | 'NATIONAL' | 'NDT';
type CertRecord = {
  id: string; user_id: string; category: Category; title: string;
  obtained_date: string | null; expiry_date: string | null; method: string | null;
  level: string | null; cert_no: string | null; sticker_no: string | null;
  education_completed: string | null; training_date_1: string | null;
  training_date_2: string | null; training_date_3: string | null; training_date_4: string | null;
  detail: Record<string, any> | null;
};
type Holiday = { holiday_date: string; name?: string };
const C = { navy: '#243B5A', pale: '#F5F6F8', border: '#E2E5E9', text: '#1F2937', muted: '#64748B' };
const METHODS = ['PT', 'LT', 'RT', 'UT', 'MT'];
const LT_TYPES = ['Bubble', 'Pressure change', 'Mass Spectrometer'];
const blank = (category: Category, userId = ''): Partial<CertRecord> => ({
  user_id: userId, category, title: '', obtained_date: '', expiry_date: '', method: '',
  level: '', cert_no: '', sticker_no: '', education_completed: '', training_date_1: '',
  training_date_2: '', training_date_3: '', training_date_4: '',
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
const parseNationalLegacy = (value: string) => {
  const type = value.includes('산업기사') ? '산업기사' : value.includes('기능사') ? '기능사' : value.includes('기사') ? '기사' : '';
  if (!type) return { title: 'METHOD', method: value };
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
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
      // 자격 레코드는 HRManagement에서 한 번 조회해 카드뷰/목록뷰와 공유합니다.
      // 이 화면에서는 공휴일만 조회하여 중복 Supabase 호출을 줄입니다.
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
    // 부모가 전달한 공용 데이터를 자식 상태에 반영한 직후에는 빈 배열로 덮어쓰지 않습니다.
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

  // 근무시간을 1년=260근무일, 1일=8시간 기준으로 YY/DD/Hour 형태로 표시합니다.
  const formatCareer = (hours: number) => {
    const totalWorkDays = Math.floor(Math.max(0, hours) / 8);
    const years = Math.floor(totalWorkDays / 260);
    const days = totalWorkDays % 260;
    const remainingHours = Math.max(0, hours) % 8;
    return `${years}년/${days}일/${remainingHours}시간`;
  };

  const autoNdtLevelFor = useCallback((userId: string, method?: string | null, title?: string | null): 'Level I' | 'Level II' | null => {
    const person = users.find(u => u.id === userId);
    const hours = careerHoursFromMember(person?.career_start_date);
    let levelI = 0;
    let levelII = 0;
    if (method === 'PT') { levelI = 130; levelII = 270; }
    else if (method === 'LT' && (title || 'Bubble') === 'Bubble') { levelI = 15; levelII = 80; }
    else if (method === 'LT' && title === 'Pressure change') { levelI = 200; levelII = 530; }
    else if (method === 'LT' && title === 'Mass Spectrometer') { levelI = 530; levelII = 800; }
    else return null; // RT/UT/MT는 별도 요구시간 기준이 아직 지정되지 않았습니다.
    return hours >= levelII ? 'Level II' : hours >= levelI ? 'Level I' : null;
  }, [users, careerHoursFromMember]);

  // 구성원 경력시간만으로 PT / LT Bubble / LT Pressure change의 미발급 자격 레코드를 자동 생성합니다.
  // LT Mass Spectrometer는 사용자 요청에 따라 자동 생성하지 않으며, 취득일도 직접 입력합니다.
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
          const existing = records.find(r => r.category === 'NDT' && r.user_id === person.id && r.method === def.method && r.title === def.title);
          if (!existing) {
            if (autoNdtSyncRef.current.has(key)) return;
            autoNdtSyncRef.current.add(key);
            pending.push({ user_id: person.id, category: 'NDT', title: def.title, obtained_date: null, expiry_date: null, method: def.method, level, cert_no: null, sticker_no: null, education_completed: null, training_date_1: null, training_date_2: null, training_date_3: null, training_date_4: null, detail: { autoCareerLevel: true, careerHoursAtRegistration: hours } });
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
        notify(`NDT 자동 등록 실패: ${e?.message || '오류'}`, 'error');
      }
    };
    void syncAutoNdtRecords();
    return () => { cancelled = true; };
  }, [users, records, careerHoursFromMember, notify]);

  const latestYardRefreshDate = (r: Partial<CertRecord>) => {
    const dates = [r.training_date_1, r.training_date_2, r.training_date_3, r.training_date_4, r.education_completed, r.obtained_date]
      .filter((d): d is string => !!d).sort();
    return dates[dates.length - 1] || '';
  };

  // 기존 구성원정보의 YARD·국가자격만 개별 레코드로 가져옵니다.
  // 사내자격(internal_certificates)은 YARD로 가져오지 않습니다.
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
          const trueYardTitles = new Set(splitLegacy(person.yard_certificates).map(v => v.toLowerCase()));
          const internalTitles = new Set(splitLegacy(person.internal_certificates).map(v => v.toLowerCase()));
          for (const row of personRecords) {
            if (row.category !== 'YARD' || trueYardTitles.has(row.title.trim().toLowerCase()) || !internalTitles.has(row.title.trim().toLowerCase())) continue;
            const methodMatch = row.title.match(/\b(PT|UT|RT|MT|LT)\b/i);
            if (!methodMatch) continue; // 불명확한 항목은 데이터 손실 방지를 위해 자동 변경하지 않습니다.
            const method = methodMatch[1].toUpperCase();
            const levelMatch = row.title.match(/Level\s*(III|II|I|3|2|1)/i);
            const level = levelMatch ? `Level ${/^(III|II|I)$/i.test(levelMatch[1]) ? levelMatch[1].toUpperCase() : ({'3':'III','2':'II','1':'I'} as Record<string,string>)[levelMatch[1]]}` : null;
            const title = method === 'LT' ? ( /mass\s*spectrometer/i.test(row.title) ? 'Mass Spectrometer' : /pressure\s*change/i.test(row.title) ? 'Pressure change' : /bubble/i.test(row.title) ? 'Bubble' : 'LT') : method;
            const { data: repaired, error: repairError } = await supabase.from('cert_records').update({ category: 'NDT', method, title, level, detail: { ...(row.detail || {}), repairedFromMisclassifiedYard: true } }).eq('id', row.id).select('*').single();
            if (repairError) throw repairError;
            if (repaired) repairedRows.push(repaired as CertRecord);
          }
        }
        if (repairedRows.length) {
          setRecords(prev => prev.map(r => repairedRows.find(x => x.id === r.id) || r));
          notify('사내자격으로 잘못 분류된 NDT 항목을 사내자격 탭으로 이동했습니다.');
        }
        users.forEach(person => {
          const personRecords = records.filter(r => r.user_id === person.id);
          // YARD에는 yard_certificates 필드만 가져옵니다.
          // internal_certificates는 사내자격이므로 YARD로 절대 합치지 않습니다.
          const legacyYardItems = Array.from(new Set(splitLegacy(person.yard_certificates)));
          const legacyYardOriginal = (person.yard_certificates || '').trim();
          if (legacyYardItems.length > 1) {
            personRecords.filter(r => r.category === 'YARD' && r.detail?.legacyImport && r.detail?.source === 'internal_certificates' && r.title.includes(',')).forEach(r => obsoleteLegacyYardIds.push(r.id));
          }
          legacyYardItems.forEach(title => {
            const key = `${person.id}|YARD|${title}`;
            if (personRecords.some(r => r.category === 'YARD' && r.title.trim() === title) || migratedLegacyKeysRef.current.has(key)) return;
            pendingKeys.push(key);
            pending.push({ user_id: person.id, category: 'YARD', title, obtained_date: null, expiry_date: null, method: null, level: null, cert_no: null, sticker_no: null, education_completed: null, training_date_1: null, training_date_2: null, training_date_3: null, training_date_4: null, detail: { legacyImport: true, source: 'yard_certificates', original: legacyYardOriginal } });
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
            pending.push({ user_id: person.id, category: 'NATIONAL', title, obtained_date: null, expiry_date: null, method, level: null, cert_no: null, sticker_no: null, education_completed: null, training_date_1: null, training_date_2: null, training_date_3: null, training_date_4: null, detail: { legacyImport: true, source: 'national_certificates', original: item } });
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
          notify('기존 구성원정보의 YARD·국가자격을 개별 항목으로 연동했습니다. 취득일과 유효기간은 필요 시 입력해주세요.');
        }
      } catch (e: any) {
        notify(`기존 자격 연동 실패: ${e?.message || '오류'}`, 'error');
      } finally { migrationInProgressRef.current = false; }
    };
    void migrateLegacyCertificates();
  }, [users, records, notify]);

  // 공휴일은 외부 연도별 달력에서 자동 수집해 Supabase에 저장합니다.
  // 이미 저장된 연도는 다시 요청하지 않으며, 수동 수정도 가능합니다.
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
        } catch { /* 외부 API 실패 시 수동 등록/기존 저장 데이터를 유지 */ }
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
      setHolidaySyncMessage(completed.length ? `공휴일 자동 반영 완료 (${completed.length}개 연도 확인)` : '자동 공휴일 조회에 실패했습니다. 기존 데이터는 유지됩니다.');
    };
    void syncHolidays();
    return () => { cancelled = true; };
  // Only sync when the member list or the initially-loaded holiday data changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, holidays.length]);

  const visibleRecords = useMemo(() => records.filter(r => {
    if (r.category !== category) return false;
    if (selectedUserId !== 'ALL' && r.user_id !== selectedUserId) return false;
    const p = personById.get(r.user_id);
    const q = search.trim().toLowerCase();
    return !q || [p?.name, p?.id, r.title, r.method, r.level, r.cert_no, r.sticker_no].some(v => esc(v).toLowerCase().includes(q));
  }), [records, category, selectedUserId, search, personById]);

  const matchingPeople = useMemo(() => users.filter(person => {
    if (selectedUserId !== 'ALL' && person.id !== selectedUserId) return false;
    const q = search.trim().toLowerCase();
    if (!q) return selectedUserId !== 'ALL';
    const memberTextMatches = [person.name, person.id, person.department, person.position, person.yard_certificates, person.national_certificates, person.internal_certificates]
      .some(v => esc(v).toLowerCase().includes(q));
    const recordTextMatches = records.some(r => r.user_id === person.id && [r.title, r.method, r.level, r.cert_no, r.sticker_no].some(v => esc(v).toLowerCase().includes(q)));
    return memberTextMatches || recordTextMatches;
  }), [users, records, selectedUserId, search]);

  const daysUntil = (d?: string|null) => d ? dayDiff(d) : null;
  const expiryForRecord = (r: CertRecord) => { if (r.category === 'YARD') { const base = r.education_completed || r.obtained_date || ''; const refresh = [r.training_date_1, r.training_date_2, r.training_date_3, r.training_date_4].filter(Boolean).sort().slice(-1)[0] || ''; const latest = latestYardRefreshDate(r); const defaultExpiry = latest ? addYears(latest, 2) : null; if (refresh && refresh > base && !r.detail?.expiryManuallySet) return defaultExpiry; return r.expiry_date || defaultExpiry; } if (r.category === 'NDT') return r.expiry_date || (r.obtained_date ? addYears(r.obtained_date, 5) : null); return null; };
  const isSelfRecord = (r: CertRecord) => (!!currentUser?.id && currentUser.id === r.user_id) || (!!currentUser?.name && personById.get(r.user_id)?.name === currentUser.name);
  const canManageRecord = (r: CertRecord) => isAdmin || isSelfRecord(r);
  const canSeeRecordAlert = (r: CertRecord) => canManageRecord(r);
  useEffect(() => {
    const eligible = records.filter(r => {
      if (!canSeeRecordAlert(r)) return false;
      if (r.category === 'NATIONAL') return false;
      const warningDays = r.category === 'NDT' ? 30 : 40;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (next.category === 'NDT' && !editing && ['user_id','method','title'].includes(key)) {
      const auto = autoNdtLevelFor(String(next.user_id || ''), next.method, next.title);
      if (auto) next.level = auto;
      else if (next.method === 'PT' || next.method === 'LT') next.level = '';
    }
    return next;
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.user_id) { notify('구성원을 선택해주세요.', 'warning'); return; }
    if (!isAdmin && form.user_id !== (currentUser?.id || users.find(u=>u.name===currentUser?.name)?.id)) { notify('본인 자격정보만 등록 또는 수정할 수 있습니다.', 'warning'); return; }
    if (!form.title?.trim()) { notify(category === 'YARD' ? '교육명을 입력해주세요.' : '자격종류 또는 Method를 입력해주세요.', 'warning'); return; }
    if (category === 'NDT' && (form.method === 'PT' || form.method === 'LT') && !autoNdtLevelFor(String(form.user_id || ''), form.method, form.title)) { notify('해당 Method의 Level I 요구 경력시간에 미달합니다.', 'warning'); return; }
    if (category === 'NDT' && (!form.method || !form.level)) { notify('Method와 자동 판정 Level을 확인해주세요.', 'warning'); return; }
    const payload: any = {
      user_id: form.user_id, category, title: form.title.trim(),
      obtained_date: form.obtained_date || null, expiry_date: category === 'NATIONAL' ? null : (form.expiry_date || (category === 'YARD' && latestYardRefreshDate(form) ? addYears(latestYardRefreshDate(form), 2) : category === 'NDT' && form.obtained_date ? addYears(form.obtained_date, 5) : null)),
      method: form.method || null, level: form.level || null, cert_no: form.cert_no || null,
      sticker_no: form.sticker_no || null, education_completed: form.education_completed || null,
      training_date_1: form.training_date_1 || null, training_date_2: form.training_date_2 || null,
      training_date_3: form.training_date_3 || null, training_date_4: form.training_date_4 || null,
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
          ...(category === 'NATIONAL' ? { national_certificates: nextRecords.filter(r=>r.user_id===person.id && r.category==='NATIONAL').map(r=>r.title).filter(Boolean).join(', ') } : {}),
          ...(category === 'NDT' ? { cert_assignments: { ...(person.cert_assignments||{}), [data.method || '']: { level: data.level || '', cert_no: data.cert_no || '' } }, internal_certificates: nextRecords.filter(r=>r.user_id===person.id && r.category==='NDT').map(r=>`${r.method || ''} ${r.title || ''} ${r.level || ''}`.trim()).filter(Boolean).join(', ') } : {}),
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
          ...(category === 'NATIONAL' ? { national_certificates: nextRecords.filter(r=>r.user_id===person.id && r.category==='NATIONAL').map(r=>r.title).filter(Boolean).join(', ') } : {}),
          ...(category === 'NDT' ? { cert_assignments: { ...(person.cert_assignments||{}), [data.method || '']: { level: data.level || '', cert_no: data.cert_no || '' } }, internal_certificates: nextRecords.filter(r=>r.user_id===person.id && r.category==='NDT').map(r=>`${r.method || ''} ${r.title || ''} ${r.level || ''}`.trim()).filter(Boolean).join(', ') } : {}),
        }]);
      }
      if (editing) { setModalOpen(false); notify('자격정보를 수정했습니다.'); }
      else { const savedUserId = form.user_id || ''; setForm(blank(category, savedUserId)); notify('저장했습니다. ▶ 위에서 다른 자격 항목으로 이동해 계속 등록할 수 있습니다.'); }
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
      ...(r.category === 'NATIONAL' ? { national_certificates: nextRecords.filter(x=>x.user_id===person.id && x.category==='NATIONAL').map(x=>x.title).filter(Boolean).join(', ') } : {}),
      ...(r.category === 'NDT' ? { cert_assignments: { ...(person.cert_assignments||{}), [r.method || '']: { level: '', cert_no: '' } }, internal_certificates: nextRecords.filter(x=>x.user_id===person.id && x.category==='NDT').map(x=>`${x.method || ''} ${x.title || ''} ${x.level || ''}`.trim()).filter(Boolean).join(', ') } : {}),
    }]);
    notify('자격정보를 삭제했습니다.');
  };

  const exportExcel = () => {
    if (!isAdmin) { notify('엑셀 추출은 관리자 계정만 사용할 수 있습니다.', 'warning'); return; }
    const list = records.filter(r => r.category === category).sort((a,b) => {
      const an = personById.get(a.user_id)?.name || a.user_id;
      const bn = personById.get(b.user_id)?.name || b.user_id;
      return an.localeCompare(bn, 'ko') || a.user_id.localeCompare(b.user_id, 'ko') || a.title.localeCompare(b.title, 'ko');
    });
    const rows: any[][] = [];
    let title = '';
    if (category === 'YARD') {
      title = 'YARD 자격 현황';
      rows.push([title], ['성명','교육명','사번','교육이수','스티커 번호','보수교육 1','보수교육 2','보수교육 3','보수교육 4','유효기간']);
      list.forEach(r => rows.push([personById.get(r.user_id)?.name || '', r.title, r.user_id, r.education_completed || r.obtained_date || '', r.sticker_no || '', r.training_date_1 || '', r.training_date_2 || '', r.training_date_3 || '', r.training_date_4 || '', expiryForRecord(r) || '']));
    } else if (category === 'NATIONAL') {
      title = '국가 자격 취득 현황';
      rows.push([title], ['성명','자격종류','METHOD','취득일']);
      list.forEach(r => rows.push([personById.get(r.user_id)?.name || '', ['기능사','산업기사','기사'].includes(r.title) ? r.title : '', r.method || (r.title === 'METHOD' ? r.detail?.original || '' : ''), r.obtained_date || '']));
    } else {
      title = '사내자격 취득 현황';
      rows.push([title], ['성명','경력(YY/DD/Hour)','자격종류(Level)','Method','취득일','유효날짜']);
      list.forEach(r => {
        const p = personById.get(r.user_id);
        rows.push([p?.name || '', formatCareer(careerHoursFromMember(p?.career_start_date)), `${r.level || ''}`, r.method === 'LT' ? `LT (${r.title})` : r.method || '', r.obtained_date || '', r.expiry_date || (r.obtained_date ? addYears(r.obtained_date, 5) : '')]);
      });
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!merges'] = [{s:{r:0,c:0}, e:{r:0,c:rows[1].length-1}}];
    // 같은 사람에게 여러 자격이 있으면 Excel에서 이름 셀을 세로 병합합니다.
    const nameCol = 0;
    let i = 0;
    while (i < list.length) {
      let j = i + 1;
      while (j < list.length && list[j].user_id === list[i].user_id) j++;
      if (j - i > 1) {
        const startRow = i + 2;
        const endRow = j + 1;
        ws['!merges'].push({ s: { r: startRow, c: nameCol }, e: { r: endRow, c: nameCol } });
        for (let rowIndex = startRow + 1; rowIndex <= endRow; rowIndex++) {
          const cell = ws[XLSX.utils.encode_cell({ r: rowIndex, c: nameCol })];
          if (cell) cell.v = '';
        }
      }
      i = j;
    }
    ws['!rows'] = [{hpx:56}, {hpx:24}, ...rows.slice(2).map(() => ({hpx:21}))];
    ws['!cols'] = rows[1].map((_, i) => {
      const max = Math.max(...rows.map(row => String(row[i] ?? '').length), 8);
      return {wch: Math.min(Math.max(max + 3, 12), 38)};
    });
    ws['!autofilter'] = {ref: `A2:${XLSX.utils.encode_col(rows[1].length-1)}${Math.max(2, rows.length)}`};
    rows.forEach((row, ri) => row.forEach((_, ci) => {
      const cell = ws[XLSX.utils.encode_cell({r:ri,c:ci})];
      if (!cell) return;
      cell.s = ri === 0
        ? {fill:{fgColor:{rgb:'243B5A'}}, font:{name:'HY헤드라인M', sz:20, bold:true, color:{rgb:'FFFFFF'}}, alignment:{horizontal:'center', vertical:'center'}}
        : {fill:{fgColor:{rgb:ri===1?'DCE5F0':(ri%2===0?'FFFFFF':'F5F6F8')}}, font:{name:'맑은 고딕', sz:9, color:{rgb:'1F2937'}}, alignment:{horizontal:'center', vertical:'center', wrapText:true}, border:{top:{style:'thin',color:{rgb:'E2E5E9'}},bottom:{style:'thin',color:{rgb:'E2E5E9'}},left:{style:'thin',color:{rgb:'E2E5E9'}},right:{style:'thin',color:{rgb:'E2E5E9'}}}};
    }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, category === 'YARD' ? 'YARD 자격 현황' : category === 'NATIONAL' ? '국가 자격' : '사내자격 NDT');
    XLSX.writeFile(wb, `${title}_${todayStr()}.xlsx`);
  };


  const ndtStatusForMethod = (userId: string, method: string, title: string) => {
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
  const ndtStatusForRecord = (r: CertRecord) => ndtStatusForMethod(r.user_id, r.method || '', r.title || '');
  const selectedNdtPerson = category === 'NDT'
    ? (selectedUserId !== 'ALL' ? personById.get(selectedUserId) : (search.trim() ? users.find(u => [u.name, u.id].some(v => esc(v).toLowerCase().includes(search.trim().toLowerCase()))) : undefined))
    : undefined;


  const tabs: {key:Category; label:string}[] = [
    {key:'YARD', label:'YARD 자격'}, {key:'NATIONAL', label:'국가자격'}, {key:'NDT', label:'사내자격(NDT Level)'},
  ];
  const dateLabel = (d?: string|null) => d ? `${d} (D-${daysUntil(d)})` : '-';
  const addHoliday = async () => {
    if (!holidayDate || !holidayName.trim()) { notify('공휴일 날짜와 명칭을 입력해주세요.', 'warning'); return; }
    setHolidayBusy(true);
    const { data, error } = await supabase.from('cert_holidays').upsert({ holiday_date: holidayDate, name: holidayName.trim() }, { onConflict: 'holiday_date' }).select('holiday_date,name').single();
    setHolidayBusy(false);
    if (error) { notify(`공휴일 저장 실패: ${error.message}`, 'error'); return; }
    setHolidays(prev => [...prev.filter(h => h.holiday_date !== data.holiday_date), data as Holiday].sort((a,b)=>a.holiday_date.localeCompare(b.holiday_date)));
    setHolidayDate(''); setHolidayName(''); notify('공휴일을 등록했습니다.');
  };
  const removeHoliday = async (holiday: Holiday) => {
    const { error } = await supabase.from('cert_holidays').delete().eq('holiday_date', holiday.holiday_date);
    if (error) { notify(`공휴일 삭제 실패: ${error.message}`, 'error'); return; }
    setHolidays(prev => prev.filter(h => h.holiday_date !== holiday.holiday_date)); notify('공휴일을 삭제했습니다.');
  };

  const alertDates = (r: CertRecord) => r.category === 'YARD'
    ? [r.training_date_1, r.training_date_2, r.training_date_3, r.training_date_4, expiryForRecord(r)].filter(Boolean) as string[]
    : [r.expiry_date].filter(Boolean) as string[];

  return <div className="space-y-3 text-[#1F2937]">
    <div className="rounded-xl border border-[#E2E5E9] bg-white p-3 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><div className="rounded-lg bg-[#F5F6F8] p-2 text-[#243B5A]"><Award className="h-4 w-4"/></div><div><h2 className="text-sm font-bold">자격현황 관리</h2><p className="text-[11px] text-[#64748B]">구성원 명단과 연동 · 등록/수정/삭제 · Excel 출력</p></div></div>
        <div className="flex gap-2">
          {isAdmin && <button onClick={exportExcel} className="flex items-center gap-1 rounded-lg border border-[#E2E5E9] bg-white px-3 py-2 text-xs font-bold text-[#243B5A]"><Download className="h-3.5 w-3.5"/> Excel 추출</button>}
          {(isAdmin || currentUser?.id || currentUser?.name) && <button onClick={openAdd} className="flex items-center gap-1 rounded-lg bg-[#243B5A] px-3 py-2 text-xs font-bold text-white"><Plus className="h-3.5 w-3.5"/> 자격 등록</button>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 border-b border-[#E2E5E9] pb-2">
        {tabs.map(t => <button key={t.key} onClick={() => {setCategory(t.key);setSearch('');setSelectedUserId('ALL');}} className={`rounded-lg border px-3 py-2 text-xs font-bold ${category===t.key?'border-[#243B5A] bg-[#243B5A] text-white':'border-[#E2E5E9] bg-[#F5F6F8] text-[#64748B]'}`}>{t.label} ({records.filter(r=>r.category===t.key).length})</button>)}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input className={fieldClass} value={search} onChange={e=>setSearch(e.target.value)} placeholder="이름, 사번, 자격 검색"/>
        <select className={fieldClass} value={selectedUserId} onChange={e=>setSelectedUserId(e.target.value)}><option value="ALL">전체 구성원</option>{users.map(u=><option key={u.id} value={u.id}>{u.name} ({u.id})</option>)}</select>
        <div className="flex items-center text-[11px] text-[#64748B]">검색 결과 {matchingPeople.length}명 · 알림은 YARD 40일, NDT 30일 전 (국가자격 알림 없음)</div>
      </div>
    </div>

    {loadError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{loadError}<p className="mt-1">아래 SQL 파일을 Supabase SQL Editor에서 1회 실행해주세요.</p><button onClick={()=>void load()} className="mt-2 rounded-lg bg-[#243B5A] px-3 py-1.5 text-white">다시 불러오기</button></div>}
    {loading ? <div className="rounded-xl border border-[#E2E5E9] bg-white p-10 text-center text-xs text-[#64748B]">자격현황을 불러오는 중...</div> : (
      (search.trim() || selectedUserId !== 'ALL') ? <div className="space-y-2">
        {matchingPeople.map(person => {
          const memberRecords = records.filter(r => r.user_id === person.id);
          const yardRecords = memberRecords.filter(r => r.category === 'YARD');
          const nationalRecords = memberRecords.filter(r => r.category === 'NATIONAL');
          const ndtRecords = memberRecords.filter(r => r.category === 'NDT');
          const careerHours = careerHoursFromMember(person.career_start_date);
          const columns = [
            { key: 'YARD', label: 'YARD 자격', items: yardRecords },
            { key: 'NATIONAL', label: '국가자격', items: nationalRecords },
            { key: 'NDT', label: '사내자격 (NDT Level)', items: ndtRecords },
          ];
          return <div key={person.id} className="overflow-hidden rounded-xl border border-[#E2E5E9] bg-white shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F5F6F8] p-3">
              <div><div className="text-sm font-bold text-[#243B5A]">{person.name} <span className="text-xs font-normal text-[#64748B]">({person.id})</span></div><div className="mt-1 text-[10px] text-[#64748B]">총 경력 {formatCareer(careerHours)} · 환산 {careerHours.toLocaleString()}시간</div></div>
              {isAdmin && <button onClick={()=>{setCategory('YARD');setSelectedUserId(person.id);setSearch('');setForm(blank('YARD',person.id));setEditing(null);setModalOpen(true);}} className="rounded-lg bg-[#243B5A] px-3 py-1.5 text-[10px] font-bold text-white">자격 추가</button>}
            </div>
            <div className="grid grid-cols-1 divide-y divide-[#E2E5E9] md:grid-cols-3 md:divide-x md:divide-y-0">
              {columns.map(col => <div key={col.key} className="min-w-0 p-3">
                <div className="mb-2 flex items-center justify-between"><h4 className="text-xs font-bold text-[#243B5A]">{col.label}</h4><span className="rounded-full bg-[#F5F6F8] px-2 py-0.5 text-[10px] text-[#64748B]">{col.items.length}건</span></div>
                {col.key === 'NDT' && <div className="mb-2 rounded-lg bg-[#F8FAFC] p-2"><div className="mb-1 text-[10px] font-bold text-[#64748B]">경력 기준 자동 판정</div><div className="flex flex-wrap gap-1">{([{method:'PT',title:'PT'},{method:'LT',title:'Bubble'},{method:'LT',title:'Pressure change'}] as const).map(item => { const status = ndtStatusForMethod(person.id,item.method,item.title); return <span key={`${item.method}-${item.title}`} title={status.eligible ? status.status : '해당 Method의 요구시간 미달'} className={`rounded border px-1.5 py-1 text-[9px] font-bold ${status.eligible ? (status.status === '발급 완료' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700') : 'border-rose-200 bg-rose-50 text-rose-700'}`}>{item.method}{item.method==='LT'?` ${item.title}`:''}: {status.level || '미달'} · {status.status}</span>; })}</div></div>}
                {col.items.length === 0 && <div className="rounded-lg border border-dashed border-[#E2E5E9] p-3 text-center text-[10px] text-[#94A3B8]">등록된 자격 없음</div>}
                <div className="space-y-2">{col.items.map(r => <div key={r.id} className="rounded-lg border border-[#E2E5E9] p-2">
                  <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="break-words text-[11px] font-bold text-[#1F2937]">{r.title}{r.method ? ` · ${r.method}` : ''}{r.level ? ` ${r.level}` : ''}</div><div className="mt-1 text-[10px] text-[#64748B]">취득/이수 {r.obtained_date || r.education_completed || '미입력'}</div>{r.category !== 'NATIONAL' && <div className="text-[10px] text-[#64748B]">유효기간 {expiryForRecord(r) || '미입력'}</div>}{r.category==='YARD' && <div className="mt-1 text-[9px] text-[#64748B]">{[r.training_date_1,r.training_date_2,r.training_date_3,r.training_date_4].map((d,i)=>d?`보수교육 ${i+1}: ${d}`:'').filter(Boolean).join(' · ') || '보수교육 미입력'}</div>}{r.category==='NDT' && <div className="mt-1 text-[10px] font-bold text-[#64748B]">{ndtStatusForRecord(r).level || r.level || 'Level 미정'} · {ndtStatusForRecord(r).status}</div>}</div>
                    {canManageRecord(r) && <div className="flex shrink-0 gap-1"><button title="수정" onClick={()=>openEdit(r)} className="rounded border border-[#E2E5E9] p-1 text-[#243B5A]"><Edit3 className="h-3 w-3"/></button><button title="삭제" onClick={()=>void remove(r)} className="rounded border border-red-200 p-1 text-red-600"><Trash2 className="h-3 w-3"/></button></div>}
                  </div>
                </div>)}</div>
              </div>)}
            </div>
          </div>;
        })}
        {matchingPeople.length===0 && <div className="rounded-xl border border-[#E2E5E9] bg-white p-8 text-center text-xs text-[#64748B]">검색 조건에 맞는 구성원이 없습니다.</div>}
      </div> : <div className="rounded-xl border border-dashed border-[#E2E5E9] bg-white p-8 text-center text-xs text-[#64748B]">목록은 기본적으로 숨겨져 있습니다. 이름·사번·자격을 검색하거나 구성원을 선택하면 해당 자격이 표시됩니다.</div>
    )}

    <div className="rounded-xl border border-[#E2E5E9] bg-white p-3"><details className="rounded-lg border border-[#E2E5E9] p-3">
        <summary className="cursor-pointer text-xs font-bold text-[#243B5A]">법정공휴일 / 대체공휴일 관리</summary>
        <div className="mt-3 flex flex-wrap items-center gap-2"><label className="text-xs font-bold text-[#64748B]">연도<select className={`${fieldClass} mt-1 min-w-[120px]`} value={selectedHolidayYear} onChange={e=>setSelectedHolidayYear(e.target.value)}>{Array.from({length: 44}, (_, i) => new Date().getFullYear() - 40 + i).map(y=><option key={y} value={String(y)}>{y}년</option>)}</select></label><div className="rounded-lg bg-[#F5F6F8] px-3 py-2 text-xs font-bold text-[#243B5A]">{selectedHolidayYear}년 공휴일 {holidays.filter(h=>h.holiday_date.startsWith(`${selectedHolidayYear}-`)).length}일</div></div>
        <p className="mt-2 text-[10px] text-[#64748B]">{holidaySyncMessage || '연도별 공휴일 데이터를 자동 조회합니다.'} 선택한 연도의 공휴일만 표시합니다. 누락된 대체공휴일은 직접 추가·수정할 수 있습니다.</p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input type="date" className={fieldClass} value={holidayDate} onChange={e=>{setHolidayDate(e.target.value); if(e.target.value) setSelectedHolidayYear(e.target.value.slice(0,4));}}/>
          <input className={fieldClass} value={holidayName} onChange={e=>setHolidayName(e.target.value)} placeholder="공휴일 명칭"/>
          <button type="button" disabled={holidayBusy} onClick={()=>void addHoliday()} className="rounded-lg bg-[#243B5A] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{holidayBusy?'저장 중':'공휴일 등록'}</button>
        </div>
        {holidays.filter(h=>h.holiday_date.startsWith(`${selectedHolidayYear}-`)).length>0 && <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">{holidays.filter(h=>h.holiday_date.startsWith(`${selectedHolidayYear}-`)).sort((a,b)=>a.holiday_date.localeCompare(b.holiday_date)).map(h=><div key={h.holiday_date} className="flex items-center justify-between rounded bg-[#F5F6F8] px-2 py-1 text-[11px]"><span>{h.holiday_date} · {h.name}</span><button type="button" onClick={()=>void removeHoliday(h)} className="font-bold text-red-600">삭제</button></div>)}</div>}
      </details></div>

    {activeAlert && !alertHidden && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 p-3">
      <div className="w-full max-w-md space-y-3 rounded-xl border border-[#E2E5E9] bg-white p-4 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-[#E2E5E9] pb-2"><AlertTriangle className="h-5 w-5 text-amber-600"/><h3 className="text-sm font-bold">자격 보수교육 / 유효기간 알림</h3></div>
        <p className="text-xs text-[#64748B]">관리자 또는 해당 구성원에게만 표시됩니다. {activeAlert.category==='NDT'?'30일':'40일'} 전 알림 기준입니다.</p>
        <div className="rounded-lg bg-[#F5F6F8] p-3 text-xs"><b>{personById.get(activeAlert.user_id)?.name || activeAlert.user_id} · {activeAlert.title}</b><div className="mt-1">{alertDates(activeAlert).map(d=><div key={d}>{d} ({dayDiff(d)}일 남음)</div>)}</div></div>
        <div className="flex justify-end gap-2"><button onClick={hideAlertToday} className="rounded-lg border border-[#E2E5E9] px-3 py-2 text-xs font-bold text-[#64748B]">오늘 보지 않기</button><button onClick={()=>setActiveAlert(null)} className="rounded-lg bg-[#243B5A] px-4 py-2 text-xs font-bold text-white">닫기</button></div>
      </div>
    </div>}

    {modalOpen && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 p-3">
      <form onSubmit={save} className="max-h-[92vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-xl border border-[#E2E5E9] bg-white p-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E2E5E9] pb-2"><h3 className="text-sm font-bold">{editing?'자격정보 수정':`${tabs.find(t=>t.key===category)?.label} 등록`}</h3><button type="button" onClick={()=>setModalOpen(false)}><X className="h-4 w-4"/></button></div>
        {!editing && <div className="rounded-lg border border-[#E2E5E9] bg-[#F5F6F8] p-2"><div className="mb-1 text-[10px] font-bold text-[#64748B]">▶ 자격 종류 이동 · 항목별 저장 후 다음 항목으로 이동하세요</div><div className="flex flex-wrap gap-2">{tabs.map(t=><button key={t.key} type="button" onClick={()=>{setCategory(t.key);setForm(blank(t.key, form.user_id || (selectedUserId !== 'ALL' ? selectedUserId : '')));}} className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold ${category===t.key?'border-[#243B5A] bg-[#243B5A] text-white':'border-[#E2E5E9] bg-white text-[#64748B]'}`}>▶ {t.label}</button>)}</div></div>}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="text-[11px] font-bold text-[#64748B]">구성원 *<select className={fieldClass} value={form.user_id||''} onChange={e=>updateForm('user_id',e.target.value)} required><option value="">선택</option>{users.filter(u=>isAdmin || u.id===(currentUser?.id || users.find(x=>x.name===currentUser?.name)?.id)).map(u=><option key={u.id} value={u.id}>{u.name} ({u.id})</option>)}</select></label>
          {category==='YARD' && <>
            <label className="text-[11px] font-bold text-[#64748B]">교육명 *<input className={fieldClass} value={form.title||''} onChange={e=>updateForm('title',e.target.value)} required/></label>
            <label className="text-[11px] font-bold text-[#64748B]">취득/교육이수일<input type="date" className={fieldClass} value={form.education_completed||form.obtained_date||''} onChange={e=>{updateForm('education_completed',e.target.value);updateForm('obtained_date',e.target.value);}}/></label>
            <label className="text-[11px] font-bold text-[#64748B]">스티커 번호<input className={fieldClass} value={form.sticker_no||''} onChange={e=>updateForm('sticker_no',e.target.value)}/></label>
            {[1,2,3,4].map(n=><label key={n} className="text-[11px] font-bold text-[#64748B]">보수교육 {n}<input type="date" className={fieldClass} value={(form as any)[`training_date_${n}`]||''} onChange={e=>updateForm(`training_date_${n}`,e.target.value)}/></label>)}
            <label className="text-[11px] font-bold text-[#64748B]">유효기간 (기본 2년)<input type="date" className={fieldClass} value={form.expiry_date||''} onChange={e=>updateForm('expiry_date',e.target.value)}/></label>
          </>}
          {category==='NATIONAL' && <>
            <label className="text-[11px] font-bold text-[#64748B]">자격종류 / 자격명 *<input list="national-cert-types" className={fieldClass} value={form.title||''} onChange={e=>updateForm('title',e.target.value)} placeholder="기능사 / 산업기사 / 기사 또는 자격명" required/><datalist id="national-cert-types"><option value="기능사"/><option value="산업기사"/><option value="기사"/></datalist></label>
            <label className="text-[11px] font-bold text-[#64748B]">METHOD (PT·UT·LT·MT·지게차 등)<input className={fieldClass} value={form.method||''} onChange={e=>updateForm('method',e.target.value)}/></label>
            <label className="text-[11px] font-bold text-[#64748B]">취득일<input type="date" className={fieldClass} value={form.obtained_date||''} onChange={e=>updateForm('obtained_date',e.target.value)}/></label>
          </>}
          {category==='NDT' && <>
            <label className="text-[11px] font-bold text-[#64748B]">Method *<select className={fieldClass} value={form.method||''} onChange={e=>{updateForm('method',e.target.value); if(e.target.value==='LT') updateForm('title','Bubble'); else updateForm('title',e.target.value);}} required><option value="">선택</option><option>PT</option><option>LT</option><option>RT</option><option>UT</option><option>MT</option></select></label>
            {form.method==='LT' && <label className="text-[11px] font-bold text-[#64748B]">LT 종류 *<select className={fieldClass} value={form.title||'Bubble'} onChange={e=>updateForm('title',e.target.value)}>{LT_TYPES.map(m=><option key={m}>{m}</option>)}</select></label>}
            <label className="text-[11px] font-bold text-[#64748B]">Level *<select className={fieldClass} value={form.level||''} onChange={e=>updateForm('level',e.target.value)} required disabled={!editing && (form.method==='PT' || form.method==='LT')}><option value="">{!editing && (form.method==='PT' || form.method==='LT') ? '경력 기준 미달' : '선택'}</option><option value="Level I">Level I</option><option value="Level II">Level II</option><option value="Level III">Level III</option></select>{!editing && (form.method==='PT' || form.method==='LT') && <span className="mt-1 block font-normal text-[10px] text-[#64748B]">총 경력시간 자동 판정: {autoNdtLevelFor(String(form.user_id||''), form.method, form.title) || '요구시간 미달'} · 취득일만 입력하면 됩니다.</span>}</label>
            <label className="text-[11px] font-bold text-[#64748B]">취득일<input type="date" className={fieldClass} value={form.obtained_date||''} onChange={e=>updateForm('obtained_date',e.target.value)}/></label>
            <label className="text-[11px] font-bold text-[#64748B]">유효날짜 (기본 5년)<input type="date" className={fieldClass} value={form.expiry_date||''} onChange={e=>updateForm('expiry_date',e.target.value)}/></label>
            <label className="text-[11px] font-bold text-[#64748B]">Cert' No<input className={fieldClass} value={form.cert_no||''} onChange={e=>updateForm('cert_no',e.target.value)}/></label>
            <p className="sm:col-span-2 text-[10px] text-[#64748B]">경력시간과 Level 판정은 구성원정보의 경력 시작일을 기준으로 자동 계산됩니다. 유효날짜는 취득일 기준 5년으로 자동 설정되며 직접 수정할 수 있습니다.</p>
          </>}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#E2E5E9] pt-3"><button type="button" onClick={()=>setModalOpen(false)} className="rounded-lg border border-[#E2E5E9] px-3 py-2 text-xs font-bold">취소</button><button type="submit" className="rounded-lg bg-[#243B5A] px-4 py-2 text-xs font-bold text-white">{editing ? '수정 저장' : '저장 후 계속 등록'}</button></div>
      </form>
    </div>}
    {notice && <div className="fixed right-4 top-4 z-[150] w-[min(92vw,420px)]"><div className={`rounded-xl border bg-white p-3 text-xs font-bold shadow-xl ${notice.type==='error'?'border-red-200 text-red-700':notice.type==='warning'?'border-amber-200 text-amber-700':'border-[#D5DEE9] text-[#243B5A]'}`}>{notice.message}</div></div>}
  </div>;
}
