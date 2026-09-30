'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { OrgChart } from 'd3-org-chart';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  Users,
  Building2,
  Layers,
  List,
  FileDown,
  Maximize2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type HRUser = {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  job_title: string;
  field: string;
  role: string;
  phone: string;
  address: string;
  experience: string;
  internal_certificates: string;
  national_certificates: string;
  certificates?: string;
  join_date: string;
  career_start_date: string;
  password: string;
  pos_x?: number;
  pos_y?: number;
  birthDate?: string;
};

const DEPT_ORDER = ['운영', '관리', '1팀', '2팀', '3팀', '4팀'];

const JOB_TITLE_ORDER_IN_RANK: Record<string, number> = {
  본부장: 1,
  소장: 2,
  팀장: 3,
  팀원: 4,
  없음: 5,
};

// Props 타입 정의 추가
export interface HRManagementProps {
  isAdmin?: boolean;
  currentUserRole?: "SUPER_ADMIN" | "WORK_ADMIN" | "USER" | "TOP_ADMIN";
  currentUser?: any;
}

export default function HRManagement({
  isAdmin: propsIsAdmin,
  currentUserRole: propsRole,
  currentUser: propsUser,
}: HRManagementProps = {}) {
  const [users, setUsers] = useState<HRUser[]>([]);
  const [loading, setLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<'ORG' | 'CHART' | 'LIST'>('ORG');

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('전체');
  const [selectedField, setSelectedField] = useState('전체');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<HRUser | null>(null);

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const [notice, setNotice] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
  } | null>(null);

  const [confirmUser, setConfirmUser] = useState<HRUser | null>(null);

  const orgChartContainerRef = useRef<HTMLDivElement>(null);
  const orgChartRef = useRef<any>(null);

  const currentUser = useMemo(() => {
    if (propsUser) return propsUser;
    if (typeof window === 'undefined') return null;

    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, [propsUser]);

  const isAdmin = useMemo(() => {
    if (typeof propsIsAdmin === 'boolean') return propsIsAdmin;
    return (
      currentUser?.role === 'SUPER_ADMIN' ||
      currentUser?.role === 'WORK_ADMIN'
    );
  }, [propsIsAdmin, currentUser]);

  const showNotice = (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info'
  ) => {
    setNotice({ message, type });
  };

  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => {
      setNotice(null);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    (window as any).handleChartEdit = (id: string) => {
      const user = users.find((u) => u.id === id);
      if (!user) return;

      if (!isAdmin && currentUser?.id !== user.id) {
        showNotice(
          '본인의 정보 또는 관리자 권한이 있는 경우에만 수정이 가능합니다.',
          'warning'
        );
        return;
      }

      setEditingUser(user);
      setIsModalOpen(true);
    };

    (window as any).handleChartDelete = (id: string) => {
      const user = users.find((u) => u.id === id);
      if (!user) return;

      handleDeleteUser(user);
    };

    (window as any).handleChartAddSub = () => {
      if (!isAdmin) {
        showNotice('관리자 권한이 필요합니다.', 'warning');
        return;
      }

      setEditingUser(null);
      setIsModalOpen(true);
    };

    return () => {
      delete (window as any).handleChartEdit;
      delete (window as any).handleChartDelete;
      delete (window as any).handleChartAddSub;
    };
  }, [users, isAdmin, currentUser]);

  const handleExportPDF = async () => {
    if (!orgChartContainerRef.current) {
      showNotice(
        '저장할 조직도 영역을 찾을 수 없습니다. 조직도 탭에서 시도해주세요.',
        'warning'
      );
      return;
    }

    try {
      const chartElement = orgChartContainerRef.current;

      orgChartRef.current?.fit();

      await new Promise((resolve) => setTimeout(resolve, 500));

      const canvas = await html2canvas(chartElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF({
        orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const margin = 10;
      const maxWidth = pageWidth - margin * 2;
      const maxHeight = pageHeight - margin * 2;

      const ratio = Math.min(
        maxWidth / canvas.width,
        maxHeight / canvas.height
      );

      const imgWidth = canvas.width * ratio;
      const imgHeight = canvas.height * ratio;

      const x = (pageWidth - imgWidth) / 2;
      const y = (pageHeight - imgHeight) / 2;

      pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
      pdf.save('조직도.pdf');

      showNotice('조직도가 PDF로 저장되었습니다.', 'success');
    } catch (err) {
      console.error('PDF 저장 오류:', err);
      showNotice('PDF 저장 중 오류가 발생했습니다.', 'error');
    }
  };

  const buildHierarchy = (userList: HRUser[]) => {
    const data: any[] = [];
    const usedIds = new Set<string>();

    const addNode = (node: any) => {
      data.push(node);

      if (node.id) {
        usedIds.add(node.id);
      }
    };

    addNode({
      id: 'root',
      parentId: '',
      name: '조직도',
      type: 'root',
      level: 'root',
    });

    addNode({
      id: 'org_operating',
      parentId: 'root',
      name: '운영',
      type: 'department',
      level: 'main',
    });

    addNode({
      id: 'operating_team',
      parentId: 'org_operating',
      name: '운영팀',
      type: 'group',
      level: 'submain',
      department: '운영',
    });

    addNode({
      id: 'org_management',
      parentId: 'operating_team',
      name: '관리',
      type: 'department',
      level: 'main',
    });

    addNode({
      id: 'management_team',
      parentId: 'org_management',
      name: '관리팀',
      type: 'group',
      level: 'submain',
      department: '관리',
    });

    addNode({
      id: 'org_team',
      parentId: 'management_team',
      name: 'TEAM',
      type: 'department',
      level: 'main',
    });

    const addUserNode = (
      user: HRUser,
      parentId: string
    ) => {
      if (usedIds.has(user.id)) return;

      addNode({
        id: `user_${user.id}`,
        parentId,
        name: user.name,
        position: user.position,
        job_title: user.job_title,
        department: user.department,
        type: 'user',
        data: user,
      });
    };

    const operatingUsers = userList.filter(
      (u) => (u.department || '').trim() === '운영'
    );

    const operatingTitleOrder = [
      '본부장',
      '소장',
      '사무',
    ];

    const otherOperatingTitles = Array.from(
      new Set(
        operatingUsers
          .map((u) => (u.job_title || '').trim())
          .filter(
            (title) =>
              title &&
              !operatingTitleOrder.includes(title)
          )
      )
    );

    const operatingTitles = [
      ...operatingTitleOrder,
      ...otherOperatingTitles,
    ];

    operatingTitles.forEach((title) => {
      const members = operatingUsers.filter(
        (u) =>
          ((u.job_title || '').trim() || '없음') ===
          title
      );

      if (members.length === 0) return;

      const titleId = `operating_title_${title}`;

      addNode({
        id: titleId,
        parentId: 'operating_team',
        name: title,
        type: 'group',
        level: 'title',
        department: '운영',
      });

      members.forEach((user) => {
        addUserNode(user, titleId);
      });
    });

    const operatingUnassigned =
      operatingUsers.filter(
        (u) => !(u.job_title || '').trim()
      );

    if (operatingUnassigned.length > 0) {
      const titleId = 'operating_title_none';

      addNode({
        id: titleId,
        parentId: 'operating_team',
        name: '기타',
        type: 'group',
        level: 'title',
        department: '운영',
      });

      operatingUnassigned.forEach((user) => {
        addUserNode(user, titleId);
      });
    }

    const managementUsers = userList.filter(
      (u) => (u.department || '').trim() === '관리'
    );

    const managementFields = Array.from(
      new Set(
        managementUsers.map(
          (u) =>
            (u.field || '기타').trim() || '기타'
        )
      )
    );

    const preferredFieldOrder = [
      'QA',
      '공정',
      '공정 및 스케쥴',
      '공정 및 스케줄',
      '안전',
      '캐빈',
      '사무',
      '기타',
    ];

    managementFields.sort((a, b) => {
      const ia = preferredFieldOrder.indexOf(a);
      const ib = preferredFieldOrder.indexOf(b);

      if (ia !== -1 && ib !== -1) {
        return ia - ib;
      }

      if (ia !== -1) return -1;
      if (ib !== -1) return 1;

      return a.localeCompare(b);
    });

    managementFields.forEach((field) => {
      const members = managementUsers.filter(
        (u) =>
          ((u.field || '기타').trim() || '기타') ===
          field
      );

      if (members.length === 0) return;

      const fieldId = `management_field_${field}`;

      addNode({
        id: fieldId,
        parentId: 'management_team',
        name: field,
        type: 'group',
        level: 'field',
        department: '관리',
      });

      members.forEach((user) => {
        addUserNode(user, fieldId);
      });
    });

    const teamDepartments = [
      '1팀',
      '2팀',
      '3팀',
      '4팀',
    ];

    const existingTeamDepartments = Array.from(
      new Set(
        userList
          .map((u) => (u.department || '').trim())
          .filter((dept) => /^\d+팀$/.test(dept))
      )
    );

    const allTeams = Array.from(
      new Set([
        ...teamDepartments,
        ...existingTeamDepartments,
      ])
    );

    allTeams.sort((a, b) => {
      const na = parseInt(
        a.replace('팀', ''),
        10
      );

      const nb = parseInt(
        b.replace('팀', ''),
        10
      );

      if (!isNaN(na) && !isNaN(nb)) {
        return na - nb;
      }

      if (!isNaN(na)) return -1;
      if (!isNaN(nb)) return 1;

      return a.localeCompare(b);
    });

    allTeams.forEach((team) => {
      const members = userList.filter(
        (u) =>
          (u.department || '').trim() === team
      );

      const teamId = `team_${team}`;

      addNode({
        id: teamId,
        parentId: 'org_team',
        name: team,
        type: 'department',
        level: 'team',
        department: team,
      });

      const sortedMembers = [...members].sort(
        (a, b) => {
          const rankA =
            JOB_TITLE_ORDER_IN_RANK[
              a.job_title || '없음'
            ] || 99;

          const rankB =
            JOB_TITLE_ORDER_IN_RANK[
              b.job_title || '없음'
            ] || 99;

          if (rankA !== rankB) {
            return rankA - rankB;
          }

          return (a.name || '').localeCompare(
            b.name || ''
          );
        }
      );

      sortedMembers.forEach((user) => {
        addUserNode(user, teamId);
      });
    });

    const handledDepartments = new Set([
      '운영',
      '관리',
      ...allTeams,
    ]);

    const otherDepartments = Array.from(
      new Set(
        userList
          .map(
            (u) =>
              (u.department || '').trim() ||
              '미지정 파트'
          )
          .filter(
            (dept) =>
              !handledDepartments.has(dept)
          )
      )
    );

    otherDepartments.forEach((dept) => {
      const deptId = `other_dept_${dept}`;

      addNode({
        id: deptId,
        parentId: 'org_team',
        name: dept,
        type: 'department',
        level: 'team',
        department: dept,
      });

      userList
        .filter(
          (u) =>
            ((u.department || '').trim() ||
              '미지정 파트') === dept
        )
        .forEach((user) => {
          addUserNode(user, deptId);
        });
    });

    return data;
  };

  useEffect(() => {
    if (
      activeTab === 'CHART' &&
      orgChartContainerRef.current &&
      users.length > 0
    ) {
      if (!orgChartRef.current) {
        orgChartRef.current = new OrgChart();
      }

      const chartData = buildHierarchy(users);

      orgChartRef.current
        .container(orgChartContainerRef.current)
        .data(chartData)
        .layout('top')
        .compact(false)
        .nodeHeight((d: any) => {
          if (d.data.type === 'root') {
            return 50;
          }

          if (d.data.type === 'user') {
            return 92;
          }

          if (d.data.level === 'main') {
            return 52;
          }

          if (d.data.level === 'submain') {
            return 46;
          }

          return 42;
        })
        .nodeWidth((d: any) => {
          if (d.data.type === 'user') {
            return 210;
          }

          if (d.data.level === 'main') {
            return 150;
          }

          if (d.data.level === 'submain') {
            return 135;
          }

          return 145;
        })
        .childrenMargin((d: any) => {
          if (d.data.level === 'main') {
            return 36;
          }

          if (d.data.level === 'submain') {
            return 26;
          }

          return 20;
        })
        .siblingsMargin(() => 18)
        .neighbourMargin(() => 12)
        .nodeContent((d: any) => {
          if (d.data.type === 'root') {
            return `
              <div
                style="
                  background-color:#1F2937;
                  color:white;
                  border-radius:8px;
                  border:2px solid #111827;
                  height:100%;
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  font-weight:bold;
                  font-family:sans-serif;
                  box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);
                "
              >
                ${d.data.name}
              </div>
            `;
          }

          if (
            d.data.type === 'department' ||
            d.data.type === 'group'
          ) {
            const isMain =
              d.data.level === 'main' ||
              d.data.level === 'submain';

            return `
              <div
                style="
                  background-color:${isMain ? '#243B5A' : '#EAF0F7'};
                  color:${isMain ? 'white' : '#243B5A'};
                  border-radius:8px;
                  border:2px solid ${
                    isMain
                      ? '#1e293b'
                      : '#CBD5E1'
                  };
                  height:100%;
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  padding:0 10px;
                  font-weight:bold;
                  font-family:sans-serif;
                  box-sizing:border-box;
                  box-shadow:0 2px 4px rgba(0,0,0,0.05);
                "
              >
                ${d.data.name}
              </div>
            `;
          }

          const user = d.data.data;

          const isLeader = [
            '본부장',
            '소장',
            '팀장',
          ].includes(user.job_title || '');

          const bgColor = isLeader
            ? '#ffffff'
            : '#f8fafc';

          const borderColor = isLeader
            ? '#4f46e5'
            : '#cbd5e1';

          const borderWidth = isLeader
            ? '2px'
            : '1px';

          return `
            <div
              style="
                font-family:sans-serif;
                background-color:${bgColor};
                border:${borderWidth} solid ${borderColor};
                border-radius:8px;
                padding:10px;
                height:100%;
                box-sizing:border-box;
                box-shadow:0 1px 3px rgba(0,0,0,0.1);
              "
            >
              <div
                style="
                  font-size:13px;
                  font-weight:bold;
                  color:#1e293b;
                  display:flex;
                  justify-content:space-between;
                  align-items:center;
                "
              >
                <span>
                  ${isLeader ? '👑' : '👤'}
                  ${user.name}
                </span>

                <div
                  style="
                    display:flex;
                    gap:4px;
                    align-items:center;
                  "
                >
                  <span
                    style="
                      font-size:9px;
                      padding:2px 4px;
                      border-radius:4px;
                      background-color:${
                        isLeader
                          ? '#e0e7ff'
                          : '#e2e8f0'
                      };
                      color:${
                        isLeader
                          ? '#4f46e5'
                          : '#475569'
                      };
                    "
                  >
                    ${user.position || ''}
                  </span>

                  <button
                    onclick="window.handleChartEdit('${user.id}')"
                    style="
                      background:#f1f5f9;
                      border:1px solid #cbd5e1;
                      border-radius:4px;
                      cursor:pointer;
                      font-size:10px;
                      padding:1px 4px;
                    "
                    title="수정"
                  >
                    ✏️
                  </button>

                  <button
                    onclick="window.handleChartDelete('${user.id}')"
                    style="
                      background:#fee2e2;
                      border:1px solid #fca5a5;
                      border-radius:4px;
                      cursor:pointer;
                      font-size:10px;
                      padding:1px 4px;
                      color:#dc2626;
                    "
                    title="삭제"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div
                style="
                  font-size:10px;
                  color:#64748b;
                  margin-top:6px;
                  display:flex;
                  justify-content:space-between;
                  align-items:center;
                "
              >
                <span>
                  ${user.job_title || '팀원'}
                  ${
                    user.field
                      ? ` · ${user.field}`
                      : ''
                  }
                </span>

                <span
                  style="
                    font-size:9px;
                    color:#2563eb;
                    background:#eff6ff;
                    padding:1px 4px;
                    border-radius:3px;
                  "
                >
                  ${user.phone || '연락처 없음'}
                </span>
              </div>
            </div>
          `;
        })
        .render();

      orgChartRef.current.expandAll();

      requestAnimationFrame(() => {
        orgChartRef.current?.fit();
      });
    }
  }, [activeTab, users]);

  const fetchUsers = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .order('name', {
          ascending: true,
        });

      if (error) throw error;

      const formatted = (data || []).map(
        (u: any) => ({
          ...u,
          national_certificates:
            u.national_certificates ||
            u.certificates ||
            '',
        })
      );

      setUsers(formatted);
    } catch (err: any) {
      console.error(
        '인사 정보 조회 실패:',
        err?.message || err
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  const handleNewUser = () => {
    if (!isAdmin) {
      showNotice(
        '관리자 권한이 필요합니다.',
        'warning'
      );
      return;
    }

    setEditingUser({
      id: '',
      name: '',
      email: '',
      department: '운영',
      position: '',
      job_title: '팀원',
      field: '안전',
      role: 'USER',
      phone: '',
      address: '',
      experience: '',
      internal_certificates: '',
      national_certificates: '',
      join_date:
        new Date()
          .toISOString()
          .split('T')[0],
      career_start_date:
        new Date()
          .toISOString()
          .split('T')[0],
      password: '',
      birthDate: '',
    });

    setIsModalOpen(true);
  };

  const handleEditUser = (
    user: HRUser
  ) => {
    if (
      !isAdmin &&
      currentUser?.id !== user.id
    ) {
      showNotice(
        '본인의 정보 또는 관리자 권한이 있는 경우에만 수정이 가능합니다.',
        'warning'
      );
      return;
    }

    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleDeleteUser = (
    user: HRUser
  ) => {
    if (!isAdmin) {
      showNotice(
        '관리자만 구성원을 삭제할 수 있습니다.',
        'warning'
      );
      return;
    }

    if (
      currentUser?.id === user.id
    ) {
      showNotice(
        '현재 로그인되어 있는 본인 계정은 삭제할 수 없습니다.',
        'warning'
      );
      return;
    }

    setConfirmUser(user);
  };

  const handleConfirmDelete = async () => {
    if (!confirmUser) return;

    const user = confirmUser;

    setConfirmUser(null);

    try {
      const { error } =
        await supabase
          .from('app_users')
          .delete()
          .eq('id', user.id);

      if (error) throw error;

      showNotice(
        `${user.name} 님의 정보가 성공적으로 삭제되었습니다.`,
        'success'
      );

      fetchUsers();
    } catch (err: any) {
      console.error(
        '삭제 실패:',
        err
      );

      showNotice(
        '구성원 삭제 실패: ' +
          (err.message ||
            '알 수 없는 오류'),
        'error'
      );
    }
  };

  const handleSaveUser = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!editingUser) return;

    if (!isAdmin && editingUser.id !== currentUser?.id) {
      showNotice(
        '본인 정보만 수정할 권한이 있습니다.',
        'warning'
      );
      return;
    }

    if (!editingUser.email.trim()) {
      showNotice(
        '로그인에 사용할 아이디를 입력해주세요.',
        'warning'
      );
      return;
    }

    if (
      editingUser.password &&
      !/^\d{8}$/.test(
        editingUser.password
      )
    ) {
      showNotice(
        '비밀번호로 사용할 생년월일 8자리를 입력해주세요.',
        'warning'
      );
      return;
    }

    try {
      const payload: any = {
        name: editingUser.name,
        email: editingUser.email,
        department:
          editingUser.department,
        position:
          editingUser.position,
        job_title:
          editingUser.job_title,
        field: editingUser.field,
        role: editingUser.role,
        phone: editingUser.phone,
        address: editingUser.address,
        experience:
          editingUser.experience,
        internal_certificates:
          editingUser.internal_certificates,
        national_certificates:
          editingUser.national_certificates,
        join_date:
          editingUser.join_date,
        career_start_date:
          editingUser.career_start_date,
      };

      if (editingUser.password) {
        payload.password =
          editingUser.password;
      }

      if (editingUser.id) {
        const { error } =
          await supabase
            .from('app_users')
            .update(payload)
            .eq('id', editingUser.id);

        if (error) throw error;

        showNotice(
          '인사 정보가 성공적으로 수정되었습니다.',
          'success'
        );
      } else {
        if (
          !editingUser.password
        ) {
          showNotice(
            '비밀번호로 사용할 생년월일 8자리를 입력해주세요.',
            'warning'
          );
          return;
        }

        const { error } =
          await supabase
            .from('app_users')
            .insert({
              ...payload,
              password:
                editingUser.password,
            });

        if (error) throw error;

        showNotice(
          '새 구성원이 등록되었습니다.',
          'success'
        );
      }

      setIsModalOpen(false);
      setEditingUser(null);

      await fetchUsers();
    } catch (err: any) {
      console.error(
        '저장 실패:',
        err
      );

      showNotice(
        '저장 중 오류가 발생했습니다: ' +
          (err.message ||
            '알 수 없는 오류'),
        'error'
      );
    }
  };

  const departments = useMemo(() => {
    const values = Array.from(
      new Set(
        users
          .map(
            (u) =>
              (u.department || '').trim()
          )
          .filter(Boolean)
      )
    );

    return [
      '전체',
      ...DEPT_ORDER.filter((d) =>
        values.includes(d)
      ),
      ...values.filter(
        (d) =>
          !DEPT_ORDER.includes(d)
      ),
    ];
  }, [users]);

  const fields = useMemo(() => {
    const values = Array.from(
      new Set(
        users
          .map(
            (u) =>
              (u.field || '').trim()
          )
          .filter(Boolean)
      )
    );

    return [
      '전체',
      ...values.sort(
        (a, b) =>
          a.localeCompare(b)
      ),
    ];
  }, [users]);

  const filteredUsers = useMemo(() => {
    const keyword =
      searchTerm
        .trim()
        .toLowerCase();

    return users.filter(
      (user) => {
        const matchesSearch =
          !keyword ||
          [
            user.name,
            user.email,
            user.department,
            user.position,
            user.job_title,
            user.field,
            user.phone,
          ]
            .filter(Boolean)
            .some((value) =>
              String(value)
                .toLowerCase()
                .includes(keyword)
            );

        const matchesDepartment =
          selectedDepartment ===
            '전체' ||
          user.department ===
            selectedDepartment;

        const matchesField =
          selectedField ===
            '전체' ||
          user.field ===
            selectedField;

        return (
          matchesSearch &&
          matchesDepartment &&
          matchesField
        );
      }
    );
  }, [
    users,
    searchTerm,
    selectedDepartment,
    selectedField,
  ]);

  const groupedUsers = useMemo(() => {
    const groups: Record<
      string,
      HRUser[]
    > = {};

    filteredUsers.forEach(
      (user) => {
        const key =
          user.department ||
          '미지정';

        if (!groups[key]) {
          groups[key] = [];
        }

        groups[key].push(user);
      }
    );

    return groups;
  }, [filteredUsers]);

  const renderMemberCard = (
    user: HRUser
  ) => {
    const canEdit =
      isAdmin ||
      currentUser?.id === user.id;

    return (
      <div
        key={user.id}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="truncate text-base font-bold text-slate-800">
                {user.name}
              </div>

              {user.position && (
                <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {user.position}
                </span>
              )}
            </div>

            <div className="mt-1 text-sm text-slate-500">
              {user.job_title ||
                '팀원'}
              {user.field
                ? ` · ${user.field}`
                : ''}
            </div>
          </div>

          <div className="flex shrink-0 gap-1">
            {canEdit && (
              <button
                type="button"
                onClick={() =>
                  handleEditUser(user)
                }
                className="rounded-md border border-slate-200 bg-slate-50 p-1.5 text-slate-600 hover:bg-slate-100"
                title="수정"
              >
                <Edit
                  size={14}
                />
              </button>
            )}

            {isAdmin && (
              <button
                type="button"
                onClick={() =>
                  handleDeleteUser(
                    user
                  )
                }
                className="rounded-md border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100"
                title="삭제"
              >
                <Trash2
                  size={14}
                />
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 space-y-1 text-xs text-slate-500">
          <div>
            연락처:{' '}
            {user.phone ||
              '없음'}
          </div>

          <div>
            이메일:{' '}
            {user.email ||
              '없음'}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-full bg-slate-50">
      {notice && (
        <div className="fixed right-5 top-5 z-[100]">
          <div
            className={`min-w-[280px] rounded-xl border bg-white px-4 py-3 shadow-lg ${
              notice.type ===
              'success'
                ? 'border-emerald-200'
                : notice.type ===
                  'error'
                ? 'border-red-200'
                : notice.type ===
                  'warning'
                ? 'border-amber-200'
                : 'border-slate-200'
            }`}
          >
            <div
              className={`text-sm font-medium ${
                notice.type ===
                'success'
                  ? 'text-emerald-700'
                  : notice.type ===
                    'error'
                  ? 'text-red-700'
                  : notice.type ===
                    'warning'
                  ? 'text-amber-700'
                  : 'text-slate-700'
              }`}
            >
              {notice.message}
            </div>
          </div>
        </div>
      )}

      <div className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users
                size={22}
                className="text-[#243B5A]"
              />

              <h1 className="text-xl font-bold text-slate-800">
                인사관리
              </h1>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              구성원 및 조직 정보를
              관리합니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={
                handleNewUser
              }
              className="flex items-center gap-1.5 rounded-lg bg-[#243B5A] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#1d3049]"
            >
              <Plus
                size={16}
              />
              구성원 등록
            </button>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-200 bg-white px-5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              setActiveTab('ORG')
            }
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${
              activeTab === 'ORG'
                ? 'border-[#243B5A] text-[#243B5A]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Building2
              size={16}
            />
            인사정보
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveTab('CHART')
            }
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${
              activeTab === 'CHART'
                ? 'border-[#243B5A] text-[#243B5A]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Layers
              size={16}
            />
            조직도
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveTab('LIST')
            }
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${
              activeTab === 'LIST'
                ? 'border-[#243B5A] text-[#243B5A]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <List
              size={16}
            />
            목록
          </button>

          {activeTab ===
            'CHART' && (
            <button
              type="button"
              onClick={
                handleExportPDF
              }
              className="ml-auto flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <FileDown
                size={16}
              />
              PDF 저장
            </button>
          )}
        </div>
      </div>

      {activeTab ===
        'CHART' && (
        <div className="border-b border-slate-200 bg-white px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-700">
                조직도
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                운영 → 관리 →
                TEAM 순서의 세로
                조직 구조입니다.
              </p>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  orgChartRef.current?.fit()
                }
                className="rounded-md border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
                title="전체 맞춤"
              >
                <Maximize2
                  size={15}
                />
              </button>

              <button
                type="button"
                onClick={() =>
                  orgChartRef.current?.expandAll()
                }
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                전체 펼치기
              </button>

              <button
                type="button"
                onClick={() =>
                  orgChartRef.current?.collapseAll()
                }
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                전체 접기
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab ===
        'CHART' && (
        <div className="h-[calc(100vh-190px)] min-h-[650px] overflow-auto bg-white">
          <div
            ref={
              orgChartContainerRef
            }
            className="min-h-full w-full"
          />
        </div>
      )}

      {activeTab === 'ORG' && (
        <div className="p-5">
          <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) =>
                    setSearchTerm(
                      e.target.value
                    )
                  }
                  placeholder="이름, 부서, 직책, 연락처 검색"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#243B5A]"
                />
              </div>

              <select
                value={
                  selectedDepartment
                }
                onChange={(e) =>
                  setSelectedDepartment(
                    e.target.value
                  )
                }
                className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
              >
                {departments.map(
                  (department) => (
                    <option
                      key={department}
                      value={
                        department
                      }
                    >
                      {department}
                    </option>
                  )
                )}
              </select>

              <select
                value={
                  selectedField
                }
                onChange={(e) =>
                  setSelectedField(
                    e.target.value
                  )
                }
                className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
              >
                {fields.map(
                  (field) => (
                    <option
                      key={field}
                      value={field}
                    >
                      {field}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            {Object.entries(
              groupedUsers
            ).map(
              ([department, members]) => (
                <div
                  key={department}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                >
                  <button
                    type="button"
                    onClick={() =>
                      toggleGroup(
                        department
                      )
                    }
                    className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left"
                  >
                    <div className="flex items-center gap-2">
                      {collapsedGroups[
                        department
                      ] ? (
                        <ChevronRight
                          size={17}
                        />
                      ) : (
                        <ChevronDown
                          size={17}
                        />
                      )}

                      <span className="font-bold text-slate-700">
                        {department}
                      </span>

                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                        {members.length}
                      </span>
                    </div>
                  </button>

                  {!collapsedGroups[
                    department
                  ] && (
                    <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
                      {members.map(
                        renderMemberCard
                      )}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      )}

      {activeTab ===
        'LIST' && (
        <div className="p-5">
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                value={searchTerm}
                onChange={(e) =>
                  setSearchTerm(
                    e.target.value
                  )
                }
                placeholder="구성원 검색"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#243B5A]"
              />
            </div>

            <select
              value={
                selectedDepartment
              }
              onChange={(e) =>
                setSelectedDepartment(
                  e.target.value
                )
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
            >
              {departments.map(
                (department) => (
                  <option
                    key={department}
                    value={department}
                  >
                    {department}
                  </option>
                )
              )}
            </select>

            <select
              value={
                selectedField
              }
              onChange={(e) =>
                setSelectedField(
                  e.target.value
                )
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
            >
              {fields.map(
                (field) => (
                  <option
                    key={field}
                    value={field}
                  >
                    {field}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-left text-xs font-bold text-slate-600">
                  <th className="px-4 py-3">
                    이름
                  </th>
                  <th className="px-4 py-3">
                    부서
                  </th>
                  <th className="px-4 py-3">
                    직책
                  </th>
                  <th className="px-4 py-3">
                    분야
                  </th>
                  <th className="px-4 py-3">
                    연락처
                  </th>
                  <th className="px-4 py-3">
                    이메일
                  </th>
                  <th className="px-4 py-3 text-right">
                    관리
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map(
                  (user) => (
                    <tr
                      key={user.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {user.name}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {user.department ||
                          '-'}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {user.job_title ||
                          user.position ||
                          '-'}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {user.field ||
                          '-'}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {user.phone ||
                          '-'}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {user.email ||
                          '-'}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {(isAdmin ||
                            currentUser?.id ===
                              user.id) && (
                            <button
                              type="button"
                              onClick={() =>
                                handleEditUser(
                                  user
                                )
                              }
                              className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50"
                            >
                              <Edit
                                size={14}
                              />
                            </button>
                          )}

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteUser(
                                  user
                                )
                              }
                              className="rounded-md border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100"
                            >
                              <Trash2
                                size={14}
                              />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen &&
        editingUser && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    {editingUser.id
                      ? '구성원 정보 수정'
                      : '새 구성원 등록'}
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    조직도에서는 저장된
                    부서 정보가 자동으로
                    반영됩니다.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(
                      false
                    );
                    setEditingUser(
                      null
                    );
                  }}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X
                    size={20}
                  />
                </button>
              </div>

              <form
                onSubmit={
                  handleSaveUser
                }
                className="space-y-5 p-5"
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      이름
                    </label>

                    <input
                      required
                      value={
                        editingUser.name
                      }
                      onChange={(e) =>
                        setEditingUser(
                          {
                            ...editingUser,
                            name: e
                              .target
                              .value,
                          }
                        )
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#243B5A]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      로그인 아이디
                    </label>

                    <input
                      required
                      value={
                        editingUser.email
                      }
                      onChange={(e) =>
                        setEditingUser(
                          {
                            ...editingUser,
                            email: e
                              .target
                              .value,
                          }
                        )
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#243B5A]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      부서
                    </label>

                    <input
                      value={
                        editingUser.department
                      }
                      onChange={(e) =>
                        setEditingUser(
                          {
                            ...editingUser,
                            department:
                              e.target
                                .value,
                          }
                        )
                      }
                      placeholder="운영 / 관리 / 1팀 / 2팀 / 3팀 / 4팀"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#243B5A]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      직책
                    </label>

                    <input
                      value={
                        editingUser.job_title
                      }
                      onChange={(e) =>
                        setEditingUser(
                          {
                            ...editingUser,
                            job_title:
                              e.target
                                .value,
                          }
                        )
                      }
                      placeholder="본부장 / 소장 / 팀장 / 팀원"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#243B5A]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      직급
                    </label>

                    <input
                      value={
                        editingUser.position
                      }
                      onChange={(e) =>
                        setEditingUser(
                          {
                            ...editingUser,
                            position:
                              e.target
                                .value,
                          }
                        )
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#243B5A]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      분야
                    </label>

                    <input
                      value={
                        editingUser.field
                      }
                      onChange={(e) =>
                        setEditingUser(
                          {
                            ...editingUser,
                            field:
                              e.target
                                .value,
                          }
                        )
                      }
                      placeholder="QA / 공정 / 공정 및 스케줄 등"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#243B5A]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      연락처
                    </label>

                    <input
                      value={
                        editingUser.phone
                      }
                      onChange={(e) =>
                        setEditingUser(
                          {
                            ...editingUser,
                            phone:
                              e.target
                                .value,
                          }
                        )
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#243B5A]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      입사일
                    </label>

                    <input
                      type="date"
                      value={
                        editingUser.join_date ||
                        ''
                      }
                      onChange={(e) =>
                        setEditingUser(
                          {
                            ...editingUser,
                            join_date:
                              e.target
                                .value,
                          }
                        )
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#243B5A]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      비밀번호
                    </label>

                    <input
                      type="password"
                      value={
                        editingUser.password ||
                        ''
                      }
                      onChange={(e) =>
                        setEditingUser(
                          {
                            ...editingUser,
                            password:
                              e.target
                                .value,
                          }
                        )
                      }
                      placeholder="생년월일 8자리"
                      maxLength={8}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#243B5A]"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    주소
                  </label>

                  <input
                    value={
                      editingUser.address ||
                      ''
                    }
                    onChange={(e) =>
                      setEditingUser(
                        {
                          ...editingUser,
                          address:
                            e.target
                              .value,
                        }
                      )
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#243B5A]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    경력
                  </label>

                  <textarea
                    value={
                      editingUser.experience ||
                      ''
                    }
                    onChange={(e) =>
                      setEditingUser(
                        {
                          ...editingUser,
                          experience:
                            e.target
                              .value,
                        }
                      )
                    }
                    rows={3}
                    className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#243B5A]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    사내 자격
                  </label>

                  <textarea
                    value={
                      editingUser.internal_certificates ||
                      ''
                    }
                    onChange={(e) =>
                      setEditingUser(
                        {
                          ...editingUser,
                          internal_certificates:
                            e.target
                              .value,
                        }
                      )
                    }
                    rows={2}
                    className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#243B5A]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    국가 자격
                  </label>

                  <textarea
                    value={
                      editingUser.national_certificates ||
                      ''
                    }
                    onChange={(e) =>
                      setEditingUser(
                        {
                          ...editingUser,
                          national_certificates:
                            e.target
                              .value,
                        }
                      )
                    }
                    rows={2}
                    className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#243B5A]"
                  />
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(
                        false
                      );
                      setEditingUser(
                        null
                      );
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    취소
                  </button>

                  <button
                    type="submit"
                    className="flex items-center gap-2 rounded-lg bg-[#243B5A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1d3049]"
                  >
                    <Save
                      size={16}
                    />
                    저장
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      {confirmUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-lg font-bold text-slate-800">
                구성원 삭제
              </h3>
            </div>

            <div className="px-5 py-5">
              <p className="text-sm leading-6 text-slate-600">
                정말로{' '}
                <strong className="font-bold text-slate-800">
                  [{confirmUser.name}]
                </strong>{' '}
                님의 인사 정보를
                삭제하시겠습니까?
              </p>

              <p className="mt-2 text-xs text-red-500">
                삭제 후에는 해당
                구성원의 인사 정보가
                복구되지 않습니다.
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() =>
                  setConfirmUser(
                    null
                  )
                }
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                취소
              </button>

              <button
                type="button"
                onClick={
                  handleConfirmDelete
                }
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
