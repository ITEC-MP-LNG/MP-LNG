'use client';

import React, { useMemo } from 'react';
import { Pencil, Trash2 } from 'lucide-react';

export interface OrganizationChartUser {
  id: string;
  name: string;
  department?: string;
  position?: string;
  job_title?: string;
  field?: string;
  phone?: string;
  parent_id?: string | null;
  display_order?: number;
  is_retired?: boolean;
}

interface OrganizationChartProps {
  users: OrganizationChartUser[];
  rootTitle?: string;
  isAdmin?: boolean;
}

/* =====================================================
   기본 설정
===================================================== */

const TEAM_ORDER = ['1팀', '2팀', '3팀', '4팀'];

const TEAM_RANK_ORDER: Record<string, number> = {
  책임: 1,
  프로: 2,
  매니저: 3,
};

const OPERATION_JOB_ORDER: Record<string, number> = {
  본부장: 1,
  소장: 2,
  사무: 3,
  팀장: 4,
  책임: 5,
  프로: 6,
  매니저: 7,
};

/* =====================================================
   정렬
===================================================== */

function sortTeamUsers(users: OrganizationChartUser[]) {
  return [...users].sort((a, b) => {
    // 1. 팀장이 항상 최우선
    const aLeader = a.job_title?.trim() === '팀장';
    const bLeader = b.job_title?.trim() === '팀장';

    if (aLeader !== bLeader) {
      return aLeader ? -1 : 1;
    }

    // 2. 팀장이 아니면 직급 순서
    const aRank =
      TEAM_RANK_ORDER[a.position?.trim() || ''] ?? 99;

    const bRank =
      TEAM_RANK_ORDER[b.position?.trim() || ''] ?? 99;

    if (aRank !== bRank) {
      return aRank - bRank;
    }

    // 3. 같은 직급이면 display_order
    return (a.display_order ?? 0) - (b.display_order ?? 0);
  });
}

/* =====================================================
   수정 / 삭제
===================================================== */

function editUser(userId: string) {
  const fn = (window as any).handleChartEdit;

  if (typeof fn === 'function') {
    fn(userId);
  }
}

function deleteUser(userId: string) {
  const fn = (window as any).handleChartDelete;

  if (typeof fn === 'function') {
    fn(userId);
  }
}

function editRoot() {
  const fn = (window as any).handleChartStructureEdit;

  if (typeof fn === 'function') {
    fn('root');
  }
}

/* =====================================================
   사람 카드
===================================================== */

