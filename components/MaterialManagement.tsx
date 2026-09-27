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
  Settings
} from 'lucide-react';
import { supabase, AppUser } from '@/lib/supabase';
import { InventoryItem, InventoryLog } from '@/lib/types';

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

  // VBT 서브 탭 (기자재 내 VBT 전용)
  const [selectedVbtSubCategory, setSelectedVbtSubCategory] = useState<VbtSubCategory>('1L');

  // 서브 카테고리 관리 모달 제어 상태
  const [isSubCatModalOpen, setIsSubCatModalOpen] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>('');
  const [editingCatIndex, setEditingCatIndex] = useState<number | null>(null);
  const [editingCatName, setEditingCatName] = useState<string>('');

  // UI 제어 상태
  const [isAlertBannerOpen, setIsAlertBannerOpen] = useState(true);
  const [selectedDetailItem, setSelectedDetailItem] = useState<InventoryItem | null>(null);
  const [showInventorySheet, setShowInventorySheet] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  
  const [showLogSheet, setShowLogSheet] = useState(false);
  const [targetItem, setTargetItem] = useState<InventoryItem | null>(null);
  const [logType, setLogType] = useState<'불출' | '반납'>('불출');
  const [logQty, setLogQty] = useState<number>(1);
  const [logHasIssue, setLogHasIssue] = useState<boolean>(false);
  const [logMemo, setLogMemo] = useState('');

  // 차기 교정일 알림 항목
  const [calibrationAlertItems, setCalibrationAlertItems] = useState<{ item: InventoryItem; daysLeft: number; calDate: string; nextCalDate: string }[]>([]);

  // 교정일 알림 동기화
  useEffect(() => {
    if (!inventoryList || inventoryList.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingCalibrations: { item: InventoryItem; daysLeft: number; calDate: string; nextCalDate: string }[] = [];

    inventoryList.forEach((item) => {
      if (item.type !== '고정' && item.type !== 'CABIN') return;

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

          if (diffDays <= 15) {
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
  }, [inventoryList]);

  const parseCalDates = (subEquipment: string | null) => {
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

  // 현재 선택된 탭의 서브 카테고리 접근 헬퍼
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

  // 서브 카테고리 추가/수정/삭제/이동 핸들러
  const handleAddCategory = () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return alert('카테고리 이름을 입력하세요.');
    const list = getCurrentSubCategories();
    if (list.includes(trimmed)) return alert('이미 존재하는 카테고리입니다.');
    
    setCurrentSubCategories([...list, trimmed]);
    setNewCatName('');
  };

  const handleUpdateCategory = (index: number) => {
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
    if (!isAdmin) return alert('권한이 없습니다.');
    if (!itemName.trim() || !itemCode.trim()) return alert('필수 항목을 입력해주세요.');

    const subEquipValue = itemCalDate.trim() 
      ? (itemNextCalDate.trim() ? `${itemCalDate.trim()} | ${itemNextCalDate.trim()}` : itemCalDate.trim())
      : null;

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
        const { error } = await supabase.from('inventory').update(payload).eq('id', editingItem.id);
        if (error) throw error;
        alert('자재 정보가 수정되었습니다.');
      } else {
        const { error } = await supabase.from('inventory').insert([payload]);
        if (error) throw error;
        alert('신규 자재가 등록되었습니다.');
      }

      setShowInventorySheet(false);
      await fetchInventory();
    } catch (err: any) {
      alert('데이터베이스 저장 실패: ' + err.message);
    }
  };

  const handleDeleteInventory = async (item: InventoryItem) => {
    if (!isAdmin) return alert('삭제 권한이 없습니다.');
    if (!confirm('정말로 이 자재를 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase.from('inventory').delete().eq('id', item.id);
      if (error) throw error;

      setSelectedDetailItem(null);
      setShowInventorySheet(false);
      alert('자재가 삭제되었습니다.');
      await fetchInventory();
    } catch (err: any) {
      alert('삭제 실패: ' + err.message);
    }
  };

  const handleOpenLogModal = (item: InventoryItem, type: '불출' | '반납') => {
    setSelectedDetailItem(null);
    setTargetItem(item);
    setLogType(type);
    setLogQty(1);
    setLogHasIssue(false);
    setLogMemo('');
    setShowLogSheet(true);
  };

  const handleSubmitStockLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetItem || logQty <= 0) return alert('유효한 수량을 입력해주세요.');

    if (logType === '불출' && targetItem.quantity < logQty) {
      return alert(`불출 가능 수량을 초과했습니다. (현재 재고: ${targetItem.quantity}${targetItem.unit})`);
    }

    const newQty = logType === '불출' ? targetItem.quantity - logQty : targetItem.quantity + logQty;

    try {
      const { error: invErr } = await supabase
        .from('inventory')
        .update({ quantity: newQty, updated_at: new Date().toISOString() })
        .eq('id', targetItem.id);
      if (invErr) throw invErr;

      const { error: logErr } = await supabase.from('inventory_logs').insert([{
        inventory_id: targetItem.id,
        item_name: targetItem.name,
        type: logType,
        quantity: logQty,
        worker_name: currentUser?.name || '작업자',
        has_issue: logHasIssue,
        memo: logMemo
      }]);
      if (logErr) throw logErr;

      alert(`자재 ${logType} 처리가 완료되었습니다.`);
      setShowLogSheet(false);
      await fetchInventory();
      await fetchInventoryLogs();
    } catch (err: any) {
      alert('처리 중 오류 발생: ' + err.message);
    }
  };

  // 탭별 & 카테고리별 필터링 로직
  const filteredInventory = useMemo(() => {
    if (inventoryTab === 'CABIN') {
      const cabinList = inventoryList.filter(i => i.type === 'CABIN');
      return cabinList.filter(item => item.category === selectedCabinSubCategory);
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
  }, [inventoryTab, inventoryList, selectedConsumableCategory, selectedFixedSubCategory, selectedVbtSubCategory, selectedCabinSubCategory]);

  return (
    <div className="min-h-screen bg-[#F5F6F8] text-[#1F2937] p-4 sm:p-6 space-y-4 font-sans border-box">
      
      {/* 🚀 가장 상단 타이틀 영역 추가 */}
      <div className="bg-white p-4 rounded-xl border border-[#E2E5E9] shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-xl text-[#243B5A]">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#1F2937]">기자재 및 소모성 자재 관리 시스템</h1>
            <p className="text-xs text-[#64748B]">고정 기자재, 소모품 및 CABIN 자재 통합 관리</p>
          </div>
        </div>
      </div>

      {/* 교정 예정 알림 Banner */}
      {calibrationAlertItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden shadow-xs">
          <button
            onClick={() => setIsAlertBannerOpen(!isAlertBannerOpen)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-amber-900 font-semibold text-xs bg-amber-100/60 hover:bg-amber-100 transition"
          >
            <div className="flex items-center space-x-2">
              <Bell className="h-4 w-4 text-amber-600" />
              <span>교정 예정 장비가 <strong className="text-amber-800 font-bold">{calibrationAlertItems.length}건</strong> 점검 필요 상태입니다.</span>
            </div>
            {isAlertBannerOpen ? <ChevronUp className="h-4 w-4 text-amber-600" /> : <ChevronDown className="h-4 w-4 text-amber-600" />}
          </button>

          {isAlertBannerOpen && (
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs border-t border-amber-200/60 bg-white">
              {calibrationAlertItems.map(({ item, daysLeft, nextCalDate }) => (
                <div 
                  key={item.id} 
                  onClick={() => setSelectedDetailItem(item)}
                  className="p-2.5 bg-[#F5F6F8] rounded-lg border border-[#E2E5E9] flex justify-between items-center cursor-pointer hover:border-amber-400 transition"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center space-x-1 mb-0.5">
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded">{item.code}</span>
                      <span className="font-semibold text-[#1F2937] truncate text-xs">{item.name}</span>
                    </div>
                    <span className="text-[11px] text-[#64748B] block">만료 예정: {nextCalDate}</span>
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

      {/* 상단 메인 헤더 & 메인 탭 */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        {/* Main Tab Segmented Control */}
        <div className="flex bg-[#E2E5E9]/60 p-1 rounded-xl border border-[#E2E5E9] w-full sm:w-auto">
          <button
            onClick={() => setInventoryTab('고정')}
            className={`flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              inventoryTab === '고정' 
                ? 'bg-[#243B5A] text-white shadow-xs' 
                : 'text-[#64748B] hover:text-[#1F2937] hover:bg-white/50'
            }`}
          >
            <Lock className="h-3.5 w-3.5" />
            <span>기자재</span>
          </button>
          <button
            onClick={() => setInventoryTab('소모성')}
            className={`flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              inventoryTab === '소모성' 
                ? 'bg-[#243B5A] text-white shadow-xs' 
                : 'text-[#64748B] hover:text-[#1F2937] hover:bg-white/50'
            }`}
          >
            <Box className="h-3.5 w-3.5" />
            <span>소모성 자재</span>
          </button>
          <button
            onClick={() => setInventoryTab('CABIN')}
            className={`flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              inventoryTab === 'CABIN' 
                ? 'bg-[#243B5A] text-white shadow-xs' 
                : 'text-[#64748B] hover:text-[#1F2937] hover:bg-white/50'
            }`}
          >
            <Compass className="h-3.5 w-3.5" />
            <span>CABIN</span>
          </button>
        </div>

        {/* Primary Navy Action Button */}
        {isAdmin && (
          <button
            onClick={handleOpenInventoryCreate}
            className="w-full sm:w-auto flex items-center justify-center space-x-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white px-4 py-2 rounded-lg transition font-medium text-xs shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>신규 자재 등록</span>
          </button>
        )}
      </div>

      {/* 서브 카테고리 탭 영역 */}
      <div className="bg-white px-3 py-3 rounded-xl border border-[#E2E5E9] shadow-xs flex items-center justify-between gap-3">
        <div 
          className="flex items-center gap-2 overflow-x-auto flex-1 py-1"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#CBD5E1 transparent',
          }}
        >
          <style jsx>{`
            div::-webkit-scrollbar {
              height: 2px;
            }
            div::-webkit-scrollbar-track {
              background: transparent;
            }
            div::-webkit-scrollbar-thumb {
              background: #CBD5E1;
              border-radius: 9999px;
            }
            div::-webkit-scrollbar-thumb:hover {
              background: #94A3B8;
            }
          `}</style>
          
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
                className={`px-3.5 py-2 rounded-md text-xs font-medium whitespace-nowrap transition shrink-0 ${
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
            className="p-2 bg-[#F5F6F8] text-[#64748B] hover:text-[#1F2937] hover:bg-[#E2E5E9] rounded-md border border-[#E2E5E9] shrink-0 transition"
            title={`${inventoryTab} 서브 카테고리 관리`}
          >
            <Settings className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* VBT 상세 서브탭 (기자재 전용) */}
      {inventoryTab === '고정' && selectedFixedSubCategory === 'VBT' && (
        <div 
          className="bg-white p-2 rounded-xl border border-[#E2E5E9] flex overflow-x-auto gap-1.5 shadow-2xs"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#CBD5E1 transparent',
          }}
        >
          {(['1L', '1S', '2L', '2S', 'FLAT', '기타'] as VbtSubCategory[]).map((subCat) => (
            <button
              key={subCat}
              onClick={() => setSelectedVbtSubCategory(subCat)}
              className={`flex-1 min-w-[60px] py-1.5 rounded-md text-[11px] font-semibold transition shrink-0 ${
                selectedVbtSubCategory === subCat
                  ? 'bg-slate-700 text-white shadow-2xs'
                  : 'bg-[#F5F6F8] text-[#64748B] hover:bg-[#E2E5E9] hover:text-[#1F2937]'
              }`}
            >
              {subCat}
            </button>
          ))}
        </div>
      )}

      {/* 콘텐츠 영역 - 반응형 테이블 (데스크톱) / 메탈 카드 (모바일) */}
      {loadingInventory ? (
        <div className="bg-white rounded-xl border border-[#E2E5E9] text-center py-12 text-xs text-[#64748B]">
          데이터를 불러오는 중입니다...
        </div>
      ) : filteredInventory.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-[#E2E5E9] text-[#64748B] text-xs">
          선택한 카테고리에 등록된 자재 항목이 없습니다.
        </div>
      ) : (
        <>
          {/* 데스크톱 전용 Modern SaaS Table */}
          <div className="hidden sm:block bg-white border border-[#E2E5E9] rounded-xl shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F5F6F8] border-b border-[#E2E5E9] text-[#64748B] font-semibold">
                  <th className="py-3 px-4">자재코드</th>
                  <th className="py-3 px-4">자재명</th>
                  <th className="py-3 px-4">카테고리 / 규격</th>
                  <th className="py-3 px-4">위치</th>
                  <th className="py-3 px-4 text-right">보유 수량</th>
                  <th className="py-3 px-4 text-center">상태 / 교정일</th>
                  <th className="py-3 px-4 text-center">상세</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E5E9] text-[#1F2937]">
                {filteredInventory.map((item) => {
                  const isLowStock = item.type === '소모성' && item.quantity <= (item.min_quantity || 0);
                  const { calDate, nextCalDate } = parseCalDates(item.sub_equipment);

                  return (
                    <tr 
                      key={item.id} 
                      onClick={() => setSelectedDetailItem(item)}
                      className="hover:bg-[#F5F6F8]/80 cursor-pointer transition"
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-[#243B5A]">
                        {item.code}
                      </td>
                      <td className="py-3 px-4 font-medium text-[#1F2937]">
                        {item.name}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="bg-[#F5F6F8] text-[#64748B] border border-[#E2E5E9] text-[11px] px-2 py-0.5 rounded-full font-medium">
                            {item.category}
                          </span>
                          {item.vbt_type && item.type === '고정' && (
                            <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[11px] px-2 py-0.5 rounded-full font-bold">
                              {item.vbt_type}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[#64748B]">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-[#64748B]" />
                          {item.location || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold">
                        <span className={isLowStock ? 'text-[#DC2626] font-bold' : 'text-[#1F2937]'}>
                          {item.quantity} <span className="text-[11px] text-[#64748B] font-normal">{item.unit}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isLowStock ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#DC2626] bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="h-3 w-3" /> 재고 부족
                          </span>
                        ) : nextCalDate ? (
                          <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                            차기 교정: {nextCalDate}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#64748B] bg-gray-50 border border-[#E2E5E9] px-2 py-0.5 rounded-full">
                            양호
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center text-[#64748B]">
                        <ChevronRight className="h-4 w-4 inline-block" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 모바일 전용 Corporate Cards */}
          <div className="block sm:hidden space-y-2.5">
            {filteredInventory.map((item) => {
              const isLowStock = item.type === '소모성' && item.quantity <= (item.min_quantity || 0);

              return (
                <div 
                  key={item.id} 
                  onClick={() => setSelectedDetailItem(item)}
                  className={`bg-white rounded-xl border p-3.5 shadow-xs cursor-pointer active:bg-[#F5F6F8] transition flex items-center justify-between gap-2.5 ${
                    isLowStock 
                      ? 'border-red-300 bg-red-50/20' 
                      : 'border-[#E2E5E9]'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    {isLowStock && (
                      <div className="flex items-center space-x-1 mb-1 text-[#DC2626] font-bold text-[10px]">
                        <AlertTriangle className="h-3 w-3" />
                        <span>재고 부족 (최소: {item.min_quantity}{item.unit})</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-1.5 mb-1">
                      <span className="bg-[#F5F6F8] text-[#243B5A] border border-[#E2E5E9] text-[10px] font-mono font-bold px-1.5 py-0.2 rounded">
                        {item.code}
                      </span>
                      {item.vbt_type && item.type === '고정' && (
                        <span className="bg-slate-700 text-white text-[9px] font-semibold px-1.5 py-0.2 rounded">
                          {item.vbt_type}
                        </span>
                      )}
                      <span className="bg-gray-100 text-[#64748B] text-[10px] font-medium px-1.5 py-0.2 rounded">
                        {item.category}
                      </span>
                    </div>
                    <h3 className="text-xs font-semibold text-[#1F2937] truncate">
                      {item.name}
                    </h3>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] text-[#64748B] block">보유량</span>
                      <span className={`text-sm font-bold leading-none block ${isLowStock ? 'text-[#DC2626]' : 'text-[#243B5A]'}`}>
                        {item.quantity} <span className="text-[10px] font-normal text-[#64748B]">{item.unit}</span>
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-[#64748B]" />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 통합 서브 카테고리 관리 모달 */}
      {isSubCatModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#E2E5E9] rounded-xl max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#E2E5E9] pb-3">
              <h2 className="text-sm font-bold text-[#1F2937] flex items-center gap-2">
                <Settings className="h-4 w-4 text-[#243B5A]" /> [{inventoryTab}] 서브 카테고리 설정
              </h2>
              <button 
                onClick={() => setIsSubCatModalOpen(false)} 
                className="p-1 text-[#64748B] hover:text-[#1F2937] hover:bg-[#F5F6F8] rounded-md transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="새 카테고리 입력"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] text-[#1F2937] text-xs rounded-lg focus:bg-white focus:border-[#243B5A] focus:outline-hidden transition"
              />
              <button
                onClick={handleAddCategory}
                className="px-3 py-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white font-semibold text-xs rounded-lg transition shrink-0"
              >
                추가
              </button>
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {getCurrentSubCategories().map((cat, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs">
                  {editingCatIndex === idx ? (
                    <div className="flex gap-1 flex-1 mr-2">
                      <input
                        type="text"
                        value={editingCatName}
                        onChange={(e) => setEditingCatName(e.target.value)}
                        className="flex-1 px-2 py-1 bg-white border border-[#E2E5E9] text-[#1F2937] text-xs rounded-md"
                      />
                      <button onClick={() => handleUpdateCategory(idx)} className="px-2 py-1 bg-[#16A34A] text-white rounded-md text-[11px] font-semibold">저장</button>
                      <button onClick={() => setEditingCatIndex(null)} className="px-2 py-1 bg-[#E2E5E9] text-[#64748B] rounded-md text-[11px]">취소</button>
                    </div>
                  ) : (
                    <span className="font-semibold text-[#1F2937]">{cat}</span>
                  )}

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleMoveCategory(idx, 'left')}
                      disabled={idx === 0}
                      className="p-1 text-[#64748B] hover:text-[#1F2937] disabled:opacity-30"
                      title="위로 이동"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleMoveCategory(idx, 'right')}
                      disabled={idx === getCurrentSubCategories().length - 1}
                      className="p-1 text-[#64748B] hover:text-[#1F2937] disabled:opacity-30"
                      title="아래로 이동"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => { setEditingCatIndex(idx); setEditingCatName(cat); }}
                      className="p-1 text-[#64748B] hover:text-[#2563EB] ml-1"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(idx)}
                      className="p-1 text-[#64748B] hover:text-[#DC2626]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-[#E2E5E9] text-right">
              <button
                onClick={() => setIsSubCatModalOpen(false)}
                className="px-4 py-2 bg-white border border-[#E2E5E9] hover:bg-[#F5F6F8] text-[#1F2937] font-semibold text-xs rounded-lg transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 자재 상세 보기 바텀시트 / 모달 */}
      {selectedDetailItem && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white border border-[#E2E5E9] rounded-t-2xl sm:rounded-xl max-w-md w-full p-5 shadow-2xl text-[#1F2937] animate-in fade-in duration-150">
            <div className="flex justify-between items-start mb-3 pb-2 border-b border-[#E2E5E9]">
              <div>
                <div className="flex items-center space-x-1.5 mb-1">
                  <span className="bg-[#243B5A] text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded">
                    {selectedDetailItem.code}
                  </span>
                  {selectedDetailItem.vbt_type && selectedDetailItem.type === '고정' && (
                    <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold px-1.5 py-0.5 rounded">
                      규격: {selectedDetailItem.vbt_type}
                    </span>
                  )}
                  <span className="bg-[#F5F6F8] text-[#64748B] border border-[#E2E5E9] text-[10px] font-semibold px-1.5 py-0.5 rounded">
                    {selectedDetailItem.category}
                  </span>
                </div>
                <h2 className="text-base font-bold text-[#1F2937]">{selectedDetailItem.name}</h2>
              </div>
              <button 
                onClick={() => setSelectedDetailItem(null)} 
                className="p-1 text-[#64748B] hover:text-[#1F2937] hover:bg-[#F5F6F8] rounded-md transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs mb-4">
              <div className="bg-[#F5F6F8] p-3 rounded-lg border border-[#E2E5E9] flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-[#64748B] block">현재 보유 재고</span>
                  <p className="text-xl font-bold text-[#243B5A]">
                    {selectedDetailItem.quantity} <span className="text-xs font-normal text-[#64748B]">{selectedDetailItem.unit}</span>
                  </p>
                  {selectedDetailItem.type === '소모성' && (
                    <span className="text-[10px] text-[#DC2626] block font-semibold mt-0.5">최소 재고 기준: {selectedDetailItem.min_quantity || 0} {selectedDetailItem.unit}</span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#64748B] block">보관 위치</span>
                  <p className="font-semibold text-[#1F2937] flex items-center justify-end gap-1 mt-0.5">
                    <MapPin className="h-3.5 w-3.5 text-[#243B5A]" /> {selectedDetailItem.location || '미지정'}
                  </p>
                </div>
              </div>

              {(selectedDetailItem.type === '고정' || selectedDetailItem.type === 'CABIN') && (
                <div className="bg-[#F5F6F8] p-3 rounded-lg border border-[#E2E5E9] space-y-1.5">
                  <div className="flex justify-between text-[#64748B]">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3 text-[#243B5A]" /> 최근 교정일</span>
                    <span className="font-semibold text-[#1F2937]">{parseCalDates(selectedDetailItem.sub_equipment).calDate || '-'}</span>
                  </div>
                  <div className="flex justify-between text-amber-800 font-semibold pt-1.5 border-t border-[#E2E5E9]">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3 text-amber-600" /> 차기 교정일</span>
                    <span>{parseCalDates(selectedDetailItem.sub_equipment).nextCalDate || '-'}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex space-x-2">
                <button
                  onClick={() => handleOpenLogModal(selectedDetailItem, '불출')}
                  className="flex-1 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold rounded-lg flex items-center justify-center space-x-1 shadow-2xs text-xs"
                >
                  <ArrowUpRight className="h-4 w-4" />
                  <span>불출 처리</span>
                </button>
                {selectedDetailItem.type !== '소모성' && (
                  <button
                    onClick={() => handleOpenLogModal(selectedDetailItem, '반납')}
                    className="flex-1 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold rounded-lg flex items-center justify-center space-x-1 shadow-2xs text-xs"
                  >
                    <ArrowDownRight className="h-4 w-4" />
                    <span>반납 처리</span>
                  </button>
                )}
              </div>

              {isAdmin && (
                <div className="flex space-x-2 pt-2 border-t border-[#E2E5E9]">
                  <button
                    onClick={() => handleOpenInventoryEdit(selectedDetailItem)}
                    className="flex-1 py-1.5 bg-white border border-[#E2E5E9] hover:bg-[#F5F6F8] text-[#1F2937] font-medium rounded-lg flex items-center justify-center space-x-1 text-xs"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>수정</span>
                  </button>
                  <button
                    onClick={() => handleDeleteInventory(selectedDetailItem)}
                    className="flex-1 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-[#DC2626] font-medium rounded-lg flex items-center justify-center space-x-1 text-xs"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white border border-[#E2E5E9] rounded-t-2xl sm:rounded-xl max-w-md w-full p-5 shadow-2xl text-[#1F2937]">
            <div className="flex justify-between items-center mb-1">
              <h2 className="text-sm font-bold text-[#1F2937]">자재 {logType} 처리</h2>
              <button 
                onClick={() => setShowLogSheet(false)} 
                className="p-1 text-[#64748B] hover:text-[#1F2937] hover:bg-[#F5F6F8] rounded-md transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-[#64748B] mb-3">[{targetItem.code}] {targetItem.name}</p>

            <form onSubmit={handleSubmitStockLog} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#64748B] font-medium mb-1">{logType} 수량 ({targetItem.unit})</label>
                <input 
                  type="number" 
                  min="1" 
                  max={logType === '불출' ? targetItem.quantity : undefined} 
                  required 
                  value={logQty} 
                  onChange={(e) => setLogQty(Number(e.target.value))} 
                  className="w-full px-3 py-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg font-bold text-[#1F2937] focus:bg-white focus:border-[#243B5A] focus:outline-hidden" 
                />
              </div>

              {logType === '반납' && (
                <div className="flex items-center space-x-2 bg-red-50 p-2.5 rounded-lg border border-red-200">
                  <input type="checkbox" id="hasIssue" checked={logHasIssue} onChange={(e) => setLogHasIssue(e.target.checked)} className="h-4 w-4 accent-red-600 rounded" />
                  <label htmlFor="hasIssue" className="text-[#DC2626] font-semibold cursor-pointer">자재 파손 및 이상 발생 시 체크</label>
                </div>
              )}

              <div>
                <label className="block text-[#64748B] font-medium mb-1">메모 / 작업내용</label>
                <textarea rows={2} value={logMemo} onChange={(e) => setLogMemo(e.target.value)} className="w-full px-3 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-[#1F2937] resize-none focus:bg-white focus:border-[#243B5A] focus:outline-hidden" />
              </div>

              <div className="pt-2 flex space-x-2">
                <button type="button" onClick={() => setShowLogSheet(false)} className="flex-1 py-2 bg-white border border-[#E2E5E9] hover:bg-[#F5F6F8] text-[#1F2937] font-semibold rounded-lg">취소</button>
                <button type="submit" className={`flex-1 py-2 text-white font-semibold rounded-lg shadow-2xs ${logType === '불출' ? 'bg-[#16A34A] hover:bg-[#15803D]' : 'bg-[#2563EB] hover:bg-[#1D4ED8]'}`}>{logType} 완료</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 자재 신규 등록/수정 모달 */}
      {showInventorySheet && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white border border-[#E2E5E9] rounded-t-2xl sm:rounded-xl max-w-lg w-full p-5 shadow-2xl max-h-[85vh] overflow-y-auto text-[#1F2937]">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-bold text-[#1F2937]">{editingItem ? '자재 정보 수정' : '신규 자재 등록'}</h2>
              <button 
                onClick={() => setShowInventorySheet(false)} 
                className="p-1 text-[#64748B] hover:text-[#1F2937] hover:bg-[#F5F6F8] rounded-md transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitInventory} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#64748B] font-semibold mb-1">자재 구별</label>
                <div className="flex space-x-1 bg-[#F5F6F8] p-1 rounded-lg border border-[#E2E5E9]">
                  {(['고정', '소모성', 'CABIN'] as MainTab[]).map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => {
                        setItemType(tab);
                        if (tab !== '고정') setItemVbtType('');
                      }}
                      className={`flex-1 py-1.5 rounded-md font-semibold transition ${itemType === tab ? 'bg-[#243B5A] text-white shadow-2xs' : 'text-[#64748B] hover:text-[#1F2937]'}`}
                    >
                      {tab === '고정' ? '기자재' : tab === '소모성' ? '소모성 자재' : 'CABIN'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#64748B] font-semibold mb-1">자재 코드 *</label>
                  <input type="text" required value={itemCode} onChange={e => setItemCode(e.target.value)} className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg font-mono text-[#1F2937] focus:bg-white focus:border-[#243B5A] focus:outline-hidden" />
                </div>
                <div>
                  <label className="block text-[#64748B] font-semibold mb-1">카테고리 *</label>
                  <input type="text" required value={itemCategory} onChange={e => setItemCategory(e.target.value)} className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-[#1F2937] focus:bg-white focus:border-[#243B5A] focus:outline-hidden" />
                </div>
              </div>

              <div>
                <label className="block text-[#64748B] font-semibold mb-1">자재명 *</label>
                <input type="text" required value={itemName} onChange={e => setItemName(e.target.value)} className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-[#1F2937] focus:bg-white focus:border-[#243B5A] focus:outline-hidden" />
              </div>

              {itemType === '고정' && itemCategory === 'VBT' && (
                <div>
                  <label className="block text-[#243B5A] font-semibold mb-1">VBT 규격/종류 선택</label>
                  <select 
                    value={itemVbtType} 
                    onChange={e => setItemVbtType(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg font-semibold text-[#1F2937] focus:bg-white focus:border-[#243B5A] focus:outline-hidden"
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
                <div className="grid grid-cols-2 gap-2 bg-[#F5F6F8] p-2.5 rounded-lg border border-[#E2E5E9]">
                  <div>
                    <label className="block text-[#64748B] font-semibold mb-1">교정일</label>
                    <input type="date" value={itemCalDate} onChange={e => setItemCalDate(e.target.value)} className="w-full px-2 py-1 bg-white border border-[#E2E5E9] rounded-md text-[#1F2937]" />
                  </div>
                  <div>
                    <label className="block text-amber-800 font-semibold mb-1">차기 교정일</label>
                    <input type="date" value={itemNextCalDate} onChange={e => setItemNextCalDate(e.target.value)} className="w-full px-2 py-1 bg-white border border-[#E2E5E9] rounded-md text-amber-900" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[#64748B] font-semibold mb-1">수량</label>
                  <input type="number" min="0" value={itemQuantity} onChange={e => setItemQuantity(Number(e.target.value))} className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-[#1F2937]" />
                </div>
                <div>
                  <label className="block text-[#DC2626] font-semibold mb-1">최소 재고</label>
                  <input type="number" min="0" value={itemMinQty} onChange={e => setItemMinQty(Number(e.target.value))} className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-red-200 rounded-lg text-[#DC2626] font-bold" />
                </div>
                <div>
                  <label className="block text-[#64748B] font-semibold mb-1">단위</label>
                  <input type="text" value={itemUnit} onChange={e => setItemUnit(e.target.value)} className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-[#1F2937]" />
                </div>
              </div>

              <div>
                <label className="block text-[#64748B] font-semibold mb-1">보관 위치</label>
                <input type="text" value={itemLocation} onChange={e => setItemLocation(e.target.value)} className="w-full px-2.5 py-1.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-[#1F2937]" />
              </div>

              <div className="pt-2 flex gap-2">
                <button type="button" onClick={() => setShowInventorySheet(false)} className="flex-1 py-2 bg-white border border-[#E2E5E9] hover:bg-[#F5F6F8] font-semibold rounded-lg text-[#1F2937]">취소</button>
                <button type="submit" className="flex-1 py-2 bg-[#243B5A] hover:bg-[#1d3049] text-white font-semibold rounded-lg shadow-2xs">저장</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}