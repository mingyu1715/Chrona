import { AppShell } from './app/AppShell';
import { RepositoryPage } from './features/repository/RepositoryPage';
import { chronaApi } from './shared/api/chronaApi';

export function App() {
  return (
    <AppShell api={chronaApi}>
      <RepositoryPage />
    </AppShell>
  );
}
