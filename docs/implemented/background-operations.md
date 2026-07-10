# Background Operations and Non-blocking UX

## 구현 상태

구현 완료.

## 구현 내용

- 백업 생성 dialog는 작업 시작 후 즉시 닫히고 `createSnapshot`은 백그라운드에서 계속 실행된다.
- block ingest progress listener를 `AppShell`에 두어 dialog가 사라진 뒤에도 하단 `OperationBar`가 진행률을 표시한다.
- 스냅샷 복원은 확인 후 즉시 dialog를 닫고 하단 불확정 진행 상태로 표시한다.
- 통계 분석 상태를 `AppShell`에서 보관해 다른 화면으로 이동했다가 돌아와도 마지막 분석 결과와 진행 상태가 유지된다.
- 통계 progress listener를 `AppShell`에 두어 Statistics 화면을 벗어나도 하단 `OperationBar`가 진행률을 표시한다.
- 백업/복원 완료와 실패는 앱 셸 알림으로 표시한다.
- 백업/복원 중에는 같은 저장소 쓰기 작업을 새로 시작하는 동작만 제한하고, 화면 이동과 설정 확인은 계속 가능하게 유지한다.
- Tauri의 대용량 block ingest, snapshot 생성, snapshot 복원, 무결성 검사 command를 blocking thread로 넘겨 UI runtime을 오래 붙잡지 않게 했다.
- 라이트/다크 테마에서 primary button 글자색을 `--app-on-primary`로 분리해 대비를 확보했다.

## 검증

- `npm test -- --run src/features/backup/NewBackupDialog.test.tsx src/app/AppShell.test.tsx src/features/snapshots/RestoreSnapshotDialog.test.tsx`: 3개 파일, 14개 테스트 통과.
- `npm test -- --run src/app/AppShell.test.tsx src/features/statistics/StatisticsPage.test.tsx src/features/statistics/StatisticsDashboard.test.tsx`: 3개 파일, 13개 테스트 통과.
- `npm run build`: TypeScript 검사와 Vite production build 통과.
- `git diff --check`: 공백 오류 없음.

## 남은 확장 후보

- 복원 byte 단위 progress event.
- 백그라운드 작업 큐와 완료 이력.
- 작업 취소.
- 앱 종료 후 작업 재개.
