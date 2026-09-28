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
  AlertTriangle, 
  Lock,
  Box,
  Calendar,
  Bell,
  ChevronDown,
  ChevronUp,
  Compass,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Settings,
  History,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AppUser, InventoryItem, InventoryLog } from '@/lib/types';

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
  // 메인 탭 상태
  const [inventoryTab, setInventoryTab] = useState<MainTab>('고정');

  // CABIN 전용 목록 상태
  const [cabinInventoryList, setCabinInventoryList] = useState<InventoryItem[]>([]);
  const [loadingCabin, setLoadingCabin] = useState<boolean>(false);

  // 커스텀 토스트 알림 상태
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showCustomToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // 동적 서브 카테고리 목록 상태
  const [fixedSubCategories, setFixedSubCategories] = useState<string[]>([
    '압력계', '가스측정기', 'VBT', '공구', '무선 배터리', '교정', '기타'
  ]);
  const [selectedFixedSubCategory, setSelectedFixedSubCategory] = useState<string>('압력계');

  const [consumableSubCategories, setConsumableSubCategories] = useState<string[]>([
    '검사약품', '기밀', '기타'
  ]);
  const [selectedConsumableCategory, setSelectedConsumableCategory] = useState<string>('검사약품');

  const [cabinSubCategories, setCabinSubCategories] = useState<string[]>(['부품 A', '부품 B', '기타']);
  const [selectedCabinSubCategory, setSelectedCabinSubCategory] = useState<string>('부품 A');

  // VBT 서브 탭
  const [selectedVbtSubCategory, setSelectedVbtSubCategory] = useState<VbtSubCategory>('1L');

  // 서브 카테고리 관리 모달
  const [isSubCatModalOpen, setIsSubCatModalOpen] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>('');
  const [editingCatIndex, setEditingCatIndex] = useState<number | null>(null);
  const [editingCatName, setEditingCatName] = useState<string>('');

  // UI 제어 상태
  const [isAlertBannerOpen, setIsAlertBannerOpen] = useState(true);
  const [isHistorySectionOpen, setIsHistorySectionOpen] = useState(true);
  
  // 서브탭별 내용 통합 접고/펴기 상태 관리
  const [collapsedSubTabs, setCollapsedSubTabs] = useState<{ [key: string]: boolean }>({});

  const toggleSubTabContent = (subCatName: string) => {
    setCollapsedSubTabs(prev => ({
      ...prev,
      [subCatName]: !prev[subCatName]
    }));
  };

  const [selectedDetailItem, setSelectedDetailItem] = useState<InventoryItem | null>(null);
  const [showInventorySheet, setShowInventorySheet] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  
  const [showLogSheet, setShowLogSheet] = useState(false);
  const [targetItem, setTargetItem] = useState<InventoryItem | null>(null);
  const [logType, setLogType] = useState<'불출' | '반납' | '소모성 사용'>('불출');
  const [logQty, setLogQty] = useState<number>(1);
  const [logHasIssue, setLogHasIssue] = useState<boolean>(false);
  const [logMemo, setLogMemo] = useState('');

  // 이력 일괄 삭제용 선택된 ID 관리
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);

  // 교정일 30일 전 알림 항목
  const [calibrationAlertItems, setCalibrationAlertItems] = useState<{ item: InventoryItem; daysLeft: number; calDate: string; nextCalDate: string }[]>([]);

  // CABIN 전용 데이터 패치 함수
  const fetchCabinInventory = async () => {
    setLoadingCabin(true);
    try {
      const { data, error } = await supabase.from('cabin_inventory').select('*');
      if (error) throw error;
      setCabinInventoryList(data || []);
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

  // 교정일 알림 동기화 (30일 전 기준 적용)
  useEffect(() => {
    const targetList = inventoryTab === 'CABIN' ? cabinInventoryList : inventoryList;
    if (!targetList || targetList.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingCalibrations: { item: InventoryItem; daysLeft: number; calDate: string; nextCalDate: string }[] = [];

    targetList.forEach((item) => {
      const subEquip = item.sub_equipment || '';
      const parts = subEquip.split('|').map(s => s.trim());
      
      let nextCalDateStr = parts.length >= 2 ? parts[1] : '';
      let calDateStr = parts[0] || '';

      if (!nextCalDateStr) {
        const dateMatch = subEquip.match(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})/g);
        if (dateMatch && dateMatch.length >= 2) {
          nextCalDateStr = dateMatch[1].replace(/\./g, '-');
          calDateStr = dateMatch[0].replace(/\./g, '-');
        }
      }

      if (nextCalDateStr) {
        const nextCalDate = new Date(nextCalDateStr);
        if (!isNaN(nextCalDate.getTime())) {
          nextCalDate.setHours(0, 0, 0, 0);
          const diffDays = Math.ceil((nextCalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          if (diffDays <= 30) {
            upcomingCalibrations.push({
              item,
              daysLeft: diffDays,
              calDate: calDateStr,
              nextCalDate: nextCalDateStr
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

  // 폼 입력 필드
  const [itemType, setItemType] = useState<MainTab>('고정');
  const [itemCode, setItemCode] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState('압력계');
  const [itemVbtType, setItemVbtType] = useState('');
  const [itemCalDate, setItemCalDate] = useState('');
  const [itemNextCalDate, setItemNextCalDate] = useState('');
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemUnit, setItemUnit] = useState('대');
  const [itemMinQty, setItemMinQty] = useState<number>(0);
  const [itemLocation, setItemLocation] = useState('장비실 A');

  const getCurrentSubCategories = () => {
    if (inventoryTab === '고정') return fixedSubCategories;
    if (inventoryTab === '소모성') return consumableSubCategories;
    return cabinSubCategories;
  };

  const setCurrentSubCategories = (newList: string[]) => {
    if (inventoryTab === '고정') setFixedSubCategories(newList);
    else if (inventoryTab === '소모성') setConsumableSubCategories(newList);
    else setCabinSubCategories(newList);
  };

  const getCurrentSelectedCategory = () => {
    if (inventoryTab === '고정') return selectedFixedSubCategory;
    if (inventoryTab === '소모성') return selectedConsumableCategory;
    return selectedCabinSubCategory;
  };

  const setCurrentSelectedCategory = (val: string) => {
    if (inventoryTab === '고정') setSelectedFixedSubCategory(val);
    else if (inventoryTab === '소모성') setSelectedConsumableCategory(val);
    else setSelectedCabinSubCategory(val);
  };

  const handleAddCategory = () => {
    if (!isAdmin) return alert('관리자만 카테고리를 추가할 수 있습니다.');
    const trimmed = newCatName.trim();
    if (!trimmed) return alert('카테고리 이름을 입력하세요.');
    const list = getCurrentSubCategories();
    if (list.includes(trimmed)) return alert('이미 존재하는 카테고리입니다.');
    
    setCurrentSubCategories([...list, trimmed]);
    setNewCatName('');
  };

  const handleUpdateCategory = (index: number) => {
    if (!isAdmin) return alert('관리자만 수정할 수 있습니다.');
    const trimmed = editingCatName.trim();
    if (!trimmed) return alert('카테고리 이름을 입력하세요.');
    
    const list = [...getCurrentSubCategories()];
    const oldName = list[index];
    list[index] = trimmed;
    setCurrentSubCategories(list);
    
    if (getCurrentSelectedCategory() === oldName) {
      setCurrentSelectedCategory(trimmed);
    }
    setEditingCatIndex(null);
  };

  const handleDeleteCategory = (index: number) => {
    if (!isAdmin) return alert('관리자만 삭제할 수 있습니다.');
    const list = getCurrentSubCategories();
    if (list.length <= 1) return alert('최소 1개 이상의 서브 카테고리가 필요합니다.');
    const targetName = list[index];
    if (!confirm(`'${targetName}' 카테고리를 삭제하시겠습니까?`)) return;

    const updated = list.filter((_, i) => i !== index);
    setCurrentSubCategories(updated);

    if (getCurrentSelectedCategory() === targetName) {
      setCurrentSelectedCategory(updated[0]);
    }
  };

  const handleMoveCategory = (index: number, direction: 'left' | 'right') => {
    if (!isAdmin) return;
    const list = [...getCurrentSubCategories()];
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;
    setCurrentSubCategories(list);
  };

  const handleOpenInventoryCreate = () => {
    if (!isAdmin) return alert('관리자만 자재를 등록할 수 있습니다.');
    setEditingItem(null);
    setItemType(inventoryTab);
    const codePrefix = inventoryTab === '고정' ? 'FIX-' : inventoryTab === '소모성' ? 'MAT-' : 'CBN-';
    setItemCode(codePrefix + String(Math.floor(Math.random() * 900) + 100));
    setItemName('');
    setItemCategory(getCurrentSelectedCategory());
    setItemVbtType(
      inventoryTab === '고정' && selectedFixedSubCategory === 'VBT' && selectedVbtSubCategory !== '기타'
        ? selectedVbtSubCategory
        : ''
    );
    setItemCalDate('');
    setItemNextCalDate('');
    setItemQuantity(1);
    setItemUnit(inventoryTab === '소모성' ? 'EA' : '대');
    setItemMinQty(inventoryTab === '소모성' ? 5 : 0);
    setItemLocation('장비실 A');
    setShowInventorySheet(true);
  };

  const handleOpenInventoryEdit = (item: InventoryItem) => {
    if (!isAdmin) return alert('관리자만 자재 정보를 수정할 수 있습니다.');
    setSelectedDetailItem(null);
    setEditingItem(item);
    setItemType(item.type as MainTab);
    setItemCode(item.code);
    setItemName(item.name);
    setItemCategory(item.category);
    setItemVbtType(item.vbt_type || '');
    const { calDate, nextCalDate } = parseCalDates(item.sub_equipment);
    setItemCalDate(calDate);
    setItemNextCalDate(nextCalDate);
    setItemQuantity(item.quantity);
    setItemUnit(item.unit);
    setItemMinQty(item.min_quantity || 0);
    setItemLocation(item.location);
    setShowInventorySheet(true);
  };

  const handleSubmitInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return alert('관리자 권한이 필요합니다.');
    if (!itemName.trim() || !itemCode.trim()) return alert('필수 항목을 입력해주세요.');

    const subEquipValue = itemCalDate.trim() 
      ? (itemNextCalDate.trim() ? `${itemCalDate.trim()} | ${itemNextCalDate.trim()}` : itemCalDate.trim())
      : null;

    const targetTableName = itemType === 'CABIN' ? 'cabin_inventory' : 'inventory';

    try {
      const payload = {
        type: itemType,
        code: itemCode.trim(),
        name: itemName.trim(),
        category: itemCategory,
        vbt_type: itemType === '고정' ? (itemVbtType || null) : null,
        sub_equipment: (itemType === '고정' || itemType === 'CABIN') ? subEquipValue : null,
        quantity: itemQuantity,
        unit: itemUnit,
        min_quantity: itemMinQty,
        location: itemLocation,
        updated_at: new Date().toISOString()
      };

      if (editingItem) {
        const { error } = await supabase.from(targetTableName).update(payload).eq('id', editingItem.id);
        if (error) throw error;
        showCustomToast('자재 정보가 수정되었습니다.');
      } else {
        const { error } = await supabase.from(targetTableName).insert([payload]);
        if (error) throw error;
        showCustomToast('신규 자재가 등록되었습니다.');
      }

      setShowInventorySheet(false);
      if (itemType === 'CABIN') {
        await fetchCabinInventory();
      } else {
        await fetchInventory();
      }
    } catch (err: any) {
      alert('데이터베이스 저장 실패: ' + err.message);
    }
  };

  const handleDeleteInventory = async (item: InventoryItem) => {
    if (!isAdmin) return alert('관리자만 삭제할 수 있습니다.');
    if (!confirm('정말로 이 자재를 삭제하시겠습니까?')) return;

    const targetTableName = item.type === 'CABIN' ? 'cabin_inventory' : 'inventory';

    try {
      const { error } = await supabase.from(targetTableName).delete().eq('id', item.id);
      if (error) throw error;

      setSelectedDetailItem(null);
      setShowInventorySheet(false);
      showCustomToast('자재가 삭제되었습니다.');
      if (item.type === 'CABIN') {
        await fetchCabinInventory();
      } else {
        await fetchInventory();
      }
    } catch (err: any) {
      alert('삭제 실패: ' + err.message);
    }
  };

  const handleOpenLogModal = (item: InventoryItem, type: '불출' | '반납' | '소모성 사용') => {
    setSelectedDetailItem(null);
    setTargetItem(item);
    setLogType(type);
    setLogQty(1);
    setLogHasIssue(false);
    setLogMemo('');
    setShowLogSheet(true);
  };

  // 히스토리 행의 반납 버튼 클릭 시: 새로운 행을 추가하지 않고, 현재 이력 행을 '반납' 상태로 직접 업데이트
  const handleQuickReturnFromHistory = async (log: InventoryLog) => {
    try {
      let foundItem: InventoryItem | null = null;

      if (log.inventory_id) {
        const { data: invData } = await supabase.from('inventory').select('*').eq('id', log.inventory_id).single();
        if (invData) {
          foundItem = invData;
        } else {
          const { data: cabinData } = await supabase.from('cabin_inventory').select('*').eq('id', log.inventory_id).single();
          if (cabinData) foundItem = cabinData;
        }
      }

      if (!foundItem && log.item_name) {
        const { data: invDataByName } = await supabase.from('inventory').select('*').eq('name', log.item_name).limit(1);
        if (invDataByName && invDataByName.length > 0) {
          foundItem = invDataByName[0];
        } else {
          const { data: cabinDataByName } = await supabase.from('cabin_inventory').select('*').eq('name', log.item_name).limit(1);
          if (cabinDataByName && cabinDataByName.length > 0) foundItem = cabinDataByName[0];
        }
      }

      if (!foundItem) {
        return alert(`'${log.item_name}'에 해당하는 현재 등록된 자재 정보를 찾을 수 없습니다.`);
      }

      if (!confirm(`'${log.item_name}' (${log.quantity}개)를 반납 처리하시겠습니까?`)) return;

      // 1. 재고 수량 복구
      const newQty = foundItem.quantity + log.quantity;
      const targetTableName = foundItem.type === 'CABIN' ? 'cabin_inventory' : 'inventory';

      const { error: invErr } = await supabase
        .from(targetTableName)
        .update({ quantity: newQty, updated_at: new Date().toISOString() })
        .eq('id', foundItem.id);
      if (invErr) throw invErr;

      // 2. 기존 이력 행의 타입을 '반납'으로 업데이트 (새로운 행을 만들지 않음)
      const { error: logErr } = await supabase
        .from('inventory_logs')
        .update({ type: '반납', updated_at: new Date().toISOString() })
        .eq('id', log.id);
      if (logErr) throw logErr;

      showCustomToast('반납 처리가 완료되었습니다.');
      if (foundItem.type === 'CABIN') {
        await fetchCabinInventory();
      } else {
        await fetchInventory();
      }
      await fetchInventoryLogs();
    } catch (err: any) {
      alert('반납 처리 중 오류가 발생했습니다: ' + err.message);
    }
  };

  const handleEditLog = async (log: InventoryLog) => {
    if (!isAdmin) {
      alert('관리자 권한이 있는 인원만 수정할 수 있습니다.');
      return;
    }
    const newMemo = prompt('수정할 메모 내용을 입력하세요:', log.memo || '');
    if (newMemo === null) return;

    try {
      const { error } = await supabase
        .from('inventory_logs')
        .update({ memo: newMemo })
        .eq('id', log.id);
      if (error) throw error;
      showCustomToast('이력이 수정되었습니다.');
      await fetchInventoryLogs();
    } catch (err: any) {
      alert('이력 수정 실패: ' + err.message);
    }
  };

  const handleDeleteLog = async (logId: string | number) => {
    if (!isAdmin) {
      alert('관리자 권한이 있는 인원만 삭제할 수 있습니다.');
      return;
    }
    if (!confirm('정말 이 이력을 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('inventory_logs')
        .delete()
        .eq('id', logId);
      if (error) throw error;
      showCustomToast('이력이 삭제되었습니다.');
      await fetchInventoryLogs();
    } catch (err: any) {
      alert('이력 삭제 실패: ' + err.message);
    }
  };

  // 1. 이력 일괄 삭제 핸들러 (조건 검증: 반납 완료 및 이상없음인 항목만 삭제)
  const handleBatchDeleteLogs = async () => {
    if (!isAdmin) return alert('관리자만 삭제할 수 있습니다.');
    if (selectedLogIds.length === 0) return alert('삭제할 이력을 선택해주세요.');

    // 선택된 로그 중 조건에 위배되는 것(반납 미완료 항목 혹은 이상 발생 항목)이 있는지 체크
    const invalidLogs = inventoryLogs.filter(log => {
      const logTypeStr = log.type as string;
      return (selectedLogIds.includes(String(log.id)) && (logTypeStr === '불출' || log.has_issue));
    });

    if (invalidLogs.length > 0) {
      return alert('선택하신 항목 중 반납이 완료되지 않았거나 이상(Issue)이 발생한 이력이 포함되어 있어 일괄 삭제할 수 없습니다. (정상 처리 및 반납 완료된 항목만 삭제 가능합니다)');
    }

    if (!confirm(`선택한 ${selectedLogIds.length}개의 이력을 삭제하시겠습니까?`)) return;

    try {
      const { error } = await supabase
        .from('inventory_logs')
        .delete()
        .in('id', selectedLogIds);
      if (error) throw error;

      showCustomToast('선택된 이력이 삭제되었습니다.');
      setSelectedLogIds([]);
      await fetchInventoryLogs();
    } catch (err: any) {
      alert('일괄 삭제 실패: ' + err.message);
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

  const handleSubmitStockLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetItem || logQty <= 0) return alert('유효한 수량을 입력해주세요.');

    const isUsageType = logType === '불출' || logType === '소모성 사용';

    if (isUsageType && targetItem.quantity < logQty) {
      return alert(`가능한 수량을 초과했습니다. (현재 재고: ${targetItem.quantity}${targetItem.unit})`);
    }

    const newQty = isUsageType ? targetItem.quantity - logQty : targetItem.quantity + logQty;
    const targetTableName = targetItem.type === 'CABIN' ? 'cabin_inventory' : 'inventory';

    // DB에 저장될 실제 log_type (소모성 자재인 경우 '소모성 사용'으로 기록)
    const actualLogType = targetItem.type === '소모성' ? '소모성 사용' : logType;

    try {
      const { error: invErr } = await supabase
        .from(targetTableName)
        .update({ quantity: newQty, updated_at: new Date().toISOString() })
        .eq('id', targetItem.id);
      if (invErr) throw invErr;

      const { error: logErr } = await supabase.from('inventory_logs').insert([{
        inventory_id: targetItem.id,
        item_name: targetItem.name,
        type: actualLogType,
        quantity: logQty,
        worker_name: currentUser?.name || '작업자',
        has_issue: targetItem.type === '소모성' ? false : logHasIssue,
        memo: logMemo
      }]);
      if (logErr) throw logErr;

      showCustomToast(`자재 ${actualLogType} 처리가 완료되었습니다.`);
      setShowLogSheet(false);
      if (targetItem.type === 'CABIN') {
        await fetchCabinInventory();
      } else {
        await fetchInventory();
      }
      await fetchInventoryLogs();
    } catch (err: any) {
      alert('처리 중 오류 발생: ' + err.message);
    }
  };

  const filteredInventory = useMemo(() => {
    if (inventoryTab === 'CABIN') {
      return cabinInventoryList.filter(item => item.category === selectedCabinSubCategory);
    }

    if (inventoryTab === '소모성') {
      const consumables = inventoryList.filter(i => i.type === '소모성');
      return consumables.filter(item => item.category === selectedConsumableCategory);
    }

    const baseFixed = inventoryList.filter(i => i.type === '고정');

    return baseFixed.filter(item => {
      const cat = item.category || '';
      const name = item.name || '';
      const vbtType = item.vbt_type || '';
      const { calDate, nextCalDate } = parseCalDates(item.sub_equipment);

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

      return cat === selectedFixedSubCategory;
    });
  }, [inventoryTab, inventoryList, cabinInventoryList, selectedConsumableCategory, selectedFixedSubCategory, selectedVbtSubCategory, selectedCabinSubCategory]);

  const currentActiveSubCatName = getCurrentSelectedCategory();
  const isCurrentSubCatCollapsed = !!collapsedSubTabs[currentActiveSubCatName];

  return (
    <div className="min-h-screen bg-[#F5F6F8] text-[#1F2937] p-2 sm:p-4 space-y-3 font-sans border-box relative">
      
      {/* 상단 커스텀 토스트 알림 배너 */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-[#243B5A] text-white px-4 py-2.5 rounded-lg shadow-xl flex items-center space-x-2 text-xs font-semibold border border-slate-600 transition animate-bounce">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 상단 타이틀 영역 */}
      <div className="bg-white p-3 rounded-lg border border-[#E2E5E9] shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-[#243B5A]">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#1F2937]">기자재 및 소모성 자재 관리 시스템</h1>
            <p className="text-[11px] text-[#64748B]">고정 기자재, 소모품 및 CABIN 자재 통합 관리</p>
          </div>
        </div>
      </div>

      {/* 교정 예정 알림 Banner */}
      {calibrationAlertItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg overflow-hidden shadow-2xs">
          <button
            onClick={() => setIsAlertBannerOpen(!isAlertBannerOpen)}
            className="w-full px-3 py-2 flex items-center justify-between text-amber-900 font-semibold text-xs bg-amber-100/60 hover:bg-amber-100 transition"
          >
            <div className="flex items-center space-x-2">
              <Bell className="h-4 w-4 text-amber-600" />
              <span>교정 예정 장비가 <strong className="text-amber-800 font-bold">{calibrationAlertItems.length}건</strong> 점검 필요 상태입니다. (30일 이내)</span>
            </div>
            {isAlertBannerOpen ? <ChevronUp className="h-4 w-4 text-amber-600" /> : <ChevronDown className="h-4 w-4 text-amber-600" />}
          </button>

          {isAlertBannerOpen && (
            <div className="p-2.5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs border-t border-amber-200/60 bg-white">
              {calibrationAlertItems.map(({ item, daysLeft, nextCalDate }) => (
                <div 
                  key={item.id} 
                  onClick={() => setSelectedDetailItem(item)}
                  className="p-2 bg-[#F5F6F8] rounded-md border border-[#E2E5E9] flex justify-between items-center cursor-pointer hover:border-amber-400 transition"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center space-x-1 mb-0.5">
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-mono font-bold px-1 py-0.2 rounded">{item.code}</span>
                      <span className="font-semibold text-[#1F2937] truncate text-xs">{item.name}</span>
                    </div>
                    <span className="text-[10px] text-[#64748B] block">만료 예정: {nextCalDate}</span>
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
            onClick={() => setInventoryTab('고정')}
            className={`flex-1 sm:flex-none flex items-center justify-center space-x-1 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              inventoryTab === '고정' ? 'bg-[#243B5A] text-white shadow-2xs' : 'text-[#64748B] hover:text-[#1F2937]'
            }`}
          >
            <Lock className="h-3.5 w-3.5" />
            <span>기자재</span>
          </button>
          <button
            onClick={() => setInventoryTab('소모성')}
            className={`flex-1 sm:flex-none flex items-center justify-center space-x-1 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              inventoryTab === '소모성' ? 'bg-[#243B5A] text-white shadow-2xs' : 'text-[#64748B] hover:text-[#1F2937]'
            }`}
          >
            <Box className="h-3.5 w-3.5" />
            <span>소모성 자재</span>
          </button>
          <button
            onClick={() => setInventoryTab('CABIN')}
            className={`flex-1 sm:flex-none flex items-center justify-center space-x-1 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              inventoryTab === 'CABIN' ? 'bg-[#243B5A] text-white shadow-2xs' : 'text-[#64748B] hover:text-[#1F2937]'
            }`}
          >
            <Compass className="h-3.5 w-3.5" />
            <span>CABIN</span>
          </button>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenInventoryCreate}
            className="w-full sm:w-auto flex items-center justify-center space-x-1 bg-[#243B5A] hover:bg-[#1d3049] text-white px-3 py-1.5 rounded-lg transition font-medium text-xs shadow-2xs"
          >
            <Plus className="h-4 w-4" />
            <span>신규 자재 등록</span>
          </button>
        )}
      </div>

      {/* 서브 카테고리 탭 영역 */}
      <div className="bg-white px-2.5 py-2 rounded-lg border border-[#E2E5E9] shadow-2xs flex items-center justify-between gap-2">
        <div 
          className="flex items-center gap-1.5 overflow-x-auto flex-1 py-0.5"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#CBD5E1 transparent' }}
        >
          {getCurrentSubCategories().map((cat) => {
            const isSelected = getCurrentSelectedCategory() === cat;
            const isCalib = cat === '교정';

            return (
              <button
                key={cat}
                onClick={() => {
                  setCurrentSelectedCategory(cat);
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
            title="서브 카테고리 관리"
          >
            <Settings className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* VBT 상세 서브탭 */}
      {inventoryTab === '고정' && selectedFixedSubCategory === 'VBT' && (
        <div className="bg-white p-1.5 rounded-lg border border-[#E2E5E9] flex overflow-x-auto gap-1 shadow-2xs">
          {(['1L', '1S', '2L', '2S', 'FLAT', '기타'] as VbtSubCategory[]).map((subCat) => (
            <button
              key={subCat}
              onClick={() => setSelectedVbtSubCategory(subCat)}
              className={`flex-1 min-w-[50px] py-1 rounded-md text-[11px] font-semibold transition shrink-0 ${
                selectedVbtSubCategory === subCat ? 'bg-slate-700 text-white shadow-2xs' : 'bg-[#F5F6F8] text-[#64748B]'
              }`}
            >
              {subCat}
            </button>
          ))}
        </div>
      )}

      {/* 서브탭 통합 내용 접기/펴기 헤더 바 */}
      <div className="bg-white rounded-lg border border-[#E2E5E9] p-3 flex items-center justify-between shadow-2xs">
        <div className="flex items-center space-x-2 text-xs font-bold text-[#1F2937]">
          <Package className="h-4 w-4 text-[#243B5A]" />
          <span>서브탭 [{currentActiveSubCatName}] 목록 영역</span>
          <span className="text-[10px] bg-[#F5F6F8] border border-[#E2E5E9] px-2 py-0.5 rounded-full text-[#64748B]">
            총 {filteredInventory.length}건
          </span>
        </div>
        <button
          onClick={() => toggleSubTabContent(currentActiveSubCatName)}
          className="flex items-center space-x-1 text-xs font-semibold text-[#243B5A] bg-[#F5F6F8] hover:bg-[#E2E5E9] px-3 py-1 rounded border border-[#E2E5E9] transition"
        >
          <span>{isCurrentSubCatCollapsed ? '서브탭 내용 펼치기' : '서브탭 내용 접기'}</span>
          {isCurrentSubCatCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* 서브탭 통합 내용 목록 영역 */}
      {!isCurrentSubCatCollapsed && (
        <div>
          {loadingInventory || (inventoryTab === 'CABIN' && loadingCabin) ? (
            <div className="bg-white rounded-lg border border-[#E2E5E9] text-center py-8 text-xs text-[#64748B]">
              데이터를 불러오는 중입니다...
            </div>
          ) : filteredInventory.length === 0 ? (
            <div className="bg-white rounded-lg p-8 text-center border border-[#E2E5E9] text-[#64748B] text-xs">
              선택한 카테고리에 등록된 자재 항목이 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredInventory.map((item) => {
                const isLowStock = item.type === '소모성' && item.quantity <= (item.min_quantity || 0);
                const { calDate, nextCalDate } = parseCalDates(item.sub_equipment);

                return (
                  <div 
                    key={item.id} 
                    onClick={() => setSelectedDetailItem(item)}
                    className={`bg-white rounded-lg border shadow-2xs transition p-3 flex items-center justify-between gap-2 cursor-pointer hover:border-blue-400 hover:bg-slate-50/50 ${
                      isLowStock ? 'border-red-300 bg-red-50/10' : 'border-[#E2E5E9]'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                      <span className="bg-[#F5F6F8] text-[#243B5A] border border-[#E2E5E9] text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0">
                        {item.code}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-xs font-semibold text-[#1F2937] truncate">{item.name}</h3>
                        <span className="text-[10px] text-[#64748B]">위치: {item.location || '미지정'} {calDate ? `| 교정: ${calDate}` : ''} {nextCalDate ? `(차기: ${nextCalDate})` : ''}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 shrink-0">
                      <div className="text-right">
                        <span className={`text-xs font-bold block ${isLowStock ? 'text-red-600' : 'text-[#1F2937]'}`}>
                          {item.quantity} {item.unit}
                        </span>
                        {isLowStock && <span className="text-[10px] text-red-600 block">재고 부족</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 최근 불출/반납/교정 이력 섹션 */}
      <div className="bg-white rounded-lg border border-[#E2E5E9] shadow-2xs mt-4 overflow-hidden">
        <div className="p-3 flex items-center justify-between bg-[#F5F6F8] border-b border-[#E2E5E9]">
          <button
            onClick={() => setIsHistorySectionOpen(!isHistorySectionOpen)}
            className="flex items-center space-x-2 text-xs font-bold text-[#1F2937] flex-1 text-left"
          >
            <History className="h-4 w-4 text-[#243B5A]" />
            <span>최근 불출 / 반납 / 교정 이력 (매일 23시 초기화 - 미반납/이상발생 보존)</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-white border border-[#E2E5E9] rounded-full text-[#64748B] font-normal">
              {inventoryLogs?.length || 0}건
            </span>
          </button>
          
          <div className="flex items-center space-x-2 shrink-0">
            {isAdmin && inventoryLogs.length > 0 && (
              <button
                onClick={handleBatchDeleteLogs}
                disabled={selectedLogIds.length === 0}
                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white rounded text-[11px] font-semibold transition shadow-2xs"
              >
                선택 일괄 삭제 ({selectedLogIds.length})
              </button>
            )}
            {isHistorySectionOpen ? <ChevronUp className="h-4 w-4 text-[#64748B]" /> : <ChevronDown className="h-4 w-4 text-[#64748B]" />}
          </div>
        </div>

        {isHistorySectionOpen && (
          <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
            {(!inventoryLogs || inventoryLogs.length === 0) ? (
              <p className="text-xs text-[#64748B] text-center py-4">등록된 최근 이력이 없습니다.</p>
            ) : (
              <>
                {isAdmin && (
                  <div className="flex items-center space-x-2 px-2 pb-1 text-[11px] text-[#64748B] border-b border-[#E2E5E9]">
                    <input 
                      type="checkbox" 
                      checked={selectedLogIds.length === inventoryLogs.length && inventoryLogs.length > 0} 
                      onChange={toggleSelectAllLogs}
                      className="accent-[#243B5A] rounded"
                    />
                    <span>전체 선택 (반납 완료 및 정상 항목만 일괄 삭제 가능)</span>
                  </div>
                )}

                {inventoryLogs.map((log) => {
                  const isChecked = selectedLogIds.includes(String(log.id));

                  return (
                    <div key={log.id} className="bg-[#F5F6F8] rounded-md border border-[#E2E5E9] p-2.5 text-xs flex items-center justify-between gap-3">
                      
                      <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                        {isAdmin && (
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            onChange={() => toggleSelectLog(log.id)}
                            className="accent-[#243B5A] rounded shrink-0"
                          />
                        )}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                          log.type === '불출' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : log.type === '반납' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : log.type === '소모성 사용' 
                            ? 'bg-orange-100 text-orange-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {log.type}
                        </span>
                        <div className="min-w-0 flex items-center space-x-1.5">
                          <span className="font-bold text-[#1F2937] truncate">{log.item_name}</span>
                          {/* 반납 완료인 경우 품목명 옆에 '반납완료' 표시 */}
                          {log.type === '반납' && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded shrink-0">
                              반납완료
                            </span>
                          )}
                          <span className="text-xs font-semibold text-[#243B5A]">({log.quantity}개)</span>
                        </div>
                        <span className="text-[10px] text-[#64748B] truncate hidden sm:inline">
                          작업자: {log.worker_name} ({new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}) {log.memo ? `| ${log.memo}` : ''}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        {log.has_issue ? (
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">
                            ⚠️ 이상발생
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-600 font-medium">정상</span>
                        )}

                        {log.type === '불출' && (
                          <button
                            onClick={() => handleQuickReturnFromHistory(log)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-semibold shadow-2xs transition"
                          >
                            반납
                          </button>
                        )}

                        {isAdmin && (
                          <div className="flex items-center space-x-1 pl-2 border-l border-[#E2E5E9]">
                            <button
                              onClick={() => handleEditLog(log)}
                              className="px-1.5 py-0.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-[10px] font-semibold transition"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => handleDeleteLog(log.id)}
                              className="px-1.5 py-0.5 bg-red-50 text-red-600 hover:bg-red-100 rounded text-[10px] font-semibold transition"
                            >
                              삭제
                            </button>
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      {/* 서브 카테고리 관리 모달 */}
      {isSubCatModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-3">
          <div className="bg-white border border-[#E2E5E9] rounded-lg max-w-md w-full p-4 shadow-xl space-y-3">
            <div className="flex justify-between items-center border-b border-[#E2E5E9] pb-2">
              <h2 className="text-xs font-bold text-[#1F2937] flex items-center gap-1.5">
                <Settings className="h-4 w-4 text-[#243B5A]" /> [{inventoryTab}] 서브 카테고리 설정
              </h2>
              <button onClick={() => setIsSubCatModalOpen(false)} className="p-1 text-[#64748B] hover:text-[#1F2937] rounded-md">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="새 카테고리 입력"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="flex-1 px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] text-[#1F2937] text-xs rounded-md"
              />
              <button onClick={handleAddCategory} className="px-3 py-1.5 bg-[#243B5A] text-white font-semibold text-xs rounded-md">
                추가
              </button>
            </div>

            <div className="space-y-1 max-h-48 overflow-y-auto">
              {getCurrentSubCategories().map((cat, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-xs">
                  {editingCatIndex === idx ? (
                    <div className="flex gap-1 flex-1 mr-2">
                      <input
                        type="text"
                        value={editingCatName}
                        onChange={(e) => setEditingCatName(e.target.value)}
                        className="flex-1 px-2 py-1 bg-white border border-[#E2E5E9] rounded-md text-xs"
                      />
                      <button onClick={() => handleUpdateCategory(idx)} className="px-2 py-1 bg-emerald-600 text-white rounded-md text-[10px]">저장</button>
                      <button onClick={() => setEditingCatIndex(null)} className="px-2 py-1 bg-gray-200 text-gray-700 rounded-md text-[10px]">취소</button>
                    </div>
                  ) : (
                    <span className="font-semibold text-[#1F2937]">{cat}</span>
                  )}

                  <div className="flex items-center space-x-1">
                    <button onClick={() => handleMoveCategory(idx, 'left')} disabled={idx === 0} className="p-1 text-gray-500 disabled:opacity-30">
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleMoveCategory(idx, 'right')} disabled={idx === getCurrentSubCategories().length - 1} className="p-1 text-gray-500 disabled:opacity-30">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => { setEditingCatIndex(idx); setEditingCatName(cat); }} className="p-1 text-blue-600">
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button onClick={() => handleDeleteCategory(idx)} className="p-1 text-red-600">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-[#E2E5E9] text-right">
              <button onClick={() => setIsSubCatModalOpen(false)} className="px-3 py-1.5 bg-white border border-[#E2E5E9] rounded-md text-xs font-semibold">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 자재 상세 보기 바텀시트 */}
      {selectedDetailItem && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-3">
          <div className="bg-white border border-[#E2E5E9] rounded-t-xl sm:rounded-lg max-w-md w-full p-4 shadow-2xl text-[#1F2937]">
            <div className="flex justify-between items-start mb-2 pb-2 border-b border-[#E2E5E9]">
              <div>
                <div className="flex items-center space-x-1 mb-1">
                  <span className="bg-[#243B5A] text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded">
                    {selectedDetailItem.code}
                  </span>
                  <span className="bg-[#F5F6F8] text-[#64748B] border border-[#E2E5E9] text-[10px] font-semibold px-1.5 py-0.5 rounded">
                    {selectedDetailItem.category}
                  </span>
                </div>
                <h2 className="text-sm font-bold text-[#1F2937]">{selectedDetailItem.name}</h2>
              </div>
              <button onClick={() => setSelectedDetailItem(null)} className="p-1 text-[#64748B] hover:text-[#1F2937]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs mb-3">
              <div className="bg-[#F5F6F8] p-2.5 rounded-md border border-[#E2E5E9] flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-[#64748B] block">현재 보유 재고</span>
                  <p className="text-base font-bold text-[#243B5A]">
                    {selectedDetailItem.quantity} <span className="text-xs font-normal text-[#64748B]">{selectedDetailItem.unit}</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#64748B] block">보관 위치</span>
                  <p className="font-semibold text-[#1F2937] flex items-center justify-end gap-1 mt-0.5">
                    <MapPin className="h-3 w-3 text-[#243B5A]" /> {selectedDetailItem.location || '미지정'}
                  </p>
                </div>
              </div>

              {(selectedDetailItem.type === '고정' || selectedDetailItem.type === 'CABIN') && (
                <div className="bg-[#F5F6F8] p-2.5 rounded-md border border-[#E2E5E9] space-y-1">
                  <div className="flex justify-between text-[#64748B]">
                    <span>최근 교정일</span>
                    <span className="font-semibold text-[#1F2937]">{parseCalDates(selectedDetailItem.sub_equipment).calDate || '-'}</span>
                  </div>
                  <div className="flex justify-between text-amber-800 font-semibold pt-1 border-t border-[#E2E5E9]">
                    <span>차기 교정일</span>
                    <span>{parseCalDates(selectedDetailItem.sub_equipment).nextCalDate || '-'}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex space-x-2">
                <button
                  onClick={() => handleOpenLogModal(selectedDetailItem, selectedDetailItem.type === '소모성' ? '소모성 사용' : '불출')}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-md flex items-center justify-center space-x-1 text-xs"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  <span>{selectedDetailItem.type === '소모성' ? '소모성 사용 처리' : '불출 처리'}</span>
                </button>
                {selectedDetailItem.type !== '소모성' && (
                  <button
                    onClick={() => handleOpenLogModal(selectedDetailItem, '반납')}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md flex items-center justify-center space-x-1 text-xs"
                  >
                    <ArrowDownRight className="h-3.5 w-3.5" />
                    <span>반납 처리</span>
                  </button>
                )}
              </div>

              {isAdmin && (
                <div className="flex space-x-2 pt-1.5 border-t border-[#E2E5E9]">
                  <button
                    onClick={() => handleOpenInventoryEdit(selectedDetailItem)}
                    className="flex-1 py-1.5 bg-white border border-[#E2E5E9] hover:bg-[#F5F6F8] text-[#1F2937] font-medium rounded-md flex items-center justify-center space-x-1 text-xs"
                  >
                    <Pencil className="h-3 w-3" />
                    <span>수정</span>
                  </button>
                  <button
                    onClick={() => handleDeleteInventory(selectedDetailItem)}
                    className="flex-1 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-medium rounded-md flex items-center justify-center space-x-1 text-xs"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>삭제</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 불출/반납 폼 모달 */}
      {showLogSheet && targetItem && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-3">
          <div className="bg-white border border-[#E2E5E9] rounded-t-xl sm:rounded-lg max-w-md w-full p-4 shadow-2xl text-[#1F2937]">
            <div className="flex justify-between items-center mb-1">
              <h2 className="text-xs font-bold text-[#1F2937]">자재 {logType} 처리</h2>
              <button onClick={() => setShowLogSheet(false)} className="p-1 text-[#64748B]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[11px] text-[#64748B] mb-2.5">[{targetItem.code}] {targetItem.name}</p>

            <form onSubmit={handleSubmitStockLog} className="space-y-2.5 text-xs">
              <div>
                <label className="block text-[#64748B] font-medium mb-1">{logType} 수량 ({targetItem.unit})</label>
                <input 
                  type="number" 
                  min="1" 
                  max={(logType === '불출' || logType === '소모성 사용') ? targetItem.quantity : undefined} 
                  required 
                  value={logQty} 
                  onChange={(e) => setLogQty(Number(e.target.value))} 
                  className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md font-bold text-[#1F2937]" 
                />
              </div>

              {logType === '반납' && (
                <div className="flex items-center space-x-2 bg-red-50 p-2 rounded-md border border-red-200">
                  <input type="checkbox" id="hasIssue" checked={logHasIssue} onChange={(e) => setLogHasIssue(e.target.checked)} className="h-3.5 w-3.5 accent-red-600 rounded" />
                  <label htmlFor="hasIssue" className="text-red-600 font-semibold cursor-pointer text-[11px]">자재 파손 및 이상 발생 시 체크</label>
                </div>
              )}

              <div>
                <label className="block text-[#64748B] font-medium mb-1">메모 / 작업내용</label>
                <textarea rows={2} value={logMemo} onChange={(e) => setLogMemo(e.target.value)} className="w-full px-2.5 py-1 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937] resize-none" />
              </div>

              <div className="pt-1 flex space-x-2">
                <button type="button" onClick={() => setShowLogSheet(false)} className="flex-1 py-1.5 bg-white border border-[#E2E5E9] rounded-md font-semibold">취소</button>
                <button type="submit" className={`flex-1 py-1.5 text-white font-semibold rounded-md ${logType === '반납' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>{logType} 완료</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 신규 등록/수정 모달 */}
      {showInventorySheet && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-3">
          <div className="bg-white border border-[#E2E5E9] rounded-t-xl sm:rounded-lg max-w-lg w-full p-4 shadow-2xl max-h-[85vh] overflow-y-auto text-[#1F2937]">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xs font-bold text-[#1F2937]">{editingItem ? '자재 정보 수정' : '신규 자재 등록'}</h2>
              <button onClick={() => setShowInventorySheet(false)} className="p-1 text-[#64748B]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitInventory} className="space-y-2.5 text-xs">
              <div>
                <label className="block text-[#64748B] font-semibold mb-1">자재 구별</label>
                <div className="flex space-x-1 bg-[#F5F6F8] p-1 rounded-md border border-[#E2E5E9]">
                  {(['고정', '소모성', 'CABIN'] as MainTab[]).map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => {
                        setItemType(tab);
                        if (tab !== '고정') setItemVbtType('');
                      }}
                      className={`flex-1 py-1 rounded font-semibold transition ${itemType === tab ? 'bg-[#243B5A] text-white shadow-2xs' : 'text-[#64748B]'}`}
                    >
                      {tab === '고정' ? '기자재' : tab === '소모성' ? '소모성 자재' : 'CABIN'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#64748B] font-semibold mb-1">자재 코드 *</label>
                  <input type="text" required value={itemCode} onChange={e => setItemCode(e.target.value)} className="w-full px-2 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md font-mono text-[#1F2937]" />
                </div>
                <div>
                  <label className="block text-[#64748B] font-semibold mb-1">카테고리 *</label>
                  <input type="text" required value={itemCategory} onChange={e => setItemCategory(e.target.value)} className="w-full px-2 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]" />
                </div>
              </div>

              <div>
                <label className="block text-[#64748B] font-semibold mb-1">자재명 *</label>
                <input type="text" required value={itemName} onChange={e => setItemName(e.target.value)} className="w-full px-2 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]" />
              </div>

              {itemType === '고정' && itemCategory === 'VBT' && (
                <div>
                  <label className="block text-[#243B5A] font-semibold mb-1">VBT 규격/종류 선택</label>
                  <select 
                    value={itemVbtType} 
                    onChange={e => setItemVbtType(e.target.value)}
                    className="w-full px-2 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md font-semibold text-[#1F2937]"
                  >
                    <option value="">미선택 (기타)</option>
                    <option value="1L">1L</option>
                    <option value="1S">1S</option>
                    <option value="2L">2L</option>
                    <option value="2S">2S</option>
                    <option value="FLAT">FLAT</option>
                  </select>
                </div>
              )}

              {(itemType === '고정' || itemType === 'CABIN') && (
                <div className="grid grid-cols-2 gap-2 bg-[#F5F6F8] p-2 rounded-md border border-[#E2E5E9]">
                  <div>
                    <label className="block text-[#64748B] font-semibold mb-1">교정일</label>
                    <input type="date" value={itemCalDate} onChange={e => setItemCalDate(e.target.value)} className="w-full px-2 py-1 bg-white border border-[#E2E5E9] rounded text-[#1F2937]" />
                  </div>
                  <div>
                    <label className="block text-amber-800 font-semibold mb-1">차기 교정일</label>
                    <input type="date" value={itemNextCalDate} onChange={e => setItemNextCalDate(e.target.value)} className="w-full px-2 py-1 bg-white border border-[#E2E5E9] rounded text-amber-900" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[#64748B] font-semibold mb-1">수량</label>
                  <input type="number" min="0" value={itemQuantity} onChange={e => setItemQuantity(Number(e.target.value))} className="w-full px-2 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]" />
                </div>
                <div>
                  <label className="block text-red-600 font-semibold mb-1">최소 재고</label>
                  <input type="number" min="0" value={itemMinQty} onChange={e => setItemMinQty(Number(e.target.value))} className="w-full px-2 py-1.5 bg-[#F5F6F8] border border-red-200 rounded-md text-red-600 font-bold" />
                </div>
                <div>
                  <label className="block text-[#64748B] font-semibold mb-1">단위</label>
                  <input type="text" value={itemUnit} onChange={e => setItemUnit(e.target.value)} className="w-full px-2 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]" />
                </div>
              </div>

              <div>
                <label className="block text-[#64748B] font-semibold mb-1">보관 위치</label>
                <input type="text" value={itemLocation} onChange={e => setItemLocation(e.target.value)} className="w-full px-2 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-md text-[#1F2937]" />
              </div>

              <div className="pt-2 flex gap-2">
                <button type="button" onClick={() => setShowInventorySheet(false)} className="flex-1 py-1.5 bg-white border border-[#E2E5E9] font-semibold rounded-md">취소</button>
                <button type="submit" className="flex-1 py-1.5 bg-[#243B5A] text-white font-semibold rounded-md shadow-2xs">저장</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
