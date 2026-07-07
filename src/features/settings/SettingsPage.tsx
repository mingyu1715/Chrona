import { useState } from 'react';
import type { ChronaApi } from '../../shared/api/chronaApi';
import type { CompressionMode, IntegrityReport, OpenedRepository, RepositoryLibraryItem } from '../../shared/types/chrona';
import type { ThemeMode } from '../../app/AppTopBar';
import './settings-page.css';

type Section = 'Repositories' | 'Storage' | 'Repository health' | 'Appearance';
const sections: Section[] = ['Repositories', 'Storage', 'Repository health', 'Appearance'];
export function SettingsPage({ api, repository, repositories, theme, onToggleTheme, onRemoveRepository }: {
  api: ChronaApi; repository: OpenedRepository; repositories: RepositoryLibraryItem[]; theme: ThemeMode; onToggleTheme: () => void; onRemoveRepository: (id: string) => void;
}) {
  const [section, setSection] = useState<Section>('Repositories');
  const [mode, setMode] = useState<CompressionMode>(repository.manifest.blockStrategy.compressionMode);
  const [integrity, setIntegrity] = useState<IntegrityReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function applyMode() { try { await api.setRepositoryCompressionMode(repository.registration.path, mode); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } }
  async function verify() { try { setIntegrity(await api.verifyRepository(repository.registration.path)); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } }
  return <div className="settings-page"><header className="workspace-header"><div><h1>Settings</h1><p>Repository and application preferences</p></div></header><div className="settings-layout"><nav aria-label="Settings sections">{sections.map((name) => <button key={name} type="button" aria-current={section === name ? 'page' : undefined} onClick={() => setSection(name)}>{name}</button>)}</nav><main>{error && <p role="alert">{error}</p>}{section === 'Repositories' && <section><h2>Repositories</h2>{repositories.map((item) => <div className="settings-row" key={item.repositoryId}><span><strong>{item.displayName}</strong><small>{item.path}</small></span><button type="button" onClick={() => onRemoveRepository(item.repositoryId)}>Remove from Chrona</button></div>)}</section>}{section === 'Storage' && <section><h2>Storage</h2><label>Compression mode<select value={mode} onChange={(e) => setMode(e.target.value as CompressionMode)}><option value="standard">Zstd standard</option><option value="fast">LZ4 fast</option><option value="off">Off</option></select></label><button type="button" onClick={() => void applyMode()}>Apply</button></section>}{section === 'Repository health' && <section><h2>Repository health</h2><button type="button" onClick={() => void verify()}>Verify repository</button>{integrity && <p>{integrity.status} · {integrity.missingBlockCount} missing · {integrity.corruptBlockCount} corrupt</p>}</section>}{section === 'Appearance' && <section><h2>Appearance</h2><button type="button" onClick={onToggleTheme}>Switch to {theme === 'light' ? 'dark' : 'light'} mode</button></section>}</main></div></div>;
}
