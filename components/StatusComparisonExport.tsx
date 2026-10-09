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
const STEPS = [
  { key: 'st_1st', label: 'S/T 1ST' },
  { key: 'st_2nd', label: 'S/T 2nd' },
  { key: 'pre_sbtt', label: 'Pre SBTT' },
  { key: 'nh3', label: 'NH3' },
  { key: 'nh3_uf', label: 'NH3 - U/F' },
  { key: 'nh3_welding', label: 'NH3 - Welding' },
  { key: 'pbgt', label: 'PBGT' },
  { key: 'bf_sbtt', label: 'Before G/T SBTT' },
  { key: 'at_sbtt', label: 'After G/T SBTT' },
] as const;

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
      .sort((a, b) => String(a.ship_no || '').localeCompare(String(b.ship_no || ''), 'ko', { numeric: true }));

    if (!targetShips.length) {
      showAlert('다운로드 불가', '선택한 조건에 해당하는 호선이 없습니다.', 'warning');
      return;
    }

    try {
      const totalColumns = 3 + STEPS.length * TANK_KEYS.length;
      const firstHeader: (string | number)[] = ['Ship No.', '선주사', '호선명 / 프로젝트명'];
      const secondHeader: (string | number)[] = ['', '', ''];
      STEPS.forEach((step) => {
        TANK_KEYS.forEach((tank) => {
          firstHeader.push(step.label);
          secondHeader.push(tank);
        });
      });

      const rows: (string | number)[][] = [
        ['HD HSHI STATUS - 탱크별 공정 일자 종합 비교표'],
        [`출력 기준: ${owner === '__ALL__' ? '전체 호선' : `선주사 ${owner}`} / 출력일: ${new Date().toISOString().slice(0, 10)}`],
        firstHeader,
        secondHeader,
      ];

      targetShips.forEach((ship) => {
        const row: (string | number)[] = [ship.ship_no || '', ship.shipowner || '', ship.ship_name || ''];
        STEPS.forEach((step) => {
          TANK_KEYS.forEach((tank) => {
            const tankInfo = ship.tank_status?.[tank];
            if (tankInfo?.enabled === false) {
              row.push('미사용');
              return;
            }
            const info = (tankInfo as any)?.[step.key] || {};
            const status = info.status || '대기';
            const date = (step.key === 'pbgt' || step.key === 'nh3_welding')
              ? (info.startDate || info.endDate ? `${info.startDate || '-'} ~ ${info.endDate || '-'}` : '-')
              : (info.date || '-');
            const extras: string[] = [];
            if (info.value) extras.push(`값: ${info.value}`);
            if (step.key === 'pbgt' && info.finalValue) extras.push(`Final: ${info.finalValue}`);
            if (step.key === 'nh3' && info.text) extras.push(`비고: ${info.text}`);
            row.push([status, date, ...extras].join('\n'));
          });
        });
        rows.push(row);
      });

      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      worksheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: totalColumns - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: totalColumns - 1 } },
      ];
      STEPS.forEach((_, index) => {
        const startCol = 3 + index * TANK_KEYS.length;
        worksheet['!merges']?.push({ s: { r: 2, c: startCol }, e: { r: 2, c: startCol + TANK_KEYS.length - 1 } });
      });
      worksheet['!cols'] = [
        { wch: 16 }, { wch: 18 }, { wch: 24 },
        ...STEPS.flatMap(() => TANK_KEYS.map(() => ({ wch: 18 }))),
      ];
      worksheet['!rows'] = [
        { hpt: 28 }, { hpt: 22 }, { hpt: 26 }, { hpt: 22 },
        ...targetShips.map(() => ({ hpt: 58 })),
      ];
      worksheet['!freeze'] = { xSplit: 3, ySplit: 4 };
      worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 3, c: 0 }, e: { r: targetShips.length + 3, c: totalColumns - 1 } }) };

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '전체 공정 비교표');
      const safeOwner = owner === '__ALL__' ? '전체호선' : owner.replace(/[\\/:*?"<>|]/g, '_');
      XLSX.writeFile(workbook, `탱크별_공정일자_종합비교표_${safeOwner}.xlsx`);
      setIsOpen(false);
      showAlert('다운로드 완료', `${targetShips.length}개 호선의 공정현황을 한 시트에 저장했습니다.`, 'success');
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
            <p className="text-xs text-[#64748B] leading-5">한 시트에 호선별 한 행으로 저장합니다. 공정별 TK1~TK4 상태, 날짜, 입력값이 표시됩니다.</p>
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
