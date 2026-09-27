'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, User, Lock, ShieldAlert, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { supabase } from '@/lib/supabase';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function LoginPage() {
  const [userCode, setUserCode] = useState('');
  const [password, setPassword] = useState('');
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      setAlertMessage('Supabase 환경변수가 설정되지 않았습니다. .env.local을 확인하고 서버를 재시작해 주세요.');
      return;
    }

    if (!userCode.trim() || !password.trim()) {
      setAlertMessage('아이디와 비밀번호(생년월일)를 모두 입력해주세요.');
      return;
    }

    setLoading(true);

    try {
      const cleanUserCode = userCode.trim();
      const cleanPassword = password.trim();

      // 1. Supabase 데이터베이스 (app_users) 연동 조회 - 대소문자 구분 없음 (ilike 사용)
      let { data, error: dbError } = await supabase
        .from('app_users')
        .select('*')
        .ilike('id', cleanUserCode)
        .maybeSingle();

      // 만약 'id' 컬럼 에러가 난다면 'user_id' 컬럼으로 재시도 (대소문자 무시)
      if (dbError && dbError.message?.includes('column')) {
        const retryResult = await supabase
          .from('app_users')
          .select('*')
          .ilike('user_id', cleanUserCode)
          .maybeSingle();
        
        data = retryResult.data;
        dbError = retryResult.error;
      }

      if (dbError) {
        console.error("Supabase 상세 에러 객체:", JSON.stringify(dbError, null, 2));
        throw new Error(dbError.message || '데이터베이스 연동 중 오류가 발생했습니다.');
      }

      if (!data) {
        setAlertMessage('존재하지 않는 아이디입니다.');
        return;
      }

      // 2. 비밀번호(생년월일) 검증
      const userPassword = data.password || data.birth_date || data.birthdate || '';
      if (String(userPassword).trim() !== cleanPassword) {
        setAlertMessage('비밀번호(생년월일)가 일치하지 않습니다.');
        return;
      }

      // 3. 로그인 성공 처리
      const userInfo = {
        id: data.id || data.user_id,
        name: data.name || '사용자',
        role: data.role || 'USER',
        birth_date: userPassword,
      };

      localStorage.setItem('user', JSON.stringify(userInfo));
      localStorage.setItem('currentUser', JSON.stringify(userInfo));

      setAlertMessage(`${userInfo.name}님 로그인 되었습니다!`);

    } catch (err: any) {
      console.error('로그인 최종 에러:', err);
      setAlertMessage(err.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F6F8] px-4 py-12 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full bg-white p-8 rounded-xl border border-[#E2E5E9] shadow-xs space-y-6">
        
        {/* Header Section */}
        <div className="text-center space-y-3">
          <div className="mx-auto h-12 w-12 bg-[#243B5A]/10 rounded-xl flex items-center justify-center border border-[#243B5A]/20">
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

        {/* Login Form */}
        <form className="space-y-4" onSubmit={handleLogin}>
          <div className="space-y-3">
            <div>
              <label htmlFor="userCode" className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                아이디 <span className="text-[#64748B] font-normal">(사번 : W123456 / 대소문자 구분 없음)</span>
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
                비밀번호 <span className="text-[#64748B] font-normal">(생년월일 8자리)</span>
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-[#64748B]" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2 bg-[#FFFFFF] border border-[#E2E5E9] rounded-lg text-xs text-[#1F2937] placeholder-[#64748B]/60 focus:bg-white focus:border-[#243B5A] focus:ring-1 focus:ring-[#243B5A] focus:outline-hidden transition font-medium"
                  placeholder="예: 19980101"
                />
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

        {/* 안내 문구 카드 */}
        <div className="text-xs text-[#64748B] bg-[#F5F6F8] p-3.5 rounded-lg border border-[#E2E5E9] space-y-1.5 leading-relaxed">
          <div className="flex items-start space-x-1.5">
            <span className="text-[#243B5A] font-bold">•</span>
            <p><strong className="text-[#1F2937] font-semibold">아이디(사번):</strong> 현대 삼호중공업 사번 (대소문자 관계없이 입력 가능)</p>
          </div>
          <div className="flex items-start space-x-1.5">
            <span className="text-[#243B5A] font-bold">•</span>
            <p>아이디가 없는 경우 시스템 관리자에게 문의 바랍니다.</p>
          </div>
        </div>
      </div>

      {/* Corporate Alert Modal */}
      {alertMessage && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-[99999]">
          <div className="bg-white border border-[#E2E5E9] rounded-xl p-6 max-w-sm w-full text-center shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-center">
              {alertMessage.includes('로그인 되었습니다') ? (
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
                const isSuccess = alertMessage.includes('로그인 되었습니다');
                setAlertMessage(null);
                if (isSuccess) {
                  router.push('/main');
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