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
  is_retired?: boolean;
  resignation_date?: string | null;
}

const COLORS = {
  pageBg: 'F5F6F8',
  white: 'FFFFFF',
  primary: '243B5A',
  primaryHover: '1D3049',
  text: '1F2937',
  muted: '64748B',
  border: 'E2E5E9',
  leaderBorder: '243B5A',
  leaderRing: 'DCE5F0',
  memberAvatar: 'E2E8F0',
  memberAvatarText: '243B5A',
  sectionBg: 'F5F6F8',
  line: 'AAB7C6',
  blueLight: 'EFF6FF',
  blueBorder: 'BFDBFE',
};

const DEPT_ORDER = ['운영', '관리', '1팀', '2팀', '3팀', '4팀'];
const TEAM_NAMES = ['1팀', '2팀', '3팀', '4팀'];
const LEADER_TITLES = ['본부장', '소장', '팀장'];

function isActiveUser(user: HRExportUser) {
  return !user.is_retired && user.department !== '퇴사자';
}

function clean(value?: string | null) {
  return String(value || '').trim();
}

function isLeader(user: HRExportUser) {
  return LEADER_TITLES.includes(clean(user.job_title));
}

function sortUsers(users: HRExportUser[]) {
  return [...users].sort((a, b) => {
    const da = DEPT_ORDER.indexOf(clean(a.department));
    const db = DEPT_ORDER.indexOf(clean(b.department));
    const deptA = da < 0 ? 99 : da;
    const deptB = db < 0 ? 99 : db;
    if (deptA !== deptB) return deptA - deptB;

    const leaderA = isLeader(a) ? 0 : 1;
    const leaderB = isLeader(b) ? 0 : 1;
    if (leaderA !== leaderB) return leaderA - leaderB;

    const orderA = a.display_order ?? 9999;
    const orderB = b.display_order ?? 9999;
    if (orderA !== orderB) return orderA - orderB;
    return clean(a.name).localeCompare(clean(b.name), 'ko');
  });
}

function activeUsers(users: HRExportUser[]) {
  return sortUsers(users.filter(isActiveUser));
}

function fileDate() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function formatPhone(phone?: string) {
  return clean(phone) || '-';
}

function formatCareer(user: HRExportUser) {
  return clean(user.experience) || '-';
}

/**
 * 출력 규칙
 * - 운영/관리: 담당분야(field) 표시
 * - 운영의 본부장/소장: field가 '사무'인 경우 표시하지 않음
 * - 1~4팀: field는 표시하지 않음
 * - 1~4팀 팀장: 직급 + '팀장'
 * - 1~4팀 팀원: 직급만
 */
function getDisplayLines(user: HRExportUser) {
  const department = clean(user.department);
  const position = clean(user.position) || '사원';
  const title = clean(user.job_title);
  const field = clean(user.field);

  const lines: string[] = [];

  if (department === '1팀' || department === '2팀' || department === '3팀' || department === '4팀') {
    if (title === '팀장') lines.push(`${position} · 팀장`);
    else lines.push(position);
    return lines;
  }

  if (position && title && title !== '없음') lines.push(`${position} · ${title}`);
  else lines.push(position);

  if (field && !(department === '운영' && ['본부장', '소장'].includes(title) && field === '사무')) {
    lines.push(field);
  }

  return lines;
}

async function imageUrlToData(url?: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();

    // ExcelJS는 브라우저에서 WebP를 그대로 이미지 객체로 넣는 경우 호환성이 떨어질 수 있으므로
    // WebP는 PNG data URL로 변환합니다. JPG/PNG는 원본을 그대로 사용합니다.
    if (blob.type === 'image/webp') {
      const objectUrl = URL.createObjectURL(blob);
      try {
        const pngData = await new Promise<string | null>((resolve) => {
          const image = new Image();
          image.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = image.naturalWidth || image.width;
              canvas.height = image.naturalHeight || image.height;
              const ctx = canvas.getContext('2d');
              if (!ctx) { resolve(null); return; }
              ctx.drawImage(image, 0, 0);
              resolve(canvas.toDataURL('image/png'));
            } catch {
              resolve(null);
            }
          };
          image.onerror = () => resolve(null);
          image.src = objectUrl;
        });
        if (pngData) return pngData;
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    }

    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function photoExtension(data: string) {
  return data.startsWith('data:image/png') ? 'png' : 'jpeg';
}

/* =========================================================
 * Excel
 * ========================================================= */