function PersonCard({
  user,
  isAdmin,
  leader = false,
}: {
  user: OrganizationChartUser;
  isAdmin?: boolean;
  leader?: boolean;
}) {
  return (
    <div
      className={`
        group relative rounded-xl border bg-white
        px-3 py-2.5 shadow-sm
        transition-all duration-150
        hover:-translate-y-0.5 hover:shadow-md
        ${
          leader
            ? 'border-slate-400'
            : 'border-slate-200'
        }
      `}
    >
      <div className="flex items-center gap-2.5">
        {/* 직책 표시 */}
        <div
          className={`
            flex h-8 w-8 shrink-0 items-center justify-center
            rounded-lg text-[10px] font-bold
            ${
              leader
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600'
            }
          `}
        >
          {user.job_title?.substring(0, 2) || '직원'}
        </div>

        {/* 이름 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-bold text-slate-800">
              {user.name}
            </span>

            {user.job_title && (
              <span className="shrink-0 text-[10px] text-slate-400">
                {user.job_title}
              </span>
            )}
          </div>

          {(user.position || user.field) && (
            <div className="mt-0.5 truncate text-[10px] text-slate-400">
              {user.position}
              {user.position && user.field ? ' · ' : ''}
              {user.field}
            </div>
          )}
        </div>

        {/* 관리자 버튼 */}
        {isAdmin && (
          <div className="flex shrink-0 gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => editUser(user.id)}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              title="수정"
            >
              <Pencil size={13} />
            </button>

            <button
              type="button"
              onClick={() => deleteUser(user.id)}
              className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
              title="삭제"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* =====================================================
   조직명 박스
===================================================== */

function OrganizationBox({
  title,
  subtitle,
  dark = false,
}: {
  title: string;
  subtitle?: string;
  dark?: boolean;
}) {
  return (
    <div
      className={`
        relative z-10 rounded-xl border px-5 py-3 text-center
        shadow-sm
        ${
          dark
            ? 'border-slate-700 bg-slate-800 text-white'
            : 'border-slate-300 bg-white text-slate-800'
        }
      `}
    >
      <div className="text-sm font-bold">
        {title}
      </div>

      {subtitle && (
        <div
          className={`
            mt-0.5 text-[10px]
            ${dark ? 'text-slate-300' : 'text-slate-400'}
          `}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}

/* =====================================================
   세로 연결선
===================================================== */

function DownLine() {
  return (
    <div className="flex h-7 justify-center">
      <div className="w-px bg-slate-300" />
    </div>
  );
}

/* =====================================================
   수평 연결선
===================================================== */

function HorizontalConnector({
  count,
}: {
  count: number;
}) {
  if (count <= 1) return null;

  return (
    <div className="hidden sm:block">
      <div className="relative mx-auto h-6">
        <div className="absolute left-[calc(50%)] right-[calc(50%)] top-0 border-t border-slate-300" />

        <div
          className="absolute left-0 right-0 top-0"
          style={{
            width: `calc(${Math.min(count, 4) * 25}% - 12px)`,
            marginLeft: `calc(50% - ${Math.min(count, 4) * 12.5}% + 6px)`,
          }}
        />
      </div>
    </div>
  );
}

/* =====================================================
   운영
===================================================== */

function OperationDiagram({
  users,
  isAdmin,
}: {
  users: OrganizationChartUser[];
  isAdmin?: boolean;
}) {
  const operationUsers = sortUsers(
    users,
    OPERATION_JOB_ORDER
  );

  if (operationUsers.length === 0) {
    return null;
  }

  const leaders = operationUsers.filter((user) =>
    ['본부장', '소장', '사무'].includes(
      user.job_title || ''
    )
  );

  const others = operationUsers.filter(
    (user) =>
      !['본부장', '소장', '사무'].includes(
        user.job_title || ''
      )
  );

  return (
    <section>
      {/* 운영 조직 */}
      <div className="flex justify-center">
        <OrganizationBox
          title="운영"
          subtitle="본부 운영 및 사무"
          dark
        />
      </div>

      <DownLine />

      {/* 본부장 / 소장 / 사무 */}
      <div
        className={`
          grid gap-3
          ${
            leaders.length === 1
              ? 'grid-cols-1'
              : leaders.length === 2
                ? 'grid-cols-1 sm:grid-cols-2'
                : 'grid-cols-1 sm:grid-cols-3'
          }
        `}
      >
        {leaders.map((user) => (
          <PersonCard
            key={user.id}
            user={user}
            isAdmin={isAdmin}
            leader
          />
        ))}
      </div>

      {/* 기타 운영 인원 */}
      {others.length > 0 && (
        <>
          <DownLine />

          <div className="mx-auto grid max-w-3xl grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((user) => (
              <PersonCard
                key={user.id}
                user={user}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/* =====================================================
   관리
===================================================== */

function ManagementDiagram({
  users,
  isAdmin,
}: {
  users: OrganizationChartUser[];
  isAdmin?: boolean;
}) {
  const fields = useMemo(() => {
    const map = new Map<
      string,
      OrganizationChartUser[]
    >();

    users.forEach((user) => {
      const field =
        user.field?.trim() ||
        user.position?.trim() ||
        '기타';

      if (!map.has(field)) {
        map.set(field, []);
      }

      map.get(field)!.push(user);
    });

    return Array.from(map.entries()).sort((a, b) =>
      a[0].localeCompare(b[0], 'ko')
    );
  }, [users]);

  if (fields.length === 0) {
    return null;
  }

  return (
    <section>
      {/* 관리 조직 */}
      <div className="flex justify-center">
        <OrganizationBox
          title="관리"
          subtitle="분야별 관리"
          dark
        />
      </div>

      <DownLine />

      {/* 분야 */}
      <div className="relative">
        {/* PC 연결선 */}
        {fields.length > 1 && (
          <div className="pointer-events-none absolute left-[10%] right-[10%] top-0 hidden border-t border-slate-300 sm:block" />
        )}

        <div
          className={`
            grid gap-4
            ${
              fields.length === 1
                ? 'grid-cols-1'
                : fields.length === 2
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : fields.length === 3
                    ? 'grid-cols-1 sm:grid-cols-3'
                    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
            }
          `}
        >
          {fields.map(
            ([fieldName, fieldUsers]) => {
              const sortedUsers = sortUsers(
                fieldUsers,
                TEAM_JOB_ORDER
              );

              return (
                <div
                  key={fieldName}
                  className="relative pt-3"
                >
                  {/* 분야 연결선 */}
                  <div className="absolute left-1/2 top-0 hidden h-3 w-px -translate-x-1/2 bg-slate-300 sm:block" />

                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    {/* 분야 제목 */}
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-center">
                      <div className="text-xs font-bold text-slate-700">
                        {fieldName}
                      </div>

                      <div className="mt-0.5 text-[10px] text-slate-400">
                        {sortedUsers.length}명
                      </div>
                    </div>

                    {/* 분야 인원 */}
                    <div className="space-y-2 p-2.5">
                      {sortedUsers.map(
                        (user) => (
                          <PersonCard
                            key={user.id}
                            user={user}
                            isAdmin={isAdmin}
                            leader={
                              user.job_title ===
                              '팀장'
                            }
                          />
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            }
          )}
        </div>
      </div>
    </section>
  );
}

/* =====================================================
   TEAM
===================================================== */

function TeamDiagram({
  users,
  isAdmin,
}: {
  users: OrganizationChartUser[];
  isAdmin?: boolean;
}) {
  const teams = TEAM_ORDER.map(
    (teamName) => {
      const teamUsers = users.filter(
        (user) =>
          user.department === teamName ||
          user.department ===
            teamName.replace(
              '팀',
              ' TEAM'
            )
      );

      return {
        teamName,
        users: sortUsers(
          users: sortTeamUsers(teamUsers),
        ),
      };
    }
  ).filter(
    (team) => team.users.length > 0
  );

  if (teams.length === 0) {
    return null;
  }

  return (
    <section>
      {/* TEAM */}
      <div className="flex justify-center">
        <OrganizationBox
          title="TEAM"
          subtitle="팀별 조직"
          dark
        />
      </div>

      <DownLine />

      {/* 팀 연결선 */}
      <div className="relative">
        {teams.length > 1 && (
          <div className="pointer-events-none absolute left-[8%] right-[8%] top-0 hidden border-t border-slate-300 sm:block" />
        )}

        <div
          className={`
            grid gap-4
            ${
              teams.length === 1
                ? 'grid-cols-1 max-w-md mx-auto'
                : teams.length === 2
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : teams.length === 3
                    ? 'grid-cols-1 sm:grid-cols-3'
                    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
            }
          `}
        >
          {teams.map((team) => {
            const leaderUsers =
              team.users.filter(
                (user) =>
                  user.job_title ===
                  '팀장'
              );

            const memberUsers =
              team.users.filter(
                (user) =>
                  user.job_title !==
                  '팀장'
              );

            return (
              <div
                key={team.teamName}
                className="relative pt-3"
              >
                {/* 팀으로 내려오는 선 */}
                <div className="absolute left-1/2 top-0 hidden h-3 w-px -translate-x-1/2 bg-slate-300 sm:block" />

                <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
                  {/* 팀 제목 */}
                  <div className="bg-slate-100 px-4 py-3 text-center">
                    <div className="text-sm font-bold text-slate-800">
                      {team.teamName}
                    </div>

                    <div className="mt-0.5 text-[10px] text-slate-400">
                      {team.users.length}명
                    </div>
                  </div>

                  <div className="p-3">
                    {/* 팀장 */}
                    {leaderUsers.length > 0 && (
                      <>
                        <div className="text-center text-[10px] font-semibold text-slate-400">
                          TEAM LEADER
                        </div>

                        <div className="mt-1.5 space-y-2">
                          {leaderUsers.map(
                            (user) => (
                              <PersonCard
                                key={user.id}
                                user={user}
                                isAdmin={
                                  isAdmin
                                }
                                leader
                              />
                            )
                          )}
                        </div>
                      </>
                    )}

                    {/* 팀원 연결선 */}
                    {leaderUsers.length >
                      0 &&
                      memberUsers.length >
                        0 && (
                        <div className="flex justify-center py-2">
                          <div className="h-5 w-px bg-slate-300" />
                        </div>
                      )}

                    {/* 팀원 */}
                    {memberUsers.length >
                      0 && (
                      <>
                        <div className="mb-1 text-center text-[10px] font-semibold text-slate-400">
                          MEMBERS
                        </div>

                        <div className="space-y-2">
                          {memberUsers.map(
                            (user) => (
                              <PersonCard
                                key={
                                  user.id
                                }
                                user={user}
                                isAdmin={
                                  isAdmin
                                }
                              />
                            )
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* =====================================================
   메인
===================================================== */

export default function OrganizationChart({
  users,
  rootTitle = '조직도',
  isAdmin = false,
}: OrganizationChartProps) {
  const activeUsers = useMemo(() => {
    return users.filter(
      (user) =>
        !user.is_retired &&
        user.department !== '퇴사자'
    );
  }, [users]);

  /* 운영 */
  const operationUsers = useMemo(() => {
    return activeUsers.filter(
      (user) =>
        user.department === '운영'
    );
  }, [activeUsers]);

  /* TEAM */
  const teamUsers = useMemo(() => {
    return activeUsers.filter(
      (user) =>
        TEAM_ORDER.includes(
          user.department || ''
        ) ||
        (user.department || '').includes(
          'TEAM'
        )
    );
  }, [activeUsers]);

  /* 관리
     운영과 TEAM을 제외한 나머지를 관리로 처리
  */
  const managementUsers = useMemo(() => {
    return activeUsers.filter(
      (user) => {
        const department =
          user.department || '';

        const isTeam =
          TEAM_ORDER.includes(
            department
          ) ||
          department.includes('TEAM');

        return (
          department === '관리' ||
          (
            department !== '운영' &&
            !isTeam
          )
        );
      }
    );
  }, [activeUsers]);

  return (
    <div className="w-full">
      {/* =========================================
          상단 제목
      ========================================= */}
      <div className="mb-7 flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-bold text-slate-800">
            {rootTitle}
          </div>

          <div className="mt-1 text-[11px] text-slate-400">
            조직 및 인원 현황
          </div>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={editRoot}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-500 transition-colors hover:bg-slate-50"
          >
            <Pencil size={13} />
            제목 수정
          </button>
        )}
      </div>

      {/* =========================================
          조직도
      ========================================= */}
      <div className="mx-auto w-full max-w-6xl">
        {/* 운영 */}
        {operationUsers.length >
          0 && (
          <OperationDiagram
            users={operationUsers}
            isAdmin={isAdmin}
          />
        )}

        {/* 운영 → 관리 */}
        {operationUsers.length >
          0 &&
          managementUsers.length >
            0 && (
            <div className="flex justify-center py-5">
              <div className="h-8 w-px bg-slate-300" />
            </div>
          )}

        {/* 관리 */}
        {managementUsers.length >
          0 && (
          <ManagementDiagram
            users={managementUsers}
            isAdmin={isAdmin}
          />
        )}

        {/* 관리 → TEAM */}
        {managementUsers.length >
          0 &&
          teamUsers.length > 0 && (
            <div className="flex justify-center py-5">
              <div className="h-8 w-px bg-slate-300" />
            </div>
          )}

        {/* TEAM */}
        {teamUsers.length > 0 && (
          <TeamDiagram
            users={teamUsers}
            isAdmin={isAdmin}
          />
        )}

        {/* 데이터 없음 */}
        {activeUsers.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 py-14 text-center">
            <div className="text-sm text-slate-500">
              표시할 조직원이 없습니다.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
