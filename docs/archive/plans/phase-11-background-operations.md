# Phase 11 Background Operations Plan

## 목표

백업 생성과 스냅샷 복원 같은 긴 작업을 하단 진행 표시 기반 백그라운드 작업으로 바꾼다. 앱은 작업 중에도 계속 조작 가능해야 하며, 같은 저장소에 충돌하는 새 쓰기 작업만 제한한다.

## 작업 목록

- [x] 백업 생성 dialog의 progress listener를 제거하고 AppShell 전역 listener로 이동
- [x] 백업 생성 시작 후 dialog를 닫고 API 작업은 계속 진행
- [x] 백업 완료/실패를 AppShell 알림으로 표시
- [x] 복원 확인 후 dialog를 닫고 하단 작업 표시로 진행 상태 표시
- [x] 복원 완료/실패를 AppShell 알림으로 표시
- [x] 백업/복원 중 새 백업 시작만 제한
- [x] 통계 분석 결과와 진행 상태를 화면 이동 후에도 유지
- [x] 통계 progress를 하단 진행 바의 실제 퍼센트로 표시
- [x] 대용량 block ingest, snapshot 생성, snapshot 복원, 무결성 검사를 blocking thread로 이동
- [x] 라이트/다크 primary text와 danger text를 테마 변수로 정리
- [x] 관련 frontend 테스트 통과 확인
- [x] `npm run build` 정적 검증
- [x] 검증 결과를 개발 로그에 확정 기록

## 테스트 기준

- 백업 시작 후 `createSnapshot` promise가 끝나기 전에 dialog close callback이 호출된다.
- 백업 중에도 dialog controls는 잠긴 상태로 남지 않는다.
- 백업 progress event는 dialog가 없어도 하단 operation bar에 표시된다.
- 복원 확인 후 `restoreSnapshot` promise가 끝나기 전에 dialog close callback이 호출된다.
- 복원은 하단 operation으로 표시되고 완료 callback을 통해 알림을 띄운다.
- 통계 분석 결과는 다른 화면으로 이동했다 돌아와도 유지된다.
- 통계 progress는 하단 operation bar에 count 기반 퍼센트로 표시된다.

## 검증 명령

```bash
npm test -- --run src/features/backup/NewBackupDialog.test.tsx src/app/AppShell.test.tsx src/features/snapshots/RestoreSnapshotDialog.test.tsx
npm test -- --run src/app/AppShell.test.tsx src/features/statistics/StatisticsPage.test.tsx src/features/statistics/StatisticsDashboard.test.tsx
npm run build
git diff --check
```
