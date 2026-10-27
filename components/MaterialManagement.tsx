'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  X, 
  Package, 
  ArrowUpRight, 
  ArrowDownRight,
  Lock,
  Box,
  Bell,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Compass,
  MapPin,
  Settings,
  History,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import InventoryHistoryFilters from './InventoryHistoryFilters';
import { supabase } from '@/lib/supabase';
import ExcelJS from 'exceljs';

// 자체 정의된 타입
export interface AppUser {
  id: string | number;
  name: string;
  role?: string;
}

export interface InventoryItem {
  id: string | number;
  type: string;
  code?: string;
  no?: string;
  name?: string;
  item?: string;
  category?: string;
  sheet_name?: string;
  vbt_type?: string;
  sub_equipment?: string;
  quantity: number;
  unit: string;
  min_quantity?: number;
  initial_quantity?: number;
  location?: string;
  location_or_section?: string;
  maker_model?: string;
  serial_number?: string;
  cert_no?: string;
  calibration_date?: string;
}

export interface InventoryLog {
  id: string | number;
  inventory_id?: string | number;
  item_code?: string;
  item_name?: string;
  type: string;
  quantity: number;
  worker_name?: string;
  issued_by?: string;
  returned_by?: string;
  memo?: string;
  batch_id?: string | null;
  is_new?: boolean;
  created_at: string;
}

interface InventoryReturnHistory {
  id: string | number;
  inventory_id?: string | number | null;
  item_code?: string | null;
  item_name?: string | null;
  quantity: number;
  issued_by: string;
  returned_by: string;
  issued_at?: string | null;
  returned_at: string;
  memo?: string | null;
  created_at: string;
}

interface MaterialManagementProps {
  currentUser: AppUser;
  isAdmin: boolean;
  inventoryList: InventoryItem[];
  inventoryLogs: InventoryLog[];
  loadingInventory: boolean;
  showMinStockAlert: boolean;
  setShowMinStockAlert: (show: boolean) => void;
  lowStockItems: InventoryItem[];
  fetchInventory: () => Promise<void>;
  fetchInventoryLogs: () => Promise<void>;
}

type MainTab = '고정' | '소모성' | 'CABIN';
type VbtSubCategory = '1L' | '1S' | '2L' | '2S' | 'FLAT' | '기타';

/** cert.tsx 스타일을 참조한 앱 공통 달력 날짜 선택 컴포넌트 */
function CalendarDatePicker({
  value,
  onChange,
  className = 'w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]',
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

  useEffect(() => setInputText(value || ''), [value]);
  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (event: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setIsOpen(false); };
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
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const commitTypedDate = () => {
    const trimmed = inputText.trim();
    if (!trimmed) { onChange(''); setInputText(''); return; }
    const normalizedInput = /^\d{8}$/.test(trimmed) ? `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}` : trimmed;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalizedInput);
    if (match) {
      const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
      const candidate = new Date(year, month - 1, day);
      if (candidate.getFullYear() === year && candidate.getMonth() === month - 1 && candidate.getDate() === day) {
        onChange(normalizedInput); setInputText(normalizedInput); return;
      }
    }
    setInputText(value || '');
  };
  const chooseDate = (day: number) => {
    const nextValue = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(nextValue); setInputText(nextValue); setIsOpen(false);
  };

  return (
    <div ref={rootRef} className="relative w-full min-w-0 space-y-1">
      {label && <label className="block text-[11px] font-semibold text-[#1F2937]">{label}</label>}
      <div className="flex min-w-0 items-center gap-1">
        <input type="text" inputMode="numeric" value={inputText}
          onChange={event => setInputText(event.target.value)} onBlur={commitTypedDate}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commitTypedDate(); } }}
          placeholder="YYYY-MM-DD 직접 입력" aria-label={label ? `${label} 날짜 직접 입력 (YYYY-MM-DD)` : '날짜 직접 입력 (YYYY-MM-DD)'}
          className={`${className} min-w-0 flex-1`} />
        <button type="button" onClick={() => {
          if (!isOpen) {
            const current = selected ? new Date(Number(selected.slice(0, 4)), Number(selected.slice(5, 7)) - 1, Number(selected.slice(8, 10))) : new Date();
            setViewYear(current.getFullYear()); setViewMonth(current.getMonth());
          }
          setIsOpen(open => !open);
        }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E2E5E9] bg-white text-[#243B5A] transition-colors hover:bg-[#F5F6F8]" aria-label="달력 열기" aria-haspopup="dialog" aria-expanded={isOpen}>
          <CalendarIcon className="h-4 w-4" />
        </button>
      </div>
      {isOpen && <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/25 p-4" onClick={() => setIsOpen(false)}>
        <div role="dialog" aria-modal="true" aria-label="날짜 선택" onClick={event => event.stopPropagation()}
          className="relative max-h-[calc(100dvh-32px)] w-[min(320px,calc(100vw-32px))] overflow-y-auto rounded-2xl border border-[#E2E5E9] bg-white p-3 text-[#1F2937] shadow-[0_12px_32px_rgba(15,23,42,0.18)]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button type="button" onClick={() => moveMonth(-1)} aria-label="이전 달" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E5E9] bg-[#F8FAFC] text-[#243B5A] hover:bg-[#EEF2F7]"><ChevronLeft className="h-4 w-4" /></button>
            <div className="flex min-w-0 items-center gap-1">
              <select aria-label="연도 선택" value={viewYear} onChange={event => setViewYear(Number(event.target.value))} className="max-w-[112px] rounded-lg border border-[#E2E5E9] bg-[#F8FAFC] px-2 py-1.5 text-sm font-bold text-[#243B5A] outline-none focus:border-[#243B5A]">
                {Array.from({ length: Math.max(80, new Date().getFullYear() - 1960 + 21) }, (_, index) => 1960 + index).map(year => <option key={year} value={year}>{year}년</option>)}
              </select>
              <select aria-label="월 선택" value={viewMonth} onChange={event => setViewMonth(Number(event.target.value))} className="rounded-lg border border-[#E2E5E9] bg-[#F8FAFC] px-2 py-1.5 text-sm font-bold text-[#243B5A] outline-none focus:border-[#243B5A]">
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
              const isSelected = dateKey === selected, isToday = dateKey === today, weekday = new Date(viewYear, viewMonth, day).getDay();
              return <button key={dateKey} type="button" onClick={() => chooseDate(day)} aria-pressed={isSelected} className={`h-9 rounded-lg text-xs transition-colors ${isSelected ? 'bg-[#243B5A] font-bold text-white shadow-sm' : isToday ? 'border border-[#243B5A] font-bold text-[#243B5A]' : `hover:bg-[#EEF2F7] ${weekday === 0 ? 'text-[#DC2626]' : weekday === 6 ? 'text-[#2563EB]' : 'text-[#1F2937]'}`}`}>{day}</button>;
            })}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-[#E2E5E9] pt-2">
            <button type="button" onClick={() => { const date = today; setViewYear(now.getFullYear()); setViewMonth(now.getMonth()); onChange(date); setInputText(date); setIsOpen(false); }} className="rounded-lg px-3 py-2 text-xs font-semibold text-[#243B5A] hover:bg-[#F5F6F8]">오늘</button>
            <div className="flex items-center gap-1">
              {selected && <button type="button" onClick={() => { onChange(''); setInputText(''); setIsOpen(false); }} className="rounded-lg px-3 py-2 text-xs font-semibold text-[#64748B] hover:bg-[#F5F6F8]">지우기</button>}
              <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg bg-[#243B5A] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1B2F49]">닫기</button>
            </div>
          </div>
        </div>
      </div>}
    </div>
  );
}

