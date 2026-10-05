'use client';

import { useMemo, useState } from 'react';
import {
    ChevronDown,
    ChevronRight,
    Edit3,
    Trash2,
    Users,
    Building2,
    UserCog,
} from 'lucide-react';

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

interface ChartNode {
    id: string;
    name: string;
    type: 'root' | 'department' | 'user';
    user?: OrganizationChartUser;
    children: ChartNode[];
    parentId?: string;
    department?: string;
}

/*
 * 조직도용 직책 우선순위
 *
 * 본부장
 * ↓
 * 소장
 * ↓
 * 팀장
 * ↓
 * 팀원
 */
const JOB_TITLE_ORDER: Record<string, number> = {
    본부장: 1,
    소장: 2,
    팀장: 3,
    팀원: 4,
    없음: 5,
};

const DEPARTMENT_ORDER = [
    '운영',
    '관리',
    '1팀',
    '2팀',
    '3팀',
    '4팀',
];

const TEAM_DEPARTMENTS = ['1팀', '2팀', '3팀', '4팀'];

/**
 * 조직도에 사용하지 않을 퇴사자 제거
 */
function isActiveUser(user: OrganizationChartUser) {
    return !user.is_retired && user.department !== '퇴사자';
}

/**
 * 직책 우선 정렬
 *
 * 1. 본부장
 * 2. 소장
 * 3. 팀장
 * 4. 팀원
 *
 * 같은 직책이면 display_order
 * display_order가 없으면 이름순
 */
function sortUsers(a: OrganizationChartUser, b: OrganizationChartUser) {
    const titleA = JOB_TITLE_ORDER[a.job_title || '팀원'] ?? 99;
    const titleB = JOB_TITLE_ORDER[b.job_title || '팀원'] ?? 99;

    if (titleA !== titleB) {
        return titleA - titleB;
    }

    const orderA = a.display_order ?? 9999;
    const orderB = b.display_order ?? 9999;

    if (orderA !== orderB) {
        return orderA - orderB;
    }

    return a.name.localeCompare(b.name, 'ko');
}

