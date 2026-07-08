import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import { AppPreferencesProvider } from './shared/preferences/AppPreferencesProvider';
import { I18nProvider } from './shared/i18n/I18nProvider';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppPreferencesProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </AppPreferencesProvider>
  </React.StrictMode>,
);
