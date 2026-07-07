import { AppShell } from './app/AppShell';
import { RepositoryPage } from './features/repository/RepositoryPage';

export function App() {
  return (
    <AppShell>
      <RepositoryPage />
    </AppShell>
  );
}