export async function exportHRToExcel(users: HRExportUser[]) {
  const usersActive = activeUsers(users);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '인사 관리';
  workbook.company = 'MP-LNG';
  workbook.subject = '인사 관리 조직도';
  workbook.title = '인사 관리 조직도';

  const sheet = workbook.addWorksheet('조직도');
  sheet.pageSetup = {
    orientation: 'landscape',
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    horizontalDpi: 300,
    verticalDpi: 300,
  };

  // 29 columns. Four teams occupy the lower section in a tree-like layout.
  for (let c = 1; c <= 29; c += 1) sheet.getColumn(c).width = 4.1;
  sheet.getColumn(1).width = 1.8;
  sheet.getColumn(2).width = 5.0;
  sheet.getColumn(29).width = 2.0;

  const merge = (range: string, value: string, style: Partial<ExcelJS.Style> = {}) => {
    sheet.mergeCells(range);
    const cell = sheet.getCell(range.split(':')[0]);
    cell.value = value;
    Object.assign(cell, style);
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true, ...(style.alignment || {}) };
    return cell;
  };

  const applyBox = (range: string, fill = COLORS.white, line = COLORS.border, width: 'thin' | 'medium' = 'thin') => {
    const [start, end] = range.split(':');
    const parseAddress = (address: string) => {
      const match = address.match(/^([A-Z]+)(\d+)$/i);
      if (!match) throw new Error(`잘못된 셀 주소: ${address}`);
      let col = 0;
      for (const ch of match[1].toUpperCase()) {
        col = col * 26 + ch.charCodeAt(0) - 64;
      }
      return { row: Number(match[2]), col };
    };
    const s = parseAddress(start);
    const e = parseAddress(end);
    const minRow = Math.min(s.row, e.row);
    const maxRow = Math.max(s.row, e.row);
    const minCol = Math.min(s.col, e.col);
    const maxCol = Math.max(s.col, e.col);
    for (let r = minRow; r <= maxRow; r += 1) {
      for (let c = minCol; c <= maxCol; c += 1) {
        const cell = sheet.getCell(r, c);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${fill}` } };
        cell.border = {
          top: { style: r === minRow ? width : 'hair', color: { argb: `FF${line}` } },
          bottom: { style: r === maxRow ? width : 'hair', color: { argb: `FF${line}` } },
          left: { style: c === minCol ? width : 'hair', color: { argb: `FF${line}` } },
          right: { style: c === maxCol ? width : 'hair', color: { argb: `FF${line}` } },
        };
      }
    }
  };

  const setRow = (row: number, height: number) => { sheet.getRow(row).height = height; };
  for (let r = 1; r <= 43; r += 1) setRow(r, 16);

  // Title / date / rank summary.
  merge('B2:Q3', '인사 관리 조직도', {
    font: { name: '맑은 고딕', size: 20, bold: true, color: { argb: `FF${COLORS.primary}` } },
    alignment: { horizontal: 'left', vertical: 'middle' },
  });
  merge('S2:AB2', '직급별 인원현황', {
    font: { name: '맑은 고딕', size: 11, bold: true, color: { argb: `FFFFFFFF` } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.primary}` } },
  });

  const positionCounts = new Map<string, number>();
  usersActive.forEach((u) => {
    const p = clean(u.position) || '미지정';
    positionCounts.set(p, (positionCounts.get(p) || 0) + 1);
  });
  const positionOrder = ['본부장', '소장', '책임', '프로', '매니저', '사원'];
  const positions = [...positionCounts.keys()].sort((a, b) => {
    const ia = positionOrder.indexOf(a); const ib = positionOrder.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  positions.slice(0, 6).forEach((p, i) => {
    const r = 3 + i;
    merge(`S${r}:V${r}`, p, { font: { name: '맑은 고딕', size: 9, bold: true, color: { argb: `FF${COLORS.text}` } } });
    merge(`W${r}:X${r}`, String(positionCounts.get(p) || 0), { font: { name: '맑은 고딕', size: 9, bold: true, color: { argb: `FF${COLORS.primary}` } } });
    merge(`Y${r}:AB${r}`, '명', { font: { name: '맑은 고딕', size: 9, color: { argb: `FF${COLORS.muted}` } } });
    applyBox(`S${r}:AB${r}`);
  });
  const totalRow = 3 + Math.min(positions.length, 6) + 1;
  merge(`S${totalRow}:V${totalRow}`, '총 인원', { font: { name: '맑은 고딕', size: 10, bold: true, color: { argb: `FF${COLORS.primary}` } } });
  merge(`W${totalRow}:X${totalRow}`, String(usersActive.length), { font: { name: '맑은 고딕', size: 11, bold: true, color: { argb: `FF${COLORS.primary}` } } });
  merge(`Y${totalRow}:AB${totalRow}`, '명', { font: { name: '맑은 고딕', size: 9, color: { argb: `FF${COLORS.muted}` } } });
  applyBox(`S${totalRow}:AB${totalRow}`, COLORS.sectionBg, COLORS.primary, 'medium');

  const photoCache = new Map<string, string | null>();
  const getPhoto = async (u: HRExportUser) => {
    const key = clean(u.photo_url);
    if (!key) return null;
    if (!photoCache.has(key)) photoCache.set(key, await imageUrlToData(key));
    return photoCache.get(key) || null;
  };

  const writePerson = async (
    u: HRExportUser,
    startCol: number,
    row: number,
    cardRows: number,
    cardCols: number,
    compact = false,
  ) => {
    const endCol = startCol + cardCols - 1;
    const endRow = row + cardRows - 1;
    const range = `${sheet.getCell(row, startCol).address}:${sheet.getCell(endRow, endCol).address}`;
    applyBox(range, COLORS.white, isLeader(u) ? COLORS.primary : COLORS.border, isLeader(u) ? 'medium' : 'thin');

    // Photo occupies the left part of the card.
    const photoEndCol = startCol + 1;
    const photo = await getPhoto(u);
    const photoCell = sheet.getCell(row, startCol);
    photoCell.value = '';
    if (photo) {
      const imageId = workbook.addImage({ base64: photo, extension: photoExtension(photo) });
      sheet.addImage(imageId, {
        tl: { col: startCol - 1 + 0.16, row: row - 1 + 0.10 },
        ext: { width: compact ? 42 : 52, height: compact ? 42 : 52 },
      });
    } else {
      merge(`${sheet.getCell(row, startCol).address}:${sheet.getCell(endRow, photoEndCol).address}`, clean(u.name).charAt(0) || '유', {
        font: { name: '맑은 고딕', size: compact ? 13 : 16, bold: true, color: { argb: `FF${COLORS.memberAvatarText}` } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.memberAvatar}` } },
      });
    }

    const textStart = startCol + 2;
    const textEnd = endCol;
    merge(`${sheet.getCell(row, textStart).address}:${sheet.getCell(row, textEnd).address}`, clean(u.name), {
      font: { name: '맑은 고딕', size: compact ? 9 : 10, bold: true, color: { argb: `FF${COLORS.text}` } },
      alignment: { horizontal: 'left', vertical: 'middle' },
    });
    const lines = getDisplayLines(u);
    merge(`${sheet.getCell(row + 1, textStart).address}:${sheet.getCell(row + 1, textEnd).address}`, lines[0] || '', {
      font: { name: '맑은 고딕', size: compact ? 7.5 : 8.5, bold: true, color: { argb: `FF${COLORS.primary}` } },
      alignment: { horizontal: 'left', vertical: 'middle' },
    });
    if (lines[1]) {
      merge(`${sheet.getCell(row + 2, textStart).address}:${sheet.getCell(row + 2, textEnd).address}`, lines[1], {
        font: { name: '맑은 고딕', size: compact ? 7 : 8, color: { argb: `FF${COLORS.muted}` } },
        alignment: { horizontal: 'left', vertical: 'middle' },
      });
    }
    merge(`${sheet.getCell(endRow - 1, textStart).address}:${sheet.getCell(endRow - 1, textEnd).address}`, formatPhone(u.phone), {
      font: { name: '맑은 고딕', size: compact ? 6.5 : 7.5, color: { argb: `FF${COLORS.primary}` } },
      alignment: { horizontal: 'left', vertical: 'middle' },
    });
    merge(`${sheet.getCell(endRow, textStart).address}:${sheet.getCell(endRow, textEnd).address}`, `경력 ${formatCareer(u)}`, {
      font: { name: '맑은 고딕', size: compact ? 6.5 : 7.5, color: { argb: `FF${COLORS.muted}` } },
      alignment: { horizontal: 'left', vertical: 'middle' },
    });
  };

  // 운영
  merge('B9:Q10', '운영', {
    font: { name: '맑은 고딕', size: 12, bold: true, color: { argb: `FFFFFFFF` } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.primary}` } },
  });
  const operation = usersActive.filter(u => clean(u.department) === '운영');
  const opPositions = operation.slice(0, 5);
  const opCols = [2, 5, 8, 11, 14];
  for (let i = 0; i < opPositions.length; i += 1) await writePerson(opPositions[i], opCols[i], 11, 5, 3, true);

  // Tree connector between operation and management.
  merge('H16:K16', '│', { font: { name: '맑은 고딕', size: 12, bold: true, color: { argb: `FF${COLORS.line}` } } });
  merge('H17:K17', '▼', { font: { name: '맑은 고딕', size: 10, bold: true, color: { argb: `FF${COLORS.line}` } } });

  // 관리
  merge('B18:Q19', '관리', {
    font: { name: '맑은 고딕', size: 12, bold: true, color: { argb: `FF${COLORS.primary}` } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.sectionBg}` } },
  });
  const management = usersActive.filter(u => clean(u.department) === '관리');
  const mgCols = [2, 5, 8, 11, 14];
  for (let i = 0; i < Math.min(management.length, 5); i += 1) await writePerson(management[i], mgCols[i], 20, 5, 3, true);

  // Management to team trunk.
  merge('H25:K25', '│', { font: { name: '맑은 고딕', size: 12, bold: true, color: { argb: `FF${COLORS.line}` } } });
  merge('D26:O26', '──────────────┬──────────────┬──────────────┬──────────────', {
    font: { name: '맑은 고딕', size: 7, color: { argb: `FF${COLORS.line}` } },
  });

  // Four team columns.
  const teamStartCols = [2, 9, 16, 23];
  const teamMembers = TEAM_NAMES.map((team) => usersActive.filter(u => clean(u.department) === team));
  for (let i = 0; i < TEAM_NAMES.length; i += 1) {
    const startCol = teamStartCols[i];
    const endCol = startCol + 5;
    const team = TEAM_NAMES[i];
    merge(`${sheet.getCell(27, startCol).address}:${sheet.getCell(28, endCol).address}`, `${team}  ·  ${teamMembers[i].length}명`, {
      font: { name: '맑은 고딕', size: 11, bold: true, color: { argb: `FF${COLORS.primary}` } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.sectionBg}` } },
    });

    const members = [...teamMembers[i]].sort((a, b) => {
      const la = clean(a.job_title) === '팀장' ? 0 : 1;
      const lb = clean(b.job_title) === '팀장' ? 0 : 1;
      return la - lb || (a.display_order ?? 9999) - (b.display_order ?? 9999) || clean(a.name).localeCompare(clean(b.name), 'ko');
    });

    // Each team has 9 compact cards vertically. If there are more, continue inside the same page.
    for (let j = 0; j < Math.min(members.length, 9); j += 1) {
      await writePerson(members[j], startCol, 29 + j * 3, 3, 6, true);
    }
  }

  merge('B42:AB42', `총 ${usersActive.length}명 · ${new Date().toLocaleDateString('ko-KR')}`, {
    font: { name: '맑은 고딕', size: 8, color: { argb: `FF${COLORS.muted}` } },
    alignment: { horizontal: 'right', vertical: 'middle' },
  });

  sheet.views = [{ state: 'frozen', ySplit: 0 }];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `인사관리_조직도_${fileDate()}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/* =========================================================
 * PowerPoint
 * ========================================================= */
export async function exportHRToPptx(users: HRExportUser[]) {
  const usersActive = activeUsers(users);
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = '인사 관리';
  pptx.company = 'MP-LNG';
  pptx.subject = '인사 관리 조직도';
  pptx.title = '인사 관리 조직도';
  pptx.theme = { headFontFace: 'Malgun Gothic', bodyFontFace: 'Malgun Gothic' };

  const slide = pptx.addSlide();
  slide.background = { color: COLORS.pageBg };

  const photoCache = new Map<string, string | null>();
  const getPhoto = async (u: HRExportUser) => {
    const key = clean(u.photo_url);
    if (!key) return null;
    if (!photoCache.has(key)) photoCache.set(key, await imageUrlToData(key));
    return photoCache.get(key) || null;
  };

  const addText = (text: string, x: number, y: number, w: number, h: number, opts: any = {}) => {
    slide.addText(text || '', {
      x, y, w, h,
      margin: 0,
      fontFace: 'Malgun Gothic',
      color: COLORS.text,
      fit: 'shrink',
      valign: 'mid',
      ...opts,
    });
  };

  const addCard = async (
    user: HRExportUser,
    x: number,
    y: number,
    w: number,
    h: number,
    compact = false,
  ) => {
    const leader = isLeader(user);
    slide.addShape(pptx.ShapeType.roundRect, {
      x, y, w, h,
      rectRadius: 0.05,
      fill: { color: COLORS.white },
      line: { color: leader ? COLORS.primary : COLORS.border, width: leader ? 1.1 : 0.65 },
    });

    const photo = await getPhoto(user);
    const p = compact ? Math.min(0.32, h - 0.10) : Math.min(0.52, h - 0.12);
    const px = x + 0.07;
    const py = y + (h - p) / 2;
    if (photo) {
      slide.addImage({ data: photo, x: px, y: py, w: p, h: p });
    } else {
      slide.addShape(pptx.ShapeType.ellipse, {
        x: px, y: py, w: p, h: p,
        fill: { color: leader ? COLORS.primary : COLORS.memberAvatar },
        line: { color: leader ? COLORS.primary : COLORS.border, width: 0.5 },
      });
      addText(clean(user.name).charAt(0) || '유', px, py + p * 0.18, p, p * 0.60, {
        fontSize: compact ? 6.5 : 9,
        bold: true,
        align: 'center',
        color: leader ? COLORS.white : COLORS.memberAvatarText,
      });
    }

    const tx = px + p + 0.09;
    const tw = w - p - 0.17;
    const lines = getDisplayLines(user);
    addText(clean(user.name), tx, y + 0.06, tw, compact ? 0.13 : 0.18, {
      fontSize: compact ? 7.0 : 9.2,
      bold: true,
      color: COLORS.text,
    });
    addText(lines[0] || '', tx, y + (compact ? 0.20 : 0.27), tw, compact ? 0.12 : 0.15, {
      fontSize: compact ? 5.9 : 7.2,
      bold: true,
      color: COLORS.primary,
    });
    if (lines[1]) {
      addText(lines[1], tx, y + (compact ? 0.32 : 0.43), tw, compact ? 0.11 : 0.13, {
        fontSize: compact ? 5.4 : 6.4,
        color: COLORS.muted,
      });
    }
    addText(formatPhone(user.phone), tx, y + h - (compact ? 0.22 : 0.29), tw, compact ? 0.10 : 0.13, {
      fontSize: compact ? 5.0 : 6.2,
      color: COLORS.primary,
    });
    addText(`경력 ${formatCareer(user)}`, tx, y + h - (compact ? 0.11 : 0.15), tw, compact ? 0.09 : 0.10, {
      fontSize: compact ? 4.8 : 5.8,
      color: COLORS.muted,
    });
  };

  const operation = usersActive.filter(u => clean(u.department) === '운영');
  const management = usersActive.filter(u => clean(u.department) === '관리');
  const teams = TEAM_NAMES.map(name => usersActive.filter(u => clean(u.department) === name));

  // Title
  addText('인사 관리 조직도', 0.35, 0.20, 5.2, 0.35, { fontSize: 19, bold: true, color: COLORS.primary });
  addText(`총 ${usersActive.length}명 · ${new Date().toLocaleDateString('ko-KR')}`, 5.65, 0.25, 3.0, 0.20, { fontSize: 7.5, color: COLORS.muted });

  // Rank summary: right top.
  const rankX = 9.20;
  const rankY = 0.18;
  const rankW = 3.75;
  const rankH = 1.16;
  slide.addShape(pptx.ShapeType.roundRect, { x: rankX, y: rankY, w: rankW, h: rankH, rectRadius: 0.04, fill: { color: COLORS.white }, line: { color: COLORS.border, width: 0.7 } });
  addText('직급별 인원현황', rankX + 0.12, rankY + 0.08, rankW - 0.24, 0.16, { fontSize: 7.5, bold: true, color: COLORS.primary });
  const counts = new Map<string, number>();
  usersActive.forEach(u => counts.set(clean(u.position) || '미지정', (counts.get(clean(u.position) || '미지정') || 0) + 1));
  const rankOrder = ['본부장', '소장', '책임', '프로', '매니저', '사원'];
  const ranks = [...counts.keys()].sort((a,b) => (rankOrder.indexOf(a) < 0 ? 99 : rankOrder.indexOf(a)) - (rankOrder.indexOf(b) < 0 ? 99 : rankOrder.indexOf(b))).slice(0, 6);
  const cols = ranks.length > 3 ? 2 : 1;
  const cellW = (rankW - 0.24) / cols;
  ranks.forEach((r, i) => {
    const c = i % cols; const rr = Math.floor(i / cols);
    addText(`${r} ${counts.get(r)}명`, rankX + 0.12 + c * cellW, rankY + 0.30 + rr * 0.16, cellW - 0.05, 0.13, { fontSize: 5.7, color: COLORS.muted });
  });
  addText(`총 ${usersActive.length}명`, rankX + 0.12, rankY + rankH - 0.20, rankW - 0.24, 0.14, { fontSize: 6.8, bold: true, color: COLORS.primary, align: 'right' });

  // Operation: 3~5 cards centered.
  const opY = 0.95;
  addText('운영', 0.35, opY, 0.65, 0.24, { fontSize: 10.5, bold: true, color: COLORS.primary });
  const opX = 1.05;
  const opW = 2.25;
  const opGap = 0.10;
  const opVisible = operation.slice(0, 5);
  for (let i = 0; i < opVisible.length; i += 1) await addCard(opVisible[i], opX + i * (opW + opGap), opY - 0.02, opW, 0.62, true);

  // Operation -> management connector.
  slide.addShape(pptx.ShapeType.line, { x: 6.55, y: 1.62, w: 0, h: 0.18, line: { color: COLORS.line, width: 1.1, endArrowType: 'triangle' } });

  // Management.
  const mgY = 1.87;
  addText('관리', 0.35, mgY + 0.02, 0.65, 0.24, { fontSize: 10.5, bold: true, color: COLORS.primary });
  const mgX = 1.05;
  const mgW = 2.25;
  for (let i = 0; i < Math.min(management.length, 5); i += 1) await addCard(management[i], mgX + i * (mgW + opGap), mgY, mgW, 0.62, true);

  // Management -> teams connector.
  slide.addShape(pptx.ShapeType.line, { x: 6.55, y: 2.58, w: 0, h: 0.22, line: { color: COLORS.line, width: 1.1 } });
  slide.addShape(pptx.ShapeType.line, { x: 1.10, y: 2.80, w: 11.05, h: 0, line: { color: COLORS.line, width: 1.0 } });

  // Team panels: all four on one page.
  const teamY = 2.94;
  const teamX0 = 0.28;
  const teamGap = 0.12;
  const teamW = (12.80 - teamGap * 3) / 4;
  const teamH = 4.05;
  for (let i = 0; i < 4; i += 1) {
    const x = teamX0 + i * (teamW + teamGap);
    const members = [...teams[i]].sort((a,b) => (clean(a.job_title) === '팀장' ? 0 : 1) - (clean(b.job_title) === '팀장' ? 0 : 1) || (a.display_order ?? 9999) - (b.display_order ?? 9999) || clean(a.name).localeCompare(clean(b.name), 'ko'));
    slide.addShape(pptx.ShapeType.roundRect, { x, y: teamY, w: teamW, h: teamH, rectRadius: 0.05, fill: { color: COLORS.white }, line: { color: COLORS.border, width: 0.7 } });
    addText(TEAM_NAMES[i], x + 0.10, teamY + 0.10, 0.55, 0.18, { fontSize: 9.0, bold: true, color: COLORS.primary });
    addText(`${members.length}명`, x + teamW - 0.58, teamY + 0.11, 0.48, 0.16, { fontSize: 6.0, bold: true, color: COLORS.muted, align: 'right' });
    slide.addShape(pptx.ShapeType.line, { x: x + teamW / 2, y: 2.80, w: 0, h: 0.14, line: { color: COLORS.line, width: 1.0, endArrowType: 'triangle' } });

    const rowH = members.length > 9 ? 0.37 : 0.40;
    const rowGap = 0.055;
    const max = Math.min(members.length, 9);
    for (let j = 0; j < max; j += 1) {
      await addCard(members[j], x + 0.07, teamY + 0.37 + j * (rowH + rowGap), teamW - 0.14, rowH, true);
    }
    if (members.length > max) addText(`외 ${members.length - max}명`, x + 0.10, teamY + teamH - 0.20, teamW - 0.20, 0.12, { fontSize: 5.4, color: COLORS.muted, align: 'center' });
  }

  addText('※ 사진·텍스트·조직 박스·연결선은 PowerPoint에서 개별 편집할 수 있습니다.', 0.35, 7.18, 6.5, 0.12, { fontSize: 5.5, color: '94A3B8' });

  await pptx.writeFile({ fileName: `인사관리_조직도_${fileDate()}.pptx` });
}
