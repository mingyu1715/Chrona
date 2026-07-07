import { AppShell } from './app/AppShell';
import { chronaApi } from './shared/api/chronaApi';

export function App() {
  return <AppShell api={chronaApi} />;
}
