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
  AlertTriangle,
  RotateCcw,
  Search,
  Filter,
  Check,
  Calendar,
  FileText
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

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

  // --- 매일 23시 이력 자동 정리/삭제 스케줄러 ---
  useEffect(() => {
    const processDailyCleanup = async () => {
      if (!inventoryLogs || inventoryLogs.length === 0) return;

      const deleteIds: (string | number)[] = [];

      inventoryLogs.forEach((log) => {
        const matchedItem = inventoryList.find(
          i => i.id === log.inventory_id || i.name === log.item_name
        );

        const isConsumable = matchedItem?.type === '소모성' || log.type.includes('소모성');
        const hasIssue = log.type.includes('이상알림');
        const isReturned = log.type.includes('반납완료');

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
        try {
          const { error } = await supabase
            .from('inventory_logs')
            .delete()
            .in('id', deleteIds);

          if (!error) {
            await fetchInventoryLogs();
          }
        } catch (err) {
          console.error('23시 자동 삭제 오류:', err);
        }
      }
    };

    const checkAndRunCleanup = () => {
      const now = new Date();
      if (now.getHours() === 23 && now.getMinutes() === 0) {
        processDailyCleanup();
      }
    };

    const timer = setInterval(checkAndRunCleanup, 60000);
    return () => clearInterval(timer);
  }, [inventoryLogs, inventoryList, fetchInventoryLogs]);

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
  const [newSheetInput, setNewSheetInput] = useState<string>('');
  const [editingSheetIndex, setEditingSheetIndex] = useState<number | null>(null);
  const [editSheetInputValue, setEditSheetInputValue] = useState<string>('');

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
    setItemSubPage(1);
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
  const [itemSubPage, setItemSubPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 10;
  
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
    setItemSubPage(1);
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
    if (!isAdmin) return alert('관리자만 자재 종류를 추가할 수 있습니다.');
    const name = newItemSubCatName.trim();
    if (!name) return alert('자재 종류 이름을 입력해주세요.');
    if (name === '전체 보기') return alert('전체 보기는 기본 항목이라 추가할 수 없습니다.');
    const { type, parentCategory } = getCurrentItemSubCategoryContext();
    if (currentItemSubCategoryOptions.includes(name)) return alert('이미 존재하는 자재 종류입니다.');
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
      alert('자재 종류 추가 실패: ' + (error?.message || '알 수 없는 오류'));
    }
  };

  const handleSaveItemSubCategoryEdit = async () => {
    if (!isAdmin || editingItemSubCatId === null) return;
    const newName = editingItemSubCatName.trim();
    if (!newName) return alert('자재 종류 이름을 입력해주세요.');
    if (newName === '전체 보기') return alert('전체 보기는 수정할 수 없습니다.');
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
      alert('자재 종류 수정 실패: ' + (error?.message || '알 수 없는 오류'));
    }
  };

  const handleDeleteItemSubCategory = async (name: string) => {
    if (!isAdmin) return alert('관리자만 자재 종류를 삭제할 수 있습니다.');
    if (name === '전체 보기') return alert('전체 보기는 삭제할 수 없습니다.');
    if (!confirm(`'${name}' 자재 종류를 삭제하시겠습니까?\n\n※ 실제 자재 데이터는 삭제되지 않습니다.`)) return;
    const { type, parentCategory } = getCurrentItemSubCategoryContext();
    try {
      const { error } = await supabase.from('inventory_item_subcategories').delete().eq('inventory_type',type).eq('parent_category',parentCategory).eq('name',name);
      if (error) throw error;
      await refreshItemSubCategoryRows();
      setSelectedItemSubCategory('전체 보기');
      showCenterToast('자재 종류가 삭제되었습니다.');
    } catch (error:any) {
      alert('자재 종류 삭제 실패: ' + (error?.message || '알 수 없는 오류'));
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
      alert('서브 카테고리 순서 저장 실패: ' + (error?.message || '알 수 없는 오류'));
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
      alert('CABIN 서브탭 순서 저장 실패: ' + (error?.message || '알 수 없는 오류'));
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
    if (!isAdmin) return alert('관리자만 자재를 등록할 수 있습니다.');
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
    if (!isAdmin) return alert('관리자만 자재 정보를 수정할 수 있습니다.');
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

  const handleSaveInventory = async () => {
    if (!isAdmin) return alert('관리자 권한이 필요합니다.');

    if (itemType === 'CABIN') {
      if (!itemName) return alert('품목명을 입력해 주세요.');

      const payload = {
        sheet_name: cabinSheetName,
        no: itemCode,
        item: itemName,
        location_or_section: cabinLocationSection,
        maker_model: cabinMakerModel,
        serial_number: cabinSerialNo,
        cert_no: cabinCertNo,
        calibration_date: cabinCalibrationDate || null
      };

      try {
        if (editingItem) {
          const { error } = await supabase
            .from('cabin_inventory')
            .update(payload)
            .eq('id', editingItem.id);
          if (error) throw error;
          showCenterToast('CABIN 자재 정보가 수정되었습니다.');
        } else {
          const { error } = await supabase
            .from('cabin_inventory')
            .insert([payload]);
          if (error) throw error;
          showCenterToast('신규 CABIN 자재가 등록되었습니다.');
        }
        setShowInventorySheet(false);
        fetchCabinInventory();
      } catch (err: any) {
        alert('저장 실패: ' + err.message);
      }
    } else {
      if (!itemName) return alert('자재명을 입력해 주세요.');

      let combinedSubEquip = '';
      if (itemCalDate || itemNextCalDate) {
        combinedSubEquip = `${itemCalDate} | ${itemNextCalDate}`;
      }

      const payload = {
        type: itemType,
        code: itemCode,
        name: itemName,
        serial_number: itemSerialNo,
        category: itemCategory,
        vbt_type: itemCategory === 'VBT' ? itemVbtType : null,
        sub_equipment: combinedSubEquip,
        quantity: itemQuantity,
        unit: itemUnit,
        min_quantity: itemMinQty,
        location: itemLocation
      };

      try {
        if (editingItem) {
          const { error } = await supabase
            .from('inventory')
            .update(payload)
            .eq('id', editingItem.id);
          if (error) throw error;
          showCenterToast('자재 정보가 수정되었습니다.');
        } else {
          const { error } = await supabase
            .from('inventory')
            .insert([payload]);
          if (error) throw error;
          showCenterToast('신규 자재가 등록되었습니다.');
        }
        setShowInventorySheet(false);
        fetchInventory();
      } catch (err: any) {
        alert('저장 실패: ' + err.message);
      }
    }
  };

  const handleDeleteInventory = async (id: string | number) => {
    if (!isAdmin) return alert('관리자만 삭제할 수 있습니다.');
    if (!confirm('정말 이 자재 항목을 삭제하시겠습니까?')) return;

    try {
      const targetTable = inventoryTab === 'CABIN' ? 'cabin_inventory' : 'inventory';
      const { error } = await supabase
        .from(targetTable)
        .delete()
        .eq('id', id);

      if (error) throw error;

      showCenterToast('자재가 삭제되었습니다.');
      setSelectedDetailItem(null);
      if (inventoryTab === 'CABIN') {
        fetchCabinInventory();
      } else {
        fetchInventory();
      }
    } catch (err: any) {
      alert('삭제 실패: ' + err.message);
    }
  };

  // 불출/반납/수량조정 로직
  const handleOpenLogModal = (item: any, defaultType: string = '불출') => {
    setTargetItem(item);
    setLogType(defaultType);
    setLogQty(1);
    setLogHasIssue(false);
    setLogMemo('');
    setShowLogSheet(true);
  };

  const handleSubmitLog = async () => {
    if (!targetItem) return;
    if (logQty <= 0) return alert('수량은 1 이상이어야 합니다.');

    const isCabin = inventoryTab === 'CABIN' || targetItem.type === 'CABIN';

    try {
      let finalLogType = logType;
      if (logHasIssue && logType === '반납') {
        finalLogType = '반납(이상알림)';
      }

      let newQty = targetItem.quantity;
      if (logType === '불출') {
        if (!isCabin && targetItem.quantity < logQty) {
          return alert('재고 수량보다 크게 불출할 수 없습니다.');
        }
        newQty = isCabin ? 0 : targetItem.quantity - logQty;
      } else if (logType === '반납' || logType === '입고') {
        newQty = isCabin ? 1 : targetItem.quantity + logQty;
      }

      // 재고 수량 업데이트 (소모성 및 고정 자재)
      if (!isCabin) {
        const { error: updateErr } = await supabase
          .from('inventory')
          .update({ quantity: newQty })
          .eq('id', targetItem.id);
        if (updateErr) throw updateErr;
      }

      // 로그 추가
      const { error: logErr } = await supabase
        .from('inventory_logs')
        .insert([{
          inventory_id: targetItem.id,
          item_name: isCabin ? targetItem.item : targetItem.name,
          type: `${inventoryTab === 'CABIN' ? 'CABIN' : targetItem.type}_${finalLogType}`,
          quantity: logQty,
          worker_name: currentUser.name || '작업자',
          memo: logMemo
        }]);

      if (logErr) throw logErr;

      showCenterToast(`${finalLogType} 처리가 완료되었습니다.`);
      setShowLogSheet(false);

      if (isCabin) {
        fetchCabinInventory();
      } else {
        fetchInventory();
      }
      fetchInventoryLogs();
    } catch (err: any) {
      alert('처리 중 오류가 발생했습니다: ' + err.message);
    }
  };

  // 반납 처리
  const handleOpenReturnModal = (log: InventoryLog) => {
    setTargetReturnLog(log);
    setReturnQty(log.quantity);
    setReturnHasIssue(false);
    setReturnMemo('');
    setShowReturnModal(true);
  };

  const handleSubmitReturn = async () => {
    if (!targetReturnLog) return;
    if (returnQty <= 0) return alert('수량은 1 이상이어야 합니다.');

    try {
      const isCabinLog = targetReturnLog.type.includes('CABIN');
      const matchedItem = (isCabinLog ? cabinInventoryList : inventoryList).find(
        i => i.id === targetReturnLog.inventory_id || (isCabinLog ? i.item : i.name) === targetReturnLog.item_name
      );

      const statusType = returnHasIssue ? '반납완료(이상알림)' : '반납완료';

      // 1. 기존 불출 이력의 상태를 반납완료로 업데이트
      const { error: updateLogErr } = await supabase
        .from('inventory_logs')
        .update({
          type: `${isCabinLog ? 'CABIN' : (matchedItem?.type || '고정')}_${statusType}`,
          memo: returnMemo ? `${targetReturnLog.memo || ''} [반납메모: ${returnMemo}]` : targetReturnLog.memo
        })
        .eq('id', targetReturnLog.id);

      if (updateLogErr) throw updateLogErr;

      // 2. 자재 수량원복
      if (matchedItem && !isCabinLog) {
        await supabase
          .from('inventory')
          .update({ quantity: matchedItem.quantity + returnQty })
          .eq('id', matchedItem.id);
      }

      showCenterToast('반납 처리가 완료되었습니다.');
      setShowReturnModal(false);
      fetchInventory();
      fetchCabinInventory();
      fetchInventoryLogs();
    } catch (err: any) {
      alert('반납 처리 오류: ' + err.message);
    }
  };

  // 이력 삭제
  const handleDeleteLog = async (logId: string | number) => {
    if (!isAdmin) return alert('관리자만 이력을 삭제할 수 있습니다.');
    try {
      const { error } = await supabase
        .from('inventory_logs')
        .delete()
        .eq('id', logId);

      if (error) throw error;
      showCenterToast('이력이 삭제되었습니다.');
      fetchInventoryLogs();
    } catch (err: any) {
      alert('삭제 실패: ' + err.message);
    }
  };

  // 선택된 이력 일괄 삭제
  const handleBatchDeleteLogs = async () => {
    if (!isAdmin) return alert('관리자만 이력을 삭제할 수 있습니다.');
    if (selectedLogIds.length === 0) return;

    try {
      const { error } = await supabase
        .from('inventory_logs')
        .delete()
        .in('id', selectedLogIds);

      if (error) throw error;

      showCenterToast(`${selectedLogIds.length}건의 이력이 삭제되었습니다.`);
      setSelectedLogIds([]);
      setShowBatchDeleteConfirm(false);
      fetchInventoryLogs();
    } catch (err: any) {
      alert('일괄 삭제 실패: ' + err.message);
    }
  };

  // 필터링된 자재 목록
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

  // 페이지네이션 계산 (10개 단위)
  const totalItemPages = Math.max(1, Math.ceil(filteredInventory.length / ITEMS_PER_PAGE));
  const safeItemPage = Math.min(Math.max(1, itemSubPage), totalItemPages);

  const paginatedInventory = useMemo(() => {
    const startIndex = (safeItemPage - 1) * ITEMS_PER_PAGE;
    return filteredInventory.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredInventory, safeItemPage]);

  useEffect(() => {
    if (itemSubPage > totalItemPages) {
      setItemSubPage(totalItemPages);
    }
  }, [filteredInventory.length, totalItemPages, itemSubPage]);

  return (
    <div className="w-full max-w-full overflow-x-hidden text-[#1F2937] space-y-3 font-sans box-border relative pb-12">
      {/* 토스트 알림 메시지 */}
      {toastMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-xs p-4">
          <div className="bg-[#243B5A] text-white px-5 py-3 rounded-xl shadow-2xl flex items-center space-x-2.5 text-xs sm:text-sm font-bold border border-slate-600 max-w-xs text-center animate-fade-in">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <span className="truncate">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* 대시보드 헤더 */}
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

        {/* 상단 알림 및 상태 버튼 */}
        <div className="flex items-center space-x-2 self-end sm:self-auto shrink-0">
          {calibrationAlertItems.length > 0 && (
            <button
              onClick={() => setIsAlertBannerOpen(!isAlertBannerOpen)}
              className="flex items-center space-x-1.5 bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-amber-100 transition"
            >
              <Bell className="h-3.5 w-3.5 text-amber-600 animate-bounce" />
              <span>교정 예정 ({calibrationAlertItems.length})</span>
              {isAlertBannerOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
        </div>
      </div>

      {/* 교정 만료 예정 알림 바 Banner */}
      {isAlertBannerOpen && calibrationAlertItems.length > 0 && (
        <div className="bg-amber-50/90 border border-amber-200 rounded-lg p-3 space-y-2 text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center justify-between font-bold border-b border-amber-200/60 pb-1.5">
            <div className="flex items-center space-x-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span>30일 이내 교정 주기 만료 예정 목록</span>
            </div>
            <button onClick={() => setIsAlertBannerOpen(false)} className="text-amber-500 hover:text-amber-800">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-y-auto pt-1">
            {calibrationAlertItems.map(({ item, daysLeft, nextCalDate }, idx) => (
              <div key={idx} className="bg-white p-2 rounded border border-amber-200 flex justify-between items-center shadow-2xs">
                <div className="truncate mr-2">
                  <span className="font-semibold block truncate text-[#1F2937]">{item.name || item.item}</span>
                  <span className="text-[10px] text-gray-500 font-mono">만료일: {nextCalDate}</span>
                </div>
                <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold shrink-0 ${daysLeft <= 7 ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}`}>
                  {daysLeft <= 0 ? '오늘/만료' : `D-${daysLeft}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 메인 탭 컨트롤 */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
        <div className="flex bg-[#E2E5E9]/60 p-1 rounded-lg border border-[#E2E5E9] w-full sm:w-auto">
          <button
            onClick={() => { setInventoryTab('고정'); setSelectedItemSubCategory('전체 보기'); setItemSubPage(1); }}
            className={`flex-1 sm:flex-none flex items-center justify-center space-x-1 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              inventoryTab === '고정' ? 'bg-[#243B5A] text-white shadow-2xs' : 'text-[#64748B] hover:text-[#1F2937]'
            }`}
          >
            <Lock className="h-3.5 w-3.5 shrink-0" />
            <span>기자재</span>
          </button>
          <button
            onClick={() => { setInventoryTab('소모성'); setSelectedItemSubCategory('전체 보기'); setItemSubPage(1); }}
            className={`flex-1 sm:flex-none flex items-center justify-center space-x-1 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              inventoryTab === '소모성' ? 'bg-[#243B5A] text-white shadow-2xs' : 'text-[#64748B] hover:text-[#1F2937]'
            }`}
          >
            <Box className="h-3.5 w-3.5 shrink-0" />
            <span>소모성 자재</span>
          </button>
          <button
            onClick={() => { setInventoryTab('CABIN'); setSelectedItemSubCategory('전체 보기'); setItemSubPage(1); }}
            className={`flex-1 sm:flex-none flex items-center justify-center space-x-1 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              inventoryTab === 'CABIN' ? 'bg-[#243B5A] text-white shadow-2xs' : 'text-[#64748B] hover:text-[#1F2937]'
            }`}
          >
            <Compass className="h-3.5 w-3.5 shrink-0" />
            <span>CABIN</span>
          </button>
        </div>

        {isAdmin && (
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setIsSubCatModalOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center space-x-1 bg-white hover:bg-slate-50 text-[#64748B] border border-[#E2E5E9] px-2.5 py-1.5 rounded-lg text-xs font-medium transition shadow-2xs"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>카테고리 설정</span>
            </button>
            <button
              onClick={handleOpenInventoryCreate}
              className="flex-1 sm:flex-none flex items-center justify-center space-x-1 bg-[#243B5A] hover:bg-[#1d3049] text-white px-3 py-1.5 rounded-lg transition font-medium text-xs shadow-2xs shrink-0"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>신규 자재 등록</span>
            </button>
          </div>
        )}
      </div>

      {/* 1차 서브 카테고리 BAR */}
      {inventoryTab === 'CABIN' ? (
        <div className="bg-white px-2.5 py-2 rounded-lg border border-[#E2E5E9] shadow-2xs flex items-center justify-between gap-2 overflow-hidden">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#64748B] shrink-0">
            <Package className="h-3.5 w-3.5 text-[#243B5A]" />
            <span>구역/시트:</span>
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
        </div>
      ) : (
        <div className="bg-white px-2.5 py-2 rounded-lg border border-[#E2E5E9] shadow-2xs flex items-center justify-between gap-2 overflow-hidden">
          <div 
            className="flex items-center gap-1.5 overflow-x-auto flex-1 py-0.5 min-w-0"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#CBD5E1 transparent' }}
          >
            {(inventoryTab === '고정' || inventoryTab === '소모성') && (
              <button
                onClick={() => { setCurrentSelectedCategory('전체 보기'); setSelectedItemSubCategory('전체 보기'); setItemSubPage(1); }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition shrink-0 ${getCurrentSelectedCategory() === '전체 보기' ? 'bg-[#243B5A] text-white shadow-2xs' : 'bg-[#F5F6F8] text-[#64748B] hover:bg-[#E2E5E9]'}`}
              >
                전체 보기
              </button>
            )}
            {getCurrentSubCategories().map((cat) => {
              const isSelected = getCurrentSelectedCategory() === cat;
              return (
                <button
                  key={cat}
                  onClick={() => {
                    setCurrentSelectedCategory(cat);
                    setSelectedItemSubCategory('전체 보기');
                    setItemSubPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition shrink-0 ${
                    isSelected
                      ? 'bg-[#243B5A] text-white font-semibold shadow-2xs'
                      : 'bg-[#F5F6F8] text-[#64748B] hover:bg-[#E2E5E9] hover:text-[#1F2937]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* VBT 상세 서브 탭 (고정 자재 VBT 선택 시) */}
      {inventoryTab === '고정' && selectedFixedSubCategory === 'VBT' && (
        <div className="bg-[#F8FAFC] px-2.5 py-1.5 rounded-lg border border-[#E2E5E9] flex items-center space-x-1.5 text-xs">
          <span className="text-[#64748B] font-bold text-[11px] shrink-0">VBT 타입:</span>
          {(['1L', '1S', '2L', '2S', 'FLAT', '기타'] as VbtSubCategory[]).map((vbt) => (
            <button
              key={vbt}
              onClick={() => { setSelectedVbtSubCategory(vbt); setItemSubPage(1); }}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                selectedVbtSubCategory === vbt ? 'bg-[#243B5A] text-white' : 'bg-white text-[#64748B] border border-[#E2E5E9] hover:bg-gray-100'
              }`}
            >
              {vbt}
            </button>
          ))}
        </div>
      )}

      {/* 2차 품목별 서브 탭 */}
      {currentItemSubCategoryOptions.length > 0 && (
        <div className="bg-slate-50 px-2.5 py-1.5 rounded-lg border border-[#E2E5E9] flex items-center justify-between gap-2 overflow-hidden">
          <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0" style={{ scrollbarWidth: 'thin' }}>
            <span className="text-[11px] font-bold text-[#64748B] shrink-0 mr-1">세부 품목:</span>
            <button
              onClick={() => { setSelectedItemSubCategory('전체 보기'); setItemSubPage(1); }}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold whitespace-nowrap transition ${
                selectedItemSubCategory === '전체 보기' ? 'bg-[#243B5A] text-white' : 'bg-white border border-[#E2E5E9] text-[#64748B] hover:bg-slate-100'
              }`}
            >
              전체 보기
            </button>
            {currentItemSubCategoryOptions.map((subCat) => (
              <button
                key={subCat}
                onClick={() => { setSelectedItemSubCategory(subCat); setItemSubPage(1); }}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold whitespace-nowrap transition ${
                  selectedItemSubCategory === subCat ? 'bg-[#243B5A] text-white' : 'bg-white border border-[#E2E5E9] text-[#64748B] hover:bg-slate-100'
                }`}
              >
                {subCat}
              </button>
            ))}
          </div>

          {isAdmin && (
            <button
              onClick={() => setIsItemSubCatModalOpen(true)}
              className="text-[11px] text-[#243B5A] hover:underline shrink-0 font-medium flex items-center space-x-0.5"
            >
              <Plus className="h-3 w-3" />
              <span>품목 관리</span>
            </button>
          )}
        </div>
      )}

      {/* 목록 헤더 및 개수 표시 */}
      <div className="bg-white rounded-lg border border-[#E2E5E9] p-3 flex items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center space-x-2 text-xs font-bold text-[#1F2937] min-w-0 truncate">
          <Package className="h-4 w-4 text-[#243B5A] shrink-0" />
          <span className="truncate">자재 목록</span>
          <span className="text-[10px] bg-[#F5F6F8] border border-[#E2E5E9] text-[#243B5A] px-2 py-0.5 rounded-full font-mono font-bold shrink-0">
            총 {filteredInventory.length}건
          </span>
        </div>
      </div>

      {/* 자재 테이블 목록 */}
      <div className="bg-white rounded-lg border border-[#E2E5E9] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E5E9] text-[#64748B]">
                <th className="p-2.5 font-semibold">코드/번호</th>
                <th className="p-2.5 font-semibold">품목명</th>
                <th className="p-2.5 font-semibold">카테고리</th>
                <th className="p-2.5 font-semibold">수량</th>
                <th className="p-2.5 font-semibold">위치</th>
                <th className="p-2.5 font-semibold text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E5E9]">
              {paginatedInventory.length > 0 ? (
                paginatedInventory.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F8FAFC] transition">
                    <td className="p-2.5 font-mono text-[11px] text-[#243B5A] font-semibold">{item.code || item.no || '-'}</td>
                    <td className="p-2.5 font-bold text-[#1F2937]">
                      <button
                        onClick={() => setSelectedDetailItem(item)}
                        className="hover:underline text-left"
                      >
                        {item.name || item.item || '-'}
                      </button>
                    </td>
                    <td className="p-2.5 text-[#64748B]">{item.category || item.sheet_name || '-'}</td>
                    <td className="p-2.5 font-semibold">{item.quantity} {item.unit || 'EA'}</td>
                    <td className="p-2.5 text-[#64748B]">{item.location || item.location_or_section || '-'}</td>
                    <td className="p-2.5 text-right space-x-1">
                      <button
                        onClick={() => handleOpenLogModal(item, '불출')}
                        className="px-2 py-1 bg-[#243B5A] text-white rounded text-[11px] hover:bg-[#1d3049] transition font-medium"
                      >
                        불출
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleOpenInventoryEdit(item)}
                          className="p-1 hover:bg-[#E2E5E9] rounded text-[#64748B] hover:text-[#1F2937] inline-flex items-center"
                          title="수정"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-[#94A3B8]">
                    등록된 자재가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 컨트롤 UI */}
        {filteredInventory.length > 0 && (
          <div className="flex items-center justify-between border-t border-[#E2E5E9] bg-[#F8FAFC] px-3 py-2 text-xs">
            <div className="text-[#64748B] text-[11px]">
              페이지 <strong className="text-[#1F2937]">{safeItemPage}</strong> / {totalItemPages}
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={() => setItemSubPage((prev) => Math.max(1, prev - 1))}
                disabled={safeItemPage === 1}
                className="p-1.5 rounded-md border border-[#E2E5E9] bg-white text-[#64748B] hover:bg-[#F5F6F8] hover:text-[#1F2937] disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="이전 페이지"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {Array.from({ length: totalItemPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setItemSubPage(pageNum)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                    safeItemPage === pageNum
                      ? 'bg-[#243B5A] text-white shadow-2xs'
                      : 'bg-white border border-[#E2E5E9] text-[#64748B] hover:bg-[#F5F6F8] hover:text-[#1F2937]'
                  }`}
                >
                  {pageNum}
                </button>
              ))}

              <button
                onClick={() => setItemSubPage((prev) => Math.min(totalItemPages, prev + 1))}
                disabled={safeItemPage === totalItemPages}
                className="p-1.5 rounded-md border border-[#E2E5E9] bg-white text-[#64748B] hover:bg-[#F5F6F8] hover:text-[#1F2937] disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="다음 페이지"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 하단 입출고 및 불출 관리 이력 섹션 */}
      <div className="bg-white rounded-lg border border-[#E2E5E9] p-3 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-[#E2E5E9] pb-2">
          <div className="flex items-center space-x-2 font-bold text-xs text-[#1F2937]">
            <History className="h-4 w-4 text-[#243B5A]" />
            <span>자재 불출 및 작업 이력</span>
          </div>

          {selectedLogIds.length > 0 && isAdmin && (
            <button
              onClick={() => setShowBatchDeleteConfirm(true)}
              className="flex items-center space-x-1 px-2.5 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition font-medium"
            >
              <Trash2 className="h-3 w-3" />
              <span>선택 {selectedLogIds.length}건 삭제</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E5E9] text-[#64748B]">
                {isAdmin && (
                  <th className="p-2.5 w-8">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedLogIds(inventoryLogs.map(l => String(l.id)));
                        } else {
                          setSelectedLogIds([]);
                        }
                      }}
                      checked={inventoryLogs.length > 0 && selectedLogIds.length === inventoryLogs.length}
                    />
                  </th>
                )}
                <th className="p-2.5 font-semibold">일시</th>
                <th className="p-2.5 font-semibold">품목명</th>
                <th className="p-2.5 font-semibold">구분</th>
                <th className="p-2.5 font-semibold">수량</th>
                <th className="p-2.5 font-semibold">작업자</th>
                <th className="p-2.5 font-semibold">비고/메모</th>
                <th className="p-2.5 font-semibold text-right">반납/관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E5E9]">
              {inventoryLogs && inventoryLogs.length > 0 ? (
                inventoryLogs.map((log) => {
                  const isChecked = selectedLogIds.includes(String(log.id));
                  const isOut = log.type.includes('불출');
                  const isReturned = log.type.includes('반납완료');

                  return (
                    <tr key={log.id} className="hover:bg-[#F8FAFC] transition">
                      {isAdmin && (
                        <td className="p-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLogIds(prev => [...prev, String(log.id)]);
                              } else {
                                setSelectedLogIds(prev => prev.filter(id => id !== String(log.id)));
                              }
                            }}
                          />
                        </td>
                      )}
                      <td className="p-2.5 text-[#64748B] font-mono text-[11px]">
                        {new Date(log.created_at).toLocaleString('ko-KR', {
                          month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td className="p-2.5 font-bold text-[#1F2937]">{log.item_name || '-'}</td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isOut ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {log.type}
                        </span>
                      </td>
                      <td className="p-2.5 font-semibold">{log.quantity}</td>
                      <td className="p-2.5 text-[#64748B]">{log.worker_name || '-'}</td>
                      <td className="p-2.5 text-[#64748B] max-w-xs truncate">{log.memo || '-'}</td>
                      <td className="p-2.5 text-right space-x-1">
                        {isOut && !isReturned && (
                          <button
                            onClick={() => handleOpenReturnModal(log)}
                            className="px-2 py-1 bg-emerald-600 text-white rounded text-[11px] hover:bg-emerald-700 transition font-medium"
                          >
                            반납
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteLog(log.id)}
                            className="p-1 hover:bg-red-50 text-red-600 rounded transition"
                            title="삭제"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-[#94A3B8]">
                    기록된 입출고/불출 이력이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------- 모달 및 시트 UI 컴포넌트 모음 ---------------- */}

      {/* 1. 자재 상세정보 오프캔버스 시트 */}
      {selectedDetailItem && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between p-5 overflow-y-auto animate-slide-left">
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-[#E2E5E9] pb-3">
                <div className="flex items-center space-x-2">
                  <Package className="h-5 w-5 text-[#243B5A]" />
                  <h2 className="font-bold text-sm text-[#1F2937]">자재 상세 정보</h2>
                </div>
                <button onClick={() => setSelectedDetailItem(null)} className="p-1 hover:bg-[#F5F6F8] rounded-full text-[#64748B]">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E5E9] space-y-1">
                  <span className="text-[10px] text-[#64748B] uppercase font-bold">코드 / 식별번호</span>
                  <div className="text-sm font-bold text-[#243B5A] font-mono">{selectedDetailItem.code || selectedDetailItem.no || '-'}</div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E5E9]">
                    <span className="text-[10px] text-[#64748B] block font-bold">품목명</span>
                    <span className="font-bold text-[#1F2937]">{selectedDetailItem.name || selectedDetailItem.item || '-'}</span>
                  </div>
                  <div className="bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E5E9]">
                    <span className="text-[10px] text-[#64748B] block font-bold">카테고리</span>
                    <span className="font-bold text-[#1F2937]">{selectedDetailItem.category || selectedDetailItem.sheet_name || '-'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E5E9]">
                    <span className="text-[10px] text-[#64748B] block font-bold">현재 수량</span>
                    <span className="font-bold text-[#243B5A] text-sm">{selectedDetailItem.quantity} {selectedDetailItem.unit || 'EA'}</span>
                  </div>
                  <div className="bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E5E9]">
                    <span className="text-[10px] text-[#64748B] block font-bold">보관 위치</span>
                    <span className="font-bold text-[#1F2937]">{selectedDetailItem.location || selectedDetailItem.location_or_section || '-'}</span>
                  </div>
                </div>

                {selectedDetailItem.serial_number && (
                  <div className="bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E5E9]">
                    <span className="text-[10px] text-[#64748B] block font-bold">시리얼 번호 (S/N)</span>
                    <span className="font-mono text-[#1F2937]">{selectedDetailItem.serial_number}</span>
                  </div>
                )}

                {selectedDetailItem.sub_equipment && (
                  <div className="bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E5E9]">
                    <span className="text-[10px] text-[#64748B] block font-bold">교정 주기 / 부속 정보</span>
                    <span className="text-[#1F2937]">{selectedDetailItem.sub_equipment}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-[#E2E5E9] flex space-x-2">
              <button
                onClick={() => {
                  const item = selectedDetailItem;
                  setSelectedDetailItem(null);
                  handleOpenLogModal(item, '불출');
                }}
                className="flex-1 py-2 bg-[#243B5A] text-white rounded-lg font-bold text-xs hover:bg-[#1d3049] transition"
              >
                불출 처리
              </button>
              {isAdmin && (
                <button
                  onClick={() => handleDeleteInventory(selectedDetailItem.id)}
                  className="px-3 py-2 bg-red-50 text-red-600 rounded-lg font-bold text-xs hover:bg-red-100 transition border border-red-200"
                >
                  삭제
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. 신규 등록 및 수정 모달 */}
      {showInventorySheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E2E5E9] w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-[#243B5A] text-white flex justify-between items-center shrink-0">
              <h2 className="font-bold text-sm flex items-center space-x-2">
                <Package className="h-4 w-4" />
                <span>{editingItem ? '자재 정보 수정' : '신규 자재 등록'}</span>
              </h2>
              <button onClick={() => setShowInventorySheet(false)} className="text-gray-300 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto text-xs flex-1">
              <div>
                <label className="block font-bold text-[#1F2937] mb-1">자재 구분</label>
                <div className="flex bg-[#F5F6F8] p-1 rounded-lg border border-[#E2E5E9]">
                  <button
                    onClick={() => setItemType('고정')}
                    className={`flex-1 py-1 rounded text-center font-bold ${itemType === '고정' ? 'bg-[#243B5A] text-white' : 'text-[#64748B]'}`}
                  >
                    기자재
                  </button>
                  <button
                    onClick={() => setItemType('소모성')}
                    className={`flex-1 py-1 rounded text-center font-bold ${itemType === '소모성' ? 'bg-[#243B5A] text-white' : 'text-[#64748B]'}`}
                  >
                    소모성 자재
                  </button>
                  <button
                    onClick={() => setItemType('CABIN')}
                    className={`flex-1 py-1 rounded text-center font-bold ${itemType === 'CABIN' ? 'bg-[#243B5A] text-white' : 'text-[#64748B]'}`}
                  >
                    CABIN
                  </button>
                </div>
              </div>

              {itemType === 'CABIN' ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-[#64748B] mb-1">시트/구역</label>
                      <input
                        type="text"
                        value={cabinSheetName}
                        onChange={(e) => setCabinSheetName(e.target.value)}
                        className="w-full p-2 border border-[#E2E5E9] rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#64748B] mb-1">식별번호 (NO)</label>
                      <input
                        type="text"
                        value={itemCode}
                        onChange={(e) => setItemCode(e.target.value)}
                        className="w-full p-2 border border-[#E2E5E9] rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#64748B] mb-1">품목명 (ITEM)</label>
                    <input
                      type="text"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      className="w-full p-2 border border-[#E2E5E9] rounded-lg text-xs"
                      placeholder="품목 명칭 입력"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-[#64748B] mb-1">제조사 / 모델명</label>
                      <input
                        type="text"
                        value={cabinMakerModel}
                        onChange={(e) => setCabinMakerModel(e.target.value)}
                        className="w-full p-2 border border-[#E2E5E9] rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#64748B] mb-1">시리얼 번호</label>
                      <input
                        type="text"
                        value={cabinSerialNo}
                        onChange={(e) => setCabinSerialNo(e.target.value)}
                        className="w-full p-2 border border-[#E2E5E9] rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-[#64748B] mb-1">성적서 번호 (Cert No)</label>
                      <input
                        type="text"
                        value={cabinCertNo}
                        onChange={(e) => setCabinCertNo(e.target.value)}
                        className="w-full p-2 border border-[#E2E5E9] rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#64748B] mb-1">교정 완료일/만료일</label>
                      <input
                        type="date"
                        value={cabinCalibrationDate}
                        onChange={(e) => setCabinCalibrationDate(e.target.value)}
                        className="w-full p-2 border border-[#E2E5E9] rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-[#64748B] mb-1">자재 코드</label>
                      <input
                        type="text"
                        value={itemCode}
                        onChange={(e) => setItemCode(e.target.value)}
                        className="w-full p-2 border border-[#E2E5E9] rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#64748B] mb-1">카테고리</label>
                      <select
                        value={itemCategory}
                        onChange={(e) => setItemCategory(e.target.value)}
                        className="w-full p-2 border border-[#E2E5E9] rounded-lg text-xs"
                      >
                        {(itemType === '고정' ? fixedSubCategories : consumableSubCategories).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#64748B] mb-1">자재명</label>
                    <input
                      type="text"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      className="w-full p-2 border border-[#E2E5E9] rounded-lg text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-semibold text-[#64748B] mb-1">수량</label>
                      <input
                        type="number"
                        value={itemQuantity}
                        onChange={(e) => setItemQuantity(Number(e.target.value))}
                        className="w-full p-2 border border-[#E2E5E9] rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#64748B] mb-1">단위</label>
                      <input
                        type="text"
                        value={itemUnit}
                        onChange={(e) => setItemUnit(e.target.value)}
                        className="w-full p-2 border border-[#E2E5E9] rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#64748B] mb-1">최소 안전재고</label>
                      <input
                        type="number"
                        value={itemMinQty}
                        onChange={(e) => setItemMinQty(Number(e.target.value))}
                        className="w-full p-2 border border-[#E2E5E9] rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#64748B] mb-1">보관 위치</label>
                    <input
                      type="text"
                      value={itemLocation}
                      onChange={(e) => setItemLocation(e.target.value)}
                      className="w-full p-2 border border-[#E2E5E9] rounded-lg text-xs"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="p-3 border-t border-[#E2E5E9] bg-slate-50 flex justify-end space-x-2 shrink-0">
              <button
                onClick={() => setShowInventorySheet(false)}
                className="px-3 py-1.5 bg-white border border-[#E2E5E9] rounded-lg text-xs font-semibold text-[#64748B]"
              >
                취소
              </button>
              <button
                onClick={handleSaveInventory}
                className="px-4 py-1.5 bg-[#243B5A] text-white rounded-lg text-xs font-bold hover:bg-[#1d3049]"
              >
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. 불출 처리 모달 */}
      {showLogSheet && targetItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E2E5E9] w-full max-w-sm overflow-hidden space-y-4 p-4">
            <div className="flex justify-between items-center border-b border-[#E2E5E9] pb-2">
              <h2 className="font-bold text-sm text-[#1F2937]">불출 / 입고 처리</h2>
              <button onClick={() => setShowLogSheet(false)} className="text-[#64748B]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-[#F8FAFC] p-2.5 rounded border border-[#E2E5E9]">
                <span className="text-[10px] text-[#64748B] block font-semibold">대상 품목</span>
                <span className="font-bold text-[#1F2937] text-sm">{targetItem.name || targetItem.item}</span>
              </div>

              <div>
                <label className="block font-semibold text-[#64748B] mb-1">작업 구분</label>
                <div className="flex bg-[#F5F6F8] p-1 rounded-lg border border-[#E2E5E9]">
                  <button
                    onClick={() => setLogType('불출')}
                    className={`flex-1 py-1 rounded font-bold ${logType === '불출' ? 'bg-[#243B5A] text-white' : 'text-[#64748B]'}`}
                  >
                    불출
                  </button>
                  <button
                    onClick={() => setLogType('입고')}
                    className={`flex-1 py-1 rounded font-bold ${logType === '입고' ? 'bg-emerald-600 text-white' : 'text-[#64748B]'}`}
                  >
                    입고 / 반납
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#64748B] mb-1">수량</label>
                <input
                  type="number"
                  value={logQty}
                  onChange={(e) => setLogQty(Number(e.target.value))}
                  className="w-full p-2 border border-[#E2E5E9] rounded-lg text-xs"
                  min={1}
                />
              </div>

              <div>
                <label className="block font-semibold text-[#64748B] mb-1">비고 / 메모</label>
                <textarea
                  value={logMemo}
                  onChange={(e) => setLogMemo(e.target.value)}
                  className="w-full p-2 border border-[#E2E5E9] rounded-lg text-xs"
                  rows={2}
                  placeholder="불출 목적 또는 메모 작성"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-[#E2E5E9]">
              <button
                onClick={() => setShowLogSheet(false)}
                className="px-3 py-1.5 bg-white border border-[#E2E5E9] rounded-lg text-xs text-[#64748B]"
              >
                취소
              </button>
              <button
                onClick={handleSubmitLog}
                className="px-4 py-1.5 bg-[#243B5A] text-white rounded-lg text-xs font-bold"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. 반납 모달 */}
      {showReturnModal && targetReturnLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E2E5E9] w-full max-w-sm p-4 space-y-3 text-xs">
            <div className="flex justify-between items-center border-b border-[#E2E5E9] pb-2">
              <h2 className="font-bold text-sm text-[#1F2937]">자재 반납 처리</h2>
              <button onClick={() => setShowReturnModal(false)}><X className="h-4 w-4 text-[#64748B]" /></button>
            </div>

            <div>
              <span className="text-[#64748B] block">반납 품목:</span>
              <strong className="text-[#1F2937] text-sm">{targetReturnLog.item_name}</strong>
            </div>

            <div>
              <label className="block font-semibold text-[#64748B] mb-1">반납 수량</label>
              <input
                type="number"
                value={returnQty}
                onChange={(e) => setReturnQty(Number(e.target.value))}
                className="w-full p-2 border border-[#E2E5E9] rounded-lg"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="issueCheck"
                checked={returnHasIssue}
                onChange={(e) => setReturnHasIssue(e.target.checked)}
              />
              <label htmlFor="issueCheck" className="font-semibold text-red-600">장비 이상 / 파손 발생 시 체크</label>
            </div>

            <div>
              <label className="block font-semibold text-[#64748B] mb-1">반납 특이사항</label>
              <textarea
                value={returnMemo}
                onChange={(e) => setReturnMemo(e.target.value)}
                className="w-full p-2 border border-[#E2E5E9] rounded-lg"
                rows={2}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button onClick={() => setShowReturnModal(false)} className="px-3 py-1.5 border border-[#E2E5E9] rounded text-[#64748B]">취소</button>
              <button onClick={handleSubmitReturn} className="px-4 py-1.5 bg-emerald-600 text-white font-bold rounded">반납 완료</button>
            </div>
          </div>
        </div>
      )}

      {/* 5. 일괄 삭제 확인 모달 */}
      {showBatchDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl p-5 border border-[#E2E5E9] max-w-xs w-full text-center space-y-3 shadow-2xl">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
            <h3 className="font-bold text-sm text-[#1F2937]">선택한 이력을 삭제하시겠습니까?</h3>
            <p className="text-xs text-[#64748B]">총 {selectedLogIds.length}건의 이력이 삭제되며 복구할 수 없습니다.</p>
            <div className="flex space-x-2 pt-2">
              <button onClick={() => setShowBatchDeleteConfirm(false)} className="flex-1 py-1.5 border rounded text-xs">취소</button>
              <button onClick={handleBatchDeleteLogs} className="flex-1 py-1.5 bg-red-600 text-white rounded font-bold text-xs">삭제</button>
            </div>
          </div>
        </div>
      )}

      {/* 6. 카테고리/서브탭 관리 모달 */}
      {isSubCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E2E5E9] w-full max-w-md overflow-hidden p-4 space-y-3 text-xs">
            <div className="flex justify-between items-center border-b border-[#E2E5E9] pb-2">
              <h2 className="font-bold text-sm text-[#1F2937]">카테고리 순서 및 설정</h2>
              <button onClick={() => setIsSubCatModalOpen(false)}><X className="h-4 w-4 text-[#64748B]" /></button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {getCurrentSubCategories().map((cat, idx) => (
                <div key={cat} className="flex justify-between items-center bg-[#F8FAFC] p-2 rounded border border-[#E2E5E9]">
                  <span className="font-bold text-[#1F2937]">{cat}</span>
                  <div className="flex items-center space-x-1">
                    <button onClick={() => moveCurrentSubCategory(idx, -1)} className="p-1 border rounded hover:bg-white"><ChevronUp className="h-3 w-3" /></button>
                    <button onClick={() => moveCurrentSubCategory(idx, 1)} className="p-1 border rounded hover:bg-white"><ChevronDown className="h-3 w-3" /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={() => setIsSubCatModalOpen(false)} className="px-4 py-1.5 bg-[#243B5A] text-white rounded font-bold">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 7. 품목 관리 모달 */}
      {isItemSubCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E2E5E9] w-full max-w-md p-4 space-y-3 text-xs">
            <div className="flex justify-between items-center border-b border-[#E2E5E9] pb-2">
              <h2 className="font-bold text-sm text-[#1F2937]">품목별 서브탭 관리</h2>
              <button onClick={() => setIsItemSubCatModalOpen(false)}><X className="h-4 w-4 text-[#64748B]" /></button>
            </div>

            <div className="space-y-2">
              <label className="block font-bold text-[#64748B]">새 서브탭 이름 추가</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newItemSubCatName}
                  onChange={(e) => setNewItemSubCatName(e.target.value)}
                  className="flex-1 p-2 border border-[#E2E5E9] rounded-lg"
                  placeholder="예: 디지털 센서"
                />
                <button onClick={handleAddItemSubCategory} className="px-3 py-1.5 bg-[#243B5A] text-white rounded-lg font-bold">추가</button>
              </div>
            </div>

            <div className="space-y-1 max-h-48 overflow-y-auto pt-2 border-t border-[#E2E5E9]">
              {currentItemSubCategoryEntries.map(entry => (
                <div key={entry.name} className="flex justify-between items-center bg-[#F8FAFC] p-2 rounded border border-[#E2E5E9]">
                  <span className="font-semibold text-[#1F2937]">{entry.name}</span>
                  <button onClick={() => handleDeleteItemSubCategory(entry.name)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={() => setIsItemSubCatModalOpen(false)} className="px-4 py-1.5 border border-[#E2E5E9] rounded text-[#64748B]">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
