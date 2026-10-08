import * as XLSX from 'xlsx';
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
}

const DEPT_ORDER = ['운영', '관리', '1팀', '2팀', '3팀', '4팀'];
const RANK_ORDER: Record<string, number> = { '책임': 1, '프로': 2, '매니저': 3, '사원': 4 };

function activeUsers(users: HRExportUser[]) {
  return users.filter(u => !u.is_retired && u.department !== '퇴사자');
}

function careerDays(u: HRExportUser) {
  if (!u.career_start_date) return 0;
  const d = new Date(u.career_start_date);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

function teamRank(u: HRExportUser) {
  return RANK_ORDER[u.position || ''] ?? 99;
}

function isTeamLeader(u: HRExportUser) {
  return (u.department || '').match(/^[1-4]팀$/) && u.job_title === '팀장';
}

function sortUsers(users: HRExportUser[]) {
  return [...users].sort((a, b) => {
    const da = DEPT_ORDER.indexOf(a.department || '');
    const db = DEPT_ORDER.indexOf(b.department || '');
    const deptA = da < 0 ? 99 : da;
    const deptB = db < 0 ? 99 : db;
    if (deptA !== deptB) return deptA - deptB;

    const teamA = (a.department || '').match(/^[1-4]팀$/) ? 1 : 0;
    const teamB = (b.department || '').match(/^[1-4]팀$/) ? 1 : 0;
    if (teamA || teamB) {
      const leaderA = isTeamLeader(a) ? 0 : 1;
      const leaderB = isTeamLeader(b) ? 0 : 1;
      if (leaderA !== leaderB) return leaderA - leaderB;
      const rankA = teamRank(a);
      const rankB = teamRank(b);
      if (rankA !== rankB) return rankA - rankB;
      const expA = careerDays(a);
      const expB = careerDays(b);
      if (expA !== expB) return expB - expA;
    }
    return (a.display_order ?? 9999) - (b.display_order ?? 9999) || (a.name || '').localeCompare(b.name || '', 'ko');
  });
}

function fileDate() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function careerText(u: HRExportUser) {
  if (u.experience?.trim()) return u.experience.trim();
  if (!u.career_start_date) return '';
  const d = new Date(u.career_start_date);
  if (Number.isNaN(d.getTime())) return '';
  const years = Math.max(0, new Date().getFullYear() - d.getFullYear() - (
    new Date().getMonth() < d.getMonth() ||
    (new Date().getMonth() === d.getMonth() && new Date().getDate() < d.getDate()) ? 1 : 0
  ));
  return `${years}년`;
}

function displayPosition(u: HRExportUser) {
  if ((u.department || '').match(/^[1-4]팀$/)) {
    return isTeamLeader(u) ? `${u.position || ''} · 팀장` : (u.position || '');
  }
  return [u.position, u.job_title].filter(v => v && v !== '없음' && v !== '팀원').join(' · ');
}

function displayField(u: HRExportUser) {
  if ((u.department || '').match(/^[1-4]팀$/)) return '';
  if (u.department === '운영' && (u.job_title === '본부장' || u.job_title === '소장')) return '';
  return u.field || '';
}

export function exportHRToExcel(users: HRExportUser[]) {
  const all = sortUsers(activeUsers(users));
  const workbook = XLSX.utils.book_new();

  const rows = all.map((u, index) => ({
    'No.': index + 1,
    '부서/팀': u.department || '',
    '이름': u.name || '',
    '직급': u.position || '',
    '직책': u.job_title || '',
    '담당분야': displayField(u),
    '전화번호': u.phone || '',
    '경력': careerText(u),
    '경력 시작일': u.career_start_date || '',
    '입사일': u.join_date || '',
    '사진': u.photo_url || '',
    '로그인 ID': u.id || '',
    '이메일': u.email || '',
    '주소': u.address || '',
    '사내자격': u.internal_certificates || '',
    '국가자격': u.national_certificates || u.certificates || '',
    '상위 구성원 ID': u.parent_id || '',
    '표시순서': u.display_order ?? '',
  }));

  const info = XLSX.utils.json_to_sheet(rows);
  info['!cols'] = [
    { wch: 7 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 },
    { wch: 17 }, { wch: 14 }, { wch: 15 }, { wch: 13 }, { wch: 42 }, { wch: 18 },
    { wch: 28 }, { wch: 30 }, { wch: 28 }, { wch: 28 }, { wch: 22 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(workbook, info, '구성원정보');

  // 조직도 형태: 부서/팀 → 구성원 순서의 트리 구조를 한 장의 시트로 구성
  const treeRows: any[][] = [
    ['조직도', '', '', '', '', '', ''],
    ['총 구성원', `${all.length}명`, '', '', '', '', ''],
    [],
    ['구분', '이름', '직급', '직책', '담당분야', '전화번호', '경력'],
  ];

  for (const dept of DEPT_ORDER) {
    const members = all.filter(u => u.department === dept);
    if (!members.length) continue;
    treeRows.push([dept, '', '', '', '', '', '']);
    for (const u of members) {
      treeRows.push([
        `  └ ${dept}`,
        u.name || '',
        u.position || '',
        displayPosition(u).replace(`${u.position || ''} · `, '') || '',
        displayField(u),
        u.phone || '',
        careerText(u),
      ]);
    }
  }

  const tree = XLSX.utils.aoa_to_sheet(treeRows);
  tree['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 16 }];
  tree['!freeze'] = { xSplit: 0, ySplit: 4 };
  XLSX.utils.book_append_sheet(workbook, tree, '조직도');

  XLSX.writeFile(workbook, `인사관리_${fileDate()}.xlsx`);
}

async function imageUrlToData(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function addText(slide: any, text: string, x: number, y: number, w: number, h: number, options: any = {}) {
  slide.addText(text || '', {
    x, y, w, h,
    margin: 0,
    fontFace: 'Malgun Gothic',
    color: '1F2937',
    fit: 'shrink',
    valign: 'mid',
    ...options,
  });
}

export async function exportHRToPptx(users: HRExportUser[]) {
  const all = sortUsers(activeUsers(users));
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = '인사 관리';
  pptx.subject = '구성원 조직도';
  pptx.title = '인사 관리 조직도';
  pptx.company = 'MP-LNG';

  const slide = pptx.addSlide();
  slide.background = { color: 'F5F6F8' };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: 'F5F6F8' }, line: { color: 'F5F6F8' } });

  addText(slide, '인사 관리 조직도', 0.55, 0.28, 6.0, 0.45, { fontSize: 23, bold: true, color: '243B5A' });
  addText(slide, `기준일 ${new Date().toLocaleDateString('ko-KR')}`, 0.55, 0.72, 3.5, 0.25, { fontSize: 9, color: '64748B' });

  // 우측 상단 요약
  slide.addShape(pptx.ShapeType.roundRect, { x: 10.45, y: 0.25, w: 2.25, h: 0.72, rectRadius: 0.08, fill: { color: 'FFFFFF' }, line: { color: 'E2E5E9', width: 1 } });
  addText(slide, '총 인원', 10.65, 0.37, 0.65, 0.2, { fontSize: 9, bold: true, color: '64748B' });
  addText(slide, `${all.length}명`, 11.25, 0.32, 1.2, 0.3, { fontSize: 17, bold: true, color: '243B5A', align: 'right' });

  const left = 0.55;
  const right = 12.78;
  const sectionY = 1.15;
  const sectionW = 12.23;
  const headerH = 0.42;
  const cardGap = 0.12;
  const cardW = 2.86;
  const cardH = 1.08;
  const startY = sectionY + 0.55;

  const photoCache = new Map<string, string | null>();
  const getPhoto = async (u: HRExportUser) => {
    if (!u.photo_url) return null;
    if (!photoCache.has(u.photo_url)) photoCache.set(u.photo_url, await imageUrlToData(u.photo_url));
    return photoCache.get(u.photo_url) || null;
  };

  // 운영/관리
  for (const dept of ['운영', '관리']) {
    const members = all.filter(u => u.department === dept);
    if (!members.length) continue;
    const y = dept === '운영' ? sectionY : 3.05;
    slide.addShape(pptx.ShapeType.roundRect, { x: left, y, w: sectionW, h: headerH, rectRadius: 0.05, fill: { color: '243B5A' }, line: { color: '243B5A' } });
    addText(slide, dept, left + 0.15, y + 0.06, 1.2, 0.25, { fontSize: 11, bold: true, color: 'FFFFFF' });
    addText(slide, `${members.length}명`, right - 0.8, y + 0.07, 0.55, 0.2, { fontSize: 8.5, color: 'FFFFFF', align: 'right' });

    const cols = Math.min(4, Math.max(1, members.length));
    const gap = cardGap;
    const width = (sectionW - gap * (cols - 1)) / cols;
    const rowY = y + headerH + 0.12;
    for (let i = 0; i < Math.min(members.length, 4); i++) {
      const u = members[i];
      const x = left + i * (width + gap);
      slide.addShape(pptx.ShapeType.roundRect, { x, y: rowY, w: width, h: cardH, rectRadius: 0.06, fill: { color: 'FFFFFF' }, line: { color: 'E2E5E9', width: 1 } });
      const photo = await getPhoto(u);
      if (photo) slide.addImage({ data: photo, x: x + 0.1, y: rowY + 0.11, w: 0.62, h: 0.82 });
      else slide.addShape(pptx.ShapeType.ellipse, { x: x + 0.13, y: rowY + 0.22, w: 0.58, h: 0.58, fill: { color: 'E2E8F0' }, line: { color: 'E2E5E9' } });
      addText(slide, u.name, x + 0.82, rowY + 0.13, width - 0.92, 0.23, { fontSize: 11, bold: true });
      addText(slide, displayPosition(u), x + 0.82, rowY + 0.39, width - 0.92, 0.2, { fontSize: 8.5, bold: true, color: '243B5A' });
      addText(slide, displayField(u), x + 0.82, rowY + 0.62, width - 0.92, 0.18, { fontSize: 7.5, color: '64748B' });
      addText(slide, u.phone || '', x + 0.82, rowY + 0.82, width - 0.92, 0.16, { fontSize: 7.5, color: '64748B' });
    }
  }

  // 4개 팀을 한 페이지 하단에 고정 배치
  const teamY = 4.72;
  const teamGap = 0.13;
  const teamW = (sectionW - teamGap * 3) / 4;
  for (let i = 0; i < 4; i++) {
    const dept = `${i + 1}팀`;
    const members = all.filter(u => u.department === dept);
    const x = left + i * (teamW + teamGap);
    slide.addShape(pptx.ShapeType.roundRect, { x, y: teamY, w: teamW, h: 2.15, rectRadius: 0.06, fill: { color: 'FFFFFF' }, line: { color: 'E2E5E9', width: 1 } });
    slide.addShape(pptx.ShapeType.roundRect, { x, y: teamY, w: teamW, h: 0.42, rectRadius: 0.05, fill: { color: '243B5A' }, line: { color: '243B5A' } });
    addText(slide, dept, x + 0.12, teamY + 0.07, 0.8, 0.2, { fontSize: 10, bold: true, color: 'FFFFFF' });
    addText(slide, `${members.length}명`, x + teamW - 0.65, teamY + 0.08, 0.5, 0.18, { fontSize: 7.5, color: 'FFFFFF', align: 'right' });

    const teamMembers = [...members].sort((a, b) => {
      const leaderA = isTeamLeader(a) ? 0 : 1;
      const leaderB = isTeamLeader(b) ? 0 : 1;
      if (leaderA !== leaderB) return leaderA - leaderB;
      const rankA = teamRank(a), rankB = teamRank(b);
      if (rankA !== rankB) return rankA - rankB;
      const expA = careerDays(a), expB = careerDays(b);
      if (expA !== expB) return expB - expA;
      return (a.name || '').localeCompare(b.name || '', 'ko');
    });

    const visible = teamMembers.slice(0, 4);
    for (let j = 0; j < visible.length; j++) {
      const u = visible[j];
      const y = teamY + 0.52 + j * 0.38;
      const photo = await getPhoto(u);
      if (photo) slide.addImage({ data: photo, x: x + 0.1, y: y + 0.02, w: 0.28, h: 0.31 });
      addText(slide, u.name, x + 0.45, y, 0.72, 0.18, { fontSize: 8.5, bold: true });
      addText(slide, isTeamLeader(u) ? `${u.position || ''} · 팀장` : (u.position || ''), x + 1.16, y, teamW - 1.27, 0.18, { fontSize: 7.2, color: '243B5A' });
      addText(slide, u.phone || '', x + 0.45, y + 0.18, teamW - 0.55, 0.13, { fontSize: 6.5, color: '64748B' });
    }
    if (teamMembers.length > 4) addText(slide, `외 ${teamMembers.length - 4}명`, x + 0.1, teamY + 2.0, teamW - 0.2, 0.12, { fontSize: 6.5, color: '94A3B8', align: 'right' });
  }

  await pptx.writeFile({ fileName: `인사관리_조직도_${fileDate()}.pptx` });
}
