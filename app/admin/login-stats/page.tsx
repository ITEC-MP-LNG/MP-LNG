'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Shield, ArrowLeft, RefreshCw, UserCheck } from 'lucide-react';

export default function AdminLoginStatsPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchUserStats = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('id, name, department, role, login_count')
        .order('login_count', { ascending: false }); // 로그인 많이 한 순서대로 정렬

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('로그인 통계 불러오기 실패:', err);
      alert('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserStats();
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F6F8] p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* 상단 헤더 */}
        <div className="flex items-center justify-between bg-white p-5 rounded-xl border border-[#E2E5E9] shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-[#243B5A]/10 text-[#243B5A] rounded-lg flex items-center justify-center">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#1F2937]">관리자 전용: 사용자별 로그인 횟수 현황</h1>
              <p className="text-xs text-[#64748B]">직원들의 모바일 화면에는 보이지 않는 숨겨진 관리 페이지입니다.</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchUserStats}
              className="flex items-center space-x-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-[#1F2937] rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>새로고침</span>
            </button>
            <button
              onClick={() => router.push('/main')}
              className="flex items-center space-x-1 px-3 py-2 bg-[#243B5A] hover:bg-[#1d3049] text-white rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>메인으로</span>
            </button>
          </div>
        </div>

        {/* 목록 테이블 카드 */}
        <div className="bg-white rounded-xl border border-[#E2E5E9] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#E2E5E9] bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-semibold text-[#1F2937] flex items-center gap-1.5">
              <UserCheck className="h-4 w-4 text-[#243B5A]" />
              전체 등록 사용자 목록 ({users.length}명)
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs text-[#64748B]">데이터를 불러오는 중입니다...</div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#64748B]">등록된 사용자가 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F5F6F8] text-[#64748B] border-b border-[#E2E5E9]">
                    <th className="py-3 px-4 font-semibold">사번 (ID)</th>
                    <th className="py-3 px-4 font-semibold">이름</th>
                    <th className="py-3 px-4 font-semibold">부서</th>
                    <th className="py-3 px-4 font-semibold">권한</th>
                    <th className="py-3 px-4 font-semibold text-right">누적 로그인 횟수</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E5E9]">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-4 font-medium text-[#1F2937]">{user.id}</td>
                      <td className="py-3 px-4 font-semibold text-[#1F2937]">{user.name}</td>
                      <td className="py-3 px-4 text-[#64748B]">{user.department || '-'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${user.role === 'ADMIN' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                          {user.role || 'USER'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-[#243B5A]">
                        {user.login_count || 0} 회
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}