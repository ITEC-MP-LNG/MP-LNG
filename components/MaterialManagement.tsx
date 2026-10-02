'use client';

import { useState, useEffect, useMemo } from 'react';
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
  item_name?: string;
  type: string;
  quantity: number;
  worker_name?: string;
  memo?: string;
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

  // --- 매일 23시 소모성 자재 불출이력 자동 삭제 스케줄러 ---
  useEffect(() => {
    const processDailyCleanup = async () => {
      try {
        const { data: logs, error: logsError } = await supabase
          .from('inventory_logs')
          .select('*');
        if (logsError || !logs || logs.length === 0) return;

        const { data: items } = await supabase
          .from('inventory')
          .select('id, name, type');

        const deleteIds: (string | number)[] = [];

        logs.forEach((log: any) => {
          const matchedItem = items?.find(
            i => i.id === log.inventory_id || i.name === log.item_name
          );

          const isConsumable = matchedItem?.type === '소모성' || (log.type && log.type.includes('소모성'));
          const hasIssue = log.type && log.type.includes('이상알림');
          const isReturned = log.type && log.type.includes('반납완료');

          if (isConsumable) {
            deleteIds.push(log.id);
            return;
          }

          if (!hasIssue && isReturned) {
            deleteIds.push(log.id);
            return;
          }
        });

        if (deleteIds.length > 0) {
          const { error: delError } = await supabase
            .from('inventory_logs')
            .delete()
            .in('id', deleteIds);

          if (!delError) {
            await fetchInventoryLogs();
            showCenterToast('23시 정기 자재 이력이 정돈되었습니다.');
          }
        }
      } catch (err) {
        console.error('23시 자동 삭제 오류:', err);
      }
    };

    const checkAndRunCleanup = () => {
      const now = new Date();
      if (now.getHours() === 23 && now.getMinutes() === 0) {
        processDailyCleanup();
      }
    };

    // 마운트 시 최초 점검 및 매 분마다 23시 체크
    checkAndRunCleanup();
    const timer = setInterval(checkAndRunCleanup, 60000);
    return () => clearInterval(timer);
  }, [fetchInventoryLogs]);

  // 반납 모달 상태
  const [showReturnModal, setShowReturnModal] = useState<boolean>(false);
  const [targetReturnLog, setTargetReturnLog] = useState<InventoryLog | null>(null);
  const [returnQty, setReturnQty] = useState<number>(1);
  const [returnHasIssue, setReturnHasIssue] = useState<boolean>(false);
  const [returnMemo, setReturnMemo] = useState<string>('');

  // 이력 수정 모달 상태
  const [showEditLogModal, setShowEditLogModal] = useState<boolean>(false);
  const [targetEditLog, setTargetEditLog] = useState<InventoryLog | null>(null);
  const [editLogQty, setEditLogQty] = useState<number>(1);
  const [editLogMemo, setEditLogMemo] = useState<string>('');

  const [pendingDeleteLogId, setPendingDeleteLogId] = useState<string | number | null>(null);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState<boolean>(false);

  // CABIN 전용 상태
  const [selectedCabinIds, setSelectedCabinIds] = useState<string[]>([]);
  const [cabinCalibrationOnly, setCabinCalibrationOnly] = useState<boolean>(false);
  const [showCabinBatchModal, setShowCabinBatchModal] = useState<boolean>(false);
  const [cabinBatchMemo, setCabinBatchMemo] = useState<string>('');
  
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

  // 자재 종류별 2차 서브탭 상태
  const [itemSubCategoryRows, setItemSubCategoryRows] = useState<any[]>([]);
  const [selectedItemSubCategory, setSelectedItemSubCategory] = useState<string>('전체 보기');

  const [isItemSubCatModalOpen, setIsItemSubCatModalOpen] = useState<boolean>(false);
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
      names = inventoryList.filter(item => item.type === '소모성' && (selectedConsumableCategory === '전체 보기' || item.category === selectedConsumableCategory))
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
    const map = new Map<string, { name:string; materialNames:string[]; id:any }>();
    rows.forEach(row => {
      const name = String(row.name || '').trim();
      if (!name) return;
      if (!map.has(name)) map.set(name, { name, materialNames: [], id: row.id });
      const materialName = String(row.material_name || '').trim();
      if (materialName && currentMaterialNames.includes(materialName)) {
        const entry = map.get(name)!;
        if (!entry.materialNames.includes(materialName)) entry.materialNames.push(materialName);
      }
    });
    return Array.from(map.values()).sort((a,b)=>a.name.localeCompare(b.name,'ko'));
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

  const handleAddItemSubCategory = async () => {
    if (!isAdmin) return showCenterToast('관리자만 자재 종류를 추가할 수 있습니다.');
    const name = newItemSubCatName.trim();
    if (!name) return showCenterToast('자재 종류 이름을 입력해주세요.');
    if (name === '전체 보기') return showCenterToast('전체 보기는 기본 항목이라 추가할 수 없습니다.');
    const { type, parentCategory } = getCurrentItemSubCategoryContext();
    if (currentItemSubCategoryOptions.includes(name)) return showCenterToast('이미 존재하는 자재 종류입니다.');
    try {
      const rows = newItemSubCatMaterialNames.length > 0
        ? newItemSubCatMaterialNames.map((materialName, index) => ({ inventory_type:type, parent_category:parentCategory, name, material_name:materialName, sort_order:index, is_active:true }))
        : [{ inventory_type:type, parent_category:parentCategory, name, material_name:'', sort_order:0, is_active:true }];
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
      await supabase.from('inventory_item_subcategories').delete().eq('inventory_type',type).eq('parent_category',parentCategory).eq('name',target.name);
      const rows = editingItemSubCatMaterialNames.length > 0
        ? editingItemSubCatMaterialNames.map((materialName,index)=>({ inventory_type:type,parent_category:parentCategory,name:newName,material_name:materialName,sort_order:index,is_active:true }))
        : [{ inventory_type:type,parent_category:parentCategory,name:newName,material_name:'',sort_order:0,is_active:true }];
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
      showCenterToast('CABIN 서브탭 순서 저장 실패: ' + (error?.message || '알 수 없는 오류'));
    }
  };

  const getCurrentSelectedCategory = () => {
    if (inventoryTab === '고정') return selectedFixedSubCategory;
    if (inventoryTab === '소모성') return selectedConsumableCategory;
    return selectedCabinSheet;
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
        newQty = currentQty + qtyChange;
      }

      const { error: invError } = await supabase
        .from('inventory')
        .update({ quantity: newQty, updated_at: new Date().toISOString() })
        .eq('id', targetItem.id);

      if (invError) throw invError;

      let finalLogType = logType === '소모성 사용' ? '불출' : logType;
      if (logType === '반납') {
        finalLogType = logHasIssue ? '불출, 반납완료, 이상알림' : '반납완료';
      }

      const { error: logError } = await supabase
        .from('inventory_logs')
        .insert([{
          inventory_id: targetItem.id,
          item_name: targetItem.name,
          type: finalLogType,
          quantity: qtyChange,
          worker_name: currentUser?.name || '작업자',
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

  const handleOpenReturnModal = (log: InventoryLog) => {
    if (log.item_name && log.item_name.includes('[CABIN 일괄 불출]')) {
      showCenterToast('CABIN 일괄 불출 항목은 CABIN 탭에서 확인 후 반납하세요.');
      return;
    }

    const foundItem = inventoryList.find(i => i.id === log.inventory_id || i.name === log.item_name);
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
    if (!targetReturnLog) return;

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

      if (!foundItem && targetReturnLog.item_name) {
        const { data: invDataByName } = await supabase.from('inventory').select('*').eq('name', targetReturnLog.item_name).limit(1);
        if (invDataByName && invDataByName.length > 0) {
          foundItem = invDataByName[0];
        } else {
          const { data: cabinDataByName } = await supabase.from('cabin_inventory').select('*').eq('item', targetReturnLog.item_name).limit(1);
          if (cabinDataByName && cabinDataByName.length > 0) {
            foundItem = { ...cabinDataByName[0], type: 'CABIN', quantity: 1, unit: 'EA' };
          }
        }
      }

      if (!foundItem) {
        return showCenterToast(`'${targetReturnLog.item_name}' 자재 정보를 찾을 수 없습니다.`);
      }

      if (foundItem.type === '소모성') {
        return showCenterToast('소모성 자재는 반납 처리를 할 수 없습니다.');
      }

      if (foundItem.type !== 'CABIN') {
        const newQty = foundItem.quantity + qtyToReturn;
        const { error: invErr } = await supabase
          .from('inventory')
          .update({ quantity: newQty, updated_at: new Date().toISOString() })
          .eq('id', foundItem.id);
        if (invErr) throw invErr;
      }

      const finalLogType = returnHasIssue ? '불출, 반납완료, 이상알림' : '반납완료';
      const memoText = returnMemo.trim() ? `반납메모: ${returnMemo.trim()}` : targetReturnLog.memo;

      const { error: logErr } = await supabase
        .from('inventory_logs')
        .update({ 
          type: finalLogType, 
          quantity: qtyToReturn, 
          memo: memoText,
          updated_at: new Date().toISOString() 
        })
        .eq('id', targetReturnLog.id);
      if (logErr) throw logErr;

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
                <button type="submit" className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition">반납 확정</button>
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
              <h3 className="text-sm font-bold">CABIN Sheet 추가 / 수정 / 삭제</h3>
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

      {/* 자재 종류(하위 카테고리) 추가/수정/삭제 모달 */}
      {isItemSubCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#E2E5E9] max-w-lg w-full p-5 shadow-2xl space-y-4 text-[#1F2937] max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold">[{inventoryTab}] 자재 종류 추가 / 수정 / 삭제</h3>
              <button onClick={() => { setIsItemSubCatModalOpen(false); setEditingItemSubCatId(null); }}><X className="h-4 w-4" /></button>
            </div>
            <p className="text-[11px] text-[#64748B]">실제 자재명은 변경하지 않고, 선택한 자재들을 하나의 종류로 묶어 정렬 및 보기 필터를 적용합니다.</p>

            <div className="border border-[#E2E5E9] rounded-lg p-3 space-y-2 bg-[#F8FAFC]">
              <div className="flex gap-1">
                <input type="text" placeholder="예: 몽키 스패너" value={newItemSubCatName} onChange={e=>setNewItemSubCatName(e.target.value)} className="flex-1 px-2.5 py-1.5 border border-[#E2E5E9] rounded text-xs bg-white" />
                <button type="button" onClick={handleAddItemSubCategory} className="px-3 py-1.5 bg-[#243B5A] text-white rounded text-xs font-semibold">추가</button>
              </div>
              <div className="text-[10px] text-[#64748B]">연결할 실제 자재명 선택 (선택하지 않으면 종류만 먼저 생성됩니다)</div>
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

      {/* 헤더 */}
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

      {/* 교정 예정 배너 */}
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

      {/* 메인 탭 */}
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

      {/* 1차 서브 카테고리 BAR */}
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
                title="Sheet 추가/수정/관리"
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

      {/* VBT 세부 탭 */}
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

      {/* 2차 아이템명/하위 카테고리 서브탭 */}
      {!(inventoryTab === '고정' && selectedFixedSubCategory === 'VBT') && (
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
              title="자재명 카테고리 추가/수정/삭제"
            >
              <Settings className="h-4 w-4 shrink-0" />
            </button>
          )}
        </div>
      )}

      {/* 목록 헤더 및 개수 표시 */}
      <div className="bg-white rounded-lg border border-[#E2E5E9] p-3 flex items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center space-x-2 text-xs font-bold text-[#1F2937] min-w-0 truncate">
          <Package className="h-4 w-4 text-[#243B5A] shrink-0" />
          <span className="truncate">
            {inventoryTab === 'CABIN'
              ? `종류 [${selectedCabinSheet || '전체'}]${selectedItemSubCategory !== '전체 보기' ? ` > ${selectedItemSubCategory}` : ''} 목록`
              : `서브탭 [${currentActiveSubCatName}]${selectedItemSubCategory !== '전체 보기' ? ` > ${selectedItemSubCategory}` : ''} 목록`}
          </span>
          <span className="text-[10px] bg-[#F5F6F8] border border-[#E2E5E9] text-[#243B5A] px-2 py-0.5 rounded-full font-mono font-bold shrink-0">
            총 {filteredInventory.length}건
          </span>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {inventoryTab === 'CABIN' && selectedCabinIds.length > 0 && (
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setShowCabinBatchModal(true)}
                className="bg-[#243B5A] hover:bg-[#1d3049] text-white px-2.5 py-1 rounded text-xs font-semibold transition"
              >
                일괄 불출 ({selectedCabinIds.length})
              </button>
              <button
                onClick={() => setShowCabinBatchReturnModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded text-xs font-semibold transition"
              >
                일괄 반납 ({selectedCabinIds.length})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 자재 목록 테이블 / 카드 렌더링 (페이지 넘기기 없이 전체 출력) */}
      <div className="bg-white rounded-lg border border-[#E2E5E9] shadow-2xs overflow-hidden">
        {filteredInventory.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#94A3B8]">등록된 자재가 없습니다.</div>
        ) : (
          <div className="divide-y divide-[#E2E5E9]">
            {filteredInventory.map((item) => (
              <div 
                key={item.id} 
                className="p-3 hover:bg-slate-50 transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2"
              >
                <div className="flex items-start space-x-2 min-w-0 flex-1">
                  {inventoryTab === 'CABIN' && (
                    <input 
                      type="checkbox" 
                      checked={selectedCabinIds.includes(String(item.id))}
                      onChange={() => toggleSelectCabinItem(item.id)}
                      className="mt-1 w-4 h-4 accent-[#243B5A] rounded"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-[10px] font-mono font-bold bg-[#F5F6F8] border border-[#E2E5E9] text-[#243B5A] px-1.5 py-0.5 rounded">
                        {item.code || item.no || 'NO-CODE'}
                      </span>
                      <h4 className="text-xs font-bold text-[#1F2937] truncate">{item.name || item.item}</h4>
                    </div>
                    <div className="text-[11px] text-[#64748B] flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>위치: {item.location || item.location_or_section || '-'}</span>
                      {item.serial_number && <span>S/N: {item.serial_number}</span>}
                      {inventoryTab !== 'CABIN' && (
                        <span className="font-semibold text-[#243B5A]">
                          수량: {item.quantity} {item.unit}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 w-full sm:w-auto justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-[#E2E5E9]">
                  {inventoryTab !== 'CABIN' ? (
                    <>
                      <button
                        onClick={() => handleOpenLogModal(item, item.type === '소모성' ? '소모성 사용' : '불출')}
                        className="px-2.5 py-1 bg-[#243B5A] hover:bg-[#1d3049] text-white text-[11px] font-semibold rounded transition"
                      >
                        {item.type === '소모성' ? '사용' : '불출'}
                      </button>
                      {item.type !== '소모성' && (
                        <button
                          onClick={() => handleOpenLogModal(item, '반납')}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold rounded transition"
                        >
                          반납
                        </button>
                      )}
                    </>
                  ) : null}
                  {isAdmin && (
                    <button
                      onClick={() => handleOpenInventoryEdit(item)}
                      className="p-1 text-[#64748B] hover:text-[#1F2937] transition"
                      title="수정"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
