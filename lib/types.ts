export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'WORK_ADMIN' | 'SUPER_ADMIN' | 'TOP_ADMIN';
}

export const AVAILABLE_WORKERS = [
  { id: 'user1', name: '홍길동', role: 'USER' },
  { id: 'admin1', name: '김업무', role: 'WORK_ADMIN' },
  { id: 'super1', name: '이총괄', role: 'SUPER_ADMIN' },
  { id: 'top1', name: '박최고', role: 'TOP_ADMIN' },
];

export interface Task {
  id: string;
  title: string;
  description: string;
  task_type: 'WEEKLY' | 'DAILY';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  assigned_names: string[];
  time_slot: string;
  start_date: string;
}

export interface InventoryItem {
  id: string;
  type: '고정' | '소모성';
  code: string;
  name: string;
  category: string;
  vbt_type?: string;
  sub_equipment?: string;
  quantity: number;
  unit: string;
  min_quantity: number;
  location: string;
}

export interface InventoryLog {
  id: string;
  inventory_id: string;
  item_name: string;
  type: '불출' | '반납';
  quantity: number;
  worker_name: string;
  has_issue: boolean;
  memo: string;
  created_at: string;
}

export interface Education {
  id: string;
  title: string;
  instructor: string;
  edu_date: string;
  time_slot: string;
  location: string;
  description?: string;
}

export interface EducationRecord {
  id: string;
  education_id: string;
  worker_name: string;
  status: 'COMPLETED' | 'PENDING';
}
