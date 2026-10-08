import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import pptxgen from 'pptxgenjs';

export interface HRExportUser {
  id: string;
  name: string;
  email?: string;
  department?: string;
  position?: string;
  job_title?: string;
  field?: string;
  role?: string;
  phone?: string;
  address?: string;
  experience?: string;
  internal_certificates?: string;
  national_certificates?: string;
  certificates?: string;
  join_date?: string;
  career_start_date?: string;
  photo_url?: string | null;
  parent_id?: string | null;
  display_order?: number;
}

const DEPT_ORDER = ['운영', '관리', '1팀', '2팀', '3팀', '4팀'];

function activeUsers(users: HRExportUser[]) {
  return users.filter(u => !(u as any).is_retired && (u.department || '') !== '퇴사자');
}

function careerYears(user: HRExportUser) {
  if (user.career_start_date) {
    const d = new Date(user.career_start_date);
    if (!Number.isNaN(d.getTime())) {
      const now = new Date();
      return now.getFullYear() - d.getFullYear() - (
        now.getMonth() < d.getMonth() ||
        (now.getMonth() === d.getMonth() && now.getDate() < d.getDate()) ? 1 : 0
      );
    }
  }
  const match = (user.experience || '').match(/(\d+)\s*년/);
  return match ? Number(match[1]) : 0;
}

function sortTeamMembers(users: HRExportUser[]) {
  const rankOrder: Record<string, number> = { 책임: 1, 프로: 2, 매니저: 3, 사원: 4 };
  return [...users].sort((a, b) => {
    const leaderA = (a.job_title || '').trim() === '팀장' ? 0 : 1;
    const leaderB = (b.job_title || '').trim() === '팀장' ? 0 : 1;
    if (leaderA !== leaderB) return leaderA - leaderB;
    const rankA = rankOrder[(a.position || '').trim()] ?? 99;
    const rankB = rankOrder[(b.position || '').trim()] ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    const careerDiff = careerYears(b) - careerYears(a);
    if (careerDiff) return careerDiff;
    return (a.name || '').localeCompare(b.name || '', 'ko');
  });
}

function orderedUsers(users: HRExportUser[]) {
  const active = activeUsers(users);
  return [...active].sort((a, b) => {
    const da = DEPT_ORDER.indexOf(a.department || '');
    const db = DEPT_ORDER.indexOf(b.department || '');
    const deptA = da === -1 ? 99 : da;
    const deptB = db === -1 ? 99 : db;
    if (deptA !== deptB) return deptA - deptB;
    if (/^[1-4]팀$/.test(a.department || '') && a.department === b.department) {
      return sortTeamMembers([a, b]).indexOf(a) - sortTeamMembers([a, b]).indexOf(b);
    }
    return (a.display_order ?? 9999) - (b.display_order ?? 9999) || (a.name || '').localeCompare(b.name || '', 'ko');
  });
}

function displayField(u: HRExportUser) {
  if (/^[1-4]팀$/.test(u.department || '')) return '';
  if (u.department === '운영' && ['본부장', '소장'].includes((u.job_title || '').trim())) return '';
  return u.field || '';
}

function careerText(u: HRExportUser) {
  if (u.experience?.trim()) return u.experience.trim();
  const years = careerYears(u);
  return years > 0 ? `${years}년` : '';
}

function fileDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export async function exportHRToExcel(users: HRExportUser[]) {
  const ordered = orderedUsers(users);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '인사 관리';
  workbook.company = 'MP-LNG';
  workbook.subject = '구성원 인사 정보';
  workbook.title = '인사 관리';

  // 사용자가 제공한 조직도 Excel의 구성(직급 요약 + 부서별 카드 배치)을 참고한 첫 번째 시트
  const orgChart = workbook.addWorksheet('조직도 (목포)');
  orgChart.columns = Array.from({ length: 20 }, () => ({ width: 4.2 }));
  orgChart.mergeCells('A1:T1');
  orgChart.getCell('A1').value = 'ITEC SERVICE CO., LTD. Organization Chart';
  orgChart.getCell('A1').font = { name: '맑은 고딕', size: 18, bold: true, color: { argb: 'FF243B5A' } };
  orgChart.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  orgChart.getRow(1).height = 34;
  orgChart.mergeCells('A2:T2');
  orgChart.getCell('A2').value = `조직도 (목포) · ${new Date().toLocaleDateString('ko-KR')} · 총 ${ordered.length}명`;
  orgChart.getCell('A2').font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: 'FF64748B' } };
  orgChart.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
  orgChart.getRow(2).height = 22;
  orgChart.mergeCells('A4:T4');
  orgChart.getCell('A4').value = '직급 현황';
  orgChart.getCell('A4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF243B5A' } };
  orgChart.getCell('A4').font = { name: '맑은 고딕', bold: true, color: { argb: 'FFFFFFFF' } };
  orgChart.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };
  orgChart.getRow(4).height = 22;
  const rankNames = ['본부장', '소장', '책임', '프로', '매니저', '사원'];
  for (let i = 0; i < rankNames.length; i++) {
    const col = 1 + i * 3;
    orgChart.mergeCells(5, col, 5, col + 1);
    orgChart.getCell(5, col).value = rankNames[i];
    orgChart.getCell(5, col).font = { name: '맑은 고딕', bold: true, color: { argb: 'FF243B5A' } };
    orgChart.getCell(5, col).alignment = { horizontal: 'center', vertical: 'middle' };
    orgChart.getCell(5, col + 2).value = ordered.filter(u => (u.job_title || '').trim() === rankNames[i] || (u.position || '').trim() === rankNames[i]).length;
    orgChart.getCell(5, col + 2).alignment = { horizontal: 'center', vertical: 'middle' };
  }
  orgChart.getRow(5).height = 22;

  const photoCache = new Map<string, string | null>();
  const getPhoto = async (user: HRExportUser) => {
    if (!user.photo_url) return null;
    if (!photoCache.has(user.photo_url)) photoCache.set(user.photo_url, await imageUrlToData(user.photo_url));
    return photoCache.get(user.photo_url) || null;
  };
  let chartRow = 7;
  const deptList = [...DEPT_ORDER, ...Array.from(new Set(ordered.map(u => u.department || '미지정').filter(d => !DEPT_ORDER.includes(d))))];
  for (const dept of deptList) {
    let members = ordered.filter(u => (u.department || '미지정') === dept);
    if (!members.length) continue;
    if (/^[1-4]팀$/.test(dept)) members = sortTeamMembers(members);
    orgChart.mergeCells(chartRow, 1, chartRow, 20);
    const header = orgChart.getCell(chartRow, 1);
    header.value = `${dept}  ·  ${members.length}명`;
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF243B5A' } };
    header.font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    header.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    orgChart.getRow(chartRow).height = 23;
    chartRow++;
    for (let idx = 0; idx < members.length; idx += 4) {
      const rowStart = chartRow;
      const rowEnd = chartRow + 3;
      const rowUsers = members.slice(idx, idx + 4);
      for (let j = 0; j < rowUsers.length; j++) {
        const user = rowUsers[j];
        const startCol = j * 5 + 1;
        orgChart.mergeCells(rowStart, startCol, rowStart, startCol + 1);
        orgChart.mergeCells(rowStart, startCol + 2, rowStart, startCol + 4);
        orgChart.mergeCells(rowStart + 1, startCol, rowStart + 1, startCol + 1);
        orgChart.mergeCells(rowStart + 1, startCol + 2, rowStart + 1, startCol + 4);
        orgChart.mergeCells(rowStart + 2, startCol, rowStart + 2, startCol + 1);
        orgChart.mergeCells(rowStart + 2, startCol + 2, rowStart + 2, startCol + 4);
        orgChart.mergeCells(rowStart + 3, startCol, rowStart + 3, startCol + 1);
        orgChart.mergeCells(rowStart + 3, startCol + 2, rowStart + 3, startCol + 4);
        const lines = [user.name || '', [user.position, (user.job_title || '').trim() === '팀원' ? '' : user.job_title].filter(v => v && v !== '없음').join(' · '), user.phone || '', displayField(user)];
        for (let k = 0; k < 4; k++) {
          const left = orgChart.getCell(rowStart + k, startCol);
          const right = orgChart.getCell(rowStart + k, startCol + 2);
          left.value = k === 0 ? '사진' : '';
          left.alignment = { horizontal: 'center', vertical: 'middle' };
          right.value = lines[k];
          right.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 1 };
          right.font = { name: '맑은 고딕', size: k === 0 ? 10 : 8, bold: k === 0 || k === 1, color: { argb: k === 0 ? 'FF243B5A' : 'FF1F2937' } };
          for (let cc = startCol; cc <= startCol + 4; cc++) {
            orgChart.getCell(rowStart + k, cc).border = {
              top: { style: 'thin', color: { argb: 'FFE2E5E9' } }, bottom: { style: 'thin', color: { argb: 'FFE2E5E9' } },
              left: { style: 'thin', color: { argb: 'FFE2E5E9' } }, right: { style: 'thin', color: { argb: 'FFE2E5E9' } },
            };
            if (k === 0) orgChart.getCell(rowStart + k, cc).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F6F8' } };
          }
        }
        const photo = await getPhoto(user);
        if (photo) {
          const extension = 'png';
          const imageId = workbook.addImage({ base64: photo, extension: extension as any });
          orgChart.addImage(imageId, { tl: { col: startCol - 1 + 0.08, row: rowStart - 1 + 0.08 }, ext: { width: 44, height: 44 } });
        }
      }
      for (let rr = rowStart; rr <= rowEnd; rr++) orgChart.getRow(rr).height = rr === rowStart ? 25 : 20;
      chartRow += 4;
    }
    chartRow++;
  }
  orgChart.views = [{ state: 'frozen', ySplit: 6 }];
  orgChart.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  orgChart.properties.defaultRowHeight = 18;

  const sheet = workbook.addWorksheet('구성원정보');
  sheet.columns = [
    { header: '사진', key: 'photo', width: 12 },
    { header: 'No.', key: 'no', width: 7 },
    { header: '이름', key: 'name', width: 12 },
    { header: '로그인 ID', key: 'id', width: 18 },
    { header: '부서/팀', key: 'department', width: 12 },
    { header: '직급', key: 'position', width: 10 },
    { header: '직책', key: 'job_title', width: 10 },
    { header: '담당분야', key: 'field', width: 16 },
    { header: '전화번호', key: 'phone', width: 17 },
    { header: '이메일', key: 'email', width: 28 },
    { header: '주소', key: 'address', width: 30 },
    { header: '입사일', key: 'join_date', width: 13 },
    { header: '경력 시작일', key: 'career_start_date', width: 15 },
    { header: '경력', key: 'experience', width: 24 },
    { header: '사내자격', key: 'internal_certificates', width: 28 },
    { header: '국가자격', key: 'national_certificates', width: 28 },
    { header: '권한', key: 'role', width: 14 },
  ];

  const header = sheet.getRow(1);
  header.height = 28;
  header.eachCell((cell) => {
    cell.font = { name: '맑은 고딕', bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF243B5A' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD7DEE8' } },
      left: { style: 'thin', color: { argb: 'FFD7DEE8' } },
      bottom: { style: 'thin', color: { argb: 'FFD7DEE8' } },
      right: { style: 'thin', color: { argb: 'FFD7DEE8' } },
    };
  });

  for (let index = 0; index < ordered.length; index += 1) {
    const u = ordered[index];
    const row = sheet.addRow({
      photo: '',
      no: index + 1,
      name: u.name || '',
      id: u.id || '',
      department: u.department || '',
      position: u.position || '',
      job_title: u.job_title || '',
      field: displayField(u),
      phone: u.phone || '',
      email: u.email || '',
      address: u.address || '',
      join_date: u.join_date || '',
      career_start_date: u.career_start_date || '',
      experience: careerText(u),
      internal_certificates: u.internal_certificates || '',
      national_certificates: u.national_certificates || u.certificates || '',
      role: u.role || '',
    });

    row.height = 64;
    row.eachCell((cell) => {
      cell.font = { name: '맑은 고딕', size: 10, color: { argb: 'FF1F2937' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
    row.getCell('no').alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell('photo').alignment = { horizontal: 'center', vertical: 'middle' };

    const photo = await getPhoto(u);
    if (photo) {
      const extension = 'png';
      const imageId = workbook.addImage({ base64: photo, extension });
      sheet.addImage(imageId, {
        tl: { col: 0.2, row: row.number - 0.82 },
        ext: { width: 58, height: 58 },
      });
    } else {
      row.getCell('photo').value = '사진 없음';
      row.getCell('photo').font = { name: '맑은 고딕', size: 9, color: { argb: 'FF94A3B8' } };
    }
  }

  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: `Q${Math.max(1, ordered.length + 1)}` };

  const orgSheet = workbook.addWorksheet('조직구조');
  orgSheet.columns = [
    { header: '순서', key: 'order', width: 8 },
    { header: '부서/팀', key: 'department', width: 14 },
    { header: '이름', key: 'name', width: 14 },
    { header: '직책', key: 'job_title', width: 12 },
    { header: '직급', key: 'position', width: 10 },
    { header: '담당분야', key: 'field', width: 16 },
    { header: '상위 구성원 ID', key: 'parent_id', width: 22 },
    { header: '표시순서', key: 'display_order', width: 12 },
  ];
  orgSheet.getRow(1).eachCell((cell) => {
    cell.font = { name: '맑은 고딕', bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF243B5A' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  ordered.forEach((u, index) => {
    const row = orgSheet.addRow({
      order: index + 1,
      department: u.department || '',
      name: u.name || '',
      job_title: u.job_title || '',
      position: u.position || '',
      field: u.field || '',
      parent_id: u.parent_id || '',
      display_order: u.display_order ?? '',
    });
    row.eachCell((cell) => {
      cell.font = { name: '맑은 고딕', size: 10 };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
  });
  orgSheet.views = [{ state: 'frozen', ySplit: 1 }];
  orgSheet.autoFilter = { from: 'A1', to: `H${Math.max(1, ordered.length + 1)}` };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `인사관리_${fileDate()}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function imageUrlToData(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();

    // ExcelJS는 WebP 삽입을 안정적으로 지원하지 않으므로 모든 사진을 PNG로 변환합니다.
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      return null;
    }
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

function addText(slide: pptxgen.Slide, text: string, x: number, y: number, w: number, h: number, options: any = {}) {
  slide.addText(text || '', {
    x, y, w, h,
    margin: 0,
    fontFace: 'Malgun Gothic',
    color: '1F2937',
    breakLine: false,
    fit: 'shrink',
    ...options,
  });
}

export async function exportHRToPptx(users: HRExportUser[]) {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = '인사 관리';
  pptx.subject = '구성원 조직도';
  pptx.title = '인사 관리 조직도';
  pptx.company = 'MP-LNG';
  pptx.theme = {
    headFontFace: 'Malgun Gothic',
    bodyFontFace: 'Malgun Gothic',
  };

  const ordered = orderedUsers(users);
  const byDepartment = (department: string) =>
    ordered.filter(u => (u.department || '미지정') === department);

  const photoCache = new Map<string, string | null>();
  const getPhoto = async (user: HRExportUser) => {
    if (!user.photo_url) return null;
    if (!photoCache.has(user.photo_url)) {
      photoCache.set(user.photo_url, await imageUrlToData(user.photo_url));
    }
    return photoCache.get(user.photo_url) || null;
  };

  const addPersonCard = async (
    slide: pptxgen.Slide,
    user: HRExportUser,
    x: number,
    y: number,
    w: number,
    h: number,
    compact = false,
  ) => {
    const leader = ['본부장', '소장', '팀장'].includes((user.job_title || '').trim());

    slide.addShape(pptx.ShapeType.roundRect, {
      x, y, w, h,
      fill: { color: 'FFFFFF' },
      line: {
        color: leader ? '243B5A' : 'D7DEE8',
        width: leader ? 1.5 : 1,
      },
      shadow: { type: 'outer', color: 'B8C2D1', blur: 1, angle: 45, opacity: 0.15 },
    });

    const photo = await getPhoto(user);
    const photoSize = compact ? 0.52 : 0.64;
    const photoX = x + 0.12;
    const photoY = y + (h - photoSize) / 2;

    if (photo) {
      slide.addImage({ data: photo, x: photoX, y: photoY, w: photoSize, h: photoSize });
    } else {
      slide.addShape(pptx.ShapeType.ellipse, {
        x: photoX, y: photoY, w: photoSize, h: photoSize,
        fill: { color: leader ? '243B5A' : 'E8EDF3' },
        line: { color: leader ? '243B5A' : 'D7DEE8', width: 1 },
      });
      addText(slide, user.name?.[0] || '유', photoX, photoY + photoSize * 0.27, photoSize, 0.18, {
        fontSize: compact ? 8 : 9,
        bold: true,
        color: leader ? 'FFFFFF' : '243B5A',
        align: 'center',
      });
    }

    const tx = x + photoSize + 0.24;
    const tw = w - photoSize - 0.34;
    addText(slide, user.name || '', tx, y + 0.13, tw, 0.22, {
      fontSize: compact ? 9.5 : 11,
      bold: true,
      color: '1F2937',
    });
    addText(
      slide,
      [user.position, (user.department && /^[1-4]팀$/.test(user.department) && (user.job_title || '').trim() !== '팀장' ? '' : user.job_title)].filter(v => v && v !== '없음' && v !== '팀원').join(' · '),
      tx,
      y + 0.39,
      tw,
      0.18,
      { fontSize: compact ? 7.5 : 8.5, bold: true, color: '243B5A' },
    );
    if (!compact && displayField(user)) {
      addText(slide, displayField(user), tx, y + 0.61, tw, 0.16, {
        fontSize: 7.5,
        color: '64748B',
      });
    }
  };

  const addGroupHeader = (
    slide: pptxgen.Slide,
    title: string,
    subtitle: string,
    x: number,
    y: number,
    w: number,
    dark = false,
  ) => {
    slide.addShape(pptx.ShapeType.roundRect, {
      x, y, w, h: 0.62,
      fill: { color: dark ? '243B5A' : 'FFFFFF' },
      line: { color: dark ? '243B5A' : 'AEBAC9', width: 1.2 },
    });
    addText(slide, title, x + 0.12, y + 0.11, w - 0.24, 0.22, {
      fontSize: 12,
      bold: true,
      color: dark ? 'FFFFFF' : '243B5A',
      align: 'center',
    });
    addText(slide, subtitle, x + 0.12, y + 0.36, w - 0.24, 0.14, {
      fontSize: 7.5,
      color: dark ? 'D9E4F2' : '64748B',
      align: 'center',
    });
  };

  // 표지
  {
    const slide = pptx.addSlide();
    slide.background = { color: 'F5F6F8' };
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: 13.333, h: 7.5,
      fill: { color: 'F5F6F8' }, line: { color: 'F5F6F8' },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.65, y: 0.65, w: 0.12, h: 1.0,
      fill: { color: '243B5A' }, line: { color: '243B5A' },
    });
    addText(slide, '인사 관리', 1.0, 0.72, 6.5, 0.55, {
      fontSize: 26, bold: true, color: '1F2937',
    });
    addText(slide, '구성원 조직도 및 인사 현황', 1.0, 1.35, 6.5, 0.4, {
      fontSize: 16, color: '64748B',
    });
    addText(slide, `총 구성원 ${ordered.length}명`, 1.0, 2.15, 4, 0.4, {
      fontSize: 14, bold: true, color: '243B5A',
    });
    addText(slide, `작성일 ${new Date().toLocaleDateString('ko-KR')}`, 1.0, 2.6, 4, 0.35, {
      fontSize: 11, color: '64748B',
    });
  }

  // =====================================================
  // 실제 조직도 슬라이드
  // 운영 → 관리 → 1~4팀 구조를 PPT 객체와 연결선으로 구성합니다.
  // =====================================================
  const operation = byDepartment('운영');
  const management = byDepartment('관리');
  const teams = ['1팀', '2팀', '3팀', '4팀'].map(name => ({
    name,
    members: byDepartment(name),
  }));

  const hasOrgData = operation.length || management.length || teams.some(t => t.members.length);

  if (hasOrgData) {
    const slide = pptx.addSlide();
    slide.background = { color: 'F5F6F8' };

    addText(slide, '조직도', 0.55, 0.25, 3.0, 0.42, {
      fontSize: 22, bold: true, color: '243B5A',
    });
    addText(slide, `총 ${ordered.length}명`, 10.8, 0.31, 1.9, 0.25, {
      fontSize: 9, color: '64748B', align: 'right',
    });

    // ① 운영
    const opX = 4.75;
    const opW = 3.83;
    addGroupHeader(
      slide,
      '운영',
      `${operation.length}명 · 본부/소장/사무`,
      opX,
      0.92,
      opW,
      true,
    );

    const opCardW = Math.min(3.65, operation.length <= 1 ? 3.65 : 1.72);
    const opGap = 0.16;
    const opStartX = opX + (opW - (operation.length > 1 ? Math.min(operation.length, 2) * opCardW + (Math.min(operation.length, 2) - 1) * opGap : opCardW)) / 2;
    const opCards = operation.slice(0, 2);
    for (let i = 0; i < opCards.length; i++) {
      await addPersonCard(slide, opCards[i], opStartX + i * (opCardW + opGap), 1.72, opCardW, 0.95, true);
    }

    // 운영 → 관리 연결
    slide.addShape(pptx.ShapeType.line, {
      x: opX + opW / 2,
      y: 2.67,
      w: 0,
      h: 0.48,
      line: { color: '94A3B8', width: 1.5, beginArrowType: 'none', endArrowType: 'triangle' },
    });

    // ② 관리
    const mgX = 4.75;
    const mgW = 3.83;
    addGroupHeader(
      slide,
      '관리',
      `${management.length}명 · QA / 공정 / 스케줄 등`,
      mgX,
      3.15,
      mgW,
    );

    const mgCols = Math.min(3, Math.max(1, management.length));
    const mgCardW = mgCols === 1 ? 3.65 : 1.16;
    const mgGap = 0.16;
    const mgTotalW = mgCols * mgCardW + (mgCols - 1) * mgGap;
    const mgStartX = mgX + (mgW - mgTotalW) / 2;
    for (let i = 0; i < Math.min(management.length, 3); i++) {
      await addPersonCard(slide, management[i], mgStartX + i * (mgCardW + mgGap), 3.92, mgCardW, 0.95, true);
    }

    // 관리 → 팀 공통 수직선
    const teamTopY = 5.65;
    const teamCenters = [1.7, 4.55, 7.4, 10.25];
    slide.addShape(pptx.ShapeType.line, {
      x: mgX + mgW / 2,
      y: 4.88,
      w: 0,
      h: 0.48,
      line: { color: '94A3B8', width: 1.5, beginArrowType: 'none', endArrowType: 'none' },
    });
    slide.addShape(pptx.ShapeType.line, {
      x: teamCenters[0],
      y: 5.36,
      w: teamCenters[3] - teamCenters[0],
      h: 0,
      line: { color: '94A3B8', width: 1.5 },
    });

    // ③ 1~4팀
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      const cx = teamCenters[i];
      const boxW = 2.28;
      const boxX = cx - boxW / 2;

      // 공통 수평선 → 팀 박스 연결
      slide.addShape(pptx.ShapeType.line, {
        x: cx,
        y: 5.36,
        w: 0,
        h: 0.29,
        line: { color: '94A3B8', width: 1.5, endArrowType: 'triangle' },
      });

      addGroupHeader(
        slide,
        team.name,
        `${team.members.length}명 · 팀장 / 구성원`,
        boxX,
        teamTopY,
        boxW,
        false,
      );

      // 팀장은 맨 위에 배치하고, 팀원 전체를 이름/직급/경력 순으로 표시합니다.
      // 기존에는 y 좌표 제한 때문에 실제로 첫 번째 카드만 보이는 문제가 있었습니다.
      const teamMembers = sortTeamMembers(team.members);
      const listTop = 6.31;
      const listBottom = 7.43;
      const lineH = Math.min(0.16, (listBottom - listTop) / Math.max(teamMembers.length, 1));
      for (let j = 0; j < teamMembers.length; j++) {
        const member = teamMembers[j];
        const y = listTop + j * lineH;
        const title = (member.job_title || '').trim() === '팀장' ? '팀장' : '';
        const text = `${j + 1}. ${member.name || ''} · ${member.position || ''}${title ? ' · 팀장' : ''}`;
        addText(slide, text, boxX + 0.04, y, boxW - 0.08, lineH, {
          fontSize: teamMembers.length > 7 ? 5.5 : 6.5,
          bold: title === '팀장',
          color: title === '팀장' ? '243B5A' : '334155',
          valign: 'mid',
          breakLine: false,
        });
      }
    }

  }

  // =====================================================
  // 상세 구성원 슬라이드
  // 조직도에서 잘리지 않도록 부서별 상세 카드를 별도 슬라이드에 제공합니다.
  // =====================================================
  const departments = DEPT_ORDER.filter(d => ordered.some(u => (u.department || '') === d));
  const extraDepartments = Array.from(
    new Set(ordered.map(u => u.department || '미지정').filter(d => !DEPT_ORDER.includes(d))),
  );
  departments.push(...extraDepartments);

  for (const department of departments) {
    let members = ordered.filter(u => (u.department || '미지정') === department);
    if (/^[1-4]팀$/.test(department)) members = sortTeamMembers(members);
    if (!members.length) continue;

    const cols = 4;
    const gap = 0.18;
    const cardW = (12.25 - gap * (cols - 1)) / cols;
    const cardH = 1.42;
    const startX = 0.55;
    const startY = 1.15;
    const rowsPerSlide = 4;
    const perSlide = cols * rowsPerSlide;

    for (let pageStart = 0; pageStart < members.length; pageStart += perSlide) {
      const pageMembers = members.slice(pageStart, pageStart + perSlide);
      const slide = pptx.addSlide();
      slide.background = { color: 'F5F6F8' };
      addText(slide, `${department} 구성원`, 0.55, 0.35, 5.0, 0.45, {
        fontSize: 20, bold: true, color: '243B5A',
      });
      addText(slide, `${members.length}명`, 10.9, 0.39, 1.6, 0.3, {
        fontSize: 10, color: '64748B', align: 'right',
      });
      if (members.length > perSlide) {
        addText(slide, `${Math.floor(pageStart / perSlide) + 1} / ${Math.ceil(members.length / perSlide)}`, 9.7, 0.39, 1.0, 0.3, {
          fontSize: 9, color: '94A3B8', align: 'right',
        });
      }
      slide.addShape(pptx.ShapeType.line, {
        x: 0.55, y: 0.9, w: 12.2, h: 0,
        line: { color: 'CBD5E1', width: 1 },
      });

      for (let i = 0; i < pageMembers.length; i++) {
        const user = pageMembers[i];
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = startX + col * (cardW + gap);
        const y = startY + row * (cardH + gap);
        await addPersonCard(slide, user, x, y, cardW, cardH, false);
        addText(slide, user.phone || '', x + 1.0, y + 1.12, cardW - 1.15, 0.2, {
          fontSize: 8, color: '64748B',
        });
      }
    }
  }

  await pptx.writeFile({ fileName: `인사관리_조직도_${fileDate()}.pptx` });
}
