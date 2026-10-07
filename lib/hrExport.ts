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
      shadow: { type: 'outer', color: 'B8C2D1', blur: 1, angle: 45, distance: 1, opacity: 0.15 },
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
      [user.position, user.job_title].filter(v => v && v !== '없음').join(' · '),
      tx,
      y + 0.39,
      tw,
      0.18,
      { fontSize: compact ? 7.5 : 8.5, bold: true, color: '243B5A' },
    );
    if (!compact && user.field) {
      addText(slide, user.field, tx, y + 0.61, tw, 0.16, {
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

      // 팀장은 먼저 표시하고, 나머지는 한 줄에 최대 2명
      const teamMembers = [...team.members].sort((a, b) => {
        const aLeader = (a.job_title || '').trim() === '팀장' ? 0 : 1;
        const bLeader = (b.job_title || '').trim() === '팀장' ? 0 : 1;
        if (aLeader !== bLeader) return aLeader - bLeader;
        return (a.display_order ?? 9999) - (b.display_order ?? 9999) || a.name.localeCompare(b.name, 'ko');
      });

      const visible = teamMembers.slice(0, 3);
      for (let j = 0; j < visible.length; j++) {
        const member = visible[j];
        const y = 6.38 + j * 0.76;
        if (y > 7.05) break;
        await addPersonCard(slide, member, boxX, y, boxW, 0.58, true);
      }
      if (teamMembers.length > visible.length) {
        addText(slide, `외 ${teamMembers.length - visible.length}명`, boxX, 7.18, boxW, 0.18, {
          fontSize: 7.5, color: '64748B', align: 'center',
        });
      }
    }

    addText(slide, '※ PPT의 모든 조직 박스·연결선·텍스트·사진은 개별 편집 가능한 객체입니다.', 0.55, 7.18, 5.8, 0.18, {
      fontSize: 7, color: '94A3B8',
    });
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