export default function MaterialManagement({
  currentUser,
  isAdmin,
  inventoryList = [],
  inventoryLogs = [],
  loadingInventory,
  showMinStockAlert,
  setShowMinStockAlert,
  lowStockItems,
  fetchInventory,
  fetchInventoryLogs,
}: MaterialManagementProps) {
  const [inventoryTab, setInventoryTab] = useState<MainTab>('고정');
  const [showExcelDownloadMenu, setShowExcelDownloadMenu] = useState(false);
  const [cabinInventoryList, setCabinInventoryList] = useState<any[]>([]);
  const [loadingCabin, setLoadingCabin] = useState<boolean>(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm?: () => void | Promise<void>;
  }>({ isOpen: false, title: '', message: '' });

  const showConfirm = (title: string, message: string, onConfirm: () => void | Promise<void>) => {
    setConfirmModal({ isOpen: true, title, message, onConfirm });
  };

  const showCenterToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };
 
  const findInventoryItemForLog = useCallback((log: InventoryLog) => {
    if (log.inventory_id !== undefined && log.inventory_id !== null && log.inventory_id !== '') {
      const byId = inventoryList.find(i => String(i.id) === String(log.inventory_id));
      if (byId) return byId;
    }
    if (log.item_name) {
      return inventoryList.find(i => i.name === log.item_name);
    }
    return undefined;
  }, [inventoryList]);

  // 반납 모달 상태
  const [showReturnModal, setShowReturnModal] = useState<boolean>(false);
  const [targetReturnLog, setTargetReturnLog] = useState<InventoryLog | null>(null);
  const [returnQty, setReturnQty] = useState<number>(1);
  const [returnHasIssue, setReturnHasIssue] = useState<boolean>(false);
  const [returnMemo, setReturnMemo] = useState<string>('');
  const [returnBatchItems, setReturnBatchItems] = useState<any[]>([]);
  const [returnIssueItemIds, setReturnIssueItemIds] = useState<string[]>([]);
  const returnSubmittingRef = useRef(false);

  // 이력 수정 모달 상태
  const [showEditLogModal, setShowEditLogModal] = useState<boolean>(false);
  const [targetEditLog, setTargetEditLog] = useState<InventoryLog | null>(null);
  const [editLogQty, setEditLogQty] = useState<number>(1);
  const [editLogMemo, setEditLogMemo] = useState<string>('');

  const [pendingDeleteLogId, setPendingDeleteLogId] = useState<string | number | null>(null);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState<boolean>(false);

  // CABIN 전용 추가 상태
  const [selectedCabinIds, setSelectedCabinIds] = useState<string[]>([]);

  // 기자재 일괄 불출 상태
  const [selectedFixedIds, setSelectedFixedIds] = useState<string[]>([]);
  const [fixedBatchQuantities, setFixedBatchQuantities] = useState<Record<string, number>>({});
  const [showFixedBatchModal, setShowFixedBatchModal] = useState<boolean>(false);
  const [fixedBatchMemo, setFixedBatchMemo] = useState<string>('');

  // 소모성 자재 일괄 사용 상태
  const [selectedConsumableIds, setSelectedConsumableIds] = useState<string[]>([]);
  const [consumableBatchQuantities, setConsumableBatchQuantities] = useState<Record<string, number>>({});
  const [showConsumableBatchModal, setShowConsumableBatchModal] = useState<boolean>(false);
  const [consumableBatchMemo, setConsumableBatchMemo] = useState<string>('');
  const [cabinCalibrationOnly, setCabinCalibrationOnly] = useState<boolean>(false);
  const [showCabinBatchModal, setShowCabinBatchModal] = useState<boolean>(false);
  const [cabinBatchMemo, setCabinBatchMemo] = useState<string>('');
  
  // CABIN 일괄 반납 모달 상태
  const [showCabinBatchReturnModal, setShowCabinBatchReturnModal] = useState<boolean>(false);
  const [cabinBatchReturnMemo, setCabinBatchReturnMemo] = useState<string>('');
  const [cabinBatchReturnHasIssue, setCabinBatchReturnHasIssue] = useState<boolean>(false);
  const [cabinBatchIssueIds, setCabinBatchIssueIds] = useState<string[]>([]);
  const [batchReturnProcessingId, setBatchReturnProcessingId] = useState<string | null>(null);

  const [fixedSubCategories, setFixedSubCategories] = useState<string[]>([
    '압력계', '가스측정기', 'VBT', '공구', '무선 배터리', '교정', '기타'
  ]);
  const [selectedFixedSubCategory, setSelectedFixedSubCategory] = useState<string>('압력계');

  const [consumableSubCategories, setConsumableSubCategories] = useState<string[]>([
    '검사약품', '기밀', '기타'
  ]);
  const [selectedConsumableCategory, setSelectedConsumableCategory] = useState<string>('검사약품');

  useEffect(() => {
    let cancelled = false;
    const loadSubCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('inventory_subcategories')
          .select('inventory_type, name, sort_order')
          .in('inventory_type', ['고정', '소모성'])
          .order('sort_order', { ascending: true, nullsFirst: false });
        if (error) throw error;
        if (cancelled || !data || data.length === 0) return;
        const fixed = data.filter((row: any) => row.inventory_type === '고정').map((row: any) => row.name);
        const consumable = data.filter((row: any) => row.inventory_type === '소모성').map((row: any) => row.name);
        if (fixed.length) {
          setFixedSubCategories(fixed);
          setSelectedFixedSubCategory(current => fixed.includes(current) ? current : fixed[0]);
        }
        if (consumable.length) {
          setConsumableSubCategories(consumable);
          setSelectedConsumableCategory(current => consumable.includes(current) ? current : consumable[0]);
        }
      } catch (error) {
        console.error('서브 카테고리 불러오기 실패:', error);
      }
    };
    loadSubCategories();
    return () => { cancelled = true; };
  }, []);

  const persistSubCategories = async (type: '고정' | '소모성' | 'CABIN', categories: string[]) => {
    const cleaned = Array.from(new Set(categories.map(value => value.trim()).filter(Boolean)));

    const { data: existingRows, error: existingError } = await supabase
      .from('inventory_subcategories')
      .select('id, name')
      .eq('inventory_type', type);
    if (existingError) throw existingError;

    for (let index = 0; index < cleaned.length; index++) {
      const name = cleaned[index];
      const existing = (existingRows || []).find((row: any) => row.name === name);
      if (existing) {
        const { error } = await supabase
          .from('inventory_subcategories')
          .update({ sort_order: index })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('inventory_subcategories')
          .insert([{ inventory_type: type, name, sort_order: index }]);
        if (error) throw error;
      }
    }

    const namesToKeep = new Set(cleaned);
    const obsoleteIds = (existingRows || [])
      .filter((row: any) => !namesToKeep.has(String(row.name || '').trim()))
      .map((row: any) => row.id);
    if (obsoleteIds.length > 0) {
      const { error } = await supabase
        .from('inventory_subcategories')
        .delete()
        .in('id', obsoleteIds);
      if (error) throw error;
    }
  };

  const [customCabinSheets, setCustomCabinSheets] = useState<string[]>([]);
  const [selectedCabinSheet, setSelectedCabinSheet] = useState<string>('');

  const [customCabinTextSubTags, setCustomCabinTextSubTags] = useState<string[]>([]);
  const [selectedCabinTextSubTag, setSelectedCabinTextSubTag] = useState<string>('');

  const [isCabinSheetModalOpen, setIsCabinSheetModalOpen] = useState<boolean>(false);
  const [isCabinTagModalOpen, setIsCabinTagModalOpen] = useState<boolean>(false);
  const [newSheetInput, setNewSheetInput] = useState<string>('');
  const [editingSheetIndex, setEditingSheetIndex] = useState<number | null>(null);
  const [editSheetInputValue, setEditSheetInputValue] = useState<string>('');

  const [newTagInput, setNewTagInput] = useState<string>('');
  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null);
  const [editTagInputValue, setEditTagInputValue] = useState<string>('');

  const [selectedVbtSubCategory, setSelectedVbtSubCategory] = useState<VbtSubCategory>('1L');

  const [isSubCatModalOpen, setIsSubCatModalOpen] = useState<boolean>(false);
  const [newSubCatInput, setNewSubCatInput] = useState<string>('');
  const [editingSubCatIndex, setEditingSubCatIndex] = useState<number | null>(null);
  const [editSubCatInputValue, setEditSubCatInputValue] = useState<string>('');

  const [isAlertBannerOpen, setIsAlertBannerOpen] = useState(false);
  const [isHistorySectionOpen, setIsHistorySectionOpen] = useState(true);
  
  const [collapsedSubTabs, setCollapsedSubTabs] = useState<{ [key: string]: boolean }>({});

  const toggleSubTabContent = (subCatName: string) => {
    setCollapsedSubTabs(prev => ({
      ...prev,
      [subCatName]: !prev[subCatName]
    }));
  };

  const [selectedDetailItem, setSelectedDetailItem] = useState<any | null>(null);
  const [showInventorySheet, setShowInventorySheet] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  
  const [showLogSheet, setShowLogSheet] = useState(false);
  const [targetItem, setTargetItem] = useState<any | null>(null);
  const [logType, setLogType] = useState<string>('불출');
  const [logQty, setLogQty] = useState<number>(1);
  const [logHasIssue, setLogHasIssue] = useState<boolean>(false);
  const [logMemo, setLogMemo] = useState('');

  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'전체' | '기자재' | '소모성' | '교정' | '교정반입완료' | 'CABIN'>('전체');
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState<string>('전체');
  const [returnHistoryCategoryFilter, setReturnHistoryCategoryFilter] = useState<string>('전체');
  const [isReturnHistoryOpen, setIsReturnHistoryOpen] = useState(false);
  const [returnHistories, setReturnHistories] = useState<InventoryReturnHistory[]>([]);
  const [loadingReturnHistories, setLoadingReturnHistories] = useState(false);
  const [pendingDeleteReturnHistoryId, setPendingDeleteReturnHistoryId] = useState<string | number | null>(null);
  
  // 반납 이력 다중 선택 및 일괄 삭제 상태 추가
  const [selectedReturnHistoryIds, setSelectedReturnHistoryIds] = useState<string[]>([]);
  const [showBatchDeleteReturnHistoryConfirm, setShowBatchDeleteReturnHistoryConfirm] = useState<boolean>(false);

  const [calibrationAlertItems, setCalibrationAlertItems] = useState<{ item: any; daysLeft: number; calDate: string; nextCalDate: string }[]>([]);

  const cleanSheetName = (rawName: string) => {
    if (!rawName) return '';
    return rawName.replace(/^\d+[\.\-\s]+/, '').trim();
  };

  const fetchCabinInventory = useCallback(async () => {
    setLoadingCabin(true);
    try {
      const { data, error } = await supabase
        .from('cabin_inventory')
        .select('id, no, item, sheet_name, location_or_section, maker_model, serial_number, cert_no, calibration_date');
      if (error) throw error;
      
      const formattedData = (data || []).map((row: any) => ({
        ...row,
        type: 'CABIN',
        code: row.no || `CBN-${row.id}`,
        name: row.item || '제목 없음',
        category: row.sheet_name || '기타',
        quantity: 1,
        unit: 'EA',
        location: row.location_or_section || 'CABIN',
        sub_equipment: row.calibration_date ? `${row.calibration_date}` : null
      }));

      setCabinInventoryList(formattedData);

      const sheets = new Set<string>();
      formattedData.forEach((item: any) => {
        if (item.sheet_name) {
          sheets.add(cleanSheetName(item.sheet_name));
        }
      });

      const sortedSheets = Array.from(sheets).sort((a, b) => {
        const isCA = a.toUpperCase().startsWith('C#');
        const isCB = b.toUpperCase().startsWith('C#');

        if (isCA && isCB) {
          const numA = parseInt(a.replace(/[^0-9]/g, '')) || 0;
          const numB = parseInt(b.replace(/[^0-9]/g, '')) || 0;
          return numA - numB;
        }
        if (isCA) return -1;
        if (isCB) return 1;

        return a.localeCompare(b);
      });

      let orderedSheets = sortedSheets;
      try {
        const { data: savedSheets, error: savedSheetError } = await supabase
          .from('inventory_subcategories')
          .select('name, sort_order')
          .eq('inventory_type', 'CABIN')
          .order('sort_order', { ascending: true, nullsFirst: false });
        if (!savedSheetError && savedSheets && savedSheets.length > 0) {
          const savedNames = savedSheets
            .map((row: any) => cleanSheetName(String(row.name || '')))
            .filter(Boolean);
          const uniqueSavedNames = Array.from(new Set(savedNames));
          const newSheets = sortedSheets.filter(name => !uniqueSavedNames.includes(name));
          orderedSheets = [...uniqueSavedNames, ...newSheets];
        }
      } catch (savedOrderError) {
        console.error('CABIN 서브탭 순서 불러오기 실패:', savedOrderError);
      }

      setCustomCabinSheets(orderedSheets);
      if (orderedSheets.length > 0) {
        setSelectedCabinSheet(current =>
          !current || !orderedSheets.includes(current) ? orderedSheets[0] : current
        );
      }
    } catch (err: any) {
      console.error('cabin_inventory 로드 실패:', err.message);
    } finally {
      setLoadingCabin(false);
    }
  }, []);

  useEffect(() => {
    if (inventoryTab === 'CABIN') {
      fetchCabinInventory();
    }
  }, [inventoryTab, fetchCabinInventory]);

  const cabinTextSubTagsForSheet = useMemo(() => {
    const filteredBySheet = cabinInventoryList.filter(item => cleanSheetName(item.sheet_name) === selectedCabinSheet);
    const tags = new Set<string>();
    filteredBySheet.forEach(item => {
      const itemNameLower = (item.item || '').toLowerCase();
      if (itemNameLower.includes('transmitter')) tags.add('Transmitter');
      else if (itemNameLower.includes('gauge')) tags.add('Gauge');
      else if (itemNameLower.includes('sensor')) tags.add('Sensor');
      else if (itemNameLower.includes('switch')) tags.add('Switch');
      else if (itemNameLower.includes('valve')) tags.add('Valve');
      else {
        const firstWord = (item.item || '').split(' ')[0];
        if (firstWord) tags.add(firstWord);
      }
    });
    return Array.from(new Set([...Array.from(tags).sort(), ...customCabinTextSubTags]));
  }, [cabinInventoryList, selectedCabinSheet, customCabinTextSubTags]);

  const handleSelectCabinSheet = (sheetName: string) => {
    setSelectedCabinSheet(sheetName);
    setSelectedCabinIds([]);
    setSelectedItemSubCategory('전체 보기');
  };

  useEffect(() => {
    if (cabinTextSubTagsForSheet.length > 0) {
      if (!selectedCabinTextSubTag || !cabinTextSubTagsForSheet.includes(selectedCabinTextSubTag)) {
        setSelectedCabinTextSubTag(cabinTextSubTagsForSheet[0]);
      }
    } else {
      setSelectedCabinTextSubTag('');
    }
  }, [cabinTextSubTagsForSheet, selectedCabinTextSubTag]);

  useEffect(() => {
    const targetList = inventoryTab === 'CABIN' ? cabinInventoryList : inventoryList;
    if (!targetList || targetList.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingCalibrations: { item: any; daysLeft: number; calDate: string; nextCalDate: string }[] = [];

    targetList.forEach((item) => {
      let calDateStr = '';
      if (inventoryTab === 'CABIN') {
        calDateStr = item.calibration_date || '';
      } else {
        const subEquip = item.sub_equipment || '';
        const parts = subEquip.split('|').map((s: string) => s.trim());
        calDateStr = parts.length >= 2 ? parts[1] : parts[0];
      }

      // 교정 반출 상태인 장비는 교정 예정 목록에서 제외합니다.
      // 교정 반입 로그가 이후에 기록되면 다시 예정 목록에 표시됩니다.
      const itemCalibrationLogs = inventoryLogs
        .filter((log: any) => String(log.inventory_id ?? '') === String(item.id) && String(log.type || '').includes('교정'))
        .sort((a: any, b: any) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
      const latestCalibrationLog = itemCalibrationLogs[itemCalibrationLogs.length - 1];
      const isCurrentlyOutForCalibration = Boolean(latestCalibrationLog && String(latestCalibrationLog.type || '').includes('교정 반출'));

      if (calDateStr && !isCurrentlyOutForCalibration) {
        const nextCalDate = new Date(calDateStr);
        if (!isNaN(nextCalDate.getTime())) {
          nextCalDate.setHours(0, 0, 0, 0);
          const diffDays = Math.ceil((nextCalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          if (diffDays <= 30) {
            upcomingCalibrations.push({
              item,
              daysLeft: diffDays,
              calDate: inventoryTab === 'CABIN' ? (item.calibration_date || '') : '',
              nextCalDate: calDateStr
            });
          }
        }
      }
    });

    setCalibrationAlertItems(upcomingCalibrations);
  }, [inventoryList, cabinInventoryList, inventoryTab, inventoryLogs]);

  const parseCalDates = (subEquipment: string | null | undefined) => {
    if (!subEquipment) return { calDate: '', nextCalDate: '' };
    const parts = subEquipment.split('|').map(s => s.trim());
    if (parts.length >= 2) {
      return { calDate: parts[0], nextCalDate: parts[1] };
    }
    return { calDate: subEquipment, nextCalDate: '' };
  };

  const [itemSubCategoryRows, setItemSubCategoryRows] = useState<any[]>([]);
  const [selectedItemSubCategory, setSelectedItemSubCategory] = useState<string>('전체 보기');
  const [isItemSubCatModalOpen, setIsItemSubCatModalOpen] = useState<boolean>(false);
  const [isInventoryListOpen, setIsInventoryListOpen] = useState<boolean>(false);
  const [inventoryListPage, setInventoryListPage] = useState<number>(1);
  const [newItemSubCatName, setNewItemSubCatName] = useState<string>('');
  const [newItemSubCatMaterialNames, setNewItemSubCatMaterialNames] = useState<string[]>([]);
  const [editingItemSubCatId, setEditingItemSubCatId] = useState<string | number | null>(null);
  const [editingItemSubCatName, setEditingItemSubCatName] = useState<string>('');
  const [editingItemSubCatMaterialNames, setEditingItemSubCatMaterialNames] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const loadItemSubCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('inventory_item_subcategories')
          .select('id, inventory_type, parent_category, name, material_name, sort_order, is_active')
          .order('sort_order', { ascending: true, nullsFirst: false })
          .order('name', { ascending: true });
        if (error) throw error;
        if (!cancelled) setItemSubCategoryRows(data || []);
      } catch (error) {
        console.error('품목별 서브탭 불러오기 실패:', error);
        if (!cancelled) setItemSubCategoryRows([]);
      }
    };
    loadItemSubCategories();
    return () => { cancelled = true; };
  }, []);

  const compareCabinIdentifier = (a: any, b: any) => {
    const aText = String(a ?? '').trim();
    const bText = String(b ?? '').trim();
    const aNum = /^\d+$/.test(aText) ? Number(aText) : null;
    const bNum = /^\d+$/.test(bText) ? Number(bText) : null;
    if (aNum !== null && bNum !== null) return aNum - bNum;
    if (aNum !== null) return -1;
    if (bNum !== null) return 1;
    return aText.localeCompare(bText, 'ko', { numeric: true, sensitivity: 'base' });
  };

  const currentMaterialNames = useMemo(() => {
    let names: string[] = [];
    if (inventoryTab === '고정') {
      names = inventoryList.filter(item => {
        const cat = item.category || '';
        const { calDate, nextCalDate } = parseCalDates(item.sub_equipment);
        if (selectedFixedSubCategory === '전체 보기') return true;
        if (selectedFixedSubCategory === '교정') return Boolean(calDate || nextCalDate);
        if (selectedFixedSubCategory === 'VBT') return cat === 'VBT';
        return cat === selectedFixedSubCategory;
      }).map(item => String(item.name || '').trim()).filter(Boolean);
    } else if (inventoryTab === '소모성') {
      names = inventoryList.filter(item => item.type === '소모성' && item.category === selectedConsumableCategory)
        .map(item => String(item.name || '').trim()).filter(Boolean);
    } else {
      names = cabinInventoryList.filter(item => cleanSheetName(item.sheet_name) === selectedCabinSheet)
        .map(item => String(item.item || '').trim()).filter(Boolean);
    }
    const uniqueNames = Array.from(new Set(names));
    if (inventoryTab === 'CABIN') {
      const cabinItemsForSheet = cabinInventoryList
        .filter(item => cleanSheetName(item.sheet_name) === selectedCabinSheet)
        .slice()
        .sort((a, b) => compareCabinIdentifier(a.no, b.no));
      return cabinItemsForSheet
        .map(item => String(item.item || '').trim())
        .filter(Boolean)
        .filter((name, index, arr) => arr.indexOf(name) === index);
    }
    return uniqueNames.sort((a,b)=>a.localeCompare(b,'ko'));
  }, [inventoryTab, inventoryList, cabinInventoryList, selectedFixedSubCategory, selectedConsumableCategory, selectedCabinSheet]);

  const getCurrentItemSubCategoryContext = () => {
    // 등록창에서 관리창을 열었으면, 폼에서 선택한 서브 카테고리를 기준으로 자재명 카테고리를 관리합니다.
    const parentCategory = showInventorySheet && itemType !== 'CABIN'
      ? itemCategory
      : inventoryTab === '고정' ? selectedFixedSubCategory : inventoryTab === '소모성' ? selectedConsumableCategory : selectedCabinSheet;
    const type = showInventorySheet ? itemType : inventoryTab;
    return { type, parentCategory };
  };

  const refreshItemSubCategoryRows = async () => {
    const { data, error } = await supabase
      .from('inventory_item_subcategories')
      .select('id, inventory_type, parent_category, name, material_name, sort_order, is_active')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true });
    if (error) throw error;
    setItemSubCategoryRows(data || []);
  };

  const handleOpenItemSubCategorySettings = async () => {
    if (!isAdmin) return showCenterToast('관리자만 자재명 설정을 변경할 수 있습니다.');

    if (inventoryTab === 'CABIN') {
      const parentCategory = selectedCabinSheet;
      const existingRows = itemSubCategoryRows.filter(
        row => row.inventory_type === 'CABIN' && row.parent_category === parentCategory && row.is_active !== false
      );

      if (existingRows.length === 0 && currentMaterialNames.length > 0) {
        try {
          const rows = currentMaterialNames.map((name, index) => ({
            inventory_type: 'CABIN',
            parent_category: parentCategory,
            name,
            material_name: name,
            sort_order: index,
            is_active: true
          }));
          const { error } = await supabase.from('inventory_item_subcategories').insert(rows);
          if (error) throw error;
          await refreshItemSubCategoryRows();
        } catch (error: any) {
          showCenterToast('CABIN 자재명 설정 초기화 실패: ' + (error?.message || '알 수 없는 오류'));
          return;
        }
      }
    }

    setNewItemSubCatName('');
    setNewItemSubCatMaterialNames([]);
    setEditingItemSubCatId(null);
    setIsItemSubCatModalOpen(true);
  };

  const handleAddItemSubCategory = async () => {
    if (!isAdmin) return showCenterToast('관리자만 자재 종류를 추가할 수 있습니다.');
    const name = newItemSubCatName.trim();
    if (!name) return showCenterToast('자재 종류 이름을 입력해주세요.');
    if (name === '전체 보기') return showCenterToast('전체 보기는 기본 항목이라 추가할 수 없습니다.');
    const { type, parentCategory } = getCurrentItemSubCategoryContext();
    if (currentItemSubCategoryOptions.includes(name)) return showCenterToast('이미 존재하는 자재 종류입니다.');
    try {
      const nextSortOrder = currentItemSubCategoryEntries.length > 0
        ? Math.max(...currentItemSubCategoryEntries.map(entry => entry.sortOrder)) + 1
        : 0;
      const rows = newItemSubCatMaterialNames.length > 0
        ? newItemSubCatMaterialNames.map((materialName) => ({ inventory_type:type, parent_category:parentCategory, name, material_name:materialName, sort_order:nextSortOrder, is_active:true }))
        : [{ inventory_type:type, parent_category:parentCategory, name, material_name:'', sort_order:nextSortOrder, is_active:true }];
      const { error } = await supabase.from('inventory_item_subcategories').insert(rows);
      if (error) throw error;
      await refreshItemSubCategoryRows();
      setSelectedItemSubCategory(name);
      setNewItemSubCatName('');
      setNewItemSubCatMaterialNames([]);
      showCenterToast('자재 종류가 추가되었습니다.');
    } catch (error:any) {
      showCenterToast('자재 종류 추가 실패: ' + (error?.message || '알 수 없는 오류'));
    }
  };

  const handleSaveItemSubCategoryEdit = async () => {
    if (!isAdmin || editingItemSubCatId === null) return;
    const newName = editingItemSubCatName.trim();
    if (!newName) return showCenterToast('자재 종류 이름을 입력해주세요.');
    if (newName === '전체 보기') return showCenterToast('전체 보기는 수정할 수 없습니다.');
    const { type, parentCategory } = getCurrentItemSubCategoryContext();
    try {
      const target = itemSubCategoryRows.find(row => row.id === editingItemSubCatId);
      if (!target) return;
      const targetEntry = currentItemSubCategoryEntries.find(entry => entry.name === target.name);
      const targetSortOrder = targetEntry?.sortOrder ?? 0;
      await supabase.from('inventory_item_subcategories').delete().eq('inventory_type',type).eq('parent_category',parentCategory).eq('name',target.name);
      const rows = editingItemSubCatMaterialNames.length > 0
        ? editingItemSubCatMaterialNames.map((materialName)=>({ inventory_type:type,parent_category:parentCategory,name:newName,material_name:materialName,sort_order:targetSortOrder,is_active:true }))
        : [{ inventory_type:type,parent_category:parentCategory,name:newName,material_name:'',sort_order:targetSortOrder,is_active:true }];
      const { error } = await supabase.from('inventory_item_subcategories').insert(rows);
      if (error) throw error;
      await refreshItemSubCategoryRows();
      setSelectedItemSubCategory(newName);
      setEditingItemSubCatId(null);
      setEditingItemSubCatName('');
      setEditingItemSubCatMaterialNames([]);
      showCenterToast('자재 종류가 수정되었습니다.');
    } catch (error:any) {
      showCenterToast('자재 종류 수정 실패: ' + (error?.message || '알 수 없는 오류'));
    }
  };

  const handleDeleteItemSubCategory = async (name: string) => {
    if (!isAdmin) return showCenterToast('관리자만 자재 종류를 삭제할 수 있습니다.');
    if (name === '전체 보기') return showCenterToast('전체 보기는 삭제할 수 없습니다.');
    showConfirm('자재 종류 삭제', `'${name}' 자재 종류를 삭제하시겠습니까?\n\n※ 실제 자재 데이터는 삭제되지 않습니다.`, async () => {
      const { type, parentCategory } = getCurrentItemSubCategoryContext();
      try {
        const { error } = await supabase.from('inventory_item_subcategories').delete().eq('inventory_type',type).eq('parent_category',parentCategory).eq('name',name);
        if (error) throw error;
        await refreshItemSubCategoryRows();
        setSelectedItemSubCategory('전체 보기');
        showCenterToast('자재 종류가 삭제되었습니다.');
      } catch (error:any) {
        showCenterToast('자재 종류 삭제 실패: ' + (error?.message || '알 수 없는 오류'));
      }
    });
  };

  const moveCurrentItemSubCategory = async (index: number, direction: -1 | 1) => {
    if (!isAdmin) return;
    const entries = [...currentItemSubCategoryEntries];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= entries.length) return;

    [entries[index], entries[targetIndex]] = [entries[targetIndex], entries[index]];

    const { type, parentCategory } = getCurrentItemSubCategoryContext();

    try {
      for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
        const entry = entries[entryIndex];
        const { error } = await supabase
          .from('inventory_item_subcategories')
          .update({ sort_order: entryIndex })
          .eq('inventory_type', type)
          .eq('parent_category', parentCategory)
          .eq('name', entry.name);
        if (error) throw error;
      }

      await refreshItemSubCategoryRows();
      if (selectedItemSubCategory === entries[index].name) {
        setSelectedItemSubCategory(entries[index].name);
      }
    } catch (error:any) {
      showCenterToast('자재 종류 순서 저장 실패: ' + (error?.message || '알 수 없는 오류'));
    }
  };

  const [itemType, setItemType] = useState<MainTab>('고정');
  const [itemCode, setItemCode] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemSerialNo, setItemSerialNo] = useState('');
  const [itemCategory, setItemCategory] = useState('압력계');
  const [itemNameCategory, setItemNameCategory] = useState('');
  const [itemVbtType, setItemVbtType] = useState('');
  const [itemCalDate, setItemCalDate] = useState('');
  const [itemNextCalDate, setItemNextCalDate] = useState('');
  const [itemNeedsCalibration, setItemNeedsCalibration] = useState<boolean>(false);
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemUnit, setItemUnit] = useState('대');
  const [itemMinQty, setItemMinQty] = useState<number>(0);
  const [itemLocation, setItemLocation] = useState('장비실 A');

  // 기자재/소모성 자재 추가 입고 처리
  const [inboundItem, setInboundItem] = useState<any | null>(null);
  const [inboundQty, setInboundQty] = useState<number>(1);
  const [inboundMemo, setInboundMemo] = useState('');
  const [inboundSubmitting, setInboundSubmitting] = useState(false);

  const [cabinSheetName, setCabinSheetName] = useState('');
  const [cabinLocationSection, setCabinLocationSection] = useState('');
  const [cabinMakerModel, setCabinMakerModel] = useState('');
  const [cabinSerialNo, setCabinSerialNo] = useState('');
  const [cabinCertNo, setCabinCertNo] = useState('');
  const [cabinCalibrationDate, setCabinCalibrationDate] = useState('');

  const currentItemSubCategoryEntries = useMemo(() => {
    const activeType = showInventorySheet ? itemType : inventoryTab;
    const parentCategory = showInventorySheet && itemType !== 'CABIN'
      ? itemCategory
      : activeType === '고정' ? selectedFixedSubCategory : activeType === '소모성' ? selectedConsumableCategory : selectedCabinSheet;
    const rows = itemSubCategoryRows.filter(row => row.inventory_type === activeType && row.parent_category === parentCategory && row.is_active !== false);

    if (inventoryTab === 'CABIN' && rows.length === 0) {
      return currentMaterialNames.map((name, index) => ({
        name,
        materialNames: [name],
        id: `cabin-material-${index}`,
        sortOrder: index
      }));
    }

    const map = new Map<string, { name:string; materialNames:string[]; id:any; sortOrder:number }>();
    rows.forEach(row => {
      const name = String(row.name || '').trim();
      if (!name) return;
      if (!map.has(name)) map.set(name, { name, materialNames: [], id: row.id, sortOrder: Number(row.sort_order ?? 0) });
      const materialName = String(row.material_name || '').trim();
      if (materialName && currentMaterialNames.includes(materialName)) {
        const entry = map.get(name)!;
        if (!entry.materialNames.includes(materialName)) entry.materialNames.push(materialName);
      }
    });
    return Array.from(map.values()).sort((a,b)=>a.sortOrder - b.sortOrder || a.name.localeCompare(b.name,'ko'));
  }, [itemSubCategoryRows, inventoryTab, selectedFixedSubCategory, selectedConsumableCategory, selectedCabinSheet, currentMaterialNames, showInventorySheet, itemType, itemCategory]);

  const currentItemSubCategoryOptions = currentItemSubCategoryEntries.map(entry => entry.name);

  useEffect(() => {
    // 등록창을 여는 동안에는 목록 화면의 선택값을 등록 폼 기준으로 초기화하지 않습니다.
    if (showInventorySheet) return;
    if (selectedItemSubCategory !== '전체 보기' && !currentItemSubCategoryOptions.includes(selectedItemSubCategory)) {
      setSelectedItemSubCategory('전체 보기');
    }
  }, [currentItemSubCategoryOptions, selectedItemSubCategory, showInventorySheet]);


  const getCurrentSubCategories = () => {
    if (inventoryTab === '고정') return fixedSubCategories;
    if (inventoryTab === '소모성') return consumableSubCategories;
    return [];
  };

  const setCurrentSubCategories = (list: string[]) => {
    if (inventoryTab === '고정') setFixedSubCategories(list);
    else if (inventoryTab === '소모성') setConsumableSubCategories(list);
  };

  const moveCurrentSubCategory = async (index: number, direction: -1 | 1) => {
    const list = [...getCurrentSubCategories()];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= list.length) return;
    [list[index], list[targetIndex]] = [list[targetIndex], list[index]];
    try {
      if (inventoryTab === '고정' || inventoryTab === '소모성') {
        await persistSubCategories(inventoryTab, list);
      }
      setCurrentSubCategories(list);
    } catch (error: any) {
      showCenterToast('서브 카테고리 순서 저장 실패: ' + (error?.message || '알 수 없는 오류'));
    }
  };

  const moveCabinSheet = async (index: number, direction: -1 | 1) => {
    const list = [...customCabinSheets];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= list.length) return;
    [list[index], list[targetIndex]] = [list[targetIndex], list[index]];
    try {
      await persistSubCategories('CABIN', list);
      setCustomCabinSheets(list);
    } catch (error: any) {
      showCenterToast('CABIN 서브탭 순서 저장 실패: ' + (error?.message || '알 수 없는 오류'));
    }
  };

  const getCurrentSelectedCategory = () => {
    if (inventoryTab === '고정') return selectedFixedSubCategory;
    if (inventoryTab === '소모성') return selectedConsumableCategory;
    return `${selectedCabinSheet} - ${selectedCabinTextSubTag}`;
  };

  const setCurrentSelectedCategory = (val: string) => {
    if (inventoryTab === '고정') setSelectedFixedSubCategory(val);
    else if (inventoryTab === '소모성') setSelectedConsumableCategory(val);
  };

  const handleCalibrationDateChange = (value: string) => {
    setItemCalDate(value);
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      setItemNextCalDate('');
      return;
    }
    const [year, month, day] = value.split('-').map(Number);
    const nextDate = new Date(year + 1, month - 1, day);
    // 윤년 2월 29일 등 다음 해에 존재하지 않는 날짜는 해당 월의 마지막 날로 맞춥니다.
    if (nextDate.getMonth() !== month - 1) nextDate.setDate(0);
    setItemNextCalDate(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`);
  };

  const handleOpenInventoryCreate = () => {
    if (!isAdmin) return showCenterToast('관리자만 자재를 등록할 수 있습니다.');
    setEditingItem(null);
    setItemType(inventoryTab);
    // 일반 자재는 임의 자재코드를 생성하지 않습니다.
    // 연결된 자재명 카테고리(예: 몽키)는 저장 시 내부 code 값으로 사용합니다.
    setItemCode('');
    setItemName('');
    setItemSerialNo('');
    setItemVbtType('');
    setItemCalDate('');
    setItemNextCalDate('');
    setItemNeedsCalibration(false);
    setItemCategory(inventoryTab === '고정' ? selectedFixedSubCategory : inventoryTab === '소모성' ? selectedConsumableCategory : '일반');
    setItemNameCategory(selectedItemSubCategory === '전체 보기' ? '' : selectedItemSubCategory);
    
    setCabinSheetName(selectedCabinSheet || 'C#1');
    setCabinLocationSection('');
    setCabinMakerModel('');
    setCabinSerialNo('');
    setCabinCertNo('');
    setCabinCalibrationDate('');

    setShowInventorySheet(true);
  };

  const handleOpenInventoryEdit = (item: any) => {
    if (!isAdmin) return showCenterToast('관리자만 자재 정보를 수정할 수 있습니다.');
    setSelectedDetailItem(null);
    setEditingItem(item);
    setItemType(item.type as MainTab);

    if (item.type === 'CABIN') {
      setItemCode(item.no || '');
      setItemName(item.item || '');
      setCabinSheetName(cleanSheetName(item.sheet_name || ''));
      setCabinLocationSection(item.location_or_section || '');
      setCabinMakerModel(item.maker_model || '');
      setCabinSerialNo(item.serial_number || '');
      setCabinCertNo(item.cert_no || '');
      setCabinCalibrationDate(item.calibration_date || '');
    } else {
      setItemCode(item.code || '');
      setItemName(item.name);
      setItemSerialNo(item.serial_number || '');
      setItemCategory(item.category);
      const linkedNameCategory = itemSubCategoryRows.find(row => row.inventory_type === item.type && row.parent_category === item.category && row.material_name === item.name && row.is_active !== false);
      setItemNameCategory(linkedNameCategory?.name || '');
      setItemVbtType(item.vbt_type || '');
      const { calDate, nextCalDate } = parseCalDates(item.sub_equipment);
      setItemCalDate(calDate);
      setItemNextCalDate(nextCalDate);
      setItemNeedsCalibration(Boolean(calDate || nextCalDate));
      setItemQuantity(item.quantity);
      setItemUnit(item.unit);
      setItemMinQty(item.min_quantity || 0);
      setItemLocation(item.location);
    }
    setShowInventorySheet(true);
  };

  const handleSubmitInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return showCenterToast('관리자 권한이 필요합니다.');

    try {
      if (itemType === 'CABIN') {
        const cabinPayload = {
          sheet_name: cabinSheetName.trim(),
          location_or_section: cabinLocationSection.trim(),
          no: itemCode.trim(),
          item: itemName.trim(),
          maker_model: cabinMakerModel.trim(),
          serial_number: cabinSerialNo.trim(),
          cert_no: cabinCertNo.trim(),
          calibration_date: cabinCalibrationDate.trim() || null,
        };

        if (editingItem) {
          const { error } = await supabase.from('cabin_inventory').update(cabinPayload).eq('id', editingItem.id);
          if (error) throw error;
          showCenterToast('CABIN 자재 정보가 수정되었습니다.');
        } else {
          const { error } = await supabase.from('cabin_inventory').insert([cabinPayload]);
          if (error) throw error;
          showCenterToast('신규 CABIN 자재가 등록되었습니다.');
        }
        await fetchCabinInventory();
      } else {
        const subEquipValue = itemType === '고정' && itemNeedsCalibration && itemCalDate.trim()
          ? (itemNextCalDate.trim() ? `${itemCalDate.trim()} | ${itemNextCalDate.trim()}` : itemCalDate.trim())
          : null;
        if (itemType === '고정' && itemNeedsCalibration && !itemCalDate.trim()) {
          return showCenterToast('교정관리가 필요한 자재는 교정일자를 입력해주세요.');
        }

        const payload = {
          type: itemType,
          // 연결된 자재명 카테고리가 있으면 해당 이름을 code로 사용합니다.
          // 임의 번호는 생성하지 않으며, 기존 자재 수정 시에는 기존 code를 보존합니다.
          code: String(
            itemNameCategory.trim() ||
            editingItem?.code ||
            itemCode.trim() ||
            itemName.trim()
          ),
          name: itemName.trim(),
          serial_number: itemSerialNo.trim() || null,
          category: itemCategory,
          vbt_type: itemType === '고정' ? (itemVbtType || null) : null,
          sub_equipment: itemType === '고정' ? subEquipValue : null,
          quantity: itemQuantity,
          initial_quantity: editingItem?.initial_quantity ?? itemQuantity,
          unit: itemUnit,
          min_quantity: itemMinQty,
          location: itemLocation,
          updated_at: new Date().toISOString()
        };

        if (editingItem) {
          const { error } = await supabase.from('inventory').update(payload).eq('id', editingItem.id);
          if (error) throw error;
          showCenterToast('자재 정보가 수정되었습니다.');
        } else {
          const { error } = await supabase.from('inventory').insert([payload]);
          if (error) throw error;
          showCenterToast('신규 자재가 등록되었습니다.');
        }
        await fetchInventory();
        if (itemNameCategory.trim() && itemName.trim()) {
          const alreadyLinked = itemSubCategoryRows.some(row => row.inventory_type === itemType && row.parent_category === itemCategory && row.name === itemNameCategory && String(row.material_name || '').trim() === itemName.trim() && row.is_active !== false);
          if (!alreadyLinked) {
            const nextSortOrder = itemSubCategoryRows.filter(row => row.inventory_type === itemType && row.parent_category === itemCategory && row.name === itemNameCategory).reduce((max, row) => Math.max(max, Number(row.sort_order || 0)), 0);
            const { error: linkError } = await supabase.from('inventory_item_subcategories').insert([{ inventory_type: itemType, parent_category: itemCategory, name: itemNameCategory, material_name: itemName.trim(), sort_order: nextSortOrder, is_active: true }]);
            if (linkError) throw linkError;
            await refreshItemSubCategoryRows();
          }
        }
      }

      setShowInventorySheet(false);
    } catch (err: any) {
      showCenterToast('데이터베이스 저장 실패: ' + err.message);
    }
  };

  const handleDeleteInventory = async (item: any) => {
    if (!isAdmin) return showCenterToast('관리자만 삭제할 수 있습니다.');
    showConfirm('자재 삭제', '정말로 이 자재를 삭제하시겠습니까?', async () => {
      const targetTableName = item.type === 'CABIN' ? 'cabin_inventory' : 'inventory';

      try {
        const { error } = await supabase.from(targetTableName).delete().eq('id', item.id);
        if (error) throw error;

        setSelectedDetailItem(null);
        setShowInventorySheet(false);
        showCenterToast('자재가 삭제되었습니다.');
        if (item.type === 'CABIN') {
          await fetchCabinInventory();
        } else {
          await fetchInventory();
        }
      } catch (err: any) {
        showCenterToast('삭제 실패: ' + err.message);
      }
    });
  };

  const isCalibrationItem = (item: any) => {
    if (!item) return false;
    const { calDate, nextCalDate } = parseCalDates(item.sub_equipment);
    return item.category === '교정' || Boolean(item.calibration_date || calDate || nextCalDate);
  };

  const handleOpenInboundModal = (item: any) => {
    if (!isAdmin) return showCenterToast('관리자만 자재 입고를 처리할 수 있습니다.');
    if (!item || (item.type !== '고정' && item.type !== '소모성')) return;
    setInboundItem(item);
    setInboundQty(1);
    setInboundMemo('');
  };

  const handleSubmitInbound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !inboundItem || inboundSubmitting) return;
    const quantityToAdd = Number(inboundQty);
    if (!Number.isInteger(quantityToAdd) || quantityToAdd < 1) {
      showCenterToast('입고 수량은 1 이상의 정수로 입력해주세요.');
      return;
    }

    setInboundSubmitting(true);
    const operationAt = new Date().toISOString();
    const currentQty = Number(inboundItem.quantity || 0);
    let stockUpdated = false;
    let inboundLogCreated = false;
    try {
      const { data: updatedRows, error: inventoryError } = await supabase
        .from('inventory')
        .update({ quantity: currentQty + quantityToAdd, updated_at: operationAt })
        .eq('id', inboundItem.id)
        .eq('quantity', currentQty)
        .select('id, quantity');
      if (inventoryError) throw inventoryError;
      if (!updatedRows || updatedRows.length === 0) {
        showCenterToast('보유수량이 변경되었습니다. 목록을 새로고침한 후 다시 입고해주세요.');
        await fetchInventory();
        return;
      }
      stockUpdated = true;

      const { error: logError } = await supabase.from('inventory_logs').insert([{
        inventory_id: inboundItem.id,
        item_code: inboundItem.code || null,
        item_name: inboundItem.name || inboundItem.item || null,
        type: '입고',
        quantity: quantityToAdd,
        worker_name: currentUser?.name || '작업자',
        issued_by: currentUser?.name || '작업자',
        returned_by: null,
        memo: inboundMemo.trim() || null,
        is_new: true,
        created_at: operationAt,
      }]);
      if (logError) throw logError;
      inboundLogCreated = true;

      showCenterToast(`${inboundItem.name || inboundItem.item || '자재'} ${quantityToAdd}${inboundItem.unit || 'EA'} 입고가 완료되었습니다.`);
      setInboundItem(null);
      await fetchInventory();
      await fetchInventoryLogs();
    } catch (err: any) {
      if (stockUpdated && !inboundLogCreated) {
        // 이력 저장에 실패한 경우 수량이 중복 반영되지 않도록 가능한 범위에서 원상 복구합니다.
        await supabase.from('inventory')
          .update({ quantity: currentQty, updated_at: new Date().toISOString() })
          .eq('id', inboundItem.id)
          .eq('quantity', currentQty + quantityToAdd);
      }
      showCenterToast('입고 처리 실패: ' + (err?.message || '알 수 없는 오류'));
      await fetchInventory();
    } finally {
      setInboundSubmitting(false);
    }
  };

  const handleOpenLogModal = (item: any, type: string) => {
    if (item.type === '소모성' && (type === '반납' || type === '교정 반입')) {
      showCenterToast('소모성 자재는 반납 프로세스가 존재하지 않습니다.');
      return;
    }
    if ((type === '반납' || type === '교정 반입') && item.type !== '소모성') {
      const currentQty = Number(item.quantity || 0);
      const initialQty = Number(item.initial_quantity);
      if (Number.isFinite(initialQty) && initialQty >= 0 && currentQty >= initialQty) {
        showCenterToast(`현재 보유수량이 최초 보유수량(${initialQty} ${item.unit || 'EA'})과 같습니다. 이미 반납이 완료된 자재입니다.`);
        return;
      }
    }
    setSelectedDetailItem(null);
    setTargetItem(item);
    setLogType(type);
    setLogQty(1);
    setLogHasIssue(false);
    setLogMemo('');
    setShowLogSheet(true);
  };

  const handleSubmitLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetItem) return;

    try {
      const qtyChange = Number(logQty);
      if (qtyChange <= 0) {
        showCenterToast('수량은 1 이상이어야 합니다.');
        return;
      }
      const operationAt = new Date().toISOString();
      if (targetItem.type === 'CABIN' && (logType === '교정 반출' || logType === '교정 반입')) {
        const { error } = await supabase.from('inventory_logs').insert([{
          inventory_id: targetItem.id,
          item_code: targetItem.no || targetItem.code || null,
          item_name: targetItem.item || targetItem.name || 'CABIN 품목',
          type: logType,
          quantity: 1,
          worker_name: currentUser?.name || '작업자',
          issued_by: logType === '교정 반출' ? (currentUser?.name || '작업자') : null,
          returned_by: logType === '교정 반입' ? (currentUser?.name || '작업자') : null,
          memo: logMemo.trim() || null,
          batch_id: null,
          is_new: true,
          created_at: operationAt
        }]);
        if (error) throw error;
        showCenterToast(`CABIN ${logType} 기록이 저장되었습니다.`);
        setShowLogSheet(false);
        await fetchInventoryLogs();
        return;
      }
const operationBatchId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      let currentQty = targetItem.quantity || 0;
      let newQty = currentQty;

      if (logType === '불출' || logType === '교정 반출' || logType === '소모성 사용') {
        if (currentQty < qtyChange) {
          showCenterToast('현재 보유 재고보다 불출(사용) 수량이 많습니다.');
          return;
        }
        newQty = currentQty - qtyChange;
      } else if (logType === '반납' || logType === '교정 반입') {
        const initialQty = Number(targetItem.initial_quantity);
        if (!Number.isFinite(initialQty) || initialQty < 0) {
          showCenterToast('최초 보유수량이 등록되지 않은 자재입니다. 관리자에게 최초 보유수량을 확인해주세요.');
          return;
        }
        if (currentQty + qtyChange > initialQty) {
          showCenterToast(`반납 후 수량이 최초 보유수량(${initialQty} ${targetItem.unit || 'EA'})을 초과할 수 없습니다.`);
          return;
        }
        newQty = currentQty + qtyChange;
      }

      let openIssueLogForReturn: any | null = null;
      if (logType === '반납' || logType === '교정 반입') {
        const { data: openBatchItem, error: openBatchItemError } = await supabase
          .from('inventory_batch_items')
          .select('batch_id, inventory_id, quantity, issued_by, issued_at, memo')
          .eq('inventory_id', targetItem.id)
          .eq('inventory_type', '고정')
          .eq('status', 'ISSUED')
          .order('issued_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (openBatchItemError) throw openBatchItemError;

        if (openBatchItem?.batch_id) {
          const { data: batchLog, error: batchLogError } = await supabase
            .from('inventory_logs')
            .select('id, item_name, quantity, type, worker_name, issued_by, returned_by, memo, batch_id, created_at')
            .eq('batch_id', openBatchItem.batch_id)
            .in('type', ['불출', '교정 반출'])
            .not('type', 'ilike', '%반납완료%')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (batchLogError) throw batchLogError;
          openIssueLogForReturn = batchLog;
        }

        if (!openIssueLogForReturn) {
          const { data: openIssueLog, error: openIssueLogError } = await supabase
            .from('inventory_logs')
            .select('id, item_name, quantity, type, worker_name, issued_by, returned_by, memo, batch_id, created_at')
            .eq('inventory_id', targetItem.id)
            .in('type', ['불출', '교정 반출'])
            .not('type', 'ilike', '%반납완료%')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (openIssueLogError) throw openIssueLogError;
          openIssueLogForReturn = openIssueLog;
        }

        if (!openIssueLogForReturn) {
          showCenterToast('반납 처리할 미반납 불출 이력을 찾을 수 없습니다. 먼저 불출 이력을 확인해주세요.');
          return;
        }
        if (qtyChange > Number(openIssueLogForReturn.quantity || 0)) {
          showCenterToast(`반납 수량은 해당 불출 수량(${openIssueLogForReturn.quantity} ${targetItem.unit || 'EA'})을 초과할 수 없습니다.`);
          return;
        }
      }

      let updateQuery = supabase
        .from('inventory')
        .update({ quantity: newQty, updated_at: operationAt })
        .eq('id', targetItem.id);

      if (logType === '반납' || logType === '교정 반입') {
        updateQuery = updateQuery.lte('quantity', Number(targetItem.initial_quantity) - qtyChange);
      }

      const { data: updatedRows, error: invError } = await updateQuery.select('id, quantity');

      if (invError) throw invError;
      if ((logType === '반납' || logType === '교정 반입') && (!updatedRows || updatedRows.length === 0)) {
        showCenterToast(`반납 후 수량이 최초 보유수량(${targetItem.initial_quantity} ${targetItem.unit || 'EA'})을 초과할 수 없습니다.`);
        return;
      }

      let finalLogType = logType === '소모성 사용' ? '소모성 사용' : logType;
      if (logType === '반납' || logType === '교정 반입') {
        finalLogType = logType === '교정 반입' ? (logHasIssue ? '교정 반입, 이상알림' : '교정 반입') : (logHasIssue ? '불출, 반납완료, 이상알림' : '불출, 반납완료');

        const returnMemoText = logMemo.trim()
          ? `${openIssueLogForReturn.memo ? `${openIssueLogForReturn.memo} / ` : ''}반납메모: ${logMemo.trim()}`
          : openIssueLogForReturn.memo || null;
        const returnedAt = operationAt;
        const returnedBy = currentUser?.name || '작업자';

        if (logType === '교정 반입') {
          const { error: calibrationReturnLogError } = await supabase
            .from('inventory_logs')
            .insert([{
              inventory_id: targetItem.id,
              item_code: targetItem.code || null,
              item_name: targetItem.name || targetItem.item || openIssueLogForReturn.item_name,
              type: finalLogType,
              quantity: qtyChange,
              worker_name: returnedBy,
              issued_by: openIssueLogForReturn.issued_by || openIssueLogForReturn.worker_name || '불출자 미기록',
              returned_by: returnedBy,
              memo: returnMemoText,
              batch_id: openIssueLogForReturn.batch_id || operationBatchId,
              is_new: true,
              created_at: returnedAt
            }]);
          if (calibrationReturnLogError) throw calibrationReturnLogError;
        } else {
          const { error: logUpdateError } = await supabase
            .from('inventory_logs')
            .update({
              type: finalLogType,
              quantity: qtyChange,
              worker_name: openIssueLogForReturn.worker_name || openIssueLogForReturn.issued_by || '불출자 미기록',
              issued_by: openIssueLogForReturn.issued_by || openIssueLogForReturn.worker_name || '불출자 미기록',
              returned_by: returnedBy,
              memo: returnMemoText,
              is_new: true,
              updated_at: returnedAt
            })
            .eq('id', openIssueLogForReturn.id);
          if (logUpdateError) throw logUpdateError;
        }

        if (openIssueLogForReturn.batch_id) {
          const { error: batchItemUpdateError } = await supabase
            .from('inventory_batch_items')
            .update({
              status: 'RETURNED',
              returned_by: returnedBy,
              returned_at: returnedAt
            })
            .eq('batch_id', openIssueLogForReturn.batch_id)
            .eq('inventory_id', targetItem.id)
            .eq('status', 'ISSUED');
          if (batchItemUpdateError) throw batchItemUpdateError;
        }

        // 교정 반입은 일반 기자재 반납 이력과 분리하여 inventory_logs의 교정 이력에서만 관리합니다.
        if (logType !== '교정 반입') {
          const { error: returnHistoryError } = await supabase
            .from('inventory_return_history')
            .insert([{
              inventory_id: targetItem.id,
              item_code: targetItem.type === 'CABIN' ? (targetItem.no || targetItem.code || null) : (targetItem.code || null),
              item_name: targetItem.name || targetItem.item || null,
              quantity: qtyChange,
              issued_by: openIssueLogForReturn.issued_by || openIssueLogForReturn.worker_name || '불출자 미기록',
              returned_by: returnedBy,
              issued_at: openIssueLogForReturn.created_at || null,
              returned_at: returnedAt,
              memo: returnMemoText,
              created_at: returnedAt
            }]);
          if (returnHistoryError) throw returnHistoryError;
        }
      } else {
        const { error: logError } = await supabase
          .from('inventory_logs')
          .insert([{
            inventory_id: targetItem.id,
            item_code: targetItem.type === 'CABIN' ? (targetItem.no || targetItem.code || null) : (targetItem.code || null),
            item_name: targetItem.name || targetItem.item,
            type: finalLogType,
            quantity: qtyChange,
            worker_name: currentUser?.name || '작업자',
            issued_by: currentUser?.name || '작업자',
            returned_by: null,
            memo: logMemo.trim() || null,
            batch_id: operationBatchId,
            is_new: true,
            created_at: operationAt
          }]);

        if (logError) throw logError;

        if ((logType === '불출' || logType === '교정 반출') && targetItem.type === '고정') {
          const { error: batchItemError } = await supabase
            .from('inventory_batch_items')
            .insert([{
              batch_id: operationBatchId,
              inventory_id: targetItem.id,
              inventory_type: '고정',
              item_code: targetItem.code || null,
              item_name: targetItem.name || targetItem.item || null,
              quantity: qtyChange,
              issued_by: currentUser?.name || '작업자',
              issued_at: operationAt,
              status: 'ISSUED',
              memo: logMemo.trim() || null
            }]);
          if (batchItemError) throw batchItemError;
        }
      }

      showCenterToast(`${logType} 처리가 완료되었습니다.`);
      setShowLogSheet(false);
      await fetchInventory();
      await fetchInventoryLogs();
    } catch (err: any) {
      showCenterToast('처리 중 오류가 발생했습니다: ' + err.message);
    }
  };

  const toggleSelectConsumableItem = (id: string | number) => {
    const strId = String(id);
    const target = inventoryList.find(item => String(item.id) === strId && item.type === '소모성');
    const isSelected = selectedConsumableIds.includes(strId);
    if (isSelected) {
      setSelectedConsumableIds(prev => prev.filter(item => item !== strId));
      setConsumableBatchQuantities(current => {
        const next = { ...current };
        delete next[strId];
        return next;
      });
      return;
    }
    setSelectedConsumableIds(prev => [...prev, strId]);
    if (target) {
      setConsumableBatchQuantities(current => ({
        ...current,
        [strId]: Number(target.quantity || 0) > 0 ? 1 : 0
      }));
    }
  };

  const openConsumableBatchModal = () => {
    const selectedItems = inventoryList.filter(item =>
      item.type === '소모성' && selectedConsumableIds.includes(String(item.id))
    );
    const quantities: Record<string, number> = {};
    selectedItems.forEach(item => {
      const id = String(item.id);
      const available = Number(item.quantity || 0);
      const current = Number(consumableBatchQuantities[id] || 1);
      quantities[id] = available > 0 ? Math.max(1, Math.min(current, available)) : 0;
    });
    setConsumableBatchQuantities(quantities);
    setShowConsumableBatchModal(true);
  };

  const handleConsumableBatchIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedConsumableIds.length === 0) return;

    try {
      const selectedItems = inventoryList.filter(item =>
        item.type === '소모성' && selectedConsumableIds.includes(String(item.id))
      );
      if (selectedItems.length === 0) return;

      const unavailable = selectedItems.filter(item => Number(item.quantity || 0) < 1);
      if (unavailable.length > 0) {
        showCenterToast(`보유수량이 없는 소모성 자재 ${unavailable.length}건이 포함되어 있어 사용 처리할 수 없습니다.`);
        return;
      }

      const useItems = selectedItems.map(item => {
        const id = String(item.id);
        const available = Number(item.quantity || 0);
        const quantity = Number(consumableBatchQuantities[id] || 0);
        return { item, available, quantity };
      });

      const invalidQuantityItem = useItems.find(({ quantity, available }) =>
        !Number.isInteger(quantity) || quantity < 1 || quantity > available
      );
      if (invalidQuantityItem) {
        showCenterToast(`${invalidQuantityItem.item.name || invalidQuantityItem.item.code || '소모성 자재'}의 사용 수량은 1개 이상, 현재 보유수량 이하로 입력해주세요.`);
        return;
      }

      const batchId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `BATCH-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const usedAt = new Date().toISOString();
      const usedBy = currentUser?.name || '작업자';
      const memoText = consumableBatchMemo.trim() || '소모성 자재 사용';

      for (const { item, quantity } of useItems) {
        const { data: updatedRows, error: updateError } = await supabase
          .from('inventory')
          .update({ quantity: Number(item.quantity || 0) - quantity, updated_at: usedAt })
          .eq('id', item.id)
          .gte('quantity', quantity)
          .select('id, quantity');
        if (updateError) throw updateError;
        if (!updatedRows || updatedRows.length === 0) {
          throw new Error(`${item.name || item.code || '소모성 자재'}의 재고가 이미 변경되었습니다. 다시 확인해주세요.`);
        }
      }

      const batchRows = useItems.map(({ item, quantity }) => ({
        batch_id: batchId,
        inventory_id: item.id,
        inventory_type: '소모성',
        item_code: item.code || null,
        item_name: item.name || item.item || null,
        quantity,
        issued_by: usedBy,
        issued_at: usedAt,
        status: 'USED',
        memo: memoText
      }));
      const { error: batchError } = await supabase.from('inventory_batch_items').insert(batchRows);
      if (batchError) throw batchError;

      const firstItemName = useItems[0].item.name || useItems[0].item.item || useItems[0].item.code || '소모성 자재';
      const totalUsedQuantity = useItems.reduce((sum, entry) => sum + entry.quantity, 0);
      const integratedItemName = useItems.length === 1
        ? `${firstItemName} ${useItems[0].quantity}개`
        : `${firstItemName} 외 ${useItems.length - 1}건`;
      const { error: logError } = await supabase.from('inventory_logs').insert([{
        inventory_id: null,
        item_name: `[소모성 사용] ${integratedItemName}`,
        type: '소모성 사용',
        quantity: totalUsedQuantity,
        worker_name: usedBy,
        issued_by: usedBy,
        returned_by: null,
        memo: `${memoText} / 총 ${totalUsedQuantity}개`,
        batch_id: batchId,
        is_new: true,
        created_at: usedAt
      }]);
      if (logError) throw logError;

      showCenterToast(`선택된 ${useItems.length}개 소모성 자재에서 총 ${totalUsedQuantity}개가 소모성 사용으로 처리되었습니다.`);
      setShowConsumableBatchModal(false);
      setSelectedConsumableIds([]);
      setConsumableBatchQuantities({});
      setConsumableBatchMemo('');
      await fetchInventory();
      await fetchInventoryLogs();
    } catch (err: any) {
      showCenterToast('소모성 자재 사용 처리 중 오류가 발생했습니다: ' + (err?.message || '알 수 없는 오류'));
    }
  };

  const toggleSelectFixedItem = (id: string | number) => {
    const strId = String(id);
    const target = inventoryList.find(item => String(item.id) === strId && item.type === '고정');
    const isSelected = selectedFixedIds.includes(strId);
    if (isSelected) {
      setSelectedFixedIds(prev => prev.filter(item => item !== strId));
      setFixedBatchQuantities(current => {
        const next = { ...current };
        delete next[strId];
        return next;
      });
      return;
    }
    setSelectedFixedIds(prev => [...prev, strId]);
    if (target) {
      setFixedBatchQuantities(current => ({ ...current, [strId]: Number(target.quantity || 0) > 0 ? 1 : 0 }));
    }
  };

  const openFixedBatchModal = () => {
    const selectedItems = inventoryList.filter(item =>
      item.type === '고정' && selectedFixedIds.includes(String(item.id))
    );
    const quantities: Record<string, number> = {};
    selectedItems.forEach(item => {
      const id = String(item.id);
      const available = Number(item.quantity || 0);
      const current = Number(fixedBatchQuantities[id] || 1);
      quantities[id] = available > 0 ? Math.max(1, Math.min(current, available)) : 0;
    });
    setFixedBatchQuantities(quantities);
    setShowFixedBatchModal(true);
  };

  const handleFixedBatchIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFixedIds.length === 0) return;

    try {
      const selectedItems = inventoryList.filter(item =>
        item.type === '고정' && selectedFixedIds.includes(String(item.id))
      );
      if (selectedItems.length === 0) return;

      const unavailable = selectedItems.filter(item => Number(item.quantity || 0) < 1);
      if (unavailable.length > 0) {
        showCenterToast(`보유수량이 없는 기자재 ${unavailable.length}건이 포함되어 있어 불출할 수 없습니다.`);
        return;
      }

      const issueItems = selectedItems.map(item => {
        const id = String(item.id);
        const available = Number(item.quantity || 0);
        const quantity = Number(fixedBatchQuantities[id] || 0);
        return { item, available, quantity };
      });

      const invalidQuantityItem = issueItems.find(({ quantity, available }) =>
        !Number.isInteger(quantity) || quantity < 1 || quantity > available
      );
      if (invalidQuantityItem) {
        showCenterToast(`${invalidQuantityItem.item.name || invalidQuantityItem.item.code || '기자재'}의 불출 수량은 1개 이상, 현재 보유수량 이하로 입력해주세요.`);
        return;
      }

      const batchId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `BATCH-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const issuedAt = new Date().toISOString();
      const issuedBy = currentUser?.name || '작업자';
      const memoText = fixedBatchMemo.trim() || '기자재 불출';

      for (const { item, quantity } of issueItems) {
        const { data: updatedRows, error: updateError } = await supabase
          .from('inventory')
          .update({ quantity: Number(item.quantity || 0) - quantity, updated_at: issuedAt })
          .eq('id', item.id)
          .gte('quantity', quantity)
          .select('id, quantity');
        if (updateError) throw updateError;
        if (!updatedRows || updatedRows.length === 0) {
          throw new Error(`${item.name || item.code || '기자재'}의 재고가 이미 변경되었습니다. 다시 확인해주세요.`);
        }
      }

      const batchRows = issueItems.map(({ item, quantity }) => ({
        batch_id: batchId,
        inventory_id: item.id,
        inventory_type: '고정',
        item_code: item.code || null,
        item_name: item.name || null,
        quantity,
        issued_by: issuedBy,
        issued_at: issuedAt,
        status: 'ISSUED',
        memo: memoText
      }));
      const { error: batchError } = await supabase.from('inventory_batch_items').insert(batchRows);
      if (batchError) throw batchError;

      const firstItemName = issueItems[0].item.name || issueItems[0].item.code || '기자재';
      const totalIssuedQuantity = issueItems.reduce((sum, entry) => sum + entry.quantity, 0);
      const integratedItemName = issueItems.length === 1
        ? `${firstItemName} ${issueItems[0].quantity}개`
        : `${firstItemName} 외 ${issueItems.length - 1}건`;
      const { error: logError } = await supabase.from('inventory_logs').insert([{
        inventory_id: null,
        item_name: `[기자재 불출] ${integratedItemName}`,
        type: '불출',
        quantity: totalIssuedQuantity,
        worker_name: issuedBy,
        issued_by: issuedBy,
        memo: `${memoText} / 총 ${totalIssuedQuantity}개`,
        batch_id: batchId,
        is_new: true,
        created_at: issuedAt
      }]);
      if (logError) throw logError;

      showCenterToast(`선택된 ${issueItems.length}개 기자재에서 총 ${totalIssuedQuantity}개가 일괄 불출되었습니다.`);
      setShowFixedBatchModal(false);
      setSelectedFixedIds([]);
      setFixedBatchQuantities({});
      setFixedBatchMemo('');
      await fetchInventory();
      await fetchInventoryLogs();
    } catch (err: any) {
      showCenterToast('기자재 일괄 불출 처리 중 오류가 발생했습니다: ' + (err?.message || '알 수 없는 오류'));
    }
  };

  const fetchReturnHistories = useCallback(async () => {
    setLoadingReturnHistories(true);
    try {
      const { data, error } = await supabase
        .from('inventory_return_history')
        .select('id, inventory_id, item_code, item_name, quantity, issued_by, returned_by, issued_at, returned_at, memo, created_at')
        .order('returned_at', { ascending: false });
      if (error) throw error;
      setReturnHistories((data || []) as InventoryReturnHistory[]);
    } catch (err: any) {
      showCenterToast('반납 이력 조회 실패: ' + (err?.message || '알 수 없는 오류'));
    } finally {
      setLoadingReturnHistories(false);
    }
  }, []);

  const handleBatchReturnById = async (batchId: string, customMemo?: string, hasIssue: boolean = false, perItemIssueIds?: string[]) => {
    if (!batchId || batchReturnProcessingId) return;

    const cleanBatchId = String(batchId).trim();
    if (!cleanBatchId) {
      showCenterToast('반납할 일괄 불출 번호가 없습니다.');
      return;
    }

    setBatchReturnProcessingId(cleanBatchId);

    try {
      const returnedBy = currentUser?.name || '작업자';
      let selectedIssueRows: any[] = [];
      if (perItemIssueIds && perItemIssueIds.length > 0) {
        const { data: batchRows, error: batchRowsError } = await supabase
          .from('inventory_batch_items')
          .select('inventory_id, inventory_type, item_code, item_name, quantity')
          .eq('batch_id', cleanBatchId)
          .eq('status', 'ISSUED')
          .in('inventory_id', perItemIssueIds);
        if (batchRowsError) throw batchRowsError;
        selectedIssueRows = batchRows || [];
      }

      const { data, error } = await supabase.rpc('return_inventory_batch', {
        p_batch_id: cleanBatchId,
        p_returned_by: returnedBy,
        p_memo: customMemo?.trim() || null,
        // 개별 이상 체크가 지정된 경우 전체 일괄 이력에 이상 표시하지 않고 품목별 기록을 남깁니다.
        p_has_issue: perItemIssueIds ? false : hasIssue,
      });

      if (error) {
        console.error('일괄 반납 RPC 오류:', error);
        showCenterToast(`일괄 반납 처리 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`);
        return;
      }

      const returnedCount = Number(data?.returned_count || 0);

      if (perItemIssueIds && selectedIssueRows.length > 0) {
        const issueAt = new Date().toISOString();
        const issueLogs = selectedIssueRows.map((row: any) => ({
          inventory_id: row.inventory_id,
          item_code: row.item_code || null,
          item_name: row.item_name || '품목명 미확인',
          type: '이상알림',
          quantity: Number(row.quantity || 1),
          worker_name: returnedBy,
          issued_by: returnedBy,
          returned_by: returnedBy,
          memo: `${customMemo?.trim() ? `${customMemo.trim()} / ` : ''}반납 시 개별 이상(결함) 체크`,
          batch_id: cleanBatchId,
          is_new: true,
          created_at: issueAt,
        }));
        const { error: issueLogError } = await supabase.from('inventory_logs').insert(issueLogs);
        if (issueLogError) {
          console.error('개별 이상알림 이력 저장 실패:', issueLogError);
          showCenterToast('반납은 완료됐지만 일부 이상알림 저장에 실패했습니다. 권한/RLS 설정을 확인해주세요.');
        }
      }

      showCenterToast(
        returnedCount > 0
          ? `일괄 불출된 ${returnedCount}개 품목이 모두 반납되었습니다.`
          : '일괄 반납 처리가 완료되었습니다.'
      );

      await Promise.all([
        fetchInventory(),
        fetchInventoryLogs(),
        fetchReturnHistories(),
      ]);
    } catch (err: any) {
      console.error('일괄 반납 예외 발생:', err);
      showCenterToast(`일괄 반납 처리 중 오류가 발생했습니다: ${err?.message || '알 수 없는 오류'}`);
    } finally {
      setBatchReturnProcessingId(null);
    }
  };
  
  const toggleSelectCabinItem = (id: string | number) => {
    const strId = String(id);
    setSelectedCabinIds(prev => 
      prev.includes(strId) ? prev.filter(item => item !== strId) : [...prev, strId]
    );
  };

  const handleCabinBatchIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCabinIds.length === 0) return;

    try {
      const selectedItems = cabinInventoryList.filter(item => selectedCabinIds.includes(String(item.id)));
      if (selectedItems.length === 0) return;

      const firstItemName = selectedItems[0].name || selectedItems[0].item || 'CABIN 품목';
      const integratedItemName = selectedItems.length === 1 
        ? firstItemName 
        : `${firstItemName} 외 ${selectedItems.length - 1}건`;

      const batchId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `CABIN-BATCH-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const issuedAt = new Date().toISOString();
      const issuedBy = currentUser?.name || '작업자';
      const batchMemo = cabinBatchMemo.trim() || 'CABIN 교정/작업용 일괄 불출';

      const { error: batchError } = await supabase.from('inventory_batch_items').insert(
        selectedItems.map(item => ({
          batch_id: batchId,
          inventory_id: item.id,
          inventory_type: 'CABIN',
          item_code: item.no || item.code || `CBN-${item.id}`,
          item_name: item.name || item.item || 'CABIN 품목',
          quantity: 1,
          issued_by: issuedBy,
          issued_at: issuedAt,
          status: 'ISSUED',
          memo: batchMemo
        }))
      );
      if (batchError) throw batchError;

      const { error: logError } = await supabase
        .from('inventory_logs')
        .insert([{
          inventory_id: null,
          item_name: `[CABIN 일괄 불출] ${integratedItemName}`,
          type: '불출',
          quantity: selectedItems.length,
          worker_name: issuedBy,
          issued_by: issuedBy,
          memo: batchMemo,
          batch_id: batchId,
          created_at: issuedAt
        }]);

      if (logError) throw logError;

      showCenterToast(`선택된 ${selectedItems.length}개 품목이 일괄 불출되었습니다.`);
      setShowCabinBatchModal(false);
      setSelectedCabinIds([]);
      setCabinBatchMemo('');
      await fetchInventoryLogs();
    } catch (err: any) {
      showCenterToast('CABIN 일괄 불출 처리 중 오류가 발생했습니다: ' + err.message);
    }
  };

  const handleCabinBatchReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCabinIds.length === 0) return;

    try {
      const { data: candidateRows, error: candidateError } = await supabase
        .from('inventory_batch_items')
        .select('batch_id, inventory_id, issued_at')
        .eq('inventory_type', 'CABIN')
        .eq('status', 'ISSUED')
        .in('inventory_id', selectedCabinIds)
        .order('issued_at', { ascending: false });
      if (candidateError) throw candidateError;

      const matchingBatchIds = Array.from(new Set((candidateRows || []).map((row: any) => row.batch_id).filter(Boolean)));
      let targetBatchId: string | null = null;
      for (const candidateBatchId of matchingBatchIds) {
        const { data: rows, error } = await supabase
          .from('inventory_batch_items')
          .select('inventory_id')
          .eq('batch_id', candidateBatchId)
          .eq('inventory_type', 'CABIN')
          .eq('status', 'ISSUED');
        if (error) throw error;
        const rowIds = (rows || []).map((row: any) => String(row.inventory_id));
        if (rowIds.length === selectedCabinIds.length && selectedCabinIds.every(id => rowIds.includes(String(id)))) {
          targetBatchId = candidateBatchId;
          break;
        }
      }

      if (!targetBatchId) {
        showCenterToast('선택한 CABIN 품목 중 동일한 일괄 불출 건으로 아직 반납되지 않은 품목을 찾을 수 없습니다. 최근 불출/반납 이력에서 일괄 반납을 진행해주세요.');
        return;
      }

      await handleBatchReturnById(targetBatchId, cabinBatchReturnMemo, cabinBatchReturnHasIssue, cabinBatchReturnHasIssue ? cabinBatchIssueIds : undefined);
      setShowCabinBatchReturnModal(false);
      setSelectedCabinIds([]);
      setCabinBatchReturnMemo('');
      setCabinBatchReturnHasIssue(false);
      setCabinBatchIssueIds([]);
    } catch (err: any) {
      showCenterToast('CABIN 일괄 반납 처리 중 오류가 발생했습니다: ' + (err?.message || '알 수 없는 오류'));
    }
  };

  const handleOpenReturnHistory = async () => {
    setSelectedReturnHistoryIds([]);
    setIsReturnHistoryOpen(true);
    await fetchReturnHistories();
  };

  const handleDeleteReturnHistory = async (id: string | number) => {
    if (!isAdmin) {
      showCenterToast('관리자 권한이 있는 인원만 반납 이력을 삭제할 수 있습니다.');
      return;
    }
    setPendingDeleteReturnHistoryId(id);
  };

  const executeDeleteReturnHistory = async () => {
    const id = pendingDeleteReturnHistoryId;
    if (id === null) return;
    setPendingDeleteReturnHistoryId(null);
    try {
      const { error } = await supabase
        .from('inventory_return_history')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setReturnHistories(prev => prev.filter(history => String(history.id) !== String(id)));
      setSelectedReturnHistoryIds(prev => prev.filter(item => String(item) !== String(id)));
      showCenterToast('반납 이력이 삭제되었습니다.');
    } catch (err: any) {
      showCenterToast('반납 이력 삭제 실패: ' + (err?.message || '알 수 없는 오류'));
    }
  };

  const toggleSelectAllReturnHistories = () => {
    if (selectedReturnHistoryIds.length === returnHistories.length) {
      setSelectedReturnHistoryIds([]);
    } else {
      setSelectedReturnHistoryIds(returnHistories.map(h => String(h.id)));
    }
  };

  const toggleSelectReturnHistory = (id: string | number) => {
    const strId = String(id);
    setSelectedReturnHistoryIds(prev =>
      prev.includes(strId) ? prev.filter(item => item !== strId) : [...prev, strId]
    );
  };

  const handleOpenBatchDeleteReturnHistories = () => {
    if (!isAdmin) return showCenterToast('관리자만 삭제할 수 있습니다.');
    if (selectedReturnHistoryIds.length === 0) return showCenterToast('삭제할 반납 이력을 선택해주세요.');
    setShowBatchDeleteReturnHistoryConfirm(true);
  };

  const executeBatchDeleteReturnHistories = async () => {
    setShowBatchDeleteReturnHistoryConfirm(false);
    try {
      const { error } = await supabase
        .from('inventory_return_history')
        .delete()
        .in('id', selectedReturnHistoryIds);
      if (error) throw error;

      showCenterToast('선택된 반납 이력이 삭제되었습니다.');
      setReturnHistories(prev => prev.filter(h => !selectedReturnHistoryIds.includes(String(h.id))));
      setSelectedReturnHistoryIds([]);
    } catch (err: any) {
      showCenterToast('반납 이력 일괄 삭제 실패: ' + err.message);
    }
  };

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetReturnLog || returnSubmittingRef.current) return;
    returnSubmittingRef.current = true;

    try {
      const qtyToReturn = Number(returnQty);
      if (qtyToReturn <= 0) {
        showCenterToast('반납 수량은 1 이상이어야 합니다.');
        return;
      }

      // 교정 반출은 일반 일괄 불출/반납 처리와 완전히 분리합니다.
      // 교정 반출 로그에도 batch_id가 있을 수 있으므로, 교정 건은 아래 별도 처리로 보냅니다.
      const isCalibrationReturn = String(targetReturnLog.type || '').includes('교정 반출');
      if (targetReturnLog.batch_id && !isCalibrationReturn) {
        const batchId = String(targetReturnLog.batch_id).trim();
        const batchQuantity = Number(targetReturnLog.quantity || 0);

        if (!batchId) {
          showCenterToast('일괄 불출 번호를 확인할 수 없습니다.');
          return;
        }

        if (batchQuantity > 0 && qtyToReturn !== batchQuantity) {
          showCenterToast(`일괄 불출 건은 전체 수량(${batchQuantity}개)을 한 번에 반납해야 합니다.`);
          return;
        }

        await handleBatchReturnById(batchId, returnMemo, returnHasIssue, returnBatchItems.length > 0 ? (returnHasIssue ? returnIssueItemIds : []) : undefined);
        setShowReturnModal(false);
        setTargetReturnLog(null);
        setReturnBatchItems([]);
        setReturnIssueItemIds([]);
        return;
      }

      let foundItem: any | null = null;
      
      if (targetReturnLog.inventory_id) {
        const { data: invData } = await supabase.from('inventory').select('*').eq('id', targetReturnLog.inventory_id).maybeSingle();
        if (invData) {
          foundItem = invData;
        } else {
          const { data: cabinData } = await supabase.from('cabin_inventory').select('*').eq('id', targetReturnLog.inventory_id).maybeSingle();
          if (cabinData) foundItem = { ...cabinData, type: 'CABIN', quantity: 1, unit: 'EA' };
        }
      }

      if (!foundItem) {
        const matchedInventoryItem = findInventoryItemForLog(targetReturnLog);
        if (matchedInventoryItem) {
          foundItem = matchedInventoryItem;
        } else if (targetReturnLog.item_name) {
          const { data: cabinDataByName } = await supabase.from('cabin_inventory').select('*').eq('item', targetReturnLog.item_name).limit(1);
          if (cabinDataByName && cabinDataByName.length > 0) {
            foundItem = { ...cabinDataByName[0], type: 'CABIN', quantity: 1, unit: 'EA' };
          }
        }
      }

      if (!foundItem) {
        showCenterToast(`'${targetReturnLog.item_name}'에 해당하는 자재 정보를 데이터베이스에서 찾을 수 없습니다.`);
        return;
      }

      if (foundItem.type === '소모성') {
        showCenterToast('소모성 자재는 반납 처리를 할 수 없습니다.');
        return;
      }

      // 교정 반입은 교정 반출 로그와 별도의 교정 반입 로그로 기록합니다.
      // inventory_return_history에는 절대 INSERT하지 않으며 일반 반납 RPC도 호출하지 않습니다.
      if (isCalibrationReturn) {
        const returnedAt = new Date().toISOString();
        const returnedBy = currentUser?.name || '작업자';
        const quantity = Number(qtyToReturn);

        if (foundItem.type !== 'CABIN') {
          const currentQty = Number(foundItem.quantity || 0);
          const initialQty = Number(foundItem.initial_quantity);
          if (Number.isFinite(initialQty) && initialQty >= 0 && currentQty + quantity > initialQty) {
            showCenterToast(`교정 반입 후 수량이 최초 보유수량(${initialQty} ${foundItem.unit || 'EA'})을 초과할 수 없습니다.`);
            return;
          }
          const { error: inventoryUpdateError } = await supabase
            .from('inventory')
            .update({ quantity: currentQty + quantity, updated_at: returnedAt })
            .eq('id', foundItem.id);
          if (inventoryUpdateError) throw inventoryUpdateError;
        }

        const { error: calibrationInboundError } = await supabase
          .from('inventory_logs')
          .insert([{
            inventory_id: targetReturnLog.inventory_id || foundItem.id || null,
            item_code: targetReturnLog.item_code || foundItem.code || foundItem.no || null,
            item_name: targetReturnLog.item_name || foundItem.name || foundItem.item || '교정 자재',
            type: returnHasIssue ? '교정 반입, 이상알림' : '교정 반입',
            quantity,
            worker_name: returnedBy,
            issued_by: targetReturnLog.issued_by || targetReturnLog.worker_name || '불출자 미기록',
            returned_by: returnedBy,
            memo: returnMemo.trim() ? `교정 반입 메모: ${returnMemo.trim()}` : targetReturnLog.memo || null,
            batch_id: targetReturnLog.batch_id || null,
            is_new: true,
            created_at: returnedAt
          }]);
        if (calibrationInboundError) throw calibrationInboundError;

        // 원래 교정 반출 로그를 완료 상태로 표시해 재반입 버튼이 다시 나타나지 않게 합니다.
        const { error: calibrationOutboundUpdateError } = await supabase
          .from('inventory_logs')
          .update({
            type: '교정 반출, 교정 반입완료',
            returned_by: returnedBy,
            is_new: true,
            updated_at: returnedAt
          })
          .eq('id', targetReturnLog.id);
        if (calibrationOutboundUpdateError) throw calibrationOutboundUpdateError;

        if (targetReturnLog.batch_id) {
          const { error: batchItemUpdateError } = await supabase
            .from('inventory_batch_items')
            .update({ status: 'RETURNED', returned_by: returnedBy, returned_at: returnedAt })
            .eq('batch_id', String(targetReturnLog.batch_id))
            .eq('inventory_id', targetReturnLog.inventory_id)
            .eq('status', 'ISSUED');
          if (batchItemUpdateError) throw batchItemUpdateError;
        }

        showCenterToast('교정 반입이 완료되었습니다. 교정 이력에 별도로 기록했습니다.');
        setShowReturnModal(false);
        setTargetReturnLog(null);
        if (foundItem.type === 'CABIN') await fetchCabinInventory();
        else await fetchInventory();
        await fetchInventoryLogs();
        return;
      }

      if (foundItem.type !== 'CABIN') {
        const currentQty = Number(foundItem.quantity || 0);
        const initialQty = Number(foundItem.initial_quantity);

        if (Number.isFinite(initialQty) && initialQty >= 0 && currentQty + qtyToReturn > initialQty) {
          showCenterToast(`반납 후 수량이 최초 보유수량(${initialQty} ${foundItem.unit || 'EA'})을 초과할 수 없습니다.`);
          return;
        }

        const { error: invErr } = await supabase
          .from('inventory')
          .update({ quantity: currentQty + qtyToReturn, updated_at: new Date().toISOString() })
          .eq('id', foundItem.id);
        if (invErr) throw invErr;
      }

      const finalLogType = returnHasIssue ? '불출, 반납완료, 이상알림' : '불출, 반납완료';
      const memoText = returnMemo.trim() ? `반납메모: ${returnMemo.trim()}` : targetReturnLog.memo;
      const returnHistoryIssuedBy = targetReturnLog.issued_by || targetReturnLog.worker_name || '불출자 미기록';
      const returnHistoryItemCode = targetReturnLog.item_code || foundItem.code || foundItem.no || null;
      const returnHistoryIssuedAt = targetReturnLog.created_at || null;
      const returnHistoryReturnedAt = new Date().toISOString();

      const { error: logErr } = await supabase
        .from('inventory_logs')
        .update({ 
          type: finalLogType, 
          quantity: qtyToReturn, 
          returned_by: currentUser?.name || '작업자',
          memo: memoText,
          is_new: true,
          updated_at: new Date().toISOString() 
        })
        .eq('id', targetReturnLog.id);
      if (logErr) throw logErr;

      const { error: returnHistoryError } = await supabase
        .from('inventory_return_history')
        .insert([{
          inventory_id: foundItem.id ?? targetReturnLog.inventory_id ?? null,
          item_code: returnHistoryItemCode,
          item_name: targetReturnLog.item_name || foundItem.name || foundItem.item || null,
          quantity: qtyToReturn,
          issued_by: returnHistoryIssuedBy,
          returned_by: currentUser?.name || '작업자',
          issued_at: returnHistoryIssuedAt,
          returned_at: returnHistoryReturnedAt,
          memo: memoText || null,
          created_at: returnHistoryReturnedAt
        }]);
      if (returnHistoryError) throw returnHistoryError;

      showCenterToast('반납 처리가 완료되었습니다.');
      setShowReturnModal(false);
      if (foundItem.type === 'CABIN') {
        await fetchCabinInventory();
      } else {
        await fetchInventory();
      }
      await fetchInventoryLogs();
    } catch (err: any) {
      showCenterToast('반납 처리 중 오류가 발생했습니다: ' + err.message);
    } finally {
      returnSubmittingRef.current = false;
    }
  };

  const handleOpenReturnModal = async (log: InventoryLog) => {
    setTargetReturnLog(log);
    setReturnQty(log.quantity || 1);
    setReturnHasIssue(false);
    setReturnMemo('');
    setReturnBatchItems([]);
    setReturnIssueItemIds([]);
    setShowReturnModal(true);
    if (log.batch_id) {
      try {
        const { data, error } = await supabase
          .from('inventory_batch_items')
          .select('inventory_id, inventory_type, item_code, item_name, quantity')
          .eq('batch_id', String(log.batch_id))
          .eq('status', 'ISSUED')
          .order('item_name', { ascending: true });
        if (error) throw error;
        setReturnBatchItems(data || []);
      } catch (error: any) {
        showCenterToast('불출 품목 목록 조회 실패: ' + (error?.message || '알 수 없는 오류'));
      }
    }
  };

  const handleOpenEditLog = (log: InventoryLog) => {
    if (!isAdmin) {
      showCenterToast('관리자 권한이 있는 인원만 수정할 수 있습니다.');
      return;
    }
    setTargetEditLog(log);
    setEditLogQty(log.quantity || 1);
    setEditLogMemo(log.memo || '');
    setShowEditLogModal(true);
  };

  const handleSubmitEditLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEditLog) return;

    try {
      const newQty = Number(editLogQty);
      if (newQty <= 0) {
        showCenterToast('수량은 1 이상이어야 합니다.');
        return;
      }

      const { error } = await supabase
        .from('inventory_logs')
        .update({ 
          quantity: newQty, 
          memo: editLogMemo.trim() || null,
          updated_at: new Date().toISOString() 
        })
        .eq('id', targetEditLog.id);

      if (error) throw error;

      showCenterToast('불출/반납 이력이 수정되었습니다.');
      setShowEditLogModal(false);
      setTargetEditLog(null);
      await fetchInventoryLogs();
    } catch (err: any) {
      showCenterToast('이력 수정 실패: ' + err.message);
    }
  };

  const handleOpenDeleteLog = (logId: string | number) => {
    if (!isAdmin) {
      showCenterToast('관리자 권한이 있는 인원만 삭제할 수 있습니다.');
      return;
    }
    setPendingDeleteLogId(logId);
  };

  const executeDeleteLog = async () => {
    const logId = pendingDeleteLogId;
    if (logId === null || logId === undefined) return;
    setPendingDeleteLogId(null);

    try {
      const { error } = await supabase
        .from('inventory_logs')
        .delete()
        .eq('id', logId);
      if (error) throw error;
      showCenterToast('이력이 삭제되었습니다.');
      await fetchInventoryLogs();
    } catch (err: any) {
      showCenterToast('이력 삭제 실패: ' + err.message);
    }
  };

  const handleOpenBatchDeleteLogs = () => {
    if (!isAdmin) return showCenterToast('관리자만 삭제할 수 있습니다.');
    if (selectedLogIds.length === 0) return showCenterToast('삭제할 이력을 선택해주세요.');
    setShowBatchDeleteConfirm(true);
  };

  const executeBatchDeleteLogs = async () => {
    setShowBatchDeleteConfirm(false);

    try {
      const { error } = await supabase
        .from('inventory_logs')
        .delete()
        .in('id', selectedLogIds);
      if (error) throw error;

      showCenterToast('선택된 이력이 삭제되었습니다.');
      setSelectedLogIds([]);
      await fetchInventoryLogs();
    } catch (err: any) {
      showCenterToast('일괄 삭제 실패: ' + err.message);
    }
  };

  const toggleSelectAllLogs = () => {
    const visibleLogs = inventoryLogs.filter(log => !log.type.includes('반납완료'));
    if (visibleLogs.length > 0 && visibleLogs.every(log => selectedLogIds.includes(String(log.id)))) {
      setSelectedLogIds([]);
    } else {
      setSelectedLogIds(visibleLogs.map(l => String(l.id)));
    }
  };

  const toggleSelectLog = (id: string | number) => {
    const strId = String(id);
    setSelectedLogIds(prev => 
      prev.includes(strId) ? prev.filter(item => item !== strId) : [...prev, strId]
    );
  };

  // 현재 화면의 목록과 무관하게 전체 등록 데이터를 기준으로 Excel을 생성합니다.
  const exportInventoryExcel = async (target: '전체' | '기자재' | 'CABIN') => {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'MP-LNG 기자재 관리';
      workbook.subject = '기자재 및 CABIN 현황';
      workbook.title = target === 'CABIN' ? 'Instrument calibration certificate' : '기자재 현황';

      const safeSheetName = (raw: string, used: Set<string>) => {
        let base = String(raw || '기타').replace(/[\\/*?:\[\]]/g, '_').trim() || '기타';
        base = base.slice(0, 31);
        let name = base;
        let index = 2;
        while (used.has(name.toLowerCase())) {
          const suffix = `_${index++}`;
          name = `${base.slice(0, 31 - suffix.length)}${suffix}`;
        }
        used.add(name.toLowerCase());
        return name;
      };
      const usedSheetNames = new Set<string>();
      const centerAlignment = { vertical: 'middle' as const, horizontal: 'center' as const, wrapText: true };
      const grayFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE7E9EC' } };
      const border = {
        top: { style: 'thin' as const, color: { argb: 'FFB8BEC7' } },
        bottom: { style: 'thin' as const, color: { argb: 'FFB8BEC7' } },
        left: { style: 'thin' as const, color: { argb: 'FFB8BEC7' } },
        right: { style: 'thin' as const, color: { argb: 'FFB8BEC7' } },
      };
      const setTableCellStyle = (cell: ExcelJS.Cell, bold = false, gray = false) => {
        cell.font = { name: '맑은 고딕', size: 9, bold };
        cell.alignment = centerAlignment;
        cell.border = border;
        if (gray) cell.fill = grayFill;
      };
      const autoWidth = (sheet: ExcelJS.Worksheet, minWidth = 8, maxWidth = 42) => {
        sheet.columns.forEach((column) => {
          let maxLength = 0;
          column.eachCell?.({ includeEmpty: true }, (cell) => {
            const value = cell.value == null ? '' : String(cell.value);
            maxLength = Math.max(maxLength, ...value.split('\n').map(line => line.length));
          });
          column.width = Math.min(maxWidth, Math.max(minWidth, maxLength + 3));
        });
      };

      if (target === '전체' || target === '기자재') {
        const equipment = inventoryList.filter(item => item.type === '고정');
        const categories = Array.from(new Set(equipment.map(item => String(item.category || '기타').trim() || '기타')))
          .sort((a, b) => a.localeCompare(b, 'ko-KR'));
        // 등록된 세부 카테고리가 아직 품목이 없어도 시트로 보이도록 포함합니다.
        const equipmentSheets = Array.from(new Set([...categories, ...fixedSubCategories]))
          .filter(Boolean).sort((a, b) => a.localeCompare(b, 'ko-KR'));
        for (const category of equipmentSheets) {
          const rows = equipment.filter(item => String(item.category || '기타').trim() === category);
          if (rows.length === 0 && !categories.includes(category)) continue;
          const sheet = workbook.addWorksheet(safeSheetName(category, usedSheetNames));
          sheet.mergeCells(1, 1, 1, 9);
          const title = sheet.getCell(1, 1);
          title.value = '기자재 현황';
          title.font = { name: 'HY헤드라인M', size: 20, bold: false };
          title.alignment = centerAlignment;
          title.border = border;
          sheet.getRow(1).height = 42; // 약 56px
          const headers = ['No.', '구분', '자재명', '품목명', '수량', 'S/N', '교정일', '차기교정일', '비고'];
          sheet.addRow(headers);
          sheet.getRow(2).height = 24;
          sheet.getRow(2).eachCell((cell) => { setTableCellStyle(cell, true, true); cell.font = { name: '맑은 고딕', size: 10, bold: true }; });
          const getNameCategory = (item: any) => itemSubCategoryRows.find((entry: any) =>
            entry.inventory_type === item.type &&
            entry.parent_category === item.category &&
            String(entry.material_name || '').trim() === String(item.name || item.item || '').trim() &&
            entry.is_active !== false
          )?.name || '';
          rows.sort((a, b) =>
            String(a.category || '').localeCompare(String(b.category || ''), 'ko-KR') ||
            String(getNameCategory(a)).localeCompare(String(getNameCategory(b)), 'ko-KR') ||
            String(a.name || a.item || '').localeCompare(String(b.name || b.item || ''), 'ko-KR') ||
            String(a.serial_number || a.code || '').localeCompare(String(b.serial_number || b.code || ''), 'ko-KR')
          ).forEach((item, index) => {
            const { calDate, nextCalDate } = parseCalDates(item.sub_equipment);
            const serial = item.serial_number || ((item.category === '압력계' || item.category === 'VBT') ? item.code : '') || '';
            const materialNameCategory = getNameCategory(item);
            const itemName = String(item.name || item.item || '').trim();
            const distinction = String(item.category || '').trim();
            const note = (item as any).note || (item as any).memo || (item as any).remarks || '';
            const row = sheet.addRow([index + 1, distinction, materialNameCategory, itemName, Number(item.quantity || 0), serial, calDate, nextCalDate, note]);
            row.height = 21;
            row.eachCell((cell, colNumber) => setTableCellStyle(cell, false, colNumber === 1));
          });
          const lastRow = Math.max(2, sheet.rowCount);
          sheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: lastRow, column: 9 } };
          autoWidth(sheet, 8, 32);
          sheet.getColumn(1).width = Math.max(8, sheet.getColumn(1).width || 8);
          sheet.views = [{ state: 'frozen', ySplit: 2 }];
        }
      }

      if (target === '전체' || target === 'CABIN') {
        // CABIN 탭을 열기 전에도 드롭다운에서 바로 내려받을 수 있도록 필요할 때만 자료를 조회합니다.
        let cabin = cabinInventoryList.slice();
        if (cabin.length === 0) {
          const { data, error } = await supabase
            .from('cabin_inventory')
            .select('id, no, item, sheet_name, location_or_section, maker_model, serial_number, cert_no, calibration_date');
          if (error) throw error;
          cabin = (data || []).map((row: any) => ({
            ...row,
            type: 'CABIN',
            code: row.no || `CBN-${row.id}`,
            name: row.item || '제목 없음',
            category: row.sheet_name || '기타',
            quantity: 1,
            unit: 'EA',
            location: row.location_or_section || 'CABIN',
            sub_equipment: row.calibration_date ? `${row.calibration_date}` : null,
          }));
        }
        const sheets = Array.from(new Set([
          ...customCabinSheets,
          ...cabin.map(item => cleanSheetName(String(item.sheet_name || item.category || '기타'))),
        ])).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ko-KR'));
        for (const category of sheets) {
          const rows = cabin.filter(item => cleanSheetName(String(item.sheet_name || item.category || '기타')) === category)
            .sort((a, b) => compareCabinIdentifier(a.no, b.no));
          if (!rows.length) continue;
          const sheet = workbook.addWorksheet(safeSheetName(category, usedSheetNames));
          sheet.mergeCells(1, 1, 1, 6);
          const title = sheet.getCell(1, 1);
          title.value = 'Instrument calibration certificate';
          title.font = { name: 'HY헤드라인M', size: 20, bold: false };
          title.alignment = centerAlignment;
          title.border = border;
          sheet.getRow(1).height = 42; // 약 56px
          const headers = ['No.', 'ITEM', 'MAKER/MODEL', 'Serial No(S/N)', '성적서 번호(Cert.No.)', '교정일(Date of Calibration)'];
          sheet.addRow(headers);
          sheet.getRow(2).height = 24;
          sheet.getRow(2).eachCell((cell) => { setTableCellStyle(cell, true, true); cell.font = { name: '맑은 고딕', size: 10, bold: true }; });
          let sequence = 1;
          const itemNames = Array.from(new Set(rows.map(item => String(item.item || item.name || '제목 없음').trim()))).sort((a, b) => a.localeCompare(b, 'ko-KR'));
          for (const itemName of itemNames) {
            const group = rows.filter(item => String(item.item || item.name || '제목 없음').trim() === itemName);
            const subtitleRow = sheet.addRow([itemName]);
            sheet.mergeCells(subtitleRow.number, 1, subtitleRow.number, 6);
            subtitleRow.height = 30; // 약 40px
            const subtitle = sheet.getCell(subtitleRow.number, 1);
            subtitle.font = { name: '맑은 고딕', size: 16, bold: false };
            subtitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            subtitle.border = border;
            for (const item of group) {
              const row = sheet.addRow([sequence++, item.item || item.name || '', item.maker_model || '', item.serial_number || '', item.cert_no || '', item.calibration_date || '']);
              row.height = 21;
              row.eachCell((cell, colNumber) => setTableCellStyle(cell, false, colNumber === 1));
            }
          }
          // 데이터 표 전체에 자동 필터를 설정해 품목별 데이터도 Excel에서 검색/정렬할 수 있게 합니다.
          if (sheet.rowCount >= 3) sheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: sheet.rowCount, column: 6 } };
          autoWidth(sheet, 8, 26);
          sheet.views = [{ state: 'frozen', ySplit: 2 }];
        }
      }

      if (workbook.worksheets.length === 0) {
        showCenterToast('Excel로 내려받을 등록 자료가 없습니다.');
        return;
      }
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      const date = new Date();
      const dateText = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
      anchor.download = `${target === 'CABIN' ? 'CABIN_Instrument_calibration_certificate' : target === '기자재' ? '기자재_현황' : '기자재_CABIN_현황'}_${dateText}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setShowExcelDownloadMenu(false);
      showCenterToast('Excel 파일 내려받기가 완료되었습니다.');
    } catch (error: any) {
      console.error('기자재/CABIN Excel 다운로드 실패:', error);
      showCenterToast(`Excel 내려받기 실패: ${error?.message || '알 수 없는 오류'}`);
    }
  };


  const filteredInventory = useMemo(() => {
    let result: any[] = [];

    if (inventoryTab === 'CABIN') {
      result = cabinInventoryList.filter(item => {
        const itemCleanSheet = cleanSheetName(item.sheet_name);
        const matchesSheet = itemCleanSheet === selectedCabinSheet;
        if (!matchesSheet) return false;

        if (cabinCalibrationOnly && !item.calibration_date) {
          return false;
        }

        return true;
      });
    } else if (inventoryTab === '소모성') {
      const consumables = inventoryList.filter(i => i.type === '소모성');
      result = selectedConsumableCategory === '전체 보기' ? consumables : consumables.filter(item => item.category === selectedConsumableCategory);
    } else {
      const baseFixed = inventoryList.filter(i => i.type === '고정');

      result = baseFixed.filter(item => {
        const cat = item.category || '';
        const name = item.name || '';
        const vbtType = item.vbt_type || '';
        const { calDate, nextCalDate } = parseCalDates(item.sub_equipment);

        if (selectedFixedSubCategory === '전체 보기') return true;

        if (selectedFixedSubCategory === '교정') {
          return Boolean(calDate || nextCalDate);
        }

        if (selectedFixedSubCategory === 'VBT') {
if (cat !== 'VBT') return false;
          const fullText = `${vbtType} ${name} ${item.sub_equipment || ''}`.toUpperCase();
          const knownVbtTypes = ['1L', '1S', '2L', '2S', 'FLAT'];

          if (selectedVbtSubCategory === '기타') {
            return !knownVbtTypes.some(type => fullText.includes(type));
          }
          return fullText.includes(selectedVbtSubCategory);
        }

        return selectedFixedSubCategory === '전체 보기' ? true : cat === selectedFixedSubCategory;
      });
    }

    if (selectedItemSubCategory !== '전체 보기') {
      const selectedEntry = currentItemSubCategoryEntries.find(entry => entry.name === selectedItemSubCategory);
      if (selectedEntry) {
        const materialNames = new Set(selectedEntry.materialNames);
        result = result.filter(item => {
          const itemName = inventoryTab === 'CABIN' ? item.item : item.name;
          return materialNames.has(String(itemName || '').trim());
        });
      }
    }

    if (inventoryTab === 'CABIN') {
      result = result.slice().sort((a, b) => compareCabinIdentifier(a.no, b.no));
    }

    return result;
  }, [
    inventoryTab,
    inventoryList,
    cabinInventoryList,
    selectedConsumableCategory,
    selectedFixedSubCategory,
    selectedVbtSubCategory,
    selectedCabinSheet,
    cabinCalibrationOnly,
    selectedItemSubCategory,
    currentItemSubCategoryEntries
  ]);

  const inventoryListPageSize = 20;
  const inventoryListPageCount = Math.max(1, Math.ceil(filteredInventory.length / inventoryListPageSize));
  const paginatedInventory = filteredInventory.slice((inventoryListPage - 1) * inventoryListPageSize, inventoryListPage * inventoryListPageSize);

  useEffect(() => { setInventoryListPage(1); }, [inventoryTab, selectedFixedSubCategory, selectedConsumableCategory, selectedCabinSheet, selectedItemSubCategory, selectedVbtSubCategory, cabinCalibrationOnly]);
  useEffect(() => { if (inventoryListPage > inventoryListPageCount) setInventoryListPage(inventoryListPageCount); }, [inventoryListPage, inventoryListPageCount]);

  const toggleSelectAllConsumable = () => {
    if (selectedConsumableIds.length === filteredInventory.length) {
      setSelectedConsumableIds([]);
      setConsumableBatchQuantities({});
    } else {
      const ids = filteredInventory.map(item => String(item.id));
      const quantities: Record<string, number> = {};
      filteredInventory.forEach(item => {
        quantities[String(item.id)] = Number(item.quantity || 0) > 0 ? 1 : 0;
      });
      setSelectedConsumableIds(ids);
      setConsumableBatchQuantities(quantities);
    }
  };

  const toggleSelectAllFixed = () => {
    if (selectedFixedIds.length === filteredInventory.length) {
      setSelectedFixedIds([]);
      setFixedBatchQuantities({});
    } else {
      const ids = filteredInventory.map(item => String(item.id));
      const quantities: Record<string, number> = {};
      filteredInventory.forEach(item => {
        quantities[String(item.id)] = Math.max(1, Math.min(1, Number(item.quantity || 0)));
      });
      setSelectedFixedIds(ids);
      setFixedBatchQuantities(quantities);
    }
  };

  const toggleSelectAllCabin = () => {
    if (selectedCabinIds.length === filteredInventory.length) {
      setSelectedCabinIds([]);
    } else {
      setSelectedCabinIds(filteredInventory.map(item => String(item.id)));
    }
  };

  const currentActiveSubCatName = getCurrentSelectedCategory();
  // 반납완료 건은 별도 반납 이력 화면에서 확인합니다. 화면 필터는 이미 받아온 데이터에만 적용해 추가 Supabase 호출을 만들지 않습니다.
  const recentInventoryLogs = useMemo(
    () => inventoryLogs.filter(log => !log.type.includes('반납완료')),
    [inventoryLogs]
  );
  const equipmentHistoryCategories = useMemo(() => Array.from(new Set(
    inventoryList.filter(item => item.type === '고정' && item.category).map(item => String(item.category))
  )).sort((a, b) => a.localeCompare(b, 'ko-KR')), [inventoryList]);
  const filteredRecentInventoryLogs = useMemo(() => recentInventoryLogs.filter(log => {
    const matched = findInventoryItemForLog(log);
    const name = String(log.item_name || '');
    const isConsumable = matched?.type === '소모성' || log.type.includes('소모성 사용') || name.startsWith('[소모성 사용]');
    const isCabin = name.startsWith('[CABIN') || matched?.type === 'CABIN';
    const isEquipment = matched?.type === '고정' || name.startsWith('[기자재 불출]') || log.type.includes('교정');
    const isCalibration = log.type.includes('교정') || (matched?.type === '고정' && isCalibrationItem(matched));
    if (historyTypeFilter === '기자재' && (!isEquipment || isCalibration)) return false;
    if (historyTypeFilter === '소모성' && !isConsumable) return false;
    // 상단 '교정 반입' 바로가기는 실제 교정 반입 완료 행만 표시합니다.
    // 원래 교정 반출 행은 재처리를 막기 위해 '교정 반입완료' 상태로 갱신되지만,
    // 교정 반입 이력에는 포함하지 않습니다. 반입 기록 1건만 보여줍니다.
    if (historyTypeFilter === '교정반입완료') {
      const logType = String(log.type || '');
      if (!logType.includes('교정 반입') || logType.includes('교정 반출')) return false;
    }
    // 필터 탭 '교정 반출'은 교정 반출 기록만 표시합니다.
    if (historyTypeFilter === '교정' && !log.type.includes('교정 반출')) return false;
    if (historyTypeFilter === 'CABIN' && !isCabin) return false;
    if (historyCategoryFilter !== '전체' && historyTypeFilter === '기자재') {
      // 일괄 불출 로그는 inventory_id가 없으므로 종류 필터에서도 숨기지 않습니다.
      if (matched && String(matched.category || '기타') !== historyCategoryFilter) return false;
    }
    return true;
  }), [recentInventoryLogs, findInventoryItemForLog, historyTypeFilter, historyCategoryFilter]);
  const filteredReturnHistories = useMemo(() => returnHistories.filter(history => {
    // 교정 반입 기록은 별도 교정 이력에서만 보여줍니다. 과거에 반납 이력에도 잘못 저장된 건은
    // 자재 ID/코드, 수량, 기록 시각을 함께 비교해 중복 노출을 막습니다.
    const isCalibrationInbound = inventoryLogs.some(log => {
      if (!String(log.type || '').includes('교정 반입')) return false;
      if (Number(history.quantity || 0) !== Number(log.quantity || 0)) return false;
      const sameId = history.inventory_id != null && log.inventory_id != null && String(history.inventory_id) === String(log.inventory_id);
      const sameCode = Boolean(history.item_code && log.item_code && String(history.item_code) === String(log.item_code));
      if (!sameId && !sameCode) return false;
      if (history.returned_at && log.created_at) {
        const delta = Math.abs(new Date(history.returned_at).getTime() - new Date(log.created_at).getTime());
        return Number.isFinite(delta) && delta < 5 * 60 * 1000;
      }
      return sameId || sameCode;
    });
    if (isCalibrationInbound) return false;
    if (returnHistoryCategoryFilter === '전체') return true;
    const matched = inventoryList.find(item =>
      (history.inventory_id != null && String(item.id) === String(history.inventory_id)) ||
      (history.item_code && String(item.code || item.no || '') === String(history.item_code))
    );
    return String(matched?.category || matched?.sheet_name || '기타') === returnHistoryCategoryFilter;
  }), [returnHistories, inventoryList, inventoryLogs, returnHistoryCategoryFilter]);
  return (
    <div className="w-full max-w-full overflow-x-hidden text-[#1F2937] space-y-3 font-sans box-border relative pb-28">
      
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#E2E5E9] max-w-sm w-full p-5 shadow-2xl space-y-4 text-[#1F2937]">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-red-50 rounded-xl text-red-600 border border-red-100">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold">{confirmModal.title}</h3>
                <p className="text-xs text-[#64748B] whitespace-pre-wrap mt-0.5">{confirmModal.message}</p>
              </div>
            </div>
            <div className="flex space-x-2 pt-2">
              <button type="button" onClick={() => setConfirmModal({ isOpen: false, title: '', message: '' })} className="flex-1 py-2.5 px-4 bg-[#F5F6F8] text-[#1F2937] hover:bg-[#E2E5E9] text-xs font-semibold rounded-lg transition border border-[#E2E5E9]">취소</button>
              <button type="button" onClick={async () => { const action = confirmModal.onConfirm; setConfirmModal({ isOpen: false, title: '', message: '' }); if (action) await action(); }} className="flex-1 py-2.5 px-4 bg-[#DC2626] text-white hover:bg-red-700 text-xs font-bold rounded-lg transition shadow-xs">확인</button>
            </div>
          </div>
        </div>
      )}

      <div
        aria-live="polite"
        className={`fixed right-3 bottom-24 sm:bottom-5 z-[200] w-[calc(100%-1.5rem)] sm:w-auto sm:max-w-sm transition-all duration-300 ease-out ${toastMessage ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0 pointer-events-none'}`}
      >
        {toastMessage && (
          <div className="bg-[#243B5A] text-white px-4 py-3 rounded-xl shadow-xl flex items-start gap-2.5 text-xs sm:text-sm font-semibold border border-slate-600">
            <CheckCircle2 className="h-4 w-4 text-emerald-300 shrink-0 mt-0.5" />
            <span className="whitespace-normal break-words leading-relaxed min-w-0">{toastMessage}</span>
          </div>
        )}
      </div>

      {/* 소모성 자재 일괄 사용 모달 */}
      {showConsumableBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#E2E5E9] max-w-sm w-full p-5 shadow-2xl space-y-4 text-[#1F2937]">
            <div className="flex justify-between items-center pb-2 border-b border-[#E2E5E9]">
              <h3 className="text-sm font-bold">소모성 자재 일괄 사용</h3>
              <button type="button" onClick={() => setShowConsumableBatchModal(false)}><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleConsumableBatchIssue} className="space-y-3 text-xs">
              <div className="bg-blue-50 p-2.5 rounded-md border border-blue-200 space-y-1">
                <span className="text-[10px] text-blue-700 block font-semibold">선택된 소모성 자재</span>
                <p className="font-bold text-blue-900 text-sm">총 {selectedConsumableIds.length}건 일괄 사용</p>
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                <label className="block text-[#64748B] font-semibold mb-1">품목별 사용 수량</label>
                {inventoryList
                  .filter(item => item.type === '소모성' && selectedConsumableIds.includes(String(item.id)))
                  .map(item => {
                    const id = String(item.id);
                    const available = Number(item.quantity || 0);
                    const quantity = Number(consumableBatchQuantities[id] || 0);
                    return (
                      <div key={id} className="flex items-center justify-between gap-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md px-2.5 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-[#1F2937] truncate">{item.name || item.item || item.code || '소모성 자재'}</p>
                          <p className="text-[10px] text-[#64748B]">보유수량: {available} {item.unit || 'EA'}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="number"
                            min={available > 0 ? 1 : 0}
                            max={available}
                            step={1}
                            value={quantity}
                            onChange={e => {
                              const next = Number(e.target.value);
                              setConsumableBatchQuantities(prev => ({ ...prev, [id]: Number.isFinite(next) ? next : 0 }));
                            }}
                            className="w-16 px-2 py-1.5 text-center bg-white border border-[#CBD5E1] rounded-md text-xs font-bold text-[#1F2937]"
                          />
                          <span className="text-[10px] text-[#64748B]">{item.unit || 'EA'}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-md px-2.5 py-2 text-[10px] text-amber-800">
                소모성 자재는 반납하지 않으며, 처리 후 <strong>소모성 사용</strong>으로 종료됩니다.
              </div>
              <div>
                <label className="block text-[#64748B] font-semibold mb-1">사용 메모 / 목적</label>
                <input type="text" placeholder="예: 검사 작업용 소모성 자재 일괄 사용" value={consumableBatchMemo} onChange={e => setConsumableBatchMemo(e.target.value)} className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]" />
              </div>
              <div className="flex space-x-2 pt-2">
                <button type="button" onClick={() => setShowConsumableBatchModal(false)} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-[#64748B] font-semibold text-xs rounded-lg transition">취소</button>
                <button type="submit" className="flex-1 py-2 bg-[#243B5A] hover:bg-[#1d3049] text-white font-semibold text-xs rounded-lg transition">일괄 사용 확정</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 기자재 일괄 불출 모달 */}
      {showFixedBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#E2E5E9] max-w-sm w-full p-5 shadow-2xl space-y-4 text-[#1F2937]">
            <div className="flex justify-between items-center pb-2 border-b border-[#E2E5E9]">
              <h3 className="text-sm font-bold">기자재 일괄 불출</h3>
              <button type="button" onClick={() => setShowFixedBatchModal(false)}><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleFixedBatchIssue} className="space-y-3 text-xs">
              <div className="bg-blue-50 p-2.5 rounded-md border border-blue-200 space-y-1">
                <span className="text-[10px] text-blue-700 block font-semibold">선택된 기자재</span>
                <p className="font-bold text-blue-900 text-sm">총 {selectedFixedIds.length}건 일괄 불출</p>
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                <label className="block text-[#64748B] font-semibold mb-1">품목별 불출 수량</label>
                {inventoryList
                  .filter(item => item.type === '고정' && selectedFixedIds.includes(String(item.id)))
                  .map(item => {
                    const id = String(item.id);
                    const available = Number(item.quantity || 0);
                    const quantity = Number(fixedBatchQuantities[id] || 0);
                    return (
                      <div key={id} className="flex items-center justify-between gap-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md px-2.5 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-[#1F2937] truncate">{item.name || item.code || '기자재'}</p>
                          <p className="text-[10px] text-[#64748B]">보유수량: {available} {item.unit || 'EA'}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="number"
                            min={available > 0 ? 1 : 0}
                            max={available}
                            step={1}
                            value={quantity}
                            onChange={e => {
                              const next = Number(e.target.value);
                              setFixedBatchQuantities(prev => ({ ...prev, [id]: Number.isFinite(next) ? next : 0 }));
                            }}
                            className="w-16 px-2 py-1.5 text-center bg-white border border-[#CBD5E1] rounded-md text-xs font-bold text-[#1F2937]"
                          />
                          <span className="text-[10px] text-[#64748B]">{item.unit || 'EA'}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
              <div>
                <label className="block text-[#64748B] font-semibold mb-1">불출 메모 / 목적</label>
                <input type="text" placeholder="예: 검사 작업용 일괄 불출" value={fixedBatchMemo} onChange={e => setFixedBatchMemo(e.target.value)} className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]" />
              </div>
              <div className="flex space-x-2 pt-2">
                <button type="button" onClick={() => setShowFixedBatchModal(false)} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-[#64748B] font-semibold text-xs rounded-lg transition">취소</button>
                <button type="submit" className="flex-1 py-2 bg-[#243B5A] hover:bg-[#1d3049] text-white font-semibold text-xs rounded-lg transition">일괄 불출 확정</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CABIN 일괄 불출 모달 */}
      {showCabinBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#E2E5E9] max-w-sm w-full p-5 shadow-2xl space-y-4 text-[#1F2937]">
            <div className="flex justify-between items-center pb-2 border-b border-[#E2E5E9]">
              <h3 className="text-sm font-bold">CABIN 품목 일괄 불출</h3>
              <button onClick={() => setShowCabinBatchModal(false)}><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={handleCabinBatchIssue} className="space-y-3 text-xs">
              <div className="bg-blue-50 p-2.5 rounded-md border border-blue-200 space-y-1">
                <span className="text-[10px] text-blue-700 block font-semibold">선택된 품목 수량</span>
                <p className="font-bold text-blue-900 text-sm">총 {selectedCabinIds.length}개 품목</p>
              </div>

              <div>
                <label className="block text-[#64748B] font-semibold mb-1">불출 메모 / 목적 (통합 기록)</label>
                <input 
                  type="text" 
                  placeholder="예: 정기 교정 검사 목적 일괄 불출" 
                  value={cabinBatchMemo} 
                  onChange={e => setCabinBatchMemo(e.target.value)} 
                  className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]" 
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button type="button" onClick={() => setShowCabinBatchModal(false)} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-[#64748B] font-semibold text-xs rounded-lg transition">취소</button>
                <button type="submit" className="flex-1 py-2 bg-[#243B5A] hover:bg-[#1d3049] text-white font-semibold text-xs rounded-lg transition">일괄 불출 확정</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CABIN 일괄 반납 모달 */}
      {showCabinBatchReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#E2E5E9] max-w-sm w-full p-5 shadow-2xl space-y-4 text-[#1F2937]">
            <div className="flex justify-between items-center pb-2 border-b border-[#E2E5E9]">
              <h3 className="text-sm font-bold">CABIN 품목 일괄 반납 및 점검</h3>
              <button onClick={() => setShowCabinBatchReturnModal(false)}><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={handleCabinBatchReturn} className="space-y-3 text-xs">
              <div className="bg-blue-50 p-2.5 rounded-md border border-blue-200 space-y-1">
                <span className="text-[10px] text-blue-700 block font-semibold">선택된 반납 대상 품목</span>
                <p className="font-bold text-blue-900 text-sm">총 {selectedCabinIds.length}개 품목 일괄 반납</p>
              </div>

              <div className="bg-amber-50 p-2.5 rounded-md border border-amber-200 space-y-2">
                <label htmlFor="cabinBatchReturnHasIssue" className="flex items-center gap-2 text-amber-900 font-semibold cursor-pointer select-none">
                  <input type="checkbox" id="cabinBatchReturnHasIssue" checked={cabinBatchReturnHasIssue} onChange={e => { setCabinBatchReturnHasIssue(e.target.checked); if (!e.target.checked) setCabinBatchIssueIds([]); }} className="h-4 w-4 accent-amber-600 rounded" />
                  이상 유무 확인
                </label>
                {cabinBatchReturnHasIssue && (
                  <>
                    <p className="text-[10px] text-amber-800">선택된 불출 품목 중 이상이 있는 자재에만 체크하세요.</p>
                    <div className="max-h-36 overflow-y-auto space-y-1.5">
                      {cabinInventoryList.filter(item => selectedCabinIds.includes(String(item.id))).map(item => {
                        const id = String(item.id);
                        const checked = cabinBatchIssueIds.includes(id);
                        return (
                          <label key={id} className="flex items-start gap-2 rounded-md border border-amber-200 bg-white p-2 cursor-pointer">
                            <input type="checkbox" checked={checked} onChange={e => setCabinBatchIssueIds(prev => e.target.checked ? Array.from(new Set([...prev, id])) : prev.filter(value => value !== id))} className="mt-0.5 h-4 w-4 accent-amber-600 rounded" />
                            <span className="min-w-0 flex-1 text-[11px] text-[#1F2937]">{item.item || item.no || '품목명 미확인'} <span className="text-[#64748B]">({item.no || '-'})</span></span>
                            {checked && <span className="shrink-0 text-[10px] font-bold text-amber-800">이상 있음</span>}
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="block text-[#64748B] font-semibold mb-1">일괄 반납 메모 / 특이사항</label>
                <input 
                  type="text" 
                  placeholder="예: 교정 완료 후 일괄 반납" 
                  value={cabinBatchReturnMemo} 
                  onChange={e => setCabinBatchReturnMemo(e.target.value)} 
                  className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]" 
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button type="button" onClick={() => setShowCabinBatchReturnModal(false)} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-[#64748B] font-semibold text-xs rounded-lg transition">취소</button>
                <button type="submit" className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition">일괄 반납 확정</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 반납 모달 */}
      {showReturnModal && targetReturnLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#E2E5E9] max-w-sm w-full p-5 shadow-2xl space-y-4 text-[#1F2937]">
            <div className="flex justify-between items-center pb-2 border-b border-[#E2E5E9]">
              <h3 className="text-sm font-bold">반납 수량 확인 및 장비 점검</h3>
              <button onClick={() => setShowReturnModal(false)}><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={handleSubmitReturn} className="space-y-3 text-xs">
              <div className="bg-[#F5F6F8] p-2.5 rounded-md border border-[#E2E5E9] space-y-1">
                <span className="text-[10px] text-[#64748B] block">품목명</span>
                <p className="font-bold text-[#1F2937]">{targetReturnLog.item_name}</p>
              </div>

              <div>
                <label className="block text-[#64748B] font-semibold mb-1">반납 수량 확인</label>
                <input 
                  type="number" 
                  min="1" 
                  required
                  value={returnQty} 
                  onChange={e => setReturnQty(Number(e.target.value))} 
                  className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937] font-bold" 
                />
                <span className="text-[10px] text-[#64748B] mt-1 block">불출된 수량과 실제 반납 수량이 일치하는지 확인해주세요.</span>
              </div>

              {targetReturnLog.batch_id && returnBatchItems.length > 0 ? (
                <div className="bg-amber-50 p-2.5 rounded-md border border-amber-200 space-y-2">
                  <label htmlFor="returnHasIssue" className="flex items-center gap-2 text-amber-900 font-semibold cursor-pointer select-none">
                    <input type="checkbox" id="returnHasIssue" checked={returnHasIssue} onChange={e => { setReturnHasIssue(e.target.checked); if (!e.target.checked) setReturnIssueItemIds([]); }} className="h-4 w-4 accent-amber-600 rounded" />
                    이상 유무 확인
                  </label>
                  {returnHasIssue && (
                    <>
                      <p className="text-[10px] text-amber-800">불출된 자재 전체가 표시됩니다. 이상이 있는 자재에만 개별 체크하세요.</p>
                      <div className="max-h-40 overflow-y-auto space-y-1.5">
                        {returnBatchItems.map((row: any) => {
                          const id = String(row.inventory_id);
                          const checked = returnIssueItemIds.includes(id);
                          return (
                            <label key={id} className="flex items-start gap-2 rounded-md border border-amber-200 bg-white p-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={e => setReturnIssueItemIds(prev => e.target.checked ? Array.from(new Set([...prev, id])) : prev.filter(value => value !== id))}
                                className="mt-0.5 h-4 w-4 accent-amber-600 rounded"
                              />
                              <span className="min-w-0 flex-1 text-[11px] text-[#1F2937]">{row.item_name || row.item_code || '품목명 미확인'} <span className="text-[#64748B]">({row.quantity || 1}개)</span></span>
                              {checked && <span className="shrink-0 text-[10px] font-bold text-amber-800">이상 있음</span>}
                            </label>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="bg-amber-50 p-2.5 rounded-md border border-amber-200 flex items-center space-x-2">
                  <input type="checkbox" id="returnHasIssue" checked={returnHasIssue} onChange={e => setReturnHasIssue(e.target.checked)} className="w-4 h-4 accent-amber-600 rounded" />
                  <label htmlFor="returnHasIssue" className="text-amber-900 font-semibold cursor-pointer select-none">장비 이상(결함) 있음 체크</label>
                </div>
              )}

              <div>
                <label className="block text-[#64748B] font-semibold mb-1">반납 메모 / 특이사항</label>
                <input 
                  type="text" 
                  placeholder="특이사항이 있으면 입력하세요" 
                  value={returnMemo} 
                  onChange={e => setReturnMemo(e.target.value)} 
                  className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]" 
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button type="button" onClick={() => setShowReturnModal(false)} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-[#64748B] font-semibold text-xs rounded-lg transition">취소</button>
                <button type="submit" disabled={returnSubmittingRef.current} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-lg transition">반납 확정</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 이력 수정 모달 */}
      {showEditLogModal && targetEditLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#E2E5E9] max-w-sm w-full p-5 shadow-2xl space-y-4 text-[#1F2937]">
            <div className="flex justify-between items-center pb-2 border-b border-[#E2E5E9]">
              <h3 className="text-sm font-bold">불출/반납 이력 수정</h3>
              <button onClick={() => setShowEditLogModal(false)}><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={handleSubmitEditLog} className="space-y-3 text-xs">
              <div className="bg-[#F5F6F8] p-2.5 rounded-md border border-[#E2E5E9] space-y-1">
                <span className="text-[10px] text-[#64748B] block">품목명 / 구분</span>
                <p className="font-bold text-[#1F2937]">{targetEditLog.item_name} <span className="text-[10px] font-normal text-blue-600">[{targetEditLog.type}]</span></p>
              </div>

              <div>
                <label className="block text-[#64748B] font-semibold mb-1">수량 수정</label>
                <input 
                  type="number" 
                  min="1" 
                  required 
                  value={editLogQty} 
                  onChange={e => setEditLogQty(Number(e.target.value))} 
                  className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937] font-bold" 
                />
              </div>

              <div>
                <label className="block text-[#64748B] font-semibold mb-1">내용 / 메모 수정</label>
                <input 
                  type="text" 
                  placeholder="수정할 내용이나 메모를 입력하세요" 
                  value={editLogMemo} 
                  onChange={e => setEditLogMemo(e.target.value)} 
                  className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]" 
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button type="button" onClick={() => setShowEditLogModal(false)} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-[#64748B] font-semibold text-xs rounded-lg transition">취소</button>
                <button type="submit" className="flex-1 py-2 bg-[#243B5A] hover:bg-[#1d3049] text-white font-semibold text-xs rounded-lg transition">수정 완료</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pendingDeleteLogId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#E2E5E9] max-w-sm w-full p-5 shadow-2xl space-y-4 text-center">
            <div className="mx-auto w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1F2937] mb-1">이력 삭제 확인</h3>
              <p className="text-xs text-[#64748B]">정말 이 이력을 삭제하시겠습니까?</p>
            </div>
            <div className="flex space-x-2 pt-2">
              <button onClick={() => setPendingDeleteLogId(null)} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-[#64748B] font-semibold text-xs rounded-lg transition">취소</button>
              <button onClick={executeDeleteLog} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-lg transition">삭제하기</button>
            </div>
          </div>
        </div>
      )}

      {showBatchDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#E2E5E9] max-w-sm w-full p-5 shadow-2xl space-y-4 text-center">
            <div className="mx-auto w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1F2937] mb-1">이력 일괄 삭제 확인</h3>
              <p className="text-xs text-[#64748B] break-keep">선택한 <strong className="text-[#1F2937]">{selectedLogIds.length}개</strong>의 이력을 정말 삭제하시겠습니까?</p>
            </div>
            <div className="flex space-x-2 pt-2">
              <button onClick={() => setShowBatchDeleteConfirm(false)} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-[#64748B] font-semibold text-xs rounded-lg transition">취소</button>
              <button onClick={executeBatchDeleteLogs} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-lg transition">일괄 삭제</button>
            </div>
          </div>
        </div>
      )}

      {isCabinSheetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#E2E5E9] max-w-sm w-full p-5 shadow-2xl space-y-4 text-[#1F2937]">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold">종류별 추가 / 수정 / 삭제</h3>
              <button onClick={() => setIsCabinSheetModalOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-2">
              <div className="flex gap-1">
                <input 
                  type="text" 
                  placeholder="새로운 Sheet 이름" 
                  value={newSheetInput} 
                  onChange={e => setNewSheetInput(e.target.value)} 
                  className="w-full px-2.5 py-1.5 border border-[#E2E5E9] rounded text-xs" 
                />
                <button 
                  onClick={async () => {
                    if(!newSheetInput.trim()) return;
                    const cleaned = cleanSheetName(newSheetInput.trim());
                    if(!customCabinSheets.includes(cleaned)) {
                      const updated = [...customCabinSheets, cleaned];
                      try {
                        await persistSubCategories('CABIN', updated);
                        setCustomCabinSheets(updated);
                        setSelectedCabinSheet(cleaned);
                      } catch (error: any) {
                        showCenterToast('CABIN 종류 저장 실패: ' + (error?.message || '알 수 없는 오류'));
                      }
                    }
                    setNewSheetInput('');
                  }}
                  className="px-3 py-1.5 bg-[#243B5A] text-white rounded text-xs font-semibold shrink-0"
                >
                  추가
                </button>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1 pt-2 border-t border-[#E2E5E9]">
                {customCabinSheets.map((sheet, index) => (
                  <div key={sheet} className="flex items-center justify-between bg-[#F5F6F8] px-2 py-1 rounded text-xs">
                    {editingSheetIndex === index ? (
                      <input 
                        type="text" 
                        value={editSheetInputValue} 
                        onChange={e => setEditSheetInputValue(e.target.value)}
                        className="w-full px-1.5 py-0.5 border border-[#E2E5E9] rounded text-xs mr-1 bg-white"
                      />
                    ) : (
                      <span className="font-medium text-[#1F2937] truncate">{sheet}</span>
                    )}

                    <div className="flex items-center space-x-1 shrink-0 ml-1">
                      <button
                        type="button"
                        onClick={() => moveCabinSheet(index, -1)}
                        disabled={index === 0}
                        className="px-1 py-0.5 bg-white border border-[#E2E5E9] text-[#64748B] rounded text-[10px] disabled:opacity-30"
                        title="위로 이동"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => moveCabinSheet(index, 1)}
                        disabled={index === customCabinSheets.length - 1}
                        className="px-1 py-0.5 bg-white border border-[#E2E5E9] text-[#64748B] rounded text-[10px] disabled:opacity-30"
                        title="아래로 이동"
                      >
                        ▼
                      </button>
                      {editingSheetIndex === index ? (
                        <button 
                          onClick={async () => {
                            if (!editSheetInputValue.trim()) return;
                            const cleaned = cleanSheetName(editSheetInputValue.trim());
                            const updated = [...customCabinSheets];
                            updated[index] = cleaned;
                            if (new Set(updated).size !== updated.length) {
                              showCenterToast('이미 존재하는 CABIN 종류입니다.');
                              return;
                            }
                            try {
                              await persistSubCategories('CABIN', updated);
                              setCustomCabinSheets(updated);
                              if (selectedCabinSheet === sheet) setSelectedCabinSheet(cleaned);
                              setEditingSheetIndex(null);
                            } catch (error: any) {
                              showCenterToast('CABIN 종류 수정 실패: ' + (error?.message || '알 수 없는 오류'));
                            }
                          }}
                          className="px-1.5 py-0.5 bg-blue-600 text-white rounded text-[10px]"
                        >
                          저장
                        </button>
                      ) : (
                        <button 
                          onClick={() => {
                            setEditingSheetIndex(index);
                            setEditSheetInputValue(sheet);
                          }}
                          className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded text-[10px]"
                        >
                          수정
                        </button>
                      )}

                      <button 
                        onClick={() => {
                          showConfirm('CABIN 종류 삭제', `'${sheet}' Sheet를 삭제하시겠습니까?`, async () => {
                            const updated = customCabinSheets.filter(s => s !== sheet);
                            try {
                              await persistSubCategories('CABIN', updated);
                              setCustomCabinSheets(updated);
                              if (selectedCabinSheet === sheet && updated.length > 0) setSelectedCabinSheet(updated[0]);
                            } catch (error: any) {
                              showCenterToast('CABIN 종류 삭제 실패: ' + (error?.message || '알 수 없는 오류'));
                            }
                          });
                        }}
                        className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[10px]"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {isItemSubCatModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#E2E5E9] max-w-lg w-full p-5 shadow-2xl space-y-4 text-[#1F2937] max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold">{inventoryTab === 'CABIN' ? '자재명 추가 / 수정 / 삭제' : '자재 종류 추가 / 수정 / 삭제'}</h3>
              <button onClick={() => { setIsItemSubCatModalOpen(false); setEditingItemSubCatId(null); }}><X className="h-4 w-4" /></button>
            </div>
            <p className="text-[11px] text-[#64748B]">{inventoryTab === 'CABIN' ? 'CABIN 자재명 탭을 추가하거나 이름 및 연결 자재를 수정할 수 있습니다. 삭제해도 실제 CABIN 자재 데이터는 삭제되지 않습니다.' : '실제 자재명은 변경하지 않고, 선택한 자재들을 하나의 종류로 묶어 보여줍니다.'}</p>

            <div className="border border-[#E2E5E9] rounded-lg p-3 space-y-2 bg-[#F8FAFC]">
              <div className="flex gap-1">
                <input type="text" placeholder="예: 몽키 스패너" value={newItemSubCatName} onChange={e=>setNewItemSubCatName(e.target.value)} className="flex-1 px-2.5 py-1.5 border border-[#E2E5E9] rounded text-xs bg-white" />
                <button type="button" onClick={handleAddItemSubCategory} className="px-3 py-1.5 bg-[#243B5A] text-white rounded text-xs font-semibold">추가</button>
              </div>
              <div className="text-[10px] text-[#64748B]">연결할 실제 자재명 선택 (선택하지 않으면 종류만 먼저 만들 수 있습니다)</div>
              <div className="max-h-36 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1">
                {currentMaterialNames.map(name => (
                  <label key={name} className="flex items-center gap-1.5 text-[11px] bg-white border border-[#E2E5E9] rounded px-2 py-1">
                    <input type="checkbox" checked={newItemSubCatMaterialNames.includes(name)} onChange={e=>setNewItemSubCatMaterialNames(prev=>e.target.checked ? [...prev,name] : prev.filter(v=>v!==name))} />
                    <span className="truncate" title={name}>{name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-[#E2E5E9]">
              {currentItemSubCategoryEntries.map(entry => (
                <div key={entry.name} className="bg-[#F5F6F8] rounded p-2">
                  {editingItemSubCatId === entry.id ? (
                    <div className="space-y-2">
                      <input type="text" value={editingItemSubCatName} onChange={e=>setEditingItemSubCatName(e.target.value)} className="w-full px-2 py-1 border border-[#E2E5E9] rounded text-xs bg-white" />
                      <div className="max-h-28 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {currentMaterialNames.map(name => (
                          <label key={name} className="flex items-center gap-1.5 text-[10px] bg-white border border-[#E2E5E9] rounded px-2 py-1">
                            <input type="checkbox" checked={editingItemSubCatMaterialNames.includes(name)} onChange={e=>setEditingItemSubCatMaterialNames(prev=>e.target.checked ? [...prev,name] : prev.filter(v=>v!==name))} />
                            <span className="truncate" title={name}>{name}</span>
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-1 justify-end">
                        <button type="button" onClick={handleSaveItemSubCategoryEdit} className="px-2 py-1 bg-blue-600 text-white rounded text-[10px]">저장</button>
                        <button type="button" onClick={()=>setEditingItemSubCatId(null)} className="px-2 py-1 bg-gray-200 text-[#64748B] rounded text-[10px]">취소</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-xs truncate">{entry.name}</div>
                        <div className="text-[10px] text-[#64748B] truncate">{entry.materialNames.length ? `${entry.materialNames.length}개 자재 연결` : '연결된 자재 없음'}</div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveCurrentItemSubCategory(currentItemSubCategoryEntries.findIndex(item => item.name === entry.name), -1)}
                          disabled={currentItemSubCategoryEntries.findIndex(item => item.name === entry.name) === 0}
                          className="px-1 py-0.5 bg-white border border-[#E2E5E9] text-[#64748B] rounded text-[10px] disabled:opacity-30"
                          title="위로 이동"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveCurrentItemSubCategory(currentItemSubCategoryEntries.findIndex(item => item.name === entry.name), 1)}
                          disabled={currentItemSubCategoryEntries.findIndex(item => item.name === entry.name) === currentItemSubCategoryEntries.length - 1}
                          className="px-1 py-0.5 bg-white border border-[#E2E5E9] text-[#64748B] rounded text-[10px] disabled:opacity-30"
                          title="아래로 이동"
                        >
                          ▼
                        </button>
                        <button type="button" onClick={()=>{ setEditingItemSubCatId(entry.id); setEditingItemSubCatName(entry.name); setEditingItemSubCatMaterialNames([...entry.materialNames]); }} className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded text-[10px]">수정</button>
                        <button type="button" onClick={()=>handleDeleteItemSubCategory(entry.name)} className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[10px]">삭제</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {currentItemSubCategoryEntries.length === 0 && <div className="text-[11px] text-[#94A3B8] text-center py-3">등록된 자재 종류가 없습니다.</div>}
            </div>
          </div>
        </div>
      )}

      {isSubCatModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#E2E5E9] max-w-sm w-full p-5 shadow-2xl space-y-4 text-[#1F2937]">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold">[{inventoryTab}] 서브 카테고리 추가 / 수정 / 삭제</h3>
              <button onClick={() => setIsSubCatModalOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-2">
              <div className="flex gap-1">
                <input 
                  type="text" 
                  placeholder="새로운 카테고리 이름" 
                  value={newSubCatInput} 
                  onChange={e => setNewSubCatInput(e.target.value)} 
                  className="w-full px-2.5 py-1.5 border border-[#E2E5E9] rounded text-xs" 
                />
                <button 
                  onClick={async () => {
                    const name = newSubCatInput.trim();
                    if (!name) return;
                    const list = getCurrentSubCategories();
                    if (name === '전체 보기') { showCenterToast('전체 보기는 기본 항목이라 추가할 수 없습니다.'); return; }
                    if (list.includes(name)) { showCenterToast('이미 존재하는 카테고리입니다.'); setNewSubCatInput(''); return; }
                    const updated = [...list, name];
                    try {
                      if (inventoryTab === '고정' || inventoryTab === '소모성') {
                        await persistSubCategories(inventoryTab, updated);
                      }
                      setCurrentSubCategories(updated);
                      setCurrentSelectedCategory(name);
                      setNewSubCatInput('');
                    } catch (error: any) {
                      showCenterToast('서브 카테고리 저장 실패: ' + (error?.message || '알 수 없는 오류'));
                    }
                  }}
                  className="px-3 py-1.5 bg-[#243B5A] text-white rounded text-xs font-semibold shrink-0"
                >
                  추가
                </button>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1 pt-2 border-t border-[#E2E5E9]">
                {getCurrentSubCategories().map((cat, index) => (
                  <div key={cat} className="flex items-center justify-between bg-[#F5F6F8] px-2 py-1 rounded text-xs">
                    {editingSubCatIndex === index ? (
                      <input 
                        type="text" 
                        value={editSubCatInputValue} 
                        onChange={e => setEditSubCatInputValue(e.target.value)}
                        className="w-full px-1.5 py-0.5 border border-[#E2E5E9] rounded text-xs mr-1 bg-white"
                      />
                    ) : (
                      <span className="font-medium text-[#1F2937] truncate">{cat}</span>
                    )}

                    <div className="flex items-center space-x-1 shrink-0 ml-1">
                      <button
                        type="button"
                        onClick={() => moveCurrentSubCategory(index, -1)}
                        disabled={index === 0}
                        className="px-1 py-0.5 bg-white border border-[#E2E5E9] text-[#64748B] rounded text-[10px] disabled:opacity-30"
                        title="위로 이동"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => moveCurrentSubCategory(index, 1)}
                        disabled={index === getCurrentSubCategories().length - 1}
                        className="px-1 py-0.5 bg-white border border-[#E2E5E9] text-[#64748B] rounded text-[10px] disabled:opacity-30"
                        title="아래로 이동"
                      >
                        ▼
                      </button>
                      {editingSubCatIndex === index ? (
                        <button 
                          onClick={async () => {
                            const newName = editSubCatInputValue.trim();
                            if (!newName) return;
                            const list = [...getCurrentSubCategories()];
                            if (list.some((value, i) => i !== index && value === newName)) {
                              showCenterToast('이미 존재하는 서브 카테고리입니다.');
                              return;
                            }
                            list[index] = newName;
                            try {
                              if (inventoryTab === '고정' || inventoryTab === '소모성') {
                                const { error: renameItemsError } = await supabase.from('inventory').update({ category: newName }).eq('type', inventoryTab).eq('category', cat);
                                if (renameItemsError) throw renameItemsError;
                                await persistSubCategories(inventoryTab, list);
                              }
                              setCurrentSubCategories(list);
                              if (itemCategory === cat) setItemCategory(newName);
                              if (getCurrentSelectedCategory() === cat) setCurrentSelectedCategory(newName);
                              setEditingSubCatIndex(null);
                            } catch (error: any) {
                              showCenterToast('서브 카테고리 수정 실패: ' + (error?.message || '알 수 없는 오류'));
                            }
                          }}
                          className="px-1.5 py-0.5 bg-blue-600 text-white rounded text-[10px]"
                        >
                          저장
                        </button>
                      ) : (
                        <button 
                          onClick={() => {
                            setEditingSubCatIndex(index);
                            setEditSubCatInputValue(cat);
                          }}
                          className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded text-[10px]"
                        >
                          수정
                        </button>
                      )}

                      <button 
                        onClick={() => {
                          showConfirm('서브 카테고리 삭제', `'${cat}' 카테고리를 삭제하시겠습니까?`, async () => {
                            const linkedItems = inventoryList.filter(item => item.type === inventoryTab && item.category === cat);
                            if (linkedItems.length > 0) {
                              showCenterToast(`'${cat}'에 등록된 자재 ${linkedItems.length}개가 있습니다. 자재의 서브 카테고리를 먼저 변경해주세요.`);
                              return;
                            }
                            const list = getCurrentSubCategories().filter(c => c !== cat);
                            try {
                              if (inventoryTab === '고정' || inventoryTab === '소모성') {
                                await persistSubCategories(inventoryTab, list);
                              }
                              setCurrentSubCategories(list);
                              if (itemCategory === cat) setItemCategory(list[0] || '');
                              if (getCurrentSelectedCategory() === cat && list.length > 0) setCurrentSelectedCategory(list[0]);
                              else if (getCurrentSelectedCategory() === cat) setCurrentSelectedCategory('');
                            } catch (error: any) {
                              showCenterToast('서브 카테고리 삭제 실패: ' + (error?.message || '알 수 없는 오류'));
                            }
                          });
                        }}
                        className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[10px]"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-3 rounded-lg border border-[#E2E5E9] shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 overflow-hidden">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-[#243B5A] shrink-0">
            <Package className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-bold text-[#1F2937] truncate">기자재 및 소모성 자재 관리 시스템</h1>
            <p className="text-[10px] sm:text-[11px] text-[#64748B] truncate">고정 기자재, 소모품 및 CABIN 자재 통합 관리</p>
          </div>
        </div>
      </div>

      {calibrationAlertItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg overflow-hidden shadow-2xs">
          <button
            onClick={() => setIsAlertBannerOpen(!isAlertBannerOpen)}
            className="w-full px-3 py-2 flex items-center justify-between text-amber-900 font-semibold text-xs bg-amber-100/60 hover:bg-amber-100 transition text-left"
          >
            <div className="flex items-center space-x-2 min-w-0 pr-2">
              <Bell className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="truncate">교정 예정 장비 <strong className="text-amber-800 font-bold">{calibrationAlertItems.length}건</strong> 점검 필요 (30일 이내)</span>
            </div>
            {isAlertBannerOpen ? <ChevronUp className="h-4 w-4 text-amber-600 shrink-0" /> : <ChevronDown className="h-4 w-4 text-amber-600 shrink-0" />}
          </button>

          {isAlertBannerOpen && (
            <div className="p-2.5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs border-t border-amber-200/60 bg-white">
              {calibrationAlertItems.map(({ item, daysLeft, nextCalDate }, idx) => (
                <div 
                  key={item.id || idx} 
                  onClick={() => setSelectedDetailItem(item)}
                  className="p-2 bg-[#F5F6F8] rounded-md border border-[#E2E5E9] flex justify-between items-center cursor-pointer hover:border-amber-400 transition min-w-0"
                >
                  <div className="min-w-0 pr-2 flex-1">
                    <div className="flex items-center space-x-1 mb-0.5 min-w-0">
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-mono font-bold px-1 py-0.2 rounded shrink-0">{item.code || item.no}</span>
                      <span className="font-semibold text-[#1F2937] truncate text-xs">{item.name || item.item}</span>
                    </div>
                    <span className="text-[10px] text-[#64748B] block truncate">만료 예정: {nextCalDate}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">
                      {daysLeft <= 0 ? 'D-DAY' : `D-${daysLeft}`}
                    </span>
                    {item.type !== 'CABIN' && (
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); handleOpenLogModal(item, '교정 반출'); }}
                        className="px-2 py-1 rounded border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 text-[10px] font-semibold whitespace-nowrap"
                      >
                        교정 반출
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
        <div className="flex bg-[#E2E5E9]/60 p-1 rounded-lg border border-[#E2E5E9] w-full sm:w-auto">
          <button
            onClick={() => { setInventoryTab('고정'); setSelectedItemSubCategory('전체 보기'); }}
            className={`flex-1 sm:flex-none flex items-center justify-center space-x-1 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              inventoryTab === '고정' ? 'bg-[#243B5A] text-white shadow-2xs' : 'text-[#64748B] hover:text-[#1F2937]'
            }`}
          >
            <Lock className="h-3.5 w-3.5 shrink-0" />
            <span>기자재</span>
          </button>
          <button
            onClick={() => { setInventoryTab('소모성'); setSelectedItemSubCategory('전체 보기'); }}
            className={`flex-1 sm:flex-none flex items-center justify-center space-x-1 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              inventoryTab === '소모성' ? 'bg-[#243B5A] text-white shadow-2xs' : 'text-[#64748B] hover:text-[#1F2937]'
            }`}
          >
            <Box className="h-3.5 w-3.5 shrink-0" />
            <span>소모성 자재</span>
          </button>
          <button
            onClick={() => { setInventoryTab('CABIN'); setSelectedItemSubCategory('전체 보기'); }}
            className={`flex-1 sm:flex-none flex items-center justify-center space-x-1 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              inventoryTab === 'CABIN' ? 'bg-[#243B5A] text-white shadow-2xs' : 'text-[#64748B] hover:text-[#1F2937]'
            }`}
          >
            <Compass className="h-3.5 w-3.5 shrink-0" />
            <span>CABIN</span>
          </button>
        </div>

        <div className="relative w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setShowExcelDownloadMenu(prev => !prev)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 sm:py-1.5 text-xs font-semibold text-[#243B5A] shadow-2xs hover:bg-[#F5F6F8] transition"
          >
            <span>Excel 내려받기</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showExcelDownloadMenu ? 'rotate-180' : ''}`} />
          </button>
          {showExcelDownloadMenu && (
            <>
              <button aria-label="메뉴 닫기" className="fixed inset-0 z-30 cursor-default" onClick={() => setShowExcelDownloadMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-40 w-full sm:w-48 rounded-lg border border-[#D7DDE5] bg-white p-1.5 shadow-lg">
                <button type="button" onClick={() => void exportInventoryExcel('전체')} className="w-full rounded-md px-3 py-2.5 text-left text-xs font-medium text-[#243B5A] hover:bg-[#F1F4F8] transition">전체 내려받기</button>
                <button type="button" onClick={() => void exportInventoryExcel('기자재')} className="w-full rounded-md px-3 py-2.5 text-left text-xs font-medium text-[#243B5A] hover:bg-[#F1F4F8] transition">기자재 내려받기</button>
                <button type="button" onClick={() => void exportInventoryExcel('CABIN')} className="w-full rounded-md px-3 py-2.5 text-left text-xs font-medium text-[#243B5A] hover:bg-[#F1F4F8] transition">CABIN 내려받기</button>
              </div>
            </>
          )}
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenInventoryCreate}
            className="w-full sm:w-auto flex items-center justify-center space-x-1 bg-[#243B5A] hover:bg-[#1d3049] text-white px-3 py-2 sm:py-1.5 rounded-lg transition font-medium text-xs shadow-2xs shrink-0"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>신규 자재 등록</span>
          </button>
        )}
      </div>

      {inventoryTab === 'CABIN' ? (
        <div className="bg-white px-2.5 py-2 rounded-lg border border-[#E2E5E9] shadow-2xs flex items-center justify-between gap-2 overflow-hidden">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#64748B] shrink-0">
            <Package className="h-3.5 w-3.5 text-[#243B5A]" />
            <span>종류별:</span>
          </div>
          <div 
            className="flex items-center gap-1.5 overflow-x-auto flex-1 py-0.5 min-w-0"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#CBD5E1 transparent' }}
          >
            {customCabinSheets.map((sheet) => {
              const isSelected = selectedCabinSheet === sheet;
              return (
                <button
                  key={sheet}
                  onClick={() => handleSelectCabinSheet(sheet)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition shrink-0 ${
                    isSelected
                      ? 'bg-[#243B5A] text-white font-semibold shadow-2xs'
                      : 'bg-[#F5F6F8] text-[#64748B] hover:bg-[#E2E5E9] hover:text-[#1F2937]'
                  }`}
                >
                  {sheet}
                </button>
              );
            })}
          </div>

          <div className="flex items-center space-x-1 shrink-0">
            <button
              onClick={() => { setCabinCalibrationOnly(!cabinCalibrationOnly); setSelectedItemSubCategory('전체 보기'); }}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition flex items-center gap-1 ${
                cabinCalibrationOnly 
                  ? 'bg-amber-600 text-white shadow-2xs' 
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
              title="교정일이 등록된 품목만 필터링합니다"
            >
              <span>🔬 교정 대상</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => setIsCabinSheetModalOpen(true)}
                className="p-1.5 bg-[#F5F6F8] text-[#64748B] hover:text-[#1F2937] hover:bg-[#E2E5E9] rounded-md border border-[#E2E5E9] shrink-0 transition"
                title="종류 추가/수정/관리"
              >
                <Settings className="h-4 w-4 shrink-0" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white px-2.5 py-2 rounded-lg border border-[#E2E5E9] shadow-2xs flex items-center justify-between gap-2 overflow-hidden">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <label className="text-xs font-semibold text-[#64748B] shrink-0">카테고리</label>
            <Select
              value={getCurrentSelectedCategory() || '전체 보기'}
              onValueChange={value => {
                setCurrentSelectedCategory(value);
                setSelectedItemSubCategory('전체 보기');
                if (value === 'VBT') setSelectedVbtSubCategory('1L');
              }}
            >
              <SelectTrigger aria-label="카테고리 선택" className="h-9 min-w-0 flex-1 border-[#E2E5E9] bg-white text-xs font-medium text-[#1F2937] shadow-sm focus:ring-[#243B5A]/10">
                <SelectValue placeholder="카테고리 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="전체 보기">전체 보기</SelectItem>
                {getCurrentSubCategories().map(cat => <SelectItem key={cat} value={cat}>{cat === '교정' ? '🔬 교정 대상' : cat}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isAdmin && (
            <button
              onClick={() => setIsSubCatModalOpen(true)}
              className="p-1.5 bg-[#F5F6F8] text-[#64748B] hover:text-[#1F2937] hover:bg-[#E2E5E9] rounded-md border border-[#E2E5E9] shrink-0 transition"
              title="서브 카테고리 추가/수정/관리"
            >
              <Settings className="h-4 w-4 shrink-0" />
            </button>
          )}
        </div>
      )}

      {inventoryTab === 'CABIN' && (
        <div className="bg-white px-2.5 py-2 rounded-lg border border-[#E2E5E9] shadow-2xs flex items-center justify-between gap-2 overflow-hidden">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#64748B] shrink-0">
            <Package className="h-3.5 w-3.5 text-[#243B5A]" />
            <span>자재명:</span>
          </div>
          <div className="flex-1 min-w-0">
            <Select value={selectedItemSubCategory || '전체 보기'} onValueChange={setSelectedItemSubCategory}>
              <SelectTrigger aria-label="자재명 선택" className="h-9 w-full min-w-0 border-[#E2E5E9] bg-white text-xs font-medium text-[#1F2937] shadow-sm focus:ring-[#243B5A]/10">
                <SelectValue placeholder="자재명 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="전체 보기">전체 보기</SelectItem>
                {currentItemSubCategoryOptions.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {isAdmin && (
            <button
              onClick={handleOpenItemSubCategorySettings}
              className="p-1.5 bg-[#F5F6F8] text-[#64748B] hover:text-[#1F2937] hover:bg-[#E2E5E9] rounded-md border border-[#E2E5E9] shrink-0 transition"
              title="CABIN 자재명 추가/수정/삭제"
            >
              <Settings className="h-4 w-4 shrink-0" />
            </button>
          )}
        </div>
      )}

      {inventoryTab === '고정' && selectedFixedSubCategory === 'VBT' && (
        <div className="bg-white p-1.5 rounded-lg border border-[#E2E5E9] flex overflow-x-auto gap-1 shadow-2xs">
          {(['1L', '1S', '2L', '2S', 'FLAT', '기타'] as VbtSubCategory[]).map((subCat) => (
            <button
              key={subCat}
              onClick={() => { setSelectedVbtSubCategory(subCat); setSelectedItemSubCategory('전체 보기'); }}
              className={`flex-1 min-w-[42px] py-1 rounded-md text-[11px] font-semibold transition shrink-0 ${
                selectedVbtSubCategory === subCat ? 'bg-slate-700 text-white shadow-2xs' : 'bg-[#F5F6F8] text-[#64748B]'
              }`}
            >
              {subCat}
            </button>
          ))}
        </div>
      )}

      {inventoryTab !== 'CABIN' && !(inventoryTab === '고정' && selectedFixedSubCategory === 'VBT') && (
        <div className="bg-white px-2.5 py-2 rounded-lg border border-[#E2E5E9] shadow-2xs flex items-center justify-between gap-2 overflow-hidden">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#64748B] shrink-0">
            <Package className="h-3.5 w-3.5 text-[#243B5A]" />
            <span>자재명:</span>
          </div>
          <div className="flex-1 min-w-0">
            <Select value={selectedItemSubCategory || '전체 보기'} onValueChange={setSelectedItemSubCategory}>
              <SelectTrigger aria-label="CABIN 자재명 선택" className="h-9 w-full min-w-0 border-[#E2E5E9] bg-white text-xs font-medium text-[#1F2937] shadow-sm focus:ring-[#243B5A]/10">
                <SelectValue placeholder="자재명 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="전체 보기">전체 보기</SelectItem>
                {currentItemSubCategoryOptions.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {isAdmin && (
            <button
              onClick={() => { setNewItemSubCatName(''); setNewItemSubCatMaterialNames([]); setEditingItemSubCatId(null); setIsItemSubCatModalOpen(true); }}
              className="p-1.5 bg-[#F5F6F8] text-[#64748B] hover:text-[#1F2937] hover:bg-[#E2E5E9] rounded-md border border-[#E2E5E9] shrink-0 transition"
              title="자재명 카테고리 수정/삭제"
            >
              <Settings className="h-4 w-4 shrink-0" />
            </button>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg border border-[#E2E5E9] p-3 flex items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center space-x-2 text-xs font-bold text-[#1F2937] min-w-0 truncate">
          <Package className="h-4 w-4 text-[#243B5A] shrink-0" />
          <span className="truncate">
            {inventoryTab === 'CABIN'
              ? `종류 [${selectedCabinSheet || '전체'}]${selectedItemSubCategory !== '전체 보기' ? ` > ${selectedItemSubCategory}` : ''} 목록`
              : `[${currentActiveSubCatName}]${selectedItemSubCategory ? ` > ${selectedItemSubCategory}` : ''} 목록`}
          </span>
          <span className="text-[10px] bg-[#F5F6F8] border border-[#E2E5E9] px-2 py-0.5 rounded-full text-[#64748B] shrink-0 font-normal">
            총 {filteredInventory.length}건
          </span>
        </div>

        {(inventoryTab === '고정' || inventoryTab === '소모성' || inventoryTab === 'CABIN') && filteredInventory.length > 0 && (
          <button
            type="button"
            onClick={inventoryTab === '고정' ? toggleSelectAllFixed : inventoryTab === '소모성' ? toggleSelectAllConsumable : toggleSelectAllCabin}
            className="px-2.5 py-1 bg-white border border-[#E2E5E9] hover:bg-[#F5F6F8] text-[#243B5A] rounded text-[10px] font-semibold transition shrink-0"
          >
            {((inventoryTab === '고정' ? selectedFixedIds.length : inventoryTab === '소모성' ? selectedConsumableIds.length : selectedCabinIds.length) === filteredInventory.length) ? '전체 선택 해제' : '전체 선택'}
          </button>
        )}


      </div>

      {/* 전체 목록 표시 구역 */}
      <div className="bg-white rounded-lg border border-[#E2E5E9] overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => setIsInventoryListOpen(!isInventoryListOpen)}
          className="w-full px-3.5 py-2.5 bg-[#F5F6F8] flex items-center justify-between text-left hover:bg-[#EEF0F3] transition"
        >
          <span className="text-xs font-bold text-[#1F2937]">전체 목록</span>
          {isInventoryListOpen ? <ChevronUp className="h-4 w-4 text-[#64748B]" /> : <ChevronDown className="h-4 w-4 text-[#64748B]" />}
        </button>

        {isInventoryListOpen && (
          <div className="p-2.5 space-y-2">
        {inventoryTab !== 'CABIN' && filteredInventory.length > 0 && (() => {
          const totalQuantity = filteredInventory.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
          const quantityGroups = new Map<string, number>();
          filteredInventory.forEach((item: any) => {
            const categoryName = String(item.category || '기타').trim();
            const subtype = String(item.vbt_type || '').trim();
            const groupName = subtype ? `${categoryName} · ${subtype}` : categoryName;
            quantityGroups.set(groupName, (quantityGroups.get(groupName) || 0) + (Number(item.quantity) || 0));
          });
          return (
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-2.5">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="text-[11px] font-bold text-[#243B5A]">현재 목록 총 수량</span>
                <span className="text-xs font-bold text-[#243B5A]">{totalQuantity.toLocaleString()} EA</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(quantityGroups.entries()).map(([name, quantity]) => (
                  <span key={name} className="inline-flex items-center gap-1 rounded-md border border-[#E2E5E9] bg-white px-2 py-1 text-[10px] text-[#475569]">
                    <span>{name}</span><strong className="text-[#1F2937]">{quantity.toLocaleString()}</strong>
                  </span>
                ))}
              </div>
            </div>
          );
        })()}
        {paginatedInventory.map((item) => {
          const isCabin = inventoryTab === 'CABIN';
          const isFixed = inventoryTab === '고정';
          const isSelected = isCabin
            ? selectedCabinIds.includes(String(item.id))
            : isFixed
              ? selectedFixedIds.includes(String(item.id))
              : selectedConsumableIds.includes(String(item.id));

          return (
            <div 
              key={item.id} 
              className={`bg-white rounded-lg border p-3 shadow-2xs hover:border-[#243B5A] transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 ${
                isSelected ? 'border-blue-500 bg-blue-50/20' : 'border-[#E2E5E9]'
              }`}
            >
              <div className="flex items-start space-x-2.5 min-w-0 flex-1">
                {(isCabin || isFixed || inventoryTab === '소모성') && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => isCabin ? toggleSelectCabinItem(item.id) : isFixed ? toggleSelectFixedItem(item.id) : toggleSelectConsumableItem(item.id)}
                    className="mt-1 h-4 w-4 rounded accent-[#243B5A] cursor-pointer shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <span className="text-[10px] font-mono font-bold bg-[#F5F6F8] text-[#243B5A] border border-[#E2E5E9] px-1.5 py-0.5 rounded shrink-0">
                      {isCabin ? (item.no || 'NO-CODE') : item.code}
                    </span>
                    <h3 className="font-bold text-xs sm:text-sm text-[#1F2937] truncate">
                      {isCabin ? item.item : item.name}
                    </h3>
                    {item.vbt_type && (
                      <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.2 rounded shrink-0 font-medium">
                        {item.vbt_type}
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-[#64748B] flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
                    {isCabin ? (
                      <>
                        {item.maker_model && <span>제조사/모델: <strong className="text-[#1F2937] font-semibold">{item.maker_model}</strong></span>}
                        {item.serial_number && <span>S/N: <strong className="text-[#1F2937] font-semibold">{item.serial_number}</strong></span>}
                        {item.cert_no && <span>성적서번호: <strong className="text-[#1F2937] font-semibold">{item.cert_no}</strong></span>}
                        {item.calibration_date && <span className="text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">교정일: <strong>{item.calibration_date}</strong></span>}
                        {item.location_or_section && <span>구역/위치: <strong className="text-[#1F2937] font-semibold">{item.location_or_section}</strong></span>}
                      </>
                    ) : (
                      <>
                        {item.serial_number && <span>S/N: <strong className="text-[#1F2937] font-semibold">{item.serial_number}</strong></span>}
                        {item.location && <span>보관장소: <strong className="text-[#1F2937] font-semibold">{item.location}</strong></span>}
                        {item.sub_equipment && (
                          <span className="text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                            교정일자: <strong>{item.sub_equipment}</strong>
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E2E5E9] shrink-0 gap-2">
                {!isCabin && (
                  <div className="text-right">
                    <span className="text-[10px] text-[#64748B] block">보유 수량</span>
                    <span className="font-bold text-sm text-[#1F2937]">
                      {item.quantity} <span className="text-xs font-normal text-[#64748B]">{item.unit}</span>
                    </span>
                    {(() => {
                      const itemLogs = inventoryLogs.filter((log: any) => String(log.inventory_id ?? '') === String(item.id));
                      const issuedQty = itemLogs.filter((log: any) => {
                        const type = String(log.type || '');
                        return (type.includes('불출') && !type.includes('반납완료')) || type.includes('교정 반출') || type.includes('소모성 사용');
                      }).reduce((sum: number, log: any) => sum + (Number(log.quantity) || 0), 0);
                      const returnedQty = itemLogs.filter((log: any) => {
                        const type = String(log.type || '');
                        return type.includes('반납완료') || type.includes('교정 반입');
                      }).reduce((sum: number, log: any) => sum + (Number(log.quantity) || 0), 0);
                      return (
                        <div className="mt-1 flex flex-wrap justify-end gap-1 text-[10px]">
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">미반납 불출 {issuedQty}</span>
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">반입/반납 {returnedQty}</span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">잔여 {Number(item.quantity) || 0}</span>
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-1.5 max-w-full">
                  {isAdmin && !isCabin && (
                    <button
                      type="button"
                      onClick={() => handleOpenInboundModal(item)}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-xs font-medium transition border border-emerald-200 flex items-center space-x-1"
                      title="현재 보유수량에 입고 수량을 추가합니다"
                    >
                      <ArrowDownRight className="h-3 w-3" />
                      <span>입고</span>
                    </button>
                  )}
                  {!isCabin && (
                    <>
                      <button
                        onClick={() => handleOpenLogModal(item, item.type === '소모성' ? '소모성 사용' : '불출')}
                        className="px-2.5 py-1 bg-[#243B5A] hover:bg-[#1d3049] text-white rounded text-xs font-medium transition shadow-2xs flex items-center space-x-1"
                      >
                        <ArrowUpRight className="h-3 w-3" />
                        <span>{item.type === '소모성' ? '사용' : '불출'}</span>
                      </button>
                      {item.type !== '소모성' && (
                        <button
                          onClick={() => handleOpenLogModal(item, '반납')}
                          className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-[#1F2937] rounded text-xs font-medium transition flex items-center space-x-1 border border-[#E2E5E9]"
                        >
                          <ArrowDownRight className="h-3 w-3 text-emerald-600" />
                          <span>반납</span>
                        </button>
                      )}
                      {item.type !== '소모성' && isCalibrationItem(item) && (
                        <Select value="" onValueChange={(value) => handleOpenLogModal(item, value as '교정 반출' | '교정 반입')}>
                          <SelectTrigger aria-label="교정 작업 선택" className="h-8 w-[76px] sm:w-[92px] max-w-full border-blue-200 bg-blue-50 px-1.5 sm:px-2 text-[11px] sm:text-xs font-semibold text-blue-700 shadow-none focus:ring-blue-200">
                            <SelectValue placeholder="교정 ▾" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="교정 반출">교정 반출</SelectItem>
                            <SelectItem value="교정 반입">교정 반입</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </>
                  )}

                  {isCabin && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenLogModal(item, '교정 반출')}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs font-semibold transition border border-blue-200 flex items-center space-x-1"
                      >
                        <ArrowUpRight className="h-3 w-3" />
                        <span>교정 반출</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenLogModal(item, '교정 반입')}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition border border-blue-700 flex items-center space-x-1"
                      >
                        <ArrowDownRight className="h-3 w-3" />
                        <span>교정 반입</span>
                      </button>
                    </>
                  )}

                  {isAdmin && (
                    <button
                      onClick={() => handleOpenInventoryEdit(item)}
                      className="p-1 text-[#64748B] hover:text-[#1F2937] hover:bg-[#F5F6F8] rounded transition"
                      title="수정"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredInventory.length > inventoryListPageSize && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E2E5E9] px-2 py-3">
            <span className="text-[11px] text-[#64748B]">총 {filteredInventory.length}개 중 {((inventoryListPage - 1) * inventoryListPageSize) + 1}–{Math.min(inventoryListPage * inventoryListPageSize, filteredInventory.length)}개</span>
            <div className="flex items-center gap-1">
              <button type="button" disabled={inventoryListPage <= 1} onClick={() => setInventoryListPage(1)} className="rounded-md border border-[#E2E5E9] px-2.5 py-1.5 text-xs font-semibold text-[#243B5A] disabled:opacity-40">처음</button>
              <button type="button" disabled={inventoryListPage <= 1} onClick={() => setInventoryListPage(page => Math.max(1, page - 1))} className="rounded-md border border-[#E2E5E9] px-2.5 py-1.5 text-xs font-semibold text-[#243B5A] disabled:opacity-40">이전</button>
              <span className="min-w-[54px] text-center text-xs font-bold text-[#243B5A]">{inventoryListPage} / {inventoryListPageCount}</span>
              <button type="button" disabled={inventoryListPage >= inventoryListPageCount} onClick={() => setInventoryListPage(page => Math.min(inventoryListPageCount, page + 1))} className="rounded-md border border-[#E2E5E9] px-2.5 py-1.5 text-xs font-semibold text-[#243B5A] disabled:opacity-40">다음</button>
              <button type="button" disabled={inventoryListPage >= inventoryListPageCount} onClick={() => setInventoryListPage(inventoryListPageCount)} className="rounded-md border border-[#E2E5E9] px-2.5 py-1.5 text-xs font-semibold text-[#243B5A] disabled:opacity-40">끝</button>
            </div>
          </div>
        )}

        {filteredInventory.length === 0 && (
          <div className="bg-white rounded-lg border border-[#E2E5E9] p-8 text-center text-[#64748B] text-xs">
            등록되었거나 선택 조건에 해당하는 자재가 존재하지 않습니다.
          </div>
        )}
          </div>
        )}
      </div>

      {/* 최근 불출/반납 이력 섹션 */}
      <div className="bg-white rounded-lg border border-[#E2E5E9] overflow-hidden shadow-2xs mt-4">
        <div className="px-3.5 py-2.5 bg-[#F5F6F8] border-b border-[#E2E5E9] flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <History className="h-4 w-4 text-[#243B5A]" />
            <h2 className="text-xs font-bold text-[#1F2937]">불출 · 소모성 · 교정 이력</h2>
            <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-semibold">
              {filteredRecentInventoryLogs.length}건
            </span>
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => { setHistoryTypeFilter('교정반입완료'); setHistoryCategoryFilter('전체'); setSelectedLogIds([]); setIsHistorySectionOpen(true); }}
                className="px-2 py-1 bg-white border border-[#E2E5E9] hover:bg-gray-50 text-[#243B5A] rounded text-[10px] font-semibold transition"
              >
                교정 반입
              </button>
              <button
                type="button"
                onClick={handleOpenReturnHistory}
                className="px-2 py-1 bg-white border border-[#E2E5E9] hover:bg-gray-50 text-[#243B5A] rounded text-[10px] font-semibold transition"
              >
                기자재 반납 이력
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {isAdmin && selectedLogIds.length > 0 && (
              <button
                onClick={handleOpenBatchDeleteLogs}
                className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-semibold transition flex items-center space-x-1"
              >
                <Trash2 className="h-3 w-3" />
                <span>선택 삭제 ({selectedLogIds.length})</span>
              </button>
            )}
            <button
              onClick={() => setIsHistorySectionOpen(!isHistorySectionOpen)}
              className="text-[#64748B] hover:text-[#1F2937] p-1"
            >
              {isHistorySectionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {isHistorySectionOpen && (
          <div className="p-3 space-y-2">
            <InventoryHistoryFilters
              historyTypeFilter={historyTypeFilter}
              setHistoryTypeFilter={setHistoryTypeFilter}
              historyCategoryFilter={historyCategoryFilter}
              setHistoryCategoryFilter={setHistoryCategoryFilter}
              setSelectedLogIds={setSelectedLogIds}
              equipmentHistoryCategories={equipmentHistoryCategories}
            />
            <div className="flex items-center justify-between pb-2 border-b border-[#E2E5E9] text-[11px] font-semibold text-[#64748B]">
              {isAdmin && (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filteredRecentInventoryLogs.length > 0 && filteredRecentInventoryLogs.every(log => selectedLogIds.includes(String(log.id)))}
                    onChange={() => { const visibleIds = filteredRecentInventoryLogs.map(log => String(log.id)); const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedLogIds.includes(id)); setSelectedLogIds(prev => allVisibleSelected ? prev.filter(id => !visibleIds.includes(id)) : Array.from(new Set([...prev, ...visibleIds]))); }}
                    className="h-3.5 w-3.5 rounded accent-[#243B5A] cursor-pointer"
                  />
                  <span>전체 선택</span>
                </div>
              )}
              <span className="text-[10px]">※ 반납 이력을 확인하세요.  </span>
            </div>

            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {filteredRecentInventoryLogs.map((log) => {
                const isSelected = selectedLogIds.includes(String(log.id));
                const isReturnCompleted = log.type.includes('반납완료') || log.type.includes('교정 반입');
                const isIssueAlert = log.type.includes('이상알림');
                const isConsumableUsage = log.type.includes('소모성 사용');
                const matchedHistoryItem = findInventoryItemForLog(log);
                const historySerialNo = matchedHistoryItem?.serial_number || (matchedHistoryItem?.type === 'CABIN' ? matchedHistoryItem?.serial_number : undefined) || ((matchedHistoryItem?.category === '압력계' || matchedHistoryItem?.category === 'VBT') ? (matchedHistoryItem?.code || log.item_code) : undefined);
                const issuedBy = log.issued_by || log.worker_name;
                const returnedBy = log.returned_by;

                return (
                  <div
                    key={log.id}
                    className={`p-2.5 rounded-lg border text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 transition ${
                      isSelected ? 'bg-blue-50/40 border-blue-300' : 'bg-[#F5F6F8]/50 border-[#E2E5E9]'
                    }`}
                  >
                    <div className="flex items-start space-x-2 min-w-0 flex-1">
                      {isAdmin && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectLog(log.id)}
                          className="mt-0.5 h-3.5 w-3.5 rounded accent-[#243B5A] cursor-pointer shrink-0"
                        />
                      )}
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          {log.is_new && (
                            <span className="text-red-600 font-extrabold text-xs leading-none" title="신규/변경 이력">N</span>
                          )}
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            String(log.type || '').includes('교정') ? 'bg-blue-100 text-blue-800' : isReturnCompleted ? 'bg-emerald-100 text-emerald-800' : isConsumableUsage ? 'bg-slate-100 text-slate-700' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {log.type}
                          </span>
                          <span className="font-bold text-[#1F2937] truncate">{log.item_name}</span>
                          {historySerialNo && (
                            <span className="text-[10px] font-mono bg-white border border-[#E2E5E9] text-[#475569] px-1.5 py-0.2 rounded">시리얼번호: {historySerialNo}</span>
                          )}
                          <span className="text-[10px] text-[#64748B]">({log.quantity} EA)</span>
                          {isIssueAlert && (
                            <span className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0.2 rounded font-bold border border-red-200">
                              ⚠️ 이상(결함) 발생
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-[#64748B] flex flex-wrap items-center gap-x-2">
                          {isReturnCompleted ? (
                            <>
                              <span>{String(log.type || '').includes('교정') ? '교정 반출: ' : '불출: '}<strong className="text-[#1F2937]">{issuedBy || '-'}</strong></span>
                              <span>|</span>
                              <span>{String(log.type || '').includes('교정') ? '교정 반입: ' : '반납: '}<strong className="text-[#1F2937]">{returnedBy || '-'}</strong></span>
                            </>
                          ) : (
                            <span>{isConsumableUsage ? '사용: ' : String(log.type || '').includes('교정 반출') ? '교정 반출: ' : '불출: '}<strong className="text-[#1F2937]">{log.issued_by || log.worker_name}</strong></span>
                          )}
                          <span>|</span>
                          <span>일시: {new Date(log.created_at).toLocaleString('ko-KR')}</span>
                          {log.memo && (
                            <>
                              <span>|</span>
                              <span className="text-slate-600 truncate max-w-xs">메모: {log.memo}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0 self-end sm:self-center">
                      {log.batch_id && !isReturnCompleted && log.item_name?.includes('일괄 불출') ? (
                        <button
                          type="button"
                          disabled={batchReturnProcessingId === log.batch_id}
                          onClick={() => handleOpenReturnModal(log)}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded text-[10px] font-semibold transition"
                        >
                          {batchReturnProcessingId === log.batch_id ? '처리중...' : '일괄 반납'}
                        </button>
                      ) : isConsumableUsage ? (
                        <button
                          type="button"
                          disabled
                          className="px-2 py-1 bg-gray-100 text-gray-400 border border-gray-200 rounded text-[10px] font-semibold cursor-not-allowed"
                        >
                          소모성 사용 완료
                        </button>
                      ) : !isReturnCompleted && !log.type.includes('입고') && !log.item_name?.includes('[CABIN') ? (
                        <button
                          onClick={() => handleOpenReturnModal(log)}
                          className={`px-2 py-1 ${log.type.includes('교정 반출') ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white rounded text-[10px] font-semibold transition`}
                        >
                          {log.type.includes('교정 반출') ? '교정 반입' : '반납처리'}
                        </button>
                      ) : null}

                      {isAdmin && (
                        <>
                          <button
                            onClick={() => handleOpenEditLog(log)}
                            className="p-1 text-[#64748B] hover:text-[#1F2937] hover:bg-gray-200 rounded transition"
                            title="이력 수정"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => handleOpenDeleteLog(log.id)}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition"
                            title="이력 삭제"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredRecentInventoryLogs.length === 0 && (
                <div className="text-center py-6 text-[#64748B] text-xs">
                  선택한 조건에 해당하는 이력이 없습니다. 교정 반입 완료 내역은 상단의 교정 반입, 기자재 반납 내역은 기자재 반납 이력에서 확인하세요.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {pendingDeleteReturnHistoryId !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#E2E5E9] max-w-sm w-full p-5 shadow-2xl space-y-4 text-center">
            <div className="mx-auto w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1F2937] mb-1">반납 이력 삭제 확인</h3>
              <p className="text-xs text-[#64748B]">정말 이 반납 이력을 삭제하시겠습니까?</p>
            </div>
            <div className="flex space-x-2 pt-2">
              <button onClick={() => setPendingDeleteReturnHistoryId(null)} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-[#64748B] font-semibold text-xs rounded-lg transition">취소</button>
              <button onClick={executeDeleteReturnHistory} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-lg transition">삭제하기</button>
            </div>
          </div>
        </div>
      )}

      {showBatchDeleteReturnHistoryConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#E2E5E9] max-w-sm w-full p-5 shadow-2xl space-y-4 text-center">
            <div className="mx-auto w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1F2937] mb-1">반납 이력 일괄 삭제 확인</h3>
              <p className="text-xs text-[#64748B] break-keep">선택한 <strong className="text-[#1F2937]">{selectedReturnHistoryIds.length}개</strong>의 반납 이력을 정말 삭제하시겠습니까?</p>
            </div>
            <div className="flex space-x-2 pt-2">
              <button onClick={() => setShowBatchDeleteReturnHistoryConfirm(false)} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-[#64748B] font-semibold text-xs rounded-lg transition">취소</button>
              <button onClick={executeBatchDeleteReturnHistories} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-lg transition">일괄 삭제</button>
            </div>
          </div>
        </div>
      )}

      {isReturnHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#E2E5E9] max-w-5xl w-full p-5 shadow-2xl space-y-4 text-[#1F2937] max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center pb-2 border-b border-[#E2E5E9] shrink-0">
              <div className="flex items-center space-x-2">
                <History className="h-4 w-4 text-[#243B5A]" />
                <h3 className="text-sm font-bold">기자재 반납 이력</h3>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-semibold">{filteredReturnHistories.length}건</span>
              </div>
              <div className="flex items-center space-x-2">
                {isAdmin && selectedReturnHistoryIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleOpenBatchDeleteReturnHistories}
                    className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold transition flex items-center space-x-1 shadow-2xs"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>선택 삭제 ({selectedReturnHistoryIds.length})</span>
                  </button>
                )}
                <button type="button" onClick={() => setIsReturnHistoryOpen(false)} className="text-[#64748B] hover:text-[#1F2937] p-1"><X className="h-4 w-4" /></button>
              </div>
            </div>

            {isAdmin && filteredReturnHistories.length > 0 && (
              <div className="flex items-center justify-between bg-[#F5F6F8] px-3 py-1.5 rounded-md border border-[#E2E5E9] text-xs shrink-0">
                <label className="flex items-center space-x-2 font-semibold text-[#64748B] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filteredReturnHistories.length > 0 && filteredReturnHistories.every(history => selectedReturnHistoryIds.includes(String(history.id)))}
                    onChange={() => { const visibleIds = filteredReturnHistories.map(history => String(history.id)); const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedReturnHistoryIds.includes(id)); setSelectedReturnHistoryIds(prev => allVisibleSelected ? prev.filter(id => !visibleIds.includes(id)) : Array.from(new Set([...prev, ...visibleIds]))); }}
                    className="h-3.5 w-3.5 rounded accent-[#243B5A] cursor-pointer"
                  />
                  <span>전체 선택 ({filteredReturnHistories.filter(history => selectedReturnHistoryIds.includes(String(history.id))).length}/{filteredReturnHistories.length})</span>
                </label>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <label htmlFor="return-history-category" className="text-[11px] font-semibold text-[#64748B]">기자재 종류</label>
              <Select value={returnHistoryCategoryFilter} onValueChange={value => { setReturnHistoryCategoryFilter(value); setSelectedReturnHistoryIds([]); }}>
                <SelectTrigger id="return-history-category" className="h-8 min-w-0 max-w-full border-[#E2E5E9] bg-white text-xs text-[#1F2937]">
                  <SelectValue placeholder="전체 종류" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="전체">전체 종류</SelectItem>
                  {Array.from(new Set(inventoryList.filter(item => item.type === '고정' && (item.category || item.sheet_name)).map(item => String(item.category || item.sheet_name)))).sort((a, b) => a.localeCompare(b, 'ko-KR')).map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                </SelectContent>
              </Select>
              {returnHistoryCategoryFilter !== '전체' && <button type="button" onClick={() => { setReturnHistoryCategoryFilter('전체'); setSelectedReturnHistoryIds([]); }} className="text-[11px] text-[#64748B] underline">필터 초기화</button>}
            </div>

            <div className="overflow-y-auto max-h-[65vh] space-y-1.5 flex-1 pr-1">
              {loadingReturnHistories ? (
                <div className="text-center py-8 text-[#64748B] text-xs">반납 이력을 불러오는 중입니다.</div>
              ) : filteredReturnHistories.length === 0 ? (
                <div className="text-center py-8 text-[#64748B] text-xs">등록된 기자재 반납 이력이 없습니다. 교정 반입 내역은 상단의 교정 반입에서 확인하세요.</div>
              ) : (
                filteredReturnHistories.map((history) => {
                  const isSelected = selectedReturnHistoryIds.includes(String(history.id));
                  return (
                    <div 
                      key={history.id} 
                      className={`p-2.5 rounded-lg border text-xs flex flex-col lg:flex-row justify-between gap-2 transition ${
                        isSelected ? 'bg-blue-50/40 border-blue-300' : 'bg-[#F5F6F8]/50 border-[#E2E5E9]'
                      }`}
                    >
                      <div className="flex items-start space-x-2 min-w-0 flex-1">
                        {isAdmin && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectReturnHistory(history.id)}
                            className="mt-0.5 h-3.5 w-3.5 rounded accent-[#243B5A] cursor-pointer shrink-0"
                          />
                        )}
                        <div className="min-w-0 space-y-1 flex-1">
                          <div className="flex items-center flex-wrap gap-1.5">
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">반납완료</span>
                            <span className="font-bold text-[#1F2937] truncate">{history.item_name || '-'}</span>
                            <span className="text-[10px] font-mono bg-white border border-[#E2E5E9] text-[#475569] px-1.5 py-0.2 rounded">시리얼번호: {inventoryList.find(item => item.type === '고정' && (item.code === history.item_code || item.name === history.item_name))?.serial_number || '-'}</span>
                            <span className="text-[10px] text-[#64748B]">({history.quantity} EA)</span>
                          </div>
                          <div className="text-[11px] text-[#64748B] flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span>불출자: <strong className="text-[#1F2937]">{history.issued_by || '-'}</strong></span><span>|</span>
                            <span>반납자: <strong className="text-[#1F2937]">{history.returned_by || '-'}</strong></span><span>|</span>
                            <span>불출일시: {history.issued_at ? new Date(history.issued_at).toLocaleString('ko-KR') : '-'}</span><span>|</span>
                            <span>반납일시: {history.returned_at ? new Date(history.returned_at).toLocaleString('ko-KR') : '-'}</span>
                            {history.memo && <><span>|</span><span className="text-slate-600 truncate max-w-xs">메모: {history.memo}</span></>}
                          </div>
                        </div>
                      </div>

                      {isAdmin && (
                        <button type="button" onClick={() => handleDeleteReturnHistory(history.id)} className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition self-end lg:self-center shrink-0" title="반납 이력 삭제">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 기자재/소모성 추가 입고 모달 */}
      {inboundItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#E2E5E9] max-w-sm w-full p-5 shadow-2xl space-y-4 text-[#1F2937]">
            <div className="flex justify-between items-center pb-2 border-b border-[#E2E5E9]">
              <div>
                <h3 className="text-sm font-bold">자재 입고</h3>
                <p className="text-[11px] text-[#64748B] mt-1">{inboundItem.name || inboundItem.item} · 현재 보유 {inboundItem.quantity} {inboundItem.unit || 'EA'}</p>
              </div>
              <button type="button" onClick={() => setInboundItem(null)} disabled={inboundSubmitting}><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSubmitInbound} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#64748B] font-semibold mb-1">추가 입고 수량</label>
                <input type="number" min="1" step="1" required autoFocus value={inboundQty} onChange={e => setInboundQty(Number(e.target.value))} className="w-full px-2.5 py-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]" />
                <p className="text-[11px] text-emerald-700 mt-1">입고 후 보유수량: {Number(inboundItem.quantity || 0) + (Number(inboundQty) > 0 ? Number(inboundQty) : 0)} {inboundItem.unit || 'EA'}</p>
              </div>
              <div>
                <label className="block text-[#64748B] font-semibold mb-1">메모 (선택)</label>
                <textarea value={inboundMemo} onChange={e => setInboundMemo(e.target.value)} rows={2} placeholder="입고 사유 또는 참고사항" className="w-full px-2.5 py-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937] resize-y" />
              </div>
              <div className="flex space-x-2 pt-3 border-t border-[#E2E5E9]">
                <button type="button" disabled={inboundSubmitting} onClick={() => setInboundItem(null)} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-[#64748B] font-semibold text-xs rounded-lg transition disabled:opacity-50">취소</button>
                <button type="submit" disabled={inboundSubmitting} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg transition disabled:opacity-50">{inboundSubmitting ? '처리 중...' : '입고 처리'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 자재 등록 / 수정 Sheet 모달 */}
      {showInventorySheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#E2E5E9] max-w-md w-full p-5 shadow-2xl space-y-4 text-[#1F2937] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-[#E2E5E9]">
              <h3 className="text-sm font-bold">
                {editingItem ? '자재 정보 수정' : '신규 자재 등록'}
              </h3>
              <button onClick={() => setShowInventorySheet(false)}><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={handleSubmitInventory} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#64748B] font-semibold mb-1">구분</label>
                <div className="flex space-x-2">
                  {(['고정', '소모성', 'CABIN'] as MainTab[]).map(t => (
                    <button
                      key={t}
                      type="button"
                      disabled={!!editingItem}
                      onClick={() => setItemType(t)}
                      className={`flex-1 py-1.5 rounded-md font-semibold text-xs border ${
                        itemType === t ? 'bg-[#243B5A] text-white border-[#243B5A]' : 'bg-[#F5F6F8] text-[#64748B] border-[#E2E5E9]'
                      } disabled:opacity-50`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {itemType === 'CABIN' ? (
                <>
                  <div>
                    <label className="block text-[#64748B] font-semibold mb-1">Sheet 이름 / 카테고리</label>
                    <input 
                      type="text" 
                      required 
                      value={cabinSheetName} 
                      onChange={e => setCabinSheetName(e.target.value)} 
                      placeholder="예: C#1" 
                      className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]" 
                    />
                  </div>
                  <div>
                    <label className="block text-[#64748B] font-semibold mb-1">NO / 식별코드</label>
                    <input 
                      type="text" 
                      required 
                      value={itemCode} 
                      onChange={e => setItemCode(e.target.value)} 
                      className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]" 
                    />
                  </div>
                  <div>
                    <label className="block text-[#64748B] font-semibold mb-1">품목명 (ITEM)</label>
                    <input 
                      type="text" 
                      required 
                      value={itemName} 
                      onChange={e => setItemName(e.target.value)} 
                      className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]" 
                    />
                  </div>
                  <div>
                    <label className="block text-[#64748B] font-semibold mb-1">제조사 및 모델명</label>
                    <input 
                      type="text" 
                      value={cabinMakerModel} 
                      onChange={e => setCabinMakerModel(e.target.value)} 
                      className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]" 
                    />
                  </div>
                  <div>
                    <label className="block text-[#64748B] font-semibold mb-1">시리얼 번호 (SERIAL NO)</label>
                    <input 
                      type="text" 
                      value={cabinSerialNo} 
                      onChange={e => setCabinSerialNo(e.target.value)} 
                      className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]" 
                    />
                  </div>
                  <div>
                    <label className="block text-[#64748B] font-semibold mb-1">성적서 번호 (CERT NO)</label>
                    <input 
                      type="text" 
                      value={cabinCertNo} 
                      onChange={e => setCabinCertNo(e.target.value)} 
                      className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]" 
                    />
                  </div>
                  <div>
                    <label className="block text-[#64748B] font-semibold mb-1">교정일자</label>
                    <CalendarDatePicker value={cabinCalibrationDate} onChange={setCabinCalibrationDate} label="교정일자" className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]" />
                  </div>
                  <div>
                    <label className="block text-[#64748B] font-semibold mb-1">구역 및 보관 위치</label>
                    <input 
                      type="text" 
                      value={cabinLocationSection} 
                      onChange={e => setCabinLocationSection(e.target.value)} 
                      className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]" 
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-[#64748B] font-semibold mb-1">품목명 / 자재명</label>
                    <input 
                      type="text" 
                      required 
                      value={itemName} 
                      onChange={e => setItemName(e.target.value)} 
                      className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]" 
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="block text-[#64748B] font-semibold">서브 카테고리</label>
                      {isAdmin && <button type="button" onClick={() => setIsSubCatModalOpen(true)} className="text-[10px] font-semibold text-[#243B5A] underline">추가 · 수정 · 삭제</button>}
                    </div>
                    <Select value={itemCategory || getCurrentSubCategories()[0] || '기타'} onValueChange={value => {
                      setItemCategory(value);
                      // 서브 카테고리가 바뀌면 이전 카테고리에 연결된 자재명 카테고리를 초기화합니다.
                      setItemNameCategory('');
                    }}>
                      <SelectTrigger className="h-9 w-full border-[#E2E5E9] bg-[#F5F6F8] text-xs text-[#1F2937]">
                        <SelectValue placeholder="서브 카테고리 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {getCurrentSubCategories().map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="mt-2 rounded-md border border-[#E2E5E9] bg-white px-2.5 py-2 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-[#475569]">자재명 카테고리</div>
                          <div className="text-[10px] text-[#94A3B8]">이 자재명을 기존 카테고리에 연결할 수 있습니다.</div>
                        </div>
                        {isAdmin && <button type="button" onClick={() => { void handleOpenItemSubCategorySettings(); }} className="shrink-0 rounded-md border border-[#E2E5E9] bg-[#F5F6F8] px-2.5 py-1.5 text-[10px] font-semibold text-[#243B5A]">추가 · 수정 · 삭제</button>}
                      </div>
                      <Select value={itemNameCategory || '__none__'} onValueChange={value => setItemNameCategory(value === '__none__' ? '' : value)}>
                        <SelectTrigger className="h-9 w-full border-[#E2E5E9] bg-[#F5F6F8] text-xs text-[#1F2937]">
                          <SelectValue placeholder="자재명 카테고리 선택 (선택사항)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">카테고리 연결 안 함</SelectItem>
                          {Array.from(new Set(itemSubCategoryRows.filter(row => row.inventory_type === itemType && row.parent_category === itemCategory && row.is_active !== false).map(row => String(row.name || '').trim()).filter(Boolean))).map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {itemType === '고정' && (itemCategory === 'VBT' || itemCategory === '압력계') && (
                    <div>
                      <label className="block text-[#64748B] font-semibold mb-1">{itemCategory === '압력계' ? '구분' : 'VBT 타입'}</label>
                      <input 
                        type="text" 
                        placeholder={itemCategory === '압력계' ? '예: VBT, MINI 등' : '예: 1L, 2S 등'} 
                        value={itemVbtType} 
                        onChange={e => setItemVbtType(e.target.value)} 
                        className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]" 
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-[#64748B] font-semibold mb-1">시리얼 번호 (S/N)</label>
                    <input 
                      type="text" 
                      value={itemSerialNo} 
                      onChange={e => setItemSerialNo(e.target.value)} 
                      className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]" 
                    />
                  </div>
                  {itemType === '고정' && (
                    <div className="space-y-2 rounded-lg border border-[#E2E5E9] bg-[#F8FAFC] p-2.5">
                      <label className="flex items-center gap-2 font-semibold text-[#475569] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={itemNeedsCalibration}
                          onChange={checkedEvent => {
                            const checked = checkedEvent.target.checked;
                            setItemNeedsCalibration(checked);
                            if (!checked) { setItemCalDate(''); setItemNextCalDate(''); }
                          }}
                          className="h-3.5 w-3.5 rounded accent-[#243B5A]"
                        />
                        교정관리 대상 자재
                      </label>
                      {itemNeedsCalibration && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[#64748B] font-semibold mb-1">교정일자</label>
                            <CalendarDatePicker value={itemCalDate} onChange={handleCalibrationDateChange} label="교정일자" className="w-full px-2.5 py-1.5 bg-white border border-[#E2E5E9] rounded-md text-[#1F2937]" />
                          </div>
                          <div>
                            <label className="block text-[#64748B] font-semibold mb-1">차기 교정예정일</label>
                            <CalendarDatePicker value={itemNextCalDate} onChange={setItemNextCalDate} label="차기 교정예정일" className="w-full px-2.5 py-1.5 bg-white border border-[#E2E5E9] rounded-md text-[#1F2937]" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[#64748B] font-semibold mb-1">초기 / 보유 수량</label>
                      <input 
                        type="number" 
                        min="0" 
                        required 
                        value={itemQuantity} 
                        onChange={e => setItemQuantity(Number(e.target.value))} 
                        className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]" 
                      />
                    </div>
                    <div>
                      <label className="block text-[#64748B] font-semibold mb-1">단위</label>
                      <input 
                        type="text" 
                        value={itemUnit} 
                        onChange={e => setItemUnit(e.target.value)} 
                        className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[#64748B] font-semibold mb-1">보관 장소 / 위치</label>
                    <input 
                      type="text" 
                      value={itemLocation} 
                      onChange={e => setItemLocation(e.target.value)} 
                      className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]" 
                    />
                  </div>
                </>
              )}

              <div className="flex space-x-2 pt-3 border-t border-[#E2E5E9]">
                {editingItem && (
                  <button 
                    type="button" 
                    onClick={() => handleDeleteInventory(editingItem)} 
                    className="py-2 px-3 bg-red-100 hover:bg-red-200 text-red-600 font-semibold text-xs rounded-lg transition"
                  >
                    삭제
                  </button>
                )}
                <button 
                  type="button" 
                  onClick={() => setShowInventorySheet(false)} 
                  className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-[#64748B] font-semibold text-xs rounded-lg transition"
                >
                  취소
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2 bg-[#243B5A] hover:bg-[#1d3049] text-white font-semibold text-xs rounded-lg transition"
                >
                  저장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 불출/사용 처리 모달 */}
      {showLogSheet && targetItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#E2E5E9] max-w-sm w-full p-5 shadow-2xl space-y-4 text-[#1F2937]">
            <div className="flex justify-between items-center pb-2 border-b border-[#E2E5E9]">
              <h3 className="text-sm font-bold">{logType} 등록</h3>
              <button onClick={() => setShowLogSheet(false)}><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={handleSubmitLog} className="space-y-3 text-xs">
              <div className="bg-[#F5F6F8] p-2.5 rounded-md border border-[#E2E5E9] space-y-1">
                <span className="text-[10px] text-[#64748B] block">선택 품목</span>
                <p className="font-bold text-[#1F2937]">{targetItem.name || targetItem.item}</p>
                <p className="text-[10px] text-[#64748B]">자재코드: <strong className="font-mono text-[#243B5A]">{targetItem.code || targetItem.no || '-'}</strong></p>
                <p className="text-[10px] text-[#64748B]">현재 보유 재고: {targetItem.quantity} {targetItem.unit}</p>
              </div>

              <div>
                <label className="block text-[#64748B] font-semibold mb-1">수량</label>
                <input 
                  type="number" 
                  min="1" 
                  max={(logType === '반납' || logType === '교정 반입') ? undefined : Math.max(1, Number(targetItem.quantity) || 0)}
                  required 
                  value={logQty} 
                  onChange={e => setLogQty(Number(e.target.value))} 
                  className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937] font-bold" 
                />
              </div>

              <div>
                <label className="block text-[#64748B] font-semibold mb-1">사유 / 사용 목적 / 메모</label>
                <input 
                  type="text" 
                  placeholder="예: 2번 탱크 불출" 
                  value={logMemo} 
                  onChange={e => setLogMemo(e.target.value)} 
                  className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]" 
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button type="button" onClick={() => setShowLogSheet(false)} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-[#64748B] font-semibold text-xs rounded-lg transition">취소</button>
                <button type="submit" className="flex-1 py-2 bg-[#243B5A] hover:bg-[#1d3049] text-white font-semibold text-xs rounded-lg transition">등록 확정</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 선택된 자재 일괄 처리 플로팅 액션 바 */}
      <div
        className={`fixed inset-x-0 bottom-0 z-[55] px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2 transition-all duration-300 ease-out ${((inventoryTab === '고정' && selectedFixedIds.length > 0) || (inventoryTab === '소모성' && selectedConsumableIds.length > 0) || (inventoryTab === 'CABIN' && selectedCabinIds.length > 0)) ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}
        aria-hidden={!((inventoryTab === '고정' && selectedFixedIds.length > 0) || (inventoryTab === '소모성' && selectedConsumableIds.length > 0) || (inventoryTab === 'CABIN' && selectedCabinIds.length > 0))}
      >
        <div className="mx-auto flex w-full max-w-xl flex-col gap-2 rounded-2xl border border-[#D8DEE8] bg-white/95 p-3 shadow-[0_-8px_30px_rgba(15,23,42,0.16)] backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 sm:justify-start">
            {(inventoryTab === '고정' || inventoryTab === '소모성') && (
              <div className="flex min-w-0 items-center gap-1.5">
                <label className="shrink-0 text-[10px] sm:text-xs font-semibold text-[#64748B]">카테고리</label>
                <Select
                  value={(inventoryTab === '고정' ? selectedFixedSubCategory : selectedConsumableCategory) || '전체 보기'}
                  onValueChange={(value) => {
                    if (inventoryTab === '고정') {
                      setSelectedFixedSubCategory(value);
                      if (value === 'VBT') setSelectedVbtSubCategory('1L');
                    } else {
                      setSelectedConsumableCategory(value);
                    }
                    setSelectedItemSubCategory('전체 보기');
                    // 선택된 품목과 수량은 카테고리 이동 후에도 유지합니다.
                  }}
                >
                  <SelectTrigger aria-label="플로팅바 카테고리 이동" className="h-8 w-[118px] sm:w-[150px] min-w-0 border-[#E2E5E9] bg-white px-2 text-[11px] font-semibold text-[#243B5A]">
                    <SelectValue placeholder="카테고리 이동" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="전체 보기">전체 보기</SelectItem>
                    {(inventoryTab === '고정' ? fixedSubCategories : consumableSubCategories).map(cat => <SelectItem key={cat} value={cat}>{cat === '교정' ? '교정 대상' : cat}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <span className="text-xs sm:text-sm font-bold text-[#243B5A] whitespace-nowrap">
              {inventoryTab === '고정' ? selectedFixedIds.length : inventoryTab === '소모성' ? selectedConsumableIds.length : selectedCabinIds.length}건 선택됨
            </span>
            <button type="button" onClick={() => { setSelectedFixedIds([]); setFixedBatchQuantities({}); setSelectedConsumableIds([]); setConsumableBatchQuantities({}); setSelectedCabinIds([]); }} className="px-2.5 py-1.5 rounded-lg border border-[#E2E5E9] bg-[#F8FAFC] text-[11px] sm:text-xs font-semibold text-[#64748B] hover:bg-[#EEF0F3] whitespace-nowrap">선택 해제</button>
          </div>
          <div className={`grid gap-2 ${inventoryTab === 'CABIN' ? 'grid-cols-2' : 'grid-cols-1'} sm:flex sm:flex-1 sm:justify-end`}>
            {inventoryTab === '소모성' && <button type="button" onClick={openConsumableBatchModal} className="min-h-11 w-full rounded-xl bg-[#243B5A] px-3 py-2.5 text-xs sm:text-sm font-bold leading-tight text-white shadow-sm transition hover:bg-[#1d3049] whitespace-normal break-keep">일괄 사용 ({selectedConsumableIds.length})</button>}
            {inventoryTab === '고정' && <button type="button" onClick={openFixedBatchModal} className="min-h-11 w-full rounded-xl bg-[#243B5A] px-3 py-2.5 text-xs sm:text-sm font-bold leading-tight text-white shadow-sm transition hover:bg-[#1d3049] whitespace-normal break-keep">일괄 불출 ({selectedFixedIds.length})</button>}
            {inventoryTab === 'CABIN' && <>
              <button type="button" onClick={() => setShowCabinBatchModal(true)} className="min-h-11 w-full rounded-xl bg-[#243B5A] px-2 py-2.5 text-xs sm:text-sm font-bold leading-tight text-white shadow-sm transition hover:bg-[#1d3049] whitespace-normal break-keep">일괄 불출 ({selectedCabinIds.length})</button>
              <button type="button" onClick={() => setShowCabinBatchReturnModal(true)} className="min-h-11 w-full rounded-xl bg-blue-600 px-2 py-2.5 text-xs sm:text-sm font-bold leading-tight text-white shadow-sm transition hover:bg-blue-700 whitespace-normal break-keep">일괄 반납 ({selectedCabinIds.length})</button>
            </>}
          </div>
        </div>
      </div>

    </div>
  );
}
