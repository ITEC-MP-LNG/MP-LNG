# 프로젝트 규칙 및 지침 (CLAUDE.md)

## 1. 프로젝트 개요
- 모바일 퍼스트 반응형 웹 업무 & 자재 관리 시스템
- 프론트엔드: React / Next.js (Tailwind CSS, shadcn/ui)
- 백엔드 & DB: Supabase

## 2. 개발 및 디렉팅 원칙
- **모바일 퍼스트**: 아이폰/안드로이드 화면(375px~430px)을 최우선으로 고려하여 UI 설계
- **터치 영역 확보**: 모바일 버튼 및 터치 대상은 최소 44px 이상 확보
- **테이블 디자인**: 모바일에서는 카드형 리스트 형태로 전환하여 가로 스크롤 최소화
- **실시간성**: 소모성 자재 수량은 3시간 주기(Polling) 또는 Realtime으로 자동 갱신

## 3. DB 연결 규칙
- Supabase 테이블 명칭:
  - 사용자: `app_users`
  - 주간 업무: `weekly_works`
  - 일일 업무: `daily_works`
  - 자재: `materials`
  - 불출 로그: `material_logs`
  - 백업 이력: `monthly_backups`

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
