'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ChevronDown, ChevronRight, Plus, Edit3, Trash2, X, Download, Award, AlertTriangle, Settings } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';

type Person = {
  id: string; name: string; department?: string; position?: string;
  career_start_date?: string; experience?: string; role?: string;
  yard_certificates?: string; national_certificates?: string; internal_certificates?: string;
  cert_assignments?: Record<string, { level?: string; cert_no?: string; cert_type?: string }>;
  national_cert_list?: Array<{ method: string; grade: string; cert_no: string }>;
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
const METHODS = ['PT', 'LT', 'RT', 'UT', 'MT', 'VT'];
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
const addYears = (date: string, years: number) => {
  if (!date) return '';
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setFullYear(d.getFullYear() + years);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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
  const legacyNationalImportedRef = useRef<Set<string>>(new Set());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState<{type:'success'|'error'|'warning'; message:string}|null>(null);
  
  const [yardSubTab, setYardSubTab] = useState<string>('ALL');
  const [nationalSubTab, setNationalSubTab] = useState<string>('ALL');
  const [ndtSubTab, setNdtSubTab] = useState<string>('ALL');
  const [isSubTabCollapsed, setIsSubTabCollapsed] = useState<boolean>(true);

  const [selectedUserId, setSelectedUserId] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CertRecord|null>(null);
  const [form, setForm] = useState<Partial<CertRecord>>(blank('YARD'));
  const [search, setSearch] = useState('');
  const autoNdtSyncRef = useRef<Set<string>>(new Set());

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

  // 복원된 NDT 자동 레벨 판정을 위한 정밀 경력 시간 계산 로직
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

  const autoNdtLevelFor = useCallback((userId: string, method?: string | null, title?: string | null, certType?: string | null): 'Level I' | 'Level II' | null => {
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

  const yardSubTabs = useMemo(() => {
    const list = records.filter(r => r.category === 'YARD');
    return Array.from(new Set(list.map(r => r.title).filter(Boolean)));
  }, [records]);

  const nationalSubTabs = ['기능사', '산업기사', '기사', '기술사', '기타'];
  const ndtSubTabs = ['Level I', 'Level II', 'Level III', 'ASNT/ISO'];

  const visibleRecords = useMemo(() => {
    return records.filter(r => {
      if (r.category !== category) return false;
      if (selectedUserId !== 'ALL' && r.user_id !== selectedUserId) return false;
      
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

  const groupedRows = useMemo(() => {
    const map = new Map<string, { person: Person; items: CertRecord[] }>();
    users.forEach(u => {
      if (selectedUserId !== 'ALL' && u.id !== selectedUserId) return;
      map.set(u.id, { person: u, items: [] });
    });
    visibleRecords.forEach(r => {
      if (!map.has(r.user_id)) {
        const p = personById.get(r.user_id);
        if (p) map.set(r.user_id, { person: p, items: [] });
      }
      map.get(r.user_id)?.items.push(r);
    });
    return Array.from(map.values()).filter(group => {
      const q = search.trim().toLowerCase();
      if (!q) return group.items.length > 0 || selectedUserId !== 'ALL';
      return group.items.length > 0 || group.person.name.toLowerCase().includes(q) || group.person.id.toLowerCase().includes(q);
    });
  }, [users, visibleRecords, selectedUserId, search, personById]);

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

  const openAdd = () => { 
    setEditing(null); 
    const ownId = currentUser?.id || users.find(u=>u.name===currentUser?.name)?.id || ''; 
    setForm(blank(category, isAdmin ? (selectedUserId === 'ALL' ? (users[0]?.id || '') : selectedUserId) : ownId)); 
    setModalOpen(true); 
  };
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
    if (!isAdmin && form.user_id !== (currentUser?.id || users.find(u=>u.name===currentUser?.name)?.id)) { notify('본인 자격정보 또는 관리자만 등록할 수 있습니다.', 'warning'); return; }
    if (!form.title?.trim()) { notify('자격 내용을 입력해주세요.', 'warning'); return; }
    
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
        if (person) {
          const updatedPersonRecords = nextRecords.filter(x => x.user_id === person.id);
          onUsersChanged?.([{
            id: person.id,
            ...(category === 'YARD' ? { yard_certificates: updatedPersonRecords.filter(x=>x.category==='YARD').map(x=>x.title).filter(Boolean).join(', ') } : {}),
            ...(category === 'NATIONAL' ? {
              national_certificates: updatedPersonRecords.filter(x=>x.category==='NATIONAL').map(x=>`${x.method ? `${x.method} ` : ''}${x.title || ''}`.trim()).filter(Boolean).join(', '),
              national_cert_list: updatedPersonRecords.filter(x=>x.category==='NATIONAL').map(x=>({ method: x.method || '', grade: x.title || '기사', cert_no: x.cert_no || '' }))
            } : {}),
            ...(category === 'NDT' ? { cert_assignments: { ...(person.cert_assignments||{}), [data.method || '']: { level: data.level || '', cert_no: data.cert_no || '', cert_type: data.cert_type || '사내발급' } } } : {}),
          }]);
        }
        setModalOpen(false); notify('자격정보를 수정했습니다.');
      } else {
        const {data,error} = await supabase.from('cert_records').insert(payload).select('*').single();
        if (error) throw error;
        const nextRecords = [...records, data as CertRecord];
        setRecords(nextRecords);
        const person = personById.get(form.user_id);
        if (person) {
          const updatedPersonRecords = nextRecords.filter(x => x.user_id === person.id);
          onUsersChanged?.([{
            id: person.id,
            ...(category === 'YARD' ? { yard_certificates: updatedPersonRecords.filter(x=>x.category==='YARD').map(x=>x.title).filter(Boolean).join(', ') } : {}),
            ...(category === 'NATIONAL' ? {
              national_certificates: updatedPersonRecords.filter(x=>x.category==='NATIONAL').map(x=>`${x.method ? `${x.method} ` : ''}${x.title || ''}`.trim()).filter(Boolean).join(', '),
              national_cert_list: updatedPersonRecords.filter(x=>x.category==='NATIONAL').map(x=>({ method: x.method || '', grade: x.title || '기사', cert_no: x.cert_no || '' }))
            } : {}),
            ...(category === 'NDT' ? { cert_assignments: { ...(person.cert_assignments||{}), [data.method || '']: { level: data.level || '', cert_no: data.cert_no || '', cert_type: data.cert_type || '사내발급' } } } : {}),
          }]);
        }
        setModalOpen(false); notify('저장했습니다.');
      }
    } catch (e: any) { notify(`저장 실패: ${e?.message || '오류'}`, 'error'); }
  };

  const remove = async (r: CertRecord) => {
    if (!canManageRecord(r)) { notify('권한이 없습니다.', 'warning'); return; }
    if (!window.confirm(`선택한 자격정보를 삭제할까요?`)) return;
    const {error} = await supabase.from('cert_records').delete().eq('id', r.id);
    if (error) { notify(`삭제 실패: ${error.message}`, 'error'); return; }
    const nextRecords = records.filter(x => x.id !== r.id);
    setRecords(nextRecords);
    const person = personById.get(r.user_id);
    if (person) {
      const updatedPersonRecords = nextRecords.filter(x => x.user_id === person.id);
      onUsersChanged?.([{
        id: person.id,
        ...(r.category === 'YARD' ? { yard_certificates: updatedPersonRecords.filter(x=>x.category==='YARD').map(x=>x.title).filter(Boolean).join(', ') } : {}),
        ...(r.category === 'NATIONAL' ? {
          national_certificates: updatedPersonRecords.filter(x=>x.category==='NATIONAL').map(x=>`${x.method ? `${x.method} ` : ''}${x.title || ''}`.trim()).filter(Boolean).join(', '),
          national_cert_list: updatedPersonRecords.filter(x=>x.category==='NATIONAL').map(x=>({ method: x.method || '', grade: x.title || '기사', cert_no: x.cert_no || '' }))
        } : {}),
        ...(r.category === 'NDT' ? { cert_assignments: { ...(person.cert_assignments||{}), [r.method || '']: { level: '', cert_no: '' } } } : {}),
      }]);
    }
    notify('자격정보를 삭제했습니다.');
  };

  const exportExcel = () => {
    if (!isAdmin) { notify('엑셀 추출은 관리자 계정만 사용할 수 있습니다.', 'warning'); return; }
    const wb = XLSX.utils.book_new();
    const rows: any[][] = [['자격현황 내역'], ['성명', '사번', '구분', '상세 내용']];
    records.forEach(r => {
      const p = personById.get(r.user_id);
      rows.push([p?.name || '', r.user_id, r.category, `${r.method ? `[${r.method}] ` : ''}${r.title} ${r.level || ''}`]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, '자격현황');
    XLSX.writeFile(wb, `자격현황_${todayStr()}.xlsx`);
  };

  const tabs: {key:Category; label:string}[] = [
    {key:'YARD', label:'YARD 자격'}, {key:'NATIONAL', label:'국가자격'}, {key:'NDT', label:'사내자격(NDT Level)'},
  ];

  return <div className="space-y-3 text-[#1F2937]">
    <div className="rounded-xl border border-[#E2E5E9] bg-white p-3 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-[#F5F6F8] p-2 text-[#243B5A]"><Award className="h-4 w-4"/></div>
          <div><h2 className="text-sm font-bold">자격현황 관리</h2><p className="text-[11px] text-[#64748B]">자격 목록 및 유효일자 관리</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && <button onClick={exportExcel} className="flex items-center gap-1 rounded-lg border border-[#E2E5E9] bg-white px-3 py-2 text-xs font-bold text-[#243B5A]"><Download className="h-3.5 w-3.5"/> Excel 추출</button>}
          {(isAdmin || currentUser?.id || currentUser?.name) && (
            <button onClick={openAdd} className="flex items-center gap-1 rounded-lg bg-[#243B5A] px-3 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1d3049] transition">
              <Plus className="h-3.5 w-3.5"/> 자격 등록
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-b border-[#E2E5E9] pb-2">
        {tabs.map(t => <button key={t.key} onClick={() => {setCategory(t.key);setSearch('');setSelectedUserId('ALL');}} className={`rounded-lg border px-3 py-2 text-xs font-bold ${category===t.key?'border-[#243B5A] bg-[#243B5A] text-white':'border-[#E2E5E9] bg-[#F5F6F8] text-[#64748B]'}`}>{t.label} ({records.filter(r=>r.category===t.key).length})</button>)}
      </div>

      <div className="mt-2.5 bg-[#F8FAFC] p-2 rounded-lg border border-[#E2E5E9]">
        <div className="flex items-center justify-between">
          <button 
            type="button" 
            onClick={() => setIsSubTabCollapsed(!isSubTabCollapsed)}
            className="flex items-center gap-1 text-[11px] font-bold text-[#243B5A] hover:underline"
          >
            {isSubTabCollapsed ? <ChevronRight className="h-3.5 w-3.5"/> : <ChevronDown className="h-3.5 w-3.5"/>}
            <span>세부 필터 서브탭 {isSubTabCollapsed ? '(접힘)' : '(펼쳐짐)'}</span>
          </button>
          
          {isAdmin && (
            <button 
              type="button" 
              onClick={() => notify('관리자 전용 서브탭 설정 기능입니다.', 'success')}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-[#64748B] bg-white border border-[#E2E5E9] rounded hover:bg-[#F5F6F8]"
              title="서브탭 설정 (관리자 전용)"
            >
              <Settings className="h-3 w-3"/> 설정
            </button>
          )}
        </div>

        {!isSubTabCollapsed && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#E2E5E9]">
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
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input className={fieldClass} value={search} onChange={e=>setSearch(e.target.value)} placeholder="이름, 사번, 자격 검색"/>
        <select className={fieldClass} value={selectedUserId} onChange={e=>setSelectedUserId(e.target.value)}>
          <option value="ALL">구성원 선택 검색</option>
          {users.map(u=><option key={u.id} value={u.id}>{u.name} ({u.id})</option>)}
        </select>
      </div>
    </div>

    {loadError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{loadError}</div>}
    
    {loading ? <div className="rounded-xl border border-[#E2E5E9] bg-white p-10 text-center text-xs text-[#64748B]">자격현황을 불러오는 중...</div> : (
      <div className="bg-white rounded-xl border border-[#E2E5E9] p-3 shadow-xs overflow-x-auto">
        <div className="text-xs font-bold text-[#243B5A] mb-2">
          {category === 'YARD' ? 'YARD 자격 현황' : category === 'NATIONAL' ? '국가자격 현황' : '사내자격(NDT Level) 현황'} (총 {groupedRows.length}명)
        </div>

        {groupedRows.length === 0 ? (
          <div className="text-center py-8 text-xs text-[#64748B]">조건에 해당하는 자격 현황이 없습니다.</div>
        ) : (
          <table className="w-full text-left text-xs min-w-[650px]">
            <thead className="bg-[#F5F6F8] border-b border-[#E2E5E9] text-[#64748B]">
              <tr>
                <th className="p-2.5 w-36">성명 (사번)</th>
                <th className="p-2.5">보유 자격 내역 (한 행 표기)</th>
                <th className="p-2.5 text-center w-24">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E5E9]">
              {groupedRows.map(({ person, items }) => {
                return (
                  <tr key={person.id} className="hover:bg-[#F5F6F8]/50">
                    <td className="p-2.5 font-bold align-top">
                      <div>{person.name}</div>
                      <div className="text-[10px] text-[#64748B] font-mono">({person.id})</div>
                    </td>
                    <td className="p-2.5 align-top">
                      {items.length === 0 ? (
                        <span className="text-[#94A3B8]">-</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {items.map(r => {
                            const expiry = expiryForRecord(r);
                            const label = category === 'NATIONAL' 
                              ? `${r.method ? `${r.method} ` : ''}${r.title || ''}`.trim()
                              : category === 'NDT'
                              ? `${r.method === 'LT' ? `LT (${r.title})` : r.method} ${r.level || ''} (${r.cert_type || '사내발급'})`
                              : `${r.title}${r.education_completed ? ` [취득: ${r.education_completed}]` : ''}`;
                            
                            return (
                              <span key={r.id} className="inline-flex items-center gap-1 bg-[#F5F6F8] border border-[#E2E5E9] px-2 py-1 rounded text-[11px] font-medium">
                                <span className="font-bold text-[#243B5A]">{label}</span>
                                {expiry && <span className="text-[10px] text-[#64748B]">(유효: {expiry})</span>}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td className="p-2.5 text-center align-top">
                      {items.length > 0 && (
                        <div className="flex flex-col gap-1 items-center">
                          {items.map(r => canManageRecord(r) && (
                            <div key={r.id} className="flex items-center gap-1">
                              <button onClick={()=>openEdit(r)} className="p-1 text-[#243B5A] border border-[#E2E5E9] rounded hover:bg-slate-50" title="수정"><Edit3 className="h-3 w-3"/></button>
                              <button onClick={()=>void remove(r)} className="p-1 text-red-600 border border-red-200 rounded hover:bg-red-50" title="삭제"><Trash2 className="h-3 w-3"/></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    )}

    {modalOpen && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 p-3">
      <form onSubmit={save} className="max-h-[92vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-xl border border-[#E2E5E9] bg-white p-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E2E5E9] pb-2">
          <h3 className="text-sm font-bold">{editing?'자격정보 수정':`${tabs.find(t=>t.key===category)?.label} 등록`}</h3>
          <button type="button" onClick={()=>setModalOpen(false)}><X className="h-4 w-4"/></button>
        </div>
        
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="text-[11px] font-bold text-[#64748B]">구성원 *
            <select className={fieldClass} value={form.user_id||''} onChange={e=>updateForm('user_id',e.target.value)} required>
              <option value="">선택</option>
              {users.map(u=><option key={u.id} value={u.id}>{u.name} ({u.id})</option>)}
            </select>
          </label>
          
          {category==='YARD' && <>
            <label className="text-[11px] font-bold text-[#64748B]">교육명 *<input className={fieldClass} value={form.title||''} onChange={e=>updateForm('title',e.target.value)} required/></label>
            <label className="text-[11px] font-bold text-[#64748B]">취득/교육이수일<input type="date" className={fieldClass} value={form.education_completed||form.obtained_date||''} onChange={e=>{updateForm('education_completed',e.target.value);updateForm('obtained_date',e.target.value);}}/></label>
            <label className="text-[11px] font-bold text-[#64748B]">스티커 번호<input className={fieldClass} value={form.sticker_no||''} onChange={e=>updateForm('sticker_no',e.target.value)}/></label>
            {[1,2,3,4].map(n=><label key={n} className="text-[11px] font-bold text-[#64748B]">보수교육 {n}<input type="date" className={fieldClass} value={(form as any)[`training_date_${n}`]||''} onChange={e=>updateForm(`training_date_${n}`,e.target.value)}/></label>)}
          </>}

          {category==='NATIONAL' && <>
            <label className="text-[11px] font-bold text-[#64748B]">종목 (METHOD) *<input className={fieldClass} value={form.method||''} onChange={e=>updateForm('method',e.target.value)} placeholder="예: 용접, 전기 등 직접 입력" required/></label>
            <label className="text-[11px] font-bold text-[#64748B]">자격종류 *
              <select className={fieldClass} value={form.title||''} onChange={e=>updateForm('title',e.target.value)} required>
                <option value="">선택</option>
                <option value="기능사">기능사</option>
                <option value="산업기사">산업기사</option>
                <option value="기사">기사</option>
                <option value="기술사">기술사</option>
                <option value="기타">기타</option>
              </select>
            </label>
            <label className="text-[11px] font-bold text-[#64748B]">자격증 번호<input className={fieldClass} value={form.cert_no||''} onChange={e=>updateForm('cert_no',e.target.value)}/></label>
            <label className="text-[11px] font-bold text-[#64748B]">취득일<input type="date" className={fieldClass} value={form.obtained_date||''} onChange={e=>updateForm('obtained_date',e.target.value)}/></label>
          </>}

          {category==='NDT' && <>
            <label className="text-[11px] font-bold text-[#64748B]">발급구분 *
              <select className={fieldClass} value={form.cert_type || '사내발급'} onChange={e=>updateForm('cert_type',e.target.value)}>
                <option value="사내발급">사내발급</option>
                <option value="ASNT/ISO">ASNT/ISO</option>
              </select>
            </label>
            <label className="text-[11px] font-bold text-[#64748B]">종목 (METHOD) *
              <select className={fieldClass} value={form.method||''} onChange={e=>{updateForm('method',e.target.value); if(e.target.value==='LT') updateForm('title','Bubble'); else updateForm('title',e.target.value);}} required>
                <option value="">선택</option>
                <option value="PT">PT</option>
                <option value="LT">LT</option>
                <option value="RT">RT</option>
                <option value="UT">UT</option>
                <option value="MT">MT</option>
                <option value="VT">VT</option>
              </select>
            </label>
            {form.method==='LT' && <label className="text-[11px] font-bold text-[#64748B]">LT 종류 *<select className={fieldClass} value={form.title||'Bubble'} onChange={e=>updateForm('title',e.target.value)}>{LT_TYPES.map(m=><option key={m}>{m}</option>)}</select></label>}
            <label className="text-[11px] font-bold text-[#64748B]">Level *
              <select className={fieldClass} value={form.level||''} onChange={e=>updateForm('level',e.target.value)} required>
                <option value="">선택</option>
                <option value="Level I">Level I</option>
                <option value="Level II">Level II</option>
                <option value="Level III">Level III</option>
              </select>
            </label>
            <label className="text-[11px] font-bold text-[#64748B]">취득일<input type="date" className={fieldClass} value={form.obtained_date||''} onChange={e=>updateForm('obtained_date',e.target.value)}/></label>
            <label className="text-[11px] font-bold text-[#64748B]">Cert' No<input className={fieldClass} value={form.cert_no||''} onChange={e=>updateForm('cert_no',e.target.value)}/></label>
            <p className="sm:col-span-2 text-[10px] text-[#64748B]">사내발급 선택 시 경력시간에 따른 Level 자동 판정이 적용되며, ASNT/ISO 선택 시 경력시간 판정에서 제외됩니다.</p>
          </>}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#E2E5E9] pt-3">
          <button type="button" onClick={()=>setModalOpen(false)} className="rounded-lg border border-[#E2E5E9] px-3 py-2 text-xs font-bold">취소</button>
          <button type="submit" className="rounded-lg bg-[#243B5A] px-4 py-2 text-xs font-bold text-white">저장</button>
        </div>
      </form>
    </div>}

    {notice && <div className="fixed right-4 top-4 z-[150] w-[min(92vw,420px)]"><div className={`rounded-xl border bg-white p-3 text-xs font-bold shadow-xl ${notice.type==='error'?'border-red-200 text-red-700':notice.type==='warning'?'border-amber-200 text-amber-700':'border-[#D5DEE9] text-[#243B5A]'}`}>{notice.message}</div></div>}
  </div>;
}
