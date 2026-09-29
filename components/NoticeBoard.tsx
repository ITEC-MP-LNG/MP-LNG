'use client';

import { useEffect, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Bell,
  Pin,
  Calendar,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface NoticeBoardProps {
  isAdmin: boolean;
  currentUser?: { id?: string | number; name: string; email?: string };
}

interface NoticeItem {
  id: number | string;
  title: string;
  content: string;
  author_name: string;
  is_pinned: boolean | string;
  created_at: string;
  updated_at: string;
}

const formatDate = (dateString: string) => {
  if (!dateString) return '';

  const date = new Date(dateString);

  if (isNaN(date.getTime())) {
    return dateString;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export default function NoticeBoard({
  isAdmin,
  currentUser,
}: NoticeBoardProps) {
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedNotice, setSelectedNotice] =
    useState<NoticeItem | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingNotice, setEditingNotice] =
    useState<NoticeItem | null>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);

  // 중요 공지 팝업 알림 상태
  const [popupNotice, setPopupNotice] = useState<NoticeItem | null>(null);
  const [showPopupModal, setShowPopupModal] = useState(false);

  // 읽지 않은 신규 공지 존재 여부 (종 모양 버튼 색상 제어용)
  const [hasUnreadNotice, setHasUnreadNotice] = useState(false);

  const fetchNotices = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('notices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const fetchedNotices = (data || []).map((item) => ({
        ...item,
        is_pinned: item.is_pinned === true || item.is_pinned === 'true',
      })) as NoticeItem[];

      // 중요(상단 고정) 공지가 위로 오도록 정렬
      fetchedNotices.sort((a, b) => {
        if (a.is_pinned === b.is_pinned) {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return a.is_pinned ? -1 : 1;
      });

      setNotices(fetchedNotices);

      // 사용자 고유 식별자 (없을 경우 기본값 적용)
      const userKey = currentUser?.id || currentUser?.email || currentUser?.name || 'guest';

      // 3, 4, 5번: 모든 공지 중 하나라도 읽지 않은 것이 있는지 체크
      const unreadExists = fetchedNotices.some((notice) => {
        const isRead = localStorage.getItem(`notice_read_${userKey}_${notice.id}`);
        return !isRead;
      });
      setHasUnreadNotice(unreadExists);

      // 1번: 중요 공지(상단 고정) 팝업 처리 (오늘 하루 보지 않기 체크 확인)
      const pinnedNotices = fetchedNotices.filter((n) => n.is_pinned);
      if (pinnedNotices.length > 0) {
        const targetNotice = pinnedNotices[0];
        const hideUntil = localStorage.getItem(`notice_hide_until_${userKey}_${targetNotice.id}`);
        const todayStr = new Date().toDateString();

        if (hideUntil !== todayStr) {
          setPopupNotice(targetNotice);
          setShowPopupModal(true);
        }
      }
    } catch (err: any) {
      console.error('공지사항 불러오기 실패:', err);
      alert(
        '공지사항을 불러오지 못했습니다.\n' +
          (err?.message || '오류가 발생했습니다.')
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const handleClosePopup = () => {
    if (popupNotice) {
      const userKey = currentUser?.id || currentUser?.email || currentUser?.name || 'guest';
      localStorage.setItem(`notice_read_${userKey}_${popupNotice.id}`, 'true');
      
      // 읽음 처리 후 안 읽은 공지 여부 재확인
      const unreadExists = notices.some((notice) => {
        const isRead = localStorage.getItem(`notice_read_${userKey}_${notice.id}`);
        return !isRead;
      });
      setHasUnreadNotice(unreadExists);
    }
    setShowPopupModal(false);
  };

  const handleHideToday = () => {
    if (popupNotice) {
      const userKey = currentUser?.id || currentUser?.email || currentUser?.name || 'guest';
      const todayStr = new Date().toDateString();
      localStorage.setItem(`notice_hide_until_${userKey}_${popupNotice.id}`, todayStr);
      localStorage.setItem(`notice_read_${userKey}_${popupNotice.id}`, 'true');

      const unreadExists = notices.some((notice) => {
        const isRead = localStorage.getItem(`notice_read_${userKey}_${notice.id}`);
        return !isRead;
      });
      setHasUnreadNotice(unreadExists);
    }
    setShowPopupModal(false);
  };

  const handleSelectNotice = (notice: NoticeItem) => {
    const userKey = currentUser?.id || currentUser?.email || currentUser?.name || 'guest';
    localStorage.setItem(`notice_read_${userKey}_${notice.id}`, 'true');

    // 읽음 처리 후 종 모양 버튼 색상 업데이트
    const unreadExists = notices.some((n) => {
      if (n.id === notice.id) return false;
      const isRead = localStorage.getItem(`notice_read_${userKey}_${n.id}`);
      return !isRead;
    });
    setHasUnreadNotice(unreadExists);

    setSelectedNotice(notice);
  };

  const handleOpenCreate = () => {
    if (!isAdmin) {
      alert('관리자만 공지를 등록할 수 있습니다.');
      return;
    }

    setEditingNotice(null);
    setTitle('');
    setContent('');
    setIsPinned(false);
    setShowModal(true);
  };

  const handleOpenEdit = (
    notice: NoticeItem,
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();

    if (!isAdmin) {
      alert('관리자만 공지를 수정할 수 있습니다.');
      return;
    }

    setEditingNotice(notice);
    setTitle(notice.title);
    setContent(notice.content);
    setIsPinned(notice.is_pinned === true);
    setShowModal(true);
  };

  const handleDelete = async (
    id: number | string,
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();

    if (!isAdmin) {
      alert('삭제 권한이 없습니다.');
      return;
    }

    if (!window.confirm('정말 이 공지를 삭제하시겠습니까?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('notices')
        .delete()
        .eq('id', id);

      if (error) throw error;

      if (selectedNotice?.id === id) {
        setSelectedNotice(null);
      }

      setShowModal(false);

      alert('공지사항이 삭제되었습니다.');

      await fetchNotices();
    } catch (err: any) {
      alert(
        '공지사항 삭제 실패: ' +
          (err?.message || '오류가 발생했습니다.')
      );
    }
  };

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!isAdmin) {
      alert('등록/수정 권한이 없습니다.');
      return;
    }

    if (!title.trim()) {
      alert('공지 제목을 입력해주세요.');
      return;
    }

    if (!content.trim()) {
      alert('공지 내용을 입력해주세요.');
      return;
    }

    try {
      const payload = {
        title: title.trim(),
        content: content.trim(),
        author_name:
          currentUser?.name || '관리자',
        is_pinned: isPinned,
        updated_at: new Date().toISOString(),
      };

      if (editingNotice) {
        const { error } = await supabase
          .from('notices')
          .update(payload)
          .eq('id', editingNotice.id);

        if (error) throw error;

        alert('공지사항이 수정되었습니다.');
      } else {
        const { error } = await supabase
          .from('notices')
          .insert([
            {
              ...payload,
              created_at:
                new Date().toISOString(),
            },
          ]);

        if (error) throw error;

        alert('공지사항이 등록되었습니다.');
      }

      setShowModal(false);
      setEditingNotice(null);

      await fetchNotices();
    } catch (err: any) {
      alert(
        '공지사항 저장 실패: ' +
          (err?.message || '오류가 발생했습니다.')
      );
    }
  };

  return (
    <div className="w-full text-[#1F2937] p-4 sm:p-6 space-y-4 font-sans border-box">

      {/* 상단 제목 영역 및 2~5번 모바일 종 모양 버튼 추가 */}

      <div className="bg-white p-4 rounded-xl border border-[#E2E5E9] shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">

        <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-start">

          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-xl text-[#243B5A]">
              <Bell className="h-6 w-6" />
            </div>

            <div>
              <h1 className="text-base font-bold text-[#1F2937]">
                공지사항
              </h1>

              <p className="text-xs text-[#64748B]">
                사내 주요 공지 및 안내사항을 확인할 수 있습니다.
              </p>
            </div>
          </div>

          {/* 2, 3, 4, 5번: 모바일 기기 접속 시 로그인 계정 옆에 표시되는 종 모양 버튼 (신규글 여부에 따라 색상 변경) */}
          <div className="sm:hidden flex items-center">
            <button
              onClick={() => {
                if (notices.length > 0) {
                  handleSelectNotice(notices[0]);
                }
              }}
              className={`p-2 rounded-full border transition ${
                hasUnreadNotice
                  ? 'bg-red-50 text-red-600 border-red-200'
                  : 'bg-blue-50 text-blue-400 border-blue-200'
              }`}
              title={hasUnreadNotice ? '읽지 않은 새 공지가 있습니다.' : '모든 공지를 확인했습니다.'}
            >
              <Bell className="h-5 w-5" />
            </button>
          </div>

        </div>

        {isAdmin && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center justify-center space-x-1.5 bg-[#243B5A] text-white px-4 py-2 rounded-lg hover:bg-[#1d3049] transition shadow-xs font-medium text-xs"
          >
            <Plus className="h-4 w-4" />
            <span>공지 등록</span>
          </button>
        )}

      </div>

      {/* 중요 공지 팝업 알림 모달 */}
      {showPopupModal && popupNotice && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E2E5E9] rounded-xl max-w-lg w-full shadow-xl relative text-[#1F2937] overflow-hidden">
            <div className="p-5">
              <button
                onClick={handleClosePopup}
                className="absolute top-4 right-4 text-[#64748B] hover:text-[#1F2937]"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-[#243B5A] text-white font-bold">
                  <Pin className="h-3 w-3" />
                  중요 공지 알림
                </span>
              </div>

              <h2 className="text-sm sm:text-base font-bold text-[#1F2937] pr-6 mb-2">
                {popupNotice.title}
              </h2>

              <div className="flex items-center gap-3 text-[10px] text-[#64748B] pb-3 border-b border-[#E2E5E9]">
                <span>작성자: {popupNotice.author_name}</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(popupNotice.created_at)}
                </span>
              </div>

              <div className="py-5 text-xs sm:text-sm text-[#1F2937] whitespace-pre-wrap leading-6 min-h-[120px]">
                {popupNotice.content}
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-[#E2E5E9]">
                <button
                  onClick={handleHideToday}
                  className="text-xs text-[#64748B] hover:text-[#1F2937] font-medium underline"
                >
                  오늘 하루 보지 않기
                </button>

                <button
                  onClick={handleClosePopup}
                  className="px-4 py-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white rounded-lg text-xs font-semibold"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 공지 목록 */}

      <div className="bg-white rounded-xl border border-[#E2E5E9] shadow-xs overflow-hidden">

        <div className="px-4 py-3 border-b border-[#E2E5E9] bg-[#F5F6F8]">

          <div className="flex items-center gap-2">

            <Bell className="h-4 w-4 text-[#243B5A]" />

            <span className="text-xs font-bold text-[#1F2937]">
              전체 공지사항
            </span>

            <span className="text-[10px] text-[#64748B]">
              총 {notices.length}건
            </span>

          </div>

        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-[#64748B]">
            공지사항을 불러오는 중...
          </div>
        ) : notices.length === 0 ? (
          <div className="py-14 text-center">

            <Bell className="h-8 w-8 mx-auto mb-2 text-[#CBD5E1]" />

            <p className="text-xs text-[#64748B]">
              등록된 공지사항이 없습니다.
            </p>

          </div>
        ) : (
          <div className="divide-y divide-[#E2E5E9]">

            {notices.map((notice) => (
              <div
                key={notice.id}
                onClick={() =>
                  handleSelectNotice(notice)
                }
                className="px-4 py-3.5 hover:bg-[#F8FAFC] cursor-pointer transition"
              >

                <div className="flex items-start gap-3">

                  <div
                    className={`mt-0.5 shrink-0 p-2 rounded-lg ${
                      notice.is_pinned
                        ? 'bg-[#243B5A] text-white'
                        : 'bg-[#F5F6F8] text-[#64748B]'
                    }`}
                  >
                    {notice.is_pinned ? (
                      <Pin className="h-3.5 w-3.5" />
                    ) : (
                      <Bell className="h-3.5 w-3.5" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">

                    <div className="flex items-center gap-2 mb-1">

                      {notice.is_pinned && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#243B5A] text-white font-bold shrink-0">
                          중요
                        </span>
                      )}

                      <h3 className="text-xs sm:text-sm font-bold text-[#1F2937] truncate">
                        {notice.title}
                      </h3>

                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-[#64748B]">

                      <span>
                        작성자: {notice.author_name}
                      </span>

                      <span>
                        {formatDate(
                          notice.created_at
                        )}
                      </span>

                    </div>

                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0">

                      <button
                        onClick={(e) =>
                          handleOpenEdit(
                            notice,
                            e
                          )
                        }
                        className="p-1.5 text-[#64748B] hover:text-[#243B5A] hover:bg-[#F5F6F8] rounded-lg"
                        title="공지 수정"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>

                      <button
                        onClick={(e) =>
                          handleDelete(
                            notice.id,
                            e
                          )
                        }
                        className="p-1.5 text-[#64748B] hover:text-[#DC2626] hover:bg-red-50 rounded-lg"
                        title="공지 삭제"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>

                    </div>
                  )}

                </div>

              </div>
            ))}

          </div>
        )}

      </div>

      {/* 공지 상세보기 */}

      {selectedNotice && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">

          <div className="bg-white border border-[#E2E5E9] rounded-xl max-w-lg w-full shadow-xl relative text-[#1F2937] overflow-hidden">

            <div className="p-5">

              <button
                onClick={() =>
                  setSelectedNotice(null)
                }
                className="absolute top-4 right-4 text-[#64748B] hover:text-[#1F2937]"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-2 mb-3">

                {selectedNotice.is_pinned && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-[#243B5A] text-white font-bold">
                    <Pin className="h-3 w-3" />
                    중요 공지
                  </span>
                )}

              </div>

              <h2 className="text-sm sm:text-base font-bold text-[#1F2937] pr-6 mb-2">
                {selectedNotice.title}
              </h2>

              <div className="flex items-center gap-3 text-[10px] text-[#64748B] pb-3 border-b border-[#E2E5E9]">

                <span>
                  작성자: {selectedNotice.author_name}
                </span>

                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(
                    selectedNotice.created_at
                  )}
                </span>

              </div>

              <div className="py-5 text-xs sm:text-sm text-[#1F2937] whitespace-pre-wrap leading-6 min-h-[120px]">
                {selectedNotice.content}
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-[#E2E5E9]">

                <div>

                  {isAdmin && (
                    <button
                      onClick={() => {
                        const notice =
                          selectedNotice;

                        setSelectedNotice(
                          null
                        );

                        handleOpenEdit(
                          notice
                        );
                      }}
                      className="px-3 py-1.5 bg-[#F5F6F8] hover:bg-[#E2E5E9] text-[#1F2937] rounded-lg text-xs font-semibold flex items-center gap-1 border border-[#E2E5E9]"
                    >
                      <Pencil className="h-3 w-3" />
                      수정
                    </button>
                  )}

                </div>

                <button
                  onClick={() =>
                    setSelectedNotice(null)
                  }
                  className="px-4 py-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white rounded-lg text-xs font-semibold"
                >
                  닫기
                </button>

              </div>

            </div>

          </div>

        </div>
      )}

      {/* 공지 등록 / 수정 */}

      {showModal && isAdmin && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">

          <div className="bg-white border border-[#E2E5E9] rounded-xl max-w-lg w-full p-5 shadow-xl relative text-[#1F2937]">

            <button
              onClick={() =>
                setShowModal(false)
              }
              className="absolute top-4 right-4 text-[#64748B] hover:text-[#1F2937]"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 mb-4">

              <div className="p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-[#243B5A]">
                <Bell className="h-4 w-4" />
              </div>

              <h2 className="text-sm font-bold">
                {editingNotice
                  ? '공지사항 수정'
                  : '공지사항 등록'}
              </h2>

            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-3"
            >

              <div>

                <label className="block font-semibold text-[#64748B] mb-1 text-xs">
                  제목
                </label>

                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) =>
                    setTitle(e.target.value)
                  }
                  className="w-full bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg p-2.5 text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] focus:outline-hidden"
                  placeholder="공지 제목을 입력해주세요."
                />

              </div>

              <div>

                <label className="block font-semibold text-[#64748B] mb-1 text-xs">
                  내용
                </label>

                <textarea
                  required
                  value={content}
                  onChange={(e) =>
                    setContent(e.target.value)
                  }
                  rows={10}
                  className="w-full bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg p-2.5 text-xs text-[#1F2937] resize-none focus:bg-white focus:border-[#243B5A] focus:outline-hidden"
                  placeholder="공지 내용을 입력해주세요."
                />

              </div>

              <label className="flex items-center gap-2 p-2.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg cursor-pointer">

                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) =>
                    setIsPinned(
                      e.target.checked
                    )
                  }
                  className="h-4 w-4"
                />

                <div>

                  <div className="text-xs font-semibold text-[#1F2937]">
                    중요 공지로 상단 고정
                  </div>

                  <div className="text-[10px] text-[#64748B]">
                    중요 공지는 일반 공지보다 위에 표시됩니다.
                  </div>

                </div>

              </label>

              <div className="flex items-center justify-between pt-3 border-t border-[#E2E5E9]">

                {editingNotice ? (
                  <button
                    type="button"
                    onClick={() =>
                      handleDelete(
                        editingNotice.id
                      )
                    }
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-[#DC2626] bg-red-50 hover:bg-red-100 border border-red-200"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    삭제
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex gap-2">

                  <button
                    type="button"
                    onClick={() =>
                      setShowModal(false)
                    }
                    className="px-3 py-1.5 bg-white border border-[#E2E5E9] hover:bg-[#F5F6F8] rounded-lg text-xs"
                  >
                    취소
                  </button>

                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white rounded-lg text-xs font-semibold"
                  >
                    {editingNotice
                      ? '수정 완료'
                      : '등록하기'}
                  </button>

                </div>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}
