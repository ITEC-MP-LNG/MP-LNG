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
}

const DEPT_ORDER = ['운영', '관리', '1팀', '2팀', '3팀', '4팀'];

function orderedUsers(users: HRExportUser[]) {
  return [...users].sort((a, b) => {
    const da = DEPT_ORDER.indexOf(a.department || '');
    const db = DEPT_ORDER.indexOf(b.department || '');
    const deptA = da === -1 ? 99 : da;
    const deptB = db === -1 ? 99 : db;
    if (deptA !== deptB) return deptA - deptB;
    return (a.display_order ?? 9999) - (b.display_order ?? 9999) || a.name.localeCompare(b.name, 'ko');
  });
}

function fileDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export function exportHRToExcel(users: HRExportUser[]) {
  const rows = orderedUsers(users).map((u, index) => ({
    'No.': index + 1,
    '이름': u.name || '',
    '로그인 ID': u.id || '',
    '부서/팀': u.department || '',
    '직급': u.position || '',
    '직책': u.job_title || '',
    '담당분야': u.field || '',
    '전화번호': u.phone || '',
    '이메일': u.email || '',
    '주소': u.address || '',
    '입사일': u.join_date || '',
    '경력 시작일': u.career_start_date || '',
    '경력': u.experience || '',
    '사내자격': u.internal_certificates || '',
    '국가자격': u.national_certificates || u.certificates || '',
    '권한': u.role || '',
  }));

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet['!cols'] = [
    { wch: 7 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
    { wch: 14 }, { wch: 17 }, { wch: 28 }, { wch: 30 }, { wch: 13 }, { wch: 15 },
    { wch: 24 }, { wch: 28 }, { wch: 28 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(workbook, sheet, '구성원정보');

  const orgRows = orderedUsers(users).map((u, index) => ({
    '순서': index + 1,
    '부서/팀': u.department || '',
    '이름': u.name || '',
    '직책': u.job_title || '',
    '직급': u.position || '',
    '담당분야': u.field || '',
    '상위 구성원 ID': u.parent_id || '',
    '표시순서': u.display_order ?? '',
  }));
  const orgSheet = XLSX.utils.json_to_sheet(orgRows);
  orgSheet['!cols'] = [
    { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 22 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(workbook, orgSheet, '조직구조');

  XLSX.writeFile(workbook, `인사관리_${fileDate()}.xlsx`);
}

async function imageUrlToData(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
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
  const departments = DEPT_ORDER.filter(d => ordered.some(u => (u.department || '') === d));
  const extraDepartments = Array.from(new Set(ordered.map(u => u.department || '미지정').filter(d => !DEPT_ORDER.includes(d))));
  departments.push(...extraDepartments);

  const photoCache = new Map<string, string | null>();
  const getPhoto = async (user: HRExportUser) => {
    if (!user.photo_url) return null;
    if (!photoCache.has(user.photo_url)) photoCache.set(user.photo_url, await imageUrlToData(user.photo_url));
    return photoCache.get(user.photo_url) || null;
  };

  // 표지
  {
    const slide = pptx.addSlide();
    slide.background = { color: 'F5F6F8' };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: 'F5F6F8' }, line: { color: 'F5F6F8' } });
    slide.addShape(pptx.ShapeType.rect, { x: 0.65, y: 0.65, w: 0.12, h: 1.0, fill: { color: '243B5A' }, line: { color: '243B5A' } });
    addText(slide, '인사 관리', 1.0, 0.72, 6.5, 0.55, { fontSize: 26, bold: true, color: '1F2937' });
    addText(slide, '구성원 조직도 및 인사 현황', 1.0, 1.35, 6.5, 0.4, { fontSize: 16, color: '64748B' });
    addText(slide, `총 구성원 ${ordered.length}명`, 1.0, 2.15, 4, 0.4, { fontSize: 14, bold: true, color: '243B5A' });
    addText(slide, `작성일 ${new Date().toLocaleDateString('ko-KR')}`, 1.0, 2.6, 4, 0.35, { fontSize: 11, color: '64748B' });
  }

  // 부서별 슬라이드. 모든 구성요소를 PPT 도형/텍스트로 생성합니다.
  for (const department of departments) {
    const members = ordered.filter(u => (u.department || '미지정') === department);
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
      addText(slide, department, 0.55, 0.35, 4.5, 0.45, { fontSize: 20, bold: true, color: '243B5A' });
      addText(slide, `${members.length}명`, 10.9, 0.39, 1.6, 0.3, { fontSize: 10, color: '64748B', align: 'right' });
      if (members.length > perSlide) {
        addText(slide, `${Math.floor(pageStart / perSlide) + 1} / ${Math.ceil(members.length / perSlide)}`, 9.7, 0.39, 1.0, 0.3, { fontSize: 9, color: '94A3B8', align: 'right' });
      }
      slide.addShape(pptx.ShapeType.line, { x: 0.55, y: 0.9, w: 12.2, h: 0, line: { color: 'CBD5E1', width: 1 } });

      for (let i = 0; i < pageMembers.length; i++) {
        const user = pageMembers[i];
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = startX + col * (cardW + gap);
        const y = startY + row * (cardH + gap);

        slide.addShape(pptx.ShapeType.roundRect, {
          x, y, w: cardW, h: cardH,
          fill: { color: 'FFFFFF' },
          line: {
            color: user.job_title === '팀장' || user.job_title === '본부장' || user.job_title === '소장' ? '243B5A' : 'E2E5E9',
            width: 1,
          },
        });

        const photo = await getPhoto(user);
        if (photo) {
          slide.addImage({ data: photo, x: x + 0.15, y: y + 0.2, w: 0.72, h: 0.92 });
        } else {
          slide.addShape(pptx.ShapeType.ellipse, {
            x: x + 0.18, y: y + 0.27, w: 0.62, h: 0.62,
            fill: { color: user.job_title === '팀장' ? '243B5A' : 'E2E8F0' },
            line: { color: 'E2E5E9', width: 1 },
          });
          addText(slide, user.name?.[0] || '유', x + 0.18, y + 0.39, 0.62, 0.25, {
            fontSize: 13,
            bold: true,
            color: user.job_title === '팀장' ? 'FFFFFF' : '243B5A',
            align: 'center',
          });
        }

        addText(slide, user.name || '', x + 1.0, y + 0.2, cardW - 1.15, 0.3, { fontSize: 13, bold: true, color: '1F2937' });
        addText(slide, [user.position, user.job_title].filter(v => v && v !== '없음').join(' · '), x + 1.0, y + 0.55, cardW - 1.15, 0.25, { fontSize: 9, bold: true, color: '243B5A' });
        addText(slide, user.field || '', x + 1.0, y + 0.85, cardW - 1.15, 0.22, { fontSize: 8.5, color: '64748B' });
        addText(slide, user.phone || '', x + 1.0, y + 1.12, cardW - 1.15, 0.2, { fontSize: 8, color: '64748B' });
      }
    }
  }

  await pptx.writeFile({ fileName: `인사관리_조직도_${fileDate()}.pptx` });
}