function UserNodeCard({
    user,
    isAdmin,
    onEdit,
    onDelete,
}: {
    user: OrganizationChartUser;
    isAdmin: boolean;
    onEdit: (user: OrganizationChartUser) => void;
    onDelete: (user: OrganizationChartUser) => void;
}) {
    const isLeader = ['본부장', '소장', '팀장'].includes(
        user.job_title || ''
    );

    const title = user.job_title && user.job_title !== '없음'
        ? user.job_title
        : '';

    return (
        <div
            className={`
        relative
        w-full
        sm:w-[220px]
        bg-white
        border
        rounded-xl
        shadow-sm
        overflow-hidden
        transition-all
        hover:shadow-md
        ${isLeader
                    ? 'border-slate-400'
                    : 'border-slate-200'
                }
      `}
        >
            {/* 상단 포인트 */}
            <div
                className={`h-1 ${isLeader
                        ? 'bg-slate-700'
                        : 'bg-slate-300'
                    }`}
            />

            <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <div
                            className={`
                w-9 h-9
                rounded-full
                flex
                items-center
                justify-center
                shrink-0
                text-sm
                font-bold
                ${isLeader
                                    ? 'bg-slate-700 text-white'
                                    : 'bg-slate-100 text-slate-700'
                                }
              `}
                        >
                            {user.name?.[0] || '유'}
                        </div>

                        <div className="min-w-0">
                            <div className="font-bold text-sm text-slate-800 truncate">
                                {user.name}
                            </div>

                            <div className="text-[11px] text-slate-500 truncate">
                                {user.position || '사원'}
                            </div>
                        </div>
                    </div>

                    {isAdmin && (
                        <div className="flex items-center gap-1 shrink-0">
                            <button
                                type="button"
                                onClick={() => onEdit(user)}
                                className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                                title="정보 수정"
                            >
                                <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                                type="button"
                                onClick={() => onDelete(user)}
                                className="p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-50"
                                title="삭제"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>

                <div className="mt-2 flex flex-wrap gap-1">
                    {title && (
                        <span
                            className={`
                inline-flex
                items-center
                px-2
                py-0.5
                rounded-full
                text-[10px]
                font-bold
                ${isLeader
                                    ? 'bg-slate-100 text-slate-700'
                                    : 'bg-gray-50 text-gray-600'
                                }
              `}
                        >
                            {title}
                        </span>
                    )}

                    {user.field && (
                        <span className="px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 text-[10px]">
                            {user.field}
                        </span>
                    )}
                </div>

                {user.phone && (
                    <div className="mt-2 text-[10px] text-slate-400 truncate">
                        {user.phone}
                    </div>
                )}
            </div>
        </div>
    );
}

function DepartmentNode({
    node,
    isAdmin,
    onEdit,
    onDelete,
}: {
    node: ChartNode;
    isAdmin: boolean;
    onEdit: (user: OrganizationChartUser) => void;
    onDelete: (user: OrganizationChartUser) => void;
}) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className="flex flex-col items-center w-full">
            <button
                type="button"
                onClick={() => setCollapsed((prev) => !prev)}
                className="
          group
          w-full
          sm:w-[230px]
          px-4
          py-2.5
          rounded-xl
          border
          border-slate-300
          bg-slate-50
          hover:bg-slate-100
          transition
          flex
          items-center
          justify-between
          gap-2
        "
            >
                <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-600" />

                    <span className="font-bold text-sm text-slate-700">
                        {node.name}
                    </span>
                </div>

                {node.children.length > 0 && (
                    collapsed ? (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                    )
                )}
            </button>

            {!collapsed && node.children.length > 0 && (
                <>
                    <div className="w-px h-5 bg-slate-300" />

                    <div
                        className="
              relative
              w-full
              flex
              flex-col
              sm:flex-row
              sm:flex-wrap
              items-center
              justify-center
              gap-5
              sm:gap-7
            "
                    >
                        {node.children.map((child) => (
                            <ChartNodeRenderer
                                key={child.id}
                                node={child}
                                isAdmin={isAdmin}
                                onEdit={onEdit}
                                onDelete={onDelete}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

function UserBranch({
    node,
    isAdmin,
    onEdit,
    onDelete,
}: {
    node: ChartNode;
    isAdmin: boolean;
    onEdit: (user: OrganizationChartUser) => void;
    onDelete: (user: OrganizationChartUser) => void;
}) {
    const [collapsed, setCollapsed] = useState(false);

    if (!node.user) return null;

    return (
        <div className="flex flex-col items-center w-full sm:w-auto">
            <UserNodeCard
                user={node.user}
                isAdmin={isAdmin}
                onEdit={onEdit}
                onDelete={onDelete}
            />

            {node.children.length > 0 && (
                <>
                    <button
                        type="button"
                        onClick={() => setCollapsed((prev) => !prev)}
                        className="w-8 h-5 flex items-center justify-center text-slate-400 hover:text-slate-700"
                        title={collapsed ? '하위 조직 펼치기' : '하위 조직 접기'}
                    >
                        {collapsed ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                        )}
                    </button>

                    {!collapsed && (
                        <div className="w-px h-4 bg-slate-300" />
                    )}
                </>
            )}

            {!collapsed && node.children.length > 0 && (
                <div
                    className="
            w-full
            flex
            flex-col
            sm:flex-row
            sm:flex-wrap
            items-center
            justify-center
            gap-5
            sm:gap-7
          "
                >
                    {node.children.map((child) => (
                        <ChartNodeRenderer
                            key={child.id}
                            node={child}
                            isAdmin={isAdmin}
                            onEdit={onEdit}
                            onDelete={onDelete}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function ChartNodeRenderer({
    node,
    isAdmin,
    onEdit,
    onDelete,
}: {
    node: ChartNode;
    isAdmin: boolean;
    onEdit: (user: OrganizationChartUser) => void;
    onDelete: (user: OrganizationChartUser) => void;
}) {
    if (node.type === 'department') {
        return (
            <DepartmentNode
                node={node}
                isAdmin={isAdmin}
                onEdit={onEdit}
                onDelete={onDelete}
            />
        );
    }

    if (node.type === 'user') {
        return (
            <UserBranch
                node={node}
                isAdmin={isAdmin}
                onEdit={onEdit}
                onDelete={onDelete}
            />
        );
    }

    return null;
}

export default function OrganizationChart({
    users,
    rootTitle = '조직도',
    isAdmin = false,
}: OrganizationChartProps) {
    const [refreshKey, setRefreshKey] = useState(0);

    const activeUsers = useMemo(
        () => users.filter(isActiveUser),
        [users]
    );

    const chartRoot = useMemo(() => {
        const root: ChartNode = {
            id: 'root',
            name: rootTitle,
            type: 'root',
            children: [],
        };

        /*
         * -------------------------------------------------------
         * 1. 본부장
         * -------------------------------------------------------
         *
         * 본부장은 최상단에 배치한다.
         */
        const executives = activeUsers
            .filter((u) => u.job_title === '본부장')
            .sort(sortUsers);

        /*
         * 2. 소장
         *
         * 본부장이 존재하면 본부장 아래,
         * 없으면 조직도 루트 아래.
         */
        const managers = activeUsers
            .filter((u) => u.job_title === '소장')
            .sort(sortUsers);

        /*
         * 3. 부서
         */
        const departmentNames = Array.from(
            new Set(
                activeUsers
                    .map((u) => u.department)
                    .filter(
                        (department): department is string =>
                            !!department &&
                            department !== '퇴사자'
                    )
            )
        ).sort((a, b) => {
            const indexA = DEPARTMENT_ORDER.indexOf(a);
            const indexB = DEPARTMENT_ORDER.indexOf(b);

            if (indexA === -1 && indexB === -1) {
                return a.localeCompare(b, 'ko');
            }

            if (indexA === -1) return 1;
            if (indexB === -1) return -1;

            return indexA - indexB;
        });

        /*
         * 이미 parent_id가 지정되어 있는 사람은
         * 자동 부서 배치보다 parent_id를 우선 사용한다.
         */
        const manuallyAssigned = new Set<string>();

        activeUsers.forEach((user) => {
            if (user.parent_id) {
                manuallyAssigned.add(user.id);
            }
        });

        /*
         * 사용자 노드 생성
         */
        const createUserNode = (
            user: OrganizationChartUser
        ): ChartNode => ({
            id: `user_${user.id}`,
            name: user.name,
            type: 'user',
            user,
            parentId: user.parent_id || undefined,
            department: user.department,
            children: [],
        });

        /*
         * 모든 사용자 노드를 먼저 만든다.
         */
        const userNodes = new Map<string, ChartNode>();

        activeUsers.forEach((user) => {
            userNodes.set(user.id, createUserNode(user));
        });

        /*
         * parent_id가 있는 사용자 연결
         */
        activeUsers.forEach((user) => {
            if (!user.parent_id) return;

            const child = userNodes.get(user.id);
            if (!child) return;

            const parent = userNodes.get(user.parent_id);

            if (parent && parent !== child) {
                parent.children.push(child);
            }
        });

        /*
         * 본부장 → 소장 관계
         *
         * parent_id가 직접 지정되지 않은 경우 자동 연결한다.
         */
        if (executives.length > 0) {
            const firstExecutive = userNodes.get(executives[0].id);

            if (firstExecutive) {
                managers.forEach((manager) => {
                    const managerNode = userNodes.get(manager.id);

                    if (
                        managerNode &&
                        !manager.parent_id &&
                        !firstExecutive.children.some(
                            (child) => child.id === managerNode.id
                        )
                    ) {
                        firstExecutive.children.push(managerNode);
                    }
                });
            }
        }

        /*
         * 부서 노드 생성
         */
        const departmentNodes: ChartNode[] = departmentNames.map(
            (department) => ({
                id: `department_${department}`,
                name: department,
                type: 'department',
                department,
                children: [],
            })
        );

        /*
         * 팀장 및 일반 구성원을 부서별로 정리
         *
         * 팀장은 항상 해당 팀의 최상단에 표시된다.
         */
        departmentNodes.forEach((departmentNode) => {
            const department = departmentNode.department;

            if (!department) return;

            const departmentUsers = activeUsers
                .filter((user) => user.department === department)
                .filter((user) => !manuallyAssigned.has(user.id))
                .filter((user) => user.job_title !== '본부장')
                .filter((user) => user.job_title !== '소장')
                .sort(sortUsers);

            departmentUsers.forEach((user) => {
                const userNode = userNodes.get(user.id);

                if (!userNode) return;

                departmentNode.children.push(userNode);
            });
        });

        /*
         * 본부장 / 소장과 별도로 배치되어야 하는 부서들
         */
        const departmentUsersByName = new Set(
            departmentNodes.flatMap((departmentNode) =>
                departmentNode.children
                    .map((child) => child.user?.id)
                    .filter(Boolean) as string[]
            )
        );

        /*
         * parent_id가 없고 본부장/소장이 아닌데
         * 아직 어디에도 들어가지 않은 사용자 처리
         */
        activeUsers.forEach((user) => {
            if (
                user.job_title === '본부장' ||
                user.job_title === '소장'
            ) {
                return;
            }

            if (user.parent_id) {
                return;
            }

            if (departmentUsersByName.has(user.id)) {
                return;
            }

            const departmentNode = departmentNodes.find(
                (node) => node.department === user.department
            );

            const userNode = userNodes.get(user.id);

            if (departmentNode && userNode) {
                departmentNode.children.push(userNode);
            }
        });

        /*
         * 부서별 내부 정렬
         */
        departmentNodes.forEach((departmentNode) => {
            departmentNode.children.sort((a, b) => {
                if (!a.user || !b.user) return 0;
                return sortUsers(a.user, b.user);
            });
        });

        /*
         * 본부장/소장 처리
         */
        if (executives.length > 0) {
            executives.forEach((executive) => {
                const node = userNodes.get(executive.id);

                if (node && !root.children.includes(node)) {
                    root.children.push(node);
                }
            });

            /*
             * 본부장이 있으면 부서들은
             * 본부장 하단에 배치한다.
             */
            const firstExecutive = userNodes.get(executives[0].id);

            if (firstExecutive) {
                departmentNodes.forEach((departmentNode) => {
                    if (departmentNode.children.length > 0) {
                        firstExecutive.children.push(departmentNode);
                    }
                });
            }
        } else if (managers.length > 0) {
            managers.forEach((manager) => {
                const node = userNodes.get(manager.id);

                if (node && !root.children.includes(node)) {
                    root.children.push(node);
                }
            });

            departmentNodes.forEach((departmentNode) => {
                if (departmentNode.children.length > 0) {
                    const firstManager = userNodes.get(managers[0].id);

                    if (firstManager) {
                        firstManager.children.push(departmentNode);
                    } else {
                        root.children.push(departmentNode);
                    }
                }
            });
        } else {
            departmentNodes.forEach((departmentNode) => {
                if (departmentNode.children.length > 0) {
                    root.children.push(departmentNode);
                }
            });
        }

        /*
         * 혹시 parent_id로 연결된 사용자가
         * 별도의 부서 트리에 들어가지 못한 경우
         * 최종적으로 루트에 넣는다.
         */
        const connectedIds = new Set<string>();

        const collectIds = (node: ChartNode) => {
            node.children.forEach((child) => {
                if (child.type === 'user' && child.user) {
                    connectedIds.add(child.user.id);
                }

                collectIds(child);
            });
        };

        collectIds(root);

        activeUsers.forEach((user) => {
            if (
                !connectedIds.has(user.id) &&
                !executives.some((u) => u.id === user.id) &&
                !managers.some((u) => u.id === user.id)
            ) {
                const node = userNodes.get(user.id);

                if (node) {
                    root.children.push(node);
                }
            }
        });

        /*
         * 최종 정렬
         */
        const sortTree = (node: ChartNode) => {
            node.children.sort((a, b) => {
                if (a.type === 'department' && b.type !== 'department') {
                    return -1;
                }

                if (a.type !== 'department' && b.type === 'department') {
                    return 1;
                }

                if (a.user && b.user) {
                    return sortUsers(a.user, b.user);
                }

                return 0;
            });

            node.children.forEach(sortTree);
        };

        sortTree(root);

        return root;
    }, [activeUsers, rootTitle, refreshKey]);

    const handleEdit = (user: OrganizationChartUser) => {
        const handler = (window as any).handleChartEdit;

        if (typeof handler === 'function') {
            handler(user.id);
        }
    };

    const handleDelete = (user: OrganizationChartUser) => {
        const handler = (window as any).handleChartDelete;

        if (typeof handler === 'function') {
            handler(user.id);
        }
    };

    const handleStructureEdit = () => {
        const handler = (window as any).handleChartStructureEdit;

        if (typeof handler === 'function') {
            handler('root');
        }
    };

    return (
        <div className="w-full">
            {/* 조직도 헤더 */}
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                            <Users className="w-4 h-4 text-slate-700" />
                        </div>

                        <div>
                            <h2 className="font-bold text-base text-slate-800">
                                {rootTitle}
                            </h2>

                            <p className="text-[11px] text-slate-400">
                                인사정보를 기준으로 자동 구성된 조직도
                            </p>
                        </div>
                    </div>
                </div>

                {isAdmin && (
                    <button
                        type="button"
                        onClick={handleStructureEdit}
                        className="
              self-start
              sm:self-auto
              inline-flex
              items-center
              gap-1.5
              px-3
              py-1.5
              rounded-lg
              border
              border-slate-200
              bg-white
              text-slate-600
              text-xs
              font-semibold
              hover:bg-slate-50
              transition
            "
                    >
                        <Edit3 className="w-3.5 h-3.5" />
                        조직도 명칭 수정
                    </button>
                )}
            </div>

            {/* 안내 */}
            <div className="mb-4 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700">
                    조직도 표시 기준
                </span>
                <span className="mx-1.5">·</span>
                본부장 → 소장 → 부서/팀장 → 구성원 순으로 표시됩니다.
            </div>

            {/* 조직도 */}
            <div
                key={refreshKey}
                className="
          w-full
          overflow-visible
          bg-white
          rounded-2xl
          border
          border-slate-200
          p-3
          sm:p-6
        "
            >
                {/* Root */}
                <div className="flex flex-col items-center">
                    <div
                        className="
              w-full
              sm:w-[280px]
              px-5
              py-3.5
              rounded-2xl
              bg-slate-800
              text-white
              shadow-sm
              relative
            "
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Building2 className="w-4 h-4 text-slate-300" />

                            <span className="font-bold text-sm">
                                {rootTitle}
                            </span>

                            {isAdmin && (
                                <button
                                    type="button"
                                    onClick={handleStructureEdit}
                                    className="absolute right-2 top-2 p-1 rounded hover:bg-white/10"
                                    title="조직도 명칭 수정"
                                >
                                    <Edit3 className="w-3 h-3 text-slate-300" />
                                </button>
                            )}
                        </div>
                    </div>

                    {chartRoot.children.length > 0 && (
                        <div className="w-px h-6 bg-slate-300" />
                    )}

                    <div
                        className="
              w-full
              flex
              flex-col
              items-center
              gap-6
            "
                    >
                        {chartRoot.children.map((child) => (
                            <ChartNodeRenderer
                                key={child.id}
                                node={child}
                                isAdmin={isAdmin}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* 모바일 설명 */}
            <div className="mt-3 text-center text-[10px] text-slate-400 sm:hidden">
                조직도는 모바일 화면에 맞게 세로 방향으로 자동 정렬됩니다.
            </div>
        </div>
    );
}