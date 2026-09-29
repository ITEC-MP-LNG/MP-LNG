'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  X, 
  GraduationCap, 
  ChevronLeft, 
  ChevronRight, 
  MapPin, 
  Users,
  Clock,
  Bell
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Education, EducationRecord } from '@/lib/types';

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

  const handleOpenEduCreate = (dateStr?: string) => {
    if (!isAdmin) return alert('관리자만 교육을 등록할 수 있습니다.');
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
    if (!isAdmin) return alert('관리자만 교육을 수정할 수 있습니다.');
    setEditingEdu(edu);
    setEduTitle(edu.title);
    setEduDate(edu.edu_date);
    setEduTimeSlot(edu.time_slot);
    setEduLocation(edu.location);
    setAssignedWorkersInput('');
    setAssignedWorkers(edu.assigned_workers || []);
    setShowEduModal(true);
  };

  const handleDeleteEdu = async (id: number | string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return alert('삭제 권한이 없습니다.');
    if (!window.confirm('정말 이 교육 항목을 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase.from('educations').delete().eq('id', id);
      if (error) throw error;

      alert('성공적으로 삭제되었습니다.');
      setShowEduModal(false);
      setSelectedEduForDetail(null);
      fetchEducations();
    } catch (err: any) {
      alert(`삭제 실패: ${err?.message || '오류가 발생했습니다.'}`);
    }
  };

  const handleSubmitEdu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return alert('등록/수정 권한이 없습니다.');
    if (!eduTitle.trim()) return alert('교육명을 입력해주세요.');

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
        alert('교육 일정이 수정되었습니다.');
      } else {
        let { error } = await supabase.from('educations').insert([{ ...basePayload, edu_date: eduDate }]);
        if (error) {
          const { error: retryError } = await supabase.from('educations').insert([basePayload]);
          if (retryError) throw retryError;
        }
        alert('신규 교육 일정이 등록되었습니다.');
      }

      setShowEduModal(false);
      fetchEducations();
    } catch (err: any) {
      alert('교육 저장 실패: ' + (err?.message || '오류가 발생했습니다.'));
    }
  };

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
      
      {/* 🚀 상단 타이틀 영역 */}
      <div className="bg-white p-4 rounded-xl border border-[#E2E5E9] shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-xl text-[#243B5A]">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#1F2937]">교육 일정 관리 시스템</h1>
            <p className="text-xs text-[#64748B]">사내 정기 교육 및 교육 대상자 통합 관리</p>
          </div>
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

        {isAdmin && (
          <button
            onClick={() => handleOpenEduCreate()}
            className="flex items-center justify-center space-x-1.5 bg-[#243B5A] text-white px-4 py-2 rounded-lg hover:bg-[#1d3049] transition shadow-xs font-medium text-xs"
          >
            <Plus className="h-4 w-4" />
            <span>신규 교육 일정 등록</span>
          </button>
        )}
      </div>

      {loadingEdu ? (
        <div className="bg-white rounded-xl border border-[#E2E5E9] text-center py-12 text-xs text-[#64748B]">교육 일정을 불러오는 중...</div>
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
                  return <div key={idx} className="bg-[#F5F6F8]/50 min-h-[100px]" />;
                }

                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayEdus = educations.filter(e => e.edu_date === dateStr);
                const isToday = todayStr === dateStr;

                return (
                  <div
                    key={idx}
                    className={`bg-white p-1.5 min-h-[100px] flex flex-col justify-between hover:bg-[#F5F6F8]/50 transition relative ${
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
                        {isAdmin && (
                          <button
                            onClick={() => handleOpenEduCreate(dateStr)}
                            className="text-[#64748B] hover:text-[#243B5A] p-0.5 rounded"
                            title="이 날짜에 교육 추가"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        )}
                      </div>

                      <div className="space-y-1 max-h-[75px] overflow-y-auto">
                        {dayEdus.map(edu => (
                          <div
                            key={edu.id}
                            onClick={() => setSelectedEduForDetail(edu)}
                            className="p-1 rounded text-[10px] bg-[#F5F6F8] border border-[#E2E5E9] text-[#243B5A] cursor-pointer hover:bg-slate-100 transition truncate font-medium"
                          >
                            <span className="font-bold">[{edu.time_slot}]</span> {edu.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 전체 교육 목록 카드 */}
          <div className="mt-6 space-y-3">
            <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
              <GraduationCap className="h-4 w-4 text-[#243B5A]" />
              <span>전체 교육 목록</span>
            </h3>
            {educations.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center border border-[#E2E5E9] text-[#64748B] text-xs">
                등록된 교육 일정이 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {educations.map(edu => (
                  <div 
                    key={edu.id} 
                    onClick={() => setSelectedEduForDetail(edu)}
                    className="bg-white rounded-xl border border-[#E2E5E9] p-4 shadow-xs hover:border-slate-400 transition cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#F5F6F8] text-[#243B5A] border border-[#E2E5E9]">
                          {edu.edu_date} ({edu.time_slot})
                        </span>
                        
                        {isAdmin && (
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={(e) => handleOpenEduEdit(edu, e)}
                              className="p-1 text-[#64748B] hover:text-[#243B5A] rounded hover:bg-[#F5F6F8]"
                              title="교육 수정"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteEdu(edu.id, e)}
                              className="p-1 text-[#64748B] hover:text-[#DC2626] rounded hover:bg-[#F5F6F8]"
                              title="교육 삭제"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <h4 className="text-xs font-bold text-[#1F2937] mb-2">{edu.title}</h4>

                      <div className="space-y-1 text-[11px] text-[#64748B] bg-[#F5F6F8] p-2.5 rounded-lg border border-[#E2E5E9]">
                        <div className="flex items-center justify-between">
                          <span>장소: <strong className="text-[#1F2937]">{edu.location}</strong></span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* 접속자 배정 알림 팝업 모달 */}
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

            <div className="bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg p-3 space-y-1.5 mb-4 text-xs">
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
                <input type="text" required value={eduTitle} onChange={e => setEduTitle(e.target.value)} className="w-full bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg p-2 text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] focus:outline-hidden" placeholder="예: 상반기 정기 안전교육" />
              </div>

              <div>
                <label className="block font-semibold text-[#64748B] mb-1">교육 장소</label>
                <input type="text" required value={eduLocation} onChange={e => setEduLocation(e.target.value)} className="w-full bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg p-2 text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] focus:outline-hidden" placeholder="예: 대회의실" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-[#64748B] mb-1">교육 일자</label>
                  <input type="date" required value={eduDate} onChange={e => setEduDate(e.target.value)} className="w-full bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg p-2 text-xs text-[#1F2937]" />
                </div>
                <div>
                  <label className="block font-semibold text-[#64748B] mb-1">교육 시간대</label>
                  <input type="text" required value={eduTimeSlot} onChange={e => setEduTimeSlot(e.target.value)} className="w-full bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg p-2 text-xs text-[#1F2937]" placeholder="10:00~12:00" />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#64748B] mb-1">교육 대상자 배정 (쉼표 구분 입력 가능)</label>
                <div className="flex gap-2 mb-1.5">
                  <input
                    type="text"
                    value={assignedWorkersInput}
                    onChange={e => setAssignedWorkersInput(e.target.value)}
                    className="flex-1 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg p-2 text-xs text-[#1F2937]"
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

                <div className="flex flex-wrap gap-1 p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg min-h-[36px] max-h-24 overflow-y-auto">
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
                  <button type="button" onClick={() => setShowEduModal(false)} className="px-3 py-1.5 bg-white border border-[#E2E5E9] hover:bg-[#F5F6F8] rounded-lg text-xs text-[#1F2937]">취소</button>
                  <button type="submit" className="px-3 py-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white rounded-lg text-xs font-semibold">{editingEdu ? '수정 완료' : '등록하기'}</button>
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
              <span>{selectedEduForDetail.edu_date} ({selectedEduForDetail.time_slot})</span>
            </div>

            <h2 className="text-xs font-bold text-[#1F2937] mb-3">{selectedEduForDetail.title}</h2>

            <div className="bg-[#F5F6F8] p-3 rounded-lg border border-[#E2E5E9] text-xs space-y-1.5 mb-3">
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
              <div className="flex flex-wrap gap-1 p-2.5 bg-[#F5F6F8] rounded-lg border border-[#E2E5E9] min-h-[40px] max-h-32 overflow-y-auto">
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
                      className="px-3 py-1.5 bg-[#F5F6F8] hover:bg-[#E2E5E9] text-[#1F2937] rounded-lg text-xs font-semibold transition flex items-center space-x-1 border border-[#E2E5E9]"
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
    </div>
  );
}
