'use client';

import React, { useMemo } from 'react';
import { Pencil, Trash2, GitBranch } from 'lucide-react';

export interface OrganizationChartUser {
  id: string;
  name: string;
  department?: string;
  position?: string;
  job_title?: string;
  field?: string;
  phone?: string;
  photo_url?: string | null;
  parent_id?: string | null;
  display_order?: number;
  is_retired?: boolean;
}

interface OrganizationChartProps {
  users: OrganizationChartUser[];
  rootTitle?: string;
  isAdmin?: boolean;
}

const TEAM_ORDER = ['1팀', '2팀', '3팀', '4팀'];
const MAIN_GROUPS = ['운영', '관리', 'TEAM'] as const;

type MainGroup = (typeof MAIN_GROUPS)[number];

const JOB_ORDER: Record<string, number> = {
  본부장: 1,
  소장: 2,
  사무: 3,
  팀장: 4,
  책임: 5,
  프로: 6,
  매니저: 7,
};

function normalize(value?: string | null) {
  return (value || '').trim();
}

function getGroup(user: OrganizationChartUser): MainGroup {
  const department = normalize(user.department);
  if (department === '운영') return '운영';
  if (department === '관리') return '관리';
  if (/^[1-4]팀$/.test(department) || /^[1-4] TEAM$/i.test(department)) return 'TEAM';

  const field = normalize(user.field);
  if (field && /^(QA|품질|공정|스케줄|Schedule|QC)/i.test(field)) return '관리';

  return '운영';
}

function getTeamName(user: OrganizationChartUser) {
  const department = normalize(user.department);
  const match = department.match(/^([1-4])\s*(?:TEAM|팀)$/i);
  return match ? `${match[1]}팀` : '';
}

function sortUsers(users: OrganizationChartUser[]) {
  return [...users].sort((a, b) => {
    const jobA = JOB_ORDER[normalize(a.job_title)] ?? 99;
    const jobB = JOB_ORDER[normalize(b.job_title)] ?? 99;
    if (jobA !== jobB) return jobA - jobB;

    const orderA = Number(a.display_order ?? 0);
    const orderB = Number(b.display_order ?? 0);
    if (orderA !== orderB) return orderA - orderB;

    return normalize(a.name).localeCompare(normalize(b.name), 'ko');
  });
}

function editUser(userId: string) {
  const fn = (window as any).handleChartEdit;
  if (typeof fn === 'function') fn(userId);
}

function deleteUser(userId: string) {
  const fn = (window as any).handleChartDelete;
  if (typeof fn === 'function') fn(userId);
}

function editStructure(userId: string) {
  const fn = (window as any).handleChartStructureEdit;
  if (typeof fn === 'function') fn(`user_${userId}`);
}

function editRoot() {
  const fn = (window as any).handleChartStructureEdit;
  if (typeof fn === 'function') fn('root');
}

function getInitials(name: string) {
  const value = normalize(name);
  return value.length > 1 ? value.slice(0, 2) : value || '직원';
}

