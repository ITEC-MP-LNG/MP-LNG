'use client';

import React, { Fragment, useState, useEffect, useCallback, useRef } from 'react';
import { 
  Users, 
  Building2, 
  Briefcase, 
  Search, 
  Edit3, 
  Trash2,
  UserPlus, 
  X, 
  Check,
  Phone,
  Layers,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AtSign,
  Network,
  GitCommit,
  Shield,
  CalendarDays,
  ChevronLeft
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { exportHRToExcel, exportHRToPptx } from '@/lib/hrExport';
import CertManagement from './cert';

export interface HRUser {
  id: string;          
  name: string;
  email?: string;
  department?: string; 
  position?: string;   
  job_title?: string;  
  field?: string;      
  role?: string;       
  phone?: string;
  address?: string;
  experience?: string;
  internal_certificates?: string;
  national_certificates?: string; 
  certificates?: string;
  national_cert_details?: Array<{ method: string; kind: string }>;
  yard_cert_details?: Array<{ name: string; education_date: string; renewal_count: number; renewal_dates: string[] }>; 
  ndt_certificates?: Array<{ issuer: string; subject: string; level: string; issue_date: string; expiry_date: string }>; 
  join_date?: string;          
  career_start_date?: string;  
  password?: string;           
  pos_x?: number;              
  pos_y?: number;              
  photo_url?: string | null;
  work_status?: '근무중' | '휴무' | string;
  absence_dates?: string[];
}

interface HRManagementProps {
  isAdmin?: boolean;
  currentUserRole?: string;
  currentUser?: any;
  initialAction?: 'self-edit' | 'my-team' | null;
  onInitialActionHandled?: () => void;
  onCurrentUserStatusChange?: (status: '근무중' | '휴무') => void;
}

// 변경 여부를 비교할 때 객체 키 순서 차이와 undefined/null 차이로 불필요한 UPDATE가 발생하지 않게 합니다.
function normalizeForCompare(value: any): any {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return value.map(normalizeForCompare);
  if (typeof value === 'object') {
    return Object.keys(value).sort().reduce((result: Record<string, any>, key) => {
      result[key] = normalizeForCompare(value[key]);
      return result;
    }, {});
  }
  return value;
}

function valuesEqualForSave(left: any, right: any): boolean {
  return JSON.stringify(normalizeForCompare(left)) === JSON.stringify(normalizeForCompare(right));
}

function calculateCareerDetails(startDateStr?: string) {
  if (!startDateStr) return null;

  const start = new Date(startDateStr);
  const now = new Date();

  if (isNaN(start.getTime())) return null;

  let years = now.getFullYear() - start.getFullYear();

  const isBeforeAnniversary =
    now.getMonth() < start.getMonth() ||
    (now.getMonth() === start.getMonth() && now.getDate() < start.getDate());
