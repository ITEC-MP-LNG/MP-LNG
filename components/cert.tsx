'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ChevronDown, ChevronRight, Plus, Edit3, Trash2, X, Download, Award, AlertTriangle, Search, RefreshCw } from 'lucide-react';
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
  cert_no: string | null;
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
  const [category, setCategory] = useState<Category>('YARD');
  const [subTab, setSubTab] = useState('ALL');
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const notify = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'success') => setNotice({ message, type }), []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      // HRManagement의 자격 상세를 읽기만 합니다. 이 컴포넌트에서는 app_users를 수정하지 않습니다.
      const [personResult, recordResult] = await Promise.all([
        supabase.from('app_users').select('id, name, department, position, experience, career_start_date, role, national_cert_details, yard_cert_details, ndt_certificates').order('name', { ascending: true }),
        supabase.from('cert_management_records').select('*').order('category').order('title'),
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

      let rows = (recordResult.data || []) as CertRecord[];
      const bySourceKey = new Map(rows.filter(r => r.source_key).map(r => [String(r.source_key), r]));
      const inserts: any[] = [];
      const updates: Array<{ id: string; values: any }> = [];
      const sourceSnapshot = (category: Category, personId: string, index: number, payload: any) => JSON.stringify({ category, personId, index, payload });
      const makeSourceRecord = (person: Person, cat: Category, index: number, payload: any) => {
        const sourceKey = `${cat}:${person.id}:${index}`;
        const snapshot = sourceSnapshot(cat, person.id, index, payload);
        const base = {
          user_id: person.id, category: cat, source_key: sourceKey,
          title: '', obtained_date: null, expiry_date: null, method: null, level: null,
          cert_no: null, sticker_no: null, education_completed: null,
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
        return { ...base, title: text(payload.subject).trim() || 'NDT', method: text(payload.issuer).trim() || null,
          level: text(payload.level).trim() || null, obtained_date: text(payload.issue_date) || null,
          expiry_date: text(payload.expiry_date) || (text(payload.issue_date) ? addYears(text(payload.issue_date), 5) : null),
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
            const existing = bySourceKey.get(candidate.source_key);
            if (!existing) {
              inserts.push(candidate);
            } else if (existing.detail?.source === 'hrmanagement' && !existing.detail?.localModified && existing.detail?.sourceSnapshot !== candidate.detail.sourceSnapshot) {
              updates.push({ id: existing.id, values: { ...candidate, detail: { ...candidate.detail, localModified: false } } });
            }
          });
        }
      }
      if (inserts.length) {
        const { data, error } = await supabase.from('cert_management_records').insert(inserts).select('*');
        if (error) throw new Error(`HRManagement 자격 가져오기 실패: ${error.message}`);
        rows = [...rows, ...((data || []) as CertRecord[])];
      }
      for (const update of updates) {
        const { error } = await supabase.from('cert_management_records').update(update.values).eq('id', update.id);
        if (error) throw new Error(`부모 자격 변경 반영 실패: ${error.message}`);
        rows = rows.map(r => r.id === update.id ? { ...r, ...update.values } : r);
      }
      setRecords(rows);
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
  const renewalSummaryPeopleCount = useMemo(() => new Set(renewalSummaryRecords.map(item => String(item.record.user_id))).size, [renewalSummaryRecords]);
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
    return [p?.name, p?.id, r.title, r.method, r.level, r.cert_no, r.sticker_no, r.detail?.issuer]
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
      expiry_date: form.expiry_date || (form.category === 'YARD' ? addYears(form.training_date_4 || form.training_date_3 || form.training_date_2 || form.training_date_1 || form.education_completed || form.obtained_date, 2) : form.category === 'NDT' ? addYears(form.obtained_date, 5) : null),
      sticker_no: form.category === 'YARD' ? (form.sticker_no.trim() || null) : null,
      cert_no: form.category === 'NDT' ? (form.cert_no.trim() || null) : null,
      training_date_1: form.category === 'YARD' ? (form.training_date_1 || null) : null,
      training_date_2: form.category === 'YARD' ? (form.training_date_2 || null) : null,
      training_date_3: form.category === 'YARD' ? (form.training_date_3 || null) : null,
      training_date_4: form.category === 'YARD' ? (form.training_date_4 || null) : null,
      detail: { ...oldDetail, issuer: form.issuer, cert_no: form.category === 'NDT' ? form.cert_no.trim() : null, localModified: true, editedInCert: true },
    };
    try {
      if (editing) {
        const { data, error } = await supabase.from('cert_management_records').update({ ...values, cert_no: form.category === 'NDT' ? (form.cert_no.trim() || null) : null }).eq('id', editing.id).select('*').single();
        if (error) throw error;
        setRecords(prev => prev.map(r => r.id === editing.id ? data as CertRecord : r));
        notify('자격정보를 수정했습니다. HRManagement 원본에는 변경사항을 보내지 않았습니다.');
      } else {
        const { data, error } = await supabase.from('cert_management_records').insert({ ...values, source_key: null }).select('*').single();
        if (error) throw error;
        setRecords(prev => [...prev, data as CertRecord]);
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

  const exportExcel = () => {
    const list = activeRecords.filter(r => r.category === category).slice().sort((a, b) => {
      const aPerson = personById.get(String(a.user_id));
      const bPerson = personById.get(String(b.user_id));
      const byName = (aPerson?.name || '').localeCompare(bPerson?.name || '', 'ko');
      return byName || String(a.user_id).localeCompare(String(b.user_id), 'ko') || a.title.localeCompare(b.title, 'ko');
    });
    const title = category === 'YARD' ? 'YARD 자격 현황' : category === 'NATIONAL' ? '국가 자격 취득 현황' : '사내자격 취득 현황';
    let headers: string[];
    let rows: any[][];
    let nameColumn = 0;
    if (category === 'YARD') {
      // 요청사항: 성명 다음에 교육명, 동일인의 여러 교육은 성명 셀을 병합합니다.
      headers = ['성명', '교육명', '사번', '교육일', '스티커 번호', '보수교육 1', '보수교육 2', '보수교육 3', '보수교육 4'];
      rows = list.map(r => [personById.get(String(r.user_id))?.name || '', r.title || '', String(r.user_id), r.education_completed || r.obtained_date || '', r.sticker_no || '', r.training_date_1 || '', r.training_date_2 || '', r.training_date_3 || '', r.training_date_4 || '']);
    } else if (category === 'NATIONAL') {
      headers = ['성명', '자격종류', '종목', '취득일'];
      rows = list.map(r => [personById.get(String(r.user_id))?.name || '', r.title || '', r.method || '', r.obtained_date || '']);
    } else {
      headers = ['성명', '경력', '자격종류(Level)', '종목', '취득일', '갱신일'];
      rows = list.map(r => [personById.get(String(r.user_id))?.name || '', personById.get(String(r.user_id))?.experience || '', r.level || '', r.title || '', r.obtained_date || '', r.expiry_date || (r.obtained_date ? addYears(r.obtained_date, 5) : '')]);
    }
    const sheetRows: any[][] = [[title], headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(sheetRows);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
    // 연속된 같은 사번의 이름 셀을 세로 병합합니다. (데이터 시작 행은 Excel 3행)
    let groupStart = 0;
    while (groupStart < list.length) {
      let groupEnd = groupStart + 1;
      while (groupEnd < list.length && String(list[groupEnd].user_id) === String(list[groupStart].user_id)) groupEnd++;
      if (groupEnd - groupStart > 1) {
        ws['!merges'].push({ s: { r: groupStart + 2, c: nameColumn }, e: { r: groupEnd + 1, c: nameColumn } });
      }
      groupStart = groupEnd;
    }
    ws['!rows'] = [{ hpt: 42 }, { hpt: 24 }, ...rows.map(() => ({ hpt: 21 }))];
    ws['!cols'] = headers.map((header, col) => {
      const maxLength = Math.max(header.length, ...rows.map(row => String(row[col] ?? '').length));
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
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, category === 'YARD' ? 'YARD 자격 현황' : category === 'NATIONAL' ? '국가 자격' : '사내자격 NDT');
    XLSX.writeFile(wb, `${title}_${todayStr()}.xlsx`);
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
          <span className="text-[10px] text-red-700">인원 {renewalSummaryPeopleCount}명 · 자격 {renewalSummaryRecords.length}건</span>
          <span className="ml-auto text-[10px] text-red-600">{renewalSummaryOpen ? '접기' : '펼쳐보기'}</span>
        </button>
        {renewalSummaryOpen && <div className="max-h-56 space-y-2 overflow-y-auto p-3">
          {renewalSummaryRecords.length === 0 ? <p className="text-xs text-[#64748B]">현재 갱신 대상 자격이 없습니다.</p> : renewalSummaryRecords.map(({ record, expiry }) => {
            const person = personById.get(String(record.user_id));
            const remaining = daysUntil(expiry!);
            return <div key={record.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#E2E5E9] bg-[#F8FAFC] px-3 py-2 text-xs">
              <div className="min-w-0"><span className="font-bold text-[#243B5A]">{person?.name || record.user_id}</span><span className="ml-1 text-[#64748B]">({record.user_id})</span><div className="mt-1 text-[#1F2937]">{record.category === 'YARD' ? 'YARD 교육' : 'NDT Level'} · {record.title}{record.level ? ` · ${record.level}` : ''}</div></div>
              <div className="shrink-0 text-right"><div className="font-bold text-red-600">자격갱신</div><div className="mt-1 text-[10px] text-[#64748B]">유효기간 {expiry} · {remaining < 0 ? `${Math.abs(remaining)}일 경과` : remaining === 0 ? '오늘 만료' : `${remaining}일 남음`}</div></div>
            </div>;
          })}
        </div>}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => void loadData()} disabled={loading} className="flex items-center gap-1 rounded-lg border border-[#E2E5E9] bg-white px-3 py-2 text-xs font-bold text-[#243B5A] disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}/> 새로고침</button>
        {admin && <button type="button" onClick={exportExcel} className="flex items-center gap-1 rounded-lg border border-[#E2E5E9] bg-white px-3 py-2 text-xs font-bold text-[#243B5A]"><Download className="h-3.5 w-3.5"/> Excel 저장</button>}
        <button type="button" onClick={openCreate} className="flex items-center gap-1 rounded-lg bg-[#243B5A] px-3 py-2 text-xs font-bold text-white"><Plus className="h-3.5 w-3.5"/> 자격 등록</button>
      </div>
    </div>

    <div className="flex flex-wrap gap-2 rounded-xl border border-[#E2E5E9] bg-white p-2">
      {categories.map(item => <button key={item.key} type="button" onClick={() => changeCategory(item.key)} className={`rounded-lg border px-3 py-2 text-xs font-bold ${category === item.key ? 'border-[#243B5A] bg-[#243B5A] text-white' : 'border-[#E2E5E9] bg-[#F5F6F8] text-[#64748B] hover:text-[#243B5A]'}`}>{item.label}</button>)}
    </div>

    <div className="rounded-xl border border-[#E2E5E9] bg-white p-3 space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(180px,1fr)_minmax(180px,2fr)]">
        <label className="text-[10px] font-bold text-[#64748B]">교육명 / 종목 서브탭<select className={`${inputClass} mt-1`} value={subTab} onChange={e => setSubTab(e.target.value)}><option value="ALL">전체 자격</option>{subTabs.map(name => <option key={name} value={name}>{name}</option>)}</select><span className="mt-1 block text-[11px] font-bold text-[#243B5A]">{subTab === 'ALL' ? '전체' : subTab} 인원: {selectedSubtabPeopleCount}명</span></label>
        <label className="text-[10px] font-bold text-[#64748B]">이름 · 사번 · 자격명 검색<div className="relative mt-1"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]"/><input className={`${inputClass} pl-8`} value={search} onChange={e => setSearch(e.target.value)} placeholder="이름, 로그인 아이디(사번), 교육명 또는 종목" /></div></label>
      </div>
      {loadError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700"><b>불러오기 실패</b><p className="mt-1 break-words">{loadError}</p><p className="mt-1">먼저 제공된 Supabase SQL을 실행했는지 확인해주세요.</p></div>}
      {loading ? <div className="py-12 text-center text-xs text-[#64748B]">자격정보를 불러오는 중...</div> : visibleGroups.length === 0 ? <div className="rounded-lg border border-dashed border-[#E2E5E9] bg-[#F5F6F8] p-8 text-center text-xs text-[#64748B]">표시할 자격이 없습니다. HRManagement에 등록된 자격이 있으면 새로고침을 눌러 가져올 수 있습니다.</div> : <div className="space-y-2">
        {visibleGroups.map(group => {
          const key = `person:${group.user_id}`;
          const isOpen = !!expanded[key];
          const refreshRecords = group.records;
          const renewalRecords = refreshRecords.filter(record => {
            if (record.category === 'NATIONAL') return false;
            const expiry = expiryFor(record);
            if (!expiry) return false;
            const remaining = daysUntil(expiry);
            return remaining <= 40;
          });
          return <div key={group.user_id} className="overflow-hidden rounded-lg border border-[#E2E5E9] bg-white">
            <button type="button" onClick={() => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))} className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left hover:bg-[#F8FAFC]">
              <span className="flex min-w-0 flex-1 items-start gap-2">{isOpen ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-[#64748B]"/> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#64748B]"/>}<span className="min-w-0 flex-1"><span className="block text-xs font-bold text-[#243B5A]">{group.person?.name || group.user_id} <span className="font-normal text-[#64748B]">({group.user_id})</span></span><span className="mt-1 flex flex-wrap gap-1.5">{refreshRecords.map(record => <span key={record.id} className="rounded-md border border-[#E2E5E9] bg-[#F5F6F8] px-2 py-1 text-[10px] text-[#1F2937]">{category === 'NDT' ? `${record.title}${record.level ? ` · ${record.level}` : ''}` : category === 'NATIONAL' ? `${record.title}${record.method ? ` · ${record.method}` : ''}` : record.title}</span>)}</span></span></span>
              <span className="flex shrink-0 flex-col items-end gap-1 text-right">{renewalRecords.length > 0 && <span className="rounded-md bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600">자격갱신</span>}<span className="text-[10px] text-[#64748B]">자격 {refreshRecords.length}건</span></span>
            </button>
            {isOpen && <div className="space-y-2 border-t border-[#E2E5E9] bg-[#F8FAFC] p-3">
              {refreshRecords.map(record => {
                const person = group.person;
                const expiry = expiryFor(record);
                const remaining = expiry ? daysUntil(expiry) : null;
                const needsRenewal = record.category !== 'NATIONAL' && remaining !== null && remaining <= 40;
                return <div key={record.id} className="rounded-lg border border-[#E2E5E9] bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2"><div><div className="text-xs font-bold text-[#243B5A]">{category === 'NDT' ? `${record.title}${record.level ? ` · ${record.level}` : ''}` : category === 'NATIONAL' ? `${record.title}${record.method ? ` · ${record.method}` : ''}` : record.title}</div><div className="mt-1 text-[10px] text-[#64748B]">{category === 'YARD' ? `교육일 ${record.education_completed || record.obtained_date || '미입력'} · 유효기간 ${expiry || '미입력'}` : category === 'NATIONAL' ? `취득일 ${record.obtained_date || '미입력'}` : `취득일 ${record.obtained_date || '미입력'} · 갱신일 ${expiry || '미입력'}`}</div></div>{needsRenewal && <span className="rounded-md bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600">자격갱신{remaining !== null ? (remaining < 0 ? ` · ${Math.abs(remaining)}일 경과` : remaining === 0 ? ' · 오늘 만료' : ` · ${remaining}일 남음`) : ''}</span>}</div>
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
    </div>

    {activeAlert && !alertHidden && activeAlert.length > 0 && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 p-3">
      <div className="w-full max-w-xl space-y-3 rounded-xl border border-[#E2E5E9] bg-white p-4 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-[#E2E5E9] pb-2"><AlertTriangle className="h-5 w-5 text-red-600"/><h3 className="text-sm font-bold text-[#243B5A]">자격갱신 알림</h3><span className="ml-auto rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600">{activeAlert.length}건</span></div>
        <p className="text-xs text-[#64748B]">YARD 및 사내자격(NDT Level)의 유효기간이 40일 이내이거나 이미 지난 자격입니다. 알림은 5일 간격으로 표시됩니다.</p>
        <div className="max-h-[55vh] space-y-2 overflow-y-auto rounded-lg bg-[#F5F6F8] p-2">{activeAlert.map(record => {
          const expiry = expiryFor(record);
          const remaining = expiry ? daysUntil(expiry) : null;
          const person = personById.get(String(record.user_id));
          const categoryLabel = record.category === 'YARD' ? 'YARD' : 'NDT Level';
          return <div key={record.id} className="rounded-lg border border-[#E2E5E9] bg-white p-3 text-xs">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><b className="text-[#243B5A]">{person?.name || record.user_id}</b><span className="ml-1 text-[#64748B]">({record.user_id})</span><div className="mt-1 font-semibold">{categoryLabel} · {record.title}{record.level ? ` · ${record.level}` : ''}</div></div><span className="rounded-md bg-red-50 px-2 py-1 font-bold text-red-600">자격갱신</span></div>
            <div className="mt-2 text-[#64748B]">유효기간: {expiry || '미입력'} · {remaining === null ? '기간 확인 필요' : remaining < 0 ? `${Math.abs(remaining)}일 경과` : remaining === 0 ? '오늘 만료' : `${remaining}일 남음`}</div>
          </div>;
        })}</div>
        <div className="flex justify-end gap-2"><button type="button" onClick={hideAlertForFiveDays} className="rounded-lg border border-[#E2E5E9] px-3 py-2 text-xs font-bold text-[#64748B]">5일간 보지 않기</button><button type="button" onClick={() => { setAlertHidden(true); setActiveAlert(null); }} className="rounded-lg bg-[#243B5A] px-4 py-2 text-xs font-bold text-white">닫기</button></div>
      </div>
    </div>}

    {modalOpen && <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/40 p-3">
      <form onSubmit={save} className="max-h-[92vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-xl border border-[#E2E5E9] bg-white p-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E2E5E9] pb-2"><h3 className="text-sm font-bold text-[#243B5A]">{editing ? '자격정보 수정' : `${categories.find(c => c.key === category)?.label} 등록`}</h3><button type="button" onClick={() => setModalOpen(false)} aria-label="닫기"><X className="h-4 w-4"/></button></div>
        {!editing && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><label className="text-[11px] font-bold text-[#64748B]">자격 구분<select className={`${inputClass} mt-1`} value={form.category} onChange={e => { const next = e.target.value as Category; setForm(emptyForm(next, admin ? form.user_id : String(selfPerson?.id || ''))); setCategory(next); setSubTab('ALL'); }}><option value="YARD">YARD 자격</option><option value="NATIONAL">국가 자격</option><option value="NDT">사내자격 (NDT Level)</option></select></label><label className="text-[11px] font-bold text-[#64748B]">성명 / 사번<select className={`${inputClass} mt-1`} value={form.user_id} onChange={e => setField('user_id', e.target.value)} required disabled={!admin}><option value="">구성원 선택</option>{selectedPeople.map(p => <option key={p.id} value={String(p.id)}>{p.name} ({p.id})</option>)}</select></label></div>}
        {editing && <div className="rounded-lg bg-[#F5F6F8] p-2 text-[11px] text-[#64748B]">대상: {personById.get(String(form.user_id))?.name || form.user_id} ({form.user_id}) · {form.category}</div>}
        {form.category === 'YARD' && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><label className="text-[11px] font-bold text-[#64748B]">교육명 *<input className={`${inputClass} mt-1`} value={form.title} onChange={e => setField('title', e.target.value)} required /></label><label className="text-[11px] font-bold text-[#64748B]">교육일<input type="date" className={`${inputClass} mt-1`} value={form.education_completed || form.obtained_date} onChange={e => { setField('education_completed', e.target.value); }} /></label><label className="text-[11px] font-bold text-[#64748B]">스티커 번호<input className={`${inputClass} mt-1`} value={form.sticker_no} onChange={e => setField('sticker_no', e.target.value)} /></label>{[1,2,3,4].map(n => <label key={n} className="text-[11px] font-bold text-[#64748B]">보수교육 {n}<input type="date" className={`${inputClass} mt-1`} value={(form as any)[`training_date_${n}`]} onChange={e => setField((`training_date_${n}`) as keyof FormData, e.target.value)} /></label>)}<label className="text-[11px] font-bold text-[#64748B]">유효기간<input type="date" className={`${inputClass} mt-1`} value={form.expiry_date || addYears(form.training_date_4 || form.training_date_3 || form.training_date_2 || form.training_date_1 || form.education_completed, 2)} onChange={e => setField('expiry_date', e.target.value)} /></label></div>}
        {form.category === 'NATIONAL' && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><label className="text-[11px] font-bold text-[#64748B]">자격종류 *<select className={`${inputClass} mt-1`} value={form.title} onChange={e => setField('title', e.target.value)} required><option value="">선택</option>{['기사','산업기사','기능사','기술사','RI','SRI'].map(v => <option key={v}>{v}</option>)}</select></label><label className="text-[11px] font-bold text-[#64748B]">종목<input className={`${inputClass} mt-1`} value={form.method} onChange={e => setField('method', e.target.value)} placeholder="예: UT 기능사, 지게차 등" /></label><label className="text-[11px] font-bold text-[#64748B]">취득일<input type="date" className={`${inputClass} mt-1`} value={form.obtained_date} onChange={e => setField('obtained_date', e.target.value)} /></label></div>}
        {form.category === 'NDT' && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><label className="text-[11px] font-bold text-[#64748B]">발급형태<select className={`${inputClass} mt-1`} value={form.issuer} onChange={e => setField('issuer', e.target.value)}><option value="사내">사내</option><option value="ASNT/ISO">ASNT/ISO</option></select></label><label className="text-[11px] font-bold text-[#64748B]">종목 *<input className={`${inputClass} mt-1`} value={form.title} onChange={e => setField('title', e.target.value)} placeholder="예: LT(BUBBLE), PT" required /></label><label className="text-[11px] font-bold text-[#64748B]">자격종류(Level)<select className={`${inputClass} mt-1`} value={form.level} onChange={e => setField('level', e.target.value)}><option value="">선택</option><option>Level I</option><option>Level II</option><option>Level III</option></select></label><label className="text-[11px] font-bold text-[#64748B]">취득일<input type="date" className={`${inputClass} mt-1`} value={form.obtained_date} onChange={e => setField('obtained_date', e.target.value)} /></label><label className="text-[11px] font-bold text-[#64748B]">갱신일 / 유효일<input type="date" className={`${inputClass} mt-1`} value={form.expiry_date || addYears(form.obtained_date, 5)} onChange={e => setField('expiry_date', e.target.value)} /></label><label className="text-[11px] font-bold text-[#64748B]">Cert No.<input className={`${inputClass} mt-1`} value={form.cert_no} onChange={e => setField('cert_no', e.target.value)} /></label></div>}
        <div className="flex justify-end gap-2 border-t border-[#E2E5E9] pt-3"><button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-[#E2E5E9] px-3 py-2 text-xs font-bold text-[#64748B]">취소</button><button type="submit" disabled={saving} className="rounded-lg bg-[#243B5A] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? '저장 중...' : '저장'}</button></div>
      </form>
    </div>}
  </div>;
}