function PersonCard({
  user,
  isAdmin,
  compact = false,
}: {
  user: OrganizationChartUser;
  isAdmin?: boolean;
  compact?: boolean;
}) {
  const hasPhoto = Boolean(normalize(user.photo_url));

  return (
    <div className="group relative rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-2.5">
        <div className={`relative shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100 ${compact ? 'h-9 w-9' : 'h-11 w-11'}`}>
          {hasPhoto ? (
            <img
              src={user.photo_url!}
              alt={`${user.name} 사진`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] font-extrabold text-slate-500">
              {getInitials(user.name)}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-bold text-slate-800">{user.name}</span>
            {user.job_title && (
              <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
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

        {isAdmin && (
          <div className="flex shrink-0 gap-0.5 opacity-60 transition group-hover:opacity-100">
            <button
              type="button"
              onClick={() => editStructure(user.id)}
              className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
              title="조직도 위치 수정"
            >
              <GitBranch size={13} />
            </button>
            <button
              type="button"
              onClick={() => editUser(user.id)}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              title="인사정보 수정"
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

function GroupLabel({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-[74px] items-center rounded-xl border border-slate-300 bg-slate-800 px-4 py-3 text-white shadow-sm">
      <div>
        <div className="text-base font-extrabold tracking-tight">{title}</div>
        <div className="mt-1 text-[10px] text-slate-300">{description}</div>
      </div>
    </div>
  );
}

function Connector() {
  return <div className="hidden w-5 shrink-0 items-center justify-center md:flex"><div className="h-px w-full bg-slate-300" /></div>;
}

function GroupSection({
  title,
  description,
  users,
  isAdmin,
  children,
}: {
  title: string;
  description: string;
  users: OrganizationChartUser[];
  isAdmin?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3 md:grid-cols-[150px_minmax(0,1fr)] md:items-start">
      <GroupLabel title={title} description={description} />
      <div className="relative min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-3 md:ml-0">
        <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
          <div className="text-xs font-bold text-slate-600">구성원</div>
          <div className="text-[10px] font-semibold text-slate-400">{users.length}명</div>
        </div>
        {children}
        {users.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white py-6 text-center text-xs text-slate-400">
            등록된 구성원이 없습니다.
          </div>
        )}
      </div>
    </section>
  );
}

function DepartmentBlock({
  title,
  users,
  isAdmin,
}: {
  title: string;
  users: OrganizationChartUser[];
  isAdmin?: boolean;
}) {
  const sorted = sortUsers(users);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
      <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="text-xs font-extrabold text-slate-700">{title}</div>
        <div className="text-[10px] text-slate-400">{sorted.length}명</div>
      </div>
      <div className="grid gap-2 xl:grid-cols-2">
        {sorted.map((user) => (
          <PersonCard key={user.id} user={user} isAdmin={isAdmin} compact />
        ))}
      </div>
    </div>
  );
}

export default function OrganizationChart({ users, rootTitle = 'LNG 목포 조직도', isAdmin = false }: OrganizationChartProps) {
  const activeUsers = useMemo(
    () => users.filter((user) => !user.is_retired && normalize(user.department) !== '퇴사자'),
    [users]
  );

  const grouped = useMemo(() => {
    const result: Record<MainGroup, OrganizationChartUser[]> = {
      운영: [],
      관리: [],
      TEAM: [],
    };
    activeUsers.forEach((user) => result[getGroup(user)].push(user));
    return result;
  }, [activeUsers]);

  const operationUsers = sortUsers(grouped.운영);

  const managementFields = useMemo(() => {
    const map = new Map<string, OrganizationChartUser[]>();
    grouped.관리.forEach((user) => {
      const field = normalize(user.field) || normalize(user.position) || '기타';
      if (!map.has(field)) map.set(field, []);
      map.get(field)!.push(user);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'ko'));
  }, [grouped.관리]);

  const teams = useMemo(() => {
    return TEAM_ORDER.map((teamName) => ({
      teamName,
      users: sortUsers(grouped.TEAM.filter((user) => getTeamName(user) === teamName)),
    })).filter((team) => team.users.length > 0);
  }, [grouped.TEAM]);

  const parentInfo = useMemo(() => {
    const map = new Map<string, OrganizationChartUser>();
    activeUsers.forEach((user) => map.set(user.id, user));
    return map;
  }, [activeUsers]);

  const getParentName = (user: OrganizationChartUser) => {
    if (!user.parent_id) return '';
    const parent = parentInfo.get(user.parent_id.replace(/^user_/, ''));
    return parent?.name || '';
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            onClick={isAdmin ? editRoot : undefined}
            className={`group inline-flex max-w-full items-center gap-2 text-left ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
            title={isAdmin ? '조직도 명칭 수정' : undefined}
          >
            <h2 className="truncate text-lg font-extrabold tracking-tight text-slate-800 sm:text-xl">
              {rootTitle || 'LNG 목포 조직도'}
            </h2>
            {isAdmin && <Pencil size={15} className="shrink-0 text-slate-400 group-hover:text-slate-700" />}
          </button>
          <p className="mt-0.5 text-[10px] text-slate-400">운영 · 관리 · TEAM / 조직도 위치는 관리자 화면에서 수정할 수 있습니다.</p>
        </div>
        <div className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-500">
          총 {activeUsers.length}명
        </div>
      </div>

      <div className="space-y-4">
        <GroupSection title="운영" description="본부 운영 및 사무" users={operationUsers} isAdmin={isAdmin}>
          <div className="grid gap-2 xl:grid-cols-2">
            {operationUsers.map((user) => (
              <div key={user.id} className="min-w-0">
                <PersonCard user={user} isAdmin={isAdmin} />
                {getParentName(user) && (
                  <div className="mt-1 pl-3 text-[9px] text-slate-400">상위: {getParentName(user)}</div>
                )}
              </div>
            ))}
          </div>
        </GroupSection>

        <GroupSection title="관리" description="파트별 관리" users={grouped.관리} isAdmin={isAdmin}>
          <div className="grid gap-3 xl:grid-cols-2">
            {managementFields.map(([field, fieldUsers]) => (
              <DepartmentBlock key={field} title={field} users={fieldUsers} isAdmin={isAdmin} />
            ))}
          </div>
        </GroupSection>

        <GroupSection title="TEAM" description="팀별 조직" users={grouped.TEAM} isAdmin={isAdmin}>
          <div className="grid gap-3 xl:grid-cols-2">
            {teams.map((team) => {
              const leader = team.users.filter((user) => normalize(user.job_title) === '팀장');
              const members = team.users.filter((user) => normalize(user.job_title) !== '팀장');

              return (
                <div key={team.teamName} className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
                  <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="text-xs font-extrabold text-slate-700">{team.teamName}</div>
                    <div className="text-[10px] text-slate-400">{team.users.length}명</div>
                  </div>

                  {leader.length > 0 && (
                    <div className="mb-2 rounded-lg border border-slate-300 bg-slate-50 p-2">
                      <div className="mb-1 text-[9px] font-bold text-slate-500">TEAM LEADER</div>
                      <div className="grid gap-2">
                        {leader.map((user) => <PersonCard key={user.id} user={user} isAdmin={isAdmin} />)}
                      </div>
                    </div>
                  )}

                  {members.length > 0 && (
                    <div className="grid gap-2">
                      {members.map((user) => <PersonCard key={user.id} user={user} isAdmin={isAdmin} compact />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </GroupSection>
      </div>

      {activeUsers.some((user) => user.parent_id) && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[10px] leading-relaxed text-blue-700">
          <span className="font-bold">조직 관계:</span> 직원 카드의 <GitBranch size={11} className="mx-0.5 inline-block" /> 버튼에서 상위 조직원을 변경할 수 있습니다. 저장된 <span className="font-semibold">parent_id</span>와 표시순서를 그대로 사용합니다.
        </div>
      )}
    </div>
  );
}
