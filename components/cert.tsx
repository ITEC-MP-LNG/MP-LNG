'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ChevronDown, ChevronRight, Plus, Edit3, Trash2, X, Download, Award, AlertTriangle, CalendarClock } from 'lucide-react';
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
const dayDiff = (date: string) => Math.ceil((new Date(`${date}T00:00:00`).getTime() - new Date(`${todayStr()}T00:00:00`).getTime()) / 86400000);
const esc = (v: any) => v == null ? '' : String(v);
const fieldClass = 'w-full rounded-lg border border-[#E2E5E9] bg-[#F5F6F8] px-2.5 py-2 text-xs text-[#1F2937] outline-none focus:border-[#243B5A] focus:bg-white';

export default function CertManagement({ users, currentUser, isAdmin, onUsersChanged }: {
  users: Person[]; currentUser: any; isAdmin: boolean; onUsersChanged?: (updates: Array<Partial<Person> & {id:string}>) => void;
}) {
  const [category, setCategory] = useState<Category>('YARD');
  const [records, setRecords] = useState<CertRecord[]>([]);
  const recordsLoadedRef = useRef(false);
  const migrationInProgressRef = useRef(false);
  const migratedLegacyKeysRef = useRef<Set<string>>(new Set());
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
  const [eligibilityUserId, setEligibilityUserId] = useState('');
  const [eligibilityMethod, setEligibilityMethod] = useState('PT');
  const [eligibilityLtType, setEligibilityLtType] = useState('Bubble');
  const [eligibilityLevel, setEligibilityLevel] = useState<'I'|'II'>('II');
  const [experienceHours, setExperienceHours] = useState('0');
  const [minimumExperienceHours, setMinimumExperienceHours] = useState('0');
  const [trainingHours, setTrainingHours] = useState('0');
  const [level1ToLevel2Hours, setLevel1ToLevel2Hours] = useState('0');
  const [massHours, setMassHours] = useState('0');
  const [holidayDate, setHolidayDate] = useState('');
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

  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      // 자격 목록과 휴일 목록만 각 1회 조회. 입력/수정 후에는 화면 상태를 직접 갱신합니다.
      const [r, h] = await Promise.all([
        supabase.from('cert_records').select('*').order('category').order('title'),
        supabase.from('cert_holidays').select('holiday_date,name'),
      ]);
      if (r.error) throw r.error;
      if (h.error && h.error.code !== '42P01') throw h.error;
      setRecords((r.data || []) as CertRecord[]);
      recordsLoadedRef.current = true;
      setHolidays((h.data || []) as Holiday[]);
    } catch (e: any) {
      setLoadError(e?.message || '자격현황을 불러오지 못했습니다. SQL 설정을 확인해주세요.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

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

  // 기존 구성원정보에만 저장되어 있던 자격 메모를 자격현황 레코드로 1회 가져옵니다.
  // YARD는 기존 사내자격 메모, 국가자격은 기존 국가자격 요약을 원문 그대로 보존합니다.
  useEffect(() => {
    if (!recordsLoadedRef.current || users.length === 0 || migrationInProgressRef.current) return;
    const migrateLegacyCertificates = async () => {
      try {
        const pending: any[] = [];
        const pendingKeys: string[] = [];
        users.forEach(person => {
          const personRecords = records.filter(r => r.user_id === person.id);
          const legacyYardTitle = person.internal_certificates?.trim() || '';
          const yardKey = `${person.id}|YARD|${legacyYardTitle}`;
          if (legacyYardTitle && !personRecords.some(r => r.category === 'YARD' && r.title.trim() === legacyYardTitle) && !migratedLegacyKeysRef.current.has(yardKey)) {
            pendingKeys.push(yardKey);
            pending.push({
              user_id: person.id, category: 'YARD', title: legacyYardTitle,
              obtained_date: null, expiry_date: null, method: null, level: null, cert_no: null,
              sticker_no: null, education_completed: null, training_date_1: null, training_date_2: null,
              training_date_3: null, training_date_4: null, detail: { legacyImport: true, source: 'internal_certificates' },
            });
          }
          const legacyNationalNames = (person.national_certificates || '').split(/[\n,;、]+/).map(v => v.trim()).filter(Boolean);
          legacyNationalNames.forEach(name => {
            const nationalKey = `${person.id}|NATIONAL|${name}`;
            if (personRecords.some(r => r.category === 'NATIONAL' && r.title.trim() === name) || migratedLegacyKeysRef.current.has(nationalKey)) return;
            pendingKeys.push(nationalKey);
            pending.push({
              user_id: person.id, category: 'NATIONAL', title: name,
              obtained_date: null, expiry_date: null, method: null, level: null, cert_no: null,
              sticker_no: null, education_completed: null, training_date_1: null, training_date_2: null,
              training_date_3: null, training_date_4: null, detail: { legacyImport: true, source: 'national_certificates' },
            });
          });
        });
        if (!pending.length) return;
        migrationInProgressRef.current = true;
        const { data, error } = await supabase.from('cert_records').insert(pending).select('*');
        if (error) throw error;
        pendingKeys.forEach(key => migratedLegacyKeysRef.current.add(key));
        if (data?.length) {
          setRecords(prev => {
            const keys = new Set(prev.map(r => `${r.user_id}|${r.category}|${r.title}`));
            return [...prev, ...(data as CertRecord[]).filter(r => !keys.has(`${r.user_id}|${r.category}|${r.title}`))];
          });
          notify('구성원정보에 저장된 기존 자격을 자격현황에 연동했습니다.');
        }
      } catch (e: any) {
        notify(`기존 자격 연동 실패: ${e?.message || '오류'}`, 'error');
      } finally {
        migrationInProgressRef.current = false;
      }
    };
    void migrateLegacyCertificates();
  }, [users, records, notify]);

  useEffect(() => {
    if (!eligibilityUserId) return;
    const matching = records.find(r => r.category === 'NDT' && r.user_id === eligibilityUserId &&
      r.method === eligibilityMethod &&
      (eligibilityMethod !== 'LT' || r.title === eligibilityLtType));
    const detail = matching?.detail || {};
    const selectedPerson = users.find(u => u.id === eligibilityUserId);
    setExperienceHours(String(careerHoursFromMember(selectedPerson?.career_start_date)));
    setTrainingHours(String(detail.trainingHours ?? 0));
    setMinimumExperienceHours(String(detail.minimumHours ?? 0));
    setLevel1ToLevel2Hours(String(detail.level1ToLevel2Hours ?? 0));
    setMassHours(String(detail.massSpectrometerHours ?? 0));
  }, [eligibilityUserId, eligibilityMethod, eligibilityLtType, records, users, careerHoursFromMember]);
  const visibleRecords = useMemo(() => records.filter(r => {
    if (r.category !== category) return false;
    if (selectedUserId !== 'ALL' && r.user_id !== selectedUserId) return false;
    const p = personById.get(r.user_id);
    const q = search.trim().toLowerCase();
    return !q || [p?.name, p?.id, r.title, r.method, r.level, r.cert_no, r.sticker_no].some(v => esc(v).toLowerCase().includes(q));
  }), [records, category, selectedUserId, search, personById]);

  const daysUntil = (d?: string|null) => d ? dayDiff(d) : null;
  const isSelfRecord = (r: CertRecord) => (!!currentUser?.id && currentUser.id === r.user_id) || (!!currentUser?.name && personById.get(r.user_id)?.name === currentUser.name);
  const canManageRecord = (r: CertRecord) => isAdmin || isSelfRecord(r);
  const canSeeRecordAlert = (r: CertRecord) => canManageRecord(r);
  useEffect(() => {
    const eligible = records.filter(r => {
      if (!canSeeRecordAlert(r)) return false;
      if (r.category === 'NATIONAL') return false;
      const warningDays = r.category === 'NDT' ? 30 : 40;
      const dates = r.category === 'YARD'
        ? [r.training_date_1, r.training_date_2, r.training_date_3, r.training_date_4, r.expiry_date]
        : [r.expiry_date];
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
  const openAdd = () => { setEditing(null); const ownId = currentUser?.id || users.find(u=>u.name===currentUser?.name)?.id || ''; setForm(blank(category, isAdmin ? (selectedUserId === 'ALL' ? (eligibilityUserId || users[0]?.id || '') : selectedUserId) : ownId)); setModalOpen(true); };
  const openEdit = (r: CertRecord) => { setEditing(r); setForm({...r, detail: r.detail || {}}); setModalOpen(true); };
  const updateForm = (key: string, value: any) => setForm(prev => ({...prev, [key]: value}));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.user_id) { notify('구성원을 선택해주세요.', 'warning'); return; }
    if (!isAdmin && form.user_id !== (currentUser?.id || users.find(u=>u.name===currentUser?.name)?.id)) { notify('본인 자격정보만 등록 또는 수정할 수 있습니다.', 'warning'); return; }
    if (!form.title?.trim()) { notify(category === 'YARD' ? '교육명을 입력해주세요.' : '자격종류 또는 Method를 입력해주세요.', 'warning'); return; }
    if (category === 'NDT' && (!form.method || !form.level)) { notify('Method와 Level을 선택해주세요.', 'warning'); return; }
    const payload: any = {
      user_id: form.user_id, category, title: form.title.trim(),
      obtained_date: form.obtained_date || null, expiry_date: form.expiry_date || null,
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
      setModalOpen(false); notify(editing ? '자격정보를 수정했습니다.' : '자격정보를 등록했습니다.');
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
    const list = visibleRecords;
    const rows: any[][] = [];
    let title = '';
    if (category === 'YARD') {
      title = 'YARD 자격 현황';
      rows.push([title], ['교육명','성명','사번','교육이수','스티커 번호','보수교육 1','보수교육 2','보수교육 3','보수교육 4']);
      list.forEach(r => rows.push([r.title, personById.get(r.user_id)?.name || '', r.user_id, r.education_completed || r.obtained_date || '', r.sticker_no || '', r.training_date_1 || '', r.training_date_2 || '', r.training_date_3 || '', r.training_date_4 || '']));
    } else if (category === 'NATIONAL') {
      title = '국가 자격 취득 현황';
      rows.push([title], ['성명','자격종류','METHOD','취득일']);
      list.forEach(r => rows.push([personById.get(r.user_id)?.name || '', r.title, r.method || '', r.obtained_date || '']));
    } else {
      title = '사내자격 취득 현황';
      rows.push([title], ['성명','경력(시간)','자격종류(Level)','Method','취득일','갱신일']);
      list.forEach(r => rows.push([personById.get(r.user_id)?.name || '', Number(r.detail?.careerHours || 0), `${r.level || ''}`, r.method === 'LT' ? `LT (${r.title})` : r.method || '', r.obtained_date || '', r.expiry_date || '']));
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!merges'] = [{s:{r:0,c:0}, e:{r:0,c:rows[1].length-1}}];
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

  const workingDaysToDate = (hours: number) => {
    if (!Number.isFinite(hours) || hours <= 0) return todayStr();
    const holidaySet = new Set(holidays.map(h => h.holiday_date));
    let remaining = Math.ceil(hours / 8), d = todayStr(), safety = 0;
    while (remaining > 0 && safety < 5000) {
      d = addDays(d, 1); safety++;
      const weekday = new Date(`${d}T12:00:00`).getDay();
      if (weekday !== 0 && weekday !== 6 && !holidaySet.has(d)) remaining--;
    }
    return d;
  };
  const requirement = useMemo(() => {
    const key = eligibilityMethod === 'LT' ? `LT:${eligibilityLtType}` : eligibilityMethod;
    const table: Record<string, {i:{training:number,min:number,total:number};ii:{training:number,min:number,total:number;afterI:number}}> = {
      PT: {i:{training:4,min:70,total:130}, ii:{training:8,min:140,total:270,afterI:270}},
      'LT:Bubble': {i:{training:2,min:3,total:15}, ii:{training:8,min:35,total:80,afterI:0}},
      'LT:Pressure change': {i:{training:24,min:105,total:200}, ii:{training:16,min:280,total:530,afterI:0}},
      'LT:Mass Spectrometer': {i:{training:40,min:280,total:530}, ii:{training:24,min:420,total:800,afterI:0}},
    };
    return table[key] || table.PT;
  }, [eligibilityMethod, eligibilityLtType]);
  const effectiveExperienceHours = eligibilityMethod === 'LT' && eligibilityLtType === 'Mass Spectrometer' ? Number(massHours || 0) : Number(experienceHours || 0);
  const remainingHours = Math.max(0, (eligibilityLevel === 'I' ? requirement.i.total : requirement.ii.total) - effectiveExperienceHours);
  const remainingTraining = Math.max(0, (eligibilityLevel === 'I' ? requirement.i.training : requirement.ii.training) - Number(trainingHours || 0));
  const remainingMinimum = Math.max(0, (eligibilityLevel === 'I' ? requirement.i.min : requirement.ii.min) - (eligibilityMethod === 'LT' && eligibilityLtType === 'Mass Spectrometer' ? Number(massHours || 0) : Number(minimumExperienceHours || 0)));
  const remainingAfterI = eligibilityLevel === 'II' ? Math.max(0, requirement.ii.afterI - Number(level1ToLevel2Hours || 0)) : 0;
  const totalRemaining = Math.max(remainingHours, remainingTraining, remainingMinimum, remainingAfterI);
  const eligibleDate = workingDaysToDate(totalRemaining);

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
    ? [r.training_date_1, r.training_date_2, r.training_date_3, r.training_date_4, r.expiry_date].filter(Boolean) as string[]
    : [r.expiry_date].filter(Boolean) as string[];

  return <div className="space-y-3 text-[#1F2937]">
    <div className="rounded-xl border border-[#E2E5E9] bg-white p-3 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><div className="rounded-lg bg-[#F5F6F8] p-2 text-[#243B5A]"><Award className="h-4 w-4"/></div><div><h2 className="text-sm font-bold">자격현황 관리</h2><p className="text-[11px] text-[#64748B]">구성원 명단과 연동 · 등록/수정/삭제 · Excel 출력</p></div></div>
        <div className="flex gap-2">
          <button onClick={exportExcel} className="flex items-center gap-1 rounded-lg border border-[#E2E5E9] bg-white px-3 py-2 text-xs font-bold text-[#243B5A]"><Download className="h-3.5 w-3.5"/> Excel 추출</button>
          {(isAdmin || currentUser?.id || currentUser?.name) && <button onClick={openAdd} className="flex items-center gap-1 rounded-lg bg-[#243B5A] px-3 py-2 text-xs font-bold text-white"><Plus className="h-3.5 w-3.5"/> 자격 등록</button>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 border-b border-[#E2E5E9] pb-2">
        {tabs.map(t => <button key={t.key} onClick={() => {setCategory(t.key);setSearch('');setSelectedUserId('ALL');}} className={`rounded-lg border px-3 py-2 text-xs font-bold ${category===t.key?'border-[#243B5A] bg-[#243B5A] text-white':'border-[#E2E5E9] bg-[#F5F6F8] text-[#64748B]'}`}>{t.label} ({records.filter(r=>r.category===t.key).length})</button>)}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input className={fieldClass} value={search} onChange={e=>setSearch(e.target.value)} placeholder="이름, 사번, 자격 검색"/>
        <select className={fieldClass} value={selectedUserId} onChange={e=>setSelectedUserId(e.target.value)}><option value="ALL">전체 구성원</option>{users.map(u=><option key={u.id} value={u.id}>{u.name} ({u.id})</option>)}</select>
        <div className="flex items-center text-[11px] text-[#64748B]">표시 {visibleRecords.length}건 · 알림은 YARD 40일, NDT 30일 전 (국가자격 알림 없음)</div>
      </div>
    </div>

    {loadError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{loadError}<p className="mt-1">아래 SQL 파일을 Supabase SQL Editor에서 1회 실행해주세요.</p><button onClick={()=>void load()} className="mt-2 rounded-lg bg-[#243B5A] px-3 py-1.5 text-white">다시 불러오기</button></div>}
    {loading ? <div className="rounded-xl border border-[#E2E5E9] bg-white p-10 text-center text-xs text-[#64748B]">자격현황을 불러오는 중...</div> : (
      <div className="space-y-2">
        {visibleRecords.map(r => {
          const p = personById.get(r.user_id); const isOpen = !!expanded[r.id];
          return <div key={r.id} className="overflow-hidden rounded-xl border border-[#E2E5E9] bg-white shadow-xs">
            <button onClick={()=>setExpanded(prev=>({...prev,[r.id]:!prev[r.id]}))} className="flex w-full items-center justify-between gap-2 bg-[#F5F6F8] p-3 text-left">
              <span className="flex min-w-0 items-center gap-2">{isOpen?<ChevronDown className="h-4 w-4 text-[#243B5A]"/>:<ChevronRight className="h-4 w-4 text-[#243B5A]"/>}<span className="truncate text-xs font-bold">{p?.name || r.user_id} · {r.title}{r.method ? ` / ${r.method}` : ''}{r.level ? ` ${r.level}` : ''}</span></span>
              <span className="shrink-0 text-[10px] text-[#64748B]">{r.obtained_date || '취득일 미입력'} {r.expiry_date ? ` · 유효 ${r.expiry_date}` : ''}</span>
            </button>
            {isOpen && <div className="space-y-3 p-3">
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div className="rounded-lg bg-[#F5F6F8] p-2"><span className="block text-[10px] text-[#64748B]">성명 / 사번</span><b>{p?.name || '-'} / {r.user_id}</b></div>
                <div className="rounded-lg bg-[#F5F6F8] p-2"><span className="block text-[10px] text-[#64748B]">취득/교육일</span><b>{r.obtained_date || r.education_completed || '-'}</b></div>
                <div className="rounded-lg bg-[#F5F6F8] p-2"><span className="block text-[10px] text-[#64748B]">유효기간</span><b>{dateLabel(r.expiry_date)}</b></div>
                <div className="rounded-lg bg-[#F5F6F8] p-2"><span className="block text-[10px] text-[#64748B]">Cert' No / 스티커</span><b>{r.cert_no || r.sticker_no || '-'}</b></div>
              </div>
              {r.category==='YARD' && <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">{[r.training_date_1,r.training_date_2,r.training_date_3,r.training_date_4].map((d,i)=><div key={i} className="rounded-lg border border-[#E2E5E9] p-2">보수교육 {i+1}<b className="mt-1 block">{dateLabel(d)}</b></div>)}</div>}
              {r.category==='NDT' && <div className="rounded-lg border border-[#E2E5E9] p-2 text-xs">경력 {r.detail?.careerHours ?? 0}시간 · 교육 {r.detail?.trainingHours ?? 0}시간 · 최소시간 {r.detail?.minimumHours ?? 0}시간</div>}
              {canManageRecord(r) && <div className="flex justify-end gap-2"><button onClick={()=>openEdit(r)} className="flex items-center gap-1 rounded-lg border border-[#E2E5E9] px-3 py-1.5 text-xs font-bold text-[#243B5A]"><Edit3 className="h-3 w-3"/> 수정</button><button onClick={()=>void remove(r)} className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600"><Trash2 className="h-3 w-3"/> 삭제</button></div>}
            </div>}
          </div>;
        })}
        {visibleRecords.length===0 && <div className="rounded-xl border border-[#E2E5E9] bg-white p-10 text-center text-xs text-[#64748B]">등록된 자격정보가 없습니다. 자격 등록을 눌러 추가해주세요.</div>}
      </div>
    )}

    <div className="rounded-xl border border-[#E2E5E9] bg-white p-3 shadow-xs space-y-3">
      <div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-[#243B5A]"/><h3 className="text-sm font-bold">NDT Level II 취득 가능일 계산</h3></div>
      <p className="text-[11px] text-[#64748B]">구성원정보의 총 경력 시작일부터 주 5일·하루 8시간으로 환산하며, 토·일요일과 cert_holidays에 등록된 법정·대체공휴일을 제외합니다. Mass Spectrometer 검사시간은 별도 입력합니다.</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <select className={fieldClass} value={eligibilityUserId} onChange={e=>setEligibilityUserId(e.target.value)}><option value="">대상 구성원 선택</option>{users.map(u=><option key={u.id} value={u.id}>{u.name} ({u.id})</option>)}</select>
        <select className={fieldClass} value={eligibilityMethod} onChange={e=>setEligibilityMethod(e.target.value)}>{['PT','LT'].map(m=><option key={m}>{m}</option>)}</select>
        {eligibilityMethod==='LT' && <select className={fieldClass} value={eligibilityLtType} onChange={e=>setEligibilityLtType(e.target.value)}>{LT_TYPES.map(m=><option key={m}>{m}</option>)}</select>}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="text-[11px] text-[#64748B]">구성원정보 총 경력 환산(시간)<input type="number" min="0" className={fieldClass} value={experienceHours} readOnly title="구성원정보의 총 경력 시작일을 기준으로 주 5일·하루 8시간 환산"/></label>
        <label className="text-[11px] text-[#64748B]">교육시간<input type="number" min="0" className={fieldClass} value={trainingHours} onChange={e=>setTrainingHours(e.target.value)}/></label>
        <label className="text-[11px] text-[#64748B]">최소 요구시간 누적<input type="number" min="0" className={fieldClass} value={minimumExperienceHours} onChange={e=>setMinimumExperienceHours(e.target.value)}/></label>
        <label className="text-[11px] text-[#64748B]">Level I 후 Level II 인정시간(PT 기준 270h)<input type="number" min="0" className={fieldClass} value={level1ToLevel2Hours} onChange={e=>setLevel1ToLevel2Hours(e.target.value)}/></label>
        {eligibilityMethod==='LT' && eligibilityLtType==='Mass Spectrometer' && <label className="text-[11px] text-[#64748B]">Mass Spectrometer 누적 검사시간(별도 입력)<input type="number" min="0" className={fieldClass} value={massHours} onChange={e=>setMassHours(e.target.value)}/></label>}
      </div>
      <div className="rounded-xl border border-[#D5DEE9] bg-[#F5F6F8] p-3">
        <div className="text-xs font-bold text-[#243B5A]">선택 인원: {users.find(u=>u.id===eligibilityUserId)?.name || '미선택'} · {eligibilityMethod}{eligibilityMethod==='LT'?` (${eligibilityLtType})`:''} Level II</div>
        <div className="mt-1 text-sm font-extrabold">예상 취득 가능일: {eligibleDate}</div>
        <div className="mt-1 text-[11px] text-[#64748B]">필요 잔여시간 약 {totalRemaining}시간 / 주 40시간 기준 약 {Math.ceil(totalRemaining/40)}주. 정확한 계산을 위해 현재시간과 Level I 후 별도 인정시간을 확인하세요.</div>
      </div>
      <details className="rounded-lg border border-[#E2E5E9] p-3">
        <summary className="cursor-pointer text-xs font-bold text-[#243B5A]">법정공휴일 / 대체공휴일 관리 ({holidays.length}일)</summary>
        <p className="mt-2 text-[10px] text-[#64748B]">토·일요일은 자동 제외됩니다. 공휴일은 매년 공식 달력 기준으로 등록해야 계산에 반영됩니다.</p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input type="date" className={fieldClass} value={holidayDate} onChange={e=>setHolidayDate(e.target.value)}/>
          <input className={fieldClass} value={holidayName} onChange={e=>setHolidayName(e.target.value)} placeholder="공휴일 명칭"/>
          <button type="button" disabled={holidayBusy} onClick={()=>void addHoliday()} className="rounded-lg bg-[#243B5A] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{holidayBusy?'저장 중':'공휴일 등록'}</button>
        </div>
        {holidays.length>0 && <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">{holidays.map(h=><div key={h.holiday_date} className="flex items-center justify-between rounded bg-[#F5F6F8] px-2 py-1 text-[11px]"><span>{h.holiday_date} · {h.name}</span><button type="button" onClick={()=>void removeHoliday(h)} className="font-bold text-red-600">삭제</button></div>)}</div>}
      </details>
    </div>

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
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="text-[11px] font-bold text-[#64748B]">구성원 *<select className={fieldClass} value={form.user_id||''} onChange={e=>updateForm('user_id',e.target.value)} required><option value="">선택</option>{users.filter(u=>isAdmin || u.id===(currentUser?.id || users.find(x=>x.name===currentUser?.name)?.id)).map(u=><option key={u.id} value={u.id}>{u.name} ({u.id})</option>)}</select></label>
          {category==='YARD' && <>
            <label className="text-[11px] font-bold text-[#64748B]">교육명 *<input className={fieldClass} value={form.title||''} onChange={e=>updateForm('title',e.target.value)} required/></label>
            <label className="text-[11px] font-bold text-[#64748B]">교육이수일<input type="date" className={fieldClass} value={form.education_completed||''} onChange={e=>updateForm('education_completed',e.target.value)}/></label>
            <label className="text-[11px] font-bold text-[#64748B]">스티커 번호<input className={fieldClass} value={form.sticker_no||''} onChange={e=>updateForm('sticker_no',e.target.value)}/></label>
            {[1,2,3,4].map(n=><label key={n} className="text-[11px] font-bold text-[#64748B]">보수교육 {n}<input type="date" className={fieldClass} value={(form as any)[`training_date_${n}`]||''} onChange={e=>updateForm(`training_date_${n}`,e.target.value)}/></label>)}
            <label className="text-[11px] font-bold text-[#64748B]">유효기간<input type="date" className={fieldClass} value={form.expiry_date||''} onChange={e=>updateForm('expiry_date',e.target.value)}/></label>
          </>}
          {category==='NATIONAL' && <>
            <label className="text-[11px] font-bold text-[#64748B]">자격종류 / 자격명 *<input list="national-cert-types" className={fieldClass} value={form.title||''} onChange={e=>updateForm('title',e.target.value)} placeholder="기능사 / 산업기사 / 기사 또는 자격명" required/><datalist id="national-cert-types"><option value="기능사"/><option value="산업기사"/><option value="기사"/></datalist></label>
            <label className="text-[11px] font-bold text-[#64748B]">METHOD<input className={fieldClass} value={form.method||''} onChange={e=>updateForm('method',e.target.value)}/></label>
            <label className="text-[11px] font-bold text-[#64748B]">취득일<input type="date" className={fieldClass} value={form.obtained_date||''} onChange={e=>updateForm('obtained_date',e.target.value)}/></label>
            <label className="text-[11px] font-bold text-[#64748B]">유효기간<input type="date" className={fieldClass} value={form.expiry_date||''} onChange={e=>updateForm('expiry_date',e.target.value)}/></label>
          </>}
          {category==='NDT' && <>
            <label className="text-[11px] font-bold text-[#64748B]">Method *<select className={fieldClass} value={form.method||''} onChange={e=>{updateForm('method',e.target.value); if(e.target.value==='LT') updateForm('title','Bubble'); else updateForm('title',e.target.value);}} required><option value="">선택</option><option>PT</option><option>LT</option></select></label>
            {form.method==='LT' && <label className="text-[11px] font-bold text-[#64748B]">LT 종류 *<select className={fieldClass} value={form.title||'Bubble'} onChange={e=>updateForm('title',e.target.value)}>{LT_TYPES.map(m=><option key={m}>{m}</option>)}</select></label>}
            <label className="text-[11px] font-bold text-[#64748B]">Level *<select className={fieldClass} value={form.level||''} onChange={e=>updateForm('level',e.target.value)} required><option value="">선택</option><option value="Level I">Level I</option><option value="Level II">Level II</option></select></label>
            <label className="text-[11px] font-bold text-[#64748B]">취득일<input type="date" className={fieldClass} value={form.obtained_date||''} onChange={e=>updateForm('obtained_date',e.target.value)}/></label>
            <label className="text-[11px] font-bold text-[#64748B]">유효일자 / 갱신일<input type="date" className={fieldClass} value={form.expiry_date||''} onChange={e=>updateForm('expiry_date',e.target.value)}/></label>
            <label className="text-[11px] font-bold text-[#64748B]">Cert' No<input className={fieldClass} value={form.cert_no||''} onChange={e=>updateForm('cert_no',e.target.value)}/></label>
            {(['careerHours','trainingHours','minimumHours','level1ToLevel2Hours','massSpectrometerHours'] as const).map((key,i)=><label key={key} className="text-[11px] font-bold text-[#64748B]">{['기존 경력/검사시간 메모(계산은 구성원정보 기준)','교육시간 누적','최소시간 누적(인정시간)','Level I 후 Level II 별도시간','Mass Spectrometer 누적 검사시간'][i]}<input type="number" min="0" className={fieldClass} value={form.detail?.[key] ?? 0} onChange={e=>updateForm('detail',{...(form.detail||{}),[key]:Number(e.target.value)})}/></label>)}
          </>}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#E2E5E9] pt-3"><button type="button" onClick={()=>setModalOpen(false)} className="rounded-lg border border-[#E2E5E9] px-3 py-2 text-xs font-bold">취소</button><button type="submit" className="rounded-lg bg-[#243B5A] px-4 py-2 text-xs font-bold text-white">저장</button></div>
      </form>
    </div>}
    {notice && <div className="fixed right-4 top-4 z-[150] w-[min(92vw,420px)]"><div className={`rounded-xl border bg-white p-3 text-xs font-bold shadow-xl ${notice.type==='error'?'border-red-200 text-red-700':notice.type==='warning'?'border-amber-200 text-amber-700':'border-[#D5DEE9] text-[#243B5A]'}`}>{notice.message}</div></div>}
  </div>;
}
