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
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  MessageSquare,
  EyeOff,
  Send,
  User,
  ShieldAlert,
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

interface SuggestionItem {
  id: string;
  title: string;
  content: string;
  author_id: string;
  author_name: string;
  created_at: string;
  updated_at: string;
  has_comment?: boolean;
}

interface SuggestionComment {
  id: string;
  suggestion_id: string;
  author_id: string;
  author_name: string;
  content: string;
  created_at: string;
}

interface AnonymousPostItem {
  id: string;
  title: string;
  content: string;
  author_id: string;
  created_at: string;
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
  // 공지사항 관련 상태
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotice, setSelectedNotice] = useState<NoticeItem | null>(null);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [editingNotice, setEditingNotice] = useState<NoticeItem | null>(null);

  // 개선/건의사항 관련 상태
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<SuggestionItem | null>(null);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [editingSuggestion, setEditingSuggestion] = useState<SuggestionItem | null>(null);
  const [comments, setComments] = useState<SuggestionComment[]>([]);
  const [newComment, setNewComment] = useState('');

  // 익명게시판 관련 상태
  const [anonymousPosts, setAnonymousPosts] = useState<AnonymousPostItem[]>([]);
  const [selectedAnonymousPost, setSelectedAnonymousPost] = useState<AnonymousPostItem | null>(null);
  const [showAnonymousModal, setShowAnonymousModal] = useState(false);

  // 공통 폼 상태
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);

  // 삭제 모달 상태
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string | number;
    type: 'notice' | 'suggestion' | 'anonymous' | 'comment';
  } | null>(null);

  // 알림 모달 상태
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'success',
  });

  const showAlert = (
    title: string,
    message: string,
    type: 'success' | 'error' | 'info' = 'success',
    onConfirm?: () => void
  ) => {
    setAlertModal({
      isOpen: true,
      title,
      message,
      type,
      onConfirm,
    });
  };

  // 중요 공지 팝업 알림 상태
  const [popupNotice, setPopupNotice] = useState<NoticeItem | null>(null);
  const [showPopupModal, setShowPopupModal] = useState(false);
  const [hasUnreadNotice, setHasUnreadNotice] = useState(false);

  const getCurrentUserId = () => {
    return String(currentUser?.id || currentUser?.email || currentUser?.name || 'guest');
  };

  // --- 데이터 불러오기 ---
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

      fetchedNotices.sort((a, b) => {
        if (a.is_pinned === b.is_pinned) {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return a.is_pinned ? -1 : 1;
      });

      setNotices(fetchedNotices);

      const userKey = getCurrentUserId();
      const unreadExists = fetchedNotices.some((notice) => {
        const isRead = localStorage.getItem(`notice_read_${userKey}_${notice.id}`);
        return !isRead;
      });
      setHasUnreadNotice(unreadExists);

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
      showAlert(
        '불러오기 실패',
        '공지사항을 불러오지 못했습니다.\n' + (err?.message || '오류가 발생했습니다.'),
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestions = async () => {
    try {
      const { data: sugData, error: sugError } = await supabase
        .from('suggestions')
        .select('*')
        .order('created_at', { ascending: false });

      if (sugError) throw sugError;

      const { data: commData } = await supabase
        .from('suggestion_comments')
        .select('suggestion_id');

      const commentedSet = new Set((commData || []).map((c) => c.suggestion_id));

      const formattedSuggestions = (sugData || []).map((item) => ({
        ...item,
        has_comment: commentedSet.has(item.id),
      }));

      setSuggestions(formattedSuggestions);
    } catch (err: any) {
      console.error('개선/건의사항 불러오기 실패:', err);
      showAlert('불러오기 실패', '개선/건의사항을 불러오지 못했습니다.', 'error');
    }
  };

  const fetchComments = async (suggestionId: string) => {
    try {
      const { data, error } = await supabase
        .from('suggestion_comments')
        .select('*')
        .eq('suggestion_id', suggestionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (err: any) {
      console.error('댓글 불러오기 실패:', err);
    }
  };

  const fetchAnonymousPosts = async () => {
    if (!isAdmin) return;
    try {
      const { data, error } = await supabase
        .from('anonymous_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnonymousPosts(data || []);
    } catch (err: any) {
      console.error('익명게시판 불러오기 실패:', err);
      showAlert('불러오기 실패', '익명 게시글을 불러오지 못했습니다.', 'error');
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchNotices(),
      fetchSuggestions(),
      isAdmin ? fetchAnonymousPosts() : Promise.resolve(),
    ]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAllData();
  }, [isAdmin]);

  // --- 공지사항 팝업 처리 ---
  const handleClosePopup = () => {
    if (popupNotice) {
      const userKey = getCurrentUserId();
      localStorage.setItem(`notice_read_${userKey}_${popupNotice.id}`, 'true');

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
      const userKey = getCurrentUserId();
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
    const userKey = getCurrentUserId();
    localStorage.setItem(`notice_read_${userKey}_${notice.id}`, 'true');

    const unreadExists = notices.some((n) => {
      if (n.id === notice.id) return false;
      const isRead = localStorage.getItem(`notice_read_${userKey}_${n.id}`);
      return !isRead;
    });
    setHasUnreadNotice(unreadExists);

    setSelectedNotice(notice);
  };

  // --- 작성 / 수정 모달 핸들러 ---
  const handleOpenNoticeCreate = () => {
    if (!isAdmin) {
      showAlert('권한 없음', '관리자만 공지를 등록할 수 있습니다.', 'error');
      return;
    }
    setEditingNotice(null);
    setTitle('');
    setContent('');
    setIsPinned(false);
    setShowNoticeModal(true);
  };

  const handleOpenNoticeEdit = (notice: NoticeItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isAdmin) {
      showAlert('권한 없음', '관리자만 공지를 수정할 수 있습니다.', 'error');
      return;
    }
    setEditingNotice(notice);
    setTitle(notice.title);
    setContent(notice.content);
    setIsPinned(notice.is_pinned === true);
    setShowNoticeModal(true);
  };

  const handleOpenSuggestionCreate = () => {
    setEditingSuggestion(null);
    setTitle('');
    setContent('');
    setShowSuggestionModal(true);
  };

  const handleOpenSuggestionEdit = (item: SuggestionItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const userId = getCurrentUserId();
    if (!isAdmin && item.author_id !== userId) {
      showAlert('권한 없음', '작성자와 관리자만 수정할 수 있습니다.', 'error');
      return;
    }
    setEditingSuggestion(item);
    setTitle(item.title);
    setContent(item.content);
    setShowSuggestionModal(true);
  };

  const handleOpenAnonymousCreate = () => {
    setTitle('');
    setContent('');
    setShowAnonymousModal(true);
  };

  // --- 삭제 모달 핸들러 ---
  const handleDeleteClick = (
    id: string | number,
    type: 'notice' | 'suggestion' | 'anonymous' | 'comment',
    e?: React.MouseEvent,
    itemAuthorId?: string
  ) => {
    if (e) e.stopPropagation();
    const userId = getCurrentUserId();

    if (type === 'notice' && !isAdmin) {
      showAlert('권한 없음', '삭제 권한이 없습니다.', 'error');
      return;
    }
    if (type === 'suggestion' && !isAdmin && itemAuthorId !== userId) {
      showAlert('권한 없음', '작성자와 관리자만 삭제할 수 있습니다.', 'error');
      return;
    }
    if (type === 'anonymous' && !isAdmin) {
      showAlert('권한 없음', '관리자 계정만 삭제할 수 있습니다.', 'error');
      return;
    }
    if (type === 'comment' && !isAdmin && itemAuthorId !== userId) {
      showAlert('권한 없음', '삭제 권한이 없습니다.', 'error');
      return;
    }

    setDeleteTarget({ id, type });
    setShowDeleteConfirmModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      const { id, type } = deleteTarget;

      if (type === 'notice') {
        const { error } = await supabase.from('notices').delete().eq('id', id);
        if (error) throw error;
        if (selectedNotice?.id === id) setSelectedNotice(null);
        showAlert('삭제 완료', '공지사항이 삭제되었습니다.', 'success', fetchNotices);
      } else if (type === 'suggestion') {
        const { error } = await supabase.from('suggestions').delete().eq('id', id);
        if (error) throw error;
        if (selectedSuggestion?.id === id) setSelectedSuggestion(null);
        showAlert('삭제 완료', '개선/건의사항이 삭제되었습니다.', 'success', fetchSuggestions);
      } else if (type === 'anonymous') {
        const { error } = await supabase.from('anonymous_posts').delete().eq('id', id);
        if (error) throw error;
        if (selectedAnonymousPost?.id === id) setSelectedAnonymousPost(null);
        showAlert('삭제 완료', '익명 게시글이 삭제되었습니다.', 'success', fetchAnonymousPosts);
      } else if (type === 'comment') {
        const { error } = await supabase.from('suggestion_comments').delete().eq('id', id);
        if (error) throw error;
        if (selectedSuggestion) {
          await fetchComments(selectedSuggestion.id);
          await fetchSuggestions();
        }
        showAlert('삭제 완료', '댓글이 삭제되었습니다.', 'success');
      }

      setShowNoticeModal(false);
      setShowSuggestionModal(false);
      setShowDeleteConfirmModal(false);
      setDeleteTarget(null);
    } catch (err: any) {
      showAlert('삭제 실패', '삭제 중 오류가 발생했습니다: ' + (err?.message || ''), 'error');
    }
  };

  // --- Submit 핸들러 ---
  const handleNoticeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!title.trim() || !content.trim()) {
      showAlert('입력 확인', '제목과 내용을 모두 입력해주세요.', 'info');
      return;
    }

    try {
      const payload = {
        title: title.trim(),
        content: content.trim(),
        author_name: currentUser?.name || '관리자',
        is_pinned: isPinned,
        updated_at: new Date().toISOString(),
      };

      if (editingNotice) {
        const { error } = await supabase.from('notices').update(payload).eq('id', editingNotice.id);
        if (error) throw error;
        showAlert('수정 완료', '공지사항이 수정되었습니다.', 'success', fetchNotices);
      } else {
        const { error } = await supabase
          .from('notices')
          .insert([{ ...payload, created_at: new Date().toISOString() }]);
        if (error) throw error;
        showAlert('등록 완료', '공지사항이 등록되었습니다.', 'success', fetchNotices);
      }
      setShowNoticeModal(false);
    } catch (err: any) {
      showAlert('저장 실패', '공지사항 저장 실패: ' + (err?.message || ''), 'error');
    }
  };

  const handleSuggestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      showAlert('입력 확인', '제목과 내용을 모두 입력해주세요.', 'info');
      return;
    }

    try {
      const userId = getCurrentUserId();
      const payload = {
        title: title.trim(),
        content: content.trim(),
        author_id: userId,
        author_name: currentUser?.name || '사용자',
        updated_at: new Date().toISOString(),
      };

      if (editingSuggestion) {
        const { error } = await supabase.from('suggestions').update(payload).eq('id', editingSuggestion.id);
        if (error) throw error;
        showAlert('수정 완료', '개선/건의사항이 수정되었습니다.', 'success', fetchSuggestions);
      } else {
        const { error } = await supabase
          .from('suggestions')
          .insert([{ ...payload, created_at: new Date().toISOString() }]);
        if (error) throw error;
        showAlert('등록 완료', '개선/건의사항이 등록되었습니다.', 'success', fetchSuggestions);
      }
      setShowSuggestionModal(false);
    } catch (err: any) {
      showAlert('저장 실패', '개선/건의사항 저장 실패: ' + (err?.message || ''), 'error');
    }
  };

  const handleAnonymousSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      showAlert('입력 확인', '제목과 내용을 모두 입력해주세요.', 'info');
      return;
    }

    try {
      const userId = getCurrentUserId();
      const { error } = await supabase.from('anonymous_posts').insert([
        {
          title: title.trim(),
          content: content.trim(),
          author_id: userId,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;
      showAlert('등록 완료', '익명 글이 등록되었습니다.', 'success');
      setShowAnonymousModal(false);
      if (isAdmin) fetchAnonymousPosts();
    } catch (err: any) {
      showAlert('저장 실패', '익명 글 저장 실패: ' + (err?.message || ''), 'error');
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showAlert('권한 없음', '댓글은 관리자 계정만 작성 가능합니다.', 'error');
      return;
    }
    if (!newComment.trim() || !selectedSuggestion) return;

    try {
      const { error } = await supabase.from('suggestion_comments').insert([
        {
          suggestion_id: selectedSuggestion.id,
          author_id: getCurrentUserId(),
          author_name: currentUser?.name || '관리자',
          content: newComment.trim(),
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;
      setNewComment('');

      await fetchComments(selectedSuggestion.id);
      await fetchSuggestions();
      showAlert('성공', '댓글이 등록되었습니다.', 'success');
    } catch (err: any) {
      showAlert('댓글 저장 실패', err?.message || '댓글 저장에 실패했습니다.', 'error');
    }
  };

  return (
    <div className="w-full text-[#1F2937] p-4 sm:p-6 space-y-6 font-sans border-box">
      {/* 상단 Header */}
      <div className="bg-white p-4 rounded-xl border border-[#E2E5E9] shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-xl text-[#243B5A]">
              <Bell className="h-6 w-6" />
            </div>

            <div>
              <h1 className="text-base font-bold text-[#1F2937]">소통 게시판</h1>
              <p className="text-xs text-[#64748B]">
                사내 주요 공지, 개선/건의 및 익명 의견을 통합 관리하는 게시판입니다.
              </p>
            </div>
          </div>

          <div className="sm:hidden flex items-center">
            <button
              onClick={() => {
                if (notices.length > 0) handleSelectNotice(notices[0]);
              }}
              className={`p-2 rounded-full border transition ${
                hasUnreadNotice ? 'bg-red-50 text-red-600 border-red-200' : 'bg-sky-50 text-sky-400 border-sky-200'
              }`}
              title={hasUnreadNotice ? '읽지 않은 새 공지가 있습니다.' : '모든 공지를 확인했습니다.'}
            >
              <Bell className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {isAdmin && (
            <button
              onClick={handleOpenNoticeCreate}
              className="flex items-center justify-center space-x-1 bg-[#243B5A] text-white px-3 py-2 rounded-lg hover:bg-[#1d3049] transition shadow-xs font-medium text-xs cursor-pointer shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>공지 등록</span>
            </button>
          )}
          <button
            onClick={handleOpenSuggestionCreate}
            className="flex items-center justify-center space-x-1 bg-[#243B5A] text-white px-3 py-2 rounded-lg hover:bg-[#1d3049] transition shadow-xs font-medium text-xs cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>건의사항 작성</span>
          </button>
          <button
            onClick={handleOpenAnonymousCreate}
            className="flex items-center justify-center space-x-1 bg-[#243B5A] text-white px-3 py-2 rounded-lg hover:bg-[#1d3049] transition shadow-xs font-medium text-xs cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>익명글 작성</span>
          </button>
        </div>
      </div>

      {/* ---------------- 1. 공지사항 섹션 ---------------- */}
      <div className="bg-white rounded-xl border border-[#E2E5E9] shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E2E5E9] bg-[#F5F6F8] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-[#243B5A]" />
            <span className="text-xs font-bold text-[#1F2937]">공지사항 목록</span>
            <span className="text-[10px] text-[#64748B]">총 {notices.length}건</span>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-[#64748B]">공지사항을 불러오는 중...</div>
        ) : notices.length === 0 ? (
          <div className="py-10 text-center">
            <Bell className="h-7 w-7 mx-auto mb-2 text-[#CBD5E1]" />
            <p className="text-xs text-[#64748B]">등록된 공지사항이 없습니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#E2E5E9]">
            {notices.map((notice) => (
              <div
                key={notice.id}
                onClick={() => handleSelectNotice(notice)}
                className="px-4 py-3 hover:bg-[#F8FAFC] cursor-pointer transition"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 shrink-0 p-2 rounded-lg ${
                      notice.is_pinned ? 'bg-[#243B5A] text-white' : 'bg-[#F5F6F8] text-[#64748B]'
                    }`}
                  >
                    {notice.is_pinned ? <Pin className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {notice.is_pinned && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#243B5A] text-white font-bold shrink-0">
                          중요
                        </span>
                      )}
                      <h3 className="text-xs sm:text-sm font-bold text-[#1F2937] truncate">{notice.title}</h3>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-[#64748B]">
                      <span>작성자: {notice.author_name}</span>
                      <span>{formatDate(notice.created_at)}</span>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => handleOpenNoticeEdit(notice, e)}
                        className="p-1.5 text-[#64748B] hover:text-[#243B5A] hover:bg-[#F5F6F8] rounded-lg cursor-pointer"
                        title="공지 수정"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteClick(notice.id, 'notice', e)}
                        className="p-1.5 text-[#64748B] hover:text-[#DC2626] hover:bg-red-50 rounded-lg cursor-pointer"
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

      {/* ---------------- 2. 개선 및 건의 목록 섹션 ---------------- */}
      <div className="bg-white rounded-xl border border-[#E2E5E9] shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E2E5E9] bg-[#F5F6F8] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-[#243B5A]" />
            <span className="text-xs font-bold text-[#1F2937]">개선 및 건의 목록</span>
            <span className="text-[10px] text-[#64748B]">총 {suggestions.length}건</span>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-[#64748B]">개선/건의사항을 불러오는 중...</div>
        ) : suggestions.length === 0 ? (
          <div className="py-10 text-center">
            <Lightbulb className="h-7 w-7 mx-auto mb-2 text-[#CBD5E1]" />
            <p className="text-xs text-[#64748B]">등록된 개선/건의사항이 없습니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#E2E5E9]">
            {suggestions.map((item) => {
              const canModify = isAdmin || item.author_id === getCurrentUserId();
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedSuggestion(item);
                    fetchComments(item.id);
                  }}
                  className="px-4 py-3.5 hover:bg-[#F8FAFC] cursor-pointer transition"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0 p-2 rounded-lg bg-[#F5F6F8] text-[#243B5A]">
                      <Lightbulb className="h-3.5 w-3.5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xs sm:text-sm font-bold text-[#1F2937] truncate">{item.title}</h3>
                        {item.has_comment && (
                          <span className="text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full shrink-0">
                            댓글 등록 완료
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#64748B] line-clamp-1 mb-1.5">{item.content}</p>
                      <div className="flex items-center gap-3 text-[10px] text-[#64748B]">
                        <span>작성자: {item.author_name}</span>
                        <span>{formatDate(item.created_at)}</span>
                      </div>
                    </div>

                    {canModify && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => handleOpenSuggestionEdit(item, e)}
                          className="p-1.5 text-[#64748B] hover:text-[#243B5A] hover:bg-[#F5F6F8] rounded-lg cursor-pointer"
                          title="수정"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteClick(item.id, 'suggestion', e, item.author_id)}
                          className="p-1.5 text-[#64748B] hover:text-[#DC2626] hover:bg-red-50 rounded-lg cursor-pointer"
                          title="삭제"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------------- 3. 익명 게시판 섹션 (관리자 전용 열람) ---------------- */}
      {isAdmin && (
        <div className="bg-white rounded-xl border border-[#E2E5E9] shadow-xs overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E2E5E9] bg-[#F5F6F8] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <EyeOff className="h-4 w-4 text-[#243B5A]" />
              <span className="text-xs font-bold text-[#1F2937]">익명 게시판 목록 (관리자 전용 열람)</span>
              <span className="text-[10px] text-[#64748B]">총 {anonymousPosts.length}건</span>
            </div>
            <span className="text-[10px] font-semibold text-[#243B5A] bg-[#243B5A]/10 px-2 py-0.5 rounded border border-[#243B5A]/20">
              작성자 숨김 처리됨
            </span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-[#64748B]">익명 게시글을 불러오는 중...</div>
          ) : anonymousPosts.length === 0 ? (
            <div className="py-10 text-center">
              <EyeOff className="h-7 w-7 mx-auto mb-2 text-[#CBD5E1]" />
              <p className="text-xs text-[#64748B]">등록된 익명 글이 없습니다.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#E2E5E9]">
              {anonymousPosts.map((post) => (
                <div
                  key={post.id}
                  onClick={() => setSelectedAnonymousPost(post)}
                  className="px-4 py-3.5 hover:bg-[#F8FAFC] cursor-pointer transition"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0 p-2 rounded-lg bg-[#F5F6F8] text-[#243B5A]">
                      <EyeOff className="h-3.5 w-3.5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs sm:text-sm font-bold text-[#1F2937] truncate mb-1">{post.title}</h3>
                      <div className="flex items-center gap-3 text-[10px] text-[#64748B]">
                        <span className="font-semibold text-gray-500">작성자: 익명</span>
                        <span>{formatDate(post.created_at)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => handleDeleteClick(post.id, 'anonymous', e)}
                        className="p-1.5 text-[#64748B] hover:text-[#DC2626] hover:bg-red-50 rounded-lg cursor-pointer"
                        title="삭제 (관리자)"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------------- 모달 1: 공지 상세보기 ---------------- */}
      {selectedNotice && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E2E5E9] rounded-xl max-w-lg w-full shadow-xl relative text-[#1F2937] overflow-hidden">
            <div className="p-5">
              <button
                onClick={() => setSelectedNotice(null)}
                className="absolute top-4 right-4 text-[#64748B] hover:text-[#1F2937] cursor-pointer"
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

              <h2 className="text-sm sm:text-base font-bold text-[#1F2937] pr-6 mb-2">{selectedNotice.title}</h2>

              <div className="flex items-center gap-3 text-[10px] text-[#64748B] pb-3 border-b border-[#E2E5E9]">
                <span>작성자: {selectedNotice.author_name}</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(selectedNotice.created_at)}
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
                        const notice = selectedNotice;
                        setSelectedNotice(null);
                        handleOpenNoticeEdit(notice);
                      }}
                      className="px-3 py-1.5 bg-[#F5F6F8] hover:bg-[#E2E5E9] text-[#1F2937] rounded-lg text-xs font-semibold flex items-center gap-1 border border-[#E2E5E9] cursor-pointer"
                    >
                      <Pencil className="h-3 w-3" />
                      수정
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setSelectedNotice(null)}
                  className="px-4 py-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 모달 2: 개선/건의 상세보기 & 댓글 ---------------- */}
      {selectedSuggestion && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E2E5E9] rounded-xl max-w-lg w-full shadow-xl relative text-[#1F2937] overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 overflow-y-auto space-y-4">
              <button
                onClick={() => setSelectedSuggestion(null)}
                className="absolute top-4 right-4 text-[#64748B] hover:text-[#1F2937] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div>
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-[#F5F6F8] border border-[#E2E5E9] text-[#243B5A] font-bold mb-2">
                  <Lightbulb className="h-3 w-3" />
                  개선/건의사항
                </span>
                <h2 className="text-sm sm:text-base font-bold text-[#1F2937] pr-6">{selectedSuggestion.title}</h2>
              </div>

              <div className="flex items-center gap-3 text-[10px] text-[#64748B] pb-3 border-b border-[#E2E5E9]">
                <span>작성자: {selectedSuggestion.author_name}</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(selectedSuggestion.created_at)}
                </span>
              </div>

              <div className="py-2 text-xs sm:text-sm text-[#1F2937] whitespace-pre-wrap leading-6 min-h-[80px]">
                {selectedSuggestion.content}
              </div>

              {/* 댓글 섹션 */}
              <div className="pt-4 border-t border-[#E2E5E9]">
                <h3 className="text-xs font-bold text-[#1F2937] mb-2 flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-[#243B5A]" />
                  <span>관리자 답변 목록 ({comments.length})</span>
                </h3>

                <div className="space-y-2 mb-3">
                  {comments.length === 0 ? (
                    <p className="text-[11px] text-[#64748B] bg-[#F5F6F8] p-3 rounded-lg text-center">
                      아직 등록된 답변이 없습니다.
                    </p>
                  ) : (
                    comments.map((c) => (
                      <div key={c.id} className="bg-[#F5F6F8] p-3 rounded-lg border border-[#E2E5E9] space-y-1">
                        <div className="flex justify-between items-center text-[10px] text-[#64748B]">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#243B5A] flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {c.author_name}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span>{formatDate(c.created_at)}</span>
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteClick(c.id, 'comment', undefined, c.author_id)}
                                className="text-red-500 hover:text-red-700 cursor-pointer"
                              >
                                삭제
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-[#1F2937] whitespace-pre-wrap">{c.content}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* 관리자 작성 폼 */}
                {isAdmin ? (
                  <form onSubmit={handleCommentSubmit} className="flex gap-2">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="답변 코멘트를 입력하세요..."
                      className="flex-1 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg p-2 text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] focus:outline-hidden"
                    />
                    <button
                      type="submit"
                      className="px-3 py-2 bg-[#243B5A] text-white rounded-lg text-xs font-semibold hover:bg-[#1d3049] transition cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <Send className="h-3 w-3" />
                      <span>등록</span>
                    </button>
                  </form>
                ) : (
                  <p className="text-[10px] text-[#64748B] text-center pt-1">
                    * 답변 작성을 위한 권한은 관리자 계정에게만 부여됩니다.
                  </p>
                )}
              </div>
            </div>

            <div className="p-4 bg-[#F5F6F8] border-t border-[#E2E5E9] flex justify-end">
              <button
                onClick={() => setSelectedSuggestion(null)}
                className="px-4 py-1.5 bg-[#243B5A] text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 모달 3: 익명글 상세보기 (관리자 전용) ---------------- */}
      {selectedAnonymousPost && isAdmin && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E2E5E9] rounded-xl max-w-lg w-full shadow-xl relative text-[#1F2937] overflow-hidden">
            <div className="p-5">
              <button
                onClick={() => setSelectedAnonymousPost(null)}
                className="absolute top-4 right-4 text-[#64748B] hover:text-[#1F2937] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-gray-100 border border-gray-300 text-gray-700 font-bold">
                  <EyeOff className="h-3 w-3" />
                  익명 제보
                </span>
              </div>

              <h2 className="text-sm sm:text-base font-bold text-[#1F2937] pr-6 mb-2">
                {selectedAnonymousPost.title}
              </h2>

              <div className="flex items-center gap-3 text-[10px] text-[#64748B] pb-3 border-b border-[#E2E5E9]">
                <span className="font-bold text-gray-500">작성자: 익명 (숨김 처리)</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(selectedAnonymousPost.created_at)}
                </span>
              </div>

              <div className="py-5 text-xs sm:text-sm text-[#1F2937] whitespace-pre-wrap leading-6 min-h-[120px]">
                {selectedAnonymousPost.content}
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-[#E2E5E9]">
                <button
                  type="button"
                  onClick={() => handleDeleteClick(selectedAnonymousPost.id, 'anonymous')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-[#DC2626] bg-red-50 hover:bg-red-100 border border-red-200 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  삭제
                </button>

                <button
                  onClick={() => setSelectedAnonymousPost(null)}
                  className="px-4 py-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 작성/수정 모달: 공지사항 ---------------- */}
      {showNoticeModal && isAdmin && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E2E5E9] rounded-xl max-w-lg w-full p-5 shadow-xl relative text-[#1F2937]">
            <button
              onClick={() => setShowNoticeModal(false)}
              className="absolute top-4 right-4 text-[#64748B] hover:text-[#1F2937] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-[#243B5A]">
                <Bell className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold">{editingNotice ? '공지사항 수정' : '공지사항 등록'}</h2>
            </div>

            <form onSubmit={handleNoticeSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold text-[#64748B] mb-1 text-xs">제목</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg p-2.5 text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] focus:outline-hidden"
                  placeholder="공지 제목을 입력해주세요."
                />
              </div>

              <div>
                <label className="block font-semibold text-[#64748B] mb-1 text-xs">내용</label>
                <textarea
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={10}
                  className="w-full bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg p-2.5 text-xs text-[#1F2937] resize-none focus:bg-white focus:border-[#243B5A] focus:outline-hidden"
                  placeholder="공지 내용을 입력해주세요."
                />
              </div>

              <label className="flex items-center gap-2 p-2.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="h-4 w-4"
                />
                <div>
                  <div className="text-xs font-semibold text-[#1F2937]">중요 공지로 상단 고정</div>
                  <div className="text-[10px] text-[#64748B]">중요 공지는 일반 공지보다 위에 표시됩니다.</div>
                </div>
              </label>

              <div className="flex items-center justify-between pt-3 border-t border-[#E2E5E9]">
                {editingNotice ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(editingNotice.id, 'notice')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-[#DC2626] bg-red-50 hover:bg-red-100 border border-red-200 cursor-pointer"
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
                    onClick={() => setShowNoticeModal(false)}
                    className="px-3 py-1.5 bg-white border border-[#E2E5E9] hover:bg-[#F5F6F8] rounded-lg text-xs cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    {editingNotice ? '수정 완료' : '등록하기'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- 작성/수정 모달: 개선/건의사항 ---------------- */}
      {showSuggestionModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E2E5E9] rounded-xl max-w-lg w-full p-5 shadow-xl relative text-[#1F2937]">
            <button
              onClick={() => setShowSuggestionModal(false)}
              className="absolute top-4 right-4 text-[#64748B] hover:text-[#1F2937] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-[#243B5A]">
                <Lightbulb className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold">
                {editingSuggestion ? '개선/건의사항 수정' : '개선/건의사항 작성'}
              </h2>
            </div>

            <form onSubmit={handleSuggestionSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold text-[#64748B] mb-1 text-xs">제목</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg p-2.5 text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] focus:outline-hidden"
                  placeholder="개선/건의 제목을 입력해 주세요."
                />
              </div>

              <div>
                <label className="block font-semibold text-[#64748B] mb-1 text-xs">내용</label>
                <textarea
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={8}
                  className="w-full bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg p-2.5 text-xs text-[#1F2937] resize-none focus:bg-white focus:border-[#243B5A] focus:outline-hidden"
                  placeholder="구체적인 의견 및 개선 요청사항을 적어주세요."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E2E5E9]">
                <button
                  type="button"
                  onClick={() => setShowSuggestionModal(false)}
                  className="px-3 py-1.5 bg-white border border-[#E2E5E9] hover:bg-[#F5F6F8] rounded-lg text-xs cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  {editingSuggestion ? '수정 완료' : '등록하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- 작성 모달: 익명 게시판 ---------------- */}
      {showAnonymousModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E2E5E9] rounded-xl max-w-lg w-full p-5 shadow-xl relative text-[#1F2937]">
            <button
              onClick={() => setShowAnonymousModal(false)}
              className="absolute top-4 right-4 text-[#64748B] hover:text-[#1F2937] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg text-[#243B5A]">
                <EyeOff className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold">익명 의견 작성</h2>
            </div>

            <form onSubmit={handleAnonymousSubmit} className="space-y-3">
              <div className="p-2.5 bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg flex items-center gap-2 text-[11px] text-[#243B5A]">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>작성된 글은 익명으로 안전하게 처리되며 관리자 계정만 열람할 수 있습니다.</span>
              </div>

              <div>
                <label className="block font-semibold text-[#64748B] mb-1 text-xs">제목</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg p-2.5 text-xs text-[#1F2937] focus:bg-white focus:border-[#243B5A] focus:outline-hidden"
                  placeholder="제목을 입력해 주세요."
                />
              </div>

              <div>
                <label className="block font-semibold text-[#64748B] mb-1 text-xs">내용</label>
                <textarea
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={8}
                  className="w-full bg-[#F5F6F8] border border-[#E2E5E9] rounded-lg p-2.5 text-xs text-[#1F2937] resize-none focus:bg-white focus:border-[#243B5A] focus:outline-hidden"
                  placeholder="익명으로 전달하고 싶은 의견을 입력해 주세요."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E2E5E9]">
                <button
                  type="button"
                  onClick={() => setShowAnonymousModal(false)}
                  className="px-3 py-1.5 bg-white border border-[#E2E5E9] hover:bg-[#F5F6F8] rounded-lg text-xs cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  익명으로 등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 중요 공지 팝업 알림 모달 */}
      {showPopupModal && popupNotice && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E2E5E9] rounded-xl max-w-lg w-full shadow-xl relative text-[#1F2937] overflow-hidden">
            <div className="p-5">
              <button
                onClick={handleClosePopup}
                className="absolute top-4 right-4 text-[#64748B] hover:text-[#1F2937] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-[#243B5A] text-white font-bold">
                  <Pin className="h-3 w-3" />
                  중요 공지 알림
                </span>
              </div>

              <h2 className="text-sm sm:text-base font-bold text-[#1F2937] pr-6 mb-2">{popupNotice.title}</h2>

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
                  className="text-xs text-[#64748B] hover:text-[#1F2937] font-medium underline cursor-pointer"
                >
                  오늘 하루 보지 않기
                </button>

                <button
                  onClick={handleClosePopup}
                  className="px-4 py-1.5 bg-[#243B5A] hover:bg-[#1d3049] text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 커스텀 삭제 확인 모달 */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-[#E2E5E9] space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-red-50 rounded-xl text-red-600 border border-red-100">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1F2937]">항목 삭제</h3>
                <p className="text-xs text-[#64748B]">정말 이 항목을 삭제하시겠습니까?</p>
              </div>
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirmModal(false);
                  setDeleteTarget(null);
                }}
                className="flex-1 py-2.5 px-4 bg-[#F5F6F8] text-[#1F2937] hover:bg-[#E2E5E9] text-xs font-semibold rounded-lg transition border border-[#E2E5E9] cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 py-2.5 px-4 bg-[#DC2626] text-white hover:bg-red-700 text-xs font-bold rounded-lg transition shadow-xs cursor-pointer"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 커스텀 알림/성공 모달 */}
      {alertModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-[#E2E5E9] space-y-4">
            <div className="flex items-center space-x-3">
              <div
                className={`p-2.5 rounded-xl border ${
                  alertModal.type === 'error'
                    ? 'bg-red-50 text-red-600 border-red-100'
                    : alertModal.type === 'info'
                    ? 'bg-sky-50 text-sky-600 border-sky-100'
                    : 'bg-[#243B5A]/10 text-[#243B5A] border-[#243B5A]/20'
                }`}
              >
                {alertModal.type === 'error' || alertModal.type === 'info' ? (
                  <AlertCircle className="h-6 w-6" />
                ) : (
                  <CheckCircle2 className="h-6 w-6" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1F2937]">{alertModal.title}</h3>
                <p className="text-xs text-[#64748B] whitespace-pre-wrap mt-0.5">{alertModal.message}</p>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  const callback = alertModal.onConfirm;
                  setAlertModal((prev) => ({ ...prev, isOpen: false, onConfirm: undefined }));
                  if (callback) callback();
                }}
                className="w-full py-2.5 px-4 bg-[#243B5A] text-white hover:bg-[#1a2d46] text-xs font-bold rounded-lg transition shadow-xs cursor-pointer"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
