'use client';

import { useState, useEffect, useRef } from 'react';
import { OrgChart } from 'd3-org-chart';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  Users, 
  Building2, 
  Briefcase, 
  Search, 
  Edit3, 
  Trash2,
  UserPlus, 
  X, 
  Check,
  Phone,
  Layers,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AtSign,
  Network, 
  GitCommit,
  FileText,
  Shield,
  UserX,
  PackageCheck,
  Calendar,
  FolderTree
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export interface HRUser {
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
  password?: string;           
  pos_x?: number;              
  pos_y?: number;     
  is_retired?: boolean;
  resignation_date?: string;
  returned_items?: string;
  parent_id?: string | null;
  display_order?: number;
}

interface HRManagementProps {
  isAdmin?: boolean;
  currentUserRole?: string;
  currentUser?: any;
}

function calculateCareerDetails(startDateStr?: string) {
  if (!startDateStr) return null;

  const start = new Date(startDateStr);
  const now = new Date();

  if (isNaN(start.getTime())) return null;

  let years = now.getFullYear() - start.getFullYear();

  const isBeforeAnniversary =
    now.getMonth() < start.getMonth() ||
    (now.getMonth() === start.getMonth() && now.getDate() < start.getDate());

  if (isBeforeAnniversary && years > 0) {
    years -= 1;
  }

  const lastAnniversary = new Date(start);
  lastAnniversary.setFullYear(start.getFullYear() + years);
  const remainingDays = Math.floor(
    (now.getTime() - lastAnniversary.getTime()) / (1000 * 60 * 60 * 24)
  );

  return `${years}년 ${remainingDays}일`;
}

function calculateAge(birthStr?: string) {
  if (!birthStr) return null;
  
  let cleanStr = birthStr.replace(/[^0-9]/g, '');
  if (cleanStr.length !== 8) return null;

  const year = parseInt(cleanStr.substring(0, 4), 10);
  const month = parseInt(cleanStr.substring(4, 6), 10) - 1;
  const day = parseInt(cleanStr.substring(6, 8), 10);

  const today = new Date();
  let age = today.getFullYear() - year;
  const m = today.getMonth() - month;
  
  if (m < 0 || (m === 0 && today.getDate() < day)) {
    age--;
  }

  return isNaN(age) ? null : age;
}

const DEPT_ORDER = ['운영', '관리', '1팀', '2팀', '3팀', '4팀', '퇴사자'];

const RANK_ORDER: Record<string, number> = {
  '책임': 1,
  '프로': 2,
  '매니저': 3,
  '사원': 4
};

const JOB_TITLE_ORDER_IN_RANK: Record<string, number> = {
  '본부장': 1,
  '소장': 2,
  '팀장': 3,
  '팀원': 4,
  '없음': 5
};

