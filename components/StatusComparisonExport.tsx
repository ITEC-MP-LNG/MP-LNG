'use client';

import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import type { ShipItem } from './ShipInfo';

type AlertType = 'info' | 'success' | 'warning' | 'error';
type Props = {
  ships: ShipItem[];
  showAlert: (title: string, message: string, type?: AlertType) => void;
};

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

export default function StatusComparisonExport({ ships, showAlert }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [owner, setOwner] = useState('__ALL__');
  const owners = useMemo(
    () => Array.from(new Set(ships.map((ship) => (ship.shipowner || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko')),
    [ships],
  );

  const exportExcel = () => {
    const targetShips = ships
      .filter((ship) => owner === '__ALL__' || (ship.shipowner || '').trim() === owner)
      .slice()
      .sort((a, b) => parseDate(a.launch_date) - parseDate(b.launch_date) || String(a.ship_no || '').localeCompare(String(b.ship_no || ''), 'ko', { numeric: true }));

    if (!targetShips.length) {
      showAlert('다운로드 불가', '선택한 조건에 해당하는 호선이 없습니다.', 'warning');
      return;
    }

    try {
      const firstProcessCol = 3;
      const totalColumns = firstProcessCol + PROCESS_GROUPS.length * TANK_KEYS.length;
      const rows: (string | number)[][] = [];
      rows.push(['HD HSHI STATUS - 탱크별 공정 일자 종합 비교표']);
      rows.push([`출력 범위: ${owner === '__ALL__' ? '전체 호선' : `${owner} 선주사 호선`} / 정렬 기준: 진수일 오름차순 / 출력일: ${new Date().toISOString().slice(0, 10)}`]);

      // 첫 번째 헤더: NH3 제목은 U/F와 Welding 두 하위 공정을 묶어서 표시
      const groupHeader: (string | number)[] = ['호선번호 / 선주사', '호선명', '구분'];
      PROCESS_GROUPS.forEach((group) => TANK_KEYS.forEach(() => groupHeader.push(group.label)));
      rows.push(groupHeader);

      const subHeader: (string | number)[] = ['', '', ''];
      PROCESS_GROUPS.forEach((group) => TANK_KEYS.forEach(() => subHeader.push(group.subLabel || '')));
      rows.push(subHeader);

      const tankHeader: (string | number)[] = ['', '', ''];
      PROCESS_GROUPS.forEach(() => TANK_KEYS.forEach((tank) => tankHeader.push(tank)));
      rows.push(tankHeader);

      const dataRowIndexes: number[] = [];
      targetShips.forEach((ship) => {
        const resultRow: (string | number)[] = [ship.ship_no || '', ship.ship_name || '', '결과값'];
        const dateRow: (string | number)[] = [ship.shipowner || '', `진수일: ${ship.launch_date || '-'}`, '일자'];

        PROCESS_GROUPS.forEach((group) => {
          TANK_KEYS.forEach((tank) => {
            const tankInfo = ship.tank_status?.[tank];
            const info = (tankInfo as any)?.[group.key] || {};
            if (tankInfo?.enabled === false) {
              resultRow.push('미사용');
              dateRow.push('미사용');
              return;
            }

            const status = info.status || '대기';
            const notes: string[] = [];
            if (info.value) notes.push(`값: ${info.value}`);
            if (group.key === 'pbgt' && info.finalValue) notes.push(`Final: ${info.finalValue}`);
            if (info.text) notes.push(`비고: ${info.text}`);
            resultRow.push([status, ...notes].join('\n'));

            const dateText = group.key === 'pbgt' || group.key === 'nh3_welding'
              ? (info.startDate || info.endDate ? `${info.startDate || '-'} ~ ${info.endDate || '-'}` : '-')
              : (info.date || '-');
            dateRow.push(dateText);
          });
        });

        dataRowIndexes.push(rows.length);
        rows.push(resultRow, dateRow);
      });

      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      worksheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: totalColumns - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: totalColumns - 1 } },
      ];

      // 공정별 탱크 열을 병합하고, NH3는 U/F와 Welding을 묶는 상위 제목으로 표시합니다.
      PROCESS_GROUPS.forEach((group, index) => {
        const startCol = firstProcessCol + index * TANK_KEYS.length;
        if (group.subLabel) {
          const previous = PROCESS_GROUPS[index - 1];
          if (!previous || previous.label !== group.label || !previous.subLabel) {
            let lastNh3Index = index;
            for (let i = index; i < PROCESS_GROUPS.length; i += 1) {
              if (PROCESS_GROUPS[i].label === group.label && 'subLabel' in PROCESS_GROUPS[i]) lastNh3Index = i;
            }
            const endCol = firstProcessCol + lastNh3Index * TANK_KEYS.length + TANK_KEYS.length - 1;
            worksheet['!merges']?.push({ s: { r: 2, c: startCol }, e: { r: 2, c: endCol } });
          }
          worksheet['!merges']?.push({ s: { r: 3, c: startCol }, e: { r: 3, c: startCol + TANK_KEYS.length - 1 } });
        } else {
          worksheet['!merges']?.push({ s: { r: 2, c: startCol }, e: { r: 3, c: startCol + TANK_KEYS.length - 1 } });
        }
      });
      // Top-left metadata cells span the two header rows; each ship uses two rows (result, then date).
      worksheet['!merges']?.push(
        { s: { r: 2, c: 0 }, e: { r: 4, c: 0 } },
        { s: { r: 2, c: 1 }, e: { r: 4, c: 1 } },
        { s: { r: 2, c: 2 }, e: { r: 4, c: 2 } },
      );

      worksheet['!cols'] = [
        { wch: 20 }, { wch: 24 }, { wch: 12 },
        ...PROCESS_GROUPS.flatMap(() => TANK_KEYS.map(() => ({ wch: 15 }))),
      ];
      worksheet['!rows'] = [
        { hpt: 28 }, { hpt: 22 }, { hpt: 24 }, { hpt: 22 }, { hpt: 22 },
        ...targetShips.flatMap(() => [{ hpt: 44 }, { hpt: 30 }]),
      ];
      worksheet['!freeze'] = { xSplit: firstProcessCol, ySplit: 5 };
      worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 4, c: 0 }, e: { r: targetShips.length * 2 + 4, c: totalColumns - 1 } }) };

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '전체 공정 비교표');
      const safeOwner = owner === '__ALL__' ? '전체호선' : owner.replace(/[\\/:*?"<>|]/g, '_');
      XLSX.writeFile(workbook, `탱크별_공정일자_종합비교표_${safeOwner}.xlsx`);
      setIsOpen(false);
      showAlert('다운로드 완료', `${targetShips.length}개 호선을 진수일 기준으로 정렬해, 결과값 행과 날짜 행을 분리하여 저장했습니다.`, 'success');
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
        title="전체 또는 선주사별 공정 비교표 다운로드"
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
            <p className="text-xs text-[#64748B] leading-5">한 시트에 호선별 2개 행으로 저장합니다. 위쪽 행에는 공정 결과값, 아래쪽 행에는 공정 날짜가 표시되며 진수일 오름차순으로 정렬됩니다.</p>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-[#334155]">출력 범위</span>
              <select value={owner} onChange={(event) => setOwner(event.target.value)} className="w-full border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#1F2937] bg-white focus:outline-none focus:border-[#243B5A]">
                <option value="__ALL__">전체 호선</option>
                {owners.map((item) => <option key={item} value={item}>{item} 선주사 호선</option>)}
              </select>
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setIsOpen(false)} className="px-3 py-2 rounded-lg border border-[#CBD5E1] text-xs font-semibold text-[#475569] hover:bg-slate-50">취소</button>
              <button type="button" onClick={exportExcel} className="px-3 py-2 rounded-lg bg-[#243B5A] hover:bg-[#1B2F49] text-white text-xs font-semibold">Excel 저장</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
