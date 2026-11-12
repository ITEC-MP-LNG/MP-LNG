'use client';

import { useMemo, useState } from 'react';
import ExcelJS from 'exceljs';
import { ChevronDown, X } from 'lucide-react';
import type { ShipItem } from './ShipInfo';

type AlertType = 'info' | 'success' | 'warning' | 'error';
type Props = {
  ships: ShipItem[];
  showAlert: (title: string, message: string, type?: AlertType) => void;
};

function ComparisonStyledSelect({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value);
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label={ariaLabel} aria-haspopup="dialog" aria-expanded={open} className="flex w-full items-center justify-between gap-2 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-left text-sm text-[#1F2937] transition-colors hover:border-[#243B5A]">
      <span className="min-w-0 flex-1 truncate">{selected?.label || '선택해주세요'}</span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#64748B]" />
    </button>
    {open && <div className="fixed inset-0 z-[1000000] flex items-center justify-center bg-slate-900/25 p-4" onClick={() => setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label={ariaLabel} onClick={event => event.stopPropagation()} className="w-full max-w-sm overflow-hidden rounded-2xl border border-[#E2E5E9] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.18)]">
        <div className="flex items-center justify-between gap-3 border-b border-[#E2E5E9] bg-[#F8FAFC] px-4 py-3">
          <span className="text-sm font-bold text-[#243B5A]">{ariaLabel}</span>
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#E2E8F0]" aria-label="선택 메뉴 닫기"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[60dvh] overflow-y-auto p-2">
          {options.map(option => <button key={option.value} type="button" onClick={() => { onChange(option.value); setOpen(false); }} className={`mb-1 flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors last:mb-0 ${option.value === value ? 'bg-[#243B5A] font-bold text-white' : 'text-[#1F2937] hover:bg-[#F5F6F8]'}`}>
            <span className="min-w-0 break-words">{option.label}</span>
            {option.value === value && <span aria-hidden="true" className="shrink-0">✓</span>}
          </button>)}
        </div>
      </div>
    </div>}
  </>;
}

const TANK_KEYS = ['TK1', 'TK2', 'TK3', 'TK4'] as const;
const PROCESS_GROUPS: { key: string; label: string; subLabel?: string }[] = [
  { key: 'st_1st', label: 'S/T 1ST' },
  { key: 'st_2nd', label: 'S/T 2nd' },
  { key: 'pre_sbtt', label: 'Pre SBTT' },
  { key: 'nh3_uf', label: 'NH3', subLabel: 'U/F' },
  { key: 'nh3_welding', label: 'NH3', subLabel: 'Welding' },
  { key: 'pbgt', label: 'PBGT' },
  { key: 'bf_sbtt', label: 'Before G/T SBTT' },
  { key: 'at_sbtt', label: 'After G/T SBTT' },
];

const parseDate = (value?: string | null) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = Date.parse(value);
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
};

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}/${mm}/${dd}`;
};

const formatDateRange = (start?: string | null, end?: string | null) => {
  if (!start && !end) return '-';
  if (start && end) return `${formatDate(start)} ~ ${formatDate(end)}`;
  return start ? `${formatDate(start)} ~ -` : `- ~ ${formatDate(end)}`;
};

export default function StatusComparisonExport({ ships, showAlert }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [owner, setOwner] = useState('__ALL__');
  const [project, setProject] = useState('__ALL__'); // 👈 프로젝트명 필터 상태 추가

  // 선주사 목록 추출
  const owners = useMemo(
    () => Array.from(new Set(ships.map((ship) => (ship.shipowner || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko')),
    [ships],
  );

  // 프로젝트명 목록 추출 (174K, DF 8K, DF 15K 등)
  const projects = useMemo(
    () => Array.from(new Set(ships.map((ship) => (ship.ship_name || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko')),
    [ships],
  );

  const exportExcel = async (dfOnly = false) => {
    // 기존 다운로드는 선주사 + 프로젝트 조건을 그대로 적용하고, DF 전체는 DF 프로젝트를 하나로 묶습니다.
    const targetShips = ships
      .filter((ship) => {
        const shipProject = (ship.ship_name || '').trim();
        const matchOwner = owner === '__ALL__' || (ship.shipowner || '').trim() === owner;
        const matchProject = dfOnly
          ? /df/i.test(shipProject)
          : project === '__ALL__' || shipProject === project;
        return matchOwner && matchProject;
      })
      .slice()
      .sort((a, b) => {
        if (dfOnly) {
          const projectCompare = String(a.ship_name || '').localeCompare(String(b.ship_name || ''), 'ko', { numeric: true });
          if (projectCompare !== 0) return projectCompare;
        }
        return parseDate(a.launch_date) - parseDate(b.launch_date) || String(a.ship_no || '').localeCompare(String(b.ship_no || ''), 'ko', { numeric: true });
      });

    if (!targetShips.length) {
      showAlert('다운로드 불가', '선택한 조건에 해당하는 호선이 없습니다.', 'warning');
      return;
    }

    try {
      const firstProcessCol = 2; 
      const totalColumns = 1 + PROCESS_GROUPS.length * TANK_KEYS.length;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'ShipInfo';
      workbook.subject = '탱크별 공정 일자 종합 비교표';
      workbook.created = new Date();
      const worksheet = workbook.addWorksheet('전체 공정 비교표', {
        views: [{ state: 'frozen', xSplit: 1, ySplit: 4 }],
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
      });

      worksheet.columns = [
        { key: 'shipInfo', width: 30 },
        ...PROCESS_GROUPS.flatMap(() => TANK_KEYS.map(() => ({ width: 8 }))),
      ];

      worksheet.mergeCells(1, 1, 1, totalColumns);
      const title = worksheet.getCell(1, 1);
      title.value = 'HD HSHI STATUS - 탱크별 공정 일자 종합 비교표';
      title.font = { name: 'HY헤드라인M', size: 24, bold: false };
      title.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 38;

      worksheet.getRow(2).height = 8;

      worksheet.getCell(3, 1).value = 'Ship No.';
      worksheet.mergeCells(3, 1, 5, 1);

      PROCESS_GROUPS.forEach((group, groupIndex) => {
        const startCol = firstProcessCol + groupIndex * TANK_KEYS.length;
        const endCol = startCol + TANK_KEYS.length - 1;
        if (group.label === 'NH3') {
          const previous = PROCESS_GROUPS[groupIndex - 1];
          if (!previous || previous.label !== 'NH3') {
            const lastNh3Index = PROCESS_GROUPS.reduce((last, item, index) => item.label === 'NH3' ? index : last, groupIndex);
            worksheet.mergeCells(3, startCol, 3, firstProcessCol + (lastNh3Index + 1) * TANK_KEYS.length - 1);
            worksheet.getCell(3, startCol).value = 'NH3';
          }
          worksheet.mergeCells(4, startCol, 4, endCol);
          worksheet.getCell(4, startCol).value = group.subLabel || '';
        } else {
          worksheet.mergeCells(3, startCol, 4, endCol);
          worksheet.getCell(3, startCol).value = group.label;
        }
        TANK_KEYS.forEach((tank, tankIndex) => {
          worksheet.getCell(5, startCol + tankIndex).value = tank;
        });
      });

      for (let rowNumber = 3; rowNumber <= 5; rowNumber += 1) {
        const row = worksheet.getRow(rowNumber);
        row.height = rowNumber === 3 ? 24 : 19;
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF24476B' } };
          const isProcessGroupStart = colNumber >= firstProcessCol && (colNumber - firstProcessCol) % TANK_KEYS.length === 0;
          const isProcessGroupEnd = colNumber >= firstProcessCol && (colNumber - firstProcessCol + 1) % TANK_KEYS.length === 0;
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: colNumber === 1 || isProcessGroupStart ? 'thin' : 'dotted', color: { argb: 'FF000000' } },
            right: { style: colNumber === totalColumns || isProcessGroupEnd ? 'thin' : 'dotted', color: { argb: 'FF000000' } },
          };
        });
      }

      for (let rowNumber = 3; rowNumber <= 5; rowNumber += 1) {
        for (let colNumber = 1; colNumber <= 1; colNumber += 1) {
          const cell = worksheet.getCell(rowNumber, colNumber);
          cell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF000000' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        }
      }

      targetShips.forEach((ship, shipIndex) => {
        const resultRowNumber = 6 + shipIndex * 2;
        const dateRowNumber = resultRowNumber + 1;
        const resultRow = worksheet.getRow(resultRowNumber);
        const dateRow = worksheet.getRow(dateRowNumber);

        worksheet.mergeCells(resultRowNumber, 1, dateRowNumber, 1);
        const shipInfoCell = resultRow.getCell(1);
        const ownerName = (ship.shipowner || '').trim();
        const projectName = (ship.ship_name || '').trim();
        const ownerProject = ownerName && projectName
          ? `${ownerName} (${projectName})`
          : ownerName || projectName || '';
        shipInfoCell.value = `${ship.ship_no || ''}\n${ownerProject}\n${formatDate(ship.launch_date) === '-' ? '-' : formatDate(ship.launch_date)}`;

        PROCESS_GROUPS.forEach((group, groupIndex) => {
          TANK_KEYS.forEach((tank, tankIndex) => {
            const colNumber = firstProcessCol + groupIndex * TANK_KEYS.length + tankIndex;
            const tankInfo = ship.tank_status?.[tank];
            const info = (tankInfo as any)?.[group.key] || {};
            const resultCell = resultRow.getCell(colNumber);
            const dateCell = dateRow.getCell(colNumber);

            if (tankInfo?.enabled === false) {
              resultCell.value = '미사용';
              dateCell.value = '미사용';
              return;
            }

            const values: string[] = [];
            if (info.value !== undefined && info.value !== null && String(info.value).trim() !== '') values.push(String(info.value));
            if (group.key === 'pbgt' && info.finalValue !== undefined && info.finalValue !== null && String(info.finalValue).trim() !== '') values.push(String(info.finalValue));
            if (info.text) values.push(String(info.text));
            if (values.length === 0 && info.status && info.status !== '대기' && info.status !== '완료') values.push(String(info.status));
            resultCell.value = values.join('\n') || '-';

            dateCell.value = group.key === 'pbgt' || group.key === 'nh3_welding'
              ? formatDateRange(info.startDate, info.endDate)
              : formatDate(info.date);
          });
        });

        [resultRow, dateRow].forEach((row, rowIndex) => {
          row.height = 23;
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            cell.font = { name: 'Arial', size: 6, color: { argb: 'FF000000' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, shrinkToFit: true };
            if (colNumber === 1) {
              cell.font = { name: 'Arial', size: 12, color: { argb: 'FF000000' } };
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } };
            }
            const isProcessGroupStart = colNumber >= firstProcessCol && (colNumber - firstProcessCol) % TANK_KEYS.length === 0;
            const isProcessGroupEnd = colNumber >= firstProcessCol && (colNumber - firstProcessCol + 1) % TANK_KEYS.length === 0;
            cell.border = {
              top: { style: rowIndex === 0 ? 'thin' : 'dotted', color: { argb: 'FF000000' } },
              bottom: { style: rowIndex === 0 ? 'dotted' : 'thin', color: { argb: 'FF000000' } },
              left: { style: colNumber === 1 || isProcessGroupStart ? 'thin' : 'dotted', color: { argb: 'FF000000' } },
              right: { style: colNumber === totalColumns || isProcessGroupEnd ? 'thin' : 'dotted', color: { argb: 'FF000000' } },
            };
          });
        });
      });

      worksheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + targetShips.length * 2, column: totalColumns } };
      
      // 파일명에 선주사와 프로젝트 조건 반영
      const safeOwner = owner === '__ALL__' ? '전체선주사' : owner.replace(/[\\/:*?"<>|]/g, '_');
      const safeProject = dfOnly ? 'DF전체' : project === '__ALL__' ? '전체프로젝트' : project.replace(/[\\/:*?"<>|]/g, '_');
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `탱크별_공정일자_종합비교표_${safeOwner}_${safeProject}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setIsOpen(false);
      showAlert('다운로드 완료', dfOnly
        ? `DF 프로젝트 ${targetShips.length}개 호선을 프로젝트명 및 진수일 기준으로 정렬하여 저장했습니다.`
        : `${targetShips.length}개 호선을 진수일 기준으로 정렬하여 저장했습니다.`, 'success');
    } catch (error: any) {
      console.error('전체 공정 비교표 다운로드 실패:', error);
      showAlert('다운로드 실패', `Excel 파일 생성 중 오류가 발생했습니다: ${error?.message || '알 수 없는 오류'}`, 'error');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-1 bg-[#243B5A] hover:bg-[#1B2F49] text-white border border-[#243B5A] px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
        title="전체 또는 조건별 공정 비교표 다운로드"
      >
        <span>전체 비교표 Excel</span>
      </button>
      {isOpen && (
        <div className="fixed inset-0 z-[999990] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E5E9] rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-[#1F2937]">공정현황 비교표 Excel 저장</h3>
              <button type="button" onClick={() => setIsOpen(false)} className="p-1 rounded hover:bg-slate-100 text-[#64748B]" aria-label="닫기">✕</button>
            </div>
            <p className="text-xs text-[#64748B] leading-5">한 시트에 호선별 2개 행으로 저장합니다. 선택 조건 저장은 선주사와 프로젝트명을 적용하고, DF 전체 저장은 선주사 조건을 적용한 뒤 DF 프로젝트 전체를 하나로 통합합니다. DF 전체는 프로젝트명, 진수일 순으로 정렬됩니다.</p>
            
            {/* 선주사 선택 드롭다운 */}
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-[#334155]">선주사 선택</span>
              <ComparisonStyledSelect
                ariaLabel="선주사 선택"
                value={owner}
                onChange={setOwner}
                options={[{ value: '__ALL__', label: '전체 선주사' }, ...owners.map(item => ({ value: item, label: item }))]}
              />
            </label>

            {/* 프로젝트명(선종) 선택 드롭다운 추가 */}
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-[#334155]">프로젝트명 / 선종 선택</span>
              <ComparisonStyledSelect
                ariaLabel="프로젝트명 / 선종 선택"
                value={project}
                onChange={setProject}
                options={[{ value: '__ALL__', label: '전체 프로젝트 (174K, DF 8K, DF 15K 전체)' }, ...projects.map(item => ({ value: item, label: item }))]}
              />
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setIsOpen(false)} className="px-3 py-2 rounded-lg border border-[#CBD5E1] text-xs font-semibold text-[#475569] hover:bg-slate-50">취소</button>
              <button type="button" onClick={() => exportExcel(false)} className="px-3 py-2 rounded-lg bg-[#243B5A] hover:bg-[#1B2F49] text-white text-xs font-semibold">선택 조건 저장</button>
              <button type="button" onClick={() => exportExcel(true)} className="px-3 py-2 rounded-lg bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-semibold">DF 전체 저장</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}