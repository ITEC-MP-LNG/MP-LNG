'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  X, 
  GraduationCap, 
  Calendar as CalendarIcon,
  ChevronLeft, 
  ChevronRight, 
  MapPin, 
  Users,
  Clock,
  Bell,
  AlertCircle,
  HelpCircle,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Education, EducationRecord } from '@/lib/types';

// 신규 EVENT 타입 정의
interface EventItem {
  id: number;
  title: string;
  event_date: string;
  time_slot: string;
  location: string;
  description: string;
  created_at: string;
  updated_at: string;
}

interface EducationManagementProps {
  isAdmin: boolean;
  educations: Education[];
  eduRecords: EducationRecord[];
  loadingEdu: boolean;
  fetchEducations: () => Promise<void>;
  fetchEducationRecords: () => Promise<void>;
  currentUser?: { name: string };
}

const getLocalDateString = (d: Date = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function EducationManagement({
  isAdmin,
  educations,
  loadingEdu,
  fetchEducations,
  currentUser,
}: EducationManagementProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // 탭 상태 ('education' | 'event')
  const [activeTab, setActiveTab] = useState<'education' | 'event'>('education');

  // 커스텀 알림(Alert / Confirm) 상태 관리
  const [alertDialog, setAlertDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'info' | 'error' | 'success';
  }>({
    show: false,
    title: '',
    message: '',
    type: 'info',
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showAlert = (message: string, title = '안내', type: 'info' | 'error' | 'success' = 'info') => {
    setAlertDialog({ show: true, title, message, type });
  };

  const showConfirm = (message: string, onConfirm: () => void, title = '확인 요청') => {
    setConfirmDialog({ show: true, title, message, onConfirm });
  };

  // 교육 관련 모달 상태
  const [showEduModal, setShowEduModal] = useState(false);
  const [editingEdu, setEditingEdu] = useState<Education | null>(null);
  const [selectedEduForDetail, setSelectedEduForDetail] = useState<Education | null>(null);

  const [assignedNoticeEdu, setAssignedNoticeEdu] = useState<Education | null>(null);
  const [showNoticeModal, setShowNoticeModal] = useState(false);

  const [eduTitle, setEduTitle] = useState('');
  const [eduDate, setEduDate] = useState(getLocalDateString());
  const [eduTimeSlot, setEduTimeSlot] = useState('10:00~12:00');
  const [eduLocation, setEduLocation] = useState('대회의실');

  const [assignedWorkersInput, setAssignedWorkersInput] = useState('');
  const [assignedWorkers, setAssignedWorkers] = useState<string[]>([]);

  // EVENT 관련 상태 및 데이터
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<EventItem | null>(null);

  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState(getLocalDateString());
  const [eventTimeSlot, setEventTimeSlot] = useState('14:00~15:00');
  const [eventLocation, setEventLocation] = useState('');
  const [eventDescription, setEventDescription] = useState('');

  // 이벤트 데이터 불러오기
  const fetchEvents = async () => {
    try {
      setLoadingEvents(true);
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true });
      if (error) throw error;
      setEvents(data || []);
    } catch (err: any) {
      console.error('이벤트 불러오기 실패:', err?.message);
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // 교육 당일 알림 기능 유지
  useEffect(() => {
    if (!currentUser?.name || educations.length === 0) return;

    const todayStr = getLocalDateString();
    const todayEducations = educations.filter((edu) =>
      edu.edu_date === todayStr &&
      edu.assigned_workers &&
      edu.assigned_workers.includes(currentUser.name)
    );

    if (todayEducations.length > 0) {
      const targetEdu = todayEducations[0];
      const hasSeen = sessionStorage.getItem(`edu_notice_seen_${targetEdu.id}_${currentUser.name}`);

      if (!hasSeen) {
        setAssignedNoticeEdu(targetEdu);
        setShowNoticeModal(true);
      }
    }
  }, [currentUser?.name, educations]);

  const handleCloseNoticeModal = () => {
    if (assignedNoticeEdu && currentUser?.name) {
      sessionStorage.setItem(`edu_notice_seen_${assignedNoticeEdu.id}_${currentUser.name}`, 'true');
    }
    setShowNoticeModal(false);
  };

  const handleAddWorkers = () => {
    if (!assignedWorkersInput.trim()) return;
    const names = assignedWorkersInput
      .split(',')
      .map(n => n.trim())
      .filter(n => n.length > 0);

    if (names.length === 0) return;

    setAssignedWorkers(prev => Array.from(new Set([...prev, ...names])));
    setAssignedWorkersInput('');
  };

  const handleRemoveWorker = (nameToRemove: string) => {
    setAssignedWorkers(prev => prev.filter(name => name !== nameToRemove));
  };

  // 교육 등록/수정 핸들러
  const handleOpenEduCreate = (dateStr?: string) => {
    if (!isAdmin) return showAlert('관리자만 교육을 등록할 수 있습니다.', '권한 없음', 'error');
    setEditingEdu(null);
    setEduTitle('');
    setEduDate(dateStr || getLocalDateString());
    setEduTimeSlot('10:00~12:00');
    setEduLocation('대회의실');
    setAssignedWorkersInput('');
    setAssignedWorkers([]);
    setShowEduModal(true);
  };

  const handleOpenEduEdit = (edu: Education, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return showAlert('관리자만 교육을 수정할 수 있습니다.', '권한 없음', 'error');
    setEditingEdu(edu);
    setEduTitle(edu.title);
    setEduDate(edu.edu_date);
    setEduTimeSlot(edu.time_slot);
    setEduLocation(edu.location);
    setAssignedWorkersInput('');
    setAssignedWorkers(edu.assigned_workers || []);
    setShowEduModal(true);
  };

  const handleDeleteEdu = (id: number | string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return showAlert('삭제 권한이 없습니다.', '권한 없음', 'error');

    showConfirm('정말 이 교육 항목을 삭제하시겠습니까?', async () => {
      try {
        const { error } = await supabase.from('educations').delete().eq('id', id);
        if (error) throw error;

        showAlert('성공적으로 삭제되었습니다.', '삭제 완료', 'success');
        setShowEduModal(false);
        setSelectedEduForDetail(null);
        fetchEducations();
      } catch (err: any) {
        showAlert(`삭제 실패: ${err?.message || '오류가 발생했습니다.'}`, '오류 발생', 'error');
      }
    }, '교육 일정 삭제');
  };

  const handleSubmitEdu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return showAlert('등록/수정 권한이 없습니다.', '권한 없음', 'error');
    if (!eduTitle.trim()) return showAlert('교육명을 입력해주세요.', '입력 항목 누락', 'error');

    try {
      const basePayload: any = {
        title: eduTitle,
        time_slot: eduTimeSlot,
        location: eduLocation,
        assigned_workers: assignedWorkers,
        updated_at: new Date().toISOString()
      };

      if (editingEdu) {
        let { error } = await supabase.from('educations').update({ ...basePayload, edu_date: eduDate }).eq('id', editingEdu.id);
        if (error) {
          const { error: retryError } = await supabase.from('educations').update(basePayload).eq('id', editingEdu.id);
          if (retryError) throw retryError;
        }
        showAlert('교육 일정이 수정되었습니다.', '수정 완료', 'success');
      } else {
        let { error } = await supabase.from('educations').insert([{ ...basePayload, edu_date: eduDate }]);
        if (error) {
          const { error: retryError } = await supabase.from('educations').insert([basePayload]);
          if (retryError) throw retryError;
        }
        showAlert('신규 교육 일정이 등록되었습니다.', '등록 완료', 'success');
      }

      setShowEduModal(false);
      fetchEducations();
    } catch (err: any) {
      showAlert('교육 저장 실패: ' + (err?.message || '오류가 발생했습니다.'), '저장 오류', 'error');
    }
  };

  // EVENT 등록/수정 핸들러
  const handleOpenEventCreate = (dateStr?: string) => {
    setEditingEvent(null);
    setEventTitle('');
    setEventDate(dateStr || getLocalDateString());
    setEventTimeSlot('14:00~15:00');
    setEventLocation('');
    setEventDescription('');
    setShowEventModal(true);
  };

  const handleOpenEventEdit = (ev: EventItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingEvent(ev);
    setEventTitle(ev.title);
    setEventDate(ev.event_date);
    setEventTimeSlot(ev.time_slot || '');
    setEventLocation(ev.location || '');
    setEventDescription(ev.description || '');
    setShowEventModal(true);
  };

  const handleDeleteEvent = (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    showConfirm('정말 이 EVENT를 삭제하시겠습니까?', async () => {
      try {
        const { error } = await supabase.from('events').delete().eq('id', id);
        if (error) throw error;

        showAlert('EVENT가 삭제되었습니다.', '삭제 완료', 'success');
        setShowEventModal(false);
        setSelectedEventForDetail(null);
        fetchEvents();
      } catch (err: any) {
        showAlert(`EVENT 삭제 실패: ${err?.message || '오류가 발생했습니다.'}`, '오류 발생', 'error');
      }
    }, 'EVENT 삭제');
  };

  const handleSubmitEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) return showAlert('EVENT 제목을 입력해주세요.', '입력 항목 누락', 'error');

    try {
      const payload = {
        title: eventTitle,
        event_date: eventDate,
        time_slot: eventTimeSlot,
        location: eventLocation,
        description: eventDescription,
        updated_at: new Date().toISOString()
      };

      if (editingEvent) {
        const { error } = await supabase.from('events').update(payload).eq('id', editingEvent.id);
        if (error) throw error;
        showAlert('EVENT가 수정되었습니다.', '수정 완료', 'success');
      } else {
        const { error } = await supabase.from('events').insert([payload]);
        if (error) throw error;
        showAlert('신규 EVENT가 등록되었습니다.', '등록 완료', 'success');
      }

      setShowEventModal(false);
      fetchEvents();
    } catch (err: any) {
      showAlert('EVENT 저장 실패: ' + (err?.message || '오류가 발생했습니다.'), '저장 오류', 'error');
    }
  };

  // 🕒 해당일 18:00 목록 자동 비노출(삭제) 판단 함수
  const isExpired = (dateStr: string) => {
    if (!dateStr) return false;
    const now = new Date();
    const targetCutoff = new Date(`${dateStr}T18:00:00`);
    return now >= targetCutoff;
  };

  const visibleEducations = educations.filter(edu => !isExpired(edu.edu_date));
  const visibleEvents = events.filter(ev => !isExpired(ev.event_date));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = getLocalDateString();

  const calendarDays = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(d);
  }

  return (
    <div className="w-full text-[#1F2937] p-4 sm:p-6 space-y-4 font-sans border-box">
      
      {/* 🚀 상단 타이틀 영역 및 탭 전환 */}
      <div className="bg-white p-4 rounded-xl border border-[#E2E5E9] shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-xl text-[#243B5A]">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#1F2937]">교육 및 EVENT 통합 캘린더</h1>
            <p className="text-xs text-[#64748B]">사내 정기 교육 및 중요 EVENT 일정 관리</p>
          </div>
        </div>

        {/* 탭 버튼 */}
        <div className="flex bg-[#F5F6F8] p-1 rounded-lg border border-[#E2E5E9]">
          <button
            onClick={() => setActiveTab('education')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              activeTab === 'education' ? 'bg-[#243B5A] text-white shadow-xs' : 'text-[#64748B] hover:text-[#1F2937]'
            }`}
          >
            교육 일정 관리
          </button>
          <button
            onClick={() => setActiveTab('event')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              activeTab === 'event' ? 'bg-[#243B5A] text-white shadow-xs' : 'text-[#64748B] hover:text-[#1F2937]'
            }`}
          >
            EVENT 관리
          </button>
        </div>
      </div>

      {/* 캘린더 컨트롤 및 등록 버튼 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-xl border border-[#E2E5E9] shadow-xs gap-3">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            className="p-2 hover:bg-[#F5F6F8] rounded-lg transition text-[#64748B] border border-[#E2E5E9]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="text-sm font-bold text-[#1F2937] px-2">
            {year}년 {month + 1}월
          </h2>
          <button
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            className="p-2 hover:bg-[#F5F6F8] rounded-lg transition text-[#64748B] border border-[#E2E5E9]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="text-xs px-3 py-2 bg-[#F5F6F8] hover:bg-[#E2E5E9] rounded-lg text-[#1F2937] font-semibold border border-[#E2E5E9] transition"
          >
            오늘
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {activeTab === 'education' && isAdmin && (
            <button
              onClick={() => handleOpenEduCreate()}
              className="flex items-center justify-center space-x-1.5 bg-[#243B5A] text-white px-3.5 py-2 rounded-lg hover:bg-[#1d3049] transition shadow-xs font-medium text-xs"
            >
              <Plus className="h-4 w-4" />
              <span>신규 교육 등록</span>
            </button>
          )}
          {activeTab === 'event' && (
            <button
              onClick={() => handleOpenEventCreate()}
              className="flex items-center justify-center space-x-1.5 bg-[#0D9488] text-white px-3.5 py-2 rounded-lg hover:bg-[#0f766e] transition shadow-xs font-medium text-xs"
            >
              <Plus className="h-4 w-4" />
              <span>신규 EVENT 등록</span>
            </button>
          )}
        </div>
      </div>

      {loadingEdu || loadingEvents ? (
        <div className="bg-white rounded-xl border border-[#E2E5E9] text-center py-12 text-xs text-[#64748B]">일정을 불러오는 중...</div>
      ) : (
        <>
          {/* 달력 뷰 */}
          <div className="bg-white rounded-xl border border-[#E2E5E9] overflow-hidden shadow-xs">
            <div className="grid grid-cols-7 bg-[#F5F6F8] border-b border-[#E2E5E9] text-center py-2.5 text-xs font-bold text-[#64748B]">
              <div className="text-red-600">일</div>
              <div>월</div>
              <div>화</div>
              <div>수</div>
              <div>목</div>
              <div>금</div>
              <div className="text-blue-600">토</div>
            </div>

            <div className="grid grid-cols-7 auto-rows-fr gap-px bg-[#E2E5E9]">
              {calendarDays.map((day, idx) => {
                if (day === null) {
                  return <div key={idx} className="bg-[#F5F6F8]/50 min-h-[110px]" />;
                }

                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayEdus = educations.filter(e => e.edu_date === dateStr);
                const dayEvts = events.filter(ev => ev.event_date === dateStr);
                const isToday = todayStr === dateStr;

                return (
                  <div
                    key={idx}
                    className={`bg-white p-1.5 min-h-[110px] flex flex-col justify-between hover:bg-[#F5F6F8]/50 transition relative ${
                      isToday ? 'bg-blue-50/30' : ''
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          isToday ? 'bg-[#243B5A] text-white' : 'text-[#1F2937]'
                        }`}>
                          {day}
                        </span>
                        
                        <div className="flex items-center space-x-1">
                          {activeTab === 'education' && isAdmin && (
                            <button
                              onClick={() => handleOpenEduCreate(dateStr)}
                              className="text-[#64748B] hover:text-[#243B5A] p-0.5 rounded"
                              title="이 날짜에 교육 추가"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          )}
                          {activeTab === 'event' && (
                            <button
                              onClick={() => handleOpenEventCreate(dateStr)}
                              className="text-[#64748B] hover:text-[#0D9488] p-0.5 rounded"
                              title="이 날짜에 이벤트 추가"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1 max-h-[85px] overflow-y-auto">
                        {dayEdus.map(edu => (
                          <div
                            key={`edu-${edu.id}`}
                            onClick={() => setSelectedEduForDetail(edu)}
                            className="p-1 rounded text-[10px] bg-slate-100 border border-slate-300 text-[#243B5A] cursor-pointer hover:bg-slate-200 transition truncate font-medium flex items-center gap-1"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#243B5A] shrink-0" />
                            <span className="truncate"><strong className="font-semibold">[교육]</strong> {edu.title}</span>
                          </div>
                        ))}
                        {dayEvts.map(ev => (
                          <div
                            key={`evt-${ev.id}`}
                            onClick={() => setSelectedEventForDetail(ev)}
                            className="p-1 rounded text-[10px] bg-teal-50 border border-teal-200 text-teal-900 cursor-pointer hover:bg-teal-100 transition truncate font-medium flex items-center gap-1"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#0D9488] shrink-0" />
                            <span className="truncate"><strong className="font-semibold">[EVENT]</strong> {ev.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 하단 목록 영역 */}
          {activeTab === 'education' ? (
            <div className="mt-6 space-y-3">
              <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
                <GraduationCap className="h-4 w-4 text-[#243B5A]" />
                <span>전체 교육 목록</span>
              </h3>
              {visibleEducations.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center border border-[#E2E5E9] text-[#64748B] text-xs">
                  등록된 교육 일정이 없습니다.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {visibleEducations.map(edu => (
                    <div 
                      key={edu.id} 
                      onClick={() => setSelectedEduForDetail(edu)}
                      className="bg-white rounded-xl border border-[#E2E5E9] p-4 shadow-xs hover:border-slate-400 transition cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-[#243B5A] border border-slate-200">
                            {edu.edu_date} ({edu.time_slot})
                          </span>
                          
                          {isAdmin && (
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={(e) => handleOpenEduEdit(edu, e)}
                                className="p-1 text-[#64748B] hover:text-[#243B5A] rounded hover:bg-slate-100"
                                title="교육 수정"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={(e) => handleDeleteEdu(edu.id, e)}
                                className="p-1 text-[#64748B] hover:text-[#DC2626] rounded hover:bg-slate-100"
                                title="교육 삭제"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        <h4 className="text-xs font-bold text-[#1F2937] mb-2">{edu.title}</h4>

                        <div className="space-y-1 text-[11px] text-[#64748B] bg-slate-50 p-2.5 rounded-lg border border-[#E2E5E9]">
                          <div>장소: <strong className="text-[#1F2937]">{edu.location}</strong></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
                <CalendarIcon className="h-4 w-4 text-[#0D9488]" />
                <span>전체 EVENT 목록</span>
              </h3>
              {visibleEvents.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center border border-[#E2E5E9] text-[#64748B] text-xs">
                  등록된 EVENT가 없습니다.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {visibleEvents.map(ev => (
                    <div 
                      key={ev.id} 
                      onClick={() => setSelectedEventForDetail(ev)}
                      className="bg-white rounded-xl border border-[#E2E5E9] p-4 shadow-xs hover:border-teal-400 transition cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                            {ev.event_date} {ev.time_slot ? `(${ev.time_slot})` : ''}
                          </span>
                          
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={(e) => handleOpenEventEdit(ev, e)}
                              className="p-1 text-[#64748B] hover:text-[#0D9488] rounded hover:bg-slate-100"
                              title="EVENT 수정"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteEvent(ev.id, e)}
                              className="p-1 text-[#64748B] hover:text-[#DC2626] rounded hover:bg-slate-100"
                              title="EVENT 삭제"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <h4 className="text-xs font-bold text-[#1F2937] mb-2">{ev.title}</h4>

                        <div className="space-y-1 text-[11px] text-[#64748B] bg-slate-50 p-2.5 rounded-lg border border-[#E2E5E9]">
                          {ev.location && <div>장소: <strong className="text-[#1F2937]">{ev.location}</strong></div>}
                          {ev.description && <div className="truncate">내용: {ev.description}</div>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* 🔔 [스타일 공통] 커스텀 Alert 모달 */}
      {alertDialog.show && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white border border-[#E2E5E9] rounded-xl max-w-sm w-full p-5 shadow-xl relative text-[#1F2937]">
            <div className="flex items-center space-x-2 mb-2">
              {alertDialog.type === 'error' && <AlertCircle className="h-5 w-5 text-[#DC2626]" />}
              {alertDialog.type === 'success' && <CheckCircle2 className="h-5 w-5 text-[#0D9488]" />}
              {alertDialog.type === 'info' && <Bell className="h-5 w-5 text-[#243B5A]" />}
              <h3 className="text-xs font-bold text-[#1F2937]">{alertDialog.title}</h3>
            </div>
            <p className="text-xs text-[#64748B] my-3 leading-relaxed">{alertDialog.message}</p>
            <button
              onClick={() => setAlertDialog(prev => ({ ...prev, show: false }))}
              className="w-full py-2 bg-[#243B5A] hover:bg-[#1d3049] text-white font-semibold text-xs rounded-lg transition shadow-2xs"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* ❓ [스타일 공통] 커스텀 Confirm 모달 */}
      {confirmDialog.show && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white border border-[#E2E5E9] rounded-xl max-w-sm w-full p-5 shadow-xl relative text-[#1F2937]">
            <div className="flex items-center space-x-2 mb-2">
              <HelpCircle className="h-5 w-5 text-[#243B5A]" />
              <h3 className="text-xs font-bold text-[#1F2937]">{confirmDialog.title}</h3>
            </div>
            <p className="text-xs text-[#64748B] my-3 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setConfirmDialog(prev => ({ ...prev, show: false }))}
                className="px-3.5 py-1.5 bg-white border border-[#E2E5E9] hover:bg-slate-50 text-[#1F2937] rounded-lg text-xs font-medium transition"
              >
                취소
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(prev => ({ ...prev, show: false }));
                }}
                className="px-3.5 py-1.5 bg-[#DC2626] hover:bg-[#b91c1c] text-white rounded-lg text-xs font-semibold transition"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 접속자 교육 당일 배정 알림 팝업 모달 */}
      {showNoticeModal && assignedNoticeEdu && currentUser?.name && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E2E5E9] rounded-xl max-w-sm w-full p-5 shadow-xl relative text-[#1F2937]">
            <button 
              onClick={handleCloseNoticeModal} 
              className="absolute top-4 right-4 text-[#64748B] hover:text-[#1F2937]"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center space-x-1.5 text-[#2563EB] font-bold text-xs mb-2">
              <Bell className="h-4 w-4" />
              <span>교육 일정 안내</span>
            </div>

            <h3 className="text-xs font-bold text-[#1F2937] mb-1">
              <span className="text-[#243B5A]">{currentUser.name}</span>님, 교육 대상자로 지정되었습니다.
            </h3>

            <p className="text-[11px] text-[#64748B] mb-3">
              배정된 교육 일정을 확인해 주세요.
            </p>

            <div className="bg-slate-50 border border-[#E2E5E9] rounded-lg p-3 space-y-1.5 mb-4 text-xs">
              <div className="font-bold text-[#243B5A] mb-1">
                {assignedNoticeEdu.title}
              </div>
              <div className="flex items-center text-[#64748B] space-x-1.5">
                <Clock className="h-3 w-3 text-[#243B5A] shrink-0" />
                <span>일시: <strong className="text-[#1F2937]">{assignedNoticeEdu.edu_date} ({assignedNoticeEdu.time_slot})</strong></span>
              </div>
              <div className="flex items-center text-[#64748B] space-x-1.5">
                <MapPin className="h-3 w-3 text-[#243B5A] shrink-0" />
                <span>장소: <strong className="text-[#1F2937]">{assignedNoticeEdu.location}</strong></span>
              </div>
            </div>

            <button
              onClick={handleCloseNoticeModal}
              className="w-full py-2 bg-[#243B5A] hover:bg-[#1d3049] text-white font-semibold text-xs rounded-lg transition shadow-2xs"
            >
              확인했습니다
            </button>
          </div>
        </div>
      )}

      {/* 교육 등록 및 수정 모달 */}
      {showEduModal && isAdmin && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E2E5E9] rounded-xl max-w-md w-full p-5 shadow-xl relative text-[#1F2937]">
            <button onClick={() => setShowEduModal(false)} className="absolute top-4 right-4 text-[#64748B]"><X className="h-4 w-4" /></button>
            <h2 className="text-xs font-bold text-[#1F2937] mb-3">{editingEdu ? '교육 일정 수정' : '신규 교육 일정 등록'}</h2>
            
            <form onSubmit={handleSubmitEdu} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#64748B] mb-1">교육명</label>
                <input type="text" required value={eduTitle} onChange={e => setEduTitle(e.target.value)} className="w-full bg-slate-50 border border-[#E2E5E9] rounded-lg p-2 text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] focus:outline-hidden" placeholder="예: 상반기 정기 안전교육" />
              </div>

              <div>
                <label className="block font-semibold text-[#64748B] mb-1">교육 장소</label>
                <input type="text" required value={eduLocation} onChange={e => setEduLocation(e.target.value)} className="w-full bg-slate-50 border border-[#E2E5E9] rounded-lg p-2 text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] focus:outline-hidden" placeholder="예: 대회의실" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-[#64748B] mb-1">교육 일자</label>
                  <input type="date" required value={eduDate} onChange={e => setEduDate(e.target.value)} className="w-full bg-slate-50 border border-[#E2E5E9] rounded-lg p-2 text-xs text-[#1F2937]" />
                </div>
                <div>
                  <label className="block font-semibold text-[#64748B] mb-1">교육 시간대</label>
                  <input type="text" required value={eduTimeSlot} onChange={e => setEduTimeSlot(e.target.value)} className="w-full bg-slate-50 border border-[#E2E5E9] rounded-lg p-2 text-xs text-[#1F2937]" placeholder="10:00~12:00" />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#64748B] mb-1">교육 대상자 배정 (쉼표 구분 입력 가능)</label>
                <div className="flex gap-2 mb-1.5">
                  <input
                    type="text"
                    value={assignedWorkersInput}
                    onChange={e => setAssignedWorkersInput(e.target.value)}
                    className="flex-1 bg-slate-50 border border-[#E2E5E9] rounded-lg p-2 text-xs text-[#1F2937]"
                    placeholder="홍길동, 이순신"
                  />
                  <button
                    type="button"
                    onClick={handleAddWorkers}
                    className="bg-[#243B5A] hover:bg-[#1d3049] text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0"
                  >
                    추가
                  </button>
                </div>

                <div className="flex flex-wrap gap-1 p-2 bg-slate-50 border border-[#E2E5E9] rounded-lg min-h-[36px] max-h-24 overflow-y-auto">
                  {assignedWorkers.length === 0 ? (
                    <span className="text-[11px] text-[#64748B]">배정된 인원이 없습니다.</span>
                  ) : (
                    assignedWorkers.map((worker, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 bg-white text-[#243B5A] text-[11px] px-2 py-0.5 rounded border border-[#E2E5E9] font-medium">
                        {worker}
                        <button
                          type="button"
                          onClick={() => handleRemoveWorker(worker)}
                          className="hover:text-[#DC2626] rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#E2E5E9]">
                {editingEdu ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteEdu(editingEdu.id)}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium text-[#DC2626] bg-red-50 hover:bg-red-100 border border-red-200"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>삭제</span>
                  </button>
                ) : <div />}

                <div className="flex space-x-2">
                  <button type="button" onClick={() => setShowEduModal(false)} className="px-3 py-1.5 bg-white border border-[#E2E5E9] hover:bg-slate-50 rounded-lg text-xs text-[#1F2937]">취소</button>
                  <button type="submit" className="px-3 py-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white rounded-lg text-xs font-semibold">{editingEdu ? '수정 완료' : '등록하기'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EVENT 등록 및 수정 모달 */}
      {showEventModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E2E5E9] rounded-xl max-w-md w-full p-5 shadow-xl relative text-[#1F2937]">
            <button onClick={() => setShowEventModal(false)} className="absolute top-4 right-4 text-[#64748B]"><X className="h-4 w-4" /></button>
            <h2 className="text-xs font-bold text-[#1F2937] mb-3">{editingEvent ? 'EVENT 수정' : '신규 EVENT 등록'}</h2>
            
            <form onSubmit={handleSubmitEvent} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#64748B] mb-1">EVENT 제목</label>
                <input type="text" required value={eventTitle} onChange={e => setEventTitle(e.target.value)} className="w-full bg-slate-50 border border-[#E2E5E9] rounded-lg p-2 text-xs text-[#1F2937]" placeholder="예: 사내 워크숍" />
              </div>

              <div>
                <label className="block font-semibold text-[#64748B] mb-1">장소</label>
                <input type="text" value={eventLocation} onChange={e => setEventLocation(e.target.value)} className="w-full bg-slate-50 border border-[#E2E5E9] rounded-lg p-2 text-xs text-[#1F2937]" placeholder="예: 강당" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-[#64748B] mb-1">날짜</label>
                  <input type="date" required value={eventDate} onChange={e => setEventDate(e.target.value)} className="w-full bg-slate-50 border border-[#E2E5E9] rounded-lg p-2 text-xs text-[#1F2937]" />
                </div>
                <div>
                  <label className="block font-semibold text-[#64748B] mb-1">시간</label>
                  <input type="text" value={eventTimeSlot} onChange={e => setEventTimeSlot(e.target.value)} className="w-full bg-slate-50 border border-[#E2E5E9] rounded-lg p-2 text-xs text-[#1F2937]" placeholder="14:00~15:00" />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#64748B] mb-1">내용</label>
                <textarea rows={3} value={eventDescription} onChange={e => setEventDescription(e.target.value)} className="w-full bg-slate-50 border border-[#E2E5E9] rounded-lg p-2 text-xs text-[#1F2937]" placeholder="이벤트 상세 내용을 입력하세요." />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#E2E5E9]">
                {editingEvent ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteEvent(editingEvent.id)}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium text-[#DC2626] bg-red-50 hover:bg-red-100 border border-red-200"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>삭제</span>
                  </button>
                ) : <div />}

                <div className="flex space-x-2">
                  <button type="button" onClick={() => setShowEventModal(false)} className="px-3 py-1.5 bg-white border border-[#E2E5E9] hover:bg-slate-50 rounded-lg text-xs text-[#1F2937]">취소</button>
                  <button type="submit" className="px-3 py-1.5 bg-[#0D9488] hover:bg-[#0f766e] text-white rounded-lg text-xs font-semibold">{editingEvent ? '수정 완료' : '등록하기'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 교육 상세보기 팝업 모달 */}
      {selectedEduForDetail && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E2E5E9] rounded-xl max-w-md w-full p-5 shadow-xl relative text-[#1F2937]">
            <button onClick={() => setSelectedEduForDetail(null)} className="absolute top-4 right-4 text-[#64748B] hover:text-[#1F2937]"><X className="h-4 w-4" /></button>
            
            <div className="flex items-center space-x-1.5 text-xs font-bold text-[#243B5A] mb-1">
              <span>[교육] {selectedEduForDetail.edu_date} ({selectedEduForDetail.time_slot})</span>
            </div>

            <h2 className="text-xs font-bold text-[#1F2937] mb-3">{selectedEduForDetail.title}</h2>

            <div className="bg-slate-50 p-3 rounded-lg border border-[#E2E5E9] text-xs space-y-1.5 mb-3">
              <div className="flex items-center space-x-1.5 text-[#64748B]">
                <MapPin className="h-3.5 w-3.5 text-[#243B5A]" />
                <span>장소: <strong className="text-[#1F2937]">{selectedEduForDetail.location}</strong></span>
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-[11px] font-bold text-[#64748B] mb-1.5 flex items-center gap-1">
                <Users className="h-3 w-3 text-[#243B5A]" />
                <span>교육 대상자 목록</span>
              </h3>
              <div className="flex flex-wrap gap-1 p-2.5 bg-slate-50 rounded-lg border border-[#E2E5E9] min-h-[40px] max-h-32 overflow-y-auto">
                {selectedEduForDetail.assigned_workers && selectedEduForDetail.assigned_workers.length > 0 ? (
                  selectedEduForDetail.assigned_workers.map((worker, idx) => (
                    <span key={idx} className="bg-white text-[#243B5A] text-xs px-2 py-0.5 rounded border border-[#E2E5E9] font-medium">
                      {worker}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-[#64748B]">배정된 교육 대상자가 없습니다.</span>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-[#E2E5E9]">
              <div className="flex space-x-1.5">
                {isAdmin && (
                  <>
                    <button
                      onClick={() => {
                        const eduToEdit = selectedEduForDetail;
                        setSelectedEduForDetail(null);
                        handleOpenEduEdit(eduToEdit);
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#1F2937] rounded-lg text-xs font-semibold transition flex items-center space-x-1 border border-[#E2E5E9]"
                    >
                      <Pencil className="h-3 w-3" />
                      <span>수정</span>
                    </button>
                    <button
                      onClick={() => handleDeleteEdu(selectedEduForDetail.id)}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-[#DC2626] rounded-lg text-xs font-semibold transition flex items-center space-x-1 border border-red-200"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>삭제</span>
                    </button>
                  </>
                )}
              </div>

              <button
                onClick={() => setSelectedEduForDetail(null)}
                className="px-4 py-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white rounded-lg text-xs font-semibold transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EVENT 상세보기 팝업 모달 */}
      {selectedEventForDetail && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E2E5E9] rounded-xl max-w-md w-full p-5 shadow-xl relative text-[#1F2937]">
            <button onClick={() => setSelectedEventForDetail(null)} className="absolute top-4 right-4 text-[#64748B] hover:text-[#1F2937]"><X className="h-4 w-4" /></button>
            
            <div className="flex items-center space-x-1.5 text-xs font-bold text-teal-700 mb-1">
              <span>[EVENT] {selectedEventForDetail.event_date} {selectedEventForDetail.time_slot ? `(${selectedEventForDetail.time_slot})` : ''}</span>
            </div>

            <h2 className="text-xs font-bold text-[#1F2937] mb-3">{selectedEventForDetail.title}</h2>

            <div className="bg-slate-50 p-3 rounded-lg border border-[#E2E5E9] text-xs space-y-1.5 mb-3">
              {selectedEventForDetail.location && (
                <div className="flex items-center space-x-1.5 text-[#64748B]">
                  <MapPin className="h-3.5 w-3.5 text-teal-700" />
                  <span>장소: <strong className="text-[#1F2937]">{selectedEventForDetail.location}</strong></span>
                </div>
              )}
            </div>

            <div className="mb-4">
              <h3 className="text-[11px] font-bold text-[#64748B] mb-1.5">EVENT 내용</h3>
              <div className="p-3 bg-slate-50 rounded-lg border border-[#E2E5E9] text-xs text-[#1F2937] min-h-[60px] whitespace-pre-wrap">
                {selectedEventForDetail.description || '작성된 내용이 없습니다.'}
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-[#E2E5E9]">
              <div className="flex space-x-1.5">
                <button
                  onClick={() => {
                    const evToEdit = selectedEventForDetail;
                    setSelectedEventForDetail(null);
                    handleOpenEventEdit(evToEdit);
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#1F2937] rounded-lg text-xs font-semibold transition flex items-center space-x-1 border border-[#E2E5E9]"
                >
                  <Pencil className="h-3 w-3" />
                  <span>수정</span>
                </button>
                <button
                  onClick={() => handleDeleteEvent(selectedEventForDetail.id)}
                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-[#DC2626] rounded-lg text-xs font-semibold transition flex items-center space-x-1 border border-red-200"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>삭제</span>
                </button>
              </div>

              <button
                onClick={() => setSelectedEventForDetail(null)}
                className="px-4 py-1.5 bg-[#0D9488] hover:bg-[#0f766e] text-white rounded-lg text-xs font-semibold transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
