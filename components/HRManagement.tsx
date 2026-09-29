'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ReactFlow, 
  MiniMap, 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState,
  addEdge,
  type Node,
  type Edge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
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
  Save,
  RotateCcw,
  Link2,
  FileSpreadsheet,
  FileText,
  Shield
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

const nodeWidth = 220;
const nodeHeight = 70;

const getLayoutedElements = (nodes: any[], edges: any[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 60,
    ranksep: 100,
    marginx: 40,
    marginy: 40,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    // 에러 방어 코드: nodeWithPosition이 없거나 x, y가 undefined일 경우 기본값 부여
    if (!nodeWithPosition || typeof nodeWithPosition.x !== 'number' || typeof nodeWithPosition.y !== 'number') {
      return {
        ...node,
        position: { x: node.position?.x || 0, y: node.position?.y || 0 },
      };
    }
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: newNodes, edges };
};

const DEPT_ORDER = ['운영', '관리', '1팀', '2팀', '3팀', '4팀'];

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
  const [activeTab, setActiveTab] = useState<'ORG' | 'DAGRE' | 'LIST'>('ORG');
  const [searchTerm, setSearchTerm] = useState('');

  const [subGroupType, setSubGroupType] = useState<'DEPT' | 'POS'>('DEPT');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('ALL');

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<HRUser | null>(null);
  const [selectedUser, setSelectedUser] = useState<HRUser | null>(null);
  const [isSavingPositions, setIsSavingPositions] = useState(false);

  const [selectedFlowNodes, setSelectedFlowNodes] = useState<any[]>([]);
  const dagreContainerRef = useRef<HTMLDivElement>(null);
  
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
    birthDate: '' 
  });

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<Node>([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const onConnect = useCallback(
    (params: any) => setFlowEdges((eds) => addEdge({ ...params, type: 'smoothstep', style: { stroke: '#4f46e5', strokeWidth: 2 } }, eds)),
    [setFlowEdges]
  );

  const handleExportExcel = () => {
    const formattedData = filteredUsers.map(item => ({
      '아이디': item.id,
      '성명': item.name,
      '파트(부서)': item.department || '',
      '직급': item.position || '',
      '직책': item.job_title || '',
      '분야': item.field || '',
      '연락처': item.phone || '',
      '주소': item.address || '',
      '나이': calculateAge(item.password) ? `${calculateAge(item.password)}세` : '',
      '자사근속': calculateCareerDetails(item.join_date) || '',
      '총경력': calculateCareerDetails(item.career_start_date) || '',
      '사내자격': item.internal_certificates || '',
      '국가자격': item.national_certificates || '',
      '입사일': item.join_date || '',
      '경력시작일': item.career_start_date || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    worksheet['!cols'] = [
      { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
      { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 8 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '인사관리목록');
    XLSX.writeFile(workbook, `인사관리목록_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportPDF = async () => {
    const element = dagreContainerRef.current;
    if (!element) return;

    try {
      element.classList.add('pdf-export-mode');

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#F8FAFC',
        logging: false,
        ignoreElements: (el) => {
          if (el.classList.contains('react-flow__controls') || el.classList.contains('react-flow__minimap')) {
            return true;
          }
          return false;
        }
      });

      const imgData = canvas.toDataURL('image/png');

      // A4 기준 (mm): landscape = 297 x 210
      const isLandscape = canvas.width > canvas.height;
      const pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10; // mm
      const availableWidth = pageWidth - margin * 2;
      const availableHeight = pageHeight - margin * 2;

      const canvasAspect = canvas.width / canvas.height;
      const pageAspect = availableWidth / availableHeight;

      let imgWidth: number;
      let imgHeight: number;

      if (canvasAspect > pageAspect) {
        imgWidth = availableWidth;
        imgHeight = availableWidth / canvasAspect;
      } else {
        imgHeight = availableHeight;
        imgWidth = availableHeight * canvasAspect;
      }

      const offsetX = margin + (availableWidth - imgWidth) / 2;
      const offsetY = margin + (availableHeight - imgHeight) / 2;

      pdf.addImage(imgData, 'PNG', offsetX, offsetY, imgWidth, imgHeight);
      pdf.save(`조직도_이름직급경력_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err: any) {
      console.error('PDF 내보내기 실패:', err);
      alert('PDF 내보내기 중 오류가 발생했습니다.');
    } finally {
      element.classList.remove('pdf-export-mode');
    }
  };

  const handleBatchConnect = () => {
    if (selectedFlowNodes.length < 2) {
      alert('2개 이상의 구성원을 선택해주세요. (Shift 키를 누르고 여러 명을 클릭하거나 드래그하세요)');
      return;
    }

    const parentNode = selectedFlowNodes[0];
    const childNodes = selectedFlowNodes.slice(1);

    const newEdges = childNodes.map(child => ({
      id: `edge_${parentNode.id}_${child.id}_${Date.now()}`,
      source: parentNode.id,
      target: child.id,
      type: 'smoothstep',
      style: { stroke: '#4f46e5', strokeWidth: 2 }
    }));

    setFlowEdges((eds) => {
      const existingPairs = new Set(eds.map(e => `${e.source}-${e.target}`));
      const filtered = newEdges.filter(e => !existingPairs.has(`${e.source}-${e.target}`));
      return [...eds, ...filtered];
    });

    alert(`[${parentNode.id}] 번 노드를 기준으로 선택한 ${childNodes.length}명의 구성원에게 선이 일괄 연결되었습니다!`);
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
    return isAdmin || isSelf(targetUser);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    setSelectedSubCategory('ALL');
  }, [subGroupType]);

  const buildFlowData = (userList: HRUser[], forceAutoLayout = false) => {
    const initialNodes: any[] = [];
    const initialEdges: any[] = [];

    userList.forEach((u, idx) => {
      const uId = `user_${u.id}_${idx}`;
      const uAge = calculateAge(u.password);
      const isLeader = u.job_title === '팀장';
      const isHead = u.job_title === '본부장' || (u.position && u.position.includes('본부장'));
      
      const careerText = calculateCareerDetails(u.join_date) || calculateCareerDetails(u.career_start_date) || '경력 정보 없음';

      initialNodes.push({
        id: uId,
        type: 'default',
        position: { x: 0, y: 0 },
        data: {
          label: (
            <div onClick={() => setDetailUser(u)} className="p-2 text-left cursor-pointer select-none">
              <div className="org-node-normal">
                <div className="font-bold text-xs text-[#1F2937] flex items-center justify-between">
                  <span>{isHead ? '🏛️' : isLeader ? '👑' : '👤'} {u.name} {uAge ? `(${uAge}세)` : ''}</span>
                  <span className={`text-[9px] px-1 rounded ${isHead ? 'bg-[#243B5A] text-white' : isLeader ? 'bg-indigo-900 text-white' : 'bg-slate-200 text-slate-700'}`}>
                    {u.department || '미지정'} {u.position || ''}
                  </span>
                </div>
                <div className="text-[10px] text-[#64748B] mt-0.5">{u.job_title || '팀원'} {u.phone ? `· ${u.phone}` : ''}</div>
              </div>

              <div className="org-node-pdf-only hidden">
                <div className="font-bold text-xs text-[#1F2937] flex items-center justify-between">
                  <span>{u.name}</span>
                  <span className="text-[10px] bg-slate-200 text-slate-800 px-1 rounded">{u.position || '사원'}</span>
                </div>
                <div className="text-[10px] text-[#243B5A] font-medium mt-1">경력: {careerText}</div>
              </div>
            </div>
          ),
          userId: u.id
        },
        style: { 
          background: isHead ? '#243B5A' : isLeader ? '#ffffff' : '#f8fafc', 
          color: isHead ? '#fff' : '#1F2937',
          border: isHead ? '2px solid #1d3049' : isLeader ? '2px solid #4f46e5' : '1px solid #cbd5e1', 
          borderRadius: '10px', 
          width: nodeWidth, 
          height: nodeHeight 
        }
      });
    });

    if (forceAutoLayout) {
      const layouted = getLayoutedElements(initialNodes, initialEdges, 'TB');
      setFlowNodes([...layouted.nodes]);
      setFlowEdges([...layouted.edges]);
    } else {
      const nodesWithSavedPos = initialNodes.map(node => {
        const foundUser = userList.find(u => u.id === node.data?.userId);
        if (foundUser && typeof foundUser.pos_x === 'number' && typeof foundUser.pos_y === 'number') {
          return {
            ...node,
            position: { x: foundUser.pos_x, y: foundUser.pos_y }
          };
        }
        return node;
      });

      const hasAnySavedPos = userList.some(u => typeof u.pos_x === 'number' && typeof u.pos_y === 'number');
      if (!hasAnySavedPos) {
        const layouted = getLayoutedElements(initialNodes, initialEdges, 'TB');
        setFlowNodes([...layouted.nodes]);
        setFlowEdges([...layouted.edges]);
      } else {
        setFlowNodes(nodesWithSavedPos);
        setFlowEdges(initialEdges);
      }
    }
  };

  useEffect(() => {
    if (activeTab === 'DAGRE' && users.length > 0) {
      buildFlowData(users, false);
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
        national_certificates: u.national_certificates || u.certificates || ''
      }));

      setUsers(formatted);
    } catch (err: any) {
      console.error('인사 정보 조회 실패:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNodePositions = async () => {
    if (!isAdmin) {
      alert('관리자 권한이 필요합니다.');
      return;
    }

    setIsSavingPositions(true);
    try {
      const updates = flowNodes
        .filter((node: any) => node.data?.userId)
        .map(async (node: any) => {
          const userId = node.data.userId;
          const posX = Math.round(node.position.x);
          const posY = Math.round(node.position.y);

          return supabase
            .from('app_users')
            .update({ pos_x: posX, pos_y: posY })
            .eq('id', userId);
        });

      await Promise.all(updates);
      alert('조직도 배치 위치가 성공적으로 저장되었습니다!');
      fetchUsers();
    } catch (err: any) {
      console.error('위치 저장 실패:', err);
      alert('위치 저장 중 오류가 발생했습니다: ' + (err.message || '알 수 없는 오류'));
    } finally {
      setIsSavingPositions(false);
    }
  };

  const handleResetAutoLayout = () => {
    if (window.confirm('조직도를 기본 자동 정렬 상태로 되돌리시겠습니까? (저장된 커스텀 위치가 초기화됩니다)')) {
      buildFlowData(users, true);
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
      alert('관리자 권한이 필요합니다.');
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
      birthDate: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: HRUser) => {
    if (!canEditUser(user)) {
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
      birthDate: user.password || '' 
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

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
      const payload: any = {
        id: formData.inputId.trim(), 
        name: formData.name,
        email: formData.email,
        department: formData.department,
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
        .map((u) => (subGroupType === 'DEPT' ? u.department || '미지정 파트' : u.position || '미지정 직급'))
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
        const orderA = RANK_ORDER[a] || 99;
        const orderB = RANK_ORDER[b] || 99;
        return orderA - orderB;
      });

  const displayedCategories = selectedSubCategory === 'ALL' 
    ? availableSubCategories 
    : [selectedSubCategory];

  return (
    <div className="w-full min-h-screen bg-[#F5F6F8] text-[#1F2937] p-2 sm:p-3 space-y-3 font-sans box-border">
      <style>{`
        .pdf-export-mode .org-node-normal {
          display: none !important;
        }
        .pdf-export-mode .org-node-pdf-only {
          display: block !important;
        }
      `}</style>

      <div className="bg-white p-3 rounded-xl border border-[#E2E5E9] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-xl text-[#243B5A]">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#1F2937]">인사 관리 및 조직도</h1>
            <p className="text-[11px] text-[#64748B]">파트별·직급별 체계적인 조직도를 조회합니다.</p>
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
              onClick={() => setActiveTab('DAGRE')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 ${
                activeTab === 'DAGRE' ? 'bg-[#243B5A] text-white shadow-xs' : 'text-[#64748B] hover:text-[#1F2937]'
              }`}
            >
              <Layers className="h-3.5 w-3.5" /> 인터랙티브 조직도
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

          {activeTab === 'LIST' && (
            <button
              onClick={handleExportExcel}
              className="flex items-center space-x-1 bg-[#16A34A] hover:bg-[#15803d] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs"
              title="현재 목록을 엑셀 파일로 저장합니다"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>엑셀 저장</span>
            </button>
          )}

          {activeTab === 'DAGRE' && (
            <button
              onClick={handleExportPDF}
              className="flex items-center space-x-1 bg-[#DC2626] hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs"
              title="인터랙티브 조직도를 고해상도 PDF로 저장합니다"
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
              const count = filteredUsers.filter((u) => 
                subGroupType === 'DEPT' 
                  ? (u.department || '미지정 파트') === subCat 
                  : (u.position || '미지정 직급') === subCat
              ).length;

              return (
                <button
                  key={subCat}
                  onClick={() => setSelectedSubCategory(subCat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition border ${
                    selectedSubCategory === subCat
                      ? 'bg-[#243B5A] text-white border-[#243B5A]'
                      : 'bg-[#F5F6F8] text-[#64748B] border-[#E2E5E9] hover:bg-[#E2E5E9]'
                  }`}
                >
                  {subCat} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-[#E2E5E9] text-center py-16 text-xs text-[#64748B]">조직도를 구성하는 중...</div>
      ) : activeTab === 'DAGRE' ? (
        <div className="bg-white border border-[#E2E5E9] rounded-xl p-3 shadow-xs space-y-2.5 relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-[#64748B]">
              <Layers className="h-3.5 w-3.5 text-[#243B5A]" />
              <span>인터랙티브 조직도 (Shift + 클릭 또는 드래그로 다중 선택하여 일괄 연결 가능)</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={handleResetAutoLayout}
                className="flex items-center gap-1 px-2.5 py-1 bg-[#F5F6F8] hover:bg-[#E2E5E9] text-[#64748B] border border-[#E2E5E9] font-bold rounded-lg transition text-[11px]"
                title="기본 자동 정렬 상태로 되돌립니다"
              >
                <RotateCcw className="h-3 w-3" /> 자동 정렬 초기화
              </button>
              
              {isAdmin && (
                <button
                  onClick={handleSaveNodePositions}
                  disabled={isSavingPositions}
                  className="flex items-center gap-1 px-3 py-1 bg-[#243B5A] hover:bg-[#1d3049] text-white font-bold rounded-lg transition shadow-xs disabled:opacity-50 text-[11px]"
                >
                  <Save className="h-3 w-3" /> {isSavingPositions ? '저장 중...' : '조직도 위치 저장'}
                </button>
              )}
            </div>
          </div>

          <div ref={dagreContainerRef} className="w-full h-[780px] bg-[#F8FAFC] border border-[#E2E5E9] rounded-xl overflow-hidden relative">
            <ReactFlow
              nodes={flowNodes}
              edges={flowEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onSelectionChange={({ nodes }) => setSelectedFlowNodes(nodes)}
              onNodeDragStop={(event, node) => {
                setFlowNodes((nds: Node[]) =>
                  nds.map((n) => (n.id === node.id ? { ...n, position: node.position } : n))
                );
              }}
              fitView
              fitViewOptions={{ padding: 0.2, minZoom: 0.5, maxZoom: 1.2 }}
              minZoom={0.1}
              maxZoom={3}
              defaultEdgeOptions={{ type: 'smoothstep', style: { stroke: '#4f46e5', strokeWidth: 2 } }}
            >
              <Controls showInteractive={true} />
              <MiniMap style={{ height: 120 }} zoomable pannable />
              <Background gap={16} size={1} color="#e2e8f0" />
            </ReactFlow>

            {selectedFlowNodes.length > 0 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#243B5A] text-white px-4 py-2 rounded-xl shadow-xl flex items-center space-x-3 text-xs border border-white/20 animate-fade-in">
                <span className="font-semibold">
                  선택됨: <span className="text-yellow-300 font-bold">{selectedFlowNodes.length}명</span>
                </span>
                <button
                  onClick={handleBatchConnect}
                  className="bg-white text-[#243B5A] px-2.5 py-1 rounded-lg font-bold hover:bg-slate-100 transition flex items-center gap-1 shadow-xs text-[11px]"
                >
                  <Link2 className="h-3 w-3" /> 첫 번째 선택자에 일괄 선 연결
                </button>
                <button
                  onClick={() => setSelectedFlowNodes([])}
                  className="text-slate-300 hover:text-white px-1 font-medium text-[11px]"
                >
                  선택 해제
                </button>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'ORG' ? (
        <div className="space-y-3">
          {displayedCategories.map((catName) => {
            const groupMembers = filteredUsers.filter((u) =>
              subGroupType === 'DEPT'
                ? (u.department || '미지정 파트') === catName
                : (u.position || '미지정 직급') === catName
            );

            const sortMembers = (a: HRUser, b: HRUser) => {
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

            const leaders = groupMembers.filter(u => u.job_title === '팀장').sort(sortMembers);
            const members = groupMembers.filter(u => u.job_title !== '팀장').sort(sortMembers);

            const isCollapsed = !!collapsedGroups[catName];

            return (
              <div key={catName} className="bg-white border border-[#E2E5E9] rounded-xl overflow-hidden shadow-xs transition-all">
                <div 
                  onClick={() => toggleGroup(catName)}
                  className="flex items-center justify-between p-3 bg-[#F5F6F8] hover:bg-[#E2E5E9]/50 cursor-pointer border-b border-[#E2E5E9] transition"
                >
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-[#243B5A] text-white rounded-lg">
                      {subGroupType === 'DEPT' ? <Building2 className="h-3.5 w-3.5" /> : <Briefcase className="h-3.5 w-3.5" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-[#1F2937] text-xs flex items-center gap-2">
                        {catName} 
                        <span className="text-[10px] bg-white text-[#243B5A] font-bold px-2 py-0.2 rounded-full border border-[#E2E5E9]">
                          총 {groupMembers.length}명
                        </span>
                      </h3>
                    </div>
                  </div>

                  <button className="text-[#64748B] hover:text-[#1F2937] p-1 flex items-center gap-1 text-xs font-medium">
                    <span>{isCollapsed ? '펼치기' : '접기'}</span>
                    {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {!isCollapsed && (
                  <div className="p-3 bg-gradient-to-b from-slate-50/50 to-white space-y-3">
                    {leaders.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1 text-[11px] font-bold text-[#243B5A] px-1">
                          <GitCommit className="h-3.5 w-3.5 text-[#243B5A]" />
                          <span>파트 리더 (팀장)</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                          {leaders.map((leader) => renderMemberCard(leader, true, setDetailUser, isSelf))}
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
                          <Users className="h-3.5 w-3.5 text-[#64748B]" />
                          <span>소속 구성원 ({members.length}명)</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                          {members.map((member) => renderMemberCard(member, false, setDetailUser, isSelf))}
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

              return (
                <div key={u.id} className="bg-white p-3 border border-[#E2E5E9] rounded-xl shadow-xs space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-[#1F2937]">{u.name}</span>
                        {age && <span className="text-[10px] text-[#243B5A] font-bold">({age}세)</span>}
                        {u.id && <span className="text-[10px] text-[#64748B] font-mono">({u.id})</span>}
                        {isSelf(u) && (
                          <span className="text-[9px] bg-[#243B5A] text-white font-bold px-1.5 py-0.2 rounded shrink-0">
                            나
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#64748B] flex items-center gap-1 flex-wrap">
                        <span className="px-1.5 py-0.5 bg-[#F5F6F8] font-medium rounded border border-[#E2E5E9]">
                          {u.department || '미지정'} · {u.position || '사원'} {u.job_title && u.job_title !== '없음' ? `(${u.job_title}${u.field ? `/${u.field}` : ''})` : ''}
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
                  <th className="p-3">권한</th>
                  <th className="p-3">자사 근속 (입사일)</th>
                  <th className="p-3">총 경력 (시작일)</th>
                  <th className="p-3">사내자격</th>
                  <th className="p-3">국가자격</th>
                  <th className="p-3 text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E5E9]">
                {filteredUsers.map((u) => {
                  const canEdit = canEditUser(u);
                  const age = calculateAge(u.password);
                  return (
                    <tr key={u.id} className="hover:bg-[#F5F6F8]/60 transition">
                      <td className="p-3 font-bold text-[#1F2937]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{u.name}</span>
                          {age && <span className="text-xs text-[#243B5A] font-bold">({age}세)</span>}
                          {u.id && <span className="text-[10px] text-[#64748B] font-mono font-normal">({u.id})</span>}
                          {isSelf(u) && (
                            <span className="text-[10px] bg-[#243B5A] text-white font-bold px-1.5 py-0.2 rounded">
                              나
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-[#1F2937]">
                        {u.department} / {u.position} {u.job_title && u.job_title !== '없음' ? `(${u.job_title}${u.field ? `/${u.field}` : ''})` : ''}
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
                          u.role === 'ADMIN' ? 'bg-[#243B5A] text-white border-[#243B5A]' : 'bg-[#F5F6F8] text-[#64748B] border-[#E2E5E9]'
                        }`}>
                          {u.role === 'ADMIN' ? '관리자' : '일반 사용자'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="text-[#16A34A] font-semibold">{calculateCareerDetails(u.join_date) || '-'}</div>
                        <div className="text-[10px] text-[#64748B]">{u.join_date || ''}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-[#2563EB] font-semibold">{calculateCareerDetails(u.career_start_date) || '-'}</div>
                        <div className="text-[10px] text-[#64748B]">{u.career_start_date || ''}</div>
                      </td>
                      <td className="p-3 text-[#1F2937] font-medium">{u.internal_certificates || '-'}</td>
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

      {detailUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-3">
          <div className="bg-white border-t sm:border border-[#E2E5E9] rounded-t-2xl sm:rounded-xl max-w-md w-full p-4 shadow-2xl space-y-3 text-[#1F2937] relative animate-in slide-in-from-bottom duration-200">
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto sm:hidden mb-1"></div>

            <div className="flex items-start justify-between border-b border-[#E2E5E9] pb-2.5">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-full bg-[#243B5A] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {detailUser.name?.[0] || '유'}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-xs font-bold text-[#1F2937]">
                      {detailUser.name} {calculateAge(detailUser.password) ? `(${calculateAge(detailUser.password)}세)` : ''}
                    </h3>
                    {detailUser.id && <span className="text-[10px] text-[#64748B] font-mono">({detailUser.id})</span>}
                    {isSelf(detailUser) && (
                      <span className="text-[10px] bg-[#243B5A] text-white font-bold px-1.5 py-0.2 rounded-full">
                        나
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#64748B] font-medium">
                    {detailUser.department || '미지정 파트'} · {detailUser.position || '사원'} {detailUser.job_title && detailUser.job_title !== '없음' ? `(${detailUser.job_title}${detailUser.field ? `/${detailUser.field}` : ''})` : ''}
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
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] outline-none cursor-pointer"
                  >
                    <option value="운영">운영</option>
                    <option value="관리">관리</option>
                    <option value="1팀">1팀</option>
                    <option value="2팀">2팀</option>
                    <option value="3팀">3팀</option>
                    <option value="4팀">4팀</option>
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
  isSelf: (user: HRUser) => boolean
) {
  const joinCareer = calculateCareerDetails(member.join_date);
  const totalCareer = calculateCareerDetails(member.career_start_date);
  const age = calculateAge(member.password);

  return (
    <div 
      key={member.id} 
      onClick={() => setDetailUser(member)}
      className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between space-y-1.5 group cursor-pointer shadow-xs ${
        isLeader 
          ? 'bg-white border-[#243B5A] ring-1 ring-[#243B5A]/20 shadow-sm' 
          : 'bg-white border-[#E2E5E9] hover:border-slate-400 hover:shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 min-w-0">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
            isLeader ? 'bg-[#243B5A] text-white' : 'bg-slate-200 text-[#243B5A]'
          }`}>
            {member.name?.[0] || '유'}
          </div>
          <div className="truncate">
            <div className="flex items-center space-x-1.5 flex-wrap">
              <span className="font-bold text-xs text-[#1F2937] group-hover:text-[#243B5A] transition-colors">{member.name}</span>
              {age && <span className="text-[10px] text-[#243B5A] font-bold">({age}세)</span>}
              {isSelf(member) && (
                <span className="text-[9px] bg-[#243B5A] text-white font-bold px-1">
                  나
                </span>
              )}
            </div>
            <div className="text-[10px] text-[#64748B] flex items-center gap-1 pt-0.5">
              <span>{member.position || '사원'}</span>
              {member.job_title && member.job_title !== '없음' && (
                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                  isLeader ? 'bg-[#243B5A] text-white' : 'bg-sky-50 text-sky-700 border border-sky-200'
                }`}>
                  {member.job_title}{member.field ? `/${member.field}` : ''}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="pt-1.5 border-t border-[#E2E5E9] text-[10px] space-y-1">
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
      </div>
    </div>
  );
}