export default function HRManagement({ 
  isAdmin = false, 
  currentUserRole = '',
  currentUser = null 
}: HRManagementProps) {
  const [users, setUsers] = useState<HRUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ORG' | 'CHART' | 'LIST'>('ORG');
  const [searchTerm, setSearchTerm] = useState('');

  const [subGroupType, setSubGroupType] = useState<'DEPT' | 'POS'>('DEPT');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('ALL');

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<HRUser | null>(null);
  const [selectedUser, setSelectedUser] = useState<HRUser | null>(null);

  // 조직도 구조 직접 변경을 위한 모달 상태
  const [isOrgEditModalOpen, setIsOrgEditModalOpen] = useState(false);
  const [targetOrgUser, setTargetOrgUser] = useState<HRUser | null>(null);
  const [parentUserId, setParentUserId] = useState<string>('');
  const [userDisplayOrder, setUserDisplayOrder] = useState<number>(0);

  const orgChartContainerRef = useRef<HTMLDivElement>(null);
  const orgChartRef = useRef<any>(null);
  
  const [formData, setFormData] = useState({
    inputId: '', 
    name: '',
    email: '',
    department: '운영',
    position: '매니저',
    job_title: '팀원',
    field: '안전',
    role: 'USER',
    phone: '',
    address: '',
    experience: '',
    internal_certificates: '',
    national_certificates: '',
    join_date: '',
    career_start_date: '',
    birthDate: '',
    is_retired: false,
    resignation_date: '',
    returned_items: ''
  });

  const handleExportPDF = async () => {
    const element = orgChartContainerRef.current;
    if (!element) {
      alert('저장할 조직도 영역을 찾을 수 없습니다. 조직도 탭에서 시도해주세요.');
      return;
    }

    try {
      orgChartRef.current?.fit();
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#F8FAFC'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.85);
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = Math.min((canvas.height * pdfWidth) / canvas.width, pdf.internal.pageSize.getHeight() - 20);

      pdf.addImage(imgData, 'JPEG', 0, 10, pdfWidth, pdfHeight, undefined, 'FAST');
      pdf.save(`조직도_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('PDF 저장 실패:', err);
      alert('PDF 저장 중 오류가 발생했습니다.');
    }
  };

  const myRole = currentUserRole || currentUser?.role || '';
  const isSuperAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(myRole.toUpperCase());

  const isSelf = (targetUser: HRUser) => {
    if (!currentUser) return false;
    if (currentUser.id && targetUser.id && currentUser.id === targetUser.id) return true;
    if (currentUser.name && targetUser.name && currentUser.name.trim() === targetUser.name.trim()) return true;
    return false;
  };

  const canEditUser = (targetUser: HRUser) => {
    if (targetUser.is_retired || targetUser.department === '퇴사자') {
      return isAdmin;
    }
    return isAdmin || isSelf(targetUser);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    setSelectedSubCategory('ALL');
  }, [subGroupType]);

  useEffect(() => {
    (window as any).handleChartEdit = (userId: string) => {
      const target = users.find(u => u.id === userId);
      if (target) handleOpenEditModal(target);
    };

    (window as any).handleChartDelete = (userId: string) => {
      const target = users.find(u => u.id === userId);
      if (target) handleDeleteUser(target);
    };

    (window as any).handleChartStructureEdit = (userId: string) => {
      if (!isAdmin) {
        alert('관리자만 조직도 구조를 수정할 수 있습니다.');
        return;
      }
      const target = users.find(u => u.id === userId);
      if (target) {
        setTargetOrgUser(target);
        setParentUserId(target.parent_id || '');
        setUserDisplayOrder(target.display_order || 0);
        setIsOrgEditModalOpen(true);
      }
    };
  }, [users, isAdmin]);

  // 조직도(d3-org-chart) 트리 생성 시 퇴사자 완전히 제외
  const buildHierarchy = (userList: HRUser[]) => {
    const data: any[] = [];
    const usedIds = new Set<string>();

    // 1. 퇴사자 제외된 재직자 목록 필터링
    const activeUserList = userList.filter(u => !u.is_retired && u.department !== '퇴사자');

    const addNode = (node: any) => {
      data.push(node);
      if (node.id) usedIds.add(node.id);
    };

    addNode({ id: 'root', parentId: '', name: '조직도', type: 'root' });
    addNode({ id: 'org_operating', parentId: 'root', name: '운영', type: 'department', level: 'main' });
    addNode({ id: 'org_management', parentId: 'org_operating', name: '관리', type: 'department', level: 'main' });
    addNode({ id: 'org_team', parentId: 'org_management', name: '팀', type: 'department', level: 'main' });

    const addUserNode = (user: HRUser, defaultParentId: string) => {
      if (usedIds.has(user.id)) return;
      // 수동으로 변경된 parent_id가 존재하면 적용
      const actualParentId = (user.parent_id && user.parent_id !== user.id) 
        ? `user_${user.parent_id}` 
        : defaultParentId;

      addNode({
        id: `user_${user.id}`,
        parentId: actualParentId,
        name: user.name,
        position: user.position,
        job_title: user.job_title,
        department: user.department,
        type: 'user',
        data: user,
      });
    };

    const operatingUsers = activeUserList.filter((u) => (u.department || '').trim() === '운영');
    const operatingTitleOrder = ['본부장', '소장', '사무'];
    const otherOperatingTitles = Array.from(new Set(
      operatingUsers
        .map((u) => (u.job_title || '').trim())
        .filter((title) => title && !operatingTitleOrder.includes(title))
    ));
    const operatingTitles = [...operatingTitleOrder, ...otherOperatingTitles];

    operatingTitles.forEach((title) => {
      const members = operatingUsers.filter((u) => (u.job_title || '없음').trim() === title);
      if (members.length === 0) return;

      const titleId = `operating_title_${title}`;
      addNode({
        id: titleId,
        parentId: 'org_operating',
        name: title,
        type: 'group',
        level: 'title',
        department: '운영',
      });
      members.sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
             .forEach((user) => addUserNode(user, titleId));
    });

    const managementUsers = activeUserList.filter((u) => (u.department || '').trim() === '관리');
    const managementFields = Array.from(new Set(
      managementUsers.map((u) => (u.field || '기타').trim() || '기타')
    ));
    const preferredFieldOrder = ['QA', '공정', '공정 및 스케쥴', '공정 및 스케줄', '안전', '캐빈', '사무', '기타'];
    managementFields.sort((a, b) => {
      const ia = preferredFieldOrder.indexOf(a);
      const ib = preferredFieldOrder.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });

    managementFields.forEach((field) => {
      const members = managementUsers.filter((u) => ((u.field || '기타').trim() || '기타') === field);
      if (members.length === 0) return;

      const fieldId = `management_field_${field}`;
      addNode({
        id: fieldId,
        parentId: 'org_management',
        name: field,
        type: 'group',
        level: 'field',
        department: '관리',
      });
      members.sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
             .forEach((user) => addUserNode(user, fieldId));
    });

    const teamDepartments = ['1팀', '2팀', '3팀', '4팀'];
    const existingTeamDepartments = Array.from(new Set(
      activeUserList
        .map((u) => (u.department || '').trim())
        .filter((dept) => /^\d+팀$/.test(dept))
    ));
    const allTeams = Array.from(new Set([...teamDepartments, ...existingTeamDepartments]));
    allTeams.sort((a, b) => {
      const na = parseInt(a.replace('팀', ''), 10);
      const nb = parseInt(b.replace('팀', ''), 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      if (!isNaN(na)) return -1;
      if (!isNaN(nb)) return 1;
      return a.localeCompare(b);
    });

    allTeams.forEach((team) => {
      const members = activeUserList.filter((u) => (u.department || '').trim() === team);
      const teamId = `team_${team}`;
      addNode({
        id: teamId,
        parentId: 'org_team',
        name: team,
        type: 'department',
        level: 'team',
        department: team,
      });

      const sortedMembers = [...members].sort((a, b) => {
        if ((a.display_order || 0) !== (b.display_order || 0)) {
          return (a.display_order || 0) - (b.display_order || 0);
        }
        const rankA = JOB_TITLE_ORDER_IN_RANK[a.job_title || '없음'] || 99;
        const rankB = JOB_TITLE_ORDER_IN_RANK[b.job_title || '없음'] || 99;
        if (rankA !== rankB) return rankA - rankB;
        return (a.name || '').localeCompare(b.name || '');
      });
      sortedMembers.forEach((user) => addUserNode(user, teamId));
    });

    const handledDepartments = new Set(['운영', '관리', ...allTeams]);
    const otherDepartments = Array.from(new Set(
      activeUserList
        .map((u) => (u.department || '').trim() || '미지정 파트')
        .filter((dept) => !handledDepartments.has(dept))
    ));

    otherDepartments.forEach((dept) => {
      const deptId = `other_dept_${dept}`;
      addNode({ id: deptId, parentId: 'org_team', name: dept, type: 'department', level: 'other' });
      activeUserList
        .filter((u) => ((u.department || '').trim() || '미지정 파트') === dept)
        .forEach((user) => addUserNode(user, deptId));
    });

    return data;
  };

  useEffect(() => {
    if (activeTab === 'CHART' && orgChartContainerRef.current && users.length > 0) {
      if (!orgChartRef.current) {
        orgChartRef.current = new OrgChart();
      }

      const chartData = buildHierarchy(users);

      orgChartRef.current
        .container(orgChartContainerRef.current)
        .data(chartData)
        .nodeHeight((d: any) => {
          if (d.data.type === 'root') return 50;
          if (d.data.type === 'user') return 96;
          return d.data.level === 'main' ? 48 : 42;
        })
        .nodeWidth((d: any) => {
          if (d.data.type === 'user') return 220;
          if (d.data.level === 'main') return 180;
          return 150;
        })
        .childrenMargin((d: any) => d.data.level === 'main' ? 32 : 22)
        .compactMarginBetween((d: any) => 14)
        .compactMarginPair((d: any) => 18)
        .nodeContent((d: any) => {
          if (d.data.type === 'root') {
            return `
              <div style="background-color: #1F2937; color: white; border-radius: 8px; border: 2px solid #111827; height: 100%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-family: sans-serif; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                ${d.data.name}
              </div>`;
          }

          if (d.data.type === 'department' || d.data.type === 'group') {
            const isMain = d.data.level === 'main';
            const bg = isMain ? '#243B5A' : '#EAF0F7';
            const textColor = isMain ? 'white' : '#243B5A';
            return `
              <div style="background-color: ${bg}; color: ${textColor}; border-radius: 8px; border: 2px solid ${isMain ? '#1e293b' : '#CBD5E1'}; height: 100%; display: flex; align-items: center; justify-content: center; padding: 0 10px; font-weight: bold; font-family: sans-serif; box-sizing: border-box; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                ${d.data.name}
              </div>`;
          }

          const user = d.data.data;
          const isLeader = ['본부장', '소장', '팀장'].includes(user.job_title || '');
          const bgColor = isLeader ? '#ffffff' : '#f8fafc';
          const borderColor = isLeader ? '#4f46e5' : '#cbd5e1';
          const borderWidth = isLeader ? '2px' : '1px';

          return `
            <div style="font-family: sans-serif; background-color: ${bgColor}; border: ${borderWidth} solid ${borderColor}; border-radius: 8px; padding: 10px; height: 100%; box-sizing: border-box; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="font-size: 13px; font-weight: bold; color: #1e293b; display: flex; justify-content: space-between; align-items: center;">
                <span>${isLeader ? '👑' : '👤'} ${user.name}</span>
                <div style="display: flex; gap: 3px; align-items: center;">
                  <span style="font-size: 9px; padding: 2px 4px; border-radius: 4px; background-color: ${isLeader ? '#e0e7ff' : '#e2e8f0'}; color: ${isLeader ? '#4f46e5' : '#475569'};">${user.position || ''}</span>
                  <button onclick="window.handleChartStructureEdit('${user.id}')" style="background: #e0f2fe; border: 1px solid #7dd3fc; border-radius: 4px; cursor: pointer; font-size: 10px; padding: 1px 3px; color: #0369a1;" title="구조 변경">🌿</button>
                  <button onclick="window.handleChartEdit('${user.id}')" style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer; font-size: 10px; padding: 1px 3px;" title="수정">✏️</button>
                  <button onclick="window.handleChartDelete('${user.id}')" style="background: #fee2e2; border: 1px solid #fca5a5; border-radius: 4px; cursor: pointer; font-size: 10px; padding: 1px 3px; color: #dc2626;" title="삭제">🗑️</button>
                </div>
              </div>
              <div style="font-size: 10px; color: #64748b; margin-top: 6px; display: flex; justify-content: space-between; align-items: center;">
                <span>${user.job_title || '팀원'} ${user.field ? `· ${user.field}` : ''}</span>
                <span style="font-size: 9px; color: #2563eb; background: #eff6ff; padding: 1px 4px; border-radius: 3px;">${user.phone || '연락처 없음'}</span>
              </div>
            </div>
          `;
        })
        .render();

      orgChartRef.current.expandAll();
      requestAnimationFrame(() => orgChartRef.current?.fit());
    }
  }, [activeTab, users]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      const formatted = (data || []).map((u: any) => ({
        ...u,
        national_certificates: u.national_certificates || u.certificates || '',
        is_retired: u.is_retired || u.department === '퇴사자'
      }));

      setUsers(formatted);
    } catch (err: any) {
      console.error('인사 정보 조회 실패:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const toggleAllGroups = (collapse: boolean) => {
    const newStatus: Record<string, boolean> = {};
    availableSubCategories.forEach(cat => {
      newStatus[cat] = collapse;
    });
    setCollapsedGroups(newStatus);
  };

  const handleOpenAddModal = () => {
    if (!isAdmin) {
      alert('관리자만 신규 구성원을 등록할 수 있습니다.');
      return;
    }
    setSelectedUser(null);
    setFormData({
      inputId: '',
      name: '',
      email: '',
      department: '운영',
      position: '매니저',
      job_title: '팀원',
      field: '안전',
      role: 'USER',
      phone: '',
      address: '',
      experience: '',
      internal_certificates: '',
      national_certificates: '',
      join_date: new Date().toISOString().split('T')[0],
      career_start_date: new Date().toISOString().split('T')[0],
      birthDate: '',
      is_retired: false,
      resignation_date: '',
      returned_items: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: HRUser) => {
    if (user.is_retired || user.department === '퇴사자') {
      if (!isAdmin) {
        alert('퇴사자 정보는 관리자만 수정할 수 있습니다.');
        return;
      }
    } else if (!canEditUser(user)) {
      alert('본인의 정보 또는 관리자 권한이 있는 경우에만 수정이 가능합니다.');
      return;
    }

    setSelectedUser(user);
    setFormData({ 
      inputId: user.id || '',
      name: user.name || '',
      email: user.email || '',
      department: user.department || '운영',
      position: user.position || '매니저',
      job_title: user.job_title || '팀원',
      field: user.field || '안전',
      role: user.role || 'USER',
      phone: user.phone || '',
      address: user.address || '',
      experience: user.experience || '',
      internal_certificates: user.internal_certificates || '',
      national_certificates: user.national_certificates || user.certificates || '',
      join_date: user.join_date || '',
      career_start_date: user.career_start_date || '',
      birthDate: user.password || '',
      is_retired: !!user.is_retired || user.department === '퇴사자',
      resignation_date: user.resignation_date || '',
      returned_items: user.returned_items || ''
    });
    setIsModalOpen(true);
  };

  const handleDeleteUser = async (user: HRUser) => {
    if (!isAdmin) {
      alert('관리자만 구성원을 삭제할 수 있습니다.');
      return;
    }

    if (currentUser?.id === user.id) {
      alert('현재 로그인되어 있는 본인 계정은 삭제할 수 없습니다.');
      return;
    }

    const confirmDelete = window.confirm(`정말로 [${user.name}] 님의 인사 정보를 삭제하시겠습니까?`);
    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from('app_users')
        .delete()
        .eq('id', user.id);

      if (error) throw error;

      alert(`${user.name} 님의 정보가 성공적으로 삭제되었습니다.`);
      fetchUsers();
    } catch (err: any) {
      console.error('삭제 실패:', err);
      alert('구성원 삭제 실패: ' + (err.message || '알 수 없는 오류'));
    }
  };

  // 조직도 직접 수정 저장 핸들러
  const handleSaveOrgStructure = async () => {
    if (!targetOrgUser) return;

    try {
      const { error } = await supabase
        .from('app_users')
        .update({
          parent_id: parentUserId || null,
          display_order: Number(userDisplayOrder) || 0
        })
        .eq('id', targetOrgUser.id);

      if (error) throw error;

      alert(`${targetOrgUser.name} 님의 조직도 위치 정보가 성공적으로 수정되었습니다.`);
      setIsOrgEditModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      console.error('조직도 구조 변경 실패:', err);
      alert('조직도 수정 실패: ' + (err.message || '알 수 없는 오류'));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.is_retired && !isAdmin) {
      alert('퇴사자 처리 및 관리는 관리자 권한만 가능합니다.');
      return;
    }

    if (selectedUser && !canEditUser(selectedUser)) {
      alert('본인 정보만 수정할 권한이 있습니다.');
      return;
    }

    if (!formData.inputId.trim()) {
      alert('로그인에 사용할 아이디를 입력해주세요.');
      return;
    }

    if (formData.birthDate && formData.birthDate.length !== 8) {
      alert('생년월일은 8자리(YYYYMMDD)로 정확히 입력해주세요.');
      return;
    }

    try {
      const isRetired = formData.is_retired;
      const payload: any = {
        id: formData.inputId.trim(), 
        name: formData.name,
        email: formData.email,
        department: isRetired ? '퇴사자' : formData.department,
        position: formData.position,
        job_title: formData.job_title,
        field: formData.field,
        phone: formData.phone,
        address: formData.address,
        experience: formData.experience,
        internal_certificates: formData.internal_certificates,
        national_certificates: formData.national_certificates,
        certificates: formData.national_certificates,
        join_date: formData.join_date || null,
        career_start_date: formData.career_start_date || null,
        is_retired: isRetired,
        resignation_date: isRetired ? (formData.resignation_date || new Date().toISOString().split('T')[0]) : null,
        returned_items: isRetired ? formData.returned_items : null,
        ...(isRetired ? { parent_id: null } : {}) // 퇴사 시 상사 연결 해제
      };

      if (formData.birthDate) {
        payload.password = formData.birthDate;
      }

      if (isSuperAdmin && formData.role) {
        payload.role = formData.role;
      }

      if (selectedUser) {
        const { error } = await supabase
          .from('app_users')
          .update(payload)
          .eq('id', selectedUser.id);

        if (error) throw error;
        alert('인사 정보가 성공적으로 수정되었습니다.');
      } else {
        if (!formData.birthDate) {
          alert('비밀번호로 사용할 생년월일 8자리를 입력해주세요.');
          return;
        }

        const { error } = await supabase.from('app_users').insert([
          {
            ...payload,
            role: isSuperAdmin ? (formData.role || 'USER') : 'USER',
          },
        ]);

        if (error) throw error;
        alert('새 구성원이 등록되었습니다.');
      }

      setIsModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      console.error('저장 실패:', err);
      alert('저장 중 오류가 발생했습니다: ' + (err.message || '알 수 없는 오류'));
    }
  };

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    return (
      (u.name || '').toLowerCase().includes(term) ||
      (u.id || '').toLowerCase().includes(term) ||
      (u.department || '').toLowerCase().includes(term) ||
      (u.position || '').toLowerCase().includes(term) ||
      (u.job_title || '').toLowerCase().includes(term) ||
      (u.field || '').toLowerCase().includes(term) ||
      (u.phone || '').toLowerCase().includes(term)
    );
  });

  const rawSubCategories = Array.from(
    new Set(
      filteredUsers
        .map((u) => {
          if (u.is_retired || u.department === '퇴사자') return '퇴사자';
          return subGroupType === 'DEPT' ? u.department || '미지정 파트' : u.position || '미지정 직급';
        })
        .filter(Boolean)
    )
  );

  const availableSubCategories = subGroupType === 'DEPT' 
    ? rawSubCategories.sort((a, b) => {
        const indexA = DEPT_ORDER.indexOf(a);
        const indexB = DEPT_ORDER.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
      })
    : rawSubCategories.sort((a, b) => {
        if (a === '퇴사자') return 1;
        if (b === '퇴사자') return -1;
        const orderA = RANK_ORDER[a] || 99;
        const orderB = RANK_ORDER[b] || 99;
        return orderA - orderB;
      });

  const displayedCategories = selectedSubCategory === 'ALL' 
    ? availableSubCategories 
    : [selectedSubCategory];

  return (
    <div className="w-full min-h-screen bg-[#F5F6F8] text-[#1F2937] p-2 sm:p-3 space-y-3 font-sans box-border">
      <div className="bg-white p-3 rounded-xl border border-[#E2E5E9] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-xl text-[#243B5A]">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#1F2937]">인사 관리 및 조직도</h1>
            <p className="text-[11px] text-[#64748B]">파트별·직급별 체계적인 조직도를 조회하고 편집합니다.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:w-56">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              placeholder="이름, 아이디, 파트 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#E2E5E9] rounded-lg bg-[#F5F6F8] text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none transition"
            />
          </div>

          <div className="flex bg-[#F5F6F8] border border-[#E2E5E9] p-0.5 rounded-lg">
            <button
              onClick={() => setActiveTab('ORG')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 ${
                activeTab === 'ORG' ? 'bg-[#243B5A] text-white shadow-xs' : 'text-[#64748B] hover:text-[#1F2937]'
              }`}
            >
              <Network className="h-3.5 w-3.5" /> 카드 뷰
            </button>
            <button
              onClick={() => setActiveTab('CHART')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 ${
                activeTab === 'CHART' ? 'bg-[#243B5A] text-white shadow-xs' : 'text-[#64748B] hover:text-[#1F2937]'
              }`}
            >
              <Layers className="h-3.5 w-3.5" /> 조직도
            </button>
            <button
              onClick={() => setActiveTab('LIST')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                activeTab === 'LIST' ? 'bg-[#243B5A] text-white shadow-xs' : 'text-[#64748B] hover:text-[#1F2937]'
              }`}
            >
              목록 뷰
            </button>
          </div>

          {activeTab === 'CHART' && (
            <button
              onClick={handleExportPDF}
              className="flex items-center space-x-1 bg-[#DC2626] hover:bg-[#b91c1c] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs"
              title="현재 조직도를 고화질 PDF로 저장합니다"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>PDF 저장</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={handleOpenAddModal}
              className="flex items-center space-x-1 bg-[#243B5A] hover:bg-[#1d3049] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>구성원 추가</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'ORG' && (
        <div className="bg-white border border-[#E2E5E9] rounded-xl p-3 shadow-xs space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E5E9] pb-2.5">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-[#64748B] flex items-center gap-1 mr-1">
                <Layers className="h-3.5 w-3.5 text-[#243B5A]" /> :
              </span>
              <button
                onClick={() => setSubGroupType('DEPT')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition border ${
                  subGroupType === 'DEPT'
                    ? 'bg-[#243B5A] text-white border-[#243B5A] shadow-xs'
                    : 'bg-[#F5F6F8] text-[#64748B] border-[#E2E5E9] hover:bg-[#E2E5E9]'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>파트별 조직도</span>
              </button>
              <button
                onClick={() => setSubGroupType('POS')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition border ${
                  subGroupType === 'POS'
                    ? 'bg-[#243B5A] text-white border-[#243B5A] shadow-xs'
                    : 'bg-[#F5F6F8] text-[#64748B] border-[#E2E5E9] hover:bg-[#E2E5E9]'
                }`}
              >
                <Briefcase className="h-3.5 w-3.5" />
                <span>직급별 조직도</span>
              </button>
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <button
                onClick={() => toggleAllGroups(false)}
                className="px-2 py-1 text-[#64748B] bg-[#F5F6F8] hover:bg-[#E2E5E9] border border-[#E2E5E9] rounded-lg font-medium transition text-[11px]"
              >
                모두 펼치기
              </button>
              <button
                onClick={() => toggleAllGroups(true)}
                className="px-2 py-1 text-[#64748B] bg-[#F5F6F8] hover:bg-[#E2E5E9] border border-[#E2E5E9] rounded-lg font-medium transition text-[11px]"
              >
                모두 접기
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
            <span className="text-xs font-bold text-[#64748B] shrink-0 flex items-center gap-0.5">
              <ChevronRight className="h-3.5 w-3.5" />
            </span>

            <button
              onClick={() => setSelectedSubCategory('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition border ${
                selectedSubCategory === 'ALL'
                  ? 'bg-[#243B5A] text-white border-[#243B5A]'
                  : 'bg-[#F5F6F8] text-[#64748B] border-[#E2E5E9] hover:bg-[#E2E5E9]'
              }`}
            >
              전체 보기 ({filteredUsers.length}명)
            </button>

            {availableSubCategories.map((subCat) => {
              const count = filteredUsers.filter((u) => {
                if (subCat === '퇴사자') return u.is_retired || u.department === '퇴사자';
                if (u.is_retired || u.department === '퇴사자') return false;
                return subGroupType === 'DEPT' 
                  ? (u.department || '미지정 파트') === subCat 
                  : (u.position || '미지정 직급') === subCat;
              }).length;

              return (
                <button
                  key={subCat}
                  onClick={() => setSelectedSubCategory(subCat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition border ${
                    selectedSubCategory === subCat
                      ? 'bg-[#243B5A] text-white border-[#243B5A]'
                      : subCat === '퇴사자'
                      ? 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                      : 'bg-[#F5F6F8] text-[#64748B] border-[#E2E5E9] hover:bg-[#E2E5E9]'
                  }`}
                >
                  {subCat === '퇴사자' ? '🛑 퇴사자' : subCat} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-[#E2E5E9] text-center py-16 text-xs text-[#64748B]">조직도를 구성하는 중...</div>
      ) : activeTab === 'CHART' ? (
        <div className="bg-white border border-[#E2E5E9] rounded-xl p-3 shadow-xs space-y-2.5 relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-[#64748B]">
              <Layers className="h-3.5 w-3.5 text-[#243B5A]" />
              <span>조직도 (노드 내 🌿 상시/순서 변경 / ✏️ 수정 / 🗑️ 삭제 가능 - 퇴사자 자동 제외)</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => orgChartRef.current?.fit()}
                className="flex items-center gap-1 px-2.5 py-1 bg-[#F5F6F8] hover:bg-[#E2E5E9] text-[#64748B] border border-[#E2E5E9] font-bold rounded-lg transition text-[11px]"
                title="조직도를 화면 중앙에 맞춥니다"
              >
                화면 맞춤
              </button>
              <button
                onClick={() => orgChartRef.current?.expandAll()}
                className="flex items-center gap-1 px-2.5 py-1 bg-[#F5F6F8] hover:bg-[#E2E5E9] text-[#64748B] border border-[#E2E5E9] font-bold rounded-lg transition text-[11px]"
              >
                모두 펴기
              </button>
              <button
                onClick={() => orgChartRef.current?.collapseAll()}
                className="flex items-center gap-1 px-2.5 py-1 bg-[#F5F6F8] hover:bg-[#E2E5E9] text-[#64748B] border border-[#E2E5E9] font-bold rounded-lg transition text-[11px]"
              >
                모두 접기
              </button>
            </div>
          </div>

          <div ref={orgChartContainerRef} className="w-full h-[780px] bg-[#F8FAFC] border border-[#E2E5E9] rounded-xl overflow-hidden relative">
          </div>
        </div>
      ) : activeTab === 'ORG' ? (
        <div className="space-y-3">
          {displayedCategories.map((catName) => {
            const isRetiredCat = catName === '퇴사자';
            const groupMembers = filteredUsers.filter((u) => {
              if (isRetiredCat) return u.is_retired || u.department === '퇴사자';
              if (u.is_retired || u.department === '퇴사자') return false;
              return subGroupType === 'DEPT'
                ? (u.department || '미지정 파트') === catName
                : (u.position || '미지정 직급') === catName;
            });

            const sortMembers = (a: HRUser, b: HRUser) => {
              if (isRetiredCat) {
                const dateA = a.resignation_date || '9999-12-31';
                const dateB = b.resignation_date || '9999-12-31';
                return dateB.localeCompare(dateA);
              }
              if (catName === '책임' || subGroupType === 'POS') {
                const titleOrderA = JOB_TITLE_ORDER_IN_RANK[a.job_title || '팀원'] || 99;
                const titleOrderB = JOB_TITLE_ORDER_IN_RANK[b.job_title || '팀원'] || 99;
                if (titleOrderA !== titleOrderB) {
                  return titleOrderA - titleOrderB;
                }
              }
              const dateA = a.join_date || a.career_start_date || '9999-12-31';
              const dateB = b.join_date || b.career_start_date || '9999-12-31';
              return dateA.localeCompare(dateB);
            };

            const leaders = isRetiredCat ? [] : groupMembers.filter(u => ['본부장', '소장', '팀장'].includes(u.job_title || '')).sort(sortMembers);
            const members = isRetiredCat ? groupMembers.sort(sortMembers) : groupMembers.filter(u => !['본부장', '소장', '팀장'].includes(u.job_title || '')).sort(sortMembers);

            const isCollapsed = !!collapsedGroups[catName];

            return (
              <div key={catName} className="bg-white border border-[#E2E5E9] rounded-xl overflow-hidden shadow-xs transition-all">
                <div 
                  onClick={() => toggleGroup(catName)}
                  className={`flex items-center justify-between p-3 cursor-pointer border-b border-[#E2E5E9] transition ${
                    isRetiredCat ? 'bg-slate-100 hover:bg-slate-200/60' : 'bg-[#F5F6F8] hover:bg-[#E2E5E9]/50'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <div className={`p-1.5 text-white rounded-lg ${isRetiredCat ? 'bg-slate-600' : 'bg-[#243B5A]'}`}>
                      {isRetiredCat ? <UserX className="h-3.5 w-3.5" /> : (subGroupType === 'DEPT' ? <Building2 className="h-3.5 w-3.5" /> : <Briefcase className="h-3.5 w-3.5" />)}
                    </div>
                    <div>
                      <h3 className="font-bold text-[#1F2937] text-xs flex items-center gap-2">
                        {isRetiredCat ? '퇴사자 목록' : catName} 
                        <span className="text-[10px] bg-white text-[#243B5A] font-bold px-2 py-0.2 rounded-full border border-[#E2E5E9]">
                          총 {groupMembers.length}명
                        </span>
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {isAdmin && subGroupType === 'DEPT' && !isRetiredCat && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedUser(null);
                          setFormData(prev => ({ ...prev, department: catName }));
                          setIsModalOpen(true);
                        }}
                        className="px-2 py-1 bg-[#243B5A] text-white rounded text-[11px] font-bold hover:bg-[#1d3049]"
                      >
                        + 구성원 추가
                      </button>
                    )}
                    <button className="text-[#64748B] hover:text-[#1F2937] p-1 flex items-center gap-1 text-xs font-medium">
                      <span>{isCollapsed ? '펼치기' : '접기'}</span>
                      {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="p-3 bg-gradient-to-b from-slate-50/50 to-white space-y-3">
                    {leaders.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1 text-[11px] font-bold text-[#243B5A] px-1">
                          <GitCommit className="h-3.5 w-3.5 text-[#243B5A]" />
                          <span>파트 리더 (본부장/소장/팀장)</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                          {leaders.map((leader) => renderMemberCard(leader, true, setDetailUser, isSelf, handleOpenEditModal, handleDeleteUser, canEditUser, isAdmin))}
                        </div>
                      </div>
                    )}

                    {leaders.length > 0 && members.length > 0 && (
                      <div className="relative flex justify-center my-1">
                        <div className="h-3 w-0.5 bg-slate-300"></div>
                      </div>
                    )}

                    {members.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1 text-[11px] font-bold text-[#64748B] px-1">
                          {isRetiredCat ? <UserX className="h-3.5 w-3.5 text-slate-500" /> : <Users className="h-3.5 w-3.5 text-[#64748B]" />}
                          <span>{isRetiredCat ? `퇴사 처리된 구성원 (${members.length}명)` : `소속 구성원 (${members.length}명)`}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                          {members.map((member) => renderMemberCard(member, false, setDetailUser, isSelf, handleOpenEditModal, handleDeleteUser, canEditUser, isAdmin))}
                        </div>
                      </div>
                    )}

                    {groupMembers.length === 0 && (
                      <div className="text-center py-6 text-xs text-[#64748B]">소속된 구성원이 없습니다.</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          <div className="block md:hidden space-y-2.5">
            {filteredUsers.map((u) => {
              const canEdit = canEditUser(u);
              const joinCareer = calculateCareerDetails(u.join_date);
              const totalCareer = calculateCareerDetails(u.career_start_date);
              const age = calculateAge(u.password);
              const isRetired = u.is_retired || u.department === '퇴사자';

              return (
                <div key={u.id} className={`bg-white p-3 border rounded-xl shadow-xs space-y-2 ${isRetired ? 'border-slate-300 bg-slate-50/50' : 'border-[#E2E5E9]'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-[#1F2937]">{u.name}</span>
                        {age && <span className="text-[10px] text-[#243B5A] font-bold">({age}세)</span>}
                        {u.id && <span className="text-[10px] text-[#64748B] font-mono">({u.id})</span>}
                        {isRetired ? (
                          <span className="text-[9px] bg-slate-500 text-white font-bold px-1.5 py-0.2 rounded shrink-0">
                            퇴사자
                          </span>
                        ) : isSelf(u) && (
                          <span className="text-[9px] bg-[#243B5A] text-white font-bold px-1.5 py-0.2 rounded shrink-0">
                            나
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#64748B] flex items-center gap-1 flex-wrap">
                        <span className="px-1.5 py-0.5 bg-[#F5F6F8] font-medium rounded border border-[#E2E5E9]">
                          {isRetired ? '퇴사자' : `${u.department || '미지정'} · ${u.position || '사원'} ${u.job_title && u.job_title !== '없음' ? `(${u.job_title}${u.field ? `/${u.field}` : ''})` : ''}`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      {canEdit && (
                        <button
                          onClick={() => handleOpenEditModal(u)}
                          className="p-1.5 text-[#243B5A] hover:bg-[#F5F6F8] rounded-lg transition border border-[#E2E5E9]"
                          title="수정"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteUser(u)}
                          className="p-1.5 text-[#DC2626] hover:bg-red-50 rounded-lg transition border border-red-200"
                          title="삭제"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#F5F6F8] p-2 rounded-lg border border-[#E2E5E9]">
                    {isRetired ? (
                      <>
                        <div className="col-span-2">
                          <span className="text-[#64748B] block text-[10px]">퇴사일자</span>
                          <span className="font-semibold text-slate-700">{u.resignation_date || '-'}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[#64748B] block text-[10px]">반납 물품</span>
                          <span className="font-medium text-slate-700">{u.returned_items || '-'}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <span className="text-[#64748B] block text-[10px]">연락처</span>
                          {u.phone ? (
                            <a href={`tel:${u.phone}`} className="font-medium text-[#243B5A] hover:underline flex items-center gap-1 truncate">
                              <Phone className="h-3 w-3 shrink-0" /> <span className="truncate">{u.phone}</span>
                            </a>
                          ) : (
                            <span className="font-medium text-[#1F2937]">-</span>
                          )}
                        </div>
                        <div>
                          <span className="text-[#64748B] block text-[10px]">권한</span>
                          <span className={`font-bold ${u.role === 'ADMIN' ? 'text-[#243B5A]' : 'text-[#64748B]'}`}>
                            {u.role === 'ADMIN' ? '관리자' : '일반 사용자'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#64748B] block text-[10px]">자사 근속</span>
                          <span className="font-semibold text-[#16A34A]">{joinCareer || '-'}</span>
                        </div>
                        <div>
                          <span className="text-[#64748B] block text-[10px]">총 경력</span>
                          <span className="font-semibold text-[#2563EB]">{totalCareer || '-'}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden md:block bg-white border border-[#E2E5E9] rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F6F8] border-b border-[#E2E5E9] font-bold text-[#64748B]">
                <tr>
                  <th className="p-3">성명 (나이/아이디)</th>
                  <th className="p-3">파트 / 직급(직책/분야)</th>
                  <th className="p-3">연락처 / 주소</th>
                  <th className="p-3">상태 / 권한</th>
                  <th className="p-3">근속/퇴사일</th>
                  <th className="p-3">총 경력 (시작일)</th>
                  <th className="p-3">반납물품 / 사내자격</th>
                  <th className="p-3">국가자격</th>
                  <th className="p-3 text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E5E9]">
                {filteredUsers.map((u) => {
                  const canEdit = canEditUser(u);
                  const age = calculateAge(u.password);
                  const isRetired = u.is_retired || u.department === '퇴사자';

                  return (
                    <tr key={u.id} className={`hover:bg-[#F5F6F8]/60 transition ${isRetired ? 'bg-slate-50/70 text-slate-500' : ''}`}>
                      <td className="p-3 font-bold text-[#1F2937]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={isRetired ? 'line-through text-slate-500' : ''}>{u.name}</span>
                          {age && <span className="text-xs text-[#243B5A] font-bold">({age}세)</span>}
                          {u.id && <span className="text-[10px] text-[#64748B] font-mono font-normal">({u.id})</span>}
                          {isRetired ? (
                            <span className="text-[10px] bg-slate-500 text-white font-bold px-1.5 py-0.2 rounded">
                              퇴사
                            </span>
                          ) : isSelf(u) && (
                            <span className="text-[10px] bg-[#243B5A] text-white font-bold px-1.5 py-0.2 rounded">
                              나
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-[#1F2937]">
                        {isRetired ? '퇴사자' : `${u.department} / ${u.position} ${u.job_title && u.job_title !== '없음' ? `(${u.job_title}${u.field ? `/${u.field}` : ''})` : ''}`}
                      </td>
                      <td className="p-3 font-medium">
                        <div>
                          {u.phone ? (
                            <a href={`tel:${u.phone}`} className="text-[#243B5A] hover:underline flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {u.phone}
                            </a>
                          ) : '-'}
                        </div>
                        <div className="text-[10px] text-[#64748B] mt-0.5 truncate max-w-[180px]">
                          {u.address || '주소 미등록'}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          isRetired 
                            ? 'bg-slate-200 text-slate-700 border-slate-300' 
                            : u.role === 'ADMIN' ? 'bg-[#243B5A] text-white border-[#243B5A]' : 'bg-[#F5F6F8] text-[#64748B] border-[#E2E5E9]'
                        }`}>
                          {isRetired ? '퇴사' : (u.role === 'ADMIN' ? '관리자' : '일반 사용자')}
                        </span>
                      </td>
                      <td className="p-3">
                        {isRetired ? (
                          <>
                            <div className="text-slate-700 font-semibold">{u.resignation_date || '-'}</div>
                            <div className="text-[10px] text-slate-500">퇴사 완료</div>
                          </>
                        ) : (
                          <>
                            <div className="text-[#16A34A] font-semibold">{calculateCareerDetails(u.join_date) || '-'}</div>
                            <div className="text-[10px] text-[#64748B]">{u.join_date || ''}</div>
                          </>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="text-[#2563EB] font-semibold">{calculateCareerDetails(u.career_start_date) || '-'}</div>
                        <div className="text-[10px] text-[#64748B]">{u.career_start_date || ''}</div>
                      </td>
                      <td className="p-3 text-[#1F2937] font-medium">
                        {isRetired ? (u.returned_items || '-') : (u.internal_certificates || '-')}
                      </td>
                      <td className="p-3 text-[#1F2937] font-medium">{u.national_certificates || '-'}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {canEdit && (
                            <button
                              onClick={() => handleOpenEditModal(u)}
                              className="p-1.5 text-[#243B5A] hover:bg-[#F5F6F8] rounded-lg transition border border-[#E2E5E9]"
                              title="정보 수정"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 text-[#DC2626] hover:bg-red-50 rounded-lg transition border border-red-200"
                              title="삭제"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 조직도 구조 직접 수정 모달 */}
      {isOrgEditModalOpen && targetOrgUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white border border-[#E2E5E9] rounded-xl max-w-sm w-full p-4 shadow-xl space-y-3 text-[#1F2937]">
            <div className="flex items-center justify-between border-b border-[#E2E5E9] pb-2">
              <h3 className="font-bold text-xs text-[#1F2937] flex items-center gap-1.5">
                <FolderTree className="h-4 w-4 text-[#243B5A]" />
                [{targetOrgUser.name}] 조직도 위치 변경
              </h3>
              <button onClick={() => setIsOrgEditModalOpen(false)} className="text-[#64748B] hover:text-[#1F2937] p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#64748B] mb-1">직속 상사 선택 (부모 노드)</label>
                <select
                  value={parentUserId}
                  onChange={(e) => setParentUserId(e.target.value)}
                  className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none cursor-pointer"
                >
                  <option value="">기본 (파트 그룹 자동 배치)</option>
                  {users
                    .filter(u => u.id !== targetOrgUser.id && !u.is_retired && u.department !== '퇴사자')
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.department} · {u.position} {u.job_title})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#64748B] mb-1">동일 그룹 내 정렬 순서 (숫자가 낮을수록 앞)</label>
                <input
                  type="number"
                  value={userDisplayOrder}
                  onChange={(e) => setUserDisplayOrder(parseInt(e.target.value, 10) || 0)}
                  className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-[#E2E5E9]">
              <button
                type="button"
                onClick={() => setIsOrgEditModalOpen(false)}
                className="px-3.5 py-1.5 bg-white border border-[#E2E5E9] hover:bg-[#F5F6F8] rounded-lg text-xs text-[#1F2937]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveOrgStructure}
                className="px-3.5 py-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white rounded-lg text-xs font-semibold flex items-center space-x-1 transition"
              >
                <Check className="h-3.5 w-3.5" />
                <span>적용</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {detailUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-3">
          <div className="bg-white border-t sm:border border-[#E2E5E9] rounded-t-2xl sm:rounded-xl max-w-md w-full p-4 shadow-2xl space-y-3 text-[#1F2937] relative animate-in slide-in-from-bottom duration-200">
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto sm:hidden mb-1"></div>

            <div className="flex items-start justify-between border-b border-[#E2E5E9] pb-2.5">
              <div className="flex items-center space-x-2.5">
                <div className={`w-9 h-9 rounded-full text-white flex items-center justify-center font-bold text-xs shadow-xs ${
                  detailUser.is_retired || detailUser.department === '퇴사자' ? 'bg-slate-500' : 'bg-[#243B5A]'
                }`}>
                  {detailUser.name?.[0] || '유'}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-xs font-bold text-[#1F2937]">
                      {detailUser.name} {calculateAge(detailUser.password) ? `(${calculateAge(detailUser.password)}세)` : ''}
                    </h3>
                    {detailUser.id && <span className="text-[10px] text-[#64748B] font-mono">({detailUser.id})</span>}
                    {(detailUser.is_retired || detailUser.department === '퇴사자') ? (
                      <span className="text-[10px] bg-slate-500 text-white font-bold px-1.5 py-0.2 rounded-full">
                        퇴사자
                      </span>
                    ) : isSelf(detailUser) && (
                      <span className="text-[10px] bg-[#243B5A] text-white font-bold px-1.5 py-0.2 rounded-full">
                        나
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#64748B] font-medium">
                    {(detailUser.is_retired || detailUser.department === '퇴사자') 
                      ? '퇴사자' 
                      : `${detailUser.department || '미지정 파트'} · ${detailUser.position || '사원'} ${detailUser.job_title && detailUser.job_title !== '없음' ? `(${detailUser.job_title}${detailUser.field ? `/${detailUser.field}` : ''})` : ''}`}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setDetailUser(null)} 
                className="text-[#64748B] hover:text-[#1F2937] p-1 rounded-lg hover:bg-[#F5F6F8] transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              {(detailUser.is_retired || detailUser.department === '퇴사자') && (
                <div className="bg-slate-100 p-2.5 rounded-lg space-y-1.5 border border-slate-200">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-slate-500" /> 퇴사일자</span>
                    <span>{detailUser.resignation_date || '-'}</span>
                  </div>
                  <div className="text-[11px] pt-1 border-t border-slate-200">
                    <span className="font-bold text-slate-600 block mb-0.5 flex items-center gap-1"><PackageCheck className="h-3.5 w-3.5 text-slate-500" /> 반납 물품</span>
                    <p className="text-slate-800 bg-white p-2 rounded border border-slate-200 whitespace-pre-wrap">{detailUser.returned_items || '작성된 반납 물품이 없습니다.'}</p>
                  </div>
                </div>
              )}

              <div className="bg-[#F5F6F8] p-2.5 rounded-lg space-y-2 border border-[#E2E5E9]">
                {detailUser.id && (
                  <div className="flex items-center justify-between text-[#1F2937] pb-2 border-b border-[#E2E5E9]">
                    <span className="font-semibold text-[#64748B] flex items-center gap-1.5">
                      <AtSign className="h-3.5 w-3.5 text-[#243B5A]" /> 로그인 아이디
                    </span>
                    <span className="font-bold font-mono text-[#243B5A]">{detailUser.id}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-[#1F2937] pb-2 border-b border-[#E2E5E9]">
                  <span className="font-semibold text-[#64748B] flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-[#243B5A]" /> 연락처
                  </span>
                  {detailUser.phone ? (
                    <a href={`tel:${detailUser.phone}`} className="font-bold text-[#243B5A] hover:underline flex items-center gap-1">
                      {detailUser.phone}
                    </a>
                  ) : (
                    <span className="font-bold text-[#1F2937]">미등록</span>
                  )}
                </div>
                <div className="flex items-start justify-between text-[#1F2937]">
                  <span className="font-semibold text-[#64748B] shrink-0 pt-0.5">주소</span>
                  <span className="font-medium text-right text-[#1F2937]">{detailUser.address || '미등록'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#F5F6F8] p-2.5 rounded-lg border border-[#E2E5E9]">
                  <span className="text-[10px] text-[#16A34A] font-bold block mb-0.5">자사 근속</span>
                  <span className="text-xs font-extrabold text-[#1F2937] block">
                    {calculateCareerDetails(detailUser.join_date) || '-'}
                  </span>
                </div>

                <div className="bg-[#F5F6F8] p-2.5 rounded-lg border border-[#E2E5E9]">
                  <span className="text-[10px] text-[#2563EB] font-bold block mb-0.5">총 경력</span>
                  <span className="text-xs font-extrabold text-[#1F2937] block">
                    {calculateCareerDetails(detailUser.career_start_date) || '-'}
                  </span>
                </div>
              </div>

              <div className="bg-[#F5F6F8] p-2.5 rounded-lg space-y-1 border border-[#E2E5E9]">
                <div className="text-[11px]"><span className="font-bold text-[#64748B]">사내자격:</span> {detailUser.internal_certificates || '없음'}</div>
                <div className="text-[11px]"><span className="font-bold text-[#64748B]">국가자격:</span> {detailUser.national_certificates || '없음'}</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2.5 border-t border-[#E2E5E9]">
              {canEditUser(detailUser) ? (
                <button
                  onClick={() => {
                    const target = detailUser;
                    setDetailUser(null);
                    handleOpenEditModal(target);
                  }}
                  className="px-3 py-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white font-bold rounded-lg text-xs transition flex items-center space-x-1"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>정보 수정</span>
                </button>
              ) : <div />}
              
              <button
                onClick={() => setDetailUser(null)}
                className="px-3.5 py-1.5 bg-white border border-[#E2E5E9] hover:bg-[#F5F6F8] text-[#1F2937] font-bold rounded-lg text-xs transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white border border-[#E2E5E9] rounded-xl max-w-lg w-full p-4 shadow-xl space-y-3 max-h-[90vh] overflow-y-auto text-[#1F2937]">
            <div className="flex items-center justify-between border-b border-[#E2E5E9] pb-2.5">
              <h3 className="font-bold text-xs text-[#1F2937]">
                {selectedUser 
                  ? (isSelf(selectedUser) ? '내 인사 정보 수정' : '구성원 정보 수정') 
                  : '신규 구성원 등록'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#64748B] hover:text-[#1F2937] p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-2.5 text-xs">
              {isAdmin && (
                <div className="bg-slate-100 p-2.5 rounded-lg border border-slate-200 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 text-xs">
                    <input
                      type="checkbox"
                      checked={formData.is_retired}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormData({
                          ...formData,
                          is_retired: checked,
                          resignation_date: checked && !formData.resignation_date 
                            ? new Date().toISOString().split('T')[0] 
                            : formData.resignation_date
                        });
                      }}
                      className="w-4 h-4 text-slate-600 rounded focus:ring-slate-500 border-slate-300"
                    />
                    <span className="flex items-center gap-1">
                      <UserX className="h-4 w-4 text-slate-600" /> 퇴사 처리 (체크 시 파트에서 자동 제외되며 퇴사자로 이전)
                    </span>
                  </label>

                  {formData.is_retired && (
                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-600" /> 퇴사일자 *
                        </label>
                        <input
                          type="date"
                          required={formData.is_retired}
                          value={formData.resignation_date}
                          onChange={(e) => setFormData({ ...formData, resignation_date: e.target.value })}
                          className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs text-[#1F2937] focus:border-slate-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                          <PackageCheck className="h-3.5 w-3.5 text-slate-600" /> 반납 물품 목록
                        </label>
                        <textarea
                          rows={2}
                          placeholder="예: 사원증, 노트북, 보안키, 현장 자재 등"
                          value={formData.returned_items}
                          onChange={(e) => setFormData({ ...formData, returned_items: e.target.value })}
                          className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs text-[#1F2937] focus:border-slate-500 outline-none resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-[#64748B] mb-1 flex items-center gap-1">
                    <AtSign className="h-3.5 w-3.5 text-[#243B5A]" /> 로그인 아이디 *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="예: w987654"
                    value={formData.inputId}
                    onChange={(e) => setFormData({ ...formData, inputId: e.target.value })}
                    className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#64748B] mb-1">성명 *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#64748B] mb-1 flex items-center gap-1">
                  생년월일 8자리 (나이 및 비밀번호) *
                </label>
                <input
                  type="text"
                  maxLength={8}
                  placeholder="예: 19950101"
                  value={formData.birthDate}
                  onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                  className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none font-mono"
                />
              </div>

              {isSuperAdmin && (
                <div>
                  <label className="block font-bold text-[#64748B] mb-1 flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5 text-[#243B5A]" /> 시스템 권한 부여
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none cursor-pointer font-bold"
                  >
                    <option value="USER">일반 사용자 (USER)</option>
                    <option value="ADMIN">관리자 (ADMIN)</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-[#64748B] mb-1">파트 (부서)</label>
                  <select
                    disabled={formData.is_retired}
                    value={formData.is_retired ? '퇴사자' : formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none cursor-pointer disabled:opacity-60"
                  >
                    <option value="운영">운영</option>
                    <option value="관리">관리</option>
                    <option value="1팀">1팀</option>
                    <option value="2팀">2팀</option>
                    <option value="3팀">3팀</option>
                    <option value="4팀">4팀</option>
                    <option value="퇴사자">퇴사자</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#64748B] mb-1">직급</label>
                  <input
                    type="text"
                    placeholder="예: 책임, 프로 등"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-[#64748B] mb-1">직책</label>
                  <select
                    value={formData.job_title}
                    onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                    className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none cursor-pointer"
                  >
                    <option value="본부장">본부장</option>
                    <option value="소장">소장</option>
                    <option value="팀장">팀장</option>
                    <option value="팀원">팀원</option>
                    <option value="없음">없음</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#64748B] mb-1">분야</label>
                  <select
                    value={formData.field}
                    onChange={(e) => setFormData({ ...formData, field: e.target.value })}
                    className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none cursor-pointer"
                  >
                    <option value="안전">안전</option>
                    <option value="캐빈">캐빈</option>
                    <option value="사무">사무</option>
                    <option value="QA">QA</option>
                    <option value="공정 및 스케쥴">공정 및 스케쥴</option>
                    <option value="공정">공정</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-[#64748B] mb-1">연락처</label>
                  <input
                    type="text"
                    placeholder="예: 010-0000-0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#64748B] mb-1">주소</label>
                  <input
                    type="text"
                    placeholder="주소 입력"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-[#64748B] mb-1">자사 근속 시작일 (입사일)</label>
                  <input
                    type="date"
                    value={formData.join_date}
                    onChange={(e) => setFormData({ ...formData, join_date: e.target.value })}
                    className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#64748B] mb-1">총 경력 시작일</label>
                  <input
                    type="date"
                    value={formData.career_start_date}
                    onChange={(e) => setFormData({ ...formData, career_start_date: e.target.value })}
                    className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-[#64748B] mb-1">사내 자격</label>
                  <input
                    type="text"
                    placeholder="사내 자격 입력"
                    value={formData.internal_certificates}
                    onChange={(e) => setFormData({ ...formData, internal_certificates: e.target.value })}
                    className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#64748B] mb-1">국가 자격</label>
                  <input
                    type="text"
                    placeholder="국가 자격 입력"
                    value={formData.national_certificates}
                    onChange={(e) => setFormData({ ...formData, national_certificates: e.target.value })}
                    className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2.5 border-t border-[#E2E5E9]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 bg-white border border-[#E2E5E9] hover:bg-[#F5F6F8] rounded-lg text-xs text-[#1F2937]"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white rounded-lg text-xs font-semibold flex items-center space-x-1 transition"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>저장</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function renderMemberCard(
  member: HRUser, 
  isLeader: boolean, 
  setDetailUser: (user: HRUser) => void, 
  isSelf: (user: HRUser) => boolean,
  handleOpenEditModal: (user: HRUser) => void,
  handleDeleteUser: (user: HRUser) => void,
  canEditUser: (user: HRUser) => boolean,
  isAdmin: boolean
) {
  const joinCareer = calculateCareerDetails(member.join_date);
  const totalCareer = calculateCareerDetails(member.career_start_date);
  const age = calculateAge(member.password);
  const isRetired = member.is_retired || member.department === '퇴사자';

  return (
    <div 
      key={member.id} 
      className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between space-y-1.5 group shadow-xs ${
        isRetired
          ? 'bg-slate-50/70 border-slate-300'
          : isLeader 
          ? 'bg-white border-[#243B5A] ring-1 ring-[#243B5A]/20 shadow-sm' 
          : 'bg-white border-[#E2E5E9] hover:border-slate-400 hover:shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between">
        <div 
          onClick={() => setDetailUser(member)}
          className="flex items-center space-x-2 min-w-0 cursor-pointer flex-1"
        >
          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
            isRetired ? 'bg-slate-400 text-white' : isLeader ? 'bg-[#243B5A] text-white' : 'bg-slate-200 text-[#243B5A]'
          }`}>
            {member.name?.[0] || '유'}
          </div>
          <div className="truncate">
            <div className="flex items-center space-x-1.5 flex-wrap">
              <span className={`font-bold text-xs group-hover:text-[#243B5A] transition-colors ${isRetired ? 'line-through text-slate-500' : 'text-[#1F2937]'}`}>
                {member.name}
              </span>
              {age && <span className="text-[10px] text-[#243B5A] font-bold">({age}세)</span>}
              {isRetired ? (
                <span className="text-[9px] bg-slate-500 text-white font-bold px-1 rounded">
                  퇴사
                </span>
              ) : isSelf(member) && (
                <span className="text-[9px] bg-[#243B5A] text-white font-bold px-1">
                  나
                </span>
              )}
            </div>
            <div className="text-[10px] text-[#64748B] flex items-center gap-1 pt-0.5">
              <span>{isRetired ? '퇴사자' : member.position || '사원'}</span>
              {!isRetired && member.job_title && member.job_title !== '없음' && (
                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                  isLeader ? 'bg-[#243B5A] text-white' : 'bg-sky-50 text-sky-700 border border-sky-200'
                }`}>
                  {member.job_title}{member.field ? `/${member.field}` : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1 shrink-0">
          {canEditUser(member) && (
            <button
              onClick={() => handleOpenEditModal(member)}
              className="p-1 text-[#243B5A] hover:bg-slate-100 rounded border border-slate-200"
              title="수정"
            >
              <Edit3 className="h-3 w-3" />
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => handleDeleteUser(member)}
              className="p-1 text-red-600 hover:bg-red-50 rounded border border-red-200"
              title="삭제"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div className="pt-1.5 border-t border-[#E2E5E9] text-[10px] space-y-1">
        {isRetired ? (
          <div className="flex items-center justify-between text-slate-500">
            <span className="font-medium text-slate-600">퇴사일: {member.resignation_date || '-'}</span>
            <span className="truncate max-w-[100px]" title={member.returned_items}>반납: {member.returned_items || '-'}</span>
          </div>
        ) : (
          <div className="flex items-center justify-between text-[#64748B]">
            <span className="flex items-center gap-1 font-medium">
              <Phone className="h-3 w-3 text-[#243B5A] shrink-0" />
              {member.phone || '-'}
            </span>
            <div className="space-x-1.5">
              <span className="font-semibold text-[#16A34A]">근속 {joinCareer || '-'}</span>
              <span className="font-semibold text-[#2563EB]">총경력 {totalCareer || '-'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
