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

  const orgChart = workbook.addWorksheet('조직도 (목포)');
  orgChart.columns = Array.from({ length: 23 }, () => ({ width: 6.65 }));
  orgChart.mergeCells('A1:W1');
  orgChart.getCell('A1').value = 'ITEC SERVICE CO., LTD. Organization Chart';
  orgChart.getCell('A1').font = { name: '맑은 고딕', size: 18, bold: true, color: { argb: 'FF243B5A' } };
  orgChart.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  orgChart.getRow(1).height = 34;
  orgChart.mergeCells('A2:W2');
  orgChart.getCell('A2').value = `조직도 (목포) · ${new Date().toLocaleDateString('ko-KR')} · 총 ${ordered.length}명`;
  orgChart.getCell('A2').font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: 'FF64748B' } };
  orgChart.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
  orgChart.getRow(2).height = 22;
  orgChart.mergeCells('A4:W4');
  orgChart.getCell('A4').value = '직급 현황';
  orgChart.getCell('A4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF243B5A' } };
  orgChart.getCell('A4').font = { name: '맑은 고딕', bold: true, color: { argb: 'FFFFFFFF' } };
  orgChart.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };
  orgChart.getRow(4).height = 22;
  const rankNames = ['본부장', '소장', '사원', '책임', '프로', '매니저'];
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

  const operationMembers = ordered.filter(u => (u.department || '') === '운영');
  const managementMembers = ordered.filter(u => (u.department || '') === '관리');
  const extraDepartments = [...new Set(ordered.map(u => u.department || '미지정'))]
    .filter(d => !DEPT_ORDER.includes(d));

  const writeOrgCard = async (user: HRExportUser, rowStart: number, startCol: number, teamCard = false) => {
    const rowEnd = rowStart + 3;
    orgChart.mergeCells(rowStart, startCol, rowEnd, startCol + 1);
    for (let k = 0; k < 4; k++) orgChart.mergeCells(rowStart + k, startCol + 2, rowStart + k, startCol + 4);
    const title = [user.name || '', (teamCard && (user.job_title || '').trim() === '팀장') ? '팀장' : '']
      .filter(Boolean).join(' · ');
    const lines = [title, [user.position, teamCard ? '' : user.job_title].filter(v => v && v !== '없음' && v !== '팀원').join(' · '), user.phone || '', displayField(user)];
    const photoCell = orgChart.getCell(rowStart, startCol);
    photoCell.value = user.photo_url ? '' : '사진 없음';
    photoCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    photoCell.font = { name: '맑은 고딕', size: 8, color: { argb: 'FF94A3B8' } };
    for (let k = 0; k < 4; k++) {
      const right = orgChart.getCell(rowStart + k, startCol + 2);
      right.value = lines[k];
      right.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 1 };
      right.font = { name: '맑은 고딕', size: k === 0 ? 9 : 8, bold: k <= 1, color: { argb: k === 0 ? 'FF243B5A' : 'FF1F2937' } };
      for (let cc = startCol; cc <= startCol + 4; cc++) {
        const cell = orgChart.getCell(rowStart + k, cc);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD7DEE8' } }, bottom: { style: 'thin', color: { argb: 'FFD7DEE8' } },
          left: { style: 'thin', color: { argb: 'FFD7DEE8' } }, right: { style: 'thin', color: { argb: 'FFD7DEE8' } },
        };
        if (k === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F5F9' } };
      }
    }
    for (let rr = rowStart; rr <= rowEnd; rr++) orgChart.getRow(rr).height = 17.4375;
    const photo = await getPhoto(user);
    if (photo) {
      const imageId = workbook.addImage({ base64: photo, extension: 'png' as any });
      orgChart.addImage(imageId, {
        tl: { col: startCol - 1, row: rowStart - 1 } as any,
        br: { col: startCol + 1, row: rowEnd } as any,
        editAs: 'oneCell',
      });
    }
  };

  const writeSectionHeader = (row: number, label: string) => {
    orgChart.mergeCells(row, 1, row, 23);
    const cell = orgChart.getCell(row, 1);
    cell.value = label;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF243B5A' } };
    cell.font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    orgChart.getRow(row).height = 23;
  };

  let sectionRow = 7;
  writeSectionHeader(sectionRow, `운영 · ${operationMembers.length}명`);
  sectionRow++;
  const cardCols = [1, 7, 13, 19];
  for (let i = 0; i < operationMembers.length; i++) {
    const rowStart = sectionRow + Math.floor(i / 4) * 5;
    await writeOrgCard(operationMembers[i], rowStart, cardCols[i % 4], false);
  }
  sectionRow += Math.max(1, Math.ceil(operationMembers.length / 4)) * 5;

  writeSectionHeader(sectionRow, `관리 · ${managementMembers.length}명`);
  sectionRow++;
  for (let i = 0; i < managementMembers.length; i++) {
    const rowStart = sectionRow + Math.floor(i / 4) * 5;
    await writeOrgCard(managementMembers[i], rowStart, cardCols[i % 4], false);
  }
  sectionRow += Math.max(1, Math.ceil(managementMembers.length / 4)) * 5;

  const teamHeaderRow = sectionRow;
  const teamStarts = [1, 7, 13, 19];
  for (let i = 0; i < 4; i++) {
    const teamName = `${i + 1}팀`;
    orgChart.mergeCells(teamHeaderRow, teamStarts[i], teamHeaderRow, teamStarts[i] + 4);
    const header = orgChart.getCell(teamHeaderRow, teamStarts[i]);
    const members = sortTeamMembers(ordered.filter(u => u.department === teamName));
    header.value = `${teamName} · ${members.length}명`;
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF243B5A' } };
    header.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    header.alignment = { horizontal: 'center', vertical: 'middle' };
    orgChart.getRow(teamHeaderRow).height = 23;
    for (let j = 0; j < members.length; j++) {
      const memberRow = teamHeaderRow + 1 + j * 5;
      await writeOrgCard(members[j], memberRow, teamStarts[i], true);
      orgChart.getRow(memberRow + 4).height = 23.25;
    }
  }

  let extraRow = teamHeaderRow + 1 + Math.max(1, ...[1, 2, 3, 4].map(n => ordered.filter(u => u.department === `${n}팀`).length)) * 5;
  for (const dept of extraDepartments) {
    const members = ordered.filter(u => (u.department || '미지정') === dept);
    if (!members.length) continue;
    writeSectionHeader(extraRow, `${dept} · ${members.length}명`);
    extraRow++;
    for (let j = 0; j < members.length; j++) {
      await writeOrgCard(members[j], extraRow + Math.floor(j / 4) * 5, cardCols[j % 4], false);
    }
    extraRow += Math.max(1, Math.ceil(members.length / 4)) * 5 + 1;
  }

  orgChart.views = [{ state: 'frozen', ySplit: 6 }];
  orgChart.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  orgChart.properties.defaultRowHeight = 18;

  const memberInfoOrder: Record<string, number> = { 본부장: 0, 소장: 1, 사원: 2, 책임: 3, 프로: 4, 매니저: 5 };
  const memberInfoUsers = [...ordered].sort((a, b) => {
    const keyA = (a.job_title || '').trim() === '본부장' || (a.job_title || '').trim() === '소장'
      ? (a.job_title || '').trim() : (a.position || '').trim();
    const keyB = (b.job_title || '').trim() === '본부장' || (b.job_title || '').trim() === '소장'
      ? (b.job_title || '').trim() : (b.position || '').trim();
    const rankDiff = (memberInfoOrder[keyA] ?? 99) - (memberInfoOrder[keyB] ?? 99);
    if (rankDiff) return rankDiff;
    const deptDiff = DEPT_ORDER.indexOf(a.department || '') - DEPT_ORDER.indexOf(b.department || '');
    return deptDiff || (a.display_order ?? 9999) - (b.display_order ?? 9999) || (a.name || '').localeCompare(b.name || '', 'ko');
  });
  
  const sheet = workbook.addWorksheet('구성원정보');
  sheet.columns = [
    { header: '사진', key: 'photo', width: 12.8 },
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

  for (let index = 0; index < memberInfoUsers.length; index += 1) {
    const u = memberInfoUsers[index];
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
    });

    row.height = 63.75;
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
        tl: { col: 0.1, row: row.number - 1 + 0.05 } as any,
        ext: { width: 96, height: 85 },
        editAs: 'oneCell',
      });
    } else {
      row.getCell('photo').value = '사진 없음';
      row.getCell('photo').font = { name: '맑은 고딕', size: 9, color: { argb: 'FF94A3B8' } };
    }
  }

  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: `P${Math.max(1, memberInfoUsers.length + 1)}` };

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

  // 인원 박스 및 사진(원) 규격:
  // 박스: 너비 4.45cm (1.75인치), 높이 1.02cm (0.40인치)
  // 원(사진): 너비 0.73cm (0.29인치), 높이 1.07cm (0.42인치)
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
      shadow: { type: 'outer', color: 'B8C2D1', blur: 1, angle: 45, opacity: 0.12 },
    });

    const photo = await getPhoto(user);
    const ovalW = 0.29;
    const ovalH = 0.42;
    const photoX = x + 0.08;
    const photoY = y + (h - ovalH) / 2;

    if (photo) {
      slide.addImage({ data: photo, x: photoX, y: photoY, w: ovalW, h: ovalH });
    } else {
      slide.addShape(pptx.ShapeType.ellipse, {
        x: photoX, y: photoY, w: ovalW, h: ovalH,
        fill: { color: leader ? '243B5A' : 'E8EDF3' },
        line: { color: leader ? '243B5A' : 'D7DEE8', width: 1 },
      });
      addText(slide, user.name?.[0] || '유', photoX, photoY + ovalH * 0.25, ovalW, 0.15, {
        fontSize: 6.5,
        bold: true,
        color: leader ? 'FFFFFF' : '243B5A',
        align: 'center',
      });
    }

    const tx = x + ovalW + 0.14;
    const tw = w - ovalW - 0.22;
    addText(slide, user.name || '', tx, y + 0.05, tw, 0.16, {
      fontSize: compact ? 8 : 9,
      bold: true,
      color: '1F2937',
    });
    addText(
      slide,
      [user.position, (user.department && /^[1-4]팀$/.test(user.department) && (user.job_title || '').trim() !== '팀장' ? '' : user.job_title)].filter(v => v && v !== '없음' && v !== '팀원').join(' · '),
      tx,
      y + 0.21,
      tw,
      0.14,
      { fontSize: compact ? 6.5 : 7.5, bold: true, color: '243B5A' },
    );
    if (!compact && displayField(user)) {
      addText(slide, displayField(user), tx, y + 0.35, tw, 0.12, {
        fontSize: 6,
        color: '64748B',
      });
    }
  };

  // 그룹 헤더 박스 규격:
  // 박스: 너비 3.02cm (1.19인치), 높이 1.27cm (0.50인치)
  const addGroupHeader = (
    slide: pptxgen.Slide,
    title: string,
    subtitle: string,
    x: number,
    y: number,
    w: number,
    h: number,
    dark = false,
  ) => {
    slide.addShape(pptx.ShapeType.roundRect, {
      x, y, w, h,
      fill: { color: dark ? '243B5A' : 'FFFFFF' },
      line: { color: dark ? '243B5A' : 'AEBAC9', width: 1.2 },
    });
    addText(slide, title, x + 0.06, y + 0.08, w - 0.12, 0.20, {
      fontSize: 9.5,
      bold: true,
      color: dark ? 'FFFFFF' : '243B5A',
      align: 'center',
    });
    addText(slide, subtitle, x + 0.06, y + 0.28, w - 0.12, 0.14, {
      fontSize: 6,
      color: dark ? 'D9E4F2' : '64748B',
      align: 'center',
    });
  };

  const operation = byDepartment('운영');
  const management = byDepartment('관리');
  const teams = ['1팀', '2팀', '3팀', '4팀'].map(name => ({ name, members: sortTeamMembers(byDepartment(name)) }));
  const hasOrgData = operation.length || management.length || teams.some(t => t.members.length);

  if (hasOrgData) {
    const slide = pptx.addSlide();
    slide.background = { color: 'F5F6F8' };
    addText(slide, '조직도', 0.45, 0.15, 3.0, 0.35, { fontSize: 19, bold: true, color: '243B5A' });
    addText(slide, `총 ${ordered.length}명 · ${new Date().toLocaleDateString('ko-KR')}`, 9.1, 0.18, 3.75, 0.20, { fontSize: 8, color: '64748B', align: 'right' });

    // 좌측 상단 직급별 인원 표 배치
    const rankNames = ['본부장', '소장', '사원', '책임', '프로', '매니저'];
    const rankCount = (rank: string) => ordered.filter(u =>
      ['본부장', '소장'].includes(rank)
        ? (u.job_title || '').trim() === rank
        : (u.position || '').trim() === rank
    ).length;
    
    const statX = 0.42, statY = 0.55, statW = 2.45;
    slide.addShape(pptx.ShapeType.roundRect, {
      x: statX, y: statY, w: statW, h: 1.80,
      fill: { color: 'FFFFFF' },
      line: { color: 'D7DEE8', width: 1 },
    });
    addText(slide, '직급별 인원', statX + 0.10, statY + 0.08, statW - 0.20, 0.20, {
      fontSize: 10, bold: true, color: '243B5A',
    });
    for (let i = 0; i < rankNames.length; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = statX + 0.10 + col * 1.12;
      const y = statY + 0.36 + row * 0.42;
      
      slide.addShape(pptx.ShapeType.roundRect, {
        x, y, w: 1.08, h: 0.36,
        fill: { color: 'F8FAFC' },
        line: { color: 'E2E8F0', width: 0.5 },
      });
      addText(slide, rankNames[i], x + 0.06, y + 0.08, 0.55, 0.20, { fontSize: 7.5, color: '475569' });
      addText(slide, `${rankCount(rankNames[i])}명`, x + 0.60, y + 0.08, 0.42, 0.20, { fontSize: 8, bold: true, color: '243B5A', align: 'right' });
    }

    const groupW = 1.19; // 너비 3.02cm
    const groupH = 0.50; // 높이 1.27cm
    const personW = 1.75; // 너비 4.45cm
    const personH = 0.40; // 높이 1.02cm

    // 중앙 상단 운영 및 관리 파트 배치 (원래 구조 유지)
    const centerX = 7.95;
    const mainX = 5.05;

    // 운영 영역
    addGroupHeader(slide, '운영', `${operation.length}명`, mainX, 0.55, groupW, groupH, true);
    
    const opMembers = operation;
    const opCols = Math.max(1, Math.min(2, opMembers.length));
    const opStartX = centerX - (opCols * personW + (opCols - 1) * 0.10) / 2;
    for (let i = 0; i < opMembers.length; i++) {
      const row = Math.floor(i / 2);
      const col = i % 2;
      await addPersonCard(slide, opMembers[i], opStartX + col * (personW + 0.10), 1.15 + row * 0.46, personW, personH, false);
    }

    const opRows = Math.max(1, Math.ceil(opMembers.length / 2));
    const managementHeaderY = 1.15 + opRows * 0.46 + 0.08;

    // 관리 영역
    addGroupHeader(slide, '관리', `${management.length}명`, mainX, managementHeaderY, groupW, groupH, false);

    const mgCols = 2;
    for (let i = 0; i < management.length; i++) {
      const row = Math.floor(i / mgCols);
      const col = i % mgCols;
      const rowCount = Math.min(mgCols, management.length - row * mgCols);
      const rowW = rowCount * personW + (rowCount - 1) * 0.10;
      const rowStartX = centerX - rowW / 2;
      await addPersonCard(slide, management[i], rowStartX + col * (personW + 0.10), managementHeaderY + 0.58 + row * 0.46, personW, personH, false);
    }

    // 하단 1~4팀 영역 (4개 컬럼 구조 완벽 복원)
    const teamHeaderY = 0.55;
    const teamXs = [3.15, 6.70, 9.20, 11.70]; // 와이드 슬라이드 폭에 맞춰 1~4팀 컬럼 배치 좌표 최적화

    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      // 1~4팀 개별 헤더 박스 배치
      const headerX = 3.10 + i * 2.45;
      addGroupHeader(slide, team.name, `${team.members.length}명`, headerX, teamHeaderY, groupW, groupH, false);
      
      for (let j = 0; j < team.members.length; j++) {
        const member = team.members[j];
        const y = 1.15 + j * 0.46;
        await addPersonCard(slide, member, headerX - 0.55, y, personW, personH, true);
      }
    }
  }

  await pptx.writeFile({ fileName: `인사관리_조직도_${fileDate()}.pptx` });
}
