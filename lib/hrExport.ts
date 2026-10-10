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
    { header: '사진', key: 'photo', width: 14 },
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
      sheet.
