'use client';

import React, { useMemo } from 'react';
import { Pencil, Trash2, ChevronDown } from 'lucide-react';

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

/* -------------------------------------------------------
   기본 순서
------------------------------------------------------- */

const TEAM_ORDER = ['1팀', '2팀', '3팀', '4팀'];

const TEAM_JOB_ORDER: Record<string, number> = {
  팀장: 1,
  책임: 2,
  프로: 3,
  매니저: 4,
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

const getJobOrder = (
  user: OrganizationChartUser,
  orderMap: Record<string, number>
) => {
  return orderMap[user.job_title || ''] ?? 99;
};

const sortUsers = (
  list: OrganizationChartUser[],
  orderMap: Record<string, number>
) => {
  return [...list].sort((a, b) => {
    const jobDiff =
      getJobOrder(a, orderMap) - getJobOrder(b, orderMap);

    if (jobDiff !== 0) return jobDiff;

    return (a.display_order ?? 0) - (b.display_order ?? 0);
  });
};

/* -------------------------------------------------------
   사람 카드
------------------------------------------------------- */

function PersonCard({
  user,
  isAdmin,
  compact = false,
}: {
  user: OrganizationChartUser;
  isAdmin?: boolean;
  compact?: boolean;
}) {
  const handleEdit = () => {
    const fn = (window as any).handleChartEdit;
    if (typeof fn === 'function') {
      fn(user.id);
    }
  };

  const handleDelete = () => {
    const fn = (window as any).handleChartDelete;
    if (typeof fn === 'function') {
      fn(user.id);
    }
  };

  const isLeader =
    user.job_title === '본부장' ||
    user.job_title === '소장' ||
    user.job_title === '팀장';

  return (
    <div
      className={`
        relative w-full rounded-xl border bg-white
        transition-shadow hover:shadow-md
        ${isLeader ? 'border-slate-400' : 'border-slate-200'}
        ${compact ? 'px-3 py-2.5' : 'px-3.5 py-3'}
      `}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`
                font-semibold text-slate-800 truncate
                ${compact ? 'text-xs' : 'text-sm'}
              `}
            >
              {user.name}
            </span>

            {user.job_title && (
              <span
                className={`
                  shrink-0 rounded-md bg-slate-100
                  px-1.5 py-0.5 text-[10px] text-slate-600
                `}
              >
                {user.job_title}
              </span>
            )}
          </div>

          {(user.position || user.field) && (
            <div className="mt-1 text-[10px] text-slate-400 truncate">
              {user.position}
              {user.position && user.field ? ' · ' : ''}
              {user.field}
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={handleEdit}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              title="수정"
            >
              <Pencil size={13} />
            </button>

            <button
              type="button"
              onClick={handleDelete}
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

/* -------------------------------------------------------
   조직 섹션
------------------------------------------------------- */

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-8 w-1 rounded-full bg-slate-700" />

      <div>
        <div className="text-base font-bold text-slate-800">
          {title}
        </div>

        {subtitle && (
          <div className="mt-0.5 text-[10px] text-slate-400">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------
   세로 연결선
------------------------------------------------------- */

function VerticalConnector() {
  return (
    <div className="flex justify-center">
      <div className="h-6 w-px bg-slate-300" />
    </div>
  );
}

/* -------------------------------------------------------
   운영
------------------------------------------------------- */

function OperationSection({
  users,
  isAdmin,
}: {
  users: OrganizationChartUser[];
  isAdmin?: boolean;
}) {
  const operationUsers = sortUsers(users, OPERATION_JOB_ORDER);

  if (operationUsers.length === 0) return null;

  return (
    <section>
      <SectionTitle
        title="운영"
        subtitle="본부 운영 및 사무"
      />

      <div className="mt-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {operationUsers.map((user) => (
            <PersonCard
              key={user.id}
              user={user}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------
   관리 분야
------------------------------------------------------- */

function ManagementSection({
  users,
  isAdmin,
}: {
  users: OrganizationChartUser[];
  isAdmin?: boolean;
}) {
  const fields = useMemo(() => {
    const map = new Map<string, OrganizationChartUser[]>();

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

  if (fields.length === 0) return null;

  return (
    <section>
      <SectionTitle
        title="관리"
        subtitle="분야별 인원"
      />

      <div className="mt-4 space-y-3">
        {fields.map(([fieldName, fieldUsers]) => {
          const sortedUsers = sortUsers(
            fieldUsers,
            TEAM_JOB_ORDER
          );

          return (
            <div
              key={fieldName}
              className="rounded-xl border border-slate-200 bg-slate-50/60 p-3"
            >
              <div className="mb-2 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-slate-500" />

                <span className="text-xs font-bold text-slate-700">
                  {fieldName}
                </span>

                <span className="text-[10px] text-slate-400">
                  {sortedUsers.length}명
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {sortedUsers.map((user) => (
                  <PersonCard
                    key={user.id}
                    user={user}
                    isAdmin={isAdmin}
                    compact
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* -------------------------------------------------------
   TEAM
------------------------------------------------------- */

function TeamSection({
  users,
  isAdmin,
}: {
  users: OrganizationChartUser[];
  isAdmin?: boolean;
}) {
  const teams = TEAM_ORDER.map((teamName) => {
    const teamUsers = users.filter(
      (user) =>
        user.department === teamName ||
        user.department === teamName.replace('팀', ' TEAM')
    );

    return {
      teamName,
      users: sortUsers(teamUsers, TEAM_JOB_ORDER),
    };
  }).filter((team) => team.users.length > 0);

  if (teams.length === 0) return null;

  return (
    <section>
      <SectionTitle
        title="TEAM"
        subtitle="팀별 조직"
      />

      <div className="mt-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {teams.map((team) => (
            <div
              key={team.teamName}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white"
            >
              {/* 팀 제목 */}
              <div className="border-b border-slate-200 bg-slate-100 px-4 py-3">
                <div className="text-sm font-bold text-slate-800">
                  {team.teamName}
                </div>

                <div className="mt-0.5 text-[10px] text-slate-400">
                  {team.users.length}명
                </div>
              </div>

              {/* 팀원 */}
              <div className="space-y-2 p-3">
                {team.users.map((user) => (
                  <PersonCard
                    key={user.id}
                    user={user}
                    isAdmin={isAdmin}
                    compact
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------
   메인 조직도
------------------------------------------------------- */

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

  /*
   * 운영
   */
  const operationUsers = useMemo(
    () =>
      activeUsers.filter(
        (user) => user.department === '운영'
      ),
    [activeUsers]
  );

  /*
   * 관리
   *
   * 운영/TEAM이 아닌 사람을 관리 대상으로 봅니다.
   * 현재 DB에서 관리 분야가 field에 들어가는 구조를 기준으로 합니다.
   */
  const managementUsers = useMemo(
    () =>
      activeUsers.filter(
        (user) =>
          user.department === '관리' ||
          (
            user.department !== '운영' &&
            !TEAM_ORDER.includes(user.department || '') &&
            !(user.department || '').includes('TEAM')
          )
      ),
    [activeUsers]
  );

  /*
   * TEAM
   */
  const teamUsers = useMemo(
    () =>
      activeUsers.filter(
        (user) =>
          TEAM_ORDER.includes(user.department || '') ||
          (user.department || '').includes('TEAM')
      ),
    [activeUsers]
  );

  const handleRootEdit = () => {
    const fn = (window as any).handleChartStructureEdit;

    if (typeof fn === 'function') {
      fn('root');
    }
  };

  return (
    <div className="w-full">
      {/* 제목 */}
      <div className="mb-6 flex items-center justify-between gap-3">
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
            onClick={handleRootEdit}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50"
          >
            <Pencil size={13} />
            제목 수정
          </button>
        )}
      </div>

      {/* 전체 조직 구조 */}
      <div className="space-y-0">
        {/* 운영 */}
        <OperationSection
          users={operationUsers}
          isAdmin={isAdmin}
        />

        {/* 연결선 */}
        {operationUsers.length > 0 &&
          managementUsers.length > 0 && (
            <VerticalConnector />
          )}

        {/* 관리 */}
        <ManagementSection
          users={managementUsers}
          isAdmin={isAdmin}
        />

        {/* 연결선 */}
        {managementUsers.length > 0 &&
          teamUsers.length > 0 && (
            <VerticalConnector />
          )}

        {/* TEAM */}
        <TeamSection
          users={teamUsers}
          isAdmin={isAdmin}
        />
      </div>

      {/* 인원이 하나도 없을 경우 */}
      {activeUsers.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center">
          <div className="text-sm text-slate-500">
            표시할 조직원이 없습니다.
          </div>
        </div>
      )}
    </div>
  );
}
