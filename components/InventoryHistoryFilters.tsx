'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type HistoryTypeFilter = '전체' | '기자재' | '소모성' | '교정' | '교정반입완료' | 'CABIN';

interface InventoryHistoryFiltersProps {
  historyTypeFilter: HistoryTypeFilter;
  setHistoryTypeFilter: (value: HistoryTypeFilter) => void;
  historyCategoryFilter: string;
  setHistoryCategoryFilter: (value: string) => void;
  setSelectedLogIds: (value: string[]) => void;
  equipmentHistoryCategories: string[];
}

export default function InventoryHistoryFilters({
  historyTypeFilter,
  setHistoryTypeFilter,
  historyCategoryFilter,
  setHistoryCategoryFilter,
  setSelectedLogIds,
  equipmentHistoryCategories,
}: InventoryHistoryFiltersProps) {
  const filters: HistoryTypeFilter[] = ['전체', '기자재', '소모성', '교정', 'CABIN'];

  return (
    <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-[#E2E5E9]">
      {filters.map((filter) => (
        <button
          key={filter}
          type="button"
          onClick={() => {
            setHistoryTypeFilter(filter);
            setHistoryCategoryFilter('전체');
            setSelectedLogIds([]);
          }}
          className={`px-2.5 py-1.5 rounded-md border text-[11px] font-semibold transition ${historyTypeFilter === filter ? 'bg-[#243B5A] border-[#243B5A] text-white' : 'bg-white border-[#E2E5E9] text-[#64748B] hover:bg-[#F5F6F8]'}`}
        >
          {filter === '전체' ? '전체 이력' : filter === '기자재' ? '기자재 불출' : filter === '소모성' ? '소모성 사용' : filter === '교정' ? '교정 반출' : 'CABIN'}
        </button>
      ))}
      {historyTypeFilter === '기자재' && (
        <Select
          value={historyCategoryFilter}
          onValueChange={(value) => {
            setHistoryCategoryFilter(value);
            setSelectedLogIds([]);
          }}
        >
          <SelectTrigger aria-label="기자재 이력 카테고리" className="h-8 min-w-0 max-w-full border-[#E2E5E9] bg-white text-[11px] text-[#1F2937]">
            <SelectValue placeholder="전체 기자재 종류" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="전체">전체 기자재 종류</SelectItem>
            {equipmentHistoryCategories.map((category) => (
              <SelectItem key={category} value={category}>{category}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
