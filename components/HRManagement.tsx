'use client';

import { useState, useEffect } from 'react';
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
  photo_url?: string | null;
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
  const [activeTab, setActiveTab] = useState<'ORG' | 'LIST'>('ORG');
  const [searchTerm, setSearchTerm] = useState('');

  const [subGroupType, setSubGroupType] = useState<'DEPT' | 'POS'>('DEPT');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('ALL');

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<HRUser | null>(null);
  const [selectedUser, setSelectedUser] = useState<HRUser | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
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

  const [notice, setNotice] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
  } | null>(null);
  const [confirmUser, setConfirmUser] = useState<HRUser | null>(null);

  const showNotice = (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info'
  ) => {
    setNotice({ message, type });
  };

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

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

  const validatePhotoFile = (file: File | null) => {
    if (!file) return true;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      showNotice('사진은 JPG, PNG, WebP 형식만 등록할 수 있습니다.', 'warning');
      return false;
    }
    return true;
  };

  const handlePhotoChange = (file: File | null) => {
    if (!file) {
      setPhotoFile(null);
      setPhotoPreview(null);
      return;
    }
    if (!validatePhotoFile(file)) return;
    setPhotoFile(file);
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
  };

  const uploadProfilePhoto = async (userId: string, file: File) => {
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const objectPath = `${userId}/profile.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('profile-photos')
      .upload(objectPath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('profile-photos')
      .getPublicUrl(objectPath);

    return data.publicUrl;
  };

  const handleOpenAddModal = () => {
    if (!isAdmin) {
      showNotice('관리자 권한이 필요합니다.', 'warning');
      return;
    }
    setSelectedUser(null);
    setPhotoFile(null);
    setPhotoPreview(null);
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
      showNotice('본인의 정보 또는 관리자 권한이 있는 경우에만 수정이 가능합니다.', 'warning');
      return;
    }
    setSelectedUser(user);
    setPhotoFile(null);
    setPhotoPreview(user.photo_url || null);
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

  const handleConfirmDelete = async () => {
    if (!confirmUser) return;

    const user = confirmUser;
    setConfirmUser(null);

    try {
      const { error } = await supabase
        .from('app_users')
        .delete()
        .eq('id', user.id);

      if (error) throw error;

      showNotice(`${user.name} 님의 정보가 성공적으로 삭제되었습니다.`, 'success');
      fetchUsers();
    } catch (err: any) {
      console.error('삭제 실패:', err);
      showNotice('구성원 삭제 실패: ' + (err.message || '알 수 없는 오류'), 'error');
    }
  };

  const handleDeleteUser = async (user: HRUser) => {
    if (!isAdmin) {
      showNotice('관리자만 구성원을 삭제할 수 있습니다.', 'warning');
      return;
    }

    if (currentUser?.id === user.id) {
      showNotice('현재 로그인되어 있는 본인 계정은 삭제할 수 없습니다.', 'warning');
      return;
    }

    setConfirmUser(user);
    return;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedUser && !canEditUser(selectedUser)) {
      showNotice('본인 정보만 수정할 권한이 있습니다.', 'warning');
      return;
    }

    if (!formData.inputId.trim()) {
      showNotice('로그인에 사용할 아이디를 입력해주세요.', 'warning');
      return;
    }

    if (formData.birthDate && formData.birthDate.length !== 8) {
      showNotice('생년월일은 8자리(YYYYMMDD)로 정확히 입력해주세요.', 'warning');
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

      if (photoFile && !validatePhotoFile(photoFile)) {
        return;
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

        if (photoFile) {
          try {
            const photoUrl = await uploadProfilePhoto(selectedUser.id, photoFile);
            const { error: photoUpdateError } = await supabase
              .from('app_users')
              .update({ photo_url: photoUrl })
              .eq('id', selectedUser.id);
            if (photoUpdateError) throw photoUpdateError;
          } catch (photoError: any) {
            console.error('사진 업로드 실패:', photoError);
            showNotice('인사 정보는 저장되었지만 사진 업로드에 실패했습니다.', 'warning');
          }
        }

        showNotice('인사 정보가 성공적으로 수정되었습니다.', 'success');
      } else {
        if (!formData.birthDate) {
          showNotice('비밀번호로 사용할 생년월일 8자리를 입력해주세요.', 'warning');
          return;
        }

        const { error } = await supabase.from('app_users').insert([
          {
            ...payload,
            role: isSuperAdmin ? (formData.role || 'USER') : 'USER',
          },
        ]);

        if (error) throw error;

        if (photoFile) {
          try {
            const photoUrl = await uploadProfilePhoto(formData.inputId.trim(), photoFile);
            const { error: photoUpdateError } = await supabase
              .from('app_users')
              .update({ photo_url: photoUrl })
              .eq('id', formData.inputId.trim());
            if (photoUpdateError) throw photoUpdateError;
          } catch (photoError: any) {
            console.error('사진 업로드 실패:', photoError);
            showNotice('구성원은 등록되었지만 사진 업로드에 실패했습니다.', 'warning');
          }
        }

        showNotice('새 구성원이 등록되었습니다.', 'success');
      }

      setIsModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      console.error('저장 실패:', err);
      showNotice('저장 중 오류가 발생했습니다: ' + (err.message || '알 수 없는 오류'), 'error');
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
      <div className="bg-white p-3 rounded-xl border border-[#E2E5E9] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-xl text-[#243B5A]">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#1F2937]">인사 관리</h1>
            <p className="text-[11px] text-[#64748B]">구성원 정보를 카드와 목록으로 관리합니다.</p>
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
              onClick={() => setActiveTab('LIST')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                activeTab === 'LIST' ? 'bg-[#243B5A] text-white shadow-xs' : 'text-[#64748B] hover:text-[#1F2937]'
              }`}
            >
              목록 뷰
            </button>
          </div>

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
                <Layers className="h-3.5 w-3.5 text-[#243B5A]" /> 보기:
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
        <div className="bg-white rounded-xl border border-[#E2E5E9] text-center py-16 text-xs text-[#64748B]">인사 정보를 불러오는 중...</div>
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

            const leaders = groupMembers.filter(u => ['본부장', '소장', '팀장'].includes(u.job_title || '')).sort(sortMembers);
            const members = groupMembers.filter(u => !['본부장', '소장', '팀장'].includes(u.job_title || '')).sort(sortMembers);

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

                  <div className="flex items-center space-x-2">
                    {isAdmin && subGroupType === 'DEPT' && (
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
                          <Users className="h-3.5 w-3.5 text-[#64748B]" />
                          <span>소속 구성원 ({members.length}명)</span>
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

              <div className="rounded-xl border border-[#E2E5E9] bg-[#F8FAFC] p-3">
                <div className="flex items-center gap-3">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="프로필 미리보기"
                      className="h-20 w-20 rounded-xl object-cover border border-[#E2E5E9] bg-white"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-xl bg-slate-200 text-[#243B5A] flex items-center justify-center text-xl font-bold">
                      {formData.name?.[0] || '유'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <label className="block font-bold text-[#64748B] mb-1">사진</label>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                      onChange={(e) => handlePhotoChange(e.target.files?.[0] || null)}
                      className="block w-full text-[11px] text-[#64748B] file:mr-2 file:rounded-lg file:border-0 file:bg-[#243B5A] file:px-2.5 file:py-1.5 file:text-[11px] file:font-semibold file:text-white hover:file:bg-[#1d3049]"
                    />
                    <p className="mt-1 text-[10px] text-[#94A3B8]">JPG, PNG, WebP만 등록할 수 있습니다.</p>
                  </div>
                </div>
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

      {notice && (
        <div className="fixed top-5 right-5 z-[100] w-[min(92vw,420px)]">
          <div className={`rounded-xl border bg-white px-4 py-3 shadow-lg flex items-start gap-3 ${
            notice.type === 'success' ? 'border-green-200' :
            notice.type === 'error' ? 'border-red-200' :
            notice.type === 'warning' ? 'border-amber-200' : 'border-blue-200'
          }`}>
            <div className={`mt-0.5 h-2.5 w-2.5 rounded-full shrink-0 ${
              notice.type === 'success' ? 'bg-green-500' :
              notice.type === 'error' ? 'bg-red-500' :
              notice.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
            }`} />
            <p className="text-sm font-medium text-[#1F2937] flex-1">{notice.message}</p>
            <button onClick={() => setNotice(null)} className="text-[#94A3B8] hover:text-[#475569]">×</button>
          </div>
        </div>
      )}

      {confirmUser && (
        <div className="fixed inset-0 z-[110] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-[#E2E5E9] p-6">
            <h3 className="text-lg font-bold text-[#1F2937]">구성원 삭제</h3>
            <p className="mt-2 text-sm text-[#64748B] leading-6">
              정말로 <span className="font-bold text-[#1F2937]">[{confirmUser.name}]</span> 님의 인사 정보를 삭제하시겠습니까?
              <br />삭제 후에는 복구할 수 없습니다.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmUser(null)}
                className="px-4 py-2 rounded-lg border border-[#CBD5E1] text-sm font-semibold text-[#475569] hover:bg-[#F8FAFC]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
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

  return (
    <div 
      key={member.id} 
      className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between space-y-1.5 group shadow-xs ${
        isLeader 
          ? 'bg-white border-[#243B5A] ring-1 ring-[#243B5A]/20 shadow-sm' 
          : 'bg-white border-[#E2E5E9] hover:border-slate-400 hover:shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between">
        <div 
          onClick={() => setDetailUser(member)}
          className="flex items-center space-x-2 min-w-0 cursor-pointer flex-1"
        >
          {member.photo_url ? (
            <img
              src={member.photo_url}
              alt={`${member.name} 사진`}
              className="w-9 h-9 rounded-full object-cover border border-[#E2E5E9] shrink-0"
            />
          ) : (
            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
              isLeader ? 'bg-[#243B5A] text-white' : 'bg-slate-200 text-[#243B5A]'
            }`}>
              {member.name?.[0] || '유'}
            </div>
          )}
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
