'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, User, Lock, ShieldAlert, CheckCircle2, Eye, EyeOff, X, RefreshCw, Clock3 } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { supabase } from '@/lib/supabase';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function LoginPage() {
  const [userCode, setUserCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showLoginStats, setShowLoginStats] = useState(false);
  const [loginStats, setLoginStats] = useState<Array<{ id: string; name: string; department: string | null; last_login_at: string | null }>>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const router = useRouter();

  // ✅ 비밀 제스처(3연타 감지) 전용 변수
  const clickCountRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ 아이콘 3연타 터치/클릭 처리 함수
  const handleSecretTripleClick = () => {
    clickCountRef.current += 1;

    // 1초 이내에 연속으로 3번 클릭했는지 확인
    if (clickCountRef.current === 3) {
      if (timerRef.current) clearTimeout(timerRef.current);
      clickCountRef.current = 0;
      // 숨겨진 마지막 로그인 현황 모달 열기
      setShowLoginStats(true);
      void fetchLoginStats();
      return;
    }

    // 1초 동안 추가 클릭이 없으면 클릭 카운트 초기화
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, 1000);
  };


  // 숨겨진 로그인 현황: 모달을 열 때만 직원 목록을 1회 조회
  const fetchLoginStats = async () => {
    setStatsLoading(true);
    setStatsError(null);

    const { data, error } = await supabase
      .from('app_users')
      .select('id, name, department, last_login_at')
      .order('last_login_at', { ascending: false, nullsFirst: false });

    if (error) {
      setStatsError('로그인 현황을 불러오지 못했습니다: ' + error.message);
      setLoginStats([]);
    } else {
      setLoginStats(data || []);
    }

    setStatsLoading(false);
  };

  const formatKoreaDateTime = (value: string | null) => {
    if (!value) return '로그인 기록 없음';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '날짜 확인 불가';
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  };

 
const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!userCode.trim() || !password.trim()) {
    setAlertMessage('아이디와 비밀번호를 모두 입력해주세요.');
    return;
  }

  setLoading(true);

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        userCode: userCode.trim(),
        password: password.trim(),
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      setAlertMessage(
        result.error || '로그인 중 오류가 발생했습니다.'
      );
      return;
    }

    // 서버에서 전달받은 안전한 사용자 정보만 저장
    const userInfo = {
      ...result.user,
    };
    const needsPasswordChange = Boolean(userInfo.must_change_password);
    setMustChangePassword(needsPasswordChange);

    localStorage.setItem('user', JSON.stringify(userInfo));
    localStorage.setItem('currentUser', JSON.stringify(userInfo));

    setAlertMessage(
      needsPasswordChange
        ? `${userInfo.name}님 로그인 되었습니다. 보안을 위해 새 비밀번호를 먼저 설정해주세요.`
        : `${userInfo.name}님 로그인 되었습니다!`
    );

  } catch (err: unknown) {
    console.error('로그인 최종 에러:', err);

    setAlertMessage(
      err instanceof Error
        ? err.message
        : '로그인 중 오류가 발생했습니다.'
    );
  } finally {
    setLoading(false);
  }
};


  // 최초 로그인 또는 관리자가 임시 비밀번호를 재발급한 경우 새 비밀번호 설정
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      setAlertMessage('새 비밀번호는 8자 이상으로 입력해주세요.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setAlertMessage('새 비밀번호와 확인 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (newPassword === password) {
      setAlertMessage('현재 임시 비밀번호와 다른 비밀번호를 설정해주세요.');
      return;
    }

    setChangePasswordLoading(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: password,
          newPassword,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        setAlertMessage(result.error || '비밀번호 변경에 실패했습니다.');
        return;
      }

      const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
      const updatedUser = { ...savedUser, must_change_password: false };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      setMustChangePassword(false);
      setPassword(newPassword);
      setNewPassword('');
      setConfirmNewPassword('');
      setAlertMessage('비밀번호가 안전하게 변경되었습니다. 확인을 누르면 메인 화면으로 이동합니다.');
    } catch (err: unknown) {
      setAlertMessage(
        err instanceof Error ? err.message : '비밀번호 변경 중 오류가 발생했습니다.'
      );
    } finally {
      setChangePasswordLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F6F8] px-4 py-12 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full bg-white p-8 rounded-xl border border-[#E2E5E9] shadow-xs space-y-6">
        
        {/* Header Section */}
        <div className="text-center space-y-3">
          {/* ✅ 아이콘을 빠르게 3번 터치하면 관리자 페이지로 이동합니다. */}
          <div 
            onClick={handleSecretTripleClick}
            className="mx-auto h-12 w-12 bg-[#243B5A]/10 rounded-xl flex items-center justify-center border border-[#243B5A]/20 cursor-pointer active:scale-95 transition-transform select-none"
            title="통합현장관리"
          >
            <LogIn className="h-6 w-6 text-[#243B5A]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#1F2937] tracking-tight">
              통합 현장 관리 SYSTEM
            </h2>
            <p className="text-xs text-[#64748B] mt-1 font-medium">
              Enterprise Work Management Portal
            </p>
          </div>
        </div>

        {/* Login Form / 최초 비밀번호 변경 */}
        {mustChangePassword ? (
          <form className="space-y-4" onSubmit={handleChangePassword}>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
              최초 로그인 또는 임시 비밀번호로 로그인했습니다. 계속 사용하려면 본인만 아는 새 비밀번호를 설정해야 합니다.
            </div>
            <div>
              <label htmlFor="newPassword" className="mb-1.5 block text-xs font-semibold text-[#1F2937]">새 비밀번호 (8자 이상)</label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="block w-full rounded-lg border border-[#E2E5E9] bg-white px-3 py-2 text-xs text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden focus:ring-1 focus:ring-[#243B5A]"
                placeholder="새 비밀번호를 입력하세요"
              />
            </div>
            <div>
              <label htmlFor="confirmNewPassword" className="mb-1.5 block text-xs font-semibold text-[#1F2937]">새 비밀번호 확인</label>
              <input
                id="confirmNewPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="block w-full rounded-lg border border-[#E2E5E9] bg-white px-3 py-2 text-xs text-[#1F2937] focus:border-[#243B5A] focus:outline-hidden focus:ring-1 focus:ring-[#243B5A]"
                placeholder="새 비밀번호를 다시 입력하세요"
              />
            </div>
            <button
              type="submit"
              disabled={changePasswordLoading}
              className={cn(
                "w-full flex justify-center items-center py-2.5 px-4 rounded-lg text-xs font-semibold text-white bg-[#243B5A] hover:bg-[#1d3049] transition shadow-xs cursor-pointer",
                changePasswordLoading && "opacity-70 cursor-not-allowed"
              )}
            >
              {changePasswordLoading ? '변경 처리 중...' : '새 비밀번호 저장'}
            </button>
          </form>
        ) : (
        <form className="space-y-4" onSubmit={handleLogin}>
          <div className="space-y-3">
            <div>
              <label htmlFor="userCode" className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                아이디 <span className="text-[#64748B] font-normal">(사번 : 예: W123456 / 대소문자 구분 없음)</span>
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-[#64748B]" />
                </div>
                <input
                  id="userCode"
                  name="userCode"
                  type="text"
                  required
                  value={userCode}
                  onChange={(e) => setUserCode(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2 bg-[#FFFFFF] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] placeholder-[#64748B]/60 focus:bg-white focus:border-[#243B5A] focus:ring-1 focus:ring-[#243B5A] focus:outline-hidden transition font-medium"
                  placeholder="아이디를 입력하세요"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                비밀번호
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-[#64748B]" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-9 pr-10 py-2 bg-[#FFFFFF] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] placeholder-[#64748B]/60 focus:bg-white focus:border-[#243B5A] focus:ring-1 focus:ring-[#243B5A] focus:outline-hidden transition font-medium"
                  placeholder="비밀번호를 입력하세요"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#64748B] hover:text-[#1F2937] cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={cn(
              "w-full flex justify-center items-center py-2.5 px-4 border border-transparent text-xs font-semibold rounded-lg text-white bg-[#243B5A] hover:bg-[#1d3049] focus:outline-hidden focus:ring-2 focus:ring-offset-1 focus:ring-[#243B5A] transition shadow-xs cursor-pointer",
              loading && "opacity-70 cursor-not-allowed"
            )}
          >
            {loading ? '인증 처리 중...' : '로그인'}
          </button>
        </form>
        )}

        {/* 안내 문구 카드 */}
        <div className="text-xs text-[#64748B] bg-[#F5F6F8] p-3.5 rounded-lg border border-[#E2E5E9] space-y-1.5 leading-relaxed">
          <div className="flex items-start space-x-1.5">
            <span className="text-[#243B5A] font-bold">•</span>
            <p><strong className="text-[#1F2937] font-semibold">아이디(사번):</strong> 현대 삼호중공업 사번</p>
          </div>
          <div className="flex items-start space-x-1.5">
            <span className="text-[#243B5A] font-bold">•</span>
            <p>아이디가 없는 경우 관리자에게 문의 바랍니다.- 조형수책임</p>
          </div>
        </div>
      </div>

      {/* Hidden Login Statistics Modal */}
      {showLoginStats && (
        <div className="fixed inset-0 z-[99998] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-5">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#E2E5E9] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E2E5E9] bg-[#F8FAFC] px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#243B5A]/10 text-[#243B5A]">
                  <Clock3 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1F2937]">직원 마지막 로그인 현황</h3>
                  <p className="text-[11px] text-[#64748B]">대한민국 표준시(KST) 기준</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void fetchLoginStats()}
                  disabled={statsLoading}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-[#D7DDE5] bg-white px-2.5 text-xs font-semibold text-[#334155] hover:bg-[#F1F5F9] disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${statsLoading ? 'animate-spin' : ''}`} />
                  새로고침
                </button>
                <button
                  type="button"
                  onClick={() => setShowLoginStats(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#E9EEF5] hover:text-[#1F2937]"
                  aria-label="닫기"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {statsLoading && loginStats.length === 0 ? (
                <div className="p-10 text-center text-xs font-medium text-[#64748B]">로그인 현황을 불러오는 중입니다...</div>
              ) : statsError ? (
                <div className="p-6 text-center text-xs font-semibold text-[#DC2626]">{statsError}</div>
              ) : loginStats.length === 0 ? (
                <div className="p-10 text-center text-xs text-[#64748B]">표시할 직원 정보가 없습니다.</div>
              ) : (
                <table className="w-full min-w-[520px] border-collapse text-left text-xs">
                  <thead className="sticky top-0 bg-[#F1F5F9] text-[#475569]">
                    <tr>
                      <th className="border-b border-[#E2E5E9] px-4 py-3 font-bold">사번</th>
                      <th className="border-b border-[#E2E5E9] px-4 py-3 font-bold">이름</th>
                      <th className="border-b border-[#E2E5E9] px-4 py-3 font-bold">부서</th>
                      <th className="border-b border-[#E2E5E9] px-4 py-3 font-bold">마지막 로그인 (KST)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loginStats.map((employee) => (
                      <tr key={employee.id} className="border-b border-[#EEF1F5] last:border-0 hover:bg-[#F8FAFC]">
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-[#475569]">{employee.id}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#1F2937]">{employee.name || '-'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-[#64748B]">{employee.department || '-'}</td>
                        <td className={`whitespace-nowrap px-4 py-3 ${employee.last_login_at ? 'font-semibold text-[#243B5A]' : 'text-[#94A3B8]'}`}>
                          {formatKoreaDateTime(employee.last_login_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="border-t border-[#E2E5E9] bg-[#F8FAFC] px-4 py-2.5 text-[10px] text-[#64748B]">
              직원 {loginStats.length.toLocaleString('ko-KR')}명 · 모달을 열거나 새로고침할 때만 조회합니다.
            </div>
          </div>
        </div>
      )}

      {/* Corporate Alert Modal */}
      {alertMessage && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-[99999]">
          <div className="bg-white border border-[#E2E5E9] rounded-xl p-6 max-w-sm w-full text-center shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-center">
              {alertMessage.includes('로그인 되었습니다') || alertMessage.includes('비밀번호가 안전하게 변경되었습니다') ? (
                <div className="h-10 w-10 bg-emerald-100 text-[#16A34A] rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
              ) : (
                <div className="h-10 w-10 bg-red-100 text-[#DC2626] rounded-full flex items-center justify-center">
                  <ShieldAlert className="h-6 w-6" />
                </div>
              )}
            </div>
            
            <p className="text-[#1F2937] text-xs font-semibold whitespace-pre-wrap leading-relaxed">
              {alertMessage}
            </p>

            <button
              onClick={() => {
                const isLoginSuccess = alertMessage.includes('로그인 되었습니다');
                const isPasswordChanged = alertMessage.includes('비밀번호가 안전하게 변경되었습니다');
                setAlertMessage(null);
                if (isPasswordChanged || (isLoginSuccess && !mustChangePassword)) {
                  router.replace('/main');
                }
              }}
              className="w-full py-2 bg-[#243B5A] hover:bg-[#1d3049] text-white rounded-lg text-xs font-semibold transition shadow-xs cursor-pointer"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}