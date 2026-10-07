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

  const addText = (
    slide: pptxgen.Slide,
    text: string,
    x: number,
    y: number,
    w: number,
    h: number,
    options: any = {},
  ) => {
    slide.addText(text || '', {
      x, y, w, h,
      margin: 0,
      fontFace: 'Malgun Gothic',
      color: '1F2937',
      fit: 'shrink',
      valign: 'mid',
      ...options,
    });
  };

  const addPersonRow = async (
    slide: pptxgen.Slide,
    user: HRExportUser,
    x: number,
    y: number,
    w: number,
    h: number,
    compact = false,
  ) => {
    const leader = ['본부장', '소장', '팀장'].includes((user.job_title || '').trim());
    const photo = await getPhoto(user);
    const photoSize = Math.min(h - 0.08, compact ? 0.25 : 0.34);
    const photoY = y + (h - photoSize) / 2;

    slide.addShape(pptx.ShapeType.roundRect, {
      x, y, w, h,
      rectRadius: 0.04,
      fill: { color: 'FFFFFF' },
      line: { color: leader ? '9AAEC5' : 'DCE3EA', width: leader ? 1.1 : 0.7 },
    });

    if (photo) {
      slide.addImage({ data: photo, x: x + 0.06, y: photoY, w: photoSize, h: photoSize });
    } else {
      slide.addShape(pptx.ShapeType.ellipse, {
        x: x + 0.06, y: photoY, w: photoSize, h: photoSize,
        fill: { color: leader ? '243B5A' : 'E8EDF3' },
        line: { color: leader ? '243B5A' : 'D7DEE8', width: 0.6 },
      });
      addText(slide, user.name?.[0] || '유', x + 0.06, photoY + photoSize * 0.18, photoSize, photoSize * 0.62, {
        fontSize: compact ? 5.5 : 7,
        bold: true,
        color: leader ? 'FFFFFF' : '243B5A',
        align: 'center',
      });
    }

    const textX = x + photoSize + 0.13;
    const textW = w - photoSize - 0.18;
    const title = [user.name, user.position, user.job_title].filter(Boolean).join(' · ');
    const sub = user.field || '';

    addText(slide, title, textX, y + 0.025, textW, h * 0.52, {
      fontSize: compact ? 6.6 : 8,
      bold: true,
      color: leader ? '243B5A' : '1F2937',
    });
    if (sub) {
      addText(slide, sub, textX, y + h * 0.53, textW, h * 0.36, {
        fontSize: compact ? 5.2 : 6.3,
        color: '64748B',
      });
    }
  };

  const addSection = (
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
      line: { color: dark ? '243B5A' : 'B8C4D2', width: dark ? 1.2 : 1 },
    });
    addText(slide, title, x + 0.12, y + 0.10, w - 0.24, 0.25, {
      fontSize: 12,
      bold: true,
      color: dark ? 'FFFFFF' : '243B5A',
      align: 'center',
    });
    addText(slide, subtitle, x + 0.12, y + 0.38, w - 0.24, 0.16, {
      fontSize: 6.5,
      color: dark ? 'D9E4F2' : '64748B',
      align: 'center',
    });
  };

  const operation = byDepartment('운영');
  const management = byDepartment('관리');
  const teams = ['1팀', '2팀', '3팀', '4팀'].map(name => ({
    name,
    members: byDepartment(name),
  }));

  const hasOrgData = operation.length || management.length || teams.some(t => t.members.length);

  if (hasOrgData) {
    // =====================================================
    // 1장짜리 실제 조직도
    // 운영 → 관리 → 1~4팀을 한 슬라이드 안에 모두 배치합니다.
    // 모든 박스/선/텍스트/사진은 개별 PPT 객체입니다.
    // =====================================================
    const slide = pptx.addSlide();
    slide.background = { color: 'F5F6F8' };

    addText(slide, '인사 관리 조직도', 0.45, 0.20, 5.0, 0.42, {
      fontSize: 20,
      bold: true,
      color: '243B5A',
    });
    addText(slide, `총 ${ordered.length}명 · ${new Date().toLocaleDateString('ko-KR')}`, 9.6, 0.25, 3.2, 0.25, {
      fontSize: 8,
      color: '64748B',
      align: 'right',
    });

    // ---------- 운영 ----------
    const opX = 3.85;
    const opY = 0.78;
    const opW = 5.65;
    const opHeaderH = 0.64;
    addSection(slide, '운영', '본부장 / 소장 / 사무', opX, opY, opW, opHeaderH, true);

    const opCount = Math.max(1, Math.min(operation.length, 4));
    const opGap = 0.10;
    const opCardW = (opW - 0.24 - opGap * (opCount - 1)) / opCount;
    const opCardY = opY + 0.72;
    for (let i = 0; i < Math.min(operation.length, 4); i++) {
      await addPersonRow(slide, operation[i], opX + 0.12 + i * (opCardW + opGap), opCardY, opCardW, 0.72, true);
    }

    // 운영 → 관리
    const centerX = 6.6665;
    slide.addShape(pptx.ShapeType.line, {
      x: centerX, y: 2.23, w: 0, h: 0.34,
      line: { color: '94A3B8', width: 1.4, beginArrowType: 'none', endArrowType: 'triangle' },
    });

    // ---------- 관리 ----------
    const mgX = 2.85;
    const mgY = 2.62;
    const mgW = 7.65;
    const mgHeaderH = 0.64;
    addSection(slide, '관리', 'QA / 공정 / 스케줄 / 기타 관리 분야', mgX, mgY, mgW, mgHeaderH);

    const mgCount = Math.min(Math.max(management.length, 1), 5);
    const mgGap = 0.10;
    const mgCardW = (mgW - 0.24 - mgGap * (mgCount - 1)) / mgCount;
    for (let i = 0; i < Math.min(management.length, 5); i++) {
      await addPersonRow(slide, management[i], mgX + 0.12 + i * (mgCardW + mgGap), mgY + 0.72, mgCardW, 0.70, true);
    }

    // 관리 → 4개 팀 공통 연결선
    const teamTop = 5.02;
    const teamXs = [0.38, 3.58, 6.78, 9.98];
    const teamW = 2.60;
    const teamCenters = teamXs.map(x => x + teamW / 2);
    slide.addShape(pptx.ShapeType.line, {
      x: centerX, y: 4.03, w: 0, h: 0.48,
      line: { color: '94A3B8', width: 1.4 },
    });
    slide.addShape(pptx.ShapeType.line, {
      x: teamCenters[0], y: 4.51, w: teamCenters[3] - teamCenters[0], h: 0,
      line: { color: '94A3B8', width: 1.4 },
    });

    // ---------- 1~4팀 ----------
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      const x = teamXs[i];
      const members = [...team.members].sort((a, b) => {
        const aLeader = (a.job_title || '').trim() === '팀장' ? 0 : 1;
        const bLeader = (b.job_title || '').trim() === '팀장' ? 0 : 1;
        if (aLeader !== bLeader) return aLeader - bLeader;
        return (a.display_order ?? 9999) - (b.display_order ?? 9999) || a.name.localeCompare(b.name, 'ko');
      });

      slide.addShape(pptx.ShapeType.line, {
        x: teamCenters[i], y: 4.51, w: 0, h: 0.40,
        line: { color: '94A3B8', width: 1.4, endArrowType: 'triangle' },
      });

      const teamH = 2.05;
      addSection(slide, team.name, `${members.length}명`, x, teamTop, teamW, 0.56, false);

      // 한 장에 들어갈 수 있도록 팀 구성원은 compact row로 배치합니다.
      const maxVisible = 7;
      const visible = members.slice(0, maxVisible);
      const rowH = 0.18;
      const rowGap = 0.055;
      for (let j = 0; j < visible.length; j++) {
        await addPersonRow(
          slide,
          visible[j],
          x + 0.08,
          teamTop + 0.64 + j * (rowH + rowGap),
          teamW - 0.16,
          rowH,
          true,
        );
      }
      if (members.length > visible.length) {
        addText(slide, `외 ${members.length - visible.length}명`, x + 0.08, teamTop + 1.88, teamW - 0.16, 0.14, {
          fontSize: 5.5,
          color: '64748B',
          align: 'center',
        });
      }
    }

    addText(slide, '※ 조직 박스·연결선·텍스트·사진은 PowerPoint에서 개별 편집할 수 있습니다.', 0.45, 7.18, 7.5, 0.16, {
      fontSize: 6.5,
      color: '94A3B8',
    });
  } else {
    const slide = pptx.addSlide();
    slide.background = { color: 'F5F6F8' };
    addText(slide, '표시할 조직원이 없습니다.', 4.2, 3.4, 5.0, 0.4, {
      fontSize: 16, color: '64748B', align: 'center',
    });
  }

  // 조직도 목적의 출력이므로 표지/부서별 상세 슬라이드는 만들지 않습니다.
  await pptx.writeFile({ fileName: `인사관리_조직도_${fileDate()}.pptx` });
}
