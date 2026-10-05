'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
  Compass,
  MapPin,
  Settings,
  History,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// 자체 정의된 타입 (에러 방지용)
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
  const [cabinInventoryList, setCabinInventoryList] = useState<any[]>([]);
  const [loadingCabin, setLoadingCabin] = useState<boolean>(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showCenterToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  // --- 매일 23시 이력 자동 정리/삭제 스케줄러 ---
  // 23:00 정각에 페이지가 닫혀 있어도 다음 접속 시 전날 이력이 정리되도록 처리합니다.
  // 반납완료 이력과 소모성 자재 불출/사용 이력만 삭제합니다.
  const cleanupRanDateRef = useRef<string | null>(null);

  useEffect(() => {
    const processDailyCleanup = async () => {
      const now = new Date();
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      const lastCleanupDate = typeof window !== 'undefined' ? localStorage.getItem('inventory_cleanup_last_run') : null;

      // 23시 이전에 접속한 경우: 어제 23시 정리를 놓쳤다면 오늘 00시 이전의 대상 이력만 정리합니다.
      // 오늘 생성된 이력까지 미리 삭제하지 않도록 날짜 기준을 적용합니다.
      if (now.getHours() < 23) {
        if (lastCleanupDate === yesterdayKey) return;

        try {
          const todayStart = new Date(now);
          todayStart.setHours(0, 0, 0, 0);
          const todayStartIso = todayStart.toISOString();

          const { data: consumableItems, error: consumableError } = await supabase
            .from('inventory')
            .select('id')
            .eq('type', '소모성');
          if (consumableError) throw consumableError;

          const consumableIds = (consumableItems || []).map((item: any) => item.id);

          // 1. 전날까지의 반납완료 이력 삭제
          const { error: returnedDeleteError } = await supabase
            .from('inventory_logs')
            .delete()
            .ilike('type', '%반납완료%')
            .lt('created_at', todayStartIso);
          if (returnedDeleteError) throw returnedDeleteError;

          // 2. 전날까지의 소모성 자재 불출/사용 이력 삭제
          if (consumableIds.length > 0) {
            const { error: consumableDeleteError } = await supabase
              .from('inventory_logs')
              .delete()
              .in('inventory_id', consumableIds)
              .lt('created_at', todayStartIso);
            if (consumableDeleteError) throw consumableDeleteError;
          }

          // 3. 전날까지의 소모성 사용 이력 정리
          const { error: usageDeleteError } = await supabase
            .from('inventory_logs')
            .delete()
            .ilike('type', '%소모성 사용%')
            .lt('created_at', todayStartIso);
          if (usageDeleteError) throw usageDeleteError;

          if (typeof window !== 'undefined') {
            localStorage.setItem('inventory_cleanup_last_run', yesterdayKey);
          }
          cleanupRanDateRef.current = yesterdayKey;
          await fetchInventoryLogs();
        } catch (err) {
          console.error('23시 자동 삭제 오류:', err);
        }
        return;
      }

      // 23시 이후에는 오늘 날짜 기준으로 한 번만 전체 대상 이력을 정리합니다.
      if (cleanupRanDateRef.current === todayKey || lastCleanupDate === todayKey) return;

      try {
        // 소모성 자재의 실제 inventory ID를 먼저 조회하여 이름 중복으로 인한 오삭제를 방지합니다.
        const { data: consumableItems, error: consumableError } = await supabase
          .from('inventory')
          .select('id')
          .eq('type', '소모성');
        if (consumableError) throw consumableError;

        const consumableIds = (consumableItems || []).map((item: any) => item.id);

        // 1. 반납완료 이력 삭제
        const { error: returnedDeleteError } = await supabase
          .from('inventory_logs')
          .delete()
          .ilike('type', '%반납완료%');
        if (returnedDeleteError) throw returnedDeleteError;

        // 2. 소모성 자재의 불출/사용 이력 삭제
        if (consumableIds.length > 0) {
          const { error: consumableDeleteError } = await supabase
            .from('inventory_logs')
            .delete()
            .in('inventory_id', consumableIds);
          if (consumableDeleteError) throw consumableDeleteError;
        }

        // 3. 기존 데이터 중 inventory_id가 없지만 유형에 소모성 사용이 기록된 이력도 정리
        const { error: usageDeleteError } = await supabase
          .from('inventory_logs')
          .delete()
          .ilike('type', '%소모성 사용%');
        if (usageDeleteError) throw usageDeleteError;

        cleanupRanDateRef.current = todayKey;
        if (typeof window !== 'undefined') {
          localStorage.setItem('inventory_cleanup_last_run', todayKey);
        }
        await fetchInventoryLogs();
      } catch (err) {
        console.error('23시 자동 삭제 오류:', err);
      }
    };

    processDailyCleanup();
    const timer = setInterval(processDailyCleanup, 60000);
    return () => clearInterval(timer);
  }, [fetchInventoryLogs]);

  // 이력에 inventory_id가 있으면 반드시 ID를 우선 사용합니다.
  // 동일한 품목명이 여러 개 존재할 때 첫 번째 자재가 잘못 연결되는 문제를 방지합니다.
  const findInventoryItemForLog = (log: InventoryLog) => {
    if (log.inventory_id !== undefined && log.inventory_id !== null && log.inventory_id !== '') {
      const byId = inventoryList.find(i => String(i.id) === String(log.inventory_id));
      if (byId) return byId;
    }
    if (log.item_name) {
      return inventoryList.find(i => i.name === log.item_name);
    }
    return undefined;
  };

  // 반납 모달 상태 (수량 확인 및 이상유무 체크 포함)
  const [showReturnModal, setShowReturnModal] = useState<boolean>(false);
  const [targetReturnLog, setTargetReturnLog] = useState<InventoryLog | null>(null);
  const [returnQty, setReturnQty] = useState<number>(1);
  const [returnHasIssue, setReturnHasIssue] = useState<boolean>(false);
  const [returnMemo, setReturnMemo] = useState<string>('');
  const returnSubmittingRef = useRef(false);

  // --- 이력 수정 모달 상태 ---
  const [showEditLogModal, setShowEditLogModal] = useState<boolean>(false);
  const [targetEditLog, setTargetEditLog] = useState<InventoryLog | null>(null);
  const [editLogQty, setEditLogQty] = useState<number>(1);
  const [editLogMemo, setEditLogMemo] = useState<string>('');

  const [pendingDeleteLogId, setPendingDeleteLogId] = useState<string | number | null>(null);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState<boolean>(false);

  // --- CABIN 전용 추가 상태 ---
  const [selectedCabinIds, setSelectedCabinIds] = useState<string[]>([]);
  const [cabinCalibrationOnly, setCabinCalibrationOnly] = useState<boolean>(false);
  const [showCabinBatchModal, setShowCabinBatchModal] = useState<boolean>(false);
  const [cabinBatchMemo, setCabinBatchMemo] = useState<string>('');
  
  // --- CABIN 일괄 반납 모달 상태 ---
  const [showCabinBatchReturnModal, setShowCabinBatchReturnModal] = useState<boolean>(false);
  const [cabinBatchReturnMemo, setCabinBatchReturnMemo] = useState<string>('');
  const [cabinBatchReturnHasIssue, setCabinBatchReturnHasIssue] = useState<boolean>(false);

  const [fixedSubCategories, setFixedSubCategories] = useState<string[]>([
    '압력계', '가스측정기', 'VBT', '공구', '무선 배터리', '교정', '기타'
  ]);
  const [selectedFixedSubCategory, setSelectedFixedSubCategory] = useState<string>('압력계');

  const [consumableSubCategories, setConsumableSubCategories] = useState<string[]>([
    '검사약품', '기밀', '기타'
  ]);
  const [selectedConsumableCategory, setSelectedConsumableCategory] = useState<string>('검사약품');

  // 기자재/소모성 서브 카테고리를 Supabase에 영구 저장
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
    const { error: deleteError } = await supabase
      .from('inventory_subcategories')
      .delete()
      .eq('inventory_type', type);
    if (deleteError) throw deleteError;
    if (cleaned.length) {
      const { error: insertError } = await supabase
        .from('inventory_subcategories')
        .insert(cleaned.map((name, index) => ({ inventory_type: type, name, sort_order: index })));
      if (insertError) throw insertError;
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
  const [isReturnHistoryOpen, setIsReturnHistoryOpen] = useState(false);
  const [returnHistories, setReturnHistories] = useState<InventoryReturnHistory[]>([]);
  const [loadingReturnHistories, setLoadingReturnHistories] = useState(false);
  const [pendingDeleteReturnHistoryId, setPendingDeleteReturnHistoryId] = useState<string | number | null>(null);
  const [calibrationAlertItems, setCalibrationAlertItems] = useState<{ item: any; daysLeft: number; calDate: string; nextCalDate: string }[]>([]);

  const cleanSheetName = (rawName: string) => {
    if (!rawName) return '';
    return rawName.replace(/^\d+[\.\-\s]+/, '').trim();
  };

  const fetchCabinInventory = async () => {
    setLoadingCabin(true);
    try {
      const { data, error } = await supabase.from('cabin_inventory').select('*');
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
          const savedNames = savedSheets.map((row: any) => row.name).filter((name: string) => sortedSheets.includes(name));
          const newSheets = sortedSheets.filter(name => !savedNames.includes(name));
          orderedSheets = [...savedNames, ...newSheets];
        }
      } catch (savedOrderError) {
        console.error('CABIN 서브탭 순서 불러오기 실패:', savedOrderError);
      }

      setCustomCabinSheets(orderedSheets);
      if (orderedSheets.length > 0 && (!selectedCabinSheet || !orderedSheets.includes(selectedCabinSheet))) {
        setSelectedCabinSheet(orderedSheets[0]);
      }
    } catch (err: any) {
      console.error('cabin_inventory 로드 실패:', err.message);
    } finally {
      setLoadingCabin(false);
    }
  };

  useEffect(() => {
    if (inventoryTab === 'CABIN') {
      fetchCabinInventory();
    }
  }, [inventoryTab]);

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
  }, [cabinTextSubTagsForSheet]);

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

      if (calDateStr) {
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
  }, [inventoryList, cabinInventoryList, inventoryTab]);

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
    return Array.from(new Set(names)).sort((a,b)=>a.localeCompare(b,'ko'));
  }, [inventoryTab, inventoryList, cabinInventoryList, selectedFixedSubCategory, selectedConsumableCategory, selectedCabinSheet]);

  const currentItemSubCategoryEntries = useMemo(() => {
    const parentCategory = inventoryTab === '고정' ? selectedFixedSubCategory : inventoryTab === '소모성' ? selectedConsumableCategory : selectedCabinSheet;
    const rows = itemSubCategoryRows.filter(row => row.inventory_type === inventoryTab && row.parent_category === parentCategory && row.is_active !== false);

    // CABIN은 기존에 자동으로 보이던 실제 자재명을 그대로 유지하고,
    // 설정을 한 번 사용하면 inventory_item_subcategories의 저장값을 기준으로 관리합니다.
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
  }, [itemSubCategoryRows, inventoryTab, selectedFixedSubCategory, selectedConsumableCategory, selectedCabinSheet, currentMaterialNames]);

  const currentItemSubCategoryOptions = currentItemSubCategoryEntries.map(entry => entry.name);

  useEffect(() => {
    if (selectedItemSubCategory !== '전체 보기' && !currentItemSubCategoryOptions.includes(selectedItemSubCategory)) {
      setSelectedItemSubCategory('전체 보기');
    }
  }, [currentItemSubCategoryOptions, selectedItemSubCategory]);

  const getCurrentItemSubCategoryContext = () => {
    const parentCategory = inventoryTab === '고정' ? selectedFixedSubCategory : inventoryTab === '소모성' ? selectedConsumableCategory : selectedCabinSheet;
    return { type: inventoryTab, parentCategory };
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

      // 기존에 자동으로 표시되던 CABIN 자재명을 처음 설정할 때만 DB에 등록합니다.
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
    if (!confirm(`'${name}' 자재 종류를 삭제하시겠습니까?\n\n※ 실제 자재 데이터는 삭제되지 않습니다.`)) return;
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
  const [itemVbtType, setItemVbtType] = useState('');
  const [itemCalDate, setItemCalDate] = useState('');
  const [itemNextCalDate, setItemNextCalDate] = useState('');
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemUnit, setItemUnit] = useState('대');
  const [itemMinQty, setItemMinQty] = useState<number>(0);
  const [itemLocation, setItemLocation] = useState('장비실 A');

  const [cabinSheetName, setCabinSheetName] = useState('');
  const [cabinLocationSection, setCabinLocationSection] = useState('');
  const [cabinMakerModel, setCabinMakerModel] = useState('');
  const [cabinSerialNo, setCabinSerialNo] = useState('');
  const [cabinCertNo, setCabinCertNo] = useState('');
  const [cabinCalibrationDate, setCabinCalibrationDate] = useState('');

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
      showCenterToast('CABIN 서브탭 순서 저장 실패: ' + (error?.message || '알 수 없는 오류') + '\nSupabase의 inventory_subcategories 테이블과 권한 설정을 확인해주세요.');
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

  const handleOpenInventoryCreate = () => {
    if (!isAdmin) return showCenterToast('관리자만 자재를 등록할 수 있습니다.');
    setEditingItem(null);
    setItemType(inventoryTab);
    const codePrefix = inventoryTab === '고정' ? 'FIX-' : inventoryTab === '소모성' ? 'MAT-' : 'CBN-';
    setItemCode(codePrefix + String(Math.floor(Math.random() * 900) + 100));
    setItemName('');
    setItemSerialNo('');
    setItemVbtType('');
    setItemCalDate('');
    setItemNextCalDate('');
    setItemCategory(inventoryTab === '고정' ? selectedFixedSubCategory : inventoryTab === '소모성' ? selectedConsumableCategory : '일반');
    
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
      setItemCode(item.code);
      setItemName(item.name);
      setItemSerialNo(item.serial_number || '');
      setItemCategory(item.category);
      setItemVbtType(item.vbt_type || '');
      const { calDate, nextCalDate } = parseCalDates(item.sub_equipment);
      setItemCalDate(calDate);
      setItemNextCalDate(nextCalDate);
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
        const subEquipValue = itemCalDate.trim() 
          ? (itemNextCalDate.trim() ? `${itemCalDate.trim()} | ${itemNextCalDate.trim()}` : itemCalDate.trim())
          : null;

        const payload = {
          type: itemType,
          code: itemCode.trim(),
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
      }

      setShowInventorySheet(false);
    } catch (err: any) {
      showCenterToast('데이터베이스 저장 실패: ' + err.message);
    }
  };

  const handleDeleteInventory = async (item: any) => {
    if (!isAdmin) return showCenterToast('관리자만 삭제할 수 있습니다.');
    if (!confirm('정말로 이 자재를 삭제하시겠습니까?')) return;

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
  };

  const handleOpenLogModal = (item: any, type: string) => {
    if (item.type === '소모성' && type === '반납') {
      showCenterToast('소모성 자재는 반납 프로세스가 존재하지 않습니다.');
      return;
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

      let currentQty = targetItem.quantity || 0;
      let newQty = currentQty;

      if (logType === '불출' || logType === '소모성 사용') {
        if (currentQty < qtyChange) {
          showCenterToast('현재 보유 재고보다 불출(사용) 수량이 많습니다.');
          return;
        }
        newQty = currentQty - qtyChange;
      } else if (logType === '반납') {
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

      let updateQuery = supabase
        .from('inventory')
        .update({ quantity: newQty, updated_at: new Date().toISOString() })
        .eq('id', targetItem.id);

      if (logType === '반납') {
        updateQuery = updateQuery.lte('quantity', Number(targetItem.initial_quantity) - qtyChange);
      }

      const { data: updatedRows, error: invError } = await updateQuery.select('id, quantity');

      if (invError) throw invError;
      if (logType === '반납' && (!updatedRows || updatedRows.length === 0)) {
        showCenterToast('반납 수량이 최초 보유수량을 초과했거나 이미 다른 반납 처리가 완료되었습니다.');
        return;
      }

      let finalLogType = logType === '소모성 사용' ? '소모성 사용' : logType;
      if (logType === '반납') {
        finalLogType = logHasIssue ? '불출, 반납완료, 이상알림' : '반납완료';
      }

      const { error: logError } = await supabase
        .from('inventory_logs')
        .insert([{
          inventory_id: targetItem.id,
          item_code: targetItem.type === 'CABIN' ? (targetItem.no || targetItem.code || null) : (targetItem.code || null),
          item_name: targetItem.name || targetItem.item,
          type: finalLogType,
          quantity: qtyChange,
          worker_name: currentUser?.name || '작업자',
          issued_by: logType === '반납' ? null : (currentUser?.name || '작업자'),
          returned_by: logType === '반납' ? (currentUser?.name || '작업자') : null,
          memo: logMemo.trim() || null,
          created_at: new Date().toISOString()
        }]);

      if (logError) throw logError;

      showCenterToast(`${logType} 처리가 완료되었습니다.`);
      setShowLogSheet(false);
      await fetchInventory();
      await fetchInventoryLogs();
    } catch (err: any) {
      showCenterToast('처리 중 오류가 발생했습니다: ' + err.message);
    }
  };

  const toggleSelectCabinItem = (id: string | number) => {
    const strId = String(id);
    setSelectedCabinIds(prev => 
      prev.includes(strId) ? prev.filter(item => item !== strId) : [...prev, strId]
    );
  };

  const toggleSelectAllCabin = () => {
    if (selectedCabinIds.length === filteredInventory.length) {
      setSelectedCabinIds([]);
    } else {
      setSelectedCabinIds(filteredInventory.map(item => String(item.id)));
    }
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

      const { error: logError } = await supabase
        .from('inventory_logs')
        .insert([{
          inventory_id: null,
          item_name: `[CABIN 일괄 불출] ${integratedItemName}`,
          type: '불출',
          quantity: selectedItems.length,
          worker_name: currentUser?.name || '작업자',
          memo: cabinBatchMemo.trim() || 'CABIN 교정/작업용 일괄 불출',
          created_at: new Date().toISOString()
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
      const selectedItems = cabinInventoryList.filter(item => selectedCabinIds.includes(String(item.id)));
      if (selectedItems.length === 0) return;

      const firstItemName = selectedItems[0].name || selectedItems[0].item || 'CABIN 품목';
      const integratedItemName = selectedItems.length === 1 
        ? firstItemName 
        : `${firstItemName} 외 ${selectedItems.length - 1}건`;

      const finalLogType = cabinBatchReturnHasIssue ? '불출, 반납완료, 이상알림' : '반납완료';
      const memoText = cabinBatchReturnMemo.trim() ? `일괄 반납메모: ${cabinBatchReturnMemo.trim()}` : 'CABIN 일괄 반납 완료';

      const { data: latestCabinIssueLog } = await supabase
        .from('inventory_logs')
        .select('worker_name, created_at')
        .eq('type', '불출')
        .ilike('item_name', '[CABIN 일괄 불출]%')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const cabinIssuedBy = latestCabinIssueLog?.worker_name || '불출자 미기록';
      const cabinIssuedAt = latestCabinIssueLog?.created_at || null;
      const cabinReturnedAt = new Date().toISOString();

      const { error: logError } = await supabase
        .from('inventory_logs')
        .insert([{
          inventory_id: null,
          item_name: `[CABIN 일괄 반납] ${integratedItemName}`,
          type: finalLogType,
          quantity: selectedItems.length,
          worker_name: currentUser?.name || '작업자',
          memo: memoText,
          created_at: new Date().toISOString()
        }]);

      if (logError) throw logError;

      const returnHistoryRows = selectedItems.map((item: any) => ({
        inventory_id: item.id ?? null,
        item_code: item.no || item.code || `CBN-${item.id}`,
        item_name: item.name || item.item || 'CABIN 품목',
        quantity: 1,
        issued_by: cabinIssuedBy,
        returned_by: currentUser?.name || '작업자',
        issued_at: cabinIssuedAt,
        returned_at: cabinReturnedAt,
        memo: memoText,
        created_at: cabinReturnedAt
      }));

      const { error: returnHistoryError } = await supabase
        .from('inventory_return_history')
        .insert(returnHistoryRows);
      if (returnHistoryError) throw returnHistoryError;

      showCenterToast(`선택된 ${selectedItems.length}개 CABIN 품목이 일괄 반납되었습니다.`);
      setShowCabinBatchReturnModal(false);
      setSelectedCabinIds([]);
      setCabinBatchReturnMemo('');
      setCabinBatchReturnHasIssue(false);
      await fetchCabinInventory();
      await fetchInventoryLogs();
    } catch (err: any) {
      showCenterToast('CABIN 일괄 반납 처리 중 오류가 발생했습니다: ' + err.message);
    }
  };

  const fetchReturnHistories = async () => {
    setLoadingReturnHistories(true);
    try {
      const { data, error } = await supabase
        .from('inventory_return_history')
        .select('*')
        .order('returned_at', { ascending: false });
      if (error) throw error;
      setReturnHistories((data || []) as InventoryReturnHistory[]);
    } catch (err: any) {
      showCenterToast('반납 이력 조회 실패: ' + (err?.message || '알 수 없는 오류'));
    } finally {
      setLoadingReturnHistories(false);
    }
  };

  const handleOpenReturnHistory = async () => {
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
      showCenterToast('반납 이력이 삭제되었습니다.');
    } catch (err: any) {
      showCenterToast('반납 이력 삭제 실패: ' + (err?.message || '알 수 없는 오류'));
    }
  };

  const handleOpenReturnModal = (log: InventoryLog) => {
    if (log.item_name && log.item_name.includes('[CABIN 일괄 불출]')) {
      showCenterToast('CABIN 일괄 불출된 항목은 개별적으로 항목을 찾아 반납 처리해야 합니다. CABIN 탭에서 해당 항목을 확인 후 반납하세요.');
      return;
    }

    const foundItem = findInventoryItemForLog(log);
    if (foundItem && foundItem.type === '소모성') {
      showCenterToast('소모성 자재는 반납 프로세스가 존재하지 않습니다.');
      return;
    }

    setTargetReturnLog(log);
    setReturnQty(log.quantity || 1);
    setReturnHasIssue(false);
    setReturnMemo('');
    setShowReturnModal(true);
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

      let foundItem: any | null = null;
      
      if (targetReturnLog.inventory_id) {
        const { data: invData } = await supabase.from('inventory').select('*').eq('id', targetReturnLog.inventory_id).single();
        if (invData) {
          foundItem = invData;
        } else {
          const { data: cabinData } = await supabase.from('cabin_inventory').select('*').eq('id', targetReturnLog.inventory_id).single();
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

      if (foundItem.type !== 'CABIN') {
        const currentQty = Number(foundItem.quantity || 0);
        const initialQty = Number(foundItem.initial_quantity);
        if (!Number.isFinite(initialQty) || initialQty < 0) {
          showCenterToast('최초 보유수량이 등록되지 않은 자재입니다. 관리자에게 최초 보유수량을 확인해주세요.');
          return;
        }
        if (currentQty + qtyToReturn > initialQty) {
          showCenterToast(`반납 후 수량이 최초 보유수량(${initialQty} ${foundItem.unit || 'EA'})을 초과할 수 없습니다.`);
          return;
        }

        const { data: updatedRows, error: invErr } = await supabase
          .from('inventory')
          .update({ quantity: currentQty + qtyToReturn, updated_at: new Date().toISOString() })
          .eq('id', foundItem.id)
          .lte('quantity', initialQty - qtyToReturn)
          .select('id, quantity');
        if (invErr) throw invErr;
        if (!updatedRows || updatedRows.length === 0) {
          showCenterToast('반납 수량이 최초 보유수량을 초과했거나 이미 다른 반납 처리가 완료되었습니다.');
          return;
        }
      }

      const finalLogType = returnHasIssue ? '불출, 반납완료, 이상알림' : '반납완료';
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
          updated_at: new Date().toISOString() 
        })
        .eq('id', targetReturnLog.id)
        .not('type', 'ilike', '%반납완료%');
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
    if (!logId) return;
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
    if (selectedLogIds.length === inventoryLogs.length) {
      setSelectedLogIds([]);
    } else {
      setSelectedLogIds(inventoryLogs.map(l => String(l.id)));
    }
  };

  const toggleSelectLog = (id: string | number) => {
    const strId = String(id);
    setSelectedLogIds(prev => 
      prev.includes(strId) ? prev.filter(item => item !== strId) : [...prev, strId]
    );
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

    return result;
  }, [
    inventoryTab,
    inventoryList,
    cabinInventoryList,
    selectedConsumableCategory,
    selectedFixedSubCategory,
    selectedVbtSubCategory,
    selectedCabinSheet,
    selectedCabinTextSubTag,
    cabinCalibrationOnly,
    selectedItemSubCategory,
    currentItemSubCategoryEntries
  ]);

  const currentActiveSubCatName = getCurrentSelectedCategory();
  const currentItemSubCategoryKey = `${inventoryTab}:${currentActiveSubCatName}:${selectedCabinTextSubTag || ''}`;

  return (
    <div className="w-full max-w-full overflow-x-hidden text-[#1F2937] space-y-3 font-sans box-border relative">
      
      {toastMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-xs p-4">
          <div className="bg-[#243B5A] text-white px-5 py-3 rounded-xl shadow-2xl flex items-center space-x-2.5 text-xs sm:text-sm font-bold border border-slate-600 max-w-xs text-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <span className="truncate">{toastMessage}</span>
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

              <div className="bg-amber-50 p-2.5 rounded-md border border-amber-200 flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  id="cabinBatchReturnHasIssue"
                  checked={cabinBatchReturnHasIssue} 
                  onChange={e => setCabinBatchReturnHasIssue(e.target.checked)} 
                  className="w-4 h-4 accent-amber-600 rounded"
                />
                <label htmlFor="cabinBatchReturnHasIssue" className="text-amber-900 font-semibold cursor-pointer select-none">
                  선택 품목 중 장비 이상(결함) 있음 체크
                </label>
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

              <div className="bg-amber-50 p-2.5 rounded-md border border-amber-200 flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  id="returnHasIssue"
                  checked={returnHasIssue} 
                  onChange={e => setReturnHasIssue(e.target.checked)} 
                  className="w-4 h-4 accent-amber-600 rounded"
                />
                <label htmlFor="returnHasIssue" className="text-amber-900 font-semibold cursor-pointer select-none">
                  장비 이상(결함) 있음 체크 (체크 시 이상알림 표시)
                </label>
              </div>

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
                        onClick={async () => {
                          if (confirm(`'${sheet}' Sheet를 삭제하시겠습니까?`)) {
                            const updated = customCabinSheets.filter(s => s !== sheet);
                            try {
                              await persistSubCategories('CABIN', updated);
                              setCustomCabinSheets(updated);
                              if (selectedCabinSheet === sheet && updated.length > 0) setSelectedCabinSheet(updated[0]);
                            } catch (error: any) {
                              showCenterToast('CABIN 종류 삭제 실패: ' + (error?.message || '알 수 없는 오류'));
                            }
                          }
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
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
                      showCenterToast('서브 카테고리 저장 실패: ' + (error?.message || '알 수 없는 오류') + '\nSupabase의 inventory_subcategories 테이블과 권한 설정을 확인해주세요.');
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
                                await persistSubCategories(inventoryTab, list);
                              }
                              setCurrentSubCategories(list);
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
                        onClick={async () => {
                          if (!confirm(`'${cat}' 카테고리를 삭제하시겠습니까?`)) return;
                          const list = getCurrentSubCategories().filter(c => c !== cat);
                          try {
                            if (inventoryTab === '고정' || inventoryTab === '소모성') {
                              await persistSubCategories(inventoryTab, list);
                            }
                            setCurrentSubCategories(list);
                            if (getCurrentSelectedCategory() === cat && list.length > 0) setCurrentSelectedCategory(list[0]);
                            else if (getCurrentSelectedCategory() === cat) setCurrentSelectedCategory('');
                          } catch (error: any) {
                            showCenterToast('서브 카테고리 삭제 실패: ' + (error?.message || '알 수 없는 오류'));
                          }
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
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white shrink-0">
                    {daysLeft <= 0 ? 'D-DAY' : `D-${daysLeft}`}
                  </span>
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
          <div 
            className="flex items-center gap-1.5 overflow-x-auto flex-1 py-0.5 min-w-0"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#CBD5E1 transparent' }}
          >
            {(inventoryTab === '고정' || inventoryTab === '소모성') && (
              <button
                onClick={() => { setCurrentSelectedCategory('전체 보기'); setSelectedItemSubCategory('전체 보기'); }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition shrink-0 ${getCurrentSelectedCategory() === '전체 보기' ? 'bg-[#243B5A] text-white shadow-2xs' : 'bg-[#F5F6F8] text-[#64748B] hover:bg-[#E2E5E9]'}`}
              >
                전체 보기
              </button>
            )}
            {getCurrentSubCategories().map((cat) => {
              const isSelected = getCurrentSelectedCategory() === cat;
              const isCalib = cat === '교정';

              return (
                <button
                  key={cat}
                  onClick={() => {
                    setCurrentSelectedCategory(cat);
                    setSelectedItemSubCategory('전체 보기');
                    if (cat === 'VBT') setSelectedVbtSubCategory('1L');
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition shrink-0 ${
                    isSelected
                      ? 'bg-[#243B5A] text-white font-semibold shadow-2xs'
                      : isCalib
                      ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                      : 'bg-[#F5F6F8] text-[#64748B] hover:bg-[#E2E5E9] hover:text-[#1F2937]'
                  }`}
                >
                  {isCalib ? '🔬 교정 대상' : cat}
                </button>
              );
            })}
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
          <div
            className="flex items-center gap-1.5 overflow-x-auto flex-1 py-0.5 min-w-0"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#CBD5E1 transparent' }}
          >
            <button
              onClick={() => setSelectedItemSubCategory('전체 보기')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition shrink-0 ${selectedItemSubCategory === '전체 보기' ? 'bg-slate-700 text-white font-semibold shadow-2xs' : 'bg-[#F5F6F8] text-[#64748B] hover:bg-[#E2E5E9] hover:text-[#1F2937]'}`}
            >
              전체 보기
            </button>
            {currentItemSubCategoryOptions.map((name) => {
              const isSelected = selectedItemSubCategory === name;
              return (
                <button
                  key={name}
                  onClick={() => setSelectedItemSubCategory(name)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition shrink-0 ${
                    isSelected
                      ? 'bg-slate-700 text-white font-semibold shadow-2xs'
                      : 'bg-[#F5F6F8] text-[#64748B] hover:bg-[#E2E5E9] hover:text-[#1F2937]'
                  }`}
                  title={name}
                >
                  {name}
                </button>
              );
            })}
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
          <div
            className="flex items-center gap-1.5 overflow-x-auto flex-1 py-0.5 min-w-0"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#CBD5E1 transparent' }}
          >
            <button
              onClick={() => setSelectedItemSubCategory('전체 보기')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition shrink-0 ${selectedItemSubCategory === '전체 보기' ? 'bg-slate-700 text-white font-semibold shadow-2xs' : 'bg-[#F5F6F8] text-[#64748B] hover:bg-[#E2E5E9] hover:text-[#1F2937]'}`}
            >
              전체 보기
            </button>
            {currentItemSubCategoryOptions.map((name) => {
              const isSelected = selectedItemSubCategory === name;
              return (
                <button
                  key={name}
                  onClick={() => setSelectedItemSubCategory(name)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition shrink-0 ${
                    isSelected
                      ? 'bg-slate-700 text-white font-semibold shadow-2xs'
                      : 'bg-[#F5F6F8] text-[#64748B] hover:bg-[#E2E5E9] hover:text-[#1F2937]'
                  }`}
                  title={name}
                >
                  {name}
                </button>
              );
            })}
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
              : `서브탭 [${currentActiveSubCatName}]${selectedItemSubCategory ? ` > ${selectedItemSubCategory}` : ''} 목록`}
          </span>
          <span className="text-[10px] bg-[#F5F6F8] border border-[#E2E5E9] px-2 py-0.5 rounded-full text-[#64748B] shrink-0 font-normal">
            총 {filteredInventory.length}건
          </span>
        </div>

        {inventoryTab === 'CABIN' && (
          <div className="flex items-center space-x-1 shrink-0">
            {selectedCabinIds.length > 0 && (
              <>
                <button
                  onClick={() => setShowCabinBatchModal(true)}
                  className="px-2.5 py-1 bg-[#243B5A] hover:bg-[#1d3049] text-white rounded text-xs font-semibold shadow-2xs transition flex items-center gap-1"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  <span>일괄 불출 ({selectedCabinIds.length})</span>
                </button>
                <button
                  onClick={() => setShowCabinBatchReturnModal(true)}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-2xs transition flex items-center gap-1"
                >
                  <ArrowDownRight className="h-3.5 w-3.5" />
                  <span>일괄 반납 ({selectedCabinIds.length})</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 전체 목록 표시 (페이징 완전 제거) */}
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
        {filteredInventory.map((item) => {
          const isCabin = inventoryTab === 'CABIN';
          const isSelected = selectedCabinIds.includes(String(item.id));

          return (
            <div 
              key={item.id} 
              className={`bg-white rounded-lg border p-3 shadow-2xs hover:border-[#243B5A] transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 ${
                isSelected ? 'border-blue-500 bg-blue-50/20' : 'border-[#E2E5E9]'
              }`}
            >
              <div className="flex items-start space-x-2.5 min-w-0 flex-1">
                {isCabin && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelectCabinItem(item.id)}
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
                  </div>
                )}

                <div className="flex items-center space-x-1.5">
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
            <h2 className="text-xs font-bold text-[#1F2937]">최근 불출 / 반납 이력 (23시 자동 초기화)</h2>
            <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-semibold">
              {inventoryLogs.length}건
            </span>
            <button
              type="button"
              onClick={handleOpenReturnHistory}
              className="px-2 py-1 bg-white border border-[#E2E5E9] hover:bg-gray-50 text-[#243B5A] rounded text-[10px] font-semibold transition"
            >
              반납 이력
            </button>
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
            <div className="flex items-center justify-between pb-2 border-b border-[#E2E5E9] text-[11px] font-semibold text-[#64748B]">
              {isAdmin && (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={inventoryLogs.length > 0 && selectedLogIds.length === inventoryLogs.length}
                    onChange={toggleSelectAllLogs}
                    className="h-3.5 w-3.5 rounded accent-[#243B5A] cursor-pointer"
                  />
                  <span>전체 선택</span>
                </div>
              )}
              <span className="text-[10px]">※ 매일 23시: 반납완료 및 소모성 자재 불출이 자동 초기화됩니다.</span>
            </div>

            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {inventoryLogs.map((log) => {
                const isSelected = selectedLogIds.includes(String(log.id));
                const isReturnCompleted = log.type.includes('반납완료');
                const isIssueAlert = log.type.includes('이상알림');
                const isConsumableUsage = log.type.includes('소모성 사용');
                const matchedHistoryItem = findInventoryItemForLog(log);
                const historyItemCode = log.item_code || matchedHistoryItem?.code || (matchedHistoryItem?.type === 'CABIN' ? matchedHistoryItem?.no : undefined);
                const issuedBy = log.issued_by || (!isReturnCompleted ? log.worker_name : undefined);
                const returnedBy = log.returned_by;
                const samePerson = Boolean(issuedBy && returnedBy && issuedBy === returnedBy);

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
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            isReturnCompleted ? 'bg-emerald-100 text-emerald-800' : isConsumableUsage ? 'bg-slate-100 text-slate-700' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {log.type}
                          </span>
                          <span className="font-bold text-[#1F2937] truncate">{log.item_name}</span>
                          {historyItemCode && (
                            <span className="text-[10px] font-mono bg-white border border-[#E2E5E9] text-[#475569] px-1.5 py-0.2 rounded">자재코드: {historyItemCode}</span>
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
                            samePerson || (!returnedBy && issuedBy) ? (
                              <span>불출/반납: <strong className="text-[#1F2937]">{issuedBy || returnedBy}</strong></span>
                            ) : (
                              <>
                                <span>불출: <strong className="text-[#1F2937]">{issuedBy || '-'}</strong></span>
                                <span>|</span>
                                <span>반납: <strong className="text-[#1F2937]">{returnedBy || '-'}</strong></span>
                              </>
                            )
                          ) : (
                            <span>{isConsumableUsage ? '사용: ' : '불출: '}<strong className="text-[#1F2937]">{log.issued_by || log.worker_name}</strong></span>
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
                      {isConsumableUsage ? (
                        <button
                          type="button"
                          disabled
                          className="px-2 py-1 bg-gray-100 text-gray-400 border border-gray-200 rounded text-[10px] font-semibold cursor-not-allowed"
                        >
                          소모성 사용 완료
                        </button>
                      ) : !isReturnCompleted && !log.item_name?.includes('[CABIN') ? (
                        <button
                          onClick={() => handleOpenReturnModal(log)}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-semibold transition"
                        >
                          반납처리
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

              {inventoryLogs.length === 0 && (
                <div className="text-center py-6 text-[#64748B] text-xs">
                  최근 기록된 불출 및 반납 이력이 존재하지 않습니다.
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

      {isReturnHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#E2E5E9] max-w-5xl w-full p-5 shadow-2xl space-y-4 text-[#1F2937] max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center pb-2 border-b border-[#E2E5E9]">
              <div className="flex items-center space-x-2">
                <History className="h-4 w-4 text-[#243B5A]" />
                <h3 className="text-sm font-bold">반납 이력</h3>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-semibold">{returnHistories.length}건</span>
              </div>
              <button type="button" onClick={() => setIsReturnHistoryOpen(false)} className="text-[#64748B] hover:text-[#1F2937] p-1"><X className="h-4 w-4" /></button>
            </div>
            <div className="overflow-y-auto max-h-[70vh] space-y-1.5">
              {loadingReturnHistories ? (
                <div className="text-center py-8 text-[#64748B] text-xs">반납 이력을 불러오는 중입니다.</div>
              ) : returnHistories.length === 0 ? (
                <div className="text-center py-8 text-[#64748B] text-xs">등록된 반납 이력이 없습니다.</div>
              ) : (
                returnHistories.map((history) => (
                  <div key={history.id} className="p-2.5 rounded-lg border bg-[#F5F6F8]/50 border-[#E2E5E9] text-xs flex flex-col lg:flex-row justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center flex-wrap gap-1.5">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">반납완료</span>
                        <span className="font-bold text-[#1F2937] truncate">{history.item_name || '-'}</span>
                        <span className="text-[10px] font-mono bg-white border border-[#E2E5E9] text-[#475569] px-1.5 py-0.2 rounded">자재코드: {history.item_code || '-'}</span>
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
                    {isAdmin && (
                      <button type="button" onClick={() => handleDeleteReturnHistory(history.id)} className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition self-end lg:self-center" title="반납 이력 삭제">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
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
                    <input 
                      type="date" 
                      value={cabinCalibrationDate} 
                      onChange={e => setCabinCalibrationDate(e.target.value)} 
                      className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]" 
                    />
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
                    <label className="block text-[#64748B] font-semibold mb-1">자재 코드</label>
                    <input 
                      type="text" 
                      required 
                      value={itemCode} 
                      onChange={e => setItemCode(e.target.value)} 
                      className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]" 
                    />
                  </div>
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
                    <label className="block text-[#64748B] font-semibold mb-1">서브 카테고리</label>
                    <select
                      value={itemCategory}
                      onChange={e => setItemCategory(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]"
                    >
                      {getCurrentSubCategories().map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  {itemType === '고정' && itemCategory === 'VBT' && (
                    <div>
                      <label className="block text-[#64748B] font-semibold mb-1">VBT 타입</label>
                      <input 
                        type="text" 
                        placeholder="예: 1L, 2S 등" 
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
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[#64748B] font-semibold mb-1">교정일자</label>
                        <input 
                          type="date" 
                          value={itemCalDate} 
                          onChange={e => setItemCalDate(e.target.value)} 
                          className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]" 
                        />
                      </div>
                      <div>
                        <label className="block text-[#64748B] font-semibold mb-1">차기 교정예정일</label>
                        <input 
                          type="date" 
                          value={itemNextCalDate} 
                          onChange={e => setItemNextCalDate(e.target.value)} 
                          className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]" 
                        />
                      </div>
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
                  max={logType === '반납' ? undefined : targetItem.quantity}
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

    </div>
  );
}
